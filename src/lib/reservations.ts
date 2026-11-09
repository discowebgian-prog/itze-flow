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

// ── TOTAL DE UNA ESTANCIA ─────────────────────────────────────────────────────
// Tarifa × noches (al peso) − descuento + personas adicionales + late check-out.
// Lo usan el formulario y el grupo (al cambiar fechas de todas las habitaciones).
export function calcStayTotal(pricing, nights, lateCost = 0) {
  if (!nights || !pricing) return 0;
  const rate = Number(pricing.ratePerNight) || 0;
  // Redondeado al peso: con una tarifa promedio del cotizador ($1.026,67 × 3) el total da exacto ($3.080)
  let b = Math.round(rate * nights);
  if (pricing.discountType === 'porcentaje') b -= b * ((Number(pricing.discountValue) || 0) / 100);
  else if (pricing.discountType === 'monto_fijo') b -= Number(pricing.discountValue) || 0;
  else if (pricing.discountType === 'noche_gratis') b -= rate * (Number(pricing.discountValue) || 0);
  const addT = (pricing.additionals || []).reduce(
    (s, a) => s + (a.bonificada ? 0 : Math.round((Number(a.ratePerNight) || 0) * nights)),
    0
  );
  return Math.max(0, Math.round((b + addT + (Number(lateCost) || 0)) * 100) / 100);
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

// Estadía sin cargo: total $0 y nadie pagó (noches gratis que cubren todo, 100% de descuento…).
// No es "pagado": no hubo pago de por medio.
export const isFreeStay = (r) => (Number(r?.totalAmount) || 0) <= 0 && (Number(r?.paid) || 0) <= 0;
