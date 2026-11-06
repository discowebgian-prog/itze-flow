/* eslint-disable */
// @ts-nocheck
import { parseD } from './dates';

// ── OVERLAP ───────────────────────────────────────────────────────────────────
export function findConflicts(all, propId, room, ci, co, excludeId) {
  if (!ci || !co || !propId) return [];
  const cid = parseD(ci),
    cod = parseD(co);
  return all.filter((r) => {
    // EL NUEVO ESCUDO: Ignora si es la misma reserva, si está cancelada, O si está en la papelera (deleted)
    if (
      r.id === excludeId ||
      r.status === 'cancelada' ||
      r.deleted === true ||
      r.propertyId !== propId
    )
      return false;
    if (room && r.room !== room) return false;
    return cid < parseD(r.checkOut) && cod > parseD(r.checkIn);
  });
}

// ── LATE CHECK-OUT ────────────────────────────────────────────────────────────
// Hora normal de salida (el check-out automático la usa si no hay late check-out)
export const CHECKOUT_HOUR = 14;
// Horas de un toque que se ofrecen en el formulario y en el panel
export const LATE_HOURS = ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

// Hora de late check-out de la reserva ('16:00') o '' si no tiene
export const lateHour = (r) => (r && r.lateCheckout ? String(r.lateCheckout).slice(0, 5) : '');

// Costo del late check-out (0 si no tiene)
export const lateCostOf = (r) => (lateHour(r) ? Number(r.lateCost) || 0 : 0);

// ¿Ya pasó la hora de salida? Para el check-out automático.
// Salida antes de hoy: desde las 14:00 de hoy (como siempre).
// Salida hoy: a las 14:00, o a la hora del late check-out si tiene.
export function checkoutTimePassed(checkOutDate, late, nowMerida, hoyFmt) {
  if (!checkOutDate || checkOutDate > hoyFmt) return false;
  const nowMin = nowMerida.getHours() * 60 + nowMerida.getMinutes();
  if (checkOutDate < hoyFmt) return nowMin >= CHECKOUT_HOUR * 60;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(late || ''));
  const limit = m ? Number(m[1]) * 60 + Number(m[2]) : CHECKOUT_HOUR * 60;
  return nowMin >= Math.max(limit, CHECKOUT_HOUR * 60);
}
