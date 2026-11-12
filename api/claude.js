// Función segura de Vercel: es la única parte de Itzé Flow que conoce la clave
// de Claude. El navegador le habla a /api/claude y nunca ve la clave.
//
// Protecciones:
// - Solo responde a usuarios con sesión válida de Supabase.
// - El modelo y los límites los decide este archivo, no el navegador.
// - No registra el contenido de los pedidos (pueden llevar fotos de INE).

const MODEL = 'claude-sonnet-5-5';
const MAX_TOKENS_LIMIT = 40000;
const ALLOWED_EFFORT = ['low', 'medium', 'high'];
const UPSTREAM_TIMEOUT_MS = 285000; // Un poco menos que el maxDuration de vercel.json

async function hasValidSession(token) {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  const resp = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  return resp.ok;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta CLAUDE_API_KEY en Vercel.' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let authorized = false;
  if (token) {
    try {
      authorized = await hasValidSession(token);
    } catch {
      return res.status(502).json({ error: 'No se pudo verificar la sesión.' });
    }
  }
  if (!authorized) {
    return res.status(401).json({ error: 'Sesión no válida. Volvé a iniciar sesión.' });
  }

  const { messages, maxTokens, effort } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Pedido inválido.' });
  }

  const requested = Number(maxTokens);
  const payload = {
    model: MODEL,
    max_tokens: requested > 0 ? Math.min(requested, MAX_TOKENS_LIMIT) : 4000,
    messages,
  };
  if (ALLOWED_EFFORT.includes(effort)) payload.output_config = { effort };

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      console.error('Claude respondió con error', upstream.status, data?.error?.type);
      return res.status(upstream.status).json({
        error: data?.error?.message || `Claude respondió con error ${upstream.status}.`,
      });
    }

    // Con pensamiento adaptativo el primer bloque puede no ser de texto.
    const text = (data?.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return res.status(200).json({ text, stopReason: data?.stop_reason });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError';
    console.error('Fallo al conectar con Claude:', err?.name);
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Claude tardó demasiado. Probá de nuevo.' : 'No se pudo conectar con Claude.',
    });
  }
}
