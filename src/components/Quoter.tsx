/* eslint-disable */
// @ts-nocheck
import { useState, useMemo } from 'react';
import { ROOMS, ROOM_DESC } from '../lib/constants';
import { roomTypeOf, quoteStay } from '../lib/rates';
import { findConflicts } from '../lib/reservations';
import { TODAY, fmt, addDays, parseD, diffDays, currency, DAYS } from '../lib/dates';
import { RangeCalendar } from './ui/RangeCalendar';
import { money } from './reservations/QuoteInfo';

// ── COTIZAR (sin crear reserva) ───────────────────────────────────────────────
// Se arma paso a paso: fechas → personas → en qué habitación va cada uno → cotización
// (subtotal por habitación, total, por persona y promedio por persona por noche) y texto para WhatsApp.

const dayLabel = (s) => {
  const d = parseD(s);
  return `${DAYS[d.getDay()].toLowerCase()} ${d.getDate()}/${d.getMonth() + 1}`;
};
const msgMoney = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return '$' + v.toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
};
const noches = (n) => (n === 1 ? '1 noche' : `${n} noches`);
const personas = (n) => (n === 1 ? '1 persona' : `${n} personas`);
// "P1", "P1 y P4", "P1, P2 y P4"
export const listY = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`);
export const HOSTEL_CAPACITY = ROOMS.reduce((s, r) => s + r.maxGuests, 0);

// Texto para WhatsApp: termina en los precios (la charla sigue según venga)
export function quoteMessage({ checkIn, checkOut, guests, items, total }) {
  const n = diffDays(checkIn, checkOut);
  const lines = [`¡Hola! Para ${personas(guests)}, del ${dayLabel(checkIn)} al ${dayLabel(checkOut)} (${noches(n)}):`];
  items.forEach((it) => lines.push(`• Habitación con ${it.desc} (${personas(it.guests)}): ${msgMoney(it.total)}`));
  if (items.length > 1 || guests > 1) {
    lines.push(`Total: ${msgMoney(total)}${guests > 1 ? ` (${msgMoney(total / guests)} por persona)` : ''}`);
    lines.push(`Promedio por persona por noche: ${msgMoney(total / guests / n)}`);
  } else {
    lines.push(`Promedio por noche: ${msgMoney(total / n)}`);
  }
  return lines.join('\n');
}

export function Quoter({ allRes = [], tarifas = [], onReserve }) {
  const [checkIn, setCheckIn] = useState(fmt(TODAY));
  const [checkOut, setCheckOut] = useState(fmt(addDays(TODAY, 1)));
  const [guests, setGuests] = useState(2);
  const [dist, setDist] = useState({}); // habitación → personas
  const [openRoom, setOpenRoom] = useState(''); // habitación con el selector desplegado
  const [copied, setCopied] = useState(false);
  const n = checkIn && checkOut ? diffDays(checkIn, checkOut) : 0;

  // Habitaciones libres en esas fechas (una ocupada no suma lugar)
  const rooms = useMemo(
    () =>
      ROOMS.map((r) => ({
        ...r,
        desc: ROOM_DESC[r.id] || r.name,
        free: n > 0 && findConflicts(allRes, 'hostel', r.id, checkIn, checkOut).length === 0,
      })),
    [allRes, checkIn, checkOut, n]
  );
  const freeRooms = rooms.filter((r) => r.free);
  const busyRooms = rooms.filter((r) => !r.free);
  const freeCap = freeRooms.reduce((s, r) => s + r.maxGuests, 0);
  const full = n > 0 && freeCap === 0;
  // ¿Está lleno todas las noches, solo alguna, o ninguna? (cambia el mensaje)
  const fullNights = useMemo(() => {
    if (!full) return 0;
    let c = 0;
    for (let i = 0; i < n; i++) {
      const a = fmt(addDays(parseD(checkIn), i));
      const b = fmt(addDays(parseD(checkIn), i + 1));
      if (!ROOMS.some((r) => findConflicts(allRes, 'hostel', r.id, a, b).length === 0)) c++;
    }
    return c;
  }, [full, n, checkIn, allRes]);
  const esosDias = n === 1 ? 'Ese día' : 'Esos días';
  const warnBox = {
    marginTop: 8,
    fontSize: 13,
    fontWeight: 600,
    color: '#92400E',
    background: '#FFFBEB',
    border: '1px solid #FCD34D',
    borderRadius: 8,
    padding: '9px 11px',
    lineHeight: 1.4,
  };

  // Si una habitación elegida quedó ocupada con las fechas nuevas, sale de la distribución
  const distFree = {};
  Object.keys(dist).forEach((id) => {
    if (dist[id] > 0 && freeRooms.some((r) => r.id === id)) distFree[id] = dist[id];
  });
  const placed = Object.values(distFree).reduce((s, v) => s + v, 0);
  const left = guests - placed;

  const items = ROOMS.filter((r) => distFree[r.id]).map((r) => {
    const t = roomTypeOf(r.id);
    const q = t ? quoteStay(checkIn, checkOut, t.id, distFree[r.id], tarifas) : null;
    return { room: r.id, desc: ROOM_DESC[r.id] || r.name, guests: distFree[r.id], q, total: q && !q.missing ? q.total : null };
  });
  const missingPrice = items.some((it) => it.total === null);
  const total = items.reduce((s, it) => s + (it.total || 0), 0);
  const done = n > 0 && left === 0 && items.length > 0 && !missingPrice;
  const msg = done ? quoteMessage({ checkIn, checkOut, guests, items, total }) : '';

  const setRoomGuests = (id, g) => {
    setDist((d) => {
      const x = { ...d };
      if (g > 0) x[id] = g;
      else delete x[id];
      return x;
    });
    setOpenRoom('');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = msg;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e2) {}
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lbl = { fontSize: 11, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 };
  const stepBtn = (disabled) => ({
    width: 44,
    height: 44,
    borderRadius: 10,
    border: '1.5px solid #E5E7EB',
    background: disabled ? '#F9FAFB' : '#fff',
    color: disabled ? '#D1D5DB' : '#111',
    fontSize: 22,
    fontWeight: 800,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
  });

  return (
    <div>
      {/* 1 · Fechas */}
      <div style={lbl}>1 · Fechas</div>
      <RangeCalendar
        checkIn={checkIn}
        checkOut={checkOut}
        onChange={(ci, co) => {
          setCheckIn(ci);
          setCheckOut(co);
        }}
      />
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF', margin: '8px 0 16px' }}>
        {n > 0 ? `${dayLabel(checkIn)} → ${dayLabel(checkOut)} · ${noches(n)}` : 'Elegí la fecha de salida'}
      </div>

      {n > 0 && (
        <>
          {/* 2 · Personas */}
          <div style={lbl}>2 · Personas</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" disabled={guests <= 1} onClick={() => setGuests((g) => Math.max(1, g - 1))} style={stepBtn(guests <= 1)}>
              −
            </button>
            <div style={{ fontSize: 26, fontWeight: 800, minWidth: 40, textAlign: 'center', color: '#111' }}>{guests}</div>
            <button
              type="button"
              disabled={guests >= HOSTEL_CAPACITY}
              onClick={() => setGuests((g) => Math.min(HOSTEL_CAPACITY, g + 1))}
              style={stepBtn(guests >= HOSTEL_CAPACITY)}
            >
              +
            </button>
          </div>
          {full ? (
            <div style={warnBox}>
              {fullNights === n
                ? `${esosDias} el hostel está completo y no tenemos disponibilidad.`
                : fullNights > 0
                ? 'Alguna de esas noches el hostel está completo, así que no tenemos una habitación libre para toda la estadía. Probá con otras fechas.'
                : 'No nos queda una misma habitación libre para todas esas noches. Probá con otras fechas.'}
            </div>
          ) : guests > freeCap ? (
            <div style={warnBox}>
              {esosDias} solo nos queda lugar para {personas(freeCap)}.
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 12, color: '#6B7280' }}>
              {busyRooms.length
                ? `${esosDias} tenemos lugar para hasta ${personas(freeCap)}.`
                : `${esosDias} tenemos todo el hostel libre: lugar para hasta ${personas(freeCap)}.`}
            </div>
          )}

          {!full && (
          <>
          {/* 3 · Distribución */}
          <div style={{ ...lbl, marginTop: 18 }}>3 · ¿En qué habitación van?</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              marginBottom: 8,
              color: left === 0 ? '#047857' : left > 0 ? '#B45309' : '#B91C1C',
            }}
          >
            {left === 0
              ? '✓ ¡Listo! Todos tienen lugar.'
              : left > 0
              ? `Falta ubicar a ${personas(left)}`
              : `Hay ${personas(-left)} de más: quitá en alguna habitación.`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {freeRooms.map((r) => {
              const g = distFree[r.id] || 0;
              const isOpen = openRoom === r.id;
              const canAdd = left > 0 || g > 0;
              const maxHere = Math.min(r.maxGuests, g + Math.max(0, left));
              return (
                <div
                  key={r.id}
                  style={{
                    border: `1.5px solid ${g ? '#2563EB' : isOpen ? '#93C5FD' : '#E5E7EB'}`,
                    background: g ? '#EFF6FF' : '#fff',
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    disabled={!canAdd}
                    onClick={() => setOpenRoom(isOpen ? '' : r.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '10px 12px',
                      background: 'none',
                      border: 'none',
                      cursor: canAdd ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      opacity: canAdd ? 1 : 0.5,
                    }}
                  >
                    <span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>{r.id}</span>
                      <span style={{ fontSize: 12, color: '#6B7280' }}> · {r.desc} · hasta {r.maxGuests}</span>
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: g ? '#1D4ED8' : '#9CA3AF', whiteSpace: 'nowrap' }}>
                      {g ? `${personas(g)} ✏️` : isOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 12px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                        ¿Cuántas personas van en {r.id}?
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Array.from({ length: r.maxGuests }, (_, i) => i + 1).map((k) => {
                          const dis = k > maxHere;
                          return (
                            <button
                              key={k}
                              type="button"
                              disabled={dis}
                              onClick={() => setRoomGuests(r.id, k)}
                              style={{
                                minWidth: 44,
                                minHeight: 40,
                                borderRadius: 8,
                                fontFamily: 'inherit',
                                fontWeight: 800,
                                fontSize: 14,
                                cursor: dis ? 'default' : 'pointer',
                                background: g === k ? '#2563EB' : dis ? '#F9FAFB' : '#fff',
                                color: g === k ? '#fff' : dis ? '#D1D5DB' : '#111',
                                border: `1.5px solid ${g === k ? '#2563EB' : '#E5E7EB'}`,
                              }}
                            >
                              {k}
                            </button>
                          );
                        })}
                        {g > 0 && (
                          <button
                            type="button"
                            onClick={() => setRoomGuests(r.id, 0)}
                            style={{
                              minHeight: 40,
                              padding: '0 12px',
                              borderRadius: 8,
                              fontFamily: 'inherit',
                              fontWeight: 700,
                              fontSize: 12.5,
                              cursor: 'pointer',
                              background: '#fff',
                              color: '#B91C1C',
                              border: '1.5px solid #FCA5A5',
                            }}
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 4 · Cotización */}
          {items.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={lbl}>4 · Cotización</div>
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                {items.map((it) => (
                  <div key={it.room} style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <div style={{ fontSize: 13, color: '#111' }}>
                        <b>{it.room}</b> · {personas(it.guests)}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>
                        {it.total === null ? 'Sin precio' : currency(it.total)}
                      </div>
                    </div>
                    {it.q && !it.q.missing && (
                      <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2, lineHeight: 1.45 }}>
                        {it.q.lines.map((l) => `${l.count} × ${currency(l.price)}`).join(' + ')}
                        {it.q.extraGuests > 0 &&
                          ` + ${it.q.extraGuests === 1 ? '1 persona extra' : `${it.q.extraGuests} personas extra`} ${currency(it.q.extraTotal)}`}
                      </div>
                    )}
                  </div>
                ))}
                {done ? (
                  <div style={{ padding: '12px', background: '#F8FAFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>Total</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#111' }}>
                        {currency(total)}
                        {guests > 1 && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}> ({money(total / guests)} por persona)</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12.5, color: '#6B7280', marginTop: 4 }}>
                      Promedio por persona por noche: <b style={{ color: '#111' }}>{money(Math.round((total / guests / n) * 100) / 100)}</b>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 12px', fontSize: 12.5, color: '#92400E', background: '#FFFBEB' }}>
                    {missingPrice
                      ? 'Una de las habitaciones no tiene precio cargado en Tarifas para esas fechas.'
                      : left > 0
                      ? 'Cuando ubiques a todos, te muestro el total.'
                      : 'Ajustá las habitaciones y te muestro el total.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {done && (
            <div style={{ marginTop: 14 }}>
              <div style={lbl}>Mensaje para WhatsApp</div>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: '#14532D',
                }}
              >
                {msg}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={copy}
                  style={{
                    flex: 2,
                    minHeight: 44,
                    borderRadius: 9,
                    fontFamily: 'inherit',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: 'pointer',
                    background: copied ? '#047857' : '#16A34A',
                    color: '#fff',
                    border: 'none',
                  }}
                >
                  {copied ? '✓ Copiado' : '📋 Copiar para WhatsApp'}
                </button>
                {onReserve && (
                  <button
                    type="button"
                    onClick={() =>
                      onReserve({
                        initial: { propertyId: 'hostel', checkIn, checkOut, room: items[0].room, totalGuests: items[0].guests },
                        rooms: items.length > 1 ? items.map((it) => ({ room: it.room, guests: it.guests })) : null,
                      })
                    }
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 9,
                      fontFamily: 'inherit',
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: 'pointer',
                      background: '#fff',
                      color: '#2563EB',
                      border: '1.5px solid #2563EB',
                    }}
                  >
                    ➕ Reservar
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
                Ojo: si entró una reserva de Booking que todavía no aparece en el calendario, esa habitación puede figurar libre.
              </div>
            </div>
          )}
          </>
          )}
        </>
      )}
    </div>
  );
}

// Botón "🧮 Cotizar" (va al lado de cada "+ Reserva" / "+ Nueva")
export function QuoteButton({ onClick, compact = false, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Cotizar"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: compact ? '7px 10px' : '7px 12px',
        background: '#fff',
        border: '1.5px solid #2563EB',
        borderRadius: 8,
        color: '#2563EB',
        fontFamily: 'inherit',
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      🧮{compact ? '' : ' Cotizar'}
    </button>
  );
}
