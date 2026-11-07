/* eslint-disable */
// @ts-nocheck
import { diffDays, parseD, addDays, fmt } from './dates';

// ── TARIFARIO ─────────────────────────────────────────────────────────────────
// Tipos de tarifa del hostel (todas las habitaciones son privadas) y qué habitaciones van en cada uno.
// El id queda como estaba en la base (privada, king, matrimonial); lo que se ve es `label`.
// `extra`: si admite personas adicionales (se cobra el adicional desde la 3.ª).
export const ROOM_TYPES = [
  { id: 'privada', label: 'Habitaciones 1, 2, 3 y 5', rooms: ['P1', 'P2', 'P3', 'P5'], extra: true },
  { id: 'king', label: 'Habitación 4', rooms: ['P4'], extra: true },
  { id: 'matrimonial', label: 'Habitación 6', rooms: ['P6'], extra: false },
];

// La tarifa por noche es para 2 personas
export const BASE_GUESTS = 2;

export const roomTypeOf = (roomId) => ROOM_TYPES.find((t) => t.rooms.includes(roomId)) || null;

// Fin de semana = noches de jueves, viernes, sábado y domingo. Entre semana = lunes a miércoles.
// (getDay(): 0 domingo … 6 sábado). Lo usan también Finanzas y el cotizador.
export const isFindeDow = (d) => d === 0 || d >= 4;

// La Normal es la que no tiene fechas
export const isNormal = (p) => !p.desde && !p.hasta;

// Cantidad de noches de un período con fechas (desde y hasta incluidas)
export const periodNights = (p) => (isNormal(p) ? Infinity : diffDays(p.desde, p.hasta) + 1);

// Período que rige una noche ('YYYY-MM-DD'): el más corto de los que la incluyen;
// si empatan, el creado más recientemente. Sin ninguno, la Normal.
export function periodFor(dateStr, periods = []) {
  const cands = periods.filter((p) => !isNormal(p) && p.desde <= dateStr && dateStr <= p.hasta);
  if (cands.length) {
    return [...cands].sort(
      (a, b) =>
        periodNights(a) - periodNights(b) ||
        String(b.creado_en || '').localeCompare(String(a.creado_en || ''))
    )[0];
  }
  return periods.find(isNormal) || null;
}

// Precio de una noche para un tipo de habitación: { period, finde, price, extra }
export function nightPrice(dateStr, typeId, periods = []) {
  const period = periodFor(dateStr, periods);
  const finde = isFindeDow(parseD(dateStr).getDay());
  const p = (period?.precios || {})[typeId] || {};
  return {
    period,
    finde,
    price: Number(finde ? p.finde : p.entre) || 0,
    extra: Number(p.extra) || 0,
  };
}

// Períodos con fechas que se pisan con uno dado (para avisar al cargarlo)
export function overlapsOf(period, periods = []) {
  if (isNormal(period) || !period.desde || !period.hasta) return [];
  return periods.filter(
    (p) => p.id !== period.id && !isNormal(p) && p.desde <= period.hasta && period.desde <= p.hasta
  );
}

// ── COTIZADOR ─────────────────────────────────────────────────────────────────
// Calcula una estadía noche por noche con el tarifario.
// Devuelve null si falta algo para cotizar (fechas, tipo o tarifario sin cargar),
// { missing: true } si alguna noche no tiene precio para ese tipo, o:
//   lines: noches agrupadas por precio y período ({ count, price, periodName, dayLabel })
//   base: suma de las noches · avg: promedio por noche (con centavos si no da redondo)
//   extraAvg: adicional por persona por noche (promedio) · extraGuests: personas extra
//   extraTotal · total · varied: true si las noches tienen precios distintos
export function quoteStay(checkIn, checkOut, typeId, guests = 1, periods = []) {
  const n = checkIn && checkOut ? diffDays(checkIn, checkOut) : 0;
  const type = ROOM_TYPES.find((t) => t.id === typeId);
  if (!type || n <= 0 || !periods.length) return null;
  const nightsArr = [];
  let d = parseD(checkIn);
  for (let i = 0; i < n; i++) {
    const ds = fmt(d);
    nightsArr.push(nightPrice(ds, typeId, periods));
    d = addDays(d, 1);
  }
  if (nightsArr.some((x) => !x.price)) return { missing: true, nights: n };
  const lines = [];
  nightsArr.forEach((x) => {
    const key = `${x.price}|${x.period?.id ?? ''}`;
    const l = lines.find((y) => y.key === key);
    if (l) {
      l.count++;
      return;
    }
    // Lun–Mié / Jue–Dom solo si en ese período el precio cambia según el día
    const pp = (x.period?.precios || {})[typeId] || {};
    const splitDays = Number(pp.entre) !== Number(pp.finde);
    lines.push({
      key,
      count: 1,
      price: x.price,
      periodName: x.period ? (isNormal(x.period) ? 'Normal' : x.period.nombre || 'Período') : '',
      dayLabel: splitDays ? (x.finde ? 'Jue–Dom' : 'Lun–Mié') : '',
    });
  });
  const base = nightsArr.reduce((s, x) => s + x.price, 0);
  const extraSum = type.extra ? nightsArr.reduce((s, x) => s + x.extra, 0) : 0;
  const extraGuests = type.extra ? Math.max(0, (Number(guests) || 1) - BASE_GUESTS) : 0;
  const round2 = (v) => Math.round(v * 100) / 100;
  return {
    missing: false,
    nights: n,
    lines,
    base,
    avg: round2(base / n),
    extraAvg: round2(extraSum / n),
    extraGuests,
    extraTotal: extraSum * extraGuests,
    total: base + extraSum * extraGuests,
    varied: new Set(nightsArr.map((x) => x.price)).size > 1,
  };
}

// Cotiza una habitación (P1…P6) por su tipo
export const quoteRoom = (roomId, checkIn, checkOut, guests, periods) => {
  const t = roomTypeOf(roomId);
  return t ? quoteStay(checkIn, checkOut, t.id, guests, periods) : null;
};

const near = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.01;

// ¿La tarifa y los adicionales cargados son los del tarifario?
// (los adicionales bonificados no cuentan; con 2 o menos huéspedes no hay adicional)
export function pricingMatches(pricing, q) {
  if (!q || q.missing || !pricing) return false;
  if (pricing.ratePerNight === '' || pricing.ratePerNight === null || pricing.ratePerNight === undefined) return false;
  if (!near(pricing.ratePerNight, q.avg)) return false;
  const ads = (pricing.additionals || []).slice(0, q.extraGuests).filter((a) => !a.bonificada);
  return ads.every((a) => near(a.ratePerNight, q.extraAvg));
}

// Aplica la cotización a un pricing: tarifa = promedio y cada adicional = adicional del tarifario
// (las bonificadas siguen bonificadas)
export function applyQuote(pricing, q, guests) {
  const count = Math.max(0, (Number(guests) || 1) - BASE_GUESTS);
  const cur = pricing.additionals || [];
  return {
    ...pricing,
    ratePerNight: q.avg,
    additionals: Array.from({ length: count }, (_, i) => ({
      bonificada: false,
      ...(cur[i] || {}),
      ratePerNight: q.extraGuests ? q.extraAvg : 0,
    })),
  };
}
