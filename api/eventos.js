// Función segura de Vercel: RADAR DE EVENTOS.
// Claude busca en internet (herramienta web_search de la API) eventos que pueden traer huéspedes
// a Progreso en los próximos 12 meses y los guarda en la tabla `eventos` (ver supabase/eventos.sql).
//   POST /api/eventos con x-flow-clave → lo dispara Supabase cada lunes 7:00 de Progreso.
//        Si aparece algo nuevo de impacto alto, avisa al celular de los dueños.
//   POST /api/eventos con sesión de un dueño → botón "Buscar ahora" de Inicio (sin aviso al celular).
// Responde enseguida (202) y la búsqueda sigue en el servidor (waitUntil): son 3 búsquedas en paralelo,
// una por tema, para que no pase el límite de tiempo de Vercel. Al terminar queda una fila en
// eventos_busquedas (la app la espera para actualizar la tarjeta; si falló, con el error).
// Costo: cada búsqueda en internet sale US$0,01 (más el texto); máx. MAX_SEARCHES por tema.
import webpush from 'web-push';
import { waitUntil } from '@vercel/functions';
import { vapidKeys, subsConRol } from './push.js';

const MODEL = 'claude-sonnet-5-5';
const MAX_SEARCHES = 6; // por tema (3 temas en paralelo)
const TOPE_MS = 270000; // todo tiene que terminar antes del maxDuration de vercel.json (300 s)

// Un tema por búsqueda (corren al mismo tiempo)
const TEMAS = [
  'feriados y puentes largos de México, temporadas altas (Semana Santa y Pascua, vacaciones de verano, Navidad y Año Nuevo), carnaval de Progreso y de Mérida, y fiestas patronales y religiosas',
  'festivales, ferias y eventos culturales (Noche Blanca, Festival de la Cultura Maya, Hanal Pixán, Paseo de las Ánimas, ferias gastronómicas, exposiciones) y conciertos grandes',
  'eventos deportivos (maratones, medio maratón, triatlones, kitesurf, pesca, vela, ciclismo, natación en aguas abiertas, torneos), congresos y convenciones en Mérida y arribos de cruceros al puerto de Progreso',
];
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

  // La búsqueda sigue en segundo plano; la app se entera por eventos_busquedas
  const trabajo = async () => {
    const limite = Date.now() + TOPE_MS;
    const res3 = await Promise.allSettled(TEMAS.map((t) => buscarEventos(apiKey, conocidos, t, limite)));
    const errores = res3.filter((r) => r.status === 'rejected').map((r) => String((r.reason && r.reason.message) || r.reason).slice(0, 140));
    errores.forEach((e) => console.error('Radar de eventos: error', e));
    // Junta los tres temas sin repetir (mismo nombre y fecha)
    const vistos = new Set();
    const eventos = [];
    res3.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      r.value.forEach((e) => {
        const k = e.nombre.toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + e.fecha_desde;
        if (vistos.has(k)) return;
        vistos.add(k);
        eventos.push(e);
      });
    });
    const error = errores.length === TEMAS.length ? errores[0] : errores.length ? `Faltó ${errores.length} de ${TEMAS.length} temas: ${errores[0]}` : null;
    const guardado = await rpc('eventos_guardar', { p_clave: clave, p_eventos: eventos, p_error: error });
    const nuevos = guardado.ok && Array.isArray(guardado.data) ? guardado.data : [];
    // Búsqueda de los lunes: si apareció algo nuevo de impacto alto, aviso a los celulares de los dueños
    const altos = nuevos.filter((e) => e.impacto === 'alto');
    if (clave && altos.length) await avisar(url, anonKey, clave, altos).catch(() => 0);
  };
  const p = trabajo().catch((e) => console.error('Radar de eventos: falló', e && e.message));
  waitUntil(p);
  return res.status(202).json({ iniciada: true });
}

// ── Claude + búsqueda en internet ────────────────────────────────────────────
async function buscarEventos(apiKey, conocidos, tema, limite) {
  const hoy = hoyMx();
  const mas = (m) => { const d = new Date(hoy + 'T12:00:00'); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };
  const hasta6 = mas(6), hasta12 = mas(12);
  const lista = (conocidos || []).map((e) => `- ${e.nombre} (${e.fecha_desde}${e.fecha_hasta ? ' a ' + e.fecha_hasta : ''})`).join('\n');
  const prompt = `Hoy es ${hoy}. Sos el radar de eventos de Itzé Hostel Boutique, un hostel boutique de 6 habitaciones privadas en Progreso, Yucatán, México (puerto y playa a 30 minutos de Mérida). Su público: parejas, familias, grupos de amigos, viajeros de Mérida y del resto de México, extranjeros y gente que viene por trabajo.

TAREA: buscá en internet eventos de los PRÓXIMOS 12 MESES (hasta ${hasta12}) que puedan traer huéspedes a Progreso y la costa (Progreso, Chicxulub, Chelem, Telchac, Sisal) o a Mérida si mueven gente que también duerme en la costa.
En esta búsqueda, enfocate SOLO en: ${tema}.
Dónde buscar: Ayuntamiento de Progreso y de Mérida, Secretaría de Fomento Turístico (SEFOTUR) y de Cultura de Yucatán, puerto de Progreso (cruceros), organizadores de cada evento, medios locales (Diario de Yucatán, La Jornada Maya, Novedades Yucatán, Por Esto).

REGLAS:
- Solo eventos con fecha concreta (al menos el día de inicio) que hayas visto en una fuente. No inventes. Si la fecha todavía no está confirmada por los organizadores, poné "confianza": "probable".
- Si un evento ya está en la lista de conocidos, usá EXACTAMENTE el mismo nombre y la misma fecha_desde (podés corregir el resto de los datos).
- Cruceros: no uno por barco; si hay arribos, uno por mes que diga en la descripción cuántos y qué días.
- impacto: "alto" si llena Progreso (carnaval, Semana Santa, verano, Navidad y Año Nuevo, festivales grandes), "medio" si atrae bastante gente de afuera, "bajo" si es más local.
- ideas: 2 o 3 acciones concretas y cortas para el hostel (precio, difusión o participación: convenio con organizadores, paquete o descuento para participantes, transporte, desayuno temprano, late check-out…). Tono cálido, de "vos". Sin ideas obvias ni pedir mínimo de noches (en Progreso las estadías son cortas).
- Próximos 6 meses (hasta ${hasta6}): todos los que encuentres, también los chicos y los que se organizan sobre la marcha (son los que más cuesta enterarse). Del mes 7 al 12: solo los de impacto alto o medio.
- Máximo 15 eventos, primero los de los próximos 6 meses.

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
    const quedan = limite - Date.now();
    if (quedan < 20000) throw new Error('La búsqueda tardó demasiado.');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 7000, messages, tools }),
      signal: AbortSignal.timeout(quedan),
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
