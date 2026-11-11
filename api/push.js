// Función segura de Vercel: manda los avisos al celular (con la app cerrada).
// Claves VAPID: se arman solas, sin que nadie tenga que generarlas ni cargarlas (pedido de Gian:
// nada de pasos en la compu, y que sirva igual si Flow se replica para otro alojamiento).
// Se derivan de un secreto que ya está en Vercel (CLAUDE_API_KEY); si alguna vez se cargan
// VAPID_PRIVATE_KEY y VITE_VAPID_PUBLIC_KEY, se usan esas. Si cambia el secreto, cambian las claves
// y cada celular se vuelve a anotar solo al abrir Flow (ver syncPush).
//   GET  /api/push → { publicKey } (la clave pública, para que el celular se anote)
//   POST /api/push → manda el aviso
//   POST /api/push con encabezado x-flow-clave → "Buen día" de las 8:00 (lo dispara Supabase, ver
//        supabase/buen_dia.sql): a cada celular, su nombre y el día en palabras de Inicio.
//   POST /api/push con x-flow-clave y { tipo: 'equipo' } → aviso de Equipo (lo disparan las tablas
//        equipo_*, ver supabase/equipo_avisos.sql): a los dueños o al equipo, como Itzé Limpieza.
// Cada aparato tiene su rol (push_subs.rol): los avisos de reservas y el Buen día van solo a los dueños.
//
// - Solo responde a usuarios con sesión válida de Supabase.
// - Lee las suscripciones de push_subs con la sesión del usuario (RLS) y avisa a todas
//   menos a las de quien hizo el cambio (from = nombre del aparato).
// - Las suscripciones vencidas (el celular las borró) se eliminan solas.
import webpush from 'web-push';
import crypto from 'node:crypto';
import { daySummary, greeting, nowMerida } from './_voz.mjs';

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

  if (req.headers['x-flow-clave']) {
    if ((req.body || {}).tipo === 'equipo') return equipoAviso(req, res, { url, anonKey, keys });
    return buenDia(req, res, { url, anonKey, keys });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sesión no válida.' });
  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  const who = await fetch(`${url}/auth/v1/user`, { headers }).catch(() => null);
  if (!who || !who.ok) return res.status(401).json({ error: 'Sesión no válida.' });

  const { title = 'Itzé Flow', body = '', from = '' } = req.body || {};
  if (!body) return res.status(400).json({ error: 'Falta el texto del aviso.' });

  const subsResp = await fetch(`${url}/rest/v1/push_subs?select=*`, { headers });
  if (!subsResp.ok) return res.status(502).json({ error: 'No se pudieron leer las suscripciones (¿falta correr supabase/push.sql?).' });
  // Avisos de reservas: solo a los dueños (el equipo recibe solo lo de Equipo) y no a quien hizo el cambio
  const subs = (await subsResp.json()).filter((s) => s.rol !== 'equipo' && (!from || s.quien !== from));

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

// Fila de la base → lo que usa el día en palabras (mismos nombres que en la app)
const toRes = (r) => ({
  guestName: r.huesped || '',
  room: r.habitacion || '',
  checkIn: r.fecha_ingreso || '',
  checkOut: r.fecha_salida || '',
  status: r.estado || 'por_llegar',
  totalAmount: Number(r.monto) || 0,
  paid: Number(r.monto_pagado) || 0,
  totalGuests: Number(r.cantidad_huespedes) || 1,
  lateCheckout: r.late_checkout_hora || '',
  grupoId: r.grupo_id || null,
  grupoTitular: r.grupo_titular === true,
  grupoReservante: r.grupo_reservante || null,
});

// "Buen día, Marce ☀️" + el día en palabras, a cada celular con avisos activos.
// Sin sesión: Supabase lo llama a las 8:00 con la clave de flow_secreto. La función flow_buen_dia
// (en la base) revisa la clave y recién ahí devuelve las reservas de hoy y las suscripciones.
async function buenDia(req, res, { url, anonKey, keys }) {
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' };
  const r = await fetch(`${url}/rest/v1/rpc/flow_buen_dia`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_clave: String(req.headers['x-flow-clave']) }),
  }).catch(() => null);
  if (!r || !r.ok) return res.status(502).json({ error: 'No se pudo leer el día (¿falta correr supabase/buen_dia.sql?).' });
  const data = await r.json();
  if (!data) return res.status(401).json({ error: 'Clave no válida.' });

  // Solo a los dueños: el equipo no recibe el resumen de reservas
  const roles = await subsConRol(url, anonKey, String(req.headers['x-flow-clave']));
  const deEquipo = new Set((roles || []).filter((s) => s.rol === 'equipo').map((s) => s.endpoint));
  data.subs = (data.subs || []).filter((s) => !deEquipo.has(s.endpoint));

  const now = nowMerida();
  const lines = daySummary((data.reservas || []).map(toRes), now);
  const body = lines.join('\n') || 'Día tranquilo: nadie entra ni sale hoy.';
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://itze-flow.vercel.app', keys.pub, keys.priv);
  let sent = 0;
  await Promise.all(
    (data.subs || []).map(async (s) => {
      const g = greeting(s.quien || '', now);
      // tag fijo: el de mañana reemplaza al de hoy; sticky: en la compu / Android queda hasta que se cierra
      const payload = JSON.stringify({ title: `${g.text} ${g.emoji}`, body, url: '/', tag: 'itze-flow-buen-dia', sticky: true });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 });
        sent++;
      } catch (e) {
        console.error('Buen día no enviado', e && e.statusCode);
      }
    })
  );
  return res.status(200).json({ sent, lines: lines.length });
}

// ── Avisos de Equipo (paso 7) ─────────────────────────────────────────────────
// Las mismas reglas y textos que la Edge Function "notify" de Itzé Limpieza, con los nombres de Flow.
async function subsConRol(url, anonKey, clave, borrar = null) {
  const r = await fetch(`${url}/rest/v1/rpc/flow_avisos_subs`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_clave: clave, p_borrar: borrar }),
  }).catch(() => null);
  if (!r || !r.ok) return null;
  return r.json();
}

// "8:05 am" / "1:20 pm" (como las horas de Limpieza, sin "a.m." con punto que se pisa con el del final)
const horaMx = (iso) => {
  const [h, m] = new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Merida' }).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
const hoyMx = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Merida' });
const PAGO = { efectivo: 'efectivo', transferencia: 'transferencia', debito: 'débito', credito: 'crédito', vcc: 'tarjeta virtual', otro: 'otro medio' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const diaCorto = (d) => { const [, m, dd] = String(d).slice(0, 10).split('-').map(Number); return `${dd} ${MESES[m - 1]}`; };
const dn = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// { table, type, record, old_record, hab } → { target: 'dueno' | 'equipo', title, body } o null
export function equipoMensaje({ table, type, record: r, old_record: o, hab }) {
  if (!r) return null;
  if (table === 'equipo_tareas') {
    if (r.tipo === 'programada' || (type === 'INSERT' && r.plantilla_id)) return null;
    const lugar = r.zona ? ` (${r.zona})` : '';
    const deEquipo = r.de_rol === 'equipo';
    const quien = r.creada_por_nombre || 'Mary';
    if (type === 'INSERT') {
      if (r.tipo === 'mensaje' && deEquipo) return { target: 'dueno', title: `${quien} dice`, body: r.texto + lugar };
      if (r.tipo === 'mensaje') return { target: 'equipo', title: 'Mensaje para ti', body: r.texto + lugar };
      if (r.tipo === 'rutina') return { target: 'equipo', title: 'Nueva rutina diaria', body: r.texto + lugar };
      return { target: 'equipo', title: r.fecha > hoyMx() ? 'Nueva tarea para mañana' : 'Nueva tarea para hoy', body: r.texto + lugar };
    }
    if (r.editada_en && r.editada_en !== o?.editada_en) {
      if (r.editada_por_rol === 'equipo') return { target: 'dueno', title: `${r.editada_por_nombre || 'Mary'} corrigió una nota`, body: r.texto + lugar };
      if (!deEquipo) return { target: 'equipo', title: r.tipo === 'mensaje' ? 'Se cambió un mensaje para ti' : 'Se cambió una tarea', body: r.texto + lugar };
      return null;
    }
    if (r.tipo === 'mensaje' && !deEquipo && r.hecha && !o?.hecha) {
      return { target: 'dueno', title: `${r.hecha_por_nombre || 'Mary'} vio tu mensaje`, body: r.texto };
    }
    return null;
  }
  if (table === 'equipo_insumos') {
    if (type === 'INSERT') return { target: 'dueno', title: `${r.creado_por_nombre || 'Mary'} avisa: falta un insumo`, body: `${r.nombre} — ${r.urgente ? 'se acabó' : 'queda poco'}` };
    if (r.estado === 'repuesto' && o?.estado === 'falta') return { target: 'equipo', title: 'Insumo repuesto', body: `${r.nombre} ya está disponible` };
    return null;
  }
  if (table === 'equipo_dias') {
    if (r.cerrado && (type === 'INSERT' || !o?.cerrado)) {
      const n = Number(r.pendientes) || 0;
      return { target: 'dueno', title: `${r.cerrado_por_nombre || 'Mary'} finalizó el día`, body: n ? `Cerró el día con ${n} pendiente${n > 1 ? 's' : ''}. Pasan para mañana.` : 'Cerró el día con todo listo.' };
    }
    if (r.empezo_en && !o?.empezo_en) return { target: 'dueno', title: 'Mary empezó su día ☀️', body: 'Llegó a las ' + horaMx(r.empezo_en) + '.' };
    return null;
  }
  // Reservas que toca el equipo (paso 9): a los dueños, para que se enteren y lo marquen "Visto"
  if (table === 'equipo_movimientos') {
    const por = r.por_nombre || 'Mary';
    const hab = r.habitacion ? ` (${r.habitacion})` : '';
    const quien = (r.huesped || 'Sin nombre') + hab;
    const plata = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
    const forma = PAGO[String(r.forma_pago || '').toLowerCase()] || String(r.forma_pago || 'efectivo').toLowerCase();
    if (r.tipo === 'nueva') {
      const fechas = r.fecha_ingreso && r.fecha_salida ? ` · ${diaCorto(r.fecha_ingreso)} → ${diaCorto(r.fecha_salida)}` : '';
      const pago = Number(r.pagado) > 0 ? ` · pagó ${plata(r.pagado)} en ${forma}` : ' · sin pago todavía';
      return { target: 'dueno', title: `${por} cargó una reserva`, body: quien + fechas + pago };
    }
    if (r.tipo === 'cobro') return { target: 'dueno', title: `${por} cobró ${plata(r.monto)} en ${forma}`, body: quien };
    if (r.tipo === 'checkin') return { target: 'dueno', title: `${por} hizo el check-in`, body: quien };
    if (r.tipo === 'cancelacion') return { target: 'dueno', title: `${por} canceló una reserva`, body: quien };
    if (r.tipo === 'edicion') return { target: 'dueno', title: `${por} cambió una reserva`, body: quien };
    return null; // check-out: ya avisa "Hab N: ya salieron"
  }
  if (table === 'equipo_habitaciones') {
    const h = hab || {};
    const num = String(r.habitacion || '').replace(/^P/i, '');
    // Lista: a los dueños, una por habitación (si venden la habitación, saben al instante que ya puede entrar)
    if (r.lista_en && !o?.lista_en) {
      const est = h.status === 'estancia', entra = h.status === 'sale_entra' || h.status === 'entrada';
      let lin = false;
      if (est) {
        if (r.sabanas === true || r.sabanas === false) lin = r.sabanas;
        else if (h.checkin) { const n = dn(h.checkin, r.fecha) + 1; lin = n >= 5 && n % 5 === 0 && !(h.checkout && dn(r.fecha, h.checkout) < 2); }
      }
      const quien = r.lista_por_nombre || 'Mary';
      return {
        target: 'dueno',
        title: lin ? `Hab ${num}: cambio de sábanas listo ✓` : est ? `Hab ${num}: repaso listo ✓` : `Hab ${num} lista ✓`,
        body: entra ? (h.guest_in ? `Ya puede entrar ${h.guest_in}.` : 'Ya puede entrar el huésped.')
          : lin ? `${quien} cambió sábanas y toallas e hizo limpieza profunda.` : est ? `${quien} terminó el repaso.` : `${quien} la dejó lista.`,
      };
    }
    if (r.salieron_en && !o?.salieron_en) {
      const quien = h.guest ? `Salió ${h.guest}` : 'Salieron los huéspedes';
      if (r.salieron_por_rol === 'dueno') return { target: 'equipo', title: `Hab ${num}: ya salieron`, body: `${quien}. Ya puedes prepararla :)` };
      return {
        target: 'dueno', title: `Hab ${num}: ya salieron`,
        body: `${quien} a las ${horaMx(r.salieron_en)}.` + (h.status === 'sale_entra' ? ` ${r.salieron_por_nombre || 'Mary'} la prepara para ${h.guest_in || 'el que entra'}.` : ''),
      };
    }
  }
  return null;
}

async function equipoAviso(req, res, { url, anonKey, keys }) {
  const clave = String(req.headers['x-flow-clave']);
  const subs = await subsConRol(url, anonKey, clave);
  if (!subs) return res.status(401).json({ error: 'Clave no válida.' });
  const msg = equipoMensaje(req.body || {});
  if (!msg) return res.status(200).json({ sent: 0, skip: true });
  const to = subs.filter((s) => (s.rol || 'dueno') === msg.target);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://itze-flow.vercel.app', keys.pub, keys.priv);
  // Cada aviso por separado (tag único) y queda hasta que se toca, como en Limpieza
  // Numerito del ícono: a Mary, todos sus avisos (se borra al abrir); a los dueños, solo los movimientos de Mary
  // con reservas ('mov': suma 1 y al abrir Flow queda en los que faltan marcar "Visto")
  const badge = msg.target === 'equipo' ? true : (req.body || {}).table === 'equipo_movimientos' ? 'mov' : false;
  const payload = JSON.stringify({ title: msg.title.slice(0, 80), body: msg.body.slice(0, 300), url: '/', tag: 'itze-eq-' + Date.now(), sticky: true, badge, vib: true });
  let sent = 0;
  const gone = [];
  await Promise.all(
    to.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 12 * 3600 });
        sent++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) gone.push(s.endpoint);
        else console.error('Aviso de Equipo no enviado', e && e.statusCode);
      }
    })
  );
  if (gone.length) await subsConRol(url, anonKey, clave, gone);
  return res.status(200).json({ sent, removed: gone.length, target: msg.target });
}
