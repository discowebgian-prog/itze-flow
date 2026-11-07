/* eslint-disable */
// @ts-nocheck
import { diffDays, parseD } from './dates';

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
