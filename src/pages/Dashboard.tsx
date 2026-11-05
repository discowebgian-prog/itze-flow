/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { PROPS } from '../lib/constants';
import { TODAY, fmt, parseD } from '../lib/dates';
import dashboardCss from '../styles/dashboard.css?raw';

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export function Dashboard({
  user,
  reservations,
  properties,
  propStatus,
  setPropStatus,
  onGoTo,
}) {
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
          {TODAY.toLocaleDateString('es-MX', {
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
          Panorama de hoy
        </h2>
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
        ].map((k) => (
          <div
            key={k.label}
            onClick={k.onClick}
            style={{
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
              {k.val}
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
            {ciToday.map((r) => {
              const prop = PROPS.find((p) => p.id === r.propertyId);
              return (
                <div
                  key={r.id + 'in'}
                  onClick={() => onGoTo('abrir_reserva', r)}
                  style={{
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
            {coToday.map((r) => {
              const prop = PROPS.find((p) => p.id === r.propertyId);
              return (
                <div
                  key={r.id + 'out'}
                  onClick={() => onGoTo('abrir_reserva', r)}
                  style={{
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
    </div>
  );
}
