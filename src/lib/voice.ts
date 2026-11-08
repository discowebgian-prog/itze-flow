/* eslint-disable */
// @ts-nocheck
import { COUNTRIES, findCountry } from './constants';
import { currency } from './dates';
import { dayNum, mes, dayRange, listY } from './availability';

// ── LA VOZ DE FLOW ────────────────────────────────────────────────────────────
// Todo lo que la app le dice al equipo, en un solo lugar, para que hable siempre igual.
// Tono (decisión de Gian): humano, cálido, corto y claro. Nada robótico ni códigos.
// Regla: lo frecuente, corto; lo raro o importante, un poco más cálido.
// Los textos los lee el equipo (no el huésped): cuentan lo útil para ese momento.

// ── CARTELITO (aparece abajo y se va solo, sin "OK") ──────────────────────────
// notify('Reserva guardada')            → verde, se va en 2–4 s según el largo
// notify('No se pudo…', 'error')        → rojo, queda ~6 s (tocarlo lo cierra)
// notify('Volvió la conexión', 'info')  → azul
const listeners = new Set();
export const onNotify = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const notify = (text, kind = 'ok') => {
  if (!text) return;
  listeners.forEach((fn) => fn({ text, kind, id: Date.now() + Math.random() }));
};
// Cuánto queda en pantalla: lo justo para leerlo
export const toastMs = (t) =>
  t.kind === 'error' ? 6500 : Math.min(4500, Math.max(2000, 1200 + String(t.text).length * 45));

// ── ERRORES EN PALABRAS ───────────────────────────────────────────────────────
// humanError(err, 'guardar la reserva') → "No se pudo guardar la reserva: parece que se cortó internet…"
// El detalle técnico va a la consola (console.error), no a la pantalla.
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function errorKind(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  const status = Number(err?.status || err?.statusCode || 0);
  if (isOffline() || /failed to fetch|networkerror|load failed|network request failed|error de red|err_internet|fetch failed/i.test(msg))
    return 'red';
  if (/abort|timeout|timed out|tardó/i.test(msg) || status === 504) return 'lento';
  if (status === 401 || /jwt|sesi[oó]n (venci|no v[aá]lida)|not authenticated|refresh token/i.test(msg)) return 'sesion';
  if (code === 'PGRST204' || code === '42703' || /column .* does not exist|could not find the .* column|falta correr el sql/i.test(msg))
    return 'sql';
  if (code === '42501' || status === 403 || /row-level security|permission denied|not allowed|unauthorized/i.test(msg))
    return 'permiso';
  if (status === 429 || /rate limit|overloaded|demasiados/i.test(msg)) return 'ocupado';
  return 'otro';
}

const MOTIVO = {
  red: 'parece que se cortó internet. Probá de nuevo cuando vuelva la señal.',
  lento: 'la nube tardó demasiado en responder. Probá de nuevo en un ratito.',
  sesion: 'tu sesión venció. Salí y volvé a entrar.',
  sql: 'a la base le falta una actualización (un SQL pendiente en Supabase).',
  permiso: 'no hay permiso para hacer esto con este usuario.',
  ocupado: 'el servicio está con mucho trabajo. Esperá un minuto y probá de nuevo.',
  otro: 'algo falló del lado de la nube. Probá de nuevo en un momento.',
};

// keep: true → suma "Lo que escribiste sigue acá." (para formularios que quedan abiertos)
export function humanError(err, que = 'guardar', { keep = false } = {}) {
  const k = errorKind(err);
  return `No se pudo ${que}: ${MOTIVO[k]}${keep && k !== 'sesion' ? ' Lo que escribiste sigue acá.' : ''}`;
}

// Atajo: avisa el error en el cartelito rojo y lo deja en la consola
export function notifyError(err, que, opts) {
  console.error(`Error al ${que}:`, err);
  notify(humanError(err, que, opts), 'error');
}

// ── CONEXIÓN ──────────────────────────────────────────────────────────────────
export const OFFLINE_BANNER = 'Sin conexión · lo que ves puede no estar al día. Cuando vuelva, se actualiza solo.';
export const BACK_ONLINE = 'Volvió la conexión · todo al día';

// ── FECHAS Y NOMBRES (para confirmaciones y avisos) ───────────────────────────
const firstName = (n) => String(n || '').trim() || 'el huésped';
// "P2" → "P2"; ["P1","P4"] → "P1 y P4"
export const roomsText = (rooms) => listY(rooms.filter(Boolean));
// "hasta el dom 15 de nov"
export const untilText = (co) => (co ? `hasta el ${dayNum(co)} de ${mes(co)}` : '');
export const stayRange = (ci, co) => (ci && co ? dayRange(ci, co) : '');
export const countryName = (code) => {
  const c = findCountry(code) || COUNTRIES.find((x) => x.code === code);
  return c ? c.name : '';
};

// ── CONFIRMACIONES ────────────────────────────────────────────────────────────
// list: una reserva o varias (check-in/out de todo el grupo)
const asList = (m) => (Array.isArray(m) ? m : [m]).filter(Boolean);
const debe = (list) =>
  list.reduce((s, r) => s + Math.max(0, (Number(r.totalAmount) || 0) - (Number(r.paid) || 0)), 0);

export function checkInText(m) {
  const list = asList(m);
  const g = list[0] || {};
  const rooms = roomsText(list.map((r) => r.room));
  const who = list.length > 1 ? `el grupo de ${firstName(g.guestName)}` : firstName(g.guestName);
  const saldo = debe(list);
  return {
    who,
    where: rooms ? ` a ${rooms}` : '',
    detail:
      (list.length > 1 ? 'Se quedan ' : 'Se queda ') + (untilText(g.checkOut) || 'hasta su salida') + '.',
    warn: saldo > 0 ? `Le queda un saldo de ${currency(saldo)}. Si podés, cobralo ahora.` : '',
  };
}

export function checkOutText(m) {
  const list = asList(m);
  const g = list[0] || {};
  const rooms = roomsText(list.map((r) => r.room));
  const who = list.length > 1 ? `el grupo de ${firstName(g.guestName)}` : firstName(g.guestName);
  const saldo = debe(list);
  return {
    who,
    where: rooms ? ` de ${rooms}` : '',
    detail: rooms
      ? `${rooms} ${list.length > 1 ? 'quedan libres' : 'queda libre'} en el calendario.`
      : 'La propiedad queda libre en el calendario.',
    warn: saldo > 0 ? `Ojo: todavía debe ${currency(saldo)}. Cobralo antes de que se vaya.` : '',
  };
}

// Eliminar: "¿Eliminar la reserva de Ana López?" · "P3 · del jue 12 al sáb 14 de nov"
export function deleteText(r) {
  const parts = [r?.room, stayRange(r?.checkIn, r?.checkOut)].filter(Boolean);
  return {
    title: r?.guestName ? `¿Eliminar la reserva de ${firstName(r.guestName)}?` : '¿Eliminar esta reserva?',
    where: parts.join(' · '),
    detail: 'No se borra del todo: queda en la papelera y el administrador la puede recuperar.',
  };
}

// ── CARTELITOS DE CADA ACCIÓN ─────────────────────────────────────────────────
export const SAVED = {
  reserva: 'Reserva guardada',
  grupo: (n) => `Grupo guardado · ${n} habitaciones`,
  grupoCambios: 'Cambios guardados en todo el grupo',
  sumada: (room) => `${room} sumada al grupo`,
  separada: (room) => `${room} separada del grupo`,
  cobro: (n) => (n > 1 ? `Cobro guardado · ${n} habitaciones` : 'Cobro guardado'),
  late: (hora) => (hora ? `Late check-out guardado · sale a las ${hora}` : 'Late check-out quitado'),
  listaNegra: (on) => (on ? 'Marcado como no grato' : 'Quitado de la lista negra'),
  restaurada: 'Reserva recuperada de la papelera',
  eliminada: (n) => (n > 1 ? `Grupo eliminado · ${n} habitaciones a la papelera` : 'Reserva enviada a la papelera'),
};

// ── ESCÁNER DE DOCUMENTOS ─────────────────────────────────────────────────────
export const SCAN = {
  reading: 'Leyendo el documento…',
  // data: lo que leyó Claude
  done: (data) => {
    const name = String(data?.fullName || [data?.firstName, data?.lastName].filter(Boolean).join(' ')).trim();
    const pais = countryName(data?.nationality);
    if (name && pais) return `Listo, es ${name}, de ${pais}. Revisá que esté todo bien.`;
    if (name) return `Listo, es ${name}. Revisá que esté todo bien.`;
    return 'Listo, ya cargué lo que pude leer. Revisá que esté todo bien.';
  },
  unreadable:
    'No pude leer bien la foto. Probá con más luz, sin reflejo y con el documento entero. La foto quedó guardada igual.',
  failed: (err) => {
    const k = errorKind(err);
    if (k === 'otro') return 'No pude leer el documento esta vez. La foto quedó guardada; podés probar de nuevo o escribir los datos a mano.';
    return `No pude leer el documento: ${MOTIVO[k]} La foto quedó guardada.`;
  },
  uploading: 'Subiendo…',
};
