/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { LATE_HOURS } from '../../lib/reservations';
import { LATE_COLORS } from '../ui/LateBadge';

// Hora acordada (botones de un toque + "Otra") y costo del late check-out.
// Se usa en el formulario de reserva y en el acceso rápido del panel.
export function LatePicker({ hour, cost, onHour, onCost }) {
  const isOther = !!hour && !LATE_HOURS.includes(hour);
  const [showOther, setShowOther] = useState(isOther);

  const chip = (on) => ({
    flex: '1 1 0',
    minWidth: 0,
    minHeight: 36,
    padding: '6px 4px',
    borderRadius: 20,
    border: `1.5px solid ${on ? LATE_COLORS.txt : '#E5E7EB'}`,
    background: on ? LATE_COLORS.bg : '#fff',
    color: on ? LATE_COLORS.txt : '#6B7280',
    fontFamily: 'inherit',
    fontWeight: on ? 800 : 600,
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });
  const label = {
    fontSize: 11,
    fontWeight: 700,
    color: '#888',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  };
  const field = {
    width: '100%',
    padding: '9px 12px',
    border: '1.5px solid #E5E7EB',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
  };

  return (
    <div>
      <div style={label}>Hora acordada</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
        {LATE_HOURS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => {
              setShowOther(false);
              onHour(h);
            }}
            style={chip(hour === h && !showOther)}
          >
            {hour === h && !showOther ? '✓ ' : ''}
            {h}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowOther(true)}
          style={{ ...chip(showOther), gridColumn: 'span 2' }}
        >
          {showOther ? '✓ ' : ''}Otra hora
        </button>
      </div>
      {showOther && (
        <input
          type="time"
          value={isOther ? hour : ''}
          onChange={(e) => onHour(e.target.value)}
          style={{ ...field, marginBottom: 10 }}
        />
      )}
      <div style={label}>Costo $ (0 si es cortesía)</div>
      <input
        type="number"
        inputMode="numeric"
        value={cost}
        onChange={(e) => onCost(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="0"
        style={field}
      />
    </div>
  );
}
