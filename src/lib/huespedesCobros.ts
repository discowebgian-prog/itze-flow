/* eslint-disable */
// @ts-nocheck
// ── FINANZAS › "HUÉSPEDES Y COBROS" (por mes) ─────────────────────────────────
// Base: reservas que ENTRAN en el mes (fecha de entrada). Las canceladas solo cuentan en
// "Cancelaciones". Lo usa la sección plegable de cada mes y el Asesor IA.
import { diffDays } from './dates';
import { lateHour, lateCostOf } from './reservations';
import { stayInfo } from './guests';

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Forma de pago normalizada
export const PAGOS = [
  ['efectivo', 'Efectivo', 'var(--c-10B981)'],
  ['transferencia', 'Transferencia', 'var(--c-3B82F6)'],
  ['debito', 'Débito', 'var(--c-8B5CF6)'],
  ['credito', 'Crédito', 'var(--c-F59E0B)'],
  ['vcc', 'VCC Booking', 'var(--c-1E40AF)'],
  ['otro', 'Otro', 'var(--c-9CA3AF)'],
];
export function pagoDe(m) {
  const s = sinTildes(m);
  if (!s) return 'otro';
  if (s.includes('vcc') || s.includes('virtual')) return 'vcc';
  if (s.includes('transf')) return 'transferencia';
  if (s.includes('debit')) return 'debito';
  if (s.includes('credit')) return 'credito';
  if (s.includes('efect')) return 'efectivo';
  return 'otro';
}
const esMexico = (n) => ['mexico', 'mexicana', 'mexicano', 'mx'].includes(sinTildes(n));
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

// Descuento y noche gratis en $ (lo que se dejó de cobrar), igual que calcStayTotal
function descuentoDe(r) {
  const p = r.pricing || {};
  const n = diffDays(r.checkIn, r.checkOut);
  const rate = Number(p.ratePerNight) || 0;
  const base = Math.round(rate * n);
  const v = Number(p.discountValue) || 0;
  if (p.discountType === 'porcentaje') return { desc: base * (v / 100), gratis: 0 };
  if (p.discountType === 'monto_fijo') return { desc: v, gratis: 0 };
  if (p.discountType === 'noche_gratis') return { desc: 0, gratis: rate * v };
  return { desc: 0, gratis: 0 };
}
const extraDe = (r) => {
  const n = diffDays(r.checkIn, r.checkOut);
  return ((r.pricing && r.pricing.additionals) || []).reduce((s, a) => s + (a.bonificada ? 0 : Math.round((Number(a.ratePerNight) || 0) * n)), 0);
};

export function cobrosMes(reservations, allRes, monthKey, decisions = []) {
  const base = reservations.filter((r) => r && r.checkIn && r.checkIn.slice(0, 7) === monthKey);
  const act = base.filter((r) => r.status !== 'cancelada');
  const canc = base.filter((r) => r.status === 'cancelada');
  const n = act.length;
  const total = act.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);

  // Cómo pagan (sobre lo cobrado)
  const pago = {};
  PAGOS.forEach(([k]) => (pago[k] = { monto: 0, n: 0 }));
  act.forEach((r) => {
    const paid = Number(r.paid) || 0;
    if (paid <= 0) return;
    const k = pagoDe(r.paymentMethod);
    pago[k].monto += paid;
    pago[k].n++;
  });
  const cobrado = Object.values(pago).reduce((s, x) => s + x.monto, 0);

  // Facturas y empresas (empresa = pidió factura y tiene nombre de empresa)
  const fact = act.filter((r) => r.requiresInvoice);
  const emp = fact.filter((r) => String(r.company || '').trim());
  const empCount = {};
  emp.forEach((r) => {
    const k = String(r.company).trim();
    empCount[k] = (empCount[k] || 0) + 1;
  });

  // Extras
  const late = act.filter((r) => lateHour(r));
  const ext = act.filter((r) => Number(r.extendidaNoches) > 0);
  const extNoches = ext.reduce((s, r) => s + Number(r.extendidaNoches), 0);
  const extMonto = ext.reduce((s, r) => s + Number(r.extendidaNoches) * (Number(r.pricing?.ratePerNight) || 0), 0);
  const extraMonto = act.reduce((s, r) => s + extraDe(r), 0);
  const conExtra = act.filter((r) => extraDe(r) > 0).length;

  // Quiénes son
  const repiten = act.filter((r) => {
    const s = stayInfo(allRes || reservations, r, decisions);
    return s && s.number > 1;
  }).length;
  const conNac = act.filter((r) => String(r.guestNationality || '').trim());
  const ext_ = conNac.filter((r) => !esMexico(r.guestNationality));
  const paises = {};
  ext_.forEach((r) => {
    const k = String(r.guestNationality).trim();
    paises[k] = (paises[k] || 0) + 1;
  });

  // Lo que se perdió
  const canales = {};
  canc.forEach((r) => {
    const k = r.source || 'Sin canal';
    canales[k] = (canales[k] || 0) + 1;
  });
  let desc = 0,
    gratis = 0;
  act.forEach((r) => {
    const d = descuentoDe(r);
    desc += d.desc;
    gratis += d.gratis;
  });

  const top = (o, k = 3) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k);
  return {
    n,
    total,
    pago,
    cobrado,
    factura: { n: fact.length, pct: pct(fact.length, n), pctIngresos: pct(fact.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0), total) },
    empresas: { n: emp.length, pct: pct(emp.length, n), top: top(empCount) },
    late: { n: late.length, pct: pct(late.length, n), monto: late.reduce((s, r) => s + lateCostOf(r), 0) },
    extension: { n: ext.length, noches: extNoches, monto: Math.round(extMonto) },
    extra: { n: conExtra, monto: extraMonto },
    repiten: { n: repiten, pct: pct(repiten, n) },
    procedencia: { conDato: conNac.length, extranjeros: ext_.length, pctExtranjeros: pct(ext_.length, conNac.length), top: top(paises, 4) },
    cancel: { n: canc.length, pct: pct(canc.length, base.length), canales: top(canales), monto: canc.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0) },
    perdido: { descuentos: Math.round(desc), gratis: Math.round(gratis) },
  };
}

// Resumen en texto para el Asesor IA
export function cobrosParaAsesor(c) {
  if (!c || !c.n) return '';
  const pagos = PAGOS.filter(([k]) => c.pago[k].monto > 0)
    .map(([k, l]) => `${l} ${pct(c.pago[k].monto, c.cobrado)}%`)
    .join(', ');
  return [
    `- Formas de pago (sobre lo cobrado): ${pagos || 'sin cobros'}`,
    `- Pidieron factura: ${c.factura.pct}% de las reservas (${c.factura.pctIngresos}% de los ingresos). Empresas: ${c.empresas.n} reservas${c.empresas.top.length ? ' (' + c.empresas.top.map(([k, v]) => `${k} ${v}`).join(', ') + ')' : ''}`,
    `- Late check-out: ${c.late.pct}% de las reservas, $${Math.round(c.late.monto)}. Personas extra: $${Math.round(c.extra.monto)}. Extendieron estadía: ${c.extension.n} reservas (${c.extension.noches} noches)`,
    `- Huéspedes que repiten: ${c.repiten.pct}%. Extranjeros: ${c.procedencia.pctExtranjeros}%${c.procedencia.top.length ? ' (' + c.procedencia.top.map(([k, v]) => `${k} ${v}`).join(', ') + ')' : ''}`,
    `- Cancelaciones: ${c.cancel.n} (${c.cancel.pct}%)${c.cancel.canales.length ? ', por canal: ' + c.cancel.canales.map(([k, v]) => `${k} ${v}`).join(', ') : ''}. Descuentos: $${c.perdido.descuentos}; noches gratis: $${c.perdido.gratis}`,
  ].join('\n');
}
