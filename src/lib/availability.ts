/* eslint-disable */
// @ts-nocheck
import { ROOMS } from './constants';
import { findConflicts } from './reservations';
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
const dayNum = (s) => {
  const d = parseD(s);
  return `${DAYS[d.getDay()].toLowerCase()} ${d.getDate()}`;
};
const mes = (s) => MES[parseD(s).getMonth()];
export const oneDay = (s) => `${dayNum(s)} de ${mes(s)}`;
export const dayRange = (a, b) =>
  mes(a) === mes(b) ? `del ${dayNum(a)} al ${dayNum(b)} de ${mes(b)}` : `del ${oneDay(a)} al ${oneDay(b)}`;
const nextDay = (s) => fmt(addDays(parseD(s), 1));
export const listY = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`);
const roomNum = (id) => String(id).replace(/^P/i, '');
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
// Si no comparten ninguna noche: "El vie 27 de nov, la habitación 1 está ocupada. El sáb 28 de nov, la habitación 4 está ocupada."
export function busyText(av, roomIds) {
  if (!roomIds.length) return '';
  const n = av.nights.length;
  const common = av.nights.filter((d) => roomIds.every((id) => (av.busy[id] || []).includes(d)));
  if (common.length) {
    // Ocupadas todas las noches: sin repetir "Esos días" (ya lo dice la frase anterior)
    if (common.length === n) return `${cap(roomsPhrase(roomIds))} ${ocupadas(roomIds)}.`;
    return `${cap(nightsText(common))}, ${roomsPhrase(roomIds)} ${ocupadas(roomIds)}.`;
  }
  // Noches con el mismo grupo de habitaciones ocupadas, juntas
  const groups = [];
  av.nights.forEach((d) => {
    const ids = roomIds.filter((id) => (av.busy[id] || []).includes(d));
    if (!ids.length) return;
    const key = ids.join(',');
    const g = groups.find((x) => x.key === key);
    if (g) g.nights.push(d);
    else groups.push({ key, ids, nights: [d] });
  });
  return groups.map((g) => `${cap(nightsText(g.nights))}, ${roomsPhrase(g.ids)} ${ocupadas(g.ids)}.`).join(' ');
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

  // Ninguna noche completa: ¿se puede cambiando de habitación? (las que alcanzan para el grupo)
  const fit = rooms.filter((r) => r.maxGuests >= guests);
  const pool = fit.length ? fit : rooms;
  const plan = []; // [{ room, from }]: en qué habitación arranca y qué día se cambia
  let i = 0;
  while (i < n) {
    let best = null;
    let bestLen = 0;
    pool.forEach((r) => {
      let k = i;
      while (k < n && !av.busy[r.id].includes(av.nights[k])) k++;
      if (k - i > bestLen) {
        bestLen = k - i;
        best = r.id;
      }
    });
    if (!best) return 'No tenemos una misma habitación libre todas esas noches. Probá con otras fechas.';
    plan.push({ room: best, from: av.nights[i] });
    i += bestLen;
  }
  // "arranca en la habitación 4 y el dom 29 de nov se pasa a la 1" (más cambios: ", el … se pasa a la 3 y el … a la 2")
  const moves = plan.slice(1).map((p, k) => `el ${oneDay(p.from)} ${k === 0 ? 'se pasa ' : ''}a la ${roomNum(p.room)}`);
  const changes = plan.length - 1;
  return `No tenemos una misma habitación libre todas esas noches, pero se puede con ${
    changes === 1 ? 'un cambio' : `${changes} cambios`
  } de habitación: arranca en la habitación ${roomNum(plan[0].room)} y ${listY(moves)}.`;
}
