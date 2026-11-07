/* eslint-disable */
// @ts-nocheck
import { currency } from '../../lib/dates';

// ── DESGLOSE DEL COTIZADOR ────────────────────────────────────────────────────
// Muestra cómo sale la tarifa noche por noche según el tarifario.
// "🧮 Del tarifario" si la tarifa cargada coincide; "✏️ A mano" si no, con el botón para volver.
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
      <div style={{ marginTop: 8, fontSize: 11.5, color: '#6B7280', background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: 8, padding: '7px 10px' }}>
        🧮 Sin precio en el tarifario para esta habitación en esas fechas: cargá la tarifa a mano.
      </div>
    );
  }
  const noches = (n) => (n === 1 ? '1 noche' : `${n} noches`);
  return (
    <div
      style={{
        marginTop: 8,
        padding: '8px 10px',
        borderRadius: 8,
        background: matches ? '#EFF6FF' : '#F9FAFB',
        border: `1px solid ${matches ? '#BFDBFE' : '#E5E7EB'}`,
        fontSize: 11.5,
        color: '#374151',
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 800, color: matches ? '#1D4ED8' : '#6B7280', marginBottom: 2 }}>
        {matches ? '🧮 Del tarifario' : '✏️ A mano'}
      </div>
      {q.lines.map((l) => (
        <div key={l.key} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>
            {noches(l.count)} × {currency(l.price)}
          </span>
          <span style={{ color: '#6B7280' }}>
            {l.periodName}
            {l.dayLabel ? ` · ${l.dayLabel}` : ''}
          </span>
        </div>
      ))}
      <div style={{ borderTop: '1px dashed #CBD5E1', marginTop: 4, paddingTop: 4 }}>
        {noches(q.nights)} = <b>{currency(q.base)}</b>
        {q.varied && <span style={{ color: '#6B7280' }}> · promedio {money(q.avg)}/noche</span>}
      </div>
      {q.extraGuests > 0 && (
        <div>
          + {q.extraGuests === 1 ? '1 persona extra' : `${q.extraGuests} personas extra`}: {q.nights} × {money(q.extraAvg)}
          {q.extraGuests > 1 ? ` × ${q.extraGuests}` : ''} = <b>{currency(q.extraTotal)}</b>
        </div>
      )}
      {!matches && onUse && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ color: '#1D4ED8', fontWeight: 600 }}>
            El tarifario da {money(q.avg)}/noche ({currency(q.total)})
          </span>
          <button
            type="button"
            onClick={onUse}
            style={{
              padding: '5px 10px',
              background: '#fff',
              border: '1.5px solid #2563EB',
              color: '#2563EB',
              borderRadius: 7,
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ↺ Usar tarifario
          </button>
        </div>
      )}
    </div>
  );
}
