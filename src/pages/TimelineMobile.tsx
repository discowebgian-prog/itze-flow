/* eslint-disable */
// @ts-nocheck
import { Badge } from '../components/ui/Badge';
import { BLOCK_COLORS, getAlerts } from '../lib/constants';
import { TODAY, fmt, addDays, parseD, MONTHS, DAYS } from '../lib/dates';
import { LateBadge } from '../components/ui/LateBadge';
import { GroupBadge } from '../components/ui/GroupBadge';
import { Icon, ic } from '../components/ui/Icon';

const DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ── TIMELINE MOBILE ───────────────────────────────────────────────────────────
export function TimelineMobile({ reservations, properties, onClickRes, onAddRes, onQuote, highlightStatus }) {
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
      {/* El título, Lista/Timeline, Cotizar y + Reserva los pone Timeline.tsx (antes este encabezado salía repetido) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {next14.map((d) => {
          const dRes = dayRes(d),
            isToday = fmt(d) === fmt(TODAY);
          return (
            <div
              key={fmt(d)}
              className="ui-group"
              style={{ margin: 0, boxShadow: isToday ? 'inset 0 0 0 2px var(--acc), var(--shadow)' : undefined }}
            >
              <div
                style={{
                  padding: '11px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderBottom: dRes.length > 0 ? '1px solid var(--line)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: isToday ? 'var(--acc)' : 'var(--fill)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    lineHeight: 1.05,
                  }}
                >
                  <span style={{ fontSize: 9, fontWeight: 700, color: isToday ? 'rgba(255,255,255,.85)' : 'var(--mut)', textTransform: 'uppercase' }}>
                    {DAYS[d.getDay()]}
                  </span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: isToday ? '#fff' : 'var(--ink)' }}>{d.getDate()}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: isToday ? 'var(--acc)' : 'var(--ink)' }}>
                    {isToday ? 'Hoy' : DIA[d.getDay()]}
                    <span style={{ fontWeight: 500, color: 'var(--mut)' }}> · {d.getDate()} de {MES[d.getMonth()]}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>
                    {dRes.length === 0 ? 'Libre' : dRes.length === 1 ? '1 reserva' : `${dRes.length} reservas`}
                  </div>
                </div>
              </div>
              {dRes.map((r, liI) => {
                const p = properties.find((x) => x.id === r.propertyId);
                const bc = BLOCK_COLORS[r.status] || BLOCK_COLORS.por_llegar;
                const alerts = getAlerts(r);
                return (
                  <div className="li-in ui-row"
                    key={r.id}
                    style={{ '--i': liI,
                      gap: 10,
                      cursor: 'pointer',
                      animation: (highlightStatus && r.status === highlightStatus) ? 'pulseGreenCard 0.8s ease-in-out 3' : 'none',
                    }}
                    onClick={() => onClickRes(r)}
                  >
                    <div
                      style={{
                        width: 4,
                        alignSelf: 'stretch',
                        minHeight: 34,
                        borderRadius: 2,
                        background: bc.bg,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 15.5,
                          color: 'var(--ink)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.guestName}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--mut)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 1 }}>
                        <span>{r.room ? r.room : p?.name}</span>
                        {/* NUEVO ETIQUETA BOOKING EN MOBILE */}
                        {r.source === 'Booking' && (
                          <span style={{ color: 'var(--c-1E40AF)', background: 'var(--c-DBEAFE)', padding: '1px 7px', borderRadius: 20, fontWeight: 700, fontSize: 11 }}>
                            Booking
                          </span>
                        )}
                        {r.requiresInvoice && <span style={{ color: 'var(--c-7C3AED)', fontWeight: 600 }}>{ic('invoice', 12, { marginRight: 3 })}Factura</span>}
                        <LateBadge r={r} size={10} />
                        <GroupBadge r={r} size={10} />
                        {r.notes && <span style={{ color: 'var(--c-D97706)', fontWeight: 600 }}>{ic('edit', 12, { marginRight: 3 })}Notas</span>}
                      </div>
                      {r.checkIn === fmt(d) && (
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--c-15803D)',
                            marginTop: 2,
                          }}
                        >
                          {ic('checkIn', 12, { marginRight: 3 })}Llega este día
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
      <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--card)', borderRadius: 'var(--r-item)', boxShadow: 'var(--shadow)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.4 }}>
          Colores de cada estado
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(BLOCK_COLORS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: v.bg }} />
              <span style={{ textTransform: 'capitalize' }}>{k.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
