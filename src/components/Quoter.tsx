/* eslint-disable */
// @ts-nocheck
import { useState, useMemo, useEffect } from 'react';
import { ROOMS, ROOM_DESC } from '../lib/constants';
import { roomTypeOf, quoteStay } from '../lib/rates';
import { findConflicts } from '../lib/reservations';
import { TODAY, fmt, addDays, parseD, diffDays, currency, DAYS } from '../lib/dates';
import { RangeCalendar } from './ui/RangeCalendar';
import { money } from './reservations/QuoteInfo';
import {
  nightAvailability,
  busyText,
  noRoomText,
  nightsText,
  stayPlan,
  planText,
  nearestDates,
  lateOutOn,
  entradaSalida,
  roomNum,
} from '../lib/availability';

// ── COTIZAR (sin crear reserva) ───────────────────────────────────────────────
// Se arma paso a paso: fechas → personas → en qué habitación va cada uno → cotización
// (subtotal por habitación, total, por persona y promedio por persona por noche) y texto para WhatsApp.

const msgMoney = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return '$' + v.toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
};
const noches = (n) => (n === 1 ? '1 noche' : `${n} noches`);
const personas = (n) => (n === 1 ? '1 persona' : `${n} personas`);
export { listY } from '../lib/availability';
export const HOSTEL_CAPACITY = ROOMS.reduce((s, r) => s + r.maxGuests, 0);

// Texto para WhatsApp: termina en los precios (la charla sigue según venga)
// items con nightsLabel (cambio de habitación): "• Habitación con … (3 personas), las noches del vie 27 y sáb 28 de nov: $X"
export function quoteMessage({ checkIn, checkOut, guests, items, total }) {
  const n = diffDays(checkIn, checkOut);
  const lines = [`¡Hola! Para ${personas(guests)}, ${entradaSalida(checkIn, checkOut)} (${noches(n)}):`];
  items.forEach((it) =>
    lines.push(
      `• Habitación con ${it.desc} (${personas(it.guests)})${it.nightsLabel ? `, ${it.nightsLabel}` : ''}: ${msgMoney(it.total)}`
    )
  );
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
  const [planOn, setPlanOn] = useState(false); // cotizar con cambio de habitación
  const [calKey, setCalKey] = useState(0); // para que el almanaque salte al mes de las fechas sugeridas
  const n = checkIn && checkOut ? diffDays(checkIn, checkOut) : 0;
  useEffect(() => setPlanOn(false), [checkIn, checkOut, guests]);

  // Disponibilidad noche por noche (una habitación ocupada alguna noche no suma lugar)
  const av = useMemo(() => nightAvailability(allRes, checkIn, checkOut, n), [allRes, checkIn, checkOut, n]);
  const rooms = ROOMS.map((r) => ({
    ...r,
    desc: ROOM_DESC[r.id] || r.name,
    busyNights: av.busy[r.id] || [],
    free: n > 0 && (av.busy[r.id] || []).length === 0,
  }));
  const freeRooms = rooms.filter((r) => r.free);
  const busyRooms = rooms.filter((r) => !r.free);
  const freeCap = freeRooms.reduce((s, r) => s + r.maxGuests, 0);
  const full = n > 0 && freeCap === 0;
  const esosDias = n === 1 ? 'Ese día' : 'Esos días';
  const short = n > 0 && guests > freeCap; // no entran todos sin mudarse
  // ¿Se puede con cambio de habitación? (habitaciones fijas + las personas que se mudan)
  const plan = useMemo(() => (short ? stayPlan(av, guests) : null), [short, av, guests]);
  const planActive = planOn && !!plan;
  // Fechas más cercanas (antes y después) con lugar para todos sin mudarse
  const near = useMemo(
    () => (short ? nearestDates(allRes, checkIn, n, guests, fmt(TODAY)) : null),
    [short, allRes, checkIn, n, guests]
  );
  const goDates = (ci) => {
    setCheckIn(ci);
    setCheckOut(fmt(addDays(parseD(ci), n)));
    setCalKey((k) => k + 1);
  };
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

  const mkItem = (room, g, ci, co, nightsLabel = '') => {
    const t = roomTypeOf(room);
    const q = t ? quoteStay(ci, co, t.id, g, tarifas) : null;
    return { key: room + ci, room, desc: ROOM_DESC[room] || room, guests: g, q, total: q && !q.missing ? q.total : null, from: ci, to: co, nightsLabel };
  };
  const items = planActive
    ? [
        ...plan.fixed.map((f) => mkItem(f.room, f.guests, checkIn, checkOut)),
        ...plan.segs.map((sg) => mkItem(sg.room, plan.moving, sg.from, sg.to, nightsText(sg.nights))),
      ]
    : ROOMS.filter((r) => distFree[r.id]).map((r) => mkItem(r.id, distFree[r.id], checkIn, checkOut));
  const missingPrice = items.some((it) => it.total === null);
  const total = items.reduce((s, it) => s + (it.total || 0), 0);
  const done = n > 0 && (planActive || left === 0) && items.length > 0 && !missingPrice;

  // Para la reserva: una o varias (con cambio de habitación, una tras otra con los mismos datos del huésped)
  const reserveQueue = () => {
    if (!planActive) {
      return [
        {
          initial: { propertyId: 'hostel', checkIn, checkOut, room: items[0].room, totalGuests: items[0].guests },
          rooms: items.length > 1 ? items.map((it) => ({ room: it.room, guests: it.guests })) : null,
        },
      ];
    }
    const notes = `🔀 Cambio de habitación: ${planText(plan, guests)}.`;
    const q = [];
    if (plan.fixed.length)
      q.push({
        initial: { propertyId: 'hostel', checkIn, checkOut, room: plan.fixed[0].room, totalGuests: plan.fixed[0].guests, notes },
        rooms: plan.fixed.length > 1 ? plan.fixed : null,
      });
    plan.segs.forEach((sg) =>
      q.push({
        initial: { propertyId: 'hostel', checkIn: sg.from, checkOut: sg.to, room: sg.room, totalGuests: plan.moving, notes },
        rooms: null,
      })
    );
    return q;
  };

  // Habitación recomendada para las personas que faltan ubicar: la que menos lugar desperdicia
  // (así quedan libres las grandes para grupos); si ninguna alcanza, la más grande. Empate: la más barata.
  const priceFor = (room, g) => {
    const t = roomTypeOf(room);
    const q = t ? quoteStay(checkIn, checkOut, t.id, g, tarifas) : null;
    return q && !q.missing ? q.total : null;
  };
  const unassigned = freeRooms.filter((r) => !distFree[r.id]);
  let rec = null;
  let recText = '';
  if (left > 0 && unassigned.length > 1) {
    const fitting = unassigned.filter((r) => r.maxGuests >= left);
    const byPrice = (a, b) => (priceFor(a.id, Math.min(left, a.maxGuests)) || 0) - (priceFor(b.id, Math.min(left, b.maxGuests)) || 0);
    if (fitting.length) {
      rec = [...fitting].sort((a, b) => a.maxGuests - b.maxGuests || byPrice(a, b))[0];
      const biggest = Math.max(...unassigned.map((r) => r.maxGuests));
      recText =
        rec.maxGuests < biggest
          ? `⭐ Para ${personas(left)} te conviene la habitación ${roomNum(rec.id)}: así quedan libres las más grandes para grupos.`
          : `⭐ Para ${personas(left)} te conviene la habitación ${roomNum(rec.id)}.`;
    } else {
      rec = [...unassigned].sort((a, b) => b.maxGuests - a.maxGuests || byPrice(a, b))[0];
      recText = `⭐ Te conviene empezar por la habitación ${roomNum(rec.id)}: entran ${rec.maxGuests}.`;
    }
  }
  const msg = done ? quoteMessage({ checkIn, checkOut, guests, items, total }) : '';
  const cap1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);

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
        key={calKey}
        checkIn={checkIn}
        checkOut={checkOut}
        onChange={(ci, co) => {
          setCheckIn(ci);
          setCheckOut(co);
        }}
      />
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF', margin: '8px 0 16px' }}>
        {n > 0 ? `${cap1(entradaSalida(checkIn, checkOut))} · ${noches(n)}` : 'Elegí la fecha de salida'}
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
            <div style={warnBox}>{noRoomText(av, checkIn, checkOut, guests)}</div>
          ) : guests > freeCap ? (
            <div style={warnBox}>
              {esosDias} solo nos queda lugar para {personas(freeCap)}. {busyText(av, busyRooms.map((r) => r.id))}
              {plan ? ` Pero ${planText(plan, guests)}.` : ''}
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 12, color: '#6B7280' }}>
              {busyRooms.length
                ? `${esosDias} tenemos lugar para hasta ${personas(freeCap)}.`
                : `${esosDias} tenemos todo el hostel libre: lugar para hasta ${personas(freeCap)}.`}
            </div>
          )}

          {short && (plan || (near && (near.before || near.after)) || (near && !near.before && !near.after)) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {plan && (
                <button
                  type="button"
                  onClick={() => setPlanOn(!planOn)}
                  style={{
                    minHeight: 42,
                    borderRadius: 9,
                    fontFamily: 'inherit',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    background: planOn ? '#7C3AED' : '#fff',
                    color: planOn ? '#fff' : '#7C3AED',
                    border: '1.5px solid #7C3AED',
                  }}
                >
                  {planOn ? '✓ Cotizando con el cambio de habitación' : '🔀 Cotizar con este cambio de habitación'}
                </button>
              )}
              {near && (near.before || near.after) && (
                <div style={{ fontSize: 12.5, color: '#374151', marginTop: 4 }}>
                  📅 Fechas más cercanas con lugar para {guests === 1 ? 'esa persona' : `las ${guests} personas`}
                  {plan ? ' sin cambiar de habitación' : ''}:
                </div>
              )}
              {near &&
                [near.after, near.before]
                  .filter(Boolean)
                  .sort((a, b) => Math.abs(diffDays(checkIn, a)) - Math.abs(diffDays(checkIn, b)))
                  .map((ci) => (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => goDates(ci)}
                      style={{
                        minHeight: 40,
                        borderRadius: 9,
                        fontFamily: 'inherit',
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: 'pointer',
                        background: '#fff',
                        color: '#2563EB',
                        border: '1.5px solid #93C5FD',
                        textAlign: 'left',
                        padding: '8px 12px',
                      }}
                    >
                      {cap1(entradaSalida(ci, fmt(addDays(parseD(ci), n))))} →
                    </button>
                  ))}
              {near && !near.before && !near.after && !plan && (
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  No encontré fechas cercanas (3 meses antes o después) con lugar para {personas(guests)} juntas.
                </div>
              )}
            </div>
          )}

          {planActive && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: '#5B21B6', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, padding: '8px 10px' }}>
              🔀 Cotizando con cambio de habitación. Al reservar se cargan una tras otra, con los mismos datos del huésped.
            </div>
          )}

          {!full && !planActive && (
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
          {recText && (
            <div style={{ fontSize: 12.5, color: '#92400E', background: '#FFFBEB', borderRadius: 8, padding: '7px 10px', marginBottom: 8 }}>
              {recText}
            </div>
          )}
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
                      {(() => {
                        const k = g || Math.min(Math.max(left, 1), r.maxGuests);
                        const pr = priceFor(r.id, k);
                        const late = lateOutOn(allRes, r.id, checkIn);
                        return (
                          <span style={{ display: 'block', fontSize: 11.5, marginTop: 2 }}>
                            {pr !== null && (
                              <span style={{ color: '#374151', fontWeight: 600 }}>
                                {g ? currency(pr) : `${personas(k)}: ${currency(pr)}`}
                              </span>
                            )}
                            {rec && rec.id === r.id && (
                              <span style={{ marginLeft: 6, color: '#B45309', fontWeight: 800 }}>⭐ Recomendada</span>
                            )}
                            {late && (
                              <span style={{ display: 'block', color: '#4F46E5', fontWeight: 700 }}>
                                🕐 Libre desde las {late}: ese día sale alguien con late check-out
                              </span>
                            )}
                          </span>
                        );
                      })()}
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

          {busyRooms.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {busyRooms.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 10,
                    background: '#F9FAFB',
                    border: '1px dashed #E5E7EB',
                    fontSize: 12,
                    color: '#9CA3AF',
                  }}
                >
                  <b style={{ color: '#6B7280' }}>{r.id}</b> ·{' '}
                  {r.busyNights.length === n ? `ocupada ${n === 1 ? 'ese día' : 'esos días'}` : `ocupada ${nightsText(r.busyNights)}`}
                </div>
              ))}
            </div>
          )}

          </>
          )}

          {/* 4 · Cotización */}
          {items.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={lbl}>4 · Cotización</div>
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                {items.map((it) => (
                  <div key={it.key} style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <div style={{ fontSize: 13, color: '#111' }}>
                        <b>{it.room}</b> · {personas(it.guests)}
                        {it.nightsLabel && <span style={{ color: '#7C3AED', fontSize: 12 }}> · {it.nightsLabel}</span>}
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
                    onClick={() => onReserve({ queue: reserveQueue() })}
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
