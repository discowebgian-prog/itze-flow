/* eslint-disable */
// @ts-nocheck
import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { srcLabel, srcColor, BLOCK_COLORS } from '../../lib/constants';
import { fmtD, fmtDT, diffDays, currency } from '../../lib/dates';
import { waLink, buildGuestDB, freqBadge } from '../../lib/guests';

// ── DRAWER ────────────────────────────────────────────────────────────────────
export function ResDrawer({
  res,
  onClose,
  onEdit,
  onDelete,
  onToggleBlacklist,
  properties,
  allRes,
  isMobile,
  onCheckIn,
  onCheckOut,
}) {
  const prop = properties.find((p) => p.id === res.propertyId);
  const saldo = res.totalAmount - res.paid;
  const nights = diffDays(res.checkIn, res.checkOut);
  const gdb = buildGuestDB(allRes);
  const gkey = (res.guestDoc || '').replace(/\s+/g, '').toLowerCase();
  const gp = gdb[gkey];
  const freq = gp ? freqBadge(gp.stays.length) : null;
  const pmLabel = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    debito: 'Débito',
    credito: 'Crédito',
    otro: 'Otro',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: isMobile ? 'flex-end' : 'flex-end',
        alignItems: isMobile ? 'stretch' : 'flex-start',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ background: 'rgba(0,0,0,.4)', position: 'absolute', inset: 0 }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'relative',
          width: isMobile ? '100vw' : 380,
          background: '#fff',
          height: isMobile ? 'auto' : '100%',
          maxHeight: isMobile ? '92vh' : '100%',
          overflowY: 'auto',
          boxShadow: isMobile
            ? '0 -4px 40px rgba(0,0,0,.15)'
            : '-8px 0 32px rgba(0,0,0,.15)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: isMobile ? '20px 20px 0 0' : '0',
        }}
      >
        {isMobile && (
          <div
            style={{
              width: 36,
              height: 4,
              background: '#E5E7EB',
              borderRadius: 2,
              margin: '12px auto 4px',
            }}
          />
        )}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #F0F0F0',
            // MAGIA: Si está en lista negra usa rojo oscuro, si no, usa el color exacto del estado en el calendario
            background: res.lista_negra 
              ? '#991B1B' 
              : (BLOCK_COLORS[res.status]?.bg || '#3B82F6'), 
            transition: 'background 0.3s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              {/* Línea superior: Solo el nombre del Hostel limpio */}
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.75)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  marginBottom: 6,
                }}
              >
                {prop?.name}
              </div>
              {/* Línea principal: Nombre del Huésped + Placa de Habitación destacada */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  flexWrap: 'wrap' 
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                  {res.guestName}
                </span>
                {res.room && (
                  <span 
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.25)',
                      color: '#fff', 
                      padding: '3px 9px', 
                      borderRadius: 6, 
                      fontSize: 13, 
                      fontWeight: 900,
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      lineHeight: 1
                    }}
                  >
                    {res.room}
                  </span>
                )}
                {/* ── NUEVA ETIQUETA PAX ── */}
                <span 
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: '#fff', 
                    padding: '3px 9px', 
                    borderRadius: 6, 
                    fontSize: 13, 
                    fontWeight: 700,
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    lineHeight: 1
                  }}
                >
                  👥 {res.totalGuests || 1} Pax
                </span>
                {/* ── NUEVA ETIQUETA PIN TTLOCK ── */}
                {res.pin_acceso && (
                  <span 
                    style={{ 
                      background: '#10B981', 
                      color: '#fff', 
                      padding: '3px 9px', 
                      borderRadius: 6, 
                      fontSize: 13, 
                      fontWeight: 900,
                      border: '1px solid #059669',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    🔑 {res.pin_acceso}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,.2)',
                border: 'none',
                borderRadius: 8,
                width: 32,
                height: 32,
                cursor: 'pointer',
                fontSize: 18,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ padding: 20, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 16,
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
           <Badge status={res.status} large />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {res.lista_negra && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#fff',
                    background: '#DC2626',
                    padding: '2px 8px',
                    borderRadius: 20,
                  }}
                >
                  ⚠️ NO GRATO
                </span>
              )}
              {freq && !res.lista_negra && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: freq.color,
                    background: freq.bg,
                    padding: '2px 8px',
                    borderRadius: 20,
                  }}
                >
                  {freq.label}
                </span>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: res.source === 'Booking' ? '#EFF6FF' : '#ECFDF5',
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: `1.5px solid ${res.source === 'Booking' ? '#BFDBFE' : '#A7F3D0'}`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: srcColor(res.source),
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: res.source === 'Booking' ? '#1E40AF' : '#065F46',
                  }}
                >
                  {srcLabel(res.source)}
                </span>
              </div>
            </div>
          </div>
          {/* FILA SUPERIOR: Tiempos de la estadía (3 columnas en línea) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              marginBottom: 8,
            }}
          >
            {[
              ['Check-in', fmtD(res.checkIn)],
              ['Check-out', fmtD(res.checkOut)],
              ['Duración', nights + ' noche' + (nights !== 1 ? 's' : '')],
            ].map(([l, v]) => (
              <div
                key={l}
                style={{
                  background: '#F9FAFB',
                  borderRadius: 10,
                  padding: '10px 4px',
                  border: '1px solid #F0F0F0',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 9.5,
                    color: '#9CA3AF',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: 2,
                  }}
                >
                  {l}
                </div>
                <div style={{ fontWeight: 700, color: '#111', fontSize: 12.5 }}>
                  {v}
                </div>
              </div>
            ))}
          </div>

          {/* FILA INFERIOR: Bloque masivo del Total General */}
          <div
            style={{
              background: '#F9FAFB',
              borderRadius: 10,
              padding: '12px 14px',
              border: '1px solid #F0F0F0',
              marginBottom: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Total Reserva
            </div>
            <div style={{ fontWeight: 800, color: '#111', fontSize: 16 }}>
              {currency(res.totalAmount)}
            </div>
          </div>
          <div
            style={{
              background: saldo > 0 ? '#FEF3C7' : '#D1FAE5',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: saldo > 0 ? '#92400E' : '#065F46',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Saldo pendiente
              </div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 20,
                  color: saldo > 0 ? '#B45309' : '#059669',
                }}
              >
                {currency(saldo)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>
                Pagado
              </div>
              <div style={{ fontWeight: 700 }}>{currency(res.paid)}</div>
              {res.paymentMethod && (
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  {pmLabel[res.paymentMethod] || res.paymentMethod}
                </div>
              )}
            </div>
          </div>
          {(res.requiresInvoice || res.notes) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderBottom: '1px solid #F0F0F0', borderTop: '1px solid #F0F0F0', marginBottom: 14, background: '#FAFAFA' }}>
              {res.requiresInvoice && (
                <span style={{ fontSize: 12, color: '#7C3AED', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="invoice" size={14} /> Solicita factura fiscal
                </span>
              )}
              {res.notes && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', marginTop: 4 }}>
                  {/* Título en mayúsculas y pequeño como indicador */}
                  <span style={{ fontSize: 10, color: '#B45309', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    <Icon name="edit" size={13} /> Notas Internas
                  </span>
                  {/* Bloque de texto más grande, destacado y que respeta saltos de línea */}
                  <div style={{ fontSize: 13.5, color: '#78350F', fontWeight: 600, background: '#FEF3C7', padding: '8px 12px', borderRadius: 8, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                    {res.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {(res.url_ine_frente || res.url_ine_dorso) && (
            <div style={{ background: '#F0F9FF', borderRadius: 10, padding: '12px 16px', marginBottom: 14, border: '1px solid #BAE6FD' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', marginBottom: 8 }}>
                Documentos adjuntos
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {res.url_ine_frente && (
                  <a href={res.url_ine_frente} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
                    <div style={{ background: '#0284C7', color: '#fff', padding: '8px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
                      📷 Ver Frente
                    </div>
                  </a>
                )}
                {res.url_ine_dorso && (
                  <a href={res.url_ine_dorso} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
                    <div style={{ background: '#0284C7', color: '#fff', padding: '8px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
                      📷 Ver Dorso
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}
          <div
            style={{
              background: '#F9FAFB',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 14,
              border: '1px solid #F0F0F0',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Datos del huésped
              </div>
            </div>
            {[
              ['Documento', (res.guestDocType || 'Doc') + ': ' + res.guestDoc],
              ['Teléfono', res.guestPhone],
              ['Email', res.guestEmail],
            ].map(
              ([l, v]) =>
                v && (
                  <div
                    key={l}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: '1px solid #F0F0F0',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: '#9CA3AF' }}>{l}</span>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span style={{ fontWeight: 600, color: '#374151' }}>
                        {v}
                      </span>
                      {l === 'Teléfono' && v && (
                        <a
                          href={waLink(
                            v,
                            res.guestPhonePrefix,
                            res.guestNationality
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: '#22C55E',
                            color: '#fff',
                            textDecoration: 'none',
                          }}
                          title="WhatsApp"
                        >
                          <Icon name="whatsapp" size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                )
            )}
          </div>
          {res.companions && res.companions.length > 0 && (
            <div
              style={{
                background: '#F9FAFB',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 14,
                border: '1px solid #F0F0F0',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Acompañantes ({res.companions.length})
              </div>
              {res.companions.map((c, i) => {
                // Preparamos el mensaje de WhatsApp para el acompañante
                const mensajeAcomp = encodeURIComponent(`¡Hola ${c.name ? c.name.split(' ')[0] : ''}! Bienvenido a Itzé Hostel. 🌴 Tu grupo está en la habitación ${res.room || 'asignada'}. El código de acceso a la puerta principal es *${res.pin_acceso || '---'}*. ¡Te esperamos!`);
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid #F0F0F0',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#374151' }}>
                      {c.name || `Acompañante ${i + 1}`}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {c.phone && (
                        <a
                          href={`${waLink(c.phone, res.guestPhonePrefix, res.guestNationality)}?text=${mensajeAcomp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#ECFDF5',
                            color: '#059669',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: 11,
                            border: '1px solid #A7F3D0'
                          }}
                          title="WhatsApp Acompañante"
                        >
                          <Icon name="whatsapp" size={12} /> {c.phone}
                        </a>
                      )}
                      <span style={{ color: '#9CA3AF', fontSize: 12 }}>{c.doc || 'Sin doc'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {(res.checkInAt || res.checkOutAt) && (
            <div
              style={{
                background: '#F8FAFC',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 11,
                color: '#6B7280',
                marginBottom: 14,
              }}
            >
              {res.checkInAt && (
                <div>
                  ⏱ <b>CI real:</b> {fmtDT(res.checkInAt)}
                </div>
              )}
              {res.checkOutAt && (
                <div>
                  ⏱ <b>CO real:</b> {fmtDT(res.checkOutAt)}
                </div>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #F0F0F0',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: '#FAFAFA',
          }}
        >
          {res.status === 'por_llegar' && (
            <button
              onClick={() => onCheckIn(res)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#10B981',
                border: 'none',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Icon name="checkIn" size={18} /> Hacer Check-in
            </button>
          )}
          {res.status === 'hospedado' && (
            <button
              onClick={() => onCheckOut(res)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#F59E0B',
                border: 'none',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Icon name="checkOut" size={18} /> Hacer Check-out
            </button>
          )}
          
          {/* BOTÓN MÁGICO DE LISTA NEGRA */}
          <button
            onClick={() => onToggleBlacklist(res.id, res.lista_negra)}
            style={{
              width: '100%',
              padding: '10px',
              background: res.lista_negra ? '#FEF2F2' : '#fff',
              border: res.lista_negra ? '1.5px solid #FECACA' : '1px solid #E5E7EB',
              borderRadius: 8,
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              color: res.lista_negra ? '#DC2626' : '#4B5563',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            {res.lista_negra ? '⚠️ Quitar de Lista Negra' : '🚫 Marcar como No Grato'}
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onEdit(res)}
              style={{
                flex: 1,
                padding: '10px',
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Icon name="edit" size={16} /> Editar
            </button>
            <button
              onClick={() => onDelete(res.id)}
              style={{
                flex: 1,
                padding: '10px',
                background: '#FEF2F2',
                border: 'none',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Icon name="trash" size={16} /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
