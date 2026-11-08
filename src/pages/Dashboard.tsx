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
  
  return (
    <div>
      {/* NUEVO: ESTILOS DE ANIMACIÓN DE PULSO */}
      <style>{dashboardCss}</style>

      <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
          }}
        >
          {now.toLocaleDateString('es-MX', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })}
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 900,
            color: '#0F172A',
            letterSpacing: -0.6,
          }}
        >
          {/* "Buen día, Gian ☀️": tocar el nombre cambia quién usa el aparato */}
          {deviceName && onWho ? (
            <>
              {hello.text.replace(`, ${deviceName}`, ', ')}
              <span
                onClick={onWho}
                title="Cambiar quién usa este aparato"
                style={{ cursor: 'pointer', textDecoration: 'underline dotted #CBD5E1', textUnderlineOffset: 6, textDecorationThickness: 2 }}
              >
                {deviceName}
              </span>
            </>
          ) : (
            hello.text
          )}{' '}
          <span style={{ fontSize: 22 }}>{hello.emoji}</span>
        </h2>
        {/* El día en palabras (1 a 3 renglones) */}
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {summary.map((line, i) => (
            <div
              key={line}
              className="li-in"
              style={{ '--i': i, fontSize: 14.5, color: i === 0 ? '#334155' : '#64748B', fontWeight: i === 0 ? 600 : 500, lineHeight: 1.4 }}
            >
              {line}
            </div>
          ))}
        </div>
        {/* 🎂 Botoncito de cumpleaños: siempre está; si alguien cumple hoy y no lo saludamos, se marca como aviso */}
        <div style={{ marginTop: 10 }}>
          <button
            className={bdPending.length ? 'tap pop-in' : 'tap'}
            onClick={() => onGoTo('huespedes', { birthday: bdPending.length === 1 ? bdPending[0].g.key : bdToday.length === 1 ? bdToday[0].g.key : null })}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 20,
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              border: bdPending.length ? '1.5px solid #DB2777' : '1px solid #E5E7EB',
              background: bdPending.length ? '#FDF2F8' : '#fff',
              color: bdPending.length ? '#9D174D' : '#6B7280',
            }}
          >
            🎂{' '}
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
                  background: '#EF4444',
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
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))',
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: 'Check-ins hoy',
            val: ciToday.length,
            icon: '📥',
            col: '#3B82F6',
            bg: '#EFF6FF',
            onClick: () => {
              const el = document.getElementById('seccion-ingresos');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Apagamos y prendemos la animación
              setPulseIn(false);
              setTimeout(() => setPulseIn(true), 300); // Espera a que baje la pantalla
              setTimeout(() => setPulseIn(false), 2700); // Lo apaga a los 2.4s (3 pulsos de 0.8s)
            }
          },
          {
            label: 'Check-outs hoy',
            val: coToday.length,
            icon: '📤',
            col: '#F59E0B',
            bg: '#FFFBEB',
            onClick: () => {
              const el = document.getElementById('seccion-salidas');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setPulseOut(false);
              setTimeout(() => setPulseOut(true), 300); 
              setTimeout(() => setPulseOut(false), 2700); 
            }
          },
          {
            label: 'En casa',
            val: active.length,
            icon: '🛏️',
            col: '#10B981',
            bg: '#ECFDF5',
            onClick: () => onGoTo('calendario', 'hospedado'),
          },
          {
            label: 'Saldos pend.',
            val: pending.length,
            icon: '💰',
            col: '#EF4444',
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
              return totalRooms > 0 
                ? Math.round((active.length / totalRooms) * 100) + '%' 
                : '0%';
            })(),
            icon: '📊',
            col: '#8B5CF6',
            bg: '#EDE9FE',
            onClick: () => onGoTo('calendario', 'hospedado'),
          },
        ].map((k, liI) => (
          <div className="li-in"
            key={k.label}
            onClick={k.onClick}
            style={{ '--i': liI,
              background: '#fff',
              borderRadius: 12,
              padding: '16px',
              border: '1px solid #F0F0F0',
              boxShadow: '0 1px 3px rgba(0,0,0,.05)',
              cursor: k.onClick ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              userSelect: 'none',
            }}
            onMouseOver={(e) => {
              if (k.onClick) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)';
              }
            }}
            onMouseOut={(e) => {
              if (k.onClick) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.05)';
              }
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.col }}>
              <CountUp value={k.val} />
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                marginTop: 3,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              {k.label}
            </div>
          </div>
        ))}
      </div>
      
      {/* 📥 SECCIÓN DE INGRESOS DE HOY */}
      {ciToday.length > 0 && (
        <div id="seccion-ingresos" style={{ marginBottom: 24 }}>
          <h3
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 800,
              color: '#059669',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            📥 Ingresos de hoy ({ciToday.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ciToday.map((r, liI) => {
              const prop = PROPS.find((p) => p.id === r.propertyId);
              return (
                <div className="li-in"
                  key={r.id + 'in'}
                  onClick={() => onGoTo('abrir_reserva', r)}
                  style={{ '--i': liI,
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    border: '1px solid #F0F0F0',
                    cursor: 'pointer',
                    animation: pulseIn ? 'pulseBlue 0.8s ease-in-out 3' : 'none', // <--- ANIMACIÓN AQUÍ
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.05)')}
                  onMouseOut={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: '#D1FAE5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                  >
                    📥
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
                        {r.guestName}
                      </span>
                      {r.room && (
                        <span 
                          style={{ 
                            background: '#F1F5F9', 
                            color: '#475569', 
                            padding: '1px 6px', 
                            borderRadius: 5, 
                            fontSize: 11, 
                            fontWeight: 800, 
                            border: '1px solid #E2E8F0',
                            lineHeight: 1
                          }}
                        >
                          {r.room}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                      {prop?.name}
                    </div>
                  </div>
                  <Badge status={r.status} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 📤 SECCIÓN DE SALIDAS DE HOY */}
      {coToday.length > 0 && (
        <div id="seccion-salidas" style={{ marginBottom: 24 }}>
          <h3
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 800,
              color: '#D97706',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            📤 Salidas de hoy ({coToday.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {coToday.map((r, liI) => {
              const prop = PROPS.find((p) => p.id === r.propertyId);
              return (
                <div className="li-in"
                  key={r.id + 'out'}
                  onClick={() => onGoTo('abrir_reserva', r)}
                  style={{ '--i': liI,
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    border: '1px solid #F0F0F0',
                    cursor: 'pointer',
                    animation: pulseOut ? 'pulseOrange 0.8s ease-in-out 3' : 'none', // <--- ANIMACIÓN AQUÍ
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.05)')}
                  onMouseOut={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: '#FEE2E2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                  >
                    📤
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
                        {r.guestName}
                      </span>
                      {r.room && (
                        <span 
                          style={{ 
                            background: '#F1F5F9', 
                            color: '#475569', 
                            padding: '1px 6px', 
                            borderRadius: 5, 
                            fontSize: 11, 
                            fontWeight: 800, 
                            border: '1px solid #E2E8F0',
                            lineHeight: 1
                          }}
                        >
                          {r.room}
                        </span>
                      )}
                      <LateBadge r={r} />
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                      {prop?.name}
                    </div>
                  </div>
                  <Badge status={r.status} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 💳 VCC DE BOOKING POR COBRAR */}
      {vccPending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 800,
              color: '#1E40AF',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            💳 VCC de Booking por cobrar ({vccPending.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vccPending.map((r, liI) => (
              <div className="li-in"
                key={r.id + 'vcc'}
                onClick={() => onGoTo('abrir_reserva', r)}
                style={{ '--i': liI,
                  background: '#EFF6FF',
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  border: '1px solid #BFDBFE',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
                      {r.guestName}
                    </span>
                    {r.room && (
                      <span
                        style={{
                          background: '#fff',
                          color: '#475569',
                          padding: '1px 6px',
                          borderRadius: 5,
                          fontSize: 11,
                          fontWeight: 800,
                          border: '1px solid #E2E8F0',
                          lineHeight: 1,
                        }}
                      >
                        {r.room}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                    Ingreso {parseD(r.checkIn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1E40AF', whiteSpace: 'nowrap' }}>
                  {currency(Number(r.totalAmount) - Number(r.paid))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
