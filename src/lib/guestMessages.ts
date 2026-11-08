/* eslint-disable */
// @ts-nocheck
import { fmt, parseD, addDays, diffDays } from './dates';
import { dayNum, mes } from './availability';

// ── EL HUÉSPED EN EL CENTRO (etapa 3 de la voz de Flow) ───────────────────────
// Lo que se dice sobre el huésped (estancia anterior, cumpleaños) y los mensajes
// de WhatsApp que se le mandan, en español o en inglés según su nacionalidad.

// ── IDIOMA ────────────────────────────────────────────────────────────────────
// Países de habla hispana (código de 2 letras). Si no está acá → mensaje en inglés.
const ES = new Set([
  'MX', 'AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'ES', 'GQ', 'GT', 'HN',
  'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'UY', 'VE',
]);
export const speaksSpanish = (code) => !code || ES.has(String(code).toUpperCase());
export const langFor = (code) => (speaksSpanish(code) ? 'es' : 'en');

// ── ESTANCIA ANTERIOR ─────────────────────────────────────────────────────────
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ORD = (n) => `${n}.ª`;
// "Vuelve por 3.ª vez · la última fue en agosto, en P2" (con año si no es este año)
// info: resultado de stayInfo (number, last)
export function lastStayText(info, today = new Date()) {
  if (!info || info.number < 2) return '';
  const head = `Vuelve por ${ORD(info.number)} vez`;
  const l = info.last;
  if (!l?.checkIn) return head;
  const d = parseD(l.checkIn);
  const cuando = `${MESES[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ` de ${d.getFullYear()}` : ''}`;
  return `${head} · la última fue en ${cuando}${l.room ? `, en ${l.room}` : ''}`;
}
// Solo la última visita (al lado de la etiqueta "3ª estancia · Frecuente", que ya dice el número):
// "La última vez vino en agosto, a P2"
export function lastVisitText(info, today = new Date()) {
  const t = lastStayText(info, today);
  const m = /la última fue en ([^,]+)(?:, en (.+))?$/.exec(t);
  return m ? `La última vez vino en ${m[1]}${m[2] ? `, a ${m[2]}` : ''}` : '';
}

// ── CUMPLEAÑOS (desde la CURP) ────────────────────────────────────────────────
// La CURP trae la fecha de nacimiento: AAAA + AAMMDD + sexo + … + dígito 17
// (número → nacido antes de 2000; letra → desde 2000).
const CURP_RE = /^[A-Z][AEIOUX][A-Z]{2}(\d{2})(\d{2})(\d{2})[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}([A-Z\d])\d$/;
export function birthFromCurp(doc) {
  const m = CURP_RE.exec(String(doc || '').toUpperCase().replace(/\s/g, ''));
  if (!m) return null;
  const [, yy, mm, dd, diff] = m;
  const year = (/\d/.test(diff) ? 1900 : 2000) + Number(yy);
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

// ¿Cumple durante la estadía (del día de entrada al de salida, inclusive)?
// Devuelve { date: 'AAAA-MM-DD', today: bool, age } o null.
export function birthdayInStay(res, now = new Date()) {
  const b = birthFromCurp(res?.guestDoc);
  if (!b || !res?.checkIn || !res?.checkOut) return null;
  const ci = parseD(res.checkIn);
  const co = parseD(res.checkOut);
  for (let d = ci; d <= co; d = addDays(d, 1)) {
    if (d.getMonth() + 1 === b.month && d.getDate() === b.day) {
      return { date: fmt(d), today: fmt(d) === fmt(now), age: d.getFullYear() - b.year };
    }
  }
  return null;
}

// "🎂 Hoy cumple años" · "🎂 Cumple años el sáb 14 de nov, durante su estadía"
export function birthdayText(bd) {
  if (!bd) return '';
  return bd.today ? '🎂 ¡Hoy cumple años!' : `🎂 Cumple años el ${dayNum(bd.date)} de ${mes(bd.date)}, durante su estadía`;
}

const first = (name) => String(name || '').trim().split(/\s+/)[0] || '';

// Mensaje de cumpleaños para el huésped
export function birthdayMessage(name, lang = 'es') {
  const n = first(name);
  return lang === 'en'
    ? `Happy birthday${n ? `, ${n}` : ''}! 🎉 We hope you have a wonderful day. Warm wishes from everyone at Itzé Hostel 🌴`
    : `¡Feliz cumpleaños${n ? `, ${n}` : ''}! 🎉 Que tengas un día hermoso. Un abrazo de todo el equipo de Itzé Hostel 🌴`;
}

// Bienvenida para acompañantes (con la habitación y el PIN de la puerta)
export function companionWelcome(name, room, pin, lang = 'es') {
  const n = first(name);
  return lang === 'en'
    ? `Hi${n ? ` ${n}` : ''}! Welcome to Itzé Hostel 🌴 Your group is in room ${room || '—'}. The front door code is *${pin || '---'}*. See you soon!`
    : `¡Hola${n ? ` ${n}` : ''}! Bienvenido a Itzé Hostel 🌴 Tu grupo está en la habitación ${room || 'asignada'}. El código de acceso a la puerta principal es *${pin || '---'}*. ¡Te esperamos!`;
}

// ── COTIZACIÓN EN INGLÉS (Cotizar) ────────────────────────────────────────────
export const ROOM_DESC_EN = {
  P1: 'two queen beds + sofa bed',
  P2: 'two queen beds + sofa bed',
  P3: 'two double beds + single bed',
  P4: 'king bed + sofa bed',
  P5: 'two queen beds + sofa bed',
  P6: 'double bed',
};
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayEn = (s) => {
  const d = parseD(s);
  return `${DAYS_EN[d.getDay()]} ${MON_EN[d.getMonth()]} ${d.getDate()}`;
};
const moneyEn = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
};
const guestsEn = (n) => (n === 1 ? '1 guest' : `${n} guests`);
const nightsEn = (n) => (n === 1 ? '1 night' : `${n} nights`);
// Tramo de un cambio de habitación: "nights of Fri Nov 27 and Sat Nov 28" / "nights of Fri Nov 27 to Sun Nov 29"
const nightsLabelEn = (from, to) => {
  const n = diffDays(from, to);
  const last = fmt(addDays(parseD(to), -1));
  if (n <= 1) return `night of ${dayEn(from)}`;
  if (n === 2) return `nights of ${dayEn(from)} and ${dayEn(last)}`;
  return `nights of ${dayEn(from)} to ${dayEn(last)}`;
};

// Igual que el de español: sin saludo y termina en los precios; aclara que son pesos mexicanos.
export function quoteMessageEn({ checkIn, checkOut, guests, items, total }) {
  const n = diffDays(checkIn, checkOut);
  const lines = [`For ${guestsEn(guests)}, check-in ${dayEn(checkIn)} and check-out ${dayEn(checkOut)} (${nightsEn(n)}):`];
  // Habitaciones iguales (mismas camas, personas y precio) van juntas, igual que en español
  const groups = [];
  items.forEach((it) => {
    const key = `${it.desc}|${it.guests}|${it.total}|${it.nightsLabel || ''}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.count++;
    else groups.push({ key, it, desc: ROOM_DESC_EN[it.room] || it.desc, count: 1 });
  });
  groups.forEach(({ it, desc, count }) => {
    const tramo = it.nightsLabel && it.from && it.to ? `, ${nightsLabelEn(it.from, it.to)}` : '';
    lines.push(
      count === 1
        ? `• Room with ${desc} (${guestsEn(it.guests)})${tramo}: ${moneyEn(it.total)}`
        : `• ${count} rooms with ${desc} (${guestsEn(it.guests)} each)${tramo}: ${moneyEn(it.total)} each`
    );
  });
  if (items.length > 1 || guests > 1) {
    lines.push(`Total: ${moneyEn(total)}${guests > 1 ? ` (${moneyEn(total / guests)} per person)` : ''}`);
    lines.push(`Average per person per night: ${moneyEn(total / guests / n)}`);
  } else {
    lines.push(`Average per night: ${moneyEn(total / n)}`);
  }
  lines.push('Prices in Mexican pesos (MXN).');
  return lines.join('\n');
}
