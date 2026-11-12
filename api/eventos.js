// Función segura de Vercel: RADAR DE EVENTOS.
// Claude busca en internet (herramienta web_search de la API) eventos que pueden traer huéspedes
// a Progreso en los próximos 12 meses y los guarda en la tabla `eventos` (ver supabase/eventos.sql).
//   POST /api/eventos con x-flow-clave → lo dispara Supabase cada lunes 7:00 de Progreso.
//        Si aparece algo nuevo de impacto alto, avisa al celular de los dueños.
//   POST /api/eventos con sesión de un dueño → botón "Buscar ahora" de Inicio (sin aviso al celular).
// Costo: cada búsqueda en internet sale US$0,01 (más el texto); se limita a MAX_SEARCHES por vez.
import webpush from 'web-push';
import { vapidKeys, subsConRol } from './push.js';

const MODEL = 'claude-sonnet-5-5';
const MAX_SEARCHES = 15;
const UPSTREAM_TIMEOUT_MS = 270000; // menos que el maxDuration de vercel.json (300 s)
const TIPOS = ['feriado', 'temporada', 'festival', 'cultural', 'deportivo', 'concierto', 'congreso', 'crucero', 'religioso', 'otro'];

const hoyMx = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Merida' });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!url || !anonKey) return res.status(500).json({ error: 'Falta la configuración de Supabase en Vercel.' });
  if (!apiKey) return res.status(500).json({ error: 'Falta CLAUDE_API_KEY en Vercel.' });

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

  const perm = await rpc('eventos_permitido', { p_clave: clave });
  if (!perm.ok) {
    return res.status(perm.status === 404 ? 501 : 502).json({
      error: perm.status === 404 ? 'Falta correr supabase/eventos.sql en Supabase.' : 'No se pudo hablar con la base.',
    });
  }
  if (perm.data !== true) return res.status(401).json({ error: 'Solo los dueños pueden buscar eventos.' });

  const conocidos = (await rpc('eventos_conocidos', { p_clave: clave })).data || [];

  let eventos = [];
  let error = null;
  try {
    eventos = await buscarEventos(apiKey, conocidos);
  } catch (e) {
    error = String((e && e.message) || e).slice(0, 300);
    console.error('Radar de eventos: error', error);
  }

  const guardado = await rpc('eventos_guardar', { p_clave: clave, p_eventos: eventos, p_error: error });
  if (error) return res.status(502).json({ error: 'No se pudo completar la búsqueda de eventos. Probá de nuevo más tarde.' });
  if (!guardado.ok) return res.status(502).json({ error: 'No se pudieron guardar los eventos.' });
  const nuevos = Array.isArray(guardado.data) ? guardado.data : [];

  // Búsqueda de los lunes: si apareció algo nuevo de impacto alto, aviso a los celulares de los dueños
  let sent = 0;
  const altos = nuevos.filter((e) => e.impacto === 'alto');
  if (clave && altos.length) sent = await avisar(url, anonKey, clave, altos).catch(() => 0);

  return res.status(200).json({ encontrados: eventos.length, nuevos: nuevos.length, avisos: sent });
}

// ── Claude + búsqueda en internet ────────────────────────────────────────────
async function buscarEventos(apiKey, conocidos) {
  const hoy = hoyMx();
  const lista = (conocidos || []).map((e) => `- ${e.nombre} (${e.fecha_desde}${e.fecha_hasta ? ' a ' + e.fecha_hasta : ''})`).join('\n');
  const prompt = `Hoy es ${hoy}. Sos el radar de eventos de Itzé Hostel Boutique, un hostel boutique de 6 habitaciones privadas en Progreso, Yucatán, México (puerto y playa a 30 minutos de Mérida). Su público: parejas, familias, grupos de amigos, viajeros de Mérida y del resto de México, extranjeros y gente que viene por trabajo.

TAREA: buscá en internet eventos de los PRÓXIMOS 12 MESES que puedan traer huéspedes a Progreso y la costa (Progreso, Chicxulub, Chelem, Telchac, Sisal) o a Mérida si mueven gente que también duerme en la costa.
Qué buscar: feriados y puentes largos de México; temporadas (Semana Santa y Pascua, vacaciones de verano, Navidad y Año Nuevo); carnaval; festivales y ferias; eventos culturales (Noche Blanca, Festival de la Cultura Maya, Hanal Pixán, Paseo de las Ánimas); deportes (maratones, medio maratón, triatlones, kitesurf, pesca, vela, ciclismo, natación en aguas abiertas, torneos); conciertos; congresos y convenciones en Mérida; arribos de cruceros al puerto de Progreso; fiestas patronales y religiosas.
Dónde buscar: Ayuntamiento de Progreso y de Mérida, Secretaría de Fomento Turístico (SEFOTUR) y de Cultura de Yucatán, puerto de Progreso (cruceros), organizadores de cada evento, medios locales (Diario de Yucatán, La Jornada Maya, Novedades Yucatán, Por Esto).

REGLAS:
- Solo eventos con fecha concreta (al menos el día de inicio) que hayas visto en una fuente. No inventes. Si la fecha todavía no está confirmada por los organizadores, poné "confianza": "probable".
- Si un evento ya está en la lista de conocidos, usá EXACTAMENTE el mismo nombre y la misma fecha_desde (podés corregir el resto de los datos).
- Cruceros: no uno por barco; si hay arribos, uno por mes que diga en la descripción cuántos y qué días.
- impacto: "alto" si llena Progreso (carnaval, Semana Santa, verano, Navidad y Año Nuevo, festivales grandes), "medio" si atrae bastante gente de afuera, "bajo" si es más local.
- ideas: 2 o 3 acciones concretas y cortas para el hostel (precio, difusión o participación: convenio con organizadores, paquete o descuento para participantes, transporte, desayuno temprano, late check-out…). Tono cálido, de "vos". Sin ideas obvias ni pedir mínimo de noches (en Progreso las estadías son cortas).
- Máximo 30 eventos, priorizando los de más impacto y los más cercanos.

EVENTOS YA CONOCIDOS:
${lista || '(ninguno todavía)'}

RESPUESTA: al final, SOLO esto (JSON válido, sin markdown):
<eventos>[{"nombre":"…","tipo":"${TIPOS.join('|')}","fecha_desde":"AAAA-MM-DD","fecha_hasta":"AAAA-MM-DD o null","lugar":"…","impacto":"alto|medio|bajo","publico":"quiénes vienen","descripcion":"una frase","ideas":["…","…"],"fuente_url":"https://…","confianza":"confirmado|probable"}]</eventos>`;

  const tools = [
    {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: MAX_SEARCHES,
      user_location: { type: 'approximate', city: 'Progreso', region: 'Yucatán', country: 'MX', timezone: 'America/Merida' },
    },
  ];
  const messages = [{ role: 'user', content: prompt }];
  let data = null;
  // La API puede pausar una búsqueda larga (pause_turn): se continúa mandando lo mismo de nuevo
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 12000, messages, tools }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    data = await r.json().catch(() => null);
    if (!r.ok) throw new Error((data && data.error && data.error.message) || `Claude respondió con error ${r.status}.`);
    if (data.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: data.content });
  }
  const text = ((data && data.content) || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return parseEventos(text);
}

// Saca la lista de <eventos>…</eventos> y deja solo lo que sirve
export function parseEventos(text) {
  const m = String(text || '').match(/<eventos>([\s\S]*?)<\/eventos>/);
  if (!m) throw new Error('La respuesta no trajo la lista de eventos.');
  let arr;
  try {
    arr = JSON.parse(m[1].trim().replace(/^```(json)?|```$/g, ''));
  } catch {
    throw new Error('La lista de eventos no vino bien armada.');
  }
  if (!Array.isArray(arr)) return [];
  const fecha = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const hoy = hoyMx();
  return arr
    .map((e) => ({
      nombre: String(e.nombre || '').trim().slice(0, 140),
      tipo: TIPOS.includes(e.tipo) ? e.tipo : 'otro',
      fecha_desde: fecha(e.fecha_desde),
      fecha_hasta: fecha(e.fecha_hasta),
      lugar: e.lugar ? String(e.lugar).slice(0, 120) : null,
      impacto: ['alto', 'medio', 'bajo'].includes(e.impacto) ? e.impacto : 'medio',
      publico: e.publico ? String(e.publico).slice(0, 160) : null,
      descripcion: e.descripcion ? String(e.descripcion).slice(0, 300) : null,
      ideas: Array.isArray(e.ideas) ? e.ideas.map((x) => String(x).slice(0, 220)).slice(0, 3) : [],
      fuente_url: typeof e.fuente_url === 'string' && /^https?:\/\//.test(e.fuente_url) ? e.fuente_url.slice(0, 500) : null,
      confianza: e.confianza === 'confirmado' ? 'confirmado' : 'probable',
    }))
    .filter((e) => e.nombre && e.fecha_desde && (e.fecha_hasta || e.fecha_desde) >= hoy);
}

// Aviso al celular de los dueños: "Se viene: Carnaval de Progreso"
async function avisar(url, anonKey, clave, altos) {
  const subs = await subsConRol(url, anonKey, clave);
  const keys = vapidKeys();
  if (!subs || !keys) return 0;
  const to = subs.filter((s) => (s.rol || 'dueno') !== 'equipo');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://itze-flow.vercel.app', keys.pub, keys.priv);
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dia = (d) => { const [, m, dd] = d.split('-').map(Number); return `${dd} ${MESES[m - 1]}`; };
  const title = altos.length === 1 ? `Se viene: ${altos[0].nombre}` : `Se vienen ${altos.length} eventos grandes`;
  const body =
    altos.length === 1
      ? `${dia(altos[0].fecha_desde)}${altos[0].lugar ? ' · ' + altos[0].lugar : ''}. Mirá en Inicio cómo prepararse.`
      : altos.slice(0, 3).map((e) => `${e.nombre} (${dia(e.fecha_desde)})`).join(', ') + '. Mirá en Inicio cómo prepararse.';
  const payload = JSON.stringify({ title: title.slice(0, 80), body: body.slice(0, 300), url: '/', tag: 'itze-evento-' + Date.now() });
  let sent = 0;
  const gone = [];
  await Promise.all(
    to.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600 });
        sent++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) gone.push(s.endpoint);
      }
    })
  );
  if (gone.length) await subsConRol(url, anonKey, clave, gone);
  return sent;
}
