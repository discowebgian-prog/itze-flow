/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from 'react';
import { ResForm } from './components/reservations/ResForm';
import { Badge } from './components/ui/Badge';
import { Icon } from './components/ui/Icon';
import { Modal } from './components/ui/Modal';
import { useW } from './hooks/useW';
import { PROPS, srcLabel, srcColor, BLOCK_COLORS, INIT_RES, COUNTRIES } from './lib/constants';
import { TODAY, fmt, fmtD, fmtDT, addDays, diffDays, parseD, currency, MONTHS } from './lib/dates';
import { exportToExcel } from './lib/excel';
import { waLink, buildGuestDB, freqBadge } from './lib/guests';
import { supabase } from './lib/supabase';
import { Dashboard } from './pages/Dashboard';
import { GuestsPage } from './pages/GuestsPage';
import { Login } from './pages/Login';
import { PropertiesPage } from './pages/PropertiesPage';
import { ResList } from './pages/ResList';
import { Timeline } from './pages/Timeline';


// ── DRAWER ────────────────────────────────────────────────────────────────────
function ResDrawer({
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

// ── FINANCE PAGE ──────────────────────────────────────────────────────────────
function FinancePage({ reservations, allRes, properties, user, restoreRes, onGoTo }) {
  const [showTrash, setShowTrash] = useState(false);
  const [gastos, setGastos] = useState([]);
  const [formGasto, setFormGasto] = useState({ fecha: fmt(TODAY), monto: '', categoria: 'Insumos', notas: '' });
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  // ── ESTADOS PARA REVENUE INTELLIGENCE Y EL POP-UP ──
  const [analyzingMonth, setAnalyzingMonth] = useState(null);
  const [aiInsights, setAiInsights] = useState({});
    const [insightModal, setInsightModal] = useState(null);
  const [chatMessages, setChatMessages] = useState({});
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const pending = reservations.filter(
    (r) => r.status !== 'cancelada' && r.paid < r.totalAmount
  );
  const deleted = (allRes || []).filter((r) => r.deleted);
  const currentMonthKey = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    const fetchGastos = async () => {
      const { data, error } = await supabase.from('gastos').select('*').order('fecha', { ascending: false });
      if (!error && data) setGastos(data);
    };
    fetchGastos();
  }, []);

  const handleGuardarGasto = async (e) => {
    e.preventDefault();
    if (!formGasto.monto || Number(formGasto.monto) <= 0) return;
    setGuardandoGasto(true);
    const { data, error } = await supabase.from('gastos').insert([{
      fecha: formGasto.fecha,
      monto: Number(formGasto.monto),
      categoria: formGasto.categoria,
      notas: formGasto.notas
    }]).select();
    setGuardandoGasto(false);
    
    if (!error && data) {
      setGastos([data[0], ...gastos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
      setFormGasto({ ...formGasto, monto: '', notas: '' });
    }
  };

  const eliminarGasto = async (id) => {
    if(!window.confirm('¿Eliminar gasto?')) return;
    await supabase.from('gastos').delete().eq('id', id);
    setGastos(gastos.filter((g) => g.id !== id));
  };

  const analizarRevenue = async (m, metrics) => {
    setAnalyzingMonth(m.key);
    try {
      const apiKey = import.meta.env.VITE_CLAUDE_KEY;
      if (!apiKey) {
        alert('⚠️ Falta la API Key en Vercel.');
        setAnalyzingMonth(null);
        return;
      }

      // ============================================================
      // 1) VARIABLES DE REVENUE MANAGEMENT (EDITABLES MES A MES)
      // ============================================================
      const rmMetaOcupacion = 70; // Tu meta de ocupación, en %

      // Completar si hay eventos especiales (ej: [{ fecha: "2026-10-31", nombre: "Kitesurf Fest", tipo: "deportivo" }])
      const rmEventos = [];
      
      // Completar si tenés relevamiento de la zona (ej: [{ nombre: "Hostal X", tarifaEntreSemana: 500, tarifaFinde: 900 }])
      const rmCompetencia = [];

      // Datos extra. Lo que quede vacío o en 0, Claude lo marcará como dato faltante.
      const rmExtra = {
        distribucionEstadia: "", // Ej: "80% 1 noche, 20% 2 noches"
        ocupacionPorDiaSemana: "", // Ej: "Dom 12%, Lun 10%, Vie 60%, Sáb 70%"
        adrPorDiaSemana: "", 
        mixCanales: "", // Ej: "Booking 55%, Airbnb 20%, Directo 25%"
        anticipacionReservas: "", 
        reservasYaTomadas: "", 
        costoVariablePorNocheOcupada: 0, 
        comisionPromedioPct: 0, 
      };

      // ============================================================
      // 2) FUNCIONES AUXILIARES PARA EL PROMPT
      // ============================================================
      const rmHoy = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
      const rmBloque = (titulo, dato) => {
        const tieneDato = Array.isArray(dato) ? dato.length > 0 : (dato !== "" && dato !== 0 && dato != null);
        const texto = typeof dato === "string" || typeof dato === "number" ? dato : JSON.stringify(dato);
        return `${titulo}: ${tieneDato ? texto : "SIN DATOS (inclúyelo en DATOS QUE FALTAN)"}`;
      };

      // ============================================================
      // 3) EL PROMPT MAESTRO
      // ============================================================
      const prompt = `Actúa como Consultor Senior en Revenue Management (gestión de ingresos hoteleros) de "Itzé Hostel Boutique": 6 habitaciones privadas en Progreso, Yucatán (P6 matrimonial, P4 king, P1-P3 y P5 privadas).
Tu objetivo es maximizar la ganancia operativa por habitación disponible (GOPPAR), no solo la ocupación, y llenar los días flojos (Dom-Mié) sin bajar el precio de Jue-Sáb.
Meta del dueño: acercar la ocupación a ${rmMetaOcupacion}%. En temporada baja hoy está por debajo de 30%.
Fecha de hoy: ${rmHoy}. Si el mes analizado ya terminó, haz un análisis retrospectivo y proyecta el plan al mes siguiente.

REGLAS ESTRICTAS:
1. No repitas ni describas los números que te envío; el dueño ya los ve en pantalla. Úsalos solo como evidencia dentro de una conclusión.
2. Cruza los datos del hotel con el contexto de mercado: cada recomendación debe conectar un número del hotel con un patrón del mercado.
3. Etiqueta lo importante como [DATO HOTEL], [DATO MERCADO] o [HIPÓTESIS A PROBAR].
4. No inventes precios de competidores, eventos ni cifras. Si falta un dato, dilo en DATOS QUE FALTAN.
5. NO propongas estadía mínima (MinLOS) de 2 o más noches para fines de semana. Asume que la inmensa mayoría del turismo en Progreso es de 1 sola noche. Sí puedes proponer incentivos opcionales (ej. 2da noche con descuento Dom-Jue).
6. Un descuento solo es válido si está "vallado" (limitado a un día, canal, mismo día, solo directo, etc.) para que no lo aproveche quien pagaría el precio completo.
7. REGLA DE ORO: Si los Egresos Operativos son $0, empieza obligatoriamente con una advertencia crítica indicando que el GOPPAR es una ilusión financiera.

CONTEXTO DE MERCADO: PROGRESO, YUCATÁN (datos 2026):
- La mayoría de quienes visitan el malecón es local/regional (Mérida está a 30 min) y buena parte va y vuelve el mismo día. El que pernocta, suele hacerlo solo por UNA noche.
- Oferta informal (rentas vacacionales) es altísima y presiona las tarifas hacia abajo.
- Picos de demanda: Fines de semana, Carnaval, Semana Santa, Julio-Agosto. Valles: Dom-Mié y meses de Sep-Nov.

PALANCAS DISPONIBLES (Elige solo las que apliquen):
- Tarifa "escapada entre semana" para residentes de Yucatán (Dom-Mié), vallada con ID.
- Paquete trabajo remoto de Dom a Jue (orientado a contratistas del puerto).
- Precio de último minuto (mismo día) entre semana por canales directos.
- Jue-Sáb: subir tarifa o cerrar promociones; upselling (late check-out, experiencias).

DATOS DEL HOTEL (${m.label}):
- Ingreso Base Real: $${metrics.trueRevenue} | Egresos Operativos: $${metrics.gastos}
- Ocupación Física: ${metrics.occPct}% | ADR: $${metrics.adr} | RevPAR Global: $${metrics.revpar} | GOPPAR: $${metrics.goppar}
- RevPAR (Dom-Mié): $${metrics.revparEntre} vs RevPAR (Jue-Sáb): $${metrics.revparFinde}
- Ocup. Matrimonial (P6): ${metrics.oMat}% | King (P4): ${metrics.oKing}% | Privadas (P1-P3, P5): ${metrics.oComp}%
${rmBloque("- Distribución de estadía", rmExtra.distribucionEstadia)}
${rmBloque("- Ocupación por día de la semana", rmExtra.ocupacionPorDiaSemana)}
${rmBloque("- ADR por día de la semana", rmExtra.adrPorDiaSemana)}
${rmBloque("- Mix de canales de venta", rmExtra.mixCanales)}
${rmBloque("- Anticipación de reservas", rmExtra.anticipacionReservas)}
${rmBloque("- Reservas tomadas a futuro", rmExtra.reservasYaTomadas)}
${rmBloque("- Costo variable por noche", rmExtra.costoVariablePorNocheOcupada)}
${rmBloque("- Comisión promedio", rmExtra.comisionPromedioPct)}
${rmBloque("- Eventos locales", rmEventos)}
${rmBloque("- Competencia", rmCompetencia)}

TU TAREA:
Responde en texto plano (sin asteriscos, sin markdown, usa MAYÚSCULAS para títulos y guiones para listas), máximo 800 palabras, sin introducciones. Usa estas secciones:
ALERTAS CRÍTICAS: (Solo si egresos son $0 o hay datos vitales faltantes).
LO QUE NO SE VE A SIMPLE VISTA: 3 hallazgos estratégicos cruzando datos y mercado.
¿ES REALISTA LA META?: Veredicto sobre la meta del ${rmMetaOcupacion}% con los datos actuales.
PLAN DE ACCIÓN: 4 acciones concretas (A quién, Qué ofrecer, A qué precio, Cuándo, Por qué canal).
EXPERIMENTOS: 1 prueba ágil de 2 semanas con métrica de éxito.
DATOS QUE FALTAN: Los 3 datos más urgentes a cargar en el sistema para mejorar el próximo análisis.`;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5', // Identificador técnico exacto y válido
          max_tokens: 5000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json();
        alert(`⚠️ Claude rechazó la conexión. Motivo: ${errData.error?.message || resp.status}`);
        setAnalyzingMonth(null);
        return;
      }
      
      const data = await resp.json();
            const textBlock = (data.content || []).find(block => block.type === 'text');
      const text = textBlock?.text || 'No se pudo generar el diagnóstico.';
      
            setAiInsights(prev => ({ ...prev, [m.key]: text }));
      setChatMessages(prev => ({ ...prev, [m.key]: [{ role: 'user', content: prompt }, { role: 'assistant', content: text }] }));
      setInsightModal({ title: `Diagnóstico Estratégico: ${m.label}`, content: text, monthKey: m.key });
        } catch (err) {
      console.error('Error:', err);
      alert('⚠️ Error de red al conectar con Claude. Revisa tu conexión a internet.');
    } finally {
      setAnalyzingMonth(null);
    }
  };

  const enviarPregunta = async () => {
    if (!chatInput.trim() || !insightModal) return;
    const monthKey = insightModal.monthKey;
    const pregunta = chatInput.trim();
    const historialPrevio = chatMessages[monthKey] || [];
    const nuevoHistorial = [...historialPrevio, { role: 'user', content: pregunta }];

    setChatMessages(prev => ({ ...prev, [monthKey]: nuevoHistorial }));
    setChatInput('');
    setChatLoading(true);

    try {
      const apiKey = import.meta.env.VITE_CLAUDE_KEY;
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 40000,
          output_config: { effort: 'medium' },
          messages: nuevoHistorial,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json();
        alert(`⚠️ Claude rechazó la conexión. Motivo: ${errData.error?.message || resp.status}`);
        setChatLoading(false);
        return;
      }

      const data = await resp.json();
      const textBlock = (data.content || []).find(block => block.type === 'text');
      const respuesta = textBlock?.text || 'No se pudo generar una respuesta.';

      setChatMessages(prev => ({ ...prev, [monthKey]: [...nuevoHistorial, { role: 'assistant', content: respuesta }] }));
    } catch (err) {
      console.error('Error:', err);
      alert('⚠️ Error de red al conectar con Claude.');
    } finally {
      setChatLoading(false);
    }
  };

  const initMonthObj = (keyStr) => {
    const [y, m] = keyStr.split('-');
    const mName = MONTHS[parseInt(m, 10) - 1] || m;
    return {
      key: keyStr, label: `${mName} ${y}`, total: 0, paid: 0, count: 0, occupiedNights: 0, trueRevenue: 0,
      pmTotals: { efectivo: 0, transferencia: 0, debito: 0, credito: 0, otro: 0 },
      srcTotals: { Booking: 0, 'Directo-Puerta': 0, 'Directo-Celular': 0 },
      dow: { entre: { revenue: 0, nights: 0 }, finde: { revenue: 0, nights: 0 } },
      rooms: { matrimonial: { revenue: 0, nights: 0 }, king: { revenue: 0, nights: 0 }, compartidas: { revenue: 0, nights: 0 } },
      gastos: 0
    };
  };

  const baseStats = {};
  baseStats[currentMonthKey] = initMonthObj(currentMonthKey);

  const monthlyStats = reservations.reduce((acc, r) => {
    if (r.status === 'cancelada' || !r.checkIn) return acc;
    
    const [y, m] = r.checkIn.split('-');
    const key = `${y}-${m}`;
    if (!acc[key]) acc[key] = initMonthObj(key);

    const tAmt = r.totalAmount || 0;
    acc[key].total += tAmt; 
    acc[key].paid += (r.paid || 0);
    acc[key].count += 1;

    const nights = diffDays(r.checkIn, r.checkOut);
    if (nights > 0) {
      acc[key].occupiedNights += nights;
      const avgDailyRate = tAmt / nights;

      for (let i = 0; i < nights; i++) {
        const currentNight = addDays(parseD(r.checkIn), i); 
        const nightMonthKey = `${currentNight.getFullYear()}-${String(currentNight.getMonth() + 1).padStart(2, '0')}`;
        
        if (!acc[nightMonthKey]) acc[nightMonthKey] = initMonthObj(nightMonthKey);
        
        acc[nightMonthKey].trueRevenue += avgDailyRate;

        const dayOfWeek = currentNight.getDay();
        const isWeekend = dayOfWeek >= 4 && dayOfWeek <= 6; 

        if (isWeekend) {
           acc[nightMonthKey].dow.finde.revenue += avgDailyRate;
           acc[nightMonthKey].dow.finde.nights += 1;
        } else {
           acc[nightMonthKey].dow.entre.revenue += avgDailyRate;
           acc[nightMonthKey].dow.entre.nights += 1;
        }

        if (r.room === 'P6') {
           acc[nightMonthKey].rooms.matrimonial.revenue += avgDailyRate;
           acc[nightMonthKey].rooms.matrimonial.nights += 1;
        } else if (r.room === 'P4') {
           acc[nightMonthKey].rooms.king.revenue += avgDailyRate;
           acc[nightMonthKey].rooms.king.nights += 1;
        } else if (['P1', 'P2', 'P3', 'P5'].includes(r.room)) {
           acc[nightMonthKey].rooms.compartidas.revenue += avgDailyRate;
           acc[nightMonthKey].rooms.compartidas.nights += 1;
        }
      }
    }

    const pm = r.paymentMethod || 'efectivo';
    if (acc[key].pmTotals[pm] !== undefined) acc[key].pmTotals[pm] += tAmt;
    else acc[key].pmTotals['otro'] += tAmt;

    const src = r.source || 'Directo-Puerta';
    if (acc[key].srcTotals[src] !== undefined) acc[key].srcTotals[src] += tAmt;

    return acc;
  }, baseStats);

  gastos.forEach(g => {
    if (!g.fecha) return; 
    const [y, m] = g.fecha.split('-');
    const key = `${y}-${m}`;
    if (!monthlyStats[key]) monthlyStats[key] = initMonthObj(key);
    monthlyStats[key].gastos += Number(g.monto);
  });

  const monthlyArray = Object.values(monthlyStats).sort((a, b) => b.key.localeCompare(a.key));

  useEffect(() => {
    setTimeout(() => {
      const el = document.getElementById(`month-${currentMonthKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, [currentMonthKey]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}>Finanzas</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {user?.role === 'admin' && deleted.length > 0 && (
            <button
              onClick={() => setShowTrash((x) => !x)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                background: showTrash ? '#FEF2F2' : '#F3F4F6',
                border: `1.5px solid ${showTrash ? '#FECACA' : '#E5E7EB'}`,
                borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                cursor: 'pointer', color: showTrash ? '#DC2626' : '#6B7280',
              }}
            >
              🗑 Papelera {deleted.length > 0 && ( <span style={{ background: '#DC2626', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{deleted.length}</span> )}
            </button>
          )}
          <button
            onClick={() => exportToExcel(reservations, properties)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: '#ECFDF5', border: '1.5px solid #6EE7B7', borderRadius: 8,
              fontFamily: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#065F46',
            }}
          >
            📥 Exportar Excel
          </button>
        </div>
      </div>

      {/* MÓDULO DE EGRESOS */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #E5E7EB', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,.02)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: '#374151' }}>💸 Módulo de Egresos</h3>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          
          <form onSubmit={handleGuardarGasto} style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 10, background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #F0F0F0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Fecha</label>
                <input type="date" value={formGasto.fecha} onChange={(e) => setFormGasto({ ...formGasto, fecha: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, fontFamily: 'inherit' }} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Monto $</label>
                <input type="number" placeholder="0.00" value={formGasto.monto} onChange={(e) => setFormGasto({ ...formGasto, monto: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, fontFamily: 'inherit' }} required />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Categoría</label>
              <select value={formGasto.categoria} onChange={(e) => setFormGasto({ ...formGasto, categoria: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Sueldos">Sueldos</option>
                <option value="Insumos">Insumos (Limpieza/Desayuno)</option>
                <option value="Servicios">Servicios (Luz/Agua/Internet)</option>
                <option value="Impuestos">Impuestos</option>
                <option value="Comisiones">Comisiones (Booking/OTA)</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Concepto / Notas</label>
              <input type="text" placeholder="Ej. Pintura pasillo..." value={formGasto.notas} onChange={(e) => setFormGasto({ ...formGasto, notas: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, fontFamily: 'inherit' }} required />
            </div>
            <button disabled={guardandoGasto} type="submit" style={{ marginTop: 4, width: '100%', padding: '10px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: guardandoGasto ? 'not-allowed' : 'pointer', opacity: guardandoGasto ? 0.7 : 1 }}>
              {guardandoGasto ? 'Cargando...' : '+ Registrar Gasto'}
            </button>
          </form>

          <div style={{ flex: '2 1 350px', maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
             {gastos.length === 0 ? (
               <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px 0', fontSize: 12 }}>No hay egresos registrados.</div>
             ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                 {gastos.map(g => (
                   <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA', border: '1px solid #F0F0F0', borderRadius: 8, padding: '10px 12px' }}>
                     <div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                         <span style={{ fontSize: 11, fontWeight: 800, color: '#991B1B', background: '#FEE2E2', padding: '2px 6px', borderRadius: 4 }}>{g.categoria}</span>
                         <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{fmtD(g.fecha)}</span>
                       </div>
                       <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{g.notas}</div>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                       <span style={{ fontWeight: 800, color: '#EF4444', fontSize: 14 }}>-{currency(g.monto)}</span>
                       <button onClick={() => eliminarGasto(g.id)} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}>×</button>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#374151' }}>Reporte Mensual (Rendimiento y GOPPAR)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16, marginBottom: 28 }}>
        {monthlyArray.map((m) => {
          const saldo = m.total - m.paid;
          const pct = m.total > 0 ? Math.round((m.paid / m.total) * 100) : 0;
          const isCurrent = m.key === currentMonthKey;

          const [yStr, mStr] = m.key.split('-');
          const daysInMonth = new Date(parseInt(yStr), parseInt(mStr), 0).getDate();
          const passedDays = isCurrent ? TODAY.getDate() : daysInMonth;
          
          const totalRooms = properties.reduce((s, p) => s + (p.rooms || 1), 0);
          const availableNights = totalRooms * passedDays;
          const occPct = availableNights > 0 ? Math.min(100, Math.round((m.occupiedNights / availableNights) * 100)) : 0;
          const adr = m.occupiedNights > 0 ? Math.round(m.trueRevenue / m.occupiedNights) : 0;
          const revpar = availableNights > 0 ? Math.round(m.trueRevenue / availableNights) : 0;

          // Rentabilidad
          const netProfit = m.trueRevenue - m.gastos;
          const goppar = availableNights > 0 ? Math.round(netProfit / availableNights) : 0;

          // Segmentación DoW
          let availEntre = 0, availFinde = 0;
          for (let i = 1; i <= passedDays; i++) {
             const d = new Date(parseInt(yStr), parseInt(mStr) - 1, i).getDay();
             if (d >= 4 && d <= 6) availFinde++; else availEntre++;
          }
          const availNightsEntre = totalRooms * availEntre;
          const availNightsFinde = totalRooms * availFinde;
          const revparEntre = availNightsEntre > 0 ? Math.round(m.dow.entre.revenue / availNightsEntre) : 0;
          const revparFinde = availNightsFinde > 0 ? Math.round(m.dow.finde.revenue / availNightsFinde) : 0;

          // Segmentación Tipos de Habitación
          const aMat = 1 * passedDays, aKing = 1 * passedDays, aComp = 4 * passedDays;
          const rMat = aMat > 0 ? Math.round(m.rooms.matrimonial.revenue / aMat) : 0;
          const rKing = aKing > 0 ? Math.round(m.rooms.king.revenue / aKing) : 0;
          const rComp = aComp > 0 ? Math.round(m.rooms.compartidas.revenue / aComp) : 0;
          const oMat = aMat > 0 ? Math.min(100, Math.round((m.rooms.matrimonial.nights / aMat)*100)) : 0;
          const oKing = aKing > 0 ? Math.min(100, Math.round((m.rooms.king.nights / aKing)*100)) : 0;
          const oComp = aComp > 0 ? Math.min(100, Math.round((m.rooms.compartidas.nights / aComp)*100)) : 0;

          return (
            <div key={m.key} id={`month-${m.key}`} style={{ background: isCurrent ? '#EFF6FF' : '#fff', borderRadius: 12, padding: '16px', border: isCurrent ? '2px solid #3B82F6' : '1px solid #F0F0F0', boxShadow: isCurrent ? '0 4px 12px rgba(59,130,246,0.15)' : 'none', position: 'relative' }}>
              {isCurrent && <div style={{ position: 'absolute', top: -10, right: 16, background: '#3B82F6', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mes Actual</div>}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: isCurrent ? '#1E40AF' : '#111', textTransform: 'capitalize' }}>{m.label}</div>
                <div style={{ fontSize: 11, color: isCurrent ? '#60A5FA' : '#9CA3AF', fontWeight: 600 }}>{m.count} reservas</div>
              </div>

              {/* ── KPI HOTELEROS: OCUPACIÓN Y ADR ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ textAlign: 'center', background: isCurrent ? '#DBEAFE' : '#F8FAFC', padding: '10px 6px', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: isCurrent ? '#1E40AF' : '#64748B', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>Ocupación</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: occPct >= 70 ? '#10B981' : occPct >= 40 ? '#F59E0B' : '#EF4444' }}>{occPct}%</div>
                  <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: 600 }}>Física</div>
                </div>
                <div title="Tarifa Promedio Diaria" style={{ textAlign: 'center', background: isCurrent ? '#DBEAFE' : '#F8FAFC', padding: '10px 6px', borderRadius: 8, cursor: 'help' }}>
                  <div style={{ fontSize: 10, color: isCurrent ? '#1E40AF' : '#64748B', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>ADR</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#374151' }}>{currency(adr)}</div>
                  <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: 600 }}>Tarifa Promedio</div>
                </div>
              </div>

              {/* RENTABILIDAD & GOPPAR */}
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, border: '1px solid #E5E7EB', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#4B5563', fontWeight: 600 }}>Ingreso Base Real:</span>
                  <span style={{ fontWeight: 800, color: '#111' }}>{currency(m.trueRevenue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #E2E8F0' }}>
                  <span style={{ color: '#4B5563', fontWeight: 600 }}>Egresos Operativos:</span>
                  <span style={{ fontWeight: 800, color: '#EF4444' }}>-{currency(m.gastos)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#047857', background: '#D1FAE5', padding: '2px 8px', borderRadius: 6 }}>GANANCIA NETA</span>
                  <span style={{ fontWeight: 900, fontSize: 15, color: '#065F46' }}>{currency(netProfit)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Ind. GOPPAR</span>
                  <span style={{ fontWeight: 800, fontSize: 12, color: '#3B82F6' }}>{currency(goppar)}</span>
                </div>
              </div>

              {/* ── RENDIMIENTO: REVPAR SEGMENTADO Y GLOBAL ── */}
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', border: '1px solid #E5E7EB', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>RevPAR Segmentado</span>
                  <span style={{ fontSize: 9, color: '#9CA3AF' }}>Ingreso x Hab.</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <div style={{ background: '#FFFBEB', border: '1px solid #FEF3C7', padding: '8px 4px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#D97706', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>Dom - Mié</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#92400E' }}>{currency(revparEntre)}</div>
                  </div>
                  <div style={{ background: '#F5F3FF', border: '1px solid #EDE9FE', padding: '8px 4px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#7C3AED', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>Jue - Sáb</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#5B21B6' }}>{currency(revparFinde)}</div>
                  </div>
                  <div title="Ingreso por Habitación Disponible" style={{ background: isCurrent ? '#DBEAFE' : '#fff', border: `1px solid ${isCurrent ? '#BFDBFE' : '#E5E7EB'}`, padding: '8px 4px', borderRadius: 8, textAlign: 'center', cursor: 'help' }}>
                    <div style={{ fontSize: 9, color: isCurrent ? '#1E40AF' : '#4B5563', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>Global</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: isCurrent ? '#1D4ED8' : '#111' }}>{currency(revpar)}</div>
                  </div>
                </div>
              </div>

              {/* DESGLOSE DE INVENTARIO */}
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', border: '1px solid #E5E7EB', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Segmentación Física</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, alignItems: 'center' }}>
                  <span style={{ color: '#4B5563', fontWeight: 600 }}>Matrimonial <span style={{ opacity: 0.6 }}>(P6)</span></span>
                  <div style={{ textAlign: 'right' }}><span style={{ color: oMat > 60 ? '#10B981' : '#F59E0B', fontWeight: 800, marginRight: 6 }}>{oMat}%</span><span style={{ fontWeight: 700, color: '#111' }}>{currency(rMat)}</span></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, alignItems: 'center' }}>
                  <span style={{ color: '#4B5563', fontWeight: 600 }}>King <span style={{ opacity: 0.6 }}>(P4)</span></span>
                  <div style={{ textAlign: 'right' }}><span style={{ color: oKing > 60 ? '#10B981' : '#F59E0B', fontWeight: 800, marginRight: 6 }}>{oKing}%</span><span style={{ fontWeight: 700, color: '#111' }}>{currency(rKing)}</span></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, alignItems: 'center' }}>
                  <span style={{ color: '#4B5563', fontWeight: 600 }}>Privadas <span style={{ opacity: 0.6 }}>(P1, P2, P3, P5)</span></span>
                  <div style={{ textAlign: 'right' }}><span style={{ color: oComp > 60 ? '#10B981' : '#F59E0B', fontWeight: 800, marginRight: 6 }}>{oComp}%</span><span style={{ fontWeight: 700, color: '#111' }}>{currency(rComp)}</span></div>
                </div>
              </div>

              {/* FLUJO DE CAJA (FACTURADO) */}
              <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: '#6B7280', fontWeight: 600 }}>Flujo Facturado:</span>
                  <span style={{ fontWeight: 700, color: '#111' }}>{currency(m.total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: '#6B7280', fontWeight: 600 }}>Cobrado:</span>
                  <span style={{ fontWeight: 700, color: '#10B981' }}>{currency(m.paid)}</span>
                </div>
                <div style={{ height: 4, background: '#F3F4F6', borderRadius: 4, marginBottom: 8 }}>
                  <div style={{ height: '100%', background: '#10B981', borderRadius: 4, width: `${pct}%` }} />
                </div>
              </div>

              {/* ── REVENUE INTELLIGENCE (IA) ── */}
              <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: 14, marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ✨ Asesor Estratégico IA
                  </div>
                  {!aiInsights[m.key] ? (
                    <button
                      onClick={() => analizarRevenue(m, { trueRevenue: m.trueRevenue, gastos: m.gastos, occPct, adr, revpar, goppar, revparEntre, revparFinde, oMat, oKing, oComp })}
                      disabled={analyzingMonth === m.key}
                      style={{
                        background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: analyzingMonth === m.key ? 'wait' : 'pointer', opacity: analyzingMonth === m.key ? 0.7 : 1
                      }}
                    >
                      {analyzingMonth === m.key ? 'Analizando...' : 'Generar Diagnóstico'}
                    </button>
                  ) : (
                    <button
                    onClick={() => setInsightModal({ title: `Diagnóstico de ${m.label}`, content: aiInsights[m.key], monthKey: m.key })}
                      style={{
                        background: '#4F46E5', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 4px rgba(79,70,229,.3)'
                      }}
                    >
                      📖 Leer Diagnóstico
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#374151' }}>Totales por Propiedad</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {properties.map((prop) => {
          const pRes = reservations.filter((r) => r.propertyId === prop.id && r.status !== 'cancelada');
          const total = pRes.reduce((s, r) => s + r.totalAmount, 0);
          const paid = pRes.reduce((s, r) => s + r.paid, 0);
          const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
          return (
            <div key={prop.id} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #F0F0F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 22 }}>{prop.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{prop.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{pRes.length} reservas históricas</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>{currency(total)}</div>
                  <div style={{ fontSize: 11, color: total - paid > 0 ? '#EF4444' : '#10B981' }}>Pendiente: {currency(total - paid)}</div>
                </div>
              </div>
              <div style={{ height: 6, background: '#F3F4F6', borderRadius: 4 }}>
                <div style={{ height: '100%', background: prop.color, borderRadius: 4, width: pct + '%', transition: 'width .3s' }} />
              </div>
            </div>
          );
        })}
      </div>

      <h3 id="seccion-saldos-pendientes" style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#374151' }}>Huéspedes con saldos pendientes</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pending.map((r) => {
          const prop = properties.find((p) => p.id === r.propertyId);
          return (
            <div key={r.id} onClick={() => onGoTo && onGoTo('abrir_reserva', r)} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #F0F0F0', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{r.guestName}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{prop?.name} · CI: {fmtD(r.checkIn)}</div>
              </div>
              <div style={{ fontWeight: 800, color: '#EF4444', fontSize: 16 }}>{currency(r.totalAmount - r.paid)}</div>
            </div>
          );
        })}
        {pending.length === 0 && <div style={{ textAlign: 'center', color: '#D1D5DB', padding: 30, fontSize: 13 }}>✅ Sin saldos pendientes</div>}
      </div>

      {/* ── POP-UP DEL DIAGNÓSTICO IA ── */}
      {insightModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.3)' }}>
            
            {/* ENCABEZADO FIJO */}
            <div style={{ background: '#EEF2FF', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #C7D2FE', flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#312E81', display: 'flex', alignItems: 'center', gap: 8 }}>
                ✨ {insightModal.title}
              </div>
              <button onClick={() => setInsightModal(null)} style={{ background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer', color: '#4F46E5', lineHeight: 1 }}>×</button>
            </div>
            
                        {/* ÁREA DE LECTURA CON SCROLL BLINDADO */}
            <div style={{ padding: '24px 20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', flex: 1 }}>
              {insightModal.content}

              {(chatMessages[insightModal.monthKey] || []).slice(2).map((msg, i) => (
                <div key={i} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #E5E7EB' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: msg.role === 'user' ? '#4F46E5' : '#059669', textTransform: 'uppercase', marginBottom: 4 }}>
                    {msg.role === 'user' ? 'Tu pregunta' : 'Respuesta'}
                  </div>
                  <div>{msg.content}</div>
                </div>
              ))}

              {chatLoading && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #E5E7EB', color: '#9CA3AF', fontStyle: 'italic' }}>
                  Pensando...
                </div>
              )}
            </div>

            {/* PIE DE PÁGINA FIJO */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #F0F0F0', background: '#F8FAFC', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Preguntale algo a Claude sobre este diagnóstico..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !chatLoading) enviarPregunta(); }}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit' }}
                />
                <button
                  onClick={enviarPregunta}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{ background: '#4F46E5', color: '#fff', padding: '10px 16px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: chatLoading ? 'wait' : 'pointer', fontSize: 13, opacity: (chatLoading || !chatInput.trim()) ? 0.6 : 1 }}
                >
                  Preguntar
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setInsightModal(null)} style={{ background: 'transparent', color: '#6B7280', padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
// ── APP ───────────────────────────────────────────────────────────────────────
export default function AppMejorada() {
  const [user, setUser] = useState(null);
  const [res, setRes] = useState(INIT_RES);
  const [tab, setTab] = useState('dashboard');
  const [highlightStatus, setHighlightStatus] = useState(null);
  const winW = useW();
  const isMobile = winW < 769;
  const isTablet = winW >= 769 && winW < 1280;

  // 1. CARGA DE DATOS Y VIGILANTE DE INICIO
  useEffect(() => {
    const fetchReservas = async () => {
      const { data, error } = await supabase
        .from('reservas')
        .select('*')
        .is('fecha_eliminacion', null);

      if (error) {
        console.error('Error al cargar reservas:', error);
        return;
      }

      // Hora actual estricta en Progreso, Yucatán
      const nowMerida = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Merida" }));
      const horaActual = nowMerida.getHours();
      const hoyFmt = fmt(nowMerida);

      const reservasCargadas = data.map((item) => {
        const nacionalidad = item.nacionalidad || 'MX';
        const pais = COUNTRIES.find((c) => c.code === nacionalidad);
        const prefijo = pais ? pais.prefix : '+52';

        let telefonoLimpio = item.telefono || '';
        if (telefonoLimpio.startsWith(prefijo)) {
          telefonoLimpio = telefonoLimpio.replace(prefijo, '').trim();
        }

        let estado = item.estado || 'por_llegar';
        let fechaCheckout = item.fecha_salida || '';

        // ── AUTO CHECK-OUT AL CARGAR LA APP (Si ya pasaron las 11:00 AM) ──
        if (horaActual >= 14 && estado === 'hospedado' && fechaCheckout <= hoyFmt) {
            estado = 'finalizada';
            supabase.from('reservas').update({ estado: 'finalizada' }).eq('id', item.id).then();
        }

        return {
          id: item.id,
          propertyId: item.propiedad || 'hostel',
          guestName: item.huesped || '',
          room: item.habitacion || '',
          checkIn: item.fecha_ingreso || '',
          checkOut: fechaCheckout,
          status: estado,
          totalAmount: Number(item.monto) || 0,
          paid: Number(item.monto_pagado) || 0,
          source: item.canal || 'Directo — Puerta',
          guestNationality: nacionalidad,
          guestDocType: item.tipo_doc || '',
          guestDoc: item.num_doc || '',
          guestPhonePrefix: prefijo,
          guestPhone: telefonoLimpio,
          guestEmail: item.email || '',
          totalGuests: Number(item.cantidad_huespedes) || 1,
          companions: item.acompanantes || [],
          paymentMethod: item.forma_pago || 'Efectivo',
          pin_acceso: item.pin_acceso || '',
          url_ine_frente: item.url_ine_frente || null,
          url_ine_dorso: item.url_ine_dorso || null,
          pricing: {
                ratePerNight: Number(item.tarifa_base) || 0,
                discountType: item.tipo_descuento || (Number(item.descuento) > 0 ? 'monto_fijo' : 'ninguno'),
                discountValue: Number(item.descuento) || 0,
                rateLabel: '',
                discountReason: item.motivo_descuento || '',
                additionals: Array.isArray(item.adicionales) ? item.adicionales : []
              },
          notes: item.notas || '',
          notas: item.notas || '',
          requiresInvoice: item.solicita_factura === 'true' || item.solicita_factura === true,
          solicita_factura: item.solicita_factura === 'true' || item.solicita_factura === true, // <--- ¡AQUÍ ESTÁ LA COMA QUE FALTABA!
          lista_negra: item.lista_negra === true || item.lista_negra === 'true'
        };
      });

      setRes(reservasCargadas);
    };

    fetchReservas();

    const canalReservas = supabase
      .channel('cambios-en-vivo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        (payload) => {
          setTimeout(() => {
            fetchReservas(); 
          }, 500);
        }
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchReservas();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(canalReservas);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // 2. VIGILANTE SILENCIOSO EN TIEMPO REAL (Por si la App queda abierta)
  useEffect(() => {
    const vigilante = setInterval(() => {
      const nowMerida = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Merida" }));
      
      if (nowMerida.getHours() >= 14) {
        const hoyFmt = fmt(nowMerida);
        
        setRes((prevRes) => {
          const paraHacerCheckout = prevRes.filter(r => r.status === 'hospedado' && r.checkOut <= hoyFmt);
          
          if (paraHacerCheckout.length === 0) return prevRes; // Todo en orden
          
          console.log(`⏰ 14:00 pm en Mérida: Haciendo check-out automático para ${paraHacerCheckout.length} reservas.`);
          
          // Actualiza en Supabase silenciosamente
          paraHacerCheckout.forEach(r => {
            supabase.from('reservas').update({ estado: 'finalizada' }).eq('id', r.id).then();
          });

          // Actualiza visualmente en tiempo real
          return prevRes.map(r => 
            paraHacerCheckout.some(pc => pc.id === r.id) 
              ? { ...r, status: 'finalizada', checkOutAt: nowMerida.toISOString() } 
              : r
          );
        });
      }
    }, 60000); // Revisa cada minuto

    return () => clearInterval(vigilante);
  }, []);

  // Estados restaurados: Las "memorias" que controlan tu interfaz
  const [drawer, setDrawer] = useState(null);
  const [modal, setModal] = useState(null);
  const [ciModal, setCiModal] = useState(null);
  const [coModal, setCoModal] = useState(null);
  const [propStatus, setPropStatus] = useState({});
  const [notes, setNotes] = useState({});
  // Estado dinámico para el Checklist Editable por propiedad
  const [checklists, setChecklists] = useState({
    hostel: {
      items: [
        'Cambio de sábanas y toallas',
        'Limpieza profunda de baño',
        'Barrido y trapeado de pisos',
        'Vaciado de basureros',
        'Reposición de papel y amenidades',
        'Revisión de luces y aire acondicionado'
      ],
      checked: {} // Guarda las tareas que ya se completaron (índice: true/false)
    }
  });
  const [calView, setCalView] = useState('timeline');
  const [prefill, setPrefill] = useState({});
  const [toastMsg, setToastMsg] = useState(null); 
  const [calOffset, setCalOffset] = useState(-2);  

  // 1. Verificación de Login
  if (!user) return <Login onLogin={setUser} />;

  // 2. Definición de permisos y datos
  const visProps =
    user.role === 'admin'
      ? PROPS
      : PROPS.filter((p) => user.ownedProps.includes(p.id));
  const visRes = res.filter(
    (r) => visProps.some((p) => p.id === r.propertyId) && !r.deleted
  );
  const propsWS = visProps;
  const effectiveCalView = calView;
  const initProp = visProps[0]?.id;

  // 3. Pestañas permitidas
  const TABS_ALL = [
    { id: 'dashboard', label: 'Inicio', icon: 'home' },
    { id: 'calendario', label: 'Calendario', icon: 'calendar' },
    { id: 'reservas', label: 'Reservas', icon: 'list' },
    { id: 'propiedades', label: 'Propiedades', icon: 'building' },
    { id: 'huespedes', label: 'Huéspedes', icon: 'users' },
    { id: 'finanzas', label: 'Finanzas', icon: 'finance' },
  ];
  const TABS =
    user.role === 'staff'
      ? TABS_ALL.filter((t) => t.id !== 'finanzas')
      : TABS_ALL;

  // Funciones operativas restauradas
  const openAdd = (pid = '', date = '') => {
    setPrefill({ pid, date });
    setModal('new');
  };
  const goTo = (newTab, data) => {
    if (newTab === 'abrir_reserva') {
      setDrawer(data);
    } else {
      setTab(newTab);
      if (typeof data === 'string') {
        setHighlightStatus(data);
        setTimeout(() => setHighlightStatus(null), 2700);
      }
    }
  };
  const saveRes = async (newRes) => {
    try {
      // Evaluamos si el tilde está activo en cualquiera de sus variantes
      const tieneFactura = newRes.requiresInvoice === true || newRes.requiresInvoice === 'true' || newRes.solicita_factura === true || newRes.solicita_factura === 'true';
      
      // Limpieza preventiva antes de guardar por si el usuario repitió el prefijo a mano
      let telefonoLimpioGuardar = (newRes.guestPhone || '').trim();
      if (newRes.guestPhonePrefix && telefonoLimpioGuardar.startsWith(newRes.guestPhonePrefix)) {
        telefonoLimpioGuardar = telefonoLimpioGuardar.replace(newRes.guestPhonePrefix, '').trim();
      }

      const datosLimpios = {
          huesped: newRes.guestName || 'Sin nombre',
          habitacion: newRes.room || null,
          fecha_ingreso: newRes.checkIn,
          fecha_salida: newRes.checkOut,
          estado: newRes.status || 'por_llegar',
          monto: String(newRes.totalAmount || ''),
          monto_pagado: String(newRes.paid || ''),
          canal: newRes.source || 'Directo — Puerta',
          nacionalidad: newRes.guestNationality || '',
          tipo_doc: newRes.guestDocType || '',
          num_doc: newRes.guestDoc || '',
          telefono: newRes.guestPhonePrefix ? `${newRes.guestPhonePrefix} ${telefonoLimpioGuardar}` : telefonoLimpioGuardar,
          email: newRes.guestEmail || '',
          cantidad_huespedes: String(newRes.totalGuests || 1),
          acompanantes: newRes.companions || [],
          forma_pago: newRes.paymentMethod || 'Efectivo',
          notas: String(newRes.notes || newRes.notas || ''),
          url_ine_frente: newRes.url_ine_frente || null,
          url_ine_dorso: newRes.url_ine_dorso || null,
          tarifa_base: String(newRes.pricing?.ratePerNight || ''),
          descuento: String(newRes.pricing?.discountValue || 0),
          tipo_descuento: newRes.pricing?.discountType || 'ninguno',
          motivo_descuento: newRes.pricing?.discountReason || '',
          adicionales: newRes.pricing?.additionals || [],
            solicita_factura: tieneFactura ? 'true' : 'false',  
            lista_negra: newRes.lista_negra || false,
            pin_acceso: newRes.pin_acceso || ''
          };

        // Mantenemos duplicados los formatos en el estado de React para no romper las vistas
        const reservaParaEstado = {
          ...newRes,
          notes: newRes.notes || newRes.notas || '',
          notas: newRes.notes || newRes.notas || '',
          requiresInvoice: tieneFactura,
          solicita_factura: tieneFactura, 
          lista_negra: newRes.lista_negra || false,
          pin_acceso: newRes.pin_acceso || ''
        };

      if (newRes.id) {
        // 1. EDICIÓN
        const { error } = await supabase
          .from('reservas')
          .update(datosLimpios)
          .eq('id', newRes.id);

        if (error) throw error;
        setRes(res.map((r) => (r.id === newRes.id ? reservaParaEstado : r)));

      } else {
        // 2. NUEVA RESERVA
        const momentoExacto = new Date().toLocaleString('es-MX', {
          timeZone: 'America/Merida',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
        const responsable = user?.name || 'Usuario desconocido';

        datosLimpios.fecha_carga = momentoExacto;
        datosLimpios.usuario_carga = responsable;

        const { data, error } = await supabase
          .from('reservas')
          .insert([datosLimpios])
          .select();

        if (error) throw error;

        reservaParaEstado.fecha_carga = momentoExacto;
        reservaParaEstado.usuario_carga = responsable;

       if (data && data.length > 0) {
          setRes([...res, { ...reservaParaEstado, id: data[0].id }]);
        } else {
          setRes([...res, { ...reservaParaEstado, id: 'r' + Date.now() }]);
        }
      }

      setModal(null);
      
      setModal(null);
      
      // ¡LA MAGIA DEL SALTO! Calculamos la distancia en días y movemos el calendario
      const diasDistancia = diffDays(fmt(TODAY), newRes.checkIn);
      setCalOffset(diasDistancia - 2); // Lo centramos dejando 2 días de margen a la izquierda
      setTab('calendario'); // Forzamos ir a la pestaña del calendario para ver la reserva
      
      // Lanzamos el cartel flotante y lo borramos a los 2 segundos
      setToastMsg('Reserva guardada');
      setTimeout(() => setToastMsg(null), 2000);

    } catch (err) {
      console.error('Error al conectar con la base de datos:', err);
      alert('Hubo un problema al guardar la reserva en la nube: ' + err.message);
    }
  };
  const updateRes = async (id, changes) => {
    // 1. Movemos la reserva visualmente al instante para que la app se sienta rápida
    setRes(res.map((r) => (r.id === id ? { ...r, ...changes } : r)));

    // 2. Le mandamos los datos a la nube para que las demás pantallas se enteren
      const { error } = await supabase
        .from('reservas')
        .update({
          fecha_ingreso: changes.checkIn,
          fecha_salida: changes.checkOut,
          habitacion: changes.room
        })
        .eq('id', id);

    if (error) {
      console.error('Error al sincronizar el movimiento:', error);
      alert('Hubo un error al guardar el movimiento en la nube. Revisá tu conexión.');
    }
  };
  const delRes = async (id) => {
    // Capturamos la fecha y hora exacta con la zona horaria de Progreso, Yucatán
    const momentoExacto = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Merida',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });

    const responsable = user?.name || 'Usuario desconocido';

    // 1. Borrado Lógico en Supabase
    const { error } = await supabase
      .from('reservas')
      .update({ 
        estado: 'eliminada',
        fecha_eliminacion: momentoExacto,
        usuario_eliminacion: responsable
      })
      .eq('id', id);

    if (error) {
      console.error('Error al archivar en Supabase:', error);
      alert('Hubo un problema al intentar borrar la reserva.');
      return;
    }

    // 2. La sacamos de la vista inmediatamente
    setRes(res.filter((r) => r.id !== id));
    setDrawer(null);
  };
  const restoreRes = async (id) => {
    // 1. Le avisamos a Supabase que la reserva vuelve a la vida
    const { error } = await supabase
      .from('reservas')
      .update({ 
        estado: 'por_llegar', 
        fecha_eliminacion: null, 
        usuario_eliminacion: null 
      })
      .eq('id', id);

    if (error) {
      console.error('Error al restaurar:', error);
      alert('Hubo un problema al restaurar la reserva.');
      return;
    }

    // 2. La revivimos en la pantalla
    setRes(
      res.map((r) =>
        r.id === id
          ? { ...r, deleted: false, status: 'por_llegar', deletedAt: null, deletedBy: null }
          : r
      )
    );
  };
const toggleBlacklist = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from('reservas')
      .update({ lista_negra: newStatus })
      .eq('id', id);

    if (error) {
      alert('Error al actualizar la lista negra en la nube.');
      return;
    }

    // 1. Actualiza la lista general de reservas (el fondo y el calendario)
    setRes(res.map(r => r.id === id ? { ...r, lista_negra: newStatus } : r));

    // 2. ¡EL DETALLE VISUAL! Actualiza el panel abierto para que el botón reaccione al instante
    setDrawer(prev => prev && prev.id === id ? { ...prev, lista_negra: newStatus } : prev);
  };
  const handleCI = (r) => {
    setDrawer(null);
    setCiModal(r);
  };
  const handleCO = (r) => {
    setDrawer(null);
    setCoModal(r);
  };
  const confCI = async (time) => {
    if (!ciModal) return;
    const targetId = ciModal.id;

    // 1. Actualizamos la vista local de inmediato para una experiencia fluida
    setRes(
      res.map((x) =>
        x.id === targetId ? { ...x, status: 'hospedado', checkInAt: time } : x
      )
    );
    setCiModal(null);

    // 2. Impactamos en la base de datos de Supabase de manera segura
    await supabase.from('reservas').update({ estado: 'hospedado' }).eq('id', targetId);
  };

  const confCO = async (time) => {
    if (!coModal) return;
    const targetId = coModal.id;

    // 1. Actualizamos la vista local
    setRes(
      res.map((x) =>
        x.id === targetId
          ? {
              ...x,
              status: 'finalizada',
              checkOutAt: time,
            }
          : x
      )
    );
    setCoModal(null);

    // 2. Impactamos en la base de datos de Supabase
    await supabase.from('reservas').update({ estado: 'finalizada' }).eq('id', targetId);
  };

  // 4. EL DISEÑO VISUAL (Ahora sí, adentro de la función principal)
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <style>{`
        /* Reset y Tipografía Global */
        *, *::before, *::after { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif !important; }
        html, body, #root { margin: 0 !important; padding: 0 !important; max-width: 100% !important; width: 100%; background: #F8FAFC; color: #111; overflow: hidden; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
        input[type=date]::-webkit-calendar-picker-indicator { opacity: .4; }
        button, input, select, textarea { font-family: inherit; }
        
        /* Sistema de Layout Responsivo (CSS Puro) */
        .app-layout { display: flex; width: 100%; height: calc(100vh - 54px); }
        .sidebar { display: flex; flex-direction: column; flex-shrink: 0; background: #fff; border-right: 1px solid #F0F0F0; height: 100%; overflow-y: auto; transition: width 0.2s ease; }
        
        /* Contenido principal ocupando 100% con scroll independiente */
        .main-content { flex: 1; min-width: 0; padding: 16px; height: 100%; overflow-y: auto; transition: padding 0.2s ease; }
        
        /* Ocultar menú inferior en escritorio */
        .bn { display: none; } 
        
        /* Animación Modal Bottom Sheet para Mobile */
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

        /* Desktop Amplio (>1280px) */
        @media (min-width: 1281px) { .sidebar { width: 220px; padding: 24px 16px; } }

        /* Desktop Regular y Tablet (769px - 1280px) */
        @media (min-width: 769px) and (max-width: 1280px) {
          .sidebar { width: 64px; padding: 20px 8px; align-items: center; }
          .sl, .sa { display: none !important; }
        }

        /* Mobile (<768px) */
        @media (max-width: 768px) {
          html, body, #root { overflow-y: auto !important; overflow-x: hidden !important; }
          .app-layout { height: auto; min-height: calc(100vh - 54px); }
          .sidebar { display: none !important; }
          .main-content { padding: 16px 12px 100px !important; overflow-y: visible; }
          .bn { display: flex !important; position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #E5E7EB; z-index: 99; padding-bottom: env(safe-area-inset-bottom, 12px); box-shadow: 0 -2px 10px rgba(0,0,0,0.03); }
        }

      /* 📱 OPTIMIZACIÓN MOBILE LANDSCAPE (CELULAR ACOSTADO) */
        @media (orientation: landscape) and (max-width: 950px) {
          /* 1. Ocultamos barra blanca superior y el menú inferior */
          .top-nav { display: none !important; } 
          .bn { display: none !important; } 
          
          /* 2. Forzamos la barra lateral izquierda (versión mini con iconos) */
          .sidebar { 
            display: flex !important; 
            width: 70px !important; 
            padding: 10px 8px !important;
            padding-left: env(safe-area-inset-left, 12px) !important; 
            align-items: center !important; 
          }
          .sl, .sa { display: none !important; } 
          
          html, body, #root, .app-layout { 
            padding: 0 !important; 
            margin: 0 !important; 
            min-height: 100vh !important; 
            background: #fff !important; 
          }
          
          /* 3. SEPARAMOS LOS MÁRGENES PARA QUE SAFARI NO LOS IGNORE */
          .main-content { 
            padding-top: 0 !important; 
            padding-bottom: 0 !important;
            padding-left: 0 !important;
            padding-right: env(safe-area-inset-right, 16px) !important;
            margin: 0 !important; 
            border: none !important; 
          } 
          
          /* 4. Aplasta el contenedor principal contra el techo */
          .main-content > div { 
            margin-top: 0 !important; 
            padding-top: 10px !important; /* Apenas 10px para que no choque el título */
            border-radius: 0 !important; 
            border: none !important; 
            box-shadow: none !important; 
          }

          /* 5. Comprime el encabezado (Título "Calendario" y botones) */
          .main-content > div > div:first-child {
            margin-bottom: 8px !important; 
          }
        }
      `}</style>

      {/* Navbar Superior */}
      <div
        className="top-nav"
        style={{
          background: '#fff',
          borderBottom: '1px solid #F0F0F0',
          padding: '0 16px',
          height: 54,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img src="https://i.postimg.cc/3NDCCVdT/gecko2.png" alt="Itzé" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          </div>
          <div>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>
              Itzé Flow Pro
            </span>
            {isMobile && (
              <div
                style={{
                  fontSize: 10,
                  color: '#9CA3AF',
                  lineHeight: 1,
                  marginTop: 1,
                }}
              >
                Itzé Hostel Boutique
              </div>
            )}
          </div>
          {!isMobile && (
            <>
              {user.role === 'owner' && (
                <span
                  style={{
                    fontSize: 11,
                    background: '#EDE9FE',
                    color: '#7C3AED',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  Propietario
                </span>
              )}
              {user.role === 'admin' && (
                <span
                  style={{
                    fontSize: 11,
                    background: '#DBEAFE',
                    color: '#1E40AF',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  Admin
                </span>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMobile ? (
            <button
              onClick={() => openAdd()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 12px',
                background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Nueva
            </button>
          ) : (
            <>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                {user.name}
              </span>
              <button
                onClick={() => setUser(null)}
                style={{
                  background: '#F3F4F6',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#6B7280',
                  cursor: 'pointer',
                }}
              >
                Salir
              </button>
            </>
          )}
        </div>
      </div>

      <div className="app-layout">
        {/* Sidebar Lateral */}
        <div className="sidebar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={isTablet ? t.label : ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: isTablet ? '10px' : '9px 12px',
                  borderRadius: 9,
                  border: 'none',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  background: tab === t.id ? '#EFF6FF' : 'transparent',
                  color: tab === t.id ? '#2563EB' : '#6B7280',
                  textAlign: 'left',
                  justifyContent: isTablet ? 'center' : 'flex-start',
                }}
              >
                <span style={{ display: 'flex', flexShrink: 0 }}>
                  <Icon name={t.icon} size={20} />
                </span>
                <span
                  className="sl"
                  style={{ display: isTablet ? 'none' : 'inline' }}
                >
                  {t.label}
                </span>
              </button>
            ))}
            <div
              style={{
                borderTop: '1px solid #F0F0F0',
                margin: '12px 0',
                paddingTop: 12,
              }}
            >
              <button
                onClick={() => openAdd()}
                title={isTablet ? 'Nueva reserva' : ''}
                style={{
                  width: '100%',
                  padding: isTablet ? '10px' : '9px 12px',
                  background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
                  border: 'none',
                  borderRadius: 9,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(99,102,241,.3)',
                }}
              >
                +{' '}
                <span
                  className="sa"
                  style={{ display: isTablet ? 'none' : 'inline' }}
                >
                  Nueva reserva
                </span>
              </button>
            </div>
            {!isTablet && (
              <button
                onClick={() => setUser(null)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 9,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: 12,
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                ↩ Cerrar sesión
              </button>
            )}
          </div>
        </div>

        {/* Contenido Principal Dinámico */}
        <div className="main-content" key={tab}>
          {tab === 'dashboard' && (
            <Dashboard
              user={user}
              reservations={visRes}
              properties={propsWS}
              propStatus={propStatus}
              setPropStatus={setPropStatus}
              onGoTo={goTo}
            />
          )}
          {tab === 'calendario' && (
            <Timeline
              reservations={visRes}
              properties={propsWS}
              onClickRes={(r) => setDrawer(r)}
              onAddRes={openAdd}
              onUpdateRes={updateRes}
              isMobile={isMobile}
              calView={effectiveCalView}
              setCalView={setCalView}
              offset={calOffset}
              setOffset={setCalOffset}
              highlightStatus={highlightStatus}
            />
          )}
          {tab === 'reservas' && (
            <ResList
              reservations={visRes}
              properties={visProps}
              onView={(r) => setDrawer(r)}
              onAdd={openAdd}
            />
          )}
          {tab === 'propiedades' && (
            <PropertiesPage
              properties={visProps}
              reservations={visRes}
              notes={notes}
              setNotes={setNotes}
              checklists={checklists}
              setChecklists={setChecklists}
              propStatus={propStatus}
              setPropStatus={setPropStatus}
              initProp={initProp}
              onGoTo={goTo}
            />
          )}
          {tab === 'huespedes' && (
            <GuestsPage
              reservations={visRes}
              properties={visProps}
              onView={(r) => setDrawer(r)}
            />
          )}
          {tab === 'finanzas' && (
            <FinancePage
              reservations={visRes}
              allRes={res}
              properties={visProps}
              user={user}
              restoreRes={restoreRes}
              onGoTo={goTo}
            />
          )}
        </div>
      </div>

      {/* Menú inferior Mobile DESLIZABLE con filtro de seguridad */}
      <div
        className="bn"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #F0F0F0',
          zIndex: 99,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 8px) + 20px)',
          display: 'flex',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, // Ahora se distribuyen equitativamente sin salirse
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '8px 2px 4px',
              minHeight: 52,
            }}
          >
            <span
              style={{
                display: 'flex',
                color: tab === t.id ? '#2563EB' : '#9CA3AF',
              }}
            >
              <Icon name={t.icon} size={22} />
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: tab === t.id ? '#2563EB' : '#9CA3AF',
                marginTop: 1,
              }}
            >
              {t.label}
            </span>
            {tab === t.id && (
              <div
                className="nav-indicator"
                style={{
                  width: 20,
                  height: 2.5,
                  background: '#2563EB',
                  borderRadius: 4,
                  marginTop: 2,
                }}
              />
            )}
          </button>
        ))}
      </div>

     {/* Modales y Paneles flotantes */}
      {drawer && (
        <ResDrawer
          res={drawer}
          onClose={() => setDrawer(null)}
          onEdit={(r) => {
            setModal({ type: 'edit', data: r });
            setDrawer(null);
          }}
          onDelete={(id) => setModal({ type: 'confirmDel', id })}
          onToggleBlacklist={toggleBlacklist}
          properties={visProps}
          allRes={res}
          isMobile={isMobile}
          onCheckIn={handleCI}
          onCheckOut={handleCO}
        />
      )}
      {modal?.type === 'confirmDel' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 360,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                background: '#FEF2F2',
                padding: '18px 22px',
                borderBottom: '1px solid #FECACA',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#991B1B' }}>
                🗑 ¿Eliminar reserva?
              </div>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151' }}>
                La reserva <b>no se borrará definitivamente</b>. Quedará en la
                papelera y solo el administrador podrá recuperarla.
              </p>
              <p style={{ margin: '0 0 20px', fontSize: 12, color: '#9CA3AF' }}>
                Para eliminar permanentemente, contactá al administrador.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#374151',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    delRes(modal.id);
                    setModal(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#FEF2F2',
                    border: '1.5px solid #FECACA',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#DC2626',
                  }}
                >
                  Mover a papelera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {modal === 'new' && (
        <Modal
          title="Nueva reserva"
          onClose={() => setModal(null)}
          isMobile={isMobile}
        >
          <ResForm
            visibleProps={visProps}
            onSave={saveRes}
            onClose={() => setModal(null)}
            prefillProp={prefill.pid}
            prefillDate={prefill.date}
            allRes={res}
          />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal
          title="Editar reserva"
          onClose={() => setModal(null)}
          isMobile={isMobile}
        >
          <ResForm
            initial={modal.data}
            visibleProps={visProps}
            onSave={saveRes}
            onClose={() => setModal(null)}
            allRes={res}
          />
        </Modal>
      )}
     {/* MODAL DE CONFIRMACIÓN CHECK-IN */}
      {ciModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 380,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                background: '#10B981',
                padding: '16px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Confirmar Check-in
              </div>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>
                ¿Confirmas el ingreso de <b>{ciModal.guestName}</b>?
              </p>
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>
                Esta acción marcará la reserva como "Hospedado" y registrará la hora de entrada.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCiModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#4B5563',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confCI(new Date().toISOString())}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#10B981',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#fff',
                  }}
                >
                  ✓ Check-in
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN CHECK-OUT */}
      {coModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 380,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                background: '#F59E0B',
                padding: '16px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Confirmar Check-out
              </div>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>
                ¿Confirmas la salida de <b>{coModal.guestName}</b>?
              </p>
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>
                La estadía pasará a "Finalizada" y se liberará la propiedad en el calendario.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCoModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#4B5563',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confCO(new Date().toISOString())}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F59E0B',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#fff',
                  }}
                >
                  📤 Check-out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* DISEÑO DEL CARTEL FLOTANTE (TOAST) */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? 90 : 40,
            left: 0,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: '#10B981',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 30,
              fontSize: 14,
              fontWeight: 800,
              boxShadow: '0 8px 16px rgba(16,185,129,.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              animation: 'slideUp 0.2s ease-out'
            }}
          >
            <span style={{ fontSize: 16 }}>✓</span> {toastMsg}
          </div>
        </div>
      )}

    </div>
  );
}
