/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { currency } from '../../lib/dates';
import { ic } from '../ui/Icon';

// ── DESGLOSE DEL COTIZADOR ────────────────────────────────────────────────────
// Muestra cómo sale la tarifa noche por noche según el tarifario.
// "Del tarifario" (calculadora) si la tarifa cargada coincide. Si no, "Tarifa a medida": un aviso simple y,
// opcional, cuánto sería con el tarifario y el botón para usarlo (el detalle noche por noche, plegado).
// Monto con centavos solo si los tiene ($ 992.50)
export const money = (n) =>
  Number.isInteger(Number(n))
    ? currency(n)
    : '$ ' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// q: resultado de quoteStay · matches: pricingMatches(...) · onUse: aplicar el tarifario
export function QuoteInfo({ q, matches, onUse }) {
  if (!q) return null;
  if (q.missing) {
    return (
      <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--mut)', background: 'var(--inset)', borderRadius: 'var(--r-field)', padding: '8px 11px' }}>
        {ic('calculator', 13)}Esta habitación no tiene precio cargado en Tarifas para esas fechas. Escribí la tarifa a mano.
      </div>
    );
  }
  const noches = (n) => (n === 1 ? '1 noche' : `${n} noches`);
  if (!matches) return <CustomRate q={q} onUse={onUse} noches={noches} />;
  return (
    <div
      style={{
        marginTop: 8,
        padding: '9px 12px',
        borderRadius: 'var(--r-field)',
        background: 'var(--acc-soft)',
        fontSize: 12,
        color: 'var(--ink-2)',
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 800, color: 'var(--acc)', marginBottom: 2 }}>
        {ic('calculator', 13)}Del tarifario
      </div>
      {q.lines.map((l) => (
        <div key={l.key} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>
            {noches(l.count)} × {currency(l.price)}
          </span>
          <span style={{ color: 'var(--mut)' }}>
            {l.periodName}
            {l.dayLabel ? ` · ${l.dayLabel}` : ''}
          </span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(60,60,67,.12)', marginTop: 4, paddingTop: 4 }}>
        {noches(q.nights)} = <b>{currency(q.base)}</b>
        {q.varied && <span style={{ color: 'var(--mut)' }}> · promedio {money(q.avg)}/noche</span>}
      </div>
      {q.extraGuests > 0 && (
        <div>
          + {q.extraGuests === 1 ? '1 persona extra' : `${q.extraGuests} personas extra`}: {q.nights} × {money(q.extraAvg)}
          {q.extraGuests > 1 ? ` × ${q.extraGuests}` : ''} = <b>{currency(q.extraTotal)}</b>
        </div>
      )}
    </div>
  );
}

// Tarifa a medida: la tarifa cargada no coincide con el tarifario (precio especial, acuerdo, reserva vieja…).
// Pedido de Gian: no mostrar las cuentas del tarifario de entrada, porque no cuadran con lo cobrado y confunden.
function CustomRate({ q, onUse, noches }) {
  const [open, setOpen] = useState(false);
  const link = { background: 'none', border: 'none', padding: 0, color: 'var(--acc)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <div style={{ marginTop: 8, padding: '11px 13px', borderRadius: 'var(--r-field)', background: 'var(--inset)', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>
      <div style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 13.5 }}>
        {ic('tag', 14)}Tarifa a medida
      </div>
      <div style={{ color: 'var(--mut)', marginTop: 2 }}>
        Esta reserva tiene una tarifa especial: no coincide con el tarifario, así que se respeta la que está cargada.
      </div>
      {onUse && (
        <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--line)' }}>
          <div>
            ¿Preferís usar el tarifario? Serían <b>{money(q.avg)} por noche</b> ({currency(q.total)} en total).
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onUse}
              style={{ padding: '6px 13px', background: 'var(--card)', border: '1px solid var(--acc)', color: 'var(--acc)', borderRadius: 20, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {ic('repeat', 12)}Usar tarifario
            </button>
            <button type="button" onClick={() => setOpen((o) => !o)} style={link}>
              {open ? 'Ocultar detalle' : 'Ver cómo sale'}
            </button>
          </div>
          {open && (
            <div className="pop-in" style={{ marginTop: 8, fontSize: 12, color: 'var(--mut)' }}>
              {q.lines.map((l) => (
                <div key={l.key}>
                  {noches(l.count)} × {currency(l.price)} · {l.periodName}
                  {l.dayLabel ? ` · ${l.dayLabel}` : ''}
                </div>
              ))}
              {q.extraGuests > 0 && (
                <div>
                  + {q.extraGuests === 1 ? '1 persona extra' : `${q.extraGuests} personas extra`}: {currency(q.extraTotal)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
