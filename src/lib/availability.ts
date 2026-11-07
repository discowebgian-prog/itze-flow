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
// "el lun 30/11" · "del sáb 28/11 al lun 30/11" · "el sáb 28/11 y el lun 30/11"
export function nightsText(nights) {
  return listY(runs(nights).map(([a, b]) => (a === b ? `el ${dayLabel(a)}` : `del ${dayLabel(a)} al ${dayLabel(b)}`)));
}

export function nightAvailability(allRes, checkIn, checkOut, n, rooms = ROOMS) {
  const nights = Array.from({ length: Math.max(0, n) }, (_, i) => fmt(addDays(parseD(checkIn), i)));
  const busy = {}; // habitación → noches ocupadas
  rooms.forEach((r) => {
    busy[r.id] = nights.filter((d) => findConflicts(allRes, 'hostel', r.id, d, nextDay(d)).length > 0);
  });
  const fullNights = nights.filter((d) => rooms.every((r) => busy[r.id].includes(d)));
  return { nights, busy, fullNights };
}

// "La habitación 1 está ocupada." · "Las habitaciones 1 y 3 están ocupadas el lun 30/11."
export function busyText(av, roomIds) {
  const groups = [];
  roomIds.forEach((id) => {
    const nb = av.busy[id] || [];
    const all = nb.length === av.nights.length;
    const key = all ? 'all' : nb.join(',');
    const g = groups.find((x) => x.key === key);
    if (g) g.ids.push(id);
    else groups.push({ key, ids: [id], nights: all ? null : nb });
  });
  return groups
    .map((g) => {
      const one = g.ids.length === 1;
      const who = one ? `La habitación ${roomNum(g.ids[0])}` : `Las habitaciones ${listY(g.ids.map(roomNum))}`;
      return `${who} ${one ? 'está ocupada' : 'están ocupadas'}${g.nights ? ` ${nightsText(g.nights)}` : ''}.`;
    })
    .join(' ');
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
      if (a === av.nights[0]) return `${fullTxt}. Sí tenemos lugar del ${dayLabel(nextDay(b))} al ${dayLabel(checkOut)}.`;
      if (b === av.nights[n - 1]) return `${fullTxt}. Sí tenemos lugar del ${dayLabel(checkIn)} al ${dayLabel(a)}.`;
      return `${fullTxt}: tendría que irse ${a === b ? 'ese día' : `el ${dayLabel(a)}`} y volver el ${dayLabel(nextDay(b))}.`;
    }
    return `${fullTxt}. Las demás noches sí tenemos lugar, pero tendría que irse y volver.`;
  }

  // Ninguna noche completa: ¿se puede cambiando de habitación? (las que alcanzan para el grupo)
  const fit = rooms.filter((r) => r.maxGuests >= guests);
  const pool = fit.length ? fit : rooms;
  const plan = [];
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
    const from = av.nights[i];
    const to = i + bestLen < n ? av.nights[i + bestLen] : checkOut;
    plan.push(`la habitación ${roomNum(best)} del ${dayLabel(from)} al ${dayLabel(to)}`);
    i += bestLen;
  }
  const changes = plan.length - 1;
  return `No tenemos una misma habitación libre todas esas noches, pero se puede con ${
    changes === 1 ? 'un cambio' : `${changes} cambios`
  } de habitación: ${listY(plan)}.`;
}
