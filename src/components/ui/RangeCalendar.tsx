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
// askChange (al editar una reserva): con las dos fechas puestas, tocar un día ofrece cómo cambiar la estadía
// según dónde cae — antes de la entrada: adelantar la llegada; adentro: acortar o atrasar la llegada;
// en la salida o después: extender — y siempre "Mover la estadía" (mismas noches, empezando ese día)
// y "Elegir fechas nuevas" (arranca de cero). Tocar la entrada no hace nada.
const addDays = (d, n) => {
  const x = parseD(d);
  x.setDate(x.getDate() + n);
  return fmt(x);
};
const nOf = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const nTxt = (n) => `${n} noche${n !== 1 ? 's' : ''}`;

export function RangeCalendar({ checkIn, checkOut, onChange, minDate, fixedRows = false, askChange = false }) {
  const [base, setBase] = useState(checkIn ? parseD(checkIn) : TODAY);
  const [hover, setHover] = useState(null);
  const [ask, setAsk] = useState(null); // { s, opts: [{ key, title, ci, co }], prev }
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
      if (s === checkIn) return setAsk(null);
      const N = nOf(checkIn, checkOut);
      const opts = [];
      if (s < checkIn) opts.push({ key: 'early', title: 'Adelantar la llegada', ci: s, co: checkOut });
      if (s > checkIn && s < checkOut) {
        opts.push({ key: 'short', title: 'Acortar: salir antes', ci: checkIn, co: s });
        opts.push({ key: 'late', title: 'Atrasar la llegada', ci: s, co: checkOut });
      }
      if (s > checkOut) opts.push({ key: 'ext', title: 'Extender la estadía', ci: checkIn, co: s });
      opts.push({ key: 'move', title: 'Mover la estadía', ci: s, co: addDays(s, N) });
      setAsk({ s, opts, prev: 0 });
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

  const pick = (o) => {
    onChange(o.ci, o.co);
    setAsk(null);
  };
  const askNo = () => {
    onChange(ask.s, '');
    setStep(1);
    setAsk(null);
  };
  // Vista previa en el almanaque de la opción marcada (la primera, o la que tenés el mouse encima)
  const pv = ask ? ask.opts[ask.prev] : null;
  const diffTxt = (o) => {
    const d = nOf(o.ci, o.co) - nOf(checkIn, checkOut);
    const n = nOf(o.ci, o.co);
    return d === 0 ? (n === 1 ? 'misma noche' : `mismas ${n} noches`) : `${Math.abs(d)} noche${Math.abs(d) !== 1 ? 's' : ''} ${d > 0 ? 'más' : 'menos'}`;
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
          // Con una opción en vista previa, el almanaque muestra cómo quedaría: fechas nuevas en azul,
          // días que se suman con borde punteado y días que se pierden tachados
          const ci2 = pv ? pv.ci : checkIn;
          const co2 = pv ? pv.co : checkOut;
          const isCI = s === ci2;
          const isCO = s === co2;
          const isEnd = isCI || isCO;
          const isAsk = ask?.s === s;
          const inOld = checkIn && checkOut && s >= checkIn && s <= checkOut;
          const inNew = pv && s >= pv.ci && s <= pv.co;
          const addSpan = pv && inNew && !inOld && !isEnd;
          const cutSpan = pv && inOld && !inNew;
          const isToday = s === fmt(TODAY);
          let inRange = false;
          if (ci2 && co2) inRange = s > ci2 && s < co2;
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
                ...(isAsk ? { boxShadow: isEnd ? '0 0 0 2px var(--card), 0 0 0 4px var(--acc)' : 'inset 0 0 0 2px var(--acc)', borderRadius: '50%', fontWeight: 800 } : {}),
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
      {/* Al editar: qué hacer con el día tocado */}
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
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            Tocaste el {dayTxt(ask.s)}. ¿Qué querés hacer?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ask.opts.map((o, i) => (
              <button
                key={o.key}
                type="button"
                onClick={() => pick(o)}
                onMouseEnter={() => setAsk((a) => (a ? { ...a, prev: i } : a))}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 46,
                  padding: '7px 12px',
                  border: 'none',
                  borderRadius: 12,
                  background: i === 0 ? 'var(--acc)' : 'var(--card)',
                  color: i === 0 ? '#fff' : 'var(--ink)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span style={{ lineHeight: 1.25 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{o.title}</span>
                  <span style={{ display: 'block', fontSize: 12.5, opacity: 0.85 }}>
                    {dayTxt(o.ci)} → {dayTxt(o.co)}
                  </span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', opacity: 0.9 }}>{diffTxt(o)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={askNo}
              style={{ minHeight: 40, border: 'none', borderRadius: 12, background: 'transparent', color: 'var(--acc)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Elegir fechas nuevas desde el {dayTxt(ask.s)}
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
