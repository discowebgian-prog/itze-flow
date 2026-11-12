// Respaldo de Flow: arma la planilla Excel, la guarda en Flow (tabla flow_respaldos) y la manda por correo.
//
//   POST /api/respaldo con x-flow-clave → lo dispara Supabase todas las noches a las 3:00 de Progreso
//        (responde 202 enseguida y sigue en el servidor). Correo: todas las noches (pedido de Gian).
//   POST /api/respaldo con sesión de dueño → "Hacer respaldo ahora" de Finanzas › Respaldos
//        (espera a que termine; siempre manda el correo si está configurado).
//
// Correo con Resend (gratis): variables en Vercel RESEND_API_KEY y, opcional, RESPALDO_CORREO
// (a dónde llega; si falta, itzehostel@gmail.com) y RESPALDO_DE (remitente; si falta, onboarding@resend.dev,
// que solo puede mandar al correo con el que se creó la cuenta de Resend).
import { waitUntil } from '@vercel/functions';
import { armarPlanilla, hoyProgreso } from './_respaldo.mjs';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

async function mandarCorreo({ buffer, nombre, resumen }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'sin configurar';
  const para = process.env.RESPALDO_CORREO || 'itzehostel@gmail.com';
  const de = process.env.RESPALDO_DE || 'Itzé Flow <onboarding@resend.dev>';
  const fecha = hoyProgreso();
  const d = new Date(`${fecha}T12:00:00Z`);
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;color:#111">
    <p>Hola 👋 Acá va el respaldo de Flow del ${DIAS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}.</p>
    <p><b>${resumen.reservas}</b> reservas activas · <b>${resumen.canceladas}</b> canceladas · <b>${resumen.eliminadas}</b> eliminadas ·
    <b>${resumen.huespedes}</b> huéspedes · <b>${resumen.gastos}</b> gastos.</p>
    <p style="color:#6B7280">Guardá este correo: si algún día Flow no abre, en el Excel adjunto está todo.</p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: de,
      to: [para],
      subject: `Respaldo de Flow · ${fecha}`,
      html,
      attachments: [{ filename: nombre, content: buffer.toString('base64') }],
    }),
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
  if (r.ok) return 'enviado';
  const detalle = await r.text().catch(() => '');
  return `no se pudo (${r.status}${detalle ? `: ${detalle.slice(0, 160)}` : ''})`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return res.status(500).json({ error: 'Falta la configuración de Supabase en Vercel.' });

  const clave = req.headers['x-flow-clave'] ? String(req.headers['x-flow-clave']) : null;
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!clave && !token) return res.status(401).json({ error: 'Sesión no válida.' });

  // Con la clave habla como anónimo (la base revisa la clave); con sesión, como ese usuario (la base revisa que sea dueño)
  const rpc = async (fn, body) => {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${clave ? anonKey : token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!r) return { ok: false, status: 0, data: null };
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
  };

  const perm = await rpc('respaldo_permitido', { p_clave: clave });
  if (!perm.ok) {
    return res.status(perm.status === 404 ? 501 : 502).json({
      error: perm.status === 404 ? 'Falta correr el SQL de respaldos en Supabase.' : 'No pude hablar con la base.',
    });
  }
  if (perm.data !== true) return res.status(401).json({ error: 'Solo los dueños pueden hacer respaldos.' });

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const manual = !clave;
  const hechoPor = manual ? String(body.hechoPor || 'Dueños').slice(0, 40) : 'Flow';

  const trabajo = async () => {
    const datos = await rpc('flow_respaldo_datos', { p_clave: clave });
    if (!datos.ok || !datos.data) throw new Error('No pude leer los datos para el respaldo.');
    const { buffer, resumen, nombre } = await armarPlanilla(datos.data);

    resumen.correo = await mandarCorreo({ buffer, nombre, resumen });

    const g = await rpc('flow_respaldo_guardar', {
      p_clave: clave,
      p_nombre: nombre,
      p_b64: buffer.toString('base64'),
      p_resumen: resumen,
      p_origen: manual ? 'manual' : 'auto',
      p_hecho_por: hechoPor,
    });
    if (!g.ok || !g.data) throw new Error('No pude guardar el respaldo en Flow.');
    return { id: g.data, nombre, resumen };
  };

  if (!manual) {
    waitUntil(trabajo().catch((e) => console.error('[respaldo]', e)));
    return res.status(202).json({ ok: true });
  }
  try {
    const r = await trabajo();
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    console.error('[respaldo]', e);
    return res.status(500).json({ error: e.message || 'No se pudo hacer el respaldo.' });
  }
}
