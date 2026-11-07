/* eslint-disable */
// @ts-nocheck
import { useState, useMemo } from 'react';
import { ROOMS, ROOM_DESC } from '../lib/constants';
import { ROOM_TYPES, roomTypeOf, quoteStay } from '../lib/rates';
import { findConflicts } from '../lib/reservations';
import { TODAY, fmt, addDays, parseD, diffDays, currency, DAYS } from '../lib/dates';
import { RangeCalendar } from './ui/RangeCalendar';
import { money } from './reservations/QuoteInfo';

// ── COTIZAR (sin crear reserva) ───────────────────────────────────────────────
// Fechas + personas → precio de cada tipo de habitación con el tarifario, qué habitaciones
// están libres, y un texto listo para pegar en WhatsApp (solo libres que alcanzan).

const dayLabel = (s) => {
  const d = parseD(s);
  return `${DAYS[d.getDay()].toLowerCase()} ${d.getDate()}/${d.getMonth() + 1}`;
};
const msgMoney = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const noches = (n) => (n === 1 ? '1 noche' : `${n} noches`);

// Texto para WhatsApp: termina en los precios (la charla sigue según venga)
export function quoteMessage({ checkIn, checkOut, guests, options }) {
  const n = diffDays(checkIn, checkOut);
  const head = `¡Hola! Para ${guests === 1 ? '1 persona' : `${guests} personas`}, del ${dayLabel(checkIn)} al ${dayLabel(
    checkOut
  )} (${noches(n)}):`;
  const lines = options.map((o) =>
    o.count === 1
      ? `• Habitación con ${o.desc}: ${msgMoney(o.total)}`
      : `• ${o.count} habitaciones con ${o.desc}: ${msgMoney(o.total)} c/u`
  );
  return [head, ...lines].join('\n');
}

export function Quoter({ allRes = [], tarifas = [], onReserve }) {
  const [checkIn, setCheckIn] = useState(fmt(TODAY));
  const [checkOut, setCheckOut] = useState(fmt(addDays(TODAY, 1)));
  const [guests, setGuests] = useState(2);
  const [copied, setCopied] = useState(false);
  const n = checkIn && checkOut ? diffDays(checkIn, checkOut) : 0;

  const data = useMemo(() => {
    if (n <= 0) return null;
    const rooms = ROOMS.map((r) => {
      const t = roomTypeOf(r.id);
      const fits = r.maxGuests >= guests;
      const free = findConflicts(allRes, 'hostel', r.id, checkIn, checkOut).length === 0;
      return { ...r, typeId: t?.id, fits, free };
    });
    const types = ROOM_TYPES.map((t) => ({
      ...t,
      q: quoteStay(checkIn, checkOut, t.id, guests, tarifas),
      rooms: rooms.filter((r) => r.typeId === t.id),
    }));
    // Opciones del mensaje: libres que alcanzan, juntas por descripción, en el orden de las habitaciones
    const options = [];
    rooms
      .filter((r) => r.fits && r.free)
      .forEach((r) => {
        const t = types.find((x) => x.id === r.typeId);
        if (!t || !t.q || t.q.missing) return;
        const desc = ROOM_DESC[r.id] || r.name;
        const o = options.find((x) => x.desc === desc && x.total === t.q.total);
        if (o) o.count++;
        else options.push({ desc, total: t.q.total, count: 1 });
      });
    return { types, options };
  }, [checkIn, checkOut, guests, allRes, tarifas, n]);

  const msg = data && data.options.length ? quoteMessage({ checkIn, checkOut, guests, options: data.options }) : '';

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

  return (
    <div>
      <div style={lbl}>Fechas</div>
      <RangeCalendar
        checkIn={checkIn}
        checkOut={checkOut}
        onChange={(ci, co) => {
          setCheckIn(ci);
          setCheckOut(co);
        }}
      />
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF', margin: '8px 0 14px' }}>
        {n > 0 ? `${dayLabel(checkIn)} → ${dayLabel(checkOut)} · ${noches(n)}` : 'Elegí la fecha de salida'}
      </div>

      <div style={lbl}>Personas</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[1, 2, 3, 4, 5, 6].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGuests(g)}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: 8,
              fontFamily: 'inherit',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
              background: guests === g ? '#2563EB' : '#fff',
              color: guests === g ? '#fff' : '#374151',
              border: `1.5px solid ${guests === g ? '#2563EB' : '#E5E7EB'}`,
            }}
          >
            {g}
          </button>
        ))}
      </div>

      {data &&
        data.types.map((t) => {
          const anyFits = t.rooms.some((r) => r.fits);
          const freeFit = t.rooms.filter((r) => r.fits && r.free);
          const q = t.q;
          return (
            <div
              key={t.id}
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 10,
                background: anyFits && freeFit.length ? '#fff' : '#F9FAFB',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: '#111' }}>{t.label}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: anyFits ? '#111' : '#9CA3AF' }}>
                  {!anyFits ? `No admite ${guests} personas` : !q ? '—' : q.missing ? 'Sin precio' : currency(q.total)}
                </div>
              </div>
              {anyFits && q && !q.missing && (
                <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 3, lineHeight: 1.45 }}>
                  {q.lines.map((l) => `${l.count} × ${currency(l.price)}`).join(' · ')}
                  {q.varied ? ` · promedio ${money(q.avg)}/noche` : ''}
                  {q.extraGuests > 0 &&
                    ` · + ${q.extraGuests === 1 ? '1 persona extra' : `${q.extraGuests} personas extra`} ${currency(q.extraTotal)}`}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {t.rooms.map((r) => {
                  const ok = r.fits && r.free;
                  return ok && onReserve ? (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onReserve({ propertyId: 'hostel', room: r.id, checkIn, checkOut, totalGuests: guests })}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 7,
                        fontFamily: 'inherit',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                        background: '#ECFDF5',
                        color: '#047857',
                        border: '1.5px solid #6EE7B7',
                      }}
                    >
                      ✓ {r.id} libre · ➕ Reservar
                    </button>
                  ) : (
                    <span
                      key={r.id}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 600,
                        background: '#F3F4F6',
                        color: '#9CA3AF',
                        border: '1px solid #E5E7EB',
                      }}
                    >
                      {r.id} {!r.fits ? `· hasta ${r.maxGuests}` : '· ocupada'}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}

      {data && (
        <div style={{ marginTop: 14 }}>
          <div style={lbl}>Mensaje para WhatsApp</div>
          {msg ? (
            <>
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
              <button
                type="button"
                onClick={copy}
                style={{
                  width: '100%',
                  marginTop: 8,
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
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: '#92400E', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 10px' }}>
              No hay habitaciones libres para {guests === 1 ? '1 persona' : `${guests} personas`} en esas fechas.
            </div>
          )}
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
            Libres según las reservas cargadas: lo de Booking que todavía no entró por iCal no figura.
          </div>
        </div>
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
