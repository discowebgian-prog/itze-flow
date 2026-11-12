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
import { weeklyPattern } from '../lib/paxStrategy';
import { SeViene } from '../components/SeViene';
import { Icon } from '../components/ui/Icon';
import { MOV_TIPO, movTexto, cuando } from '../lib/movimientos';

  // Grupo tipo lista de iPhone: tarjeta blanca con título y filas separadas por una línea fina.
// Va afuera de Dashboard para que no se rearme en cada render (si no, las filas repiten la animación de entrada).
const Group = ({ id = undefined, title, icon, col, children }) => (
  <section id={id} className="ui-card" style={{ padding: '4px 0 6px', marginBottom: 16 }}>
    <h3 style={{ margin: '14px 16px 6px', fontSize: 18, fontWeight: 'var(--w-title)', letterSpacing: '-.01em', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
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
  movs = [], // movimientos de Mary sin ver (paso 9)
  onOpenMov = null,
  onVisto = null,
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
  // Se van mañana (para organizar la limpieza y los check-outs del día siguiente)
  const coTomorrow = reservations.filter(
    (r) => r.checkOut === fmt(addDays(TODAY, 1)) && r.status !== 'cancelada' && r.status !== 'finalizada'
  );
  // Estrategia de la semana: patrón de las últimas 4 semanas (cambia los lunes)
  const pattern = weeklyPattern(reservations);
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
      col: 'var(--c-2563EB)',
      bg: 'var(--c-EFF6FF)',
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
      col: 'var(--c-EA580C)',
      bg: 'var(--c-FFF7ED)',
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
      col: 'var(--c-059669)',
      bg: 'var(--c-ECFDF5)',
      onClick: () => onGoTo('calendario', 'hospedado'),
    },
    {
      label: 'Saldos pendientes',
      val: pending.length,
      icon: 'wallet',
      col: 'var(--c-DC2626)',
      bg: 'var(--c-FEF2F2)',
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
      col: 'var(--c-7C3AED)',
      bg: 'var(--c-F5F3FF)',
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
        <h2 style={{ margin: '4px 0 0', fontSize: 30, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: 'var(--ls-title)', lineHeight: 1.15 }}>
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
              background: bdPending.length ? 'var(--c-FCE7F3)' : 'var(--card)',
              color: bdPending.length ? 'var(--c-9D174D)' : 'var(--ink-2)',
              boxShadow: bdPending.length ? 'none' : 'var(--shadow)',
            }}
          >
            <Icon name="cake" size={16} color={bdPending.length ? 'var(--c-DB2777)' : 'var(--c-EC4899)'} />
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
            <div style={{ fontSize: 28, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: 'var(--ls-title)', marginTop: 10, lineHeight: 1 }}>
              <CountUp value={k.val} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--mut)', marginTop: 4, fontWeight: 600, lineHeight: 1.25 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Movimientos de Mary sin ver: arriba de todo lo del día, hasta que se marcan "Visto" */}
      {movs.length > 0 && (
        <section className="ui-card pop-in" style={{ padding: '4px 0 6px', marginBottom: 16 }}>
          <h3 style={{ margin: '14px 16px 6px', fontSize: 18, fontWeight: 'var(--w-title)', letterSpacing: '-.01em', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="sparkles" size={20} color="var(--acc-limpieza)" strokeWidth={2.2} />
            <span style={{ flex: 1 }}>Movimientos de Mary</span>
            <span style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, background: 'var(--red)', color: '#fff', fontSize: 12.5, fontWeight: 800, lineHeight: '22px', textAlign: 'center', boxSizing: 'border-box' }}>
              {movs.length}
            </span>
          </h3>
          {movs.map((m, liI) => {
            const tp = MOV_TIPO[m.tipo] || MOV_TIPO.edicion;
            const tx = movTexto(m);
            return (
              <div className="li-in dash-row" key={m.id} style={{ '--i': liI }} onClick={() => onOpenMov && onOpenMov(m)}>
                {dot(tp.icon, tp.col, tp.bg, 32)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', lineHeight: 1.3 }}>{tx.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.35 }}>{tx.body}</div>
                  <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>{cuando(m.creado_en)}</div>
                </div>
                <button
                  className="tap"
                  onClick={(e) => { e.stopPropagation(); onVisto && onVisto([m.id]); }}
                  style={{ flexShrink: 0, border: 'none', borderRadius: 18, padding: '8px 14px', minHeight: 36, background: 'var(--acc-soft)', color: 'var(--acc)', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <Icon name="check" size={15} strokeWidth={2.6} /> Visto
                </button>
              </div>
            );
          })}
          {movs.length > 1 && (
            <div style={{ padding: '8px 16px 6px', textAlign: 'right' }}>
              <button
                className="tap"
                onClick={() => onVisto && onVisto(movs.map((m) => m.id))}
                style={{ border: 'none', background: 'none', color: 'var(--acc)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '6px 0' }}
              >
                Marcar todos como vistos
              </button>
            </div>
          )}
        </section>
      )}

      {/* Llegan hoy */}
      {ciToday.length > 0 && (
        <Group id="seccion-ingresos" title={`Llegan hoy (${ciToday.length})`} icon="rin" col="var(--c-2563EB)">
          {ciToday.map((r, liI) =>
            row(r, liI, { icon: 'rin', col: 'var(--c-2563EB)', bg: 'var(--c-EFF6FF)', pulse: pulseIn ? 'pulseBlue 0.8s ease-in-out 3' : null })
          )}
        </Group>
      )}

      {/* Se van hoy */}
      {coToday.length > 0 && (
        <Group id="seccion-salidas" title={`Se van hoy (${coToday.length})`} icon="rout" col="var(--c-EA580C)">
          {coToday.map((r, liI) =>
            row(r, liI, { icon: 'rout', col: 'var(--c-EA580C)', bg: 'var(--c-FFF7ED)', pulse: pulseOut ? 'pulseOrange 0.8s ease-in-out 3' : null, after: <LateBadge r={r} /> })
          )}
        </Group>
      )}

      {/* Se van mañana */}
      {coTomorrow.length > 0 && (
        <Group title={`Se van mañana (${coTomorrow.length})`} icon="rout" col="var(--c-EA580C)">
          {coTomorrow.map((r, liI) =>
            row(r, liI, { icon: 'rout', col: 'var(--c-EA580C)', bg: 'var(--c-FFF7ED)', after: <LateBadge r={r} /> })
          )}
        </Group>
      )}

            {/* Se viene: radar de eventos (solo si ya se corrió supabase/eventos.sql) */}
      <SeViene reservations={reservations} canEdit onGoTo={onGoTo} isMobile={typeof window !== 'undefined' && window.innerWidth < 769} />

      {/* VCC de Booking por cobrar */}
      {vccPending.length > 0 && (
        <Group title={`VCC de Booking por cobrar (${vccPending.length})`} icon="card" col="var(--c-1E40AF)">
          {vccPending.map((r, liI) =>
            row(r, liI, {
              icon: 'card',
              col: 'var(--c-1E40AF)',
              bg: 'var(--c-DBEAFE)',
              sub: 'Llegó el ' + parseD(r.checkIn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
              right: (
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--c-1E40AF)', whiteSpace: 'nowrap' }}>
                  {currency(Number(r.totalAmount) - Number(r.paid))}
                </span>
              ),
            })
          )}
        </Group>
      )}

      {/* Estrategia de la semana */}
      {pattern.length > 0 && (
        <Group title="Estrategia de la semana" icon="target" col="var(--c-4F46E5)">
          {pattern.map((it, i) => (
            <div key={i} className="li-in ui-row" style={{ '--i': i, alignItems: 'flex-start', gap: 10, cursor: 'default' }}>
              <span style={{ color: 'var(--c-4F46E5)', flexShrink: 0, marginTop: 2 }}>
                <Icon name={it.icon} size={18} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{it.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45, marginTop: 2 }}>{it.text}</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--mut)', padding: '6px 16px 8px' }}>
            Según quiénes vinieron las últimas 4 semanas. Se renueva cada lunes.
          </div>
        </Group>
      )}
    </div>
  );
}
