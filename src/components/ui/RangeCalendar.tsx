/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { TODAY, fmt, parseD, MONTHS, DAYS } from '../../lib/dates';
import { Icon } from './Icon';

// "vie 20 nov" (o — si falta)
const dayTxt = (d) =>
  d ? parseD(d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '').replace(' de ', ' ') : '—';

// ── RANGE CALENDAR ────────────────────────────────────────────────────────────
// fixedRows: siempre 6 semanas, así el almanaque no cambia de alto al pasar de mes (lo usa Cotizar)
export function RangeCalendar({ checkIn, checkOut, onChange, minDate, fixedRows = false }) {
  const [base, setBase] = useState(checkIn ? parseD(checkIn) : TODAY);
  const [hover, setHover] = useState(null);
  const [step, setStep] = useState(checkIn && checkOut ? 2 : 0);

  // Candado inteligente: Si le pasamos una fecha mínima (ej. checkIn en el pasado), usa esa. Si no, usa HOY.
  const minD = null;

  const y = base.getFullYear(),
    m = base.getMonth();
  const daysInMo = new Date(y, m + 1, 0).getDate();
  const firstDow = new Date(y, m, 1).getDay();
  const grid = Array(firstDow)
    .fill(null)
    .concat(Array.from({ length: daysInMo }, (_, i) => new Date(y, m, i + 1)));
  if (fixedRows) while (grid.length < 42) grid.push(null);

  const clickD = (d) => {
    if (!d || (minD && d < minD)) return;
    const s = fmt(d);
    
    // El nuevo estándar: Si ya hay un rango completo (step 2) y tocás cualquier fecha,
    // se limpia la selección previa y esa fecha se convierte en tu nuevo Check-In.
    if (step === 2) {
      onChange(s, '');
      setStep(1);
    } else if (step === 0) {
      onChange(s, '');
      setStep(1);
    } else if (step === 1) {
      if (s <= checkIn) {
        onChange(s, '');
      } else {
        onChange(checkIn, s);
        setStep(2);
      }
    }
  };

  let nights = 0;
  if (checkIn && checkOut) {
    nights = Math.round((parseD(checkOut) - parseD(checkIn)) / 86400000);
  }

  return (
    <div
      style={{
        background: 'var(--card)',
        padding: '2px 0 0',
        marginBottom: 12,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setBase(new Date(y, m - 1, 1))}
          style={{
            border: 'none',
            background: 'var(--fill)',
            borderRadius: '50%',
            width: 32,
            height: 32,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            color: 'var(--acc)',
          }}
        >
          <Icon name="chevL" size={18} strokeWidth={2.5} />
        </button>
        <div
          style={{
            fontWeight: 'var(--w-title)',
            fontSize: 17,
            color: 'var(--ink)',
            textTransform: 'capitalize',
            letterSpacing: '-.01em',
          }}
        >
          {MONTHS[m]} {y}
        </div>
        <button
          type="button"
          onClick={() => setBase(new Date(y, m + 1, 1))}
          style={{
            border: 'none',
            background: 'var(--fill)',
            borderRadius: '50%',
            width: 32,
            height: 32,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            color: 'var(--acc)',
          }}
        >
          <Icon name="chev" size={18} strokeWidth={2.5} />
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
          textAlign: 'center',
          marginBottom: 4,
        }}
      >
        {DAYS.map((d) => (
          <div
            key={d}
            style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)' }}
          >
            {d.charAt(0)}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
          textAlign: 'center',
        }}
      >
        {grid.map((d, i) => {
          if (!d) return <div key={i} />;
          const s = fmt(d);
          const isDisabled = false; // Sin restricciones de clics
          const isCI = s === checkIn;
          const isCO = s === checkOut;
          const isEnd = isCI || isCO;
          const isToday = s === fmt(TODAY);
          let inRange = false;
          if (checkIn && checkOut) inRange = s > checkIn && s < checkOut;
          else if (checkIn && hover && step === 1)
            inRange = s > checkIn && s <= hover;

          let bg = 'transparent',
            col = 'var(--ink)',
            radius = '50%';
          if (isEnd) {
            bg = 'var(--acc)';
            col = '#fff';
          } else if (inRange) {
            bg = 'var(--acc-soft)';
            col = 'var(--acc)';
            radius = 10;
          } else if (isDisabled) {
            col = 'var(--handle)';
          }

          return (
            <div
              key={i}
              className="tap"
              onClick={() => clickD(d)}
              onMouseEnter={() => step === 1 && setHover(s)}
              style={{
                aspectRatio: '1/1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: isEnd ? 700 : 500,
                background: bg,
                color: col,
                borderRadius: radius,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                position: 'relative',
                ...(isToday && !isEnd ? { color: 'var(--acc)', fontWeight: 800 } : {}),
              }}
            >
              {d.getDate()}
              {/* Hoy: puntito azul debajo del número */}
              {isToday && !isEnd && (
                <span style={{ position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: '50%', background: 'var(--acc)' }} />
              )}
            </div>
          );
        })}
      </div>
      {/* Pie en palabras (antes "CI: 20/11/2026 · CO: 23/11/2026") */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginTop: 10,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--mut)',
          background: 'var(--inset)',
          padding: '9px 12px',
          borderRadius: 'var(--r-field)',
        }}
      >
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ fontSize: 11 }}>Entrada</div>
          <div style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 14 }}>{dayTxt(checkIn)}</div>
        </div>
        {nights > 0 && (
          <div style={{ color: 'var(--acc)', background: 'var(--acc-soft)', borderRadius: 20, padding: '3px 10px', fontSize: 12.5, fontWeight: 700 }}>
            {nights} noche{nights !== 1 ? 's' : ''}
          </div>
        )}
        <div style={{ lineHeight: 1.25, textAlign: 'right' }}>
          <div style={{ fontSize: 11 }}>Salida</div>
          <div style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 14 }}>{dayTxt(checkOut)}</div>
        </div>
      </div>
    </div>
  );
}
