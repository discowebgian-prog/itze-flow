// Función segura de Vercel: manda los avisos al celular (con la app cerrada).
// Claves VAPID como variables de Vercel: VITE_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (esta solo la ve el servidor).
//
// - Solo responde a usuarios con sesión válida de Supabase.
// - Lee las suscripciones de push_subs con la sesión del usuario (RLS) y avisa a todas
//   menos a las de quien hizo el cambio (from = nombre del aparato).
// - Las suscripciones vencidas (el celular las borró) se eliminan solas.
import webpush from 'web-push';


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const pub = process.env.VITE_VAPID_PUBLIC_KEY;
  if (!url || !anonKey) return res.status(500).json({ error: 'Falta la configuración de Supabase en Vercel.' });
  if (!priv || !pub) return res.status(500).json({ error: 'Faltan VAPID_PRIVATE_KEY o VITE_VAPID_PUBLIC_KEY en Vercel.' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sesión no válida.' });
  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  const who = await fetch(`${url}/auth/v1/user`, { headers }).catch(() => null);
  if (!who || !who.ok) return res.status(401).json({ error: 'Sesión no válida.' });

  const { title = 'Itzé Flow', body = '', from = '' } = req.body || {};
  if (!body) return res.status(400).json({ error: 'Falta el texto del aviso.' });

  const subsResp = await fetch(`${url}/rest/v1/push_subs?select=endpoint,p256dh,auth,quien`, { headers });
  if (!subsResp.ok) return res.status(502).json({ error: 'No se pudieron leer las suscripciones (¿falta correr supabase/push.sql?).' });
  const subs = (await subsResp.json()).filter((s) => !from || s.quien !== from);

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://itze-flow.vercel.app', pub, priv);
  const payload = JSON.stringify({ title: String(title).slice(0, 80), body: String(body).slice(0, 300), url: '/' });
  let sent = 0;
  const gone = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) gone.push(s.endpoint);
        else console.error('Aviso no enviado', e && e.statusCode);
      }
    })
  );
  // Limpia las suscripciones que ya no existen
  await Promise.all(
    gone.map((ep) =>
      fetch(`${url}/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(ep)}`, { method: 'DELETE', headers }).catch(() => {})
    )
  );
  return res.status(200).json({ sent, removed: gone.length });
}
