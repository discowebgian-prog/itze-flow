/* eslint-disable */
// @ts-nocheck
import { ROOMS } from './constants';
import { findConflicts, lateHour } from './reservations';
import { fmt, addDays, parseD, DAYS } from './dates';

// ── DISPONIBILIDAD NOCHE POR NOCHE (para Cotizar) ─────────────────────────────
// Mira cada noche por separado para poder explicar en palabras qué pasa:
// qué habitación está ocupada y qué noche, si el hostel está completo alguna noche,
// y si se puede con un cambio de habitación.

export const dayLabel = (s) => {
  const d = parseD(s);
  return `${DAYS[d.getDay()].toLowerCase()} ${d.getDate()}/${d.getMonth() + 1}`;
};
// Fechas fáciles de leer: "el sáb 28 de nov", "del vie 27 al dom 29 de nov", "del lun 30 de nov al mar 1 de dic"
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const dayNum = (s) => {
  const d = parseD(s);
  return `${DAYS[d.getDay()].toLowerCase()} ${d.getDate()}`;
};
export const mes = (s) => MES[parseD(s).getMonth()];
export const oneDay = (s) => `${dayNum(s)} de ${mes(s)}`;
export const dayRange = (a, b) =>
  mes(a) === mes(b) ? `del ${dayNum(a)} al ${dayNum(b)} de ${mes(b)}` : `del ${oneDay(a)} al ${oneDay(b)}`;
export const nextDay = (s) => fmt(addDays(parseD(s), 1));
export const listY = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`);
export const roomNum = (id) => String(id).replace(/^P/i, '');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Noches seguidas → tramos [[desde, hasta], …] (noches incluidas)
function runs(nights) {
  const out = [];
  nights.forEach((d) => {
    const last = out[out.length - 1];
    if (last && nextDay(last[1]) === d) last[1] = d;
    else out.push([d, d]);
  });
  return out;
}
// Noches (siempre dice "noche/noches" para que quede claro que esa noche cuenta):
// "la noche del lun 30 de nov" · "las noches del sáb 28 y dom 29 de nov" ·
// "las noches del sáb 28 al lun 30 de nov" · "las noches del vie 27 y dom 29 de nov"
export function nightsText(nights) {
  if (!nights.length) return '';
  if (nights.length === 1) return `la noche del ${oneDay(nights[0])}`;
  const r = runs(nights);
  const sameMonth = nights.every((d) => mes(d) === mes(nights[0]));
  if (r.length === 1 && nights.length > 2) return `las noches ${dayRange(r[0][0], r[0][1])}`;
  if (sameMonth && r.every(([a, b]) => a === b || nextDay(a) === b))
    return `las noches del ${listY(nights.map(dayNum))} de ${mes(nights[0])}`;
  return listY(r.map(([a, b]) => (a === b ? `la noche del ${oneDay(a)}` : `las noches ${dayRange(a, b)}`)));
}
// Estadía con entrada y salida: "entrando el sáb 28 y saliendo el lun 30 de nov"
export const stayText = (ci, co) =>
  mes(ci) === mes(co)
    ? `entrando el ${dayNum(ci)} y saliendo el ${dayNum(co)} de ${mes(co)}`
    : `entrando el ${oneDay(ci)} y saliendo el ${oneDay(co)}`;

export function nightAvailability(allRes, checkIn, checkOut, n, rooms = ROOMS) {
  const nights = Array.from({ length: Math.max(0, n) }, (_, i) => fmt(addDays(parseD(checkIn), i)));
  const busy = {}; // habitación → noches ocupadas
  rooms.forEach((r) => {
    busy[r.id] = nights.filter((d) => findConflicts(allRes, 'hostel', r.id, d, nextDay(d)).length > 0);
  });
  const fullNights = nights.filter((d) => rooms.every((r) => busy[r.id].includes(d)));
  return { nights, busy, fullNights };
}

// "la habitación 1" · "la habitación 1 y la 4" · "la habitación 1, la 3 y la 4"
const roomsPhrase = (ids) => {
  const first = `la habitación ${roomNum(ids[0])}`;
  const rest = ids.slice(1).map((id) => `la ${roomNum(id)}`);
  if (!rest.length) return first;
  return `${[first, ...rest.slice(0, -1)].join(', ')} y ${rest[rest.length - 1]}`;
};
const ocupadas = (ids) => (ids.length === 1 ? 'está ocupada' : 'están ocupadas');

// "El sáb 28 de nov, la habitación 1 y la 4 están ocupadas." · todas las noches: "La habitación 1 está ocupada."
// Si no comparten ninguna noche: "La habitación 3 está ocupada. Además están ocupadas la 1 la noche del vie 27 de nov y la 4 la noche del sáb 28 de nov."
export function busyText(av, roomIds) {
  if (!roomIds.length) return '';
  const n = av.nights.length;
  const common = av.nights.filter((d) => roomIds.every((id) => (av.busy[id] || []).includes(d)));
  if (common.length) {
    // Ocupadas todas las noches: sin repetir "Esos días" (ya lo dice la frase anterior)
    if (common.length === n) return `${cap(roomsPhrase(roomIds))} ${ocupadas(roomIds)}.`;
    return `${cap(nightsText(common))}, ${roomsPhrase(roomIds)} ${ocupadas(roomIds)}.`;
  }
  // Sin una noche en común: primero las ocupadas todas las noches y después, en una frase,
  // las que lo están solo algunas ("Además están ocupadas la 1 las noches del … y la 4 la noche del …")
  const allIds = roomIds.filter((id) => (av.busy[id] || []).length === n);
  const partIds = roomIds.filter((id) => !allIds.includes(id));
  // las que están ocupadas las mismas noches van juntas: "la 3 y la 4 la noche del sáb 28 de nov"
  const pg = [];
  partIds.forEach((id) => {
    const key = (av.busy[id] || []).join(',');
    const g = pg.find((x) => x.key === key);
    if (g) g.ids.push(id);
    else pg.push({ key, ids: [id], nights: av.busy[id] });
  });
  const partTxt = pg.map((g, k) => {
    const names = g.ids.map((id, j) => (k === 0 && j === 0 && !allIds.length ? `la habitación ${roomNum(id)}` : `la ${roomNum(id)}`));
    return `${listY(names)} ${nightsText(g.nights)}`;
  });
  const out = [];
  if (allIds.length) out.push(`${cap(roomsPhrase(allIds))} ${ocupadas(allIds)}.`);
  if (partTxt.length) out.push(`${allIds.length ? 'Además están ocupadas' : 'Están ocupadas'} ${listY(partTxt)}.`);
  return out.join(' ');
}

// Cuando ninguna habitación queda libre toda la estadía: explica por qué y qué se puede hacer
export function noRoomText(av, checkIn, checkOut, guests, rooms = ROOMS) {
  const n = av.nights.length;
  const esosDias = n === 1 ? 'Ese día' : 'Esos días';
  const full = av.fullNights;
  if (full.length === n) return `${esosDias} el hostel está completo y no tenemos disponibilidad.`;

  if (full.length) {
    const r = runs(full);
    const fullTxt = `${cap(nightsText(full))} el hostel está completo`;
    if (r.length === 1) {
      const [a, b] = r[0];
      if (a === av.nights[0]) return `${fullTxt}. Sí tenemos lugar ${stayText(nextDay(b), checkOut)}.`;
      if (b === av.nights[n - 1]) return `${fullTxt}. Sí tenemos lugar ${stayText(checkIn, a)}.`;
      return `${fullTxt}: tendría que salir ${a === b ? 'ese día' : `el ${oneDay(a)}`} y volver a entrar el ${oneDay(nextDay(b))}.`;
    }
    return `${fullTxt}. Las demás noches sí tenemos lugar, pero tendría que salir y volver a entrar.`;
  }

  // Ninguna noche completa: ¿se puede cambiando de habitación?
  const plan = stayPlan(av, guests, rooms);
  if (!plan) return 'No tenemos una misma habitación libre todas esas noches. Probá con otras fechas.';
  return `No tenemos una misma habitación libre todas esas noches, pero ${planText(plan, guests)}.`;
}

// ── PLAN CON CAMBIO DE HABITACIÓN ─────────────────────────────────────────────
// Para que entre todo el grupo: las habitaciones libres todas las noches quedan fijas (llenas)
// y las personas que faltan arrancan en una habitación y se mudan cuando hace falta
// (con la menor cantidad de cambios). null si no hace falta mudarse o si no hay forma.
export function stayPlan(av, guests, rooms = ROOMS) {
  const n = av.nights.length;
  if (!n) return null;
  const fixed = rooms.filter((r) => !(av.busy[r.id] || []).length).sort((a, b) => b.maxGuests - a.maxGuests);
  const fixedCap = fixed.reduce((s, r) => s + r.maxGuests, 0);
  if (fixedCap >= guests) return null;
  const moving = guests - fixedCap;
  const pool = rooms.filter((r) => !fixed.includes(r) && r.maxGuests >= moving);
  if (!pool.length) return null;
  const segs = [];
  let i = 0;
  while (i < n) {
    let best = null;
    let bestLen = 0;
    pool.forEach((r) => {
      let k = i;
      while (k < n && !av.busy[r.id].includes(av.nights[k])) k++;
      if (k - i > bestLen || (k - i === bestLen && best && r.maxGuests < best.maxGuests)) {
        if (k - i > 0) {
          bestLen = k - i;
          best = r;
        }
      }
    });
    if (!best) return null;
    segs.push({ room: best.id, from: av.nights[i], to: i + bestLen < n ? av.nights[i + bestLen] : nextDay(av.nights[n - 1]), nights: av.nights.slice(i, i + bestLen) });
    i += bestLen;
  }
  return { fixed: fixed.map((r) => ({ room: r.id, guests: r.maxGuests })), moving, segs };
}

// "se puede con un cambio de habitación: arranca en la habitación 4 y el dom 29 de nov se pasa a la 1"
// Con habitaciones fijas: "la habitación 2 queda libre todas las noches (5 personas) y las otras 3 arrancan en…"
export function planText(plan, guests) {
  const changes = plan.segs.length - 1;
  const cambios = changes === 1 ? 'un cambio' : `${changes} cambios`;
  const many = plan.moving > 1 && plan.fixed.length > 0;
  const moves = plan.segs
    .slice(1)
    .map((p, k) => `el ${oneDay(p.from)} ${k === 0 ? (many ? 'se pasan ' : 'se pasa ') : ''}a la ${roomNum(p.room)}`);
  if (!plan.fixed.length) {
    return `se puede con ${cambios} de habitación: arranca en la habitación ${roomNum(plan.segs[0].room)} y ${listY(moves)}`;
  }
  const fx = plan.fixed.map((f) => f.room);
  const fixedCap = plan.fixed.reduce((s, f) => s + f.guests, 0);
  const libres = fx.length === 1 ? 'queda libre' : 'quedan libres';
  const otros = plan.moving === 1 ? 'la persona que falta arranca' : `las otras ${plan.moving} arrancan`;
  return `para que entren las ${guests} personas se puede con ${cambios} de habitación: ${roomsPhrase(fx)} ${libres} todas las noches (${fixedCap} personas) y ${otros} en la habitación ${roomNum(plan.segs[0].room)} y ${listY(moves)}`;
}

// ── FECHAS CERCANAS CON LUGAR ─────────────────────────────────────────────────
// Busca, con la misma cantidad de noches, la entrada más cercana (antes y después) en la que
// entran todas las personas sin mudarse. Antes: nunca en el pasado.
export function nearestDates(allRes, checkIn, n, guests, today, rooms = ROOMS, horizon = 90) {
  if (!n || !checkIn) return { before: null, after: null };
  const start = addDays(parseD(checkIn), -horizon);
  const end = addDays(parseD(checkIn), horizon + n);
  // noches ocupadas por habitación (solo el tramo que importa)
  const busy = {};
  rooms.forEach((r) => (busy[r.id] = new Set()));
  allRes.forEach((r) => {
    if (r.status === 'cancelada' || r.deleted === true || r.propertyId !== 'hostel' || !busy[r.room]) return;
    let d = parseD(r.checkIn);
    const out = parseD(r.checkOut);
    if (out < start || d > end) return;
    if (d < start) d = start;
    while (d < out && d <= end) {
      busy[r.room].add(fmt(d));
      d = addDays(d, 1);
    }
  });
  const fits = (ci) => {
    const nights = Array.from({ length: n }, (_, i) => fmt(addDays(parseD(ci), i)));
    const cap = rooms.filter((r) => nights.every((d) => !busy[r.id].has(d))).reduce((s, r) => s + r.maxGuests, 0);
    return cap >= guests;
  };
  let after = null;
  for (let k = 1; k <= horizon && !after; k++) {
    const ci = fmt(addDays(parseD(checkIn), k));
    if (fits(ci)) after = ci;
  }
  let before = null;
  for (let k = 1; k <= horizon && !before; k++) {
    const ci = fmt(addDays(parseD(checkIn), -k));
    if (today && ci < today) break;
    if (fits(ci)) before = ci;
  }
  return { before, after };
}

// ¿Alguien sale de esa habitación el día de llegada con late check-out? → "16:00"
export function lateOutOn(allRes, room, day) {
  const r = allRes.find(
    (x) => x.propertyId === 'hostel' && x.room === room && x.checkOut === day && x.status !== 'cancelada' && x.deleted !== true && lateHour(x)
  );
  return r ? lateHour(r) : '';
}

// "con entrada el sáb 28 y salida el lun 30 de nov" (para el huésped)
export const entradaSalida = (ci, co) =>
  mes(ci) === mes(co)
    ? `con entrada el ${dayNum(ci)} y salida el ${dayNum(co)} de ${mes(co)}`
    : `con entrada el ${oneDay(ci)} y salida el ${oneDay(co)}`;
