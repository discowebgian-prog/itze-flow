/* eslint-disable */
// @ts-nocheck
import { fmtD } from '../../lib/dates';

// ── CONFLICT WARNING ──────────────────────────────────────────────────────────
export function ConflictWarn({ conflicts, properties }) {
  if (!conflicts || !conflicts.length) return null;
  return (
    <div
      className="pop-in"
      style={{
        background: 'var(--c-FEF2F2)',
        border: '1.5px solid var(--c-FECACA)',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 13,
          color: 'var(--c-DC2626)',
          marginBottom: 6,
        }}
      >
        ⚠️ Conflicto de disponibilidad
      </div>
      {conflicts.map((r) => {
        const p = properties.find((x) => x.id === r.propertyId);
        return (
          <div
            key={r.id}
            style={{
              fontSize: 12,
              color: 'var(--c-7F1D1D)',
              padding: '3px 0',
              borderTop: '1px solid var(--c-FECACA)',
            }}
          >
            <b>{r.guestName}</b> · {fmtD(r.checkIn)} → {fmtD(r.checkOut)} ·{' '}
            {p?.name}
            {r.room ? ` Hab.${r.room}` : ''}
          </div>
        );
      })}
    </div>
  );
}
