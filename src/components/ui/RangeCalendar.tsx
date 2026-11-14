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
// askChange (al editar una reserva): con las dos fechas puestas, tocar un día después de la salida
// pregunta si extender la estadía hasta ahí, y uno entre la entrada y la salida, si acortarla.
// Un día antes de la entrada pregunta si adelantar la llegada. "No, elegir fechas nuevas" arranca de cero.
export function RangeCalendar({ checkIn, checkOut, onChange, minDate, fixedRows = false, askChange = false }) {
  const [base, setBase] = useState(checkIn ? parseD(checkIn) : TODAY);
  const [hover, setHover] = useState(null);
  const [ask, setAsk] = useState(null); // { s, kind: 'ext' | 'short' | 'early' }
  // Con entrada y sin salida (Cotizar desde Libres hoy) el próximo toque elige la salida
  const [step, setStep] = useState(checkIn && checkOut ? 2 : checkIn ? 1 : 0);

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
    if (step === 2 && askChange && checkIn && checkOut) {
      if (s === checkIn || s === checkOut) return setAsk(null);
      setAsk({ s, kind: s > checkOut ? 'ext' : s < checkIn ? 'early' : 'short' });
      return;
    }
    setAsk(null);
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

  const askYes = () => {
    if (ask.kind === 'early') onChange(ask.s, checkOut);
    else onChange(checkIn, ask.s);
    setAsk(null);
  };
  const askNo = () => {
    onChange(ask.s, '');
    setStep(1);
    setAsk(null);
  };
  const askDiff = ask
    ? Math.abs(Math.round((parseD(ask.s) - parseD(ask.kind === 'early' ? checkIn : checkOut)) / 86400000))
    : 0;

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
          const isAsk = ask?.s === s;
          // Tramo que cambia si se dice que sí: días que se suman (extender/adelantar) o que se sacan (acortar)
          const addSpan =
            ask && !isEnd && !isAsk &&
            ((ask.kind === 'ext' && s > checkOut && s < ask.s) || (ask.kind === 'early' && s > ask.s && s < checkIn));
          const cutSpan = ask && ask.kind === 'short' && !isEnd && !isAsk && s > ask.s && s < checkOut;
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
                ...(addSpan
                  ? { background: 'var(--acc-soft)', outline: '1.5px dashed var(--acc)', outlineOffset: -2, color: 'var(--acc)', borderRadius: 10, fontWeight: 700 }
                  : {}),
                ...(cutSpan ? { background: 'var(--fill)', color: 'var(--mut)', textDecoration: 'line-through', borderRadius: 10 } : {}),
                ...(isAsk ? { boxShadow: 'inset 0 0 0 2px var(--acc)', borderRadius: '50%', fontWeight: 800 } : {}),
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
      {/* Al editar: ¿extender o acortar hasta el día tocado? */}
      {ask && (
        <div
          className="pop-in"
          style={{
            marginTop: 10,
            background: 'var(--acc-soft)',
            borderRadius: 'var(--r-field)',
            padding: '11px 12px',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35 }}>
            {ask.kind === 'ext'
              ? `¿Extender la estadía hasta el ${dayTxt(ask.s)}?`
              : ask.kind === 'early'
                ? `¿Adelantar la llegada al ${dayTxt(ask.s)}?`
                : `¿Acortar la estadía, con salida el ${dayTxt(ask.s)}?`}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>
            {`${askDiff} noche${askDiff !== 1 ? 's' : ''} ${ask.kind === 'short' ? 'menos' : 'más'}`}
            {ask.kind === 'early' ? ` · la salida sigue el ${dayTxt(checkOut)}` : ` · la entrada sigue el ${dayTxt(checkIn)}`}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={askYes}
              style={{ flex: 1, minHeight: 40, border: 'none', borderRadius: 12, background: 'var(--acc)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {ask.kind === 'ext' ? 'Sí, extender' : ask.kind === 'early' ? 'Sí, adelantar' : 'Sí, acortar'}
            </button>
            <button
              type="button"
              onClick={askNo}
              style={{ flex: 1, minHeight: 40, border: 'none', borderRadius: 12, background: 'var(--card)', color: 'var(--ink)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              No, elegir fechas nuevas
            </button>
          </div>
        </div>
      )}
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
