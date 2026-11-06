/* eslint-disable */
// @ts-nocheck
import { Badge } from '../components/ui/Badge';
import { BLOCK_COLORS, getAlerts } from '../lib/constants';
import { TODAY, fmt, addDays, parseD, MONTHS, DAYS } from '../lib/dates';
import { LateBadge } from '../components/ui/LateBadge';
import { GroupBadge } from '../components/ui/GroupBadge';

// ── TIMELINE MOBILE ───────────────────────────────────────────────────────────
export function TimelineMobile({ reservations, properties, onClickRes, onAddRes, highlightStatus }) {
  const next14 = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i - 1));
  const dayRes = (d) =>
    reservations.filter(
      (r) =>
        r.status !== 'cancelada' &&
        parseD(r.checkIn) <= d &&
        d < parseD(r.checkOut)
    );
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}>
          Calendario
        </h2>
        <button
          onClick={() => onAddRes()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
            border: 'none',
            borderRadius: 9,
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {next14.map((d) => {
          const dRes = dayRes(d),
            isToday = fmt(d) === fmt(TODAY);
          return (
            <div
              key={fmt(d)}
              style={{
                background: isToday ? '#EFF6FF' : '#fff',
                borderRadius: 12,
                border: `1.5px solid ${isToday ? '#BFDBFE' : '#F0F0F0'}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isToday ? '#DBEAFE' : '#FAFAFA',
                  borderBottom: dRes.length > 0 ? '1px solid #F0F0F0' : 'none',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: isToday ? '#3B82F6' : '#E5E7EB',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: isToday ? 'rgba(255,255,255,.8)' : '#9CA3AF',
                      textTransform: 'uppercase',
                    }}
                  >
                    {DAYS[d.getDay()]}
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: isToday ? '#fff' : '#374151',
                    }}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: isToday ? '#1E40AF' : '#374151',
                    }}
                  >
                    {isToday ? 'Hoy — ' : ''}
                    {MONTHS[d.getMonth()]} {d.getFullYear()}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {dRes.length === 0
                      ? 'Libre'
                      : dRes.length === 1
                      ? '1 reserva activa'
                      : `${dRes.length} reservas`}
                  </div>
                </div>
              </div>
              {dRes.map((r) => {
                const p = properties.find((x) => x.id === r.propertyId);
                const bc = BLOCK_COLORS[r.status] || BLOCK_COLORS.por_llegar;
                const alerts = getAlerts(r);
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      borderBottom: '1px solid #F8FAFC',
                      cursor: 'pointer',
                      animation: (highlightStatus && r.status === highlightStatus) ? 'pulseGreenCard 0.8s ease-in-out 3' : 'none',
                    }}
                    onClick={() => onClickRes(r)}
                  >
                    <div
                      style={{
                        width: 4,
                        alignSelf: 'stretch',
                        borderRadius: 2,
                        background: bc.bg,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: '#111',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.guestName}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span>{p?.name}{r.room ? ` · Hab.${r.room}` : ''}</span>
                        {/* NUEVO ETIQUETA BOOKING EN MOBILE */}
                        {r.source === 'Booking' && (
                          <span style={{ color: '#1E40AF', background: '#DBEAFE', padding: '2px 6px', borderRadius: 4, fontWeight: 800, fontSize: 10 }}>
                            Booking
                          </span>
                        )}
                        {r.requiresInvoice && <span style={{ color: '#7C3AED', fontWeight: 700 }}>· 🧾 Factura</span>}
                        <LateBadge r={r} size={10} />
                        <GroupBadge r={r} size={10} />
                        {r.notes && <span style={{ color: '#D97706', fontWeight: 700 }}>· 📝 Notas</span>}
                      </div>
                      {r.checkIn === fmt(d) && (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#059669',
                          }}
                        >
                          Check-in hoy
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 4,
                      }}
                    >
                      <Badge status={r.status} />
                      {alerts.length > 0 && (
                        <div style={{ display: 'flex', gap: 3 }}>
                          {alerts.map((a) => (
                            <div
                              key={a.key}
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 2,
                                background: a.color,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      
      {/* LEYENDA DE ESTADOS EN MOBILE */}
      <div style={{ marginTop: 20, padding: '12px 14px', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.4 }}>
          Leyenda de Estados
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(BLOCK_COLORS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151', fontWeight: 600 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: v.bg }} />
              <span style={{ textTransform: 'capitalize' }}>{k.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
