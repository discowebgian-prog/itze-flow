/* eslint-disable */
// @ts-nocheck
// ── PERSONAS POR HABITACIÓN Y ESTRATEGIA ─────────────────────────────────────
// Lo usan Finanzas (al tocar Segmentación física, mes a mes, se recalcula cada día)
// e Inicio (tarjeta "Estrategia de la semana": últimas 4 semanas, cambia los lunes).
// Sin sugerir mover huéspedes de habitación (Gian: incomoda más de lo que ayuda).
// Las sugerencias son reglas fijas (no gastan IA). Tono: cálido, corto y claro.
import { ROOMS } from './constants';
import { TODAY, fmt, addDays, parseD, diffDays } from './dates';
import { isFindeDow } from './rates';

// Tipos de habitación con su capacidad (la mayor del grupo)
export const PAX_TYPES = [
  ['compartidas', 'Habitaciones 1, 2, 3 y 5', ['P1', 'P2', 'P3', 'P5']],
  ['king', 'Habitación 4', ['P4']],
  ['matrimonial', 'Habitación 6', ['P6']],
].map((t) => [...t, Math.max(...t[2].map((id) => ROOMS.find((r) => r.id === id)?.maxGuests || 0))]);
const BIG = PAX_TYPES[0][2];
const capOf = (room) => ROOMS.find((r) => r.id === room)?.maxGuests || 0;

const seg = () => ({ n: 0, pax: 0, solo: 0, pareja: 0, grupo: 0 });
const add = (s, p) => {
  s.n++;
  s.pax += p;
  if (p <= 1) s.solo++;
  else if (p === 2) s.pareja++;
  else s.grupo++;
};

// list: noches ocupadas [{ finde, room, pax }]
export function paxStats(list = []) {
  const out = { entre: seg(), finde: seg(), global: seg(), types: {}, bigLow: { n: 0, finde: 0, beds: 0 } };
  PAX_TYPES.forEach(([k]) => (out.types[k] = seg()));
  list.forEach((x) => {
    const p = x.pax || 1;
    add(x.finde ? out.finde : out.entre, p);
    add(out.global, p);
    const t = PAX_TYPES.find((t) => t[2].includes(x.room));
    if (t) add(out.types[t[0]], p);
    // Habitación grande vendida a 1 o 2 personas: camas que quedaron sin usar
    if (BIG.includes(x.room) && p <= 2) {
      out.bigLow.n++;
      if (x.finde) out.bigLow.finde++;
      out.bigLow.beds += Math.max(0, capOf(x.room) - p);
    }
  });
  return out;
}

export const paxAvg = (s) =>
  s && s.n ? (s.pax / s.n).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
export const paxPct = (s, k) => (s && s.n ? Math.round((s[k] / s.n) * 100) : 0);

// Noches ocupadas de las reservas entre `from` (incluida) y `to` (excluida), fechas 'YYYY-MM-DD'
export function nightsBetween(reservations, from, to) {
  const out = [];
  reservations.forEach((r) => {
    if (!r || r.status === 'cancelada' || !r.checkIn || !r.checkOut) return;
    const n = diffDays(r.checkIn, r.checkOut);
    for (let i = 0; i < n; i++) {
      const d = addDays(parseD(r.checkIn), i);
      const k = fmt(d);
      if (k < from || k >= to) continue;
      out.push({ finde: isFindeDow(d.getDay()), room: r.room, pax: Math.max(1, Number(r.totalGuests) || 1) });
    }
  });
  return out;
}

const MIN = 5; // noches mínimas para animarse a sugerir algo

// Sugerencias según cómo vinieron los huéspedes. prev = paxStats del período anterior (opcional).
// Devuelve null si todavía hay pocas noches; si no, hasta `max` sugerencias { icon, title, text }.
export function paxStrategy(st, { prev = null, prevLabel = '', max = 3 } = {}) {
  if (!st || st.global.n < MIN) return null;
  const ok = (s) => s && s.n >= MIN;
  const { entre, finde, global, bigLow } = st;
  const out = [];

  // Cambio de temporada respecto del período anterior
  if (prev && ok(prev.global)) {
    const a = paxPct(prev.global, 'grupo'),
      b = paxPct(global, 'grupo');
    if (b - a >= 20)
      out.push({
        icon: 'repeat',
        title: 'Cambió la temporada: más grupos',
        text: `Los grupos de 3 o más pasaron de ${a}% a ${b}% respecto de ${prevLabel}. Revisá que las promos de pareja no estén ocupando las habitaciones grandes que ahora piden los grupos.`,
      });
    else if (a - b >= 20)
      out.push({
        icon: 'repeat',
        title: 'Cambió la temporada: menos grupos',
        text: `Los grupos de 3 o más bajaron de ${a}% a ${b}% respecto de ${prevLabel}. Vienen más parejas y solos: es momento de promos para 2 y de vender primero las habitaciones 4 y 6.`,
      });
  }

  const gE = paxPct(entre, 'grupo'),
    gF = paxPct(finde, 'grupo');
  let split = false;
  if (ok(entre) && ok(finde) && gF >= 45 && gF - gE >= 20) {
    split = true;
    // (Gian: asignar parejas a la 4 o la 6 es obvio; mínimo de noches no va con el turismo de acá;
    //  la tarifa Lun–Mié para parejas ya existe. Lo útil: a quién apuntar cada parte de la semana.)
    out.push({
      icon: 'megaphone',
      title: 'Finde de grupos, semana de parejas',
      text: `De jueves a domingo el ${gF}% de las noches fueron de grupos de 3 o más; de lunes a miércoles, ${100 - gE}% parejas y solos. Las publicaciones y promos del finde conviene apuntarlas a grupos y familias (fotos de las habitaciones grandes, precio por persona) y las de entre semana, a parejas.`,
    });
  } else if (ok(entre) && ok(finde) && gE >= 45 && gE - gF >= 20) {
    split = true;
    out.push({
      icon: 'megaphone',
      title: 'Semana de grupos, finde de parejas',
      text: `De lunes a miércoles el ${gE}% de las noches fueron de grupos de 3 o más (trabajo, familias); de jueves a domingo, ${100 - gF}% parejas y solos. Las publicaciones de entre semana conviene apuntarlas a grupos (precio por persona) y las del finde, a escapadas de pareja.`,
    });
  }

  if (!split && ok(global) && paxPct(global, 'grupo') >= 55)
    out.push({
      icon: 'users',
      title: 'Temporada de grupos y familias',
      text: `El ${paxPct(global, 'grupo')}% de las noches fueron de grupos de 3 o más, toda la semana. Armá un paquete familia (desayuno, late check-out) y revisá que se esté cobrando cada persona extra. La habitación 6 es la que menos encaja: ofrecela con precio especial a parejas.`,
    });

  if (bigLow.n >= 4)
    out.push({
      icon: 'bed',
      title: 'Habitaciones grandes con poca gente',
      text:
        `Las habitaciones 1, 2, 3 y 5 se vendieron ${bigLow.n} noches a 1 o 2 personas${bigLow.finde ? ` (${bigLow.finde} de jueves a domingo)` : ''}: quedaron unas ${bigLow.beds} camas sin usar. ` +
        (bigLow.finde >= 3
          ? 'Hubo lugar para más gente el finde: ahí una promo para grupos o familias tiene dónde entrar.'
          : 'Es lo esperable con la tarifa de pareja de entre semana; si crece mucho, revisá que esa tarifa siga dejando ganancia.'),
    });

  if (ok(global) && paxPct(global, 'solo') >= 35)
    out.push({
      icon: 'user',
      title: 'Muchos viajeros solos',
      text: `El ${paxPct(global, 'solo')}% de las noches fueron de 1 persona. Una tarifa para 1 persona en la habitación 6 o la 4, o una promo de estadía larga entre semana (nómadas, trabajo), puede atraer más de este público.`,
    });

  return out.slice(0, max);
}

// Inicio: patrón de las últimas 4 semanas hasta el lunes (cambia una vez por semana)
export function weeklyPattern(reservations, max = 2) {
  const dow = TODAY.getDay(); // 0 dom … 1 lun
  const monday = addDays(TODAY, -((dow + 6) % 7));
  const to = fmt(monday),
    from = fmt(addDays(monday, -28));
  const st = paxStats(nightsBetween(reservations, from, to));
  const prev = paxStats(nightsBetween(reservations, fmt(addDays(monday, -56)), from));
  return paxStrategy(st, { prev, prevLabel: 'las 4 semanas anteriores', max }) || [];
}
