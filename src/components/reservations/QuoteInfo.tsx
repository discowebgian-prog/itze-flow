/* eslint-disable */
// @ts-nocheck
import { currency } from '../../lib/dates';
import { ic } from '../ui/Icon';

// ── DESGLOSE DEL COTIZADOR ────────────────────────────────────────────────────
// Muestra cómo sale la tarifa noche por noche según el tarifario.
// "Del tarifario" (calculadora) si la tarifa cargada coincide; "A mano" (lápiz) si no, con el botón para volver.
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
      <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--mut)', background: 'var(--bg)', borderRadius: 'var(--r-field)', padding: '8px 11px' }}>
        {ic('calculator', 13)}Esta habitación no tiene precio cargado en Tarifas para esas fechas. Escribí la tarifa a mano.
      </div>
    );
  }
  const noches = (n) => (n === 1 ? '1 noche' : `${n} noches`);
  return (
    <div
      style={{
        marginTop: 8,
        padding: '9px 12px',
        borderRadius: 'var(--r-field)',
        background: matches ? 'var(--acc-soft)' : 'var(--bg)',
        fontSize: 12,
        color: 'var(--ink-2)',
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 800, color: matches ? 'var(--acc)' : 'var(--mut)', marginBottom: 2 }}>
        {matches ? <>{ic('calculator', 13)}Del tarifario</> : <>{ic('edit', 13)}A mano</>}
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
      {!matches && onUse && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--acc)', fontWeight: 600 }}>
            Según el tarifario: {money(q.avg)} por noche ({currency(q.total)} en total)
          </span>
          <button
            type="button"
            onClick={onUse}
            style={{
              padding: '6px 12px',
              background: 'var(--acc)',
              border: 'none',
              color: '#fff',
              borderRadius: 20,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {ic('repeat', 12)}Usar tarifario
          </button>
        </div>
      )}
    </div>
  );
}
