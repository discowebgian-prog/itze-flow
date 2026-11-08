// Función segura de Vercel: manda los avisos al celular (con la app cerrada).
// Claves VAPID: se arman solas, sin que nadie tenga que generarlas ni cargarlas (pedido de Gian:
// nada de pasos en la compu, y que sirva igual si Flow se replica para otro alojamiento).
// Se derivan de un secreto que ya está en Vercel (CLAUDE_API_KEY); si alguna vez se cargan
// VAPID_PRIVATE_KEY y VITE_VAPID_PUBLIC_KEY, se usan esas. Si cambia el secreto, cambian las claves
// y cada celular se vuelve a anotar solo al abrir Flow (ver syncPush).
//   GET  /api/push → { publicKey } (la clave pública, para que el celular se anote)
//   POST /api/push → manda el aviso
//
// - Solo responde a usuarios con sesión válida de Supabase.
// - Lee las suscripciones de push_subs con la sesión del usuario (RLS) y avisa a todas
//   menos a las de quien hizo el cambio (from = nombre del aparato).
// - Las suscripciones vencidas (el celular las borró) se eliminan solas.
import webpush from 'web-push';
import crypto from 'node:crypto';

function vapidKeys() {
  if (process.env.VAPID_PRIVATE_KEY && process.env.VITE_VAPID_PUBLIC_KEY) {
    return { pub: process.env.VITE_VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
  }
  const seed = process.env.CLAUDE_API_KEY;
  if (!seed) return null;
  const priv = crypto.createHmac('sha256', seed).update('itze-flow-vapid-v1').digest();
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(priv);
  return { pub: ecdh.getPublicKey().toString('base64url'), priv: priv.toString('base64url') };
}


export default async function handler(req, res) {
  if (req.method === 'GET') {
    const k = vapidKeys();
    if (!k) return res.status(500).json({ error: 'Falta CLAUDE_API_KEY en Vercel.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ publicKey: k.pub });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const keys = vapidKeys();
  if (!url || !anonKey) return res.status(500).json({ error: 'Falta la configuración de Supabase en Vercel.' });
  if (!keys) return res.status(500).json({ error: 'Falta CLAUDE_API_KEY en Vercel.' });

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

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://itze-flow.vercel.app', keys.pub, keys.priv);
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
