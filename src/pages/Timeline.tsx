/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { ROOMS, srcShort, RS, PS, BLOCK_COLORS, ALERTS, getAlerts } from '../lib/constants';
import { TODAY, fmt, fmtD, addDays, diffDays, parseD, currency, MONTHS, DAYS } from '../lib/dates';
import { findConflicts, lateHour } from '../lib/reservations';
import { groupOf } from '../lib/groups';
import { TimelineMobile } from './TimelineMobile';
import timelineCss from '../styles/timeline.css?raw';
import { QuoteButton } from '../components/Quoter';
import { AnimatePresence } from 'motion/react';
import { Backdrop, PopCard } from '../components/ui/Motion';

// ── TIMELINE DESKTOP ──────────────────────────────────────────────────────────
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
          <h2
            style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}
          >
            Calendario
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                background: '#F3F4F6',
                borderRadius: 9,
                padding: 3,
                gap: 2,
              }}
            >
              <button
                onClick={() => setCalView('lista')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  background: '#fff',
                  color: '#1E40AF',
                  boxShadow: '0 1px 3px rgba(0,0,0,.1)',
                }}
              >
                📋 Lista
              </button>
              <button
                onClick={() => setCalView('timeline')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: '#9CA3AF',
                }}
              >
                📅 Timeline
              </button>
            </div>
            {onQuote && <QuoteButton onClick={onQuote} style={{ marginRight: 6, padding: '5px 12px' }} />}
            <button
              onClick={() => onAddRes()}
              style={{
                padding: '6px 14px',
                background: '#3B82F6',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + Reserva
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
    if (fmt(d) === fmt(TODAY)) return '#EFF6FF'; 
    if (isPast) return '#F3F4F6'; 
    if (dow === 0 || dow === 6) return '#F5F3FF';
    return '#fff';
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
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#111', letterSpacing: -0.5 }}>
            Calendario
          </h2>
          <div
            style={{
              display: 'flex',
              background: '#F1F5F9',
              borderRadius: 10,
              padding: 4,
              gap: 2,
            }}
          >
            <button
              onClick={() => setCalView('lista')}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                background: 'transparent',
                color: '#64748B',
                transition: 'all 0.2s'
              }}
            >
              📋 Lista
            </button>
            <button
              onClick={() => setCalView('timeline')}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                background: '#fff',
                color: '#1E40AF',
                boxShadow: '0 2px 4px rgba(0,0,0,.04)',
                transition: 'all 0.2s'
              }}
            >
              📅 Timeline
            </button>
          </div>
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
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(0,0,0,.03)',
            }}
          >
            <button
              onClick={() => setOffset((s) => s - 7)}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderRight: '1px solid #E2E8F0',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: '#475569',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              ← 7d
            </button>
            <button
              onClick={() => {
                setOffset(-2);
                document.getElementById('calendario-scroll')?.scrollTo({ left: 0, behavior: 'smooth' });
              }}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRight: '1px solid #E2E8F0',
                background: '#F0F9FF',
                color: '#2563EB',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 800,
                fontFamily: 'inherit',
              }}
            >
              Hoy
            </button>
            <button
              onClick={() => setOffset((s) => s + 7)}
              style={{
                padding: '8px 14px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: '#475569',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              7d →
            </button>
          </div>

          {/* Botón de Acción Principal */}
          {onQuote && <QuoteButton onClick={onQuote} style={{ marginRight: 6, borderRadius: 10 }} />}
          <button
            onClick={() => onAddRes()}
            style={{
              padding: '8px 16px',
              background: '#3B82F6',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 2px 6px rgba(59,130,246,.25)',
              transition: 'transform 0.1s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            + Reserva
          </button>
        </div>
      </div>
      <div
        id="calendario-scroll"  // <--- ¡AGREGAMOS ESTO!
        style={{
          overflowX: 'auto',
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          background: '#fff',
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
              borderBottom: '1px solid #E5E7EB',
              position: 'sticky',
              top: 0,
              zIndex: 20,
              background: '#F9FAFB',
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
                color: '#374151',
                borderRight: '1px solid #E5E7EB',
                cursor: 'default',
                position: 'sticky',
                left: 0,
                background: '#F9FAFB',
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
                    borderRight: '1px solid #F0F0F0',
                    background: it ? '#DBEAFE' : getCellBg(d),
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      color: it ? '#1E40AF' : isPast ? '#D1D5DB' : '#9CA3AF',
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
                    ? '#1E40AF'
                    : isPast
                    ? '#9CA3AF'
                    : dow === 0 || dow === 6
                    ? '#8B5CF6' 
                    : '#374151',
                    }}
                  >
                    {d.getDate()}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: it ? '#1E40AF' : isPast ? '#D1D5DB' : '#9CA3AF',
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
                    ? '2px solid #D1D5DB'
                    : '1px solid #F0F0F0',
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
                    borderRight: '1px solid #E5E7EB',
                    background: row.type === 'room' ? '#FAFAFA' : '#F3F4F6',
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
                            color: '#111',
                          }}
                        >
                          {row.room.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: '#C4C4C4',
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
                          color: '#111',
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
                      borderRight: '1px solid #F0F0F0',
                      background:
                        fmt(d) === fmt(TODAY) ? '#DBEAFE' : getCellBg(d),
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
                      border: '2px dashed #3B82F6',
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
                  const tx = (r.cutLeft ? 8 : 10) + (r.source === 'Booking' ? 4 : 0);

                  // Barra con esquinas redondeadas, como el resto de la app. Si la estadía sigue fuera de lo
                  // que se ve (empieza antes o termina después), ese lado queda recto: la barra continúa.
                  const RAD = Math.min(10, H / 2, W / 2);
                  const rl = r.cutLeft ? 0 : RAD;
                  const rr = r.cutRight ? 0 : RAD;
                  const shape = `M${rl},0 H${W - rr} A${rr},${rr} 0 0 1 ${W},${rr} V${H - rr} A${rr},${rr} 0 0 1 ${W - rr},${H} H${rl} A${rl},${rl} 0 0 1 0,${H - rl} V${rl} A${rl},${rl} 0 0 1 ${rl},0 Z`;

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
                              fill="#1E40AF"
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
                            {r.source === 'Booking' ? '🔵 ' : ''}
                            {r.grupoId ? '🔗 ' : ''}
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
                            {lateHour(r) ? ` · 🕐 Late ${lateHour(r)}` : ''}
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
                            {r.source === 'Booking' ? '🔵 ' : ''}
                            {r.grupoId ? '🔗 ' : ''}
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
                            {lateHour(r) ? ` · 🕐 Late ${lateHour(r)}` : ''}
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
            color: '#9CA3AF',
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
              color: '#374151',
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
            color: '#9CA3AF',
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
              color: '#374151',
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
            background: '#1E293B',
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
                🔗 Grupo de {g.length}: {g.map((m) => m.room).filter(Boolean).join(', ')}
              </div>
            ) : null;
          })()}
          {lateHour(tooltip.r) && (
            <div style={{ fontSize: 11, fontWeight: 800, color: '#A5B4FC', marginBottom: 8 }}>
              🕐 Late check-out {lateHour(tooltip.r)}
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
              background: '#fff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 400,
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
              overflow: 'hidden',
            }}
          >
            <div style={{ background: '#1E293B', padding: '18px 22px' }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.5)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Confirmar cambio
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>
                {dConf.guestName}
              </div>
            </div>
            <div style={{ padding: '20px 22px' }}>
              {dConf.newCheckIn !== dConf.orig.checkIn && (
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: '#9CA3AF',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Cambio de fechas
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {fmtD(dConf.orig.checkIn)} →{' '}
                    <b style={{ color: '#1E40AF' }}>{fmtD(newCI)}</b>
                  </div>
                </div>
              )}
              {(dConf.newPropId !== dConf.orig.propId ||
                dConf.newRoom !== dConf.orig.room) && (
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: '#9CA3AF',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Cambio de habitación
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {dConf.orig.propId} {dConf.orig.room} →{' '}
                    <b style={{ color: '#1E40AF' }}>
                      {dConf.newPropId} {dConf.newRoom}
                    </b>
                  </div>
                </div>
              )}
              {dConf.dragConflicts?.length > 0 && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 8,
                    padding: '10px 12px',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      color: '#DC2626',
                      marginBottom: 4,
                    }}
                  >
                    ⚠️ Conflicto en el destino
                  </div>
                  {dConf.dragConflicts.map((r) => (
                    <div key={r.id} style={{ fontSize: 11, color: '#7F1D1D' }}>
                      {r.guestName} · {fmtD(r.checkIn)} → {fmtD(r.checkOut)}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => setDConf(null)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 10,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#555',
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
                      background: '#10B981',
                      border: 'none',
                      borderRadius: 10,
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#fff',
                      fontSize: 14,
                    }}
                  >
                    ✓ Confirmar
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
