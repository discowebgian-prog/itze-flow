/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from 'react';
import { Badge } from '../components/ui/Badge';
import { PROPS } from '../lib/constants';
import { TODAY, fmt, parseD, addDays, currency } from '../lib/dates';
import dashboardCss from '../styles/dashboard.css?raw';
import { LateBadge } from '../components/ui/LateBadge';
import { CountUp } from '../components/ui/Motion';
import { greeting, daySummary, nowMerida } from '../lib/voice';
import { buildGuestDB } from '../lib/guests';
import { birthdayList, wasGreeted } from '../lib/guestMessages';
import { PushButton } from '../components/ui/PushButton';
import { Icon } from '../components/ui/Icon';

  // Grupo tipo lista de iPhone: tarjeta blanca con título y filas separadas por una línea fina.
// Va afuera de Dashboard para que no se rearme en cada render (si no, las filas repiten la animación de entrada).
const Group = ({ id = undefined, title, icon, col, children }) => (
  <section id={id} className="ui-card" style={{ padding: '4px 0 6px', marginBottom: 16 }}>
    <h3 style={{ margin: '14px 16px 6px', fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={20} color={col} strokeWidth={2.2} />
      {title}
    </h3>
    {children}
  </section>
);


// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export function Dashboard({
  user,
  reservations,
  properties,
  propStatus,
  setPropStatus,
  onGoTo,
  deviceName = '',
  onWho = null,
  decisions = [],
}) {
  // Saludo y resumen del día: se actualizan solos cada minuto (la hora cambia el saludo)
  const [now, setNow] = useState(nowMerida);
  useEffect(() => {
    const t = setInterval(() => setNow(nowMerida()), 60000);
    return () => clearInterval(t);
  }, []);
  const hello = greeting(deviceName, now);
  const summary = daySummary(reservations, now);
  // 🎂 Cumpleaños de hoy de todos los huéspedes (también los que ya se fueron), sin los ya saludados
  const bdAll = birthdayList(Object.values(buildGuestDB(reservations, decisions)), now);
  const bdToday = bdAll.filter((x) => x.next.days === 0);
  const bdWeek = bdAll.filter((x) => x.next.days <= 7).length;
  const bdPending = bdToday.filter((x) => !wasGreeted(x.g.key, now));

  // --- NUEVO: Controladores de Animación ---
  const [pulseIn, setPulseIn] = useState(false);
  const [pulseOut, setPulseOut] = useState(false);

  const isNow = (r) => parseD(r.checkIn) <= TODAY && TODAY < parseD(r.checkOut);
  const active = reservations.filter(isNow);
  const ciToday = reservations.filter((r) => r.checkIn === fmt(TODAY));
  const coToday = reservations.filter((r) => r.checkOut === fmt(TODAY));
  const pending = reservations.filter(
    (r) => r.status !== 'cancelada' && r.paid < r.totalAmount
  );
  // Booking que ya llegaron (o debían llegar) y todavía no tienen la tarjeta virtual cobrada.
  // Solo los últimos 30 días, para no arrastrar reservas viejas.
  const vccLimit = fmt(addDays(TODAY, -30));
  const vccPending = reservations
    .filter(
      (r) =>
        r.source === 'Booking' &&
        r.status !== 'cancelada' &&
        r.checkIn <= fmt(TODAY) &&
        r.checkOut >= vccLimit &&
        r.paymentMethod !== 'vcc' &&
        Number(r.paid) < Number(r.totalAmount)
    )
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  
  // Tarjetas del panorama: ícono en círculo de color, número grande, nombre corto (como Itzé Limpieza)
  const tiles = [
    {
      label: 'Llegan hoy',
      val: ciToday.length,
      icon: 'rin',
      col: '#2563EB',
      bg: '#EFF6FF',
      onClick: () => {
        const el = document.getElementById('seccion-ingresos');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Apagamos y prendemos la animación (3 pulsos de 0,8 s después de bajar)
        setPulseIn(false);
        setTimeout(() => setPulseIn(true), 300);
        setTimeout(() => setPulseIn(false), 2700);
      },
    },
    {
      label: 'Se van hoy',
      val: coToday.length,
      icon: 'rout',
      col: '#EA580C',
      bg: '#FFF7ED',
      onClick: () => {
        const el = document.getElementById('seccion-salidas');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setPulseOut(false);
        setTimeout(() => setPulseOut(true), 300);
        setTimeout(() => setPulseOut(false), 2700);
      },
    },
    {
      label: 'En casa',
      val: active.length,
      icon: 'bed',
      col: '#059669',
      bg: '#ECFDF5',
      onClick: () => onGoTo('calendario', 'hospedado'),
    },
    {
      label: 'Saldos pendientes',
      val: pending.length,
      icon: 'wallet',
      col: '#DC2626',
      bg: '#FEF2F2',
      onClick: () => {
        onGoTo('finanzas');
        setTimeout(() => {
          const el = document.getElementById('seccion-saldos-pendientes');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 400);
      },
    },
    {
      label: 'Ocupación de hoy',
      val: (() => {
        const totalRooms = properties.reduce((s, p) => s + (p.rooms || 1), 0);
        return totalRooms > 0 ? Math.round((active.length / totalRooms) * 100) + '%' : '0%';
      })(),
      icon: 'chart',
      col: '#7C3AED',
      bg: '#F5F3FF',
      onClick: () => onGoTo('calendario', 'hospedado'),
    },
  ];

  // Ícono en círculo de color (tarjetas y filas)
  const dot = (icon, col, bg, size = 34) => (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: col,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.53)} strokeWidth={2.2} />
    </span>
  );

  const roomChip = (room) =>
    room ? (
      <span style={{ background: 'var(--fill)', color: 'var(--ink-2)', padding: '2px 7px', borderRadius: 7, fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>
        {room}
      </span>
    ) : null;

  const row = (r, liI, { icon, col, bg, pulse, after = null, right = null, sub = null }) => {
    const prop = PROPS.find((p) => p.id === r.propertyId);
    return (
      <div
        className="li-in dash-row"
        key={r.id + icon}
        onClick={() => onGoTo('abrir_reserva', r)}
        style={{ '--i': liI, animation: pulse || undefined }}
      >
        {dot(icon, col, bg, 32)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>{r.guestName}</span>
            {roomChip(r.room)}
            {after}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 2 }}>{sub ?? prop?.name}</div>
        </div>
        {right ?? <Badge status={r.status} />}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Pulsos al tocar "Llegan hoy" / "Se van hoy" y filas de las listas */}
      <style>{dashboardCss}</style>

      <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h2 style={{ margin: '4px 0 0', fontSize: 30, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em', lineHeight: 1.15 }}>
          {/* "Buen día, Gian ☀️": tocar el nombre cambia quién usa el aparato */}
          {deviceName && onWho ? (
            <>
              {hello.text.replace(`, ${deviceName}`, ', ')}
              <span
                onClick={onWho}
                title="Cambiar quién usa este aparato"
                style={{ cursor: 'pointer', textDecoration: 'underline dotted var(--handle)', textUnderlineOffset: 7, textDecorationThickness: 2 }}
              >
                {deviceName}
              </span>
            </>
          ) : (
            hello.text
          )}{' '}
          <span style={{ fontSize: 26 }}>{hello.emoji}</span>
        </h2>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--mut)' }}>
          {(() => {
            const t = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            return t.charAt(0).toUpperCase() + t.slice(1);
          })()}
        </div>
        {/* El día en palabras (1 a 3 renglones) */}
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {summary.map((line, i) => (
            <div
              key={line}
              className="li-in"
              style={{ '--i': i, fontSize: 15.5, color: i === 0 ? 'var(--ink)' : 'var(--ink-2)', fontWeight: i === 0 ? 600 : 500, lineHeight: 1.4 }}
            >
              {line}
            </div>
          ))}
        </div>
        {/* Cumpleaños: siempre está; si alguien cumple hoy y no lo saludamos, se marca como aviso */}
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
          <button
            className={bdPending.length ? 'tap pop-in' : 'tap'}
            onClick={() => onGoTo('huespedes', { birthday: bdPending.length === 1 ? bdPending[0].g.key : bdToday.length === 1 ? bdToday[0].g.key : null })}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 20,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: bdPending.length ? '#FCE7F3' : 'var(--card)',
              color: bdPending.length ? '#9D174D' : 'var(--ink-2)',
              boxShadow: bdPending.length ? 'none' : 'var(--shadow)',
            }}
          >
            <Icon name="cake" size={16} color={bdPending.length ? '#DB2777' : '#EC4899'} />
            {bdPending.length === 1
              ? `Hoy cumple ${bdPending[0].g.name} · Saludar`
              : bdPending.length > 1
              ? `Hoy cumplen ${bdPending.length} huéspedes · Saludar`
              : bdToday.length
              ? 'Cumpleaños · ya saludados ✓'
              : bdWeek
              ? `Cumpleaños · ${bdWeek} esta semana`
              : 'Cumpleaños'}
            {bdPending.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 9,
                  background: 'var(--red)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: '18px',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              >
                {bdPending.length}
              </span>
            )}
          </button>
          {/* Activar avisos con la app cerrada (desaparece cuando ya están activos en este aparato) */}
          {deviceName && <PushButton deviceName={deviceName} />}
        </div>
      </div>

      {/* Panorama del día */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(112px,1fr))',
          gap: 10,
          marginBottom: 20,
        }}
      >
        {tiles.map((k, liI) => (
          <div
            className="li-in tap dash-tile"
            key={k.label}
            onClick={k.onClick}
            style={{ '--i': liI }}
          >
            {dot(k.icon, k.col, k.bg, 36)}
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em', marginTop: 10, lineHeight: 1 }}>
              <CountUp value={k.val} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--mut)', marginTop: 4, fontWeight: 600, lineHeight: 1.25 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Llegan hoy */}
      {ciToday.length > 0 && (
        <Group id="seccion-ingresos" title={`Llegan hoy (${ciToday.length})`} icon="rin" col="#2563EB">
          {ciToday.map((r, liI) =>
            row(r, liI, { icon: 'rin', col: '#2563EB', bg: '#EFF6FF', pulse: pulseIn ? 'pulseBlue 0.8s ease-in-out 3' : null })
          )}
        </Group>
      )}

      {/* Se van hoy */}
      {coToday.length > 0 && (
        <Group id="seccion-salidas" title={`Se van hoy (${coToday.length})`} icon="rout" col="#EA580C">
          {coToday.map((r, liI) =>
            row(r, liI, { icon: 'rout', col: '#EA580C', bg: '#FFF7ED', pulse: pulseOut ? 'pulseOrange 0.8s ease-in-out 3' : null, after: <LateBadge r={r} /> })
          )}
        </Group>
      )}

      {/* VCC de Booking por cobrar */}
      {vccPending.length > 0 && (
        <Group title={`VCC de Booking por cobrar (${vccPending.length})`} icon="card" col="#1E40AF">
          {vccPending.map((r, liI) =>
            row(r, liI, {
              icon: 'card',
              col: '#1E40AF',
              bg: '#DBEAFE',
              sub: 'Llegó el ' + parseD(r.checkIn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
              right: (
                <span style={{ fontWeight: 800, fontSize: 15, color: '#1E40AF', whiteSpace: 'nowrap' }}>
                  {currency(Number(r.totalAmount) - Number(r.paid))}
                </span>
              ),
            })
          )}
        </Group>
      )}
    </div>
  );
}
