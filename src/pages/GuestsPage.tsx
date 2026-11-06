/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { currency } from '../lib/dates';
import { waLink, buildGuestDB, freqBadge } from '../lib/guests';
import { DuplicateReview } from '../components/guests/DuplicateReview';

// ── GUESTS PAGE (DIRECTORIO CRM) ──────────────────────────────────────────────
export function GuestsPage({
  reservations,
  properties,
  onView,
  decisions = [],
  dupPairs = [],
  canReview = false,
  onDecide,
  onUndo,
}) {
  const [q, setQ] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Agrupamos el historial de los clientes (respetando las decisiones de duplicados)
  const gdb = buildGuestDB(reservations, decisions);
  
  // Filtramos por búsqueda (nombre o documento)
  const allGuests = Object.values(gdb).filter(g => 
    !q || 
    g.name.toLowerCase().includes(q.toLowerCase()) || 
    (g.doc && g.doc.toLowerCase().includes(q.toLowerCase()))
  );

  // Ordenamos por los que más dinero han dejado (los mejores clientes primero)
  allGuests.sort((a, b) => b.totalSpent - a.totalSpent);

  if (reviewing && canReview) {
    return (
      <DuplicateReview
        pairs={dupPairs}
        reservations={reservations}
        decisions={decisions}
        onDecide={onDecide}
        onUndo={onUndo}
        onClose={() => setReviewing(false)}
      />
    );
  }

  return (
    <div>
      {/* ── AVISO DE POSIBLES DUPLICADOS (solo admin) ── */}
      {canReview && dupPairs.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            background: '#FFFBEB',
            border: '1.5px solid #FDE68A',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
          }}
        >
          <div style={{ flex: '1 1 200px', fontSize: 13, color: '#92400E', fontWeight: 600 }}>
            🔎 Encontramos {dupPairs.length}{' '}
            {dupPairs.length === 1 ? 'posible huésped duplicado' : 'posibles huéspedes duplicados'}
          </div>
          <button
            onClick={() => setReviewing(true)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#F59E0B',
              color: '#fff',
              fontWeight: 800,
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Revisar
          </button>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#111' }}>Directorio CRM</h2>
        <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Gestión de fidelización y valor de clientes</p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o documento..."
        style={{
          width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10,
          fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 16, boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
        {allGuests.map((g, idx) => {
          const freq = freqBadge(g.visits);
          const lastRes = reservations.find(r => r.id === g.stays[g.stays.length - 1]);

          return (
            <div
              key={idx}
              onClick={() => lastRes && onView(lastRes)}
              style={{
                background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #E5E7EB',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10,
                boxShadow: '0 1px 3px rgba(0,0,0,.02)', transition: 'transform 0.1s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {g.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {g.doc || 'Sin DOC'}
                  </div>
                </div>
                {freq && (
                  <div style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color: freq.color, background: freq.bg, padding: '3px 6px', borderRadius: 6 }}>
                    {freq.label}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#F8FAFC', borderRadius: 6, padding: '8px 10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Visitas:</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#374151' }}>{g.visits}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Inversión:</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#10B981' }}>{currency(g.totalSpent)}</span>
                </div>
              </div>

              {g.phone && lastRes && (
                <a
                  href={waLink(g.phone, lastRes.guestPhonePrefix, lastRes.guestNationality)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    width: '100%', padding: '6px', borderRadius: 6, background: '#ECFDF5', color: '#059669',
                    textDecoration: 'none', fontWeight: 700, fontSize: 11, border: '1px solid #A7F3D0'
                  }}
                >
                  <Icon name="whatsapp" size={14} /> Enviar WhatsApp
                </a>
              )}
            </div>
          );
        })}
        
        {canReview && dupPairs.length === 0 && decisions.length > 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: 8 }}>
            <button
              onClick={() => setReviewing(true)}
              style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 11, color: '#9CA3AF', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Ver decisiones de duplicados ({decisions.length})
            </button>
          </div>
        )}

        {allGuests.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#D1D5DB', padding: 40, fontSize: 13 }}>
            No se encontraron clientes.
          </div>
        )}
      </div>
    </div>
  );
}
