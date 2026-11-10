/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { ROOMS, srcShort, RS, PS, BLOCK_COLORS, ALERTS, getAlerts } from '../lib/constants';
import { TODAY, fmt, fmtD, addDays, diffDays, parseD, currency, MONTHS, DAYS } from '../lib/dates';
import { findConflicts, lateHour } from '../lib/reservations';
import { groupOf } from '../lib/groups';
import { Icon, ic } from '../components/ui/Icon';
import { TimelineMobile } from './TimelineMobile';
import timelineCss from '../styles/timeline.css?raw';
import { QuoteButton } from '../components/Quoter';
import { AnimatePresence } from 'motion/react';
import { Backdrop, PopCard } from '../components/ui/Motion';

// Polígono con las esquinas redondeadas: cada punto es [x, y, radio]; radio 0 = esquina en punta
function roundedShape(pts) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[(i + n - 1) % n];
    const [x, y, rad] = pts[i];
    const [nx, ny] = pts[(i + 1) % n];
    const d1 = Math.hypot(px - x, py - y) || 1;
    const d2 = Math.hypot(nx - x, ny - y) || 1;
    const k = Math.min(rad, d1 / 2, d2 / 2);
    const a = [x + ((px - x) / d1) * k, y + ((py - y) / d1) * k];
    const b = [x + ((nx - x) / d2) * k, y + ((ny - y) / d2) * k];
    out.push(`${i ? 'L' : 'M'}${a[0]},${a[1]} Q${x},${y} ${b[0]},${b[1]}`);
  }
  return out.join(' ') + ' Z';
}

// ── TIMELINE DESKTOP ──────────────────────────────────────────────────────────
// "vie 13 nov"
const dayShort = (d) => parseD(d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '').replace(' de ', ' ');

// ── PIEZAS DEL ENCABEZADO (estilo Limpieza) ──
const TITLE = { margin: 0, fontSize: 30, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: 'var(--ls-title)' };
const ADD_BTN = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'var(--acc)', border: 'none',
  borderRadius: 20, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
};
const NAV_BTN = {
  display: 'inline-flex', alignItems: 'center', gap: 2, padding: '6px 12px', border: 'none', borderRadius: 8,
  background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', color: 'var(--ink)',
};
// Lista / Timeline como control segmentado de iPhone
function ViewSwitch({ view, setView }) {
  const opt = (v, icon, label) => {
    const on = view === v;
    return (
      <button
        onClick={() => setView(v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none',
          fontFamily: 'inherit', fontWeight: on ? 700 : 600, fontSize: 13.5, cursor: 'pointer',
          background: on ? 'var(--card)' : 'transparent', color: on ? 'var(--ink)' : 'var(--mut)',
          boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : 'none', transition: 'background .15s',
        }}
      >
        <Icon name={icon} size={15} />
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', background: 'var(--fill)', borderRadius: 10, padding: 2, gap: 2 }}>
      {opt('lista', 'list', 'Lista')}
      {opt('timeline', 'calendar', 'Timeline')}
    </div>
  );
}

export function Timeline({
  reservations,
  properties,
  onClickRes,
  onAddRes,
  onQuote,
  onUpdateRes,
  isMobile,
  calView,
  setCalView,
  offset,
  setOffset,
  highlightStatus,
}) {
  const NCOLS = isMobile ? 21 : 45,
    COL = 60,
    ROW = 62,
    LABEL = 70,
    SH = 4;
  // BORRAMOS EL const [offset, setOffset] = useState(-2);
  const [drag, setDrag] = useState(null);
  const [dConf, setDConf] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [hdrDrag, setHdrDrag] = useState(null);
  const [gridEl, setGridEl] = useState(null);
  const lpt = useState(null);

  if (calView === 'lista')
    return (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <h2 style={TITLE}>Calendario</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <ViewSwitch view="lista" setView={setCalView} />
            {onQuote && <QuoteButton onClick={onQuote} style={{ marginRight: 6, padding: '5px 12px' }} />}
            <button onClick={() => onAddRes()} style={ADD_BTN}>
              <Icon name="plus" size={16} strokeWidth={2.5} />
              Reserva
            </button>
          </div>
        </div>
        <TimelineMobile
          reservations={reservations}
          properties={properties}
          onClickRes={onClickRes}
          onAddRes={onAddRes}
          onQuote={onQuote}
          highlightStatus={highlightStatus}
        />
      </div>
    );

  const days = Array.from({ length: NCOLS }, (_, i) =>
    addDays(TODAY, offset + i)
  );
  const getCellBg = (d) => {
    const dow = new Date(d).getDay();
    const isPast = parseD(fmt(d)) < parseD(fmt(TODAY));
    if (fmt(d) === fmt(TODAY)) return 'var(--acc-soft)'; 
    if (isPast) return 'var(--bg)'; 
    if (dow === 0 || dow === 6) return 'var(--c-F5F3FF)';
    return 'var(--card)';
  };
  const rows = [];
  properties.forEach((p) => {
    if (p.type === 'hostel')
      ROOMS.forEach((r) => rows.push({ type: 'room', prop: p, room: r }));
    else rows.push({ type: 'prop', prop: p });
  });

  const getBlocks = (row) => {
    const pid = row.prop.id;
    const fn =
      row.type === 'room'
        ? (r) =>
            r.propertyId === pid &&
            r.room === row.room.id &&
            r.status !== 'cancelada'
        : (r) => r.propertyId === pid && r.status !== 'cancelada';
    const all = reservations.filter(fn);
    const ws = addDays(TODAY, offset),
      we = addDays(TODAY, offset + NCOLS);
    return all
      .map((r) => {
        if (parseD(r.checkOut) <= ws || parseD(r.checkIn) >= we) return null;
        const cutLeft = parseD(r.checkIn) < ws;
        const cutRight = parseD(r.checkOut) > we;
        const cs = Math.max(0, diffDays(fmt(ws), r.checkIn)),
          ce = Math.min(NCOLS, diffDays(fmt(ws), r.checkOut));
        const pxL = cs * COL + (cutLeft ? 0 : COL / 2);
        const pxR = ce * COL + (cutRight ? COL : COL / 2);

        return {
          ...r,
          colStart: cs,
          width: ce - cs,
          pxL,
          pxR,
          cutLeft,
          cutRight,
        };
      })
      .filter(Boolean);
  };

  const startDrag = (e, r, row) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setHdrDrag(null);
    const cx = e.touches ? e.touches[0].clientX : e.clientX,
      cy = e.touches ? e.touches[0].clientY : e.clientY;
    const gt = gridEl ? gridEl.getBoundingClientRect().top : 0;
    setDrag({
      id: r.id,
      guestName: r.guestName,
      orig: {
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        propId: row.prop.id,
        room: row.type === 'room' ? row.room.id : '',
      },
      startX: cx,
      startY: cy,
      startCol: r.colStart,
      origRowIdx: rows.indexOf(row),
      currentRowIdx: rows.indexOf(row),
      width: r.width,
      newPropId: row.prop.id,
      newRoom: row.type === 'room' ? row.room.id : '',
      newCheckIn: r.checkIn,
      gridTop: gt,
    });
  };

  const onMove = (e) => {
    if (drag) {
      const cx = e.touches ? e.touches[0].clientX : e.clientX,
        cy = e.touches ? e.touches[0].clientY : e.clientY;
      const cd = Math.round((cx - drag.startX) / COL);
      const ri = Math.max(
        0,
        Math.min(rows.length - 1, Math.floor((cy - drag.gridTop - 36) / ROW))
      );
      const nc = Math.max(0, Math.min(NCOLS - drag.width, drag.startCol + cd));
      const nr = rows[ri];
      setDrag((d) => ({
        ...d,
        currentCol: nc,
        currentRowIdx: ri,
        newPropId: nr.prop.id,
        newRoom: nr.type === 'room' ? nr.room.id : '',
        newCheckIn: fmt(addDays(addDays(TODAY, offset), nc)),
      }));
    }
    if (hdrDrag) {
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const dd = -Math.round((cx - hdrDrag.startX) / COL);
      setOffset(Math.max(-730, Math.min(730, hdrDrag.startOffset + dd)));
    }
  };

  const endDrag = () => {
    if (drag) {
      const ch =
        drag.newCheckIn !== drag.orig.checkIn ||
        drag.newPropId !== drag.orig.propId ||
        drag.newRoom !== drag.orig.room;
      if (ch) setDConf(drag);
      setDrag(null);
    }
    setHdrDrag(null);
  };

  const confDrag = (nci, nco, npid, nr) => {
    const confs = findConflicts(reservations, npid, nr, nci, nco, dConf.id);
    if (confs.length > 0) {
      setDConf((d) => ({ ...d, dragConflicts: confs }));
      return;
    }
    if (onUpdateRes)
      onUpdateRes(dConf.id, {
        checkIn: nci,
        checkOut: nco,
        propertyId: npid,
        room: nr,
      });
    setDConf(null);
  };

  const newCI = dConf?.newCheckIn;
  const newCO = dConf
    ? fmt(
        addDays(
          parseD(dConf.newCheckIn),
          diffDays(dConf.orig.checkIn, dConf.orig.checkOut)
        )
      )
    : null;
  return (
    <div
      onMouseMove={onMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchMove={(e) => {
        e.preventDefault();
        onMove(e);
      }}
      onTouchEnd={() => {
        endDrag();
        if (lpt[0]) {
          clearTimeout(lpt[0]);
          lpt[1](null);
        }
      }}
      style={{ userSelect: 'none' }}
    >
      {/* ESTILOS DE ANIMACIÓN DE PULSO VERDE */}
      <style>{timelineCss}</style>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {/* GRUPO IZQUIERDO: Título y Vistas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h2 style={TITLE}>Calendario</h2>
          <ViewSwitch view="timeline" setView={setCalView} />
        </div>

        {/* GRUPO DERECHO: Navegación de Fechas y Acción Principal */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Navegador de fechas estilo "Píldora Unida" */}
          <div
            style={{
              display: 'flex',
              background: 'var(--fill)',
              borderRadius: 10,
              padding: 2,
              gap: 2,
            }}
          >
            <button
              onClick={() => setOffset((s) => s - 7)}
              aria-label="7 días antes"
              style={NAV_BTN}
            >
              <Icon name="chevL" size={16} strokeWidth={2.5} />7d
            </button>
            <button
              onClick={() => {
                setOffset(-2);
                document.getElementById('calendario-scroll')?.scrollTo({ left: 0, behavior: 'smooth' });
              }}
              style={{ ...NAV_BTN, background: 'var(--card)', color: 'var(--acc)', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,.12)' }}
            >
              Hoy
            </button>
            <button
              onClick={() => setOffset((s) => s + 7)}
              aria-label="7 días después"
              style={NAV_BTN}
            >
              7d<Icon name="chev" size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Botón de Acción Principal */}
          {onQuote && <QuoteButton onClick={onQuote} style={{ marginRight: 6, borderRadius: 10 }} />}
          <button onClick={() => onAddRes()} style={ADD_BTN}>
              <Icon name="plus" size={16} strokeWidth={2.5} />
              Reserva
            </button>
        </div>
      </div>
      <div
        id="calendario-scroll"  // <--- ¡AGREGAMOS ESTO!
        style={{
          overflowX: 'auto',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--shadow)',
          background: 'var(--card)',
          cursor: drag ? 'grabbing' : hdrDrag ? 'grabbing' : 'grab',
        }}
      >
        <div
          ref={(el) => setGridEl(el)}
          style={{ minWidth: LABEL + COL * NCOLS, position: 'relative' }}
          onMouseDown={(e) => {
            e.preventDefault();
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            setHdrDrag({ startX: cx, startOffset: offset });
          }}
          onTouchStart={(e) => {
            const cx = e.touches[0].clientX;
            setHdrDrag({ startX: cx, startOffset: offset });
          }}
        >
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--line)',
              position: 'sticky',
              top: 0,
              zIndex: 20,
              background: 'var(--inset)',
              cursor: hdrDrag ? 'grabbing' : 'grab',
              touchAction: 'none',
            }}
          >
            <div
              style={{
                width: LABEL,
                flexShrink: 0,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--ink-2)',
                borderRight: '1px solid var(--line)',
                cursor: 'default',
                position: 'sticky',
                left: 0,
                background: 'var(--inset)',
                zIndex: 30,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              Itzé
            </div>
            {days.map((d, i) => {
              const it = fmt(d) === fmt(TODAY),
                dow = d.getDay();
              const isPast = parseD(fmt(d)) < parseD(fmt(TODAY)); 
              
              return (
                <div
                  key={i}
                  style={{
                    width: COL,
                    flexShrink: 0,
                    padding: '5px 2px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--line)',
                    background: it ? 'var(--c-DBEAFE)' : getCellBg(d),
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      color: it ? 'var(--acc)' : isPast ? 'var(--handle)' : 'var(--mut)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {DAYS[dow]}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: it ? 800 : 500,
                      color: it
                    ? 'var(--acc)'
                    : isPast
                    ? 'var(--mut)'
                    : dow === 0 || dow === 6
                    ? 'var(--c-8B5CF6)' 
                    : 'var(--ink-2)',
                    }}
                  >
                    {d.getDate()}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: it ? 'var(--acc)' : isPast ? 'var(--handle)' : 'var(--mut)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {MONTHS[d.getMonth()]}
                  </div>
                </div>
              );
            })}
          </div>
          {rows.map((row, ri) => {
            const ilp = ri === 0 || rows[ri - 1].prop.id !== row.prop.id;
            const ilast =
              ri === rows.length - 1 || rows[ri + 1].prop.id !== row.prop.id;
            const pst = PS[row.prop._status] || PS.libre;
            const rk =
              row.type === 'room'
                ? `${row.prop.id}-${row.room.id}`
                : row.prop.id;
            const blocks = getBlocks(row);
            const ghost = drag && drag.currentRowIdx === ri ? drag : null;
            return (
              <div
                key={rk}
                style={{
                  display: 'flex',
                  borderBottom: ilast
                    ? '2px solid var(--handle)'
                    : '1px solid var(--line)',
                  position: 'relative',
                  height: ROW,
                }}
              >
               <div
                  style={{
                    width: LABEL,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    borderRight: '1px solid var(--line)',
                    background: row.type === 'room' ? 'var(--c-FAFAFA)' : 'var(--c-F3F4F6)',
                    zIndex: 25,
                    position: 'sticky',
                    left: 0,
                    borderLeft: `3px solid ${row.prop.color}`,
                  }}
                >
                  {row.type === 'room' ? (
                    <div style={{ width: '100%' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: 'var(--ink)',
                          }}
                        >
                          {row.room.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--c-C4C4C4)',
                            fontWeight: 600,
                          }}
                        >
                          ≤{row.room.maxGuests}p
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--ink)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 130,
                        }}
                      >
                        {row.prop.emoji} {row.prop.name}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: pst.color,
                        }}
                      >
                        {pst.label}
                      </span>
                    </div>
                  )}
                </div>
                {days.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      width: COL,
                      flexShrink: 0,
                      height: '100%',
                      borderRight: '1px solid var(--line)',
                      background:
                        fmt(d) === fmt(TODAY) ? 'var(--c-DBEAFE)' : getCellBg(d),
                      cursor: hdrDrag ? 'grabbing' : 'cell',
                    }}
                    onDoubleClick={() => {
                      if (!drag && !hdrDrag) onAddRes(row.prop.id, fmt(d), row.type === 'room' ? { room: row.room.id } : null);
                    }}
                    onTouchEnd={(e) => {
                      if (drag || hdrDrag) return;
                      const n = Date.now();
                      if (
                        e.currentTarget._lt &&
                        n - e.currentTarget._lt < 350
                      ) {
                        e.preventDefault();
                        onAddRes(row.prop.id, fmt(d), row.type === 'room' ? { room: row.room.id } : null);
                        e.currentTarget._lt = 0;
                      } else {
                        e.currentTarget._lt = n;
                      }
                    }}
                  />
                ))}
                {ghost && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      height: ROW - SH * 3 - 10,
                      left: LABEL + ghost.currentCol * COL + 2,
                      width: ghost.width * COL - 4,
                      borderRadius: 6,
                      background: 'rgba(59,130,246,.2)',
                      border: '2px dashed var(--acc)',
                      zIndex: 6,
                      pointerEvents: 'none',
                    }}
                  />
                )}
                {blocks.map((r) => {
                  const bc = BLOCK_COLORS[r.status] || BLOCK_COLORS.por_llegar;
                  const alerts = getAlerts(r);
                  const H = ROW - 12; 
                  const W = Math.max(4, r.pxR - r.pxL - 4);
                  const isDrag = drag && drag.id === r.id;
                  const cid = `c${r.id}`;
                  const tx = (r.cutLeft ? 8 : Math.min(14, W * 0.2) + 4) + (r.source === 'Booking' ? 4 : 0);

                  // Forma de la barra: puntas en ángulo (entra a la tarde, sale a la mañana) con las esquinas
                  // redondeadas, como el resto de la app. Si la estadía sigue fuera de lo que se ve, ese lado
                  // queda recto y sin redondear: la barra continúa.
                  const D = Math.min(10, W * 0.25);
                  const RAD = 6;
                  const shape = roundedShape([
                    [r.cutLeft ? 0 : D, 0, r.cutLeft ? 0 : RAD],
                    [W, 0, r.cutRight ? 0 : RAD],
                    [r.cutRight ? W : W - D, H, r.cutRight ? 0 : RAD],
                    [0, H, r.cutLeft ? 0 : RAD],
                  ]);

                  return (
                    <div
                      key={r.id}
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: LABEL + r.pxL + 2,
                        width: W,
                        zIndex: isDrag ? 10 : (highlightStatus && r.status === highlightStatus ? 15 : 4),
                        opacity: isDrag ? 0.3 : 1,
                        touchAction: 'none',
                        animation: (highlightStatus && r.status === highlightStatus) ? 'pulseGreenBlock 0.8s ease-in-out 3' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isMobile)
                          setTooltip({ r, x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onMouseMove={(e) => {
                        if (!isMobile && tooltip)
                          setTooltip({ r, x: e.clientX, y: e.clientY });
                      }}
                      onMouseDown={(e) => {
                        setTooltip(null);
                        startDrag(e, r, row);
                      }}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        const fakeEvent = { touches: [touch] };
                        
                        const timer = setTimeout(() => {
                          startDrag(fakeEvent, r, row);
                          if (window.navigator && window.navigator.vibrate) {
                            window.navigator.vibrate(40);
                          }
                        }, 400); 
                        lpt[1](timer);
                      }}
                      onTouchMove={() => {
                        if (lpt[0]) {
                          clearTimeout(lpt[0]);
                          lpt[1](null);
                        }
                      }}
                      onClick={(e) => {
                        if (!drag) {
                          e.stopPropagation();
                          onClickRes(r);
                        }
                      }}
                    >
                      {W > 12 ? (
                        <svg
                          width={W}
                          height={H}
                          style={{
                            display: 'block',
                            overflow: 'visible',
                            cursor: 'grab',
                            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.18))',
                          }}
                        >
                          <defs>
                            <clipPath id={cid}>
                              <path d={shape} />
                            </clipPath>
                          </defs>
                          <rect
                            x={0}
                            y={0}
                            width={W}
                            height={H}
                            fill={bc.bg}
                            clipPath={`url(#${cid})`}
                          />
                          {/* Avisos (saldo, etc.): rayitas abajo, dentro de la forma de la barra */}
                          {alerts.map((a, i) => (
                            <rect
                              key={a.key}
                              x={0}
                              y={H - SH * (alerts.length - i)}
                              width={W}
                              height={SH}
                              fill={a.color}
                              clipPath={`url(#${cid})`}
                            />
                          ))}
                          {/* NUEVA MARCA VISUAL BOOKING EN PC */}
                          {r.source === 'Booking' && (
                            <rect
                              x={0}
                              y={0}
                              width={r.cutLeft ? 6 : 8}
                              height={H}
                              fill="var(--acc)"
                              clipPath={`url(#${cid})`}
                            />
                          )}
                          <text
                            x={tx}
                            y={H / 2 - 2}
                            fontSize={10}
                            fontWeight={700}
                            fill={bc.text}
                            style={{
                              fontFamily: 'system-ui,sans-serif',
                              pointerEvents: 'none',
                            }}
                            clipPath={`url(#${cid})`}
                          >
                                                        {r.grupoId ? ic('link', 11, { marginRight: 3 }) : ''}
                            {r.guestName}
                            {r.companions?.length > 0
                              ? ` +${r.companions.length}`
                              : ''}{' '}
                            ({srcShort(r.source)})
                          </text>
                          <text
                            x={tx}
                            y={H / 2 + 10}
                            fontSize={8}
                            fontWeight={600}
                            fill={bc.text}
                            style={{
                              fontFamily: 'system-ui,sans-serif',
                              pointerEvents: 'none',
                              opacity: 0.85,
                            }}
                            clipPath={`url(#${cid})`}
                          >
                            {fmtD(r.checkIn).slice(0, 5)} al{' '}
                            {fmtD(r.checkOut).slice(0, 5)}
                            {lateHour(r) ? <> · {ic('clock', 10, { marginRight: 2 })}Late {lateHour(r)}</> : ''}
                          </text>
                        </svg>
                      ) : (
                        <div
                          style={{
                            height: H,
                            borderRadius:
                              alerts.length > 0 ? '8px 8px 0 0' : '8px',
                            background: bc.bg,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            paddingLeft: 8,
                            overflow: 'hidden',
                            boxShadow: '0 1px 3px rgba(0,0,0,.15)',
                            cursor: 'grab',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: bc.text,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              pointerEvents: 'none',
                              lineHeight: '1.2',
                            }}
                          >
                                                        {r.grupoId ? ic('link', 11, { marginRight: 3 }) : ''}
                            {r.guestName} ({srcShort(r.source)})
                          </span>
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 600,
                              color: bc.text,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              pointerEvents: 'none',
                              lineHeight: '1.2',
                              opacity: 0.85,
                            }}
                          >
                            {fmtD(r.checkIn).slice(0, 5)} al{' '}
                            {fmtD(r.checkOut).slice(0, 5)}
                            {lateHour(r) ? <> · {ic('clock', 10, { marginRight: 2 })}Late {lateHour(r)}</> : ''}
                          </span>
                        </div>
                      )}
                     {alerts.length > 0 && W <= 12 && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                width: '100%',
                                overflow: 'hidden',
                                borderRadius: '0 0 4px 4px',
                              }}
                            >
                              {alerts.map((a) => (
                                <div
                                  key={a.key}
                                  style={{ height: SH, background: a.color }}
                                />
                              ))}
                            </div>
                          )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--mut)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Estado:
        </span>
        {Object.entries(BLOCK_COLORS).map(([k, v]) => (
          <div
            key={k}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: 'var(--ink-2)',
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: v.bg,
              }}
            />
            {RS[k]?.label || k}
          </div>
        ))}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--mut)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Alertas:
        </span>
        {ALERTS.map((a) => (
          <div
            key={a.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: 'var(--ink-2)',
            }}
          >
            <div
              style={{
                width: 18,
                height: 4,
                borderRadius: 2,
                background: a.color,
              }}
            />
            {a.label}
          </div>
        ))}
      </div>
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(tooltip.x + 12, window.innerWidth - 220),
            top: Math.max(tooltip.y - 10, 8),
            zIndex: 500,
            background: 'var(--tip)',
            borderRadius: 10,
            padding: '10px 14px',
            boxShadow: '0 8px 32px rgba(0,0,0,.35)',
            width: 210,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 13,
              color: '#fff',
              marginBottom: 4,
            }}
          >
            {tooltip.r.guestName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,.5)',
              marginBottom: 8,
            }}
          >
            {fmtD(tooltip.r.checkIn)} → {fmtD(tooltip.r.checkOut)} ·{' '}
            {diffDays(tooltip.r.checkIn, tooltip.r.checkOut)}n
          </div>
          {tooltip.r.grupoId && (() => {
            const g = groupOf(reservations, tooltip.r);
            return g.length > 1 ? (
              <div style={{ fontSize: 11, fontWeight: 800, color: '#5EEAD4', marginBottom: 8 }}>
                {ic('link', 12)}Grupo de {g.length}: {g.map((m) => m.room).filter(Boolean).join(', ')}
              </div>
            ) : null;
          })()}
          {lateHour(tooltip.r) && (
            <div style={{ fontSize: 11, fontWeight: 800, color: '#A5B4FC', marginBottom: 8 }}>
              {ic('clock', 12)}Late check-out {lateHour(tooltip.r)}
            </div>
          )}
          {getAlerts(tooltip.r).map((a) => (
            <div
              key={a.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 11,
                marginBottom: 3,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: a.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: 'rgba(255,255,255,.85)', fontWeight: 600 }}>
                {a.label}
              </span>
              {a.key === 'saldo' && (
                <span
                  style={{
                    color: '#FCA5A5',
                    marginLeft: 'auto',
                    fontWeight: 700,
                  }}
                >
                  {currency(tooltip.r.totalAmount - tooltip.r.paid)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <AnimatePresence>{dConf && (
        <Backdrop key="dConf"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <PopCard
            style={{
              background: 'var(--card)',
              borderRadius: 22,
              width: '100%',
              maxWidth: 400,
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '22px 22px 4px', textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--mut)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Confirmar cambio
              </div>
              <div style={{ fontSize: 19, fontWeight: 'var(--w-title)', color: 'var(--ink)' }}>
                {dConf.guestName}
              </div>
            </div>
            <div style={{ padding: '20px 22px' }}>
              {dConf.newCheckIn !== dConf.orig.checkIn && (
                <div
                  style={{
                    background: 'var(--inset)',
                    borderRadius: 'var(--r-item)',
                    padding: '12px 14px',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--mut)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Cambio de fechas
                  </div>
                  <div style={{ fontSize: 14.5 }}>
                    Entrada {dayShort(dConf.orig.checkIn)} →{' '}
                    <b style={{ color: 'var(--acc)' }}>{dayShort(newCI)}</b>
                  </div>
                </div>
              )}
              {(dConf.newPropId !== dConf.orig.propId ||
                dConf.newRoom !== dConf.orig.room) && (
                <div
                  style={{
                    background: 'var(--inset)',
                    borderRadius: 'var(--r-item)',
                    padding: '12px 14px',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--mut)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Cambio de habitación
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {dConf.orig.room || dConf.orig.propId} →{' '}
                    <b style={{ color: 'var(--acc)' }}>
                      {dConf.newRoom || dConf.newPropId}
                    </b>
                  </div>
                </div>
              )}
              {dConf.dragConflicts?.length > 0 && (
                <div
                  style={{
                    background: 'var(--c-FEF2F2)',
                    borderRadius: 12,
                    padding: '10px 12px',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      color: 'var(--red)',
                      marginBottom: 4,
                    }}
                  >
                    {ic('warning', 14)}Conflicto en el destino
                  </div>
                  {dConf.dragConflicts.map((r) => (
                    <div key={r.id} style={{ fontSize: 11, color: 'var(--c-7F1D1D)' }}>
                      {r.guestName} · {dayShort(r.checkIn)} → {dayShort(r.checkOut)}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => setDConf(null)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'var(--fill)',
                    border: 'none',
                    borderRadius: 'var(--r-field)',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--ink)',
                    fontSize: 14,
                  }}
                >
                  Cancelar
                </button>
                {(!dConf.dragConflicts || !dConf.dragConflicts.length) && (
                  <button
                    onClick={() =>
                      confDrag(newCI, newCO, dConf.newPropId, dConf.newRoom)
                    }
                    style={{
                      flex: 2,
                      padding: '11px',
                      background: 'var(--c-10B981)',
                      border: 'none',
                      borderRadius: 10,
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#fff',
                      fontSize: 14,
                    }}
                  >
                    {ic('tick', 15)}Confirmar
                  </button>
                )}
              </div>
            </div>
          </PopCard>
        </Backdrop>
      )}</AnimatePresence>
    </div>
  );
}
