/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from 'react';
import { Icon } from '../components/ui/Icon';
import { currency } from '../lib/dates';
import { waLink, buildGuestDB, freqBadge } from '../lib/guests';
import { DuplicateReview } from '../components/guests/DuplicateReview';
import { birthdayList, whenText, birthdayMessage, markGreeted, wasGreeted } from '../lib/guestMessages';

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
  focusBirthday = null, // desde Inicio: { key } del huésped que cumple hoy (o {} para abrir la lista)
}) {
  const [q, setQ] = useState('');
  // todos | empresa | particular (Empresa = tiene nombre de empresa cargado) | cumple (🎂 Cumpleaños)
  const [tipo, setTipo] = useState(focusBirthday ? 'cumple' : 'todos');
  const [flashKey, setFlashKey] = useState(null);
  const [, setTick] = useState(0); // re-dibuja al marcar "saludado"
  // Desde Inicio: abre Cumpleaños, baja hasta la tarjeta del que cumple y la resalta
  useEffect(() => {
    if (!focusBirthday) return undefined;
    setTipo('cumple');
    if (!focusBirthday.key) return undefined;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-gkey="${CSS.escape(focusBirthday.key)}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashKey(focusBirthday.key);
      setTimeout(() => setFlashKey(null), 2600);
    }, 350);
    return () => clearTimeout(t);
  }, [focusBirthday]);
  const [reviewing, setReviewing] = useState(false);

  // Agrupamos el historial de los clientes (respetando las decisiones de duplicados)
  const gdb = buildGuestDB(reservations, decisions);
  
  // Filtramos por tipo (Empresa / Particular) y por búsqueda (nombre, documento o empresa)
  const matchTipo = (g) => tipo === 'todos' || tipo === 'cumple' || (tipo === 'empresa' ? g.isCompany : !g.isCompany);
  const allGuests = Object.values(gdb).filter(g =>
    matchTipo(g) &&
    (!q ||
      g.name.toLowerCase().includes(q.toLowerCase()) ||
      (g.doc && g.doc.toLowerCase().includes(q.toLowerCase())) ||
      (g.company && g.company.toLowerCase().includes(q.toLowerCase())))
  );
  const nEmpresas = Object.values(gdb).filter((g) => g.isCompany).length;
  const nParticulares = Object.values(gdb).length - nEmpresas;

  // Cumpleaños (fecha de la CURP), del más cercano al más lejano
  const bdays = birthdayList(Object.values(gdb));
  const bdayOf = Object.fromEntries(bdays.map((x) => [x.g.key, x]));

  if (tipo === 'cumple') {
    // Solo los que tienen fecha, en orden de cumpleaños
    const keep = new Set(allGuests.map((g) => g.key));
    allGuests.length = 0;
    bdays.forEach((x) => keep.has(x.g.key) && allGuests.push(x.g));
  } else {
    // Ordenamos por los que más dinero han dejado (los mejores clientes primero)
    allGuests.sort((a, b) => b.totalSpent - a.totalSpent);
  }

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
        <div className="pop-in"
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
        placeholder="Buscar por nombre, documento o empresa..."
        style={{
          width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10,
          fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 10, boxSizing: 'border-box',
        }}
      />

      {/* Filtro Empresa (con nombre de empresa) / Particular */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { v: 'todos', label: 'Todos', bg: '#EFF6FF', txt: '#1E40AF' },
          { v: 'empresa', label: `🏢 Empresas (${nEmpresas})`, bg: '#EDE9FE', txt: '#5B21B6' },
          { v: 'particular', label: `👤 Particulares (${nParticulares})`, bg: '#F3F4F6', txt: '#374151' },
          { v: 'cumple', label: `🎂 Cumpleaños (${bdays.length})`, bg: '#FDF2F8', txt: '#9D174D' },
        ].map((o) => {
          const on = tipo === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => setTipo(o.v)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: `1.5px solid ${on ? o.txt : '#E5E7EB'}`,
                background: on ? o.bg : '#fff',
                color: on ? o.txt : '#6B7280',
                fontWeight: on ? 800 : 600,
                fontSize: 12,
                fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {tipo === 'cumple' && (
        <div style={{ fontSize: 12, color: '#6B7280', margin: '-6px 0 14px', lineHeight: 1.45 }}>
          {bdays.length
            ? 'Del más cercano al más lejano. La fecha sale de la CURP de la INE o de la fecha de nacimiento cargada (pasaportes). El día del cumple aparece "Saludar", que abre WhatsApp con el mensaje listo.'
            : 'Todavía no hay cumpleaños: la fecha sale de la CURP de la INE o de la fecha de nacimiento cargada en la reserva (pasaportes).'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
        {allGuests.map((g, idx) => {
          const freq = freqBadge(g.visits);
          const lastRes = reservations.find(r => r.id === g.stays[g.stays.length - 1]);
          // 🎂 En Cumpleaños, todos con su fecha; en las otras vistas, solo el que cumple hoy
          const bd = bdayOf[g.key];
          const showBd = bd && (tipo === 'cumple' || bd.next.days === 0);
          const greeted = bd && bd.next.days === 0 && wasGreeted(g.key);

          return (
            <div className="li-in"
              key={g.key || idx}
              data-gkey={g.key}
              onClick={() => lastRes && onView(lastRes)}
              style={{ '--i': idx,
                background: '#fff', borderRadius: 10, padding: '12px 14px',
                border: flashKey === g.key ? '2px solid #DB2777' : '1px solid #E5E7EB',
                outline: flashKey === g.key ? '4px solid #FBCFE8' : 'none',
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
                  {g.isCompany && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#5B21B6', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      🏢 {g.company || 'Empresa'}
                    </div>
                  )}
                </div>
                {freq && (
                  <div style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color: freq.color, background: freq.bg, padding: '3px 6px', borderRadius: 6 }}>
                    {freq.label}
                  </div>
                )}
              </div>

              {showBd && (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    background: bd.next.days === 0 ? '#FDF2F8' : '#FAFAFA',
                    border: `1px solid ${bd.next.days === 0 ? '#FBCFE8' : '#F0F0F0'}`,
                    borderRadius: 8, padding: '7px 10px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: bd.next.days === 0 ? '#9D174D' : '#374151' }}>
                      🎂 {whenText(bd.next)}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                      Cumple {bd.next.age}
                      {bd.staying ? ' · lo pasa en el hostel' : ''}
                    </div>
                  </div>
                  {/* Saludar solo el día del cumpleaños (antes sería un "feliz cumple" adelantado) */}
                  {g.phone && lastRes && bd.next.days === 0 && (
                    <a
                      href={`${waLink(g.phone, lastRes.guestPhonePrefix, lastRes.guestNationality)}?text=${encodeURIComponent(birthdayMessage(g.name, bd.lang, bd.staying))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (bd.next.days === 0) {
                          markGreeted(g.key);
                          setTick((t) => t + 1);
                        }
                      }}
                      style={{
                        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '5px 9px', borderRadius: 7, textDecoration: 'none', fontWeight: 700, fontSize: 11.5,
                        background: greeted ? '#fff' : '#DB2777', color: greeted ? '#9D174D' : '#fff',
                        border: greeted ? '1px solid #FBCFE8' : 'none',
                      }}
                    >
                      <Icon name="whatsapp" size={13} /> {greeted ? '✓ Saludado' : 'Saludar'}
                    </a>
                  )}
                </div>
              )}

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
            {tipo === 'empresa' && !q
              ? 'Todavía no hay empresas. Aparecen cuando una reserva pide factura y se escribe el nombre de la empresa.'
              : 'No se encontraron clientes.'}
          </div>
        )}
      </div>
    </div>
  );
}
