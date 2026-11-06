/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Badge } from '../components/ui/Badge';
import { Icon } from '../components/ui/Icon';
import { TODAY, fmt, fmtD, addDays, parseD, currency, MONTHS, DAYS } from '../lib/dates';
import { waLink } from '../lib/guests';

// ── RESERVATIONS LIST (AGENDA DIARIA ESTILO PULSE) ────────────────────────────
export function ResList({ reservations, properties, onView, onAdd }) {
  const [selectedDate, setSelectedDate] = useState(fmt(TODAY));
  const [q, setQ] = useState('');

  // Generamos un carrusel de 60 días (15 días al pasado y 45 al futuro)
  const ribbonDates = Array.from({ length: 60 }, (_, i) => addDays(TODAY, i - 15));

  // Auto-scroll para centrar el día seleccionado
  const centerOn = (dStr) => {
    const el = document.getElementById(`date-${dStr}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };
  useEffect(() => {
    if (!q) centerOn(selectedDate);
  }, [selectedDate, q]);

  // Mes que se está viendo en el carrusel (el del día que queda en el centro)
  const ribbonRef = useRef(null);
  const [viewMonth, setViewMonth] = useState(() => parseD(selectedDate));
  const [todayInView, setTodayInView] = useState(true);
  const updateViewMonth = () => {
    const box = ribbonRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const mid = r.left + r.width / 2;
    const kids = Array.from(box.children);
    // el día más cercano al centro de la tira
    let hit = kids[0];
    let best = Infinity;
    kids.forEach((k) => {
      const kr = k.getBoundingClientRect();
      const dist = Math.abs(kr.left + kr.width / 2 - mid);
      if (dist < best) { best = dist; hit = k; }
    });
    const tEl = document.getElementById(`date-${fmt(TODAY)}`);
    if (tEl) {
      const tr = tEl.getBoundingClientRect();
      setTodayInView(tr.right > r.left && tr.left < r.right);
    }
    const id = hit?.id?.replace('date-', '');
    if (!id) return;
    const d = parseD(id);
    setViewMonth((prev) =>
      prev && prev.getMonth() === d.getMonth() && prev.getFullYear() === d.getFullYear() ? prev : d
    );
  };
  useEffect(() => {
    // al abrir y al cambiar de día (después de que termine de desplazarse)
    const t = setTimeout(updateViewMonth, 400);
    return () => clearTimeout(t);
  }, [selectedDate, q]);
  const monthLabel = (() => {
    const m = viewMonth.toLocaleDateString('es-MX', { month: 'long' });
    return m.charAt(0).toUpperCase() + m.slice(1) + ' ' + viewMonth.getFullYear();
  })();
  const todayStr = fmt(TODAY);
  const goToday = () => {
    setSelectedDate(todayStr);
    centerOn(todayStr); // por si ya era hoy pero el carrusel quedó lejos
  };

  // Si hay búsqueda, mostramos lista plana. Si no, mostramos la Agenda del Día.
  const isSearching = q.length > 0;
  const searchedRes = isSearching
    ? reservations
        .filter((r) => r.guestName.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
    : [];

  // Lógica de Agenda del Día Seleccionado
  const llegadas = reservations.filter(r => r.checkIn === selectedDate && r.status !== 'cancelada');
  const salidas = reservations.filter(r => r.checkOut === selectedDate && r.status !== 'cancelada');
  const hospedados = reservations.filter(r => r.checkIn < selectedDate && r.checkOut > selectedDate && r.status !== 'cancelada');
  const canceladas = reservations.filter(r => r.checkIn === selectedDate && r.status === 'cancelada');

  // Componente interno para dibujar cada tarjetita de reserva
  const ResCard = ({ r }) => {
    const prop = properties.find((p) => p.id === r.propertyId);
    const saldo = r.totalAmount - r.paid;
    return (
      <div
        onClick={() => onView(r)}
        style={{
          background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #F0F0F0',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,.02)', marginBottom: 8, gap: 12
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          
          {/* Fila Principal: Nombre + Habitación Destacada + WhatsApp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{r.guestName}</div>
            
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

            {r.guestPhone && (
              <a
                href={waLink(r.guestPhone, r.guestPhonePrefix, r.guestNationality)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: '#ECFDF5',
                  color: '#059669',
                  border: '1px solid #A7F3D0',
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
                title="Enviar WhatsApp"
                onMouseOver={(e) => (e.currentTarget.style.background = '#D1FAE5')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#ECFDF5')}
              >
                <Icon name="whatsapp" size={14} />
              </a>
            )}
          </div>

          {/* Fila Secundaria: Propiedad */}
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
            {prop?.name}
          </div>

          {/* Fila Inferior: Fechas de Estadía */}
          <div style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', marginTop: 4, display: 'flex', gap: 6 }}>
            <span>CI: {fmtD(r.checkIn)}</span>
            <span>CO: {fmtD(r.checkOut)}</span>
          </div>
        </div>

        {/* Lado Derecho: Estado y Saldos */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <Badge status={r.status} />
          {saldo > 0 ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#EF4444' }}>Debe {currency(saldo)}</span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#10B981' }}>Pagado</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}>Agenda Diaria</h2>
        <button
          onClick={() => onAdd()}
          style={{
            padding: '8px 16px', background: '#3B82F6', border: 'none', borderRadius: 8,
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + Nueva
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre de huésped..."
        style={{
          width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10,
          fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 16, boxSizing: 'border-box',
        }}
      />

      {isSearching ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase' }}>
            Resultados de búsqueda ({searchedRes.length})
          </div>
          {searchedRes.map((r) => <ResCard key={r.id} r={r} />)}
          {searchedRes.length === 0 && <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>No se encontraron huéspedes.</div>}
        </div>
      ) : (
        <>
         {/* MES QUE SE ESTÁ VIENDO + IR A HOY */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>📅 {monthLabel}</div>
            <button
              type="button"
              onClick={goToday}
              style={{
                padding: '6px 14px',
                minHeight: 32,
                borderRadius: 20,
                border: '1.5px solid #3B82F6',
                // Azul lleno cuando estás lejos de hoy; contorno cuando ya estás en hoy
                background: selectedDate === todayStr && todayInView ? '#fff' : '#3B82F6',
                color: selectedDate === todayStr && todayInView ? '#3B82F6' : '#fff',
                fontWeight: 800,
                fontSize: 12,
                fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Ir a hoy
            </button>
          </div>

         {/* CARRUSEL DE FECHAS ESTILO PULSE */}
          <div ref={ribbonRef} onScroll={updateViewMonth} style={{ display: 'flex', overflowX: 'auto', gap: 8, paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid #E5E7EB', scrollBehavior: 'smooth' }} className="hide-scroll">
            {ribbonDates.map((d) => {
              const dStr = fmt(d);
              const isSelected = selectedDate === dStr;
              const isToday = fmt(TODAY) === dStr;
              const hasActivity = reservations.some(r => (r.checkIn === dStr || r.checkOut === dStr) && r.status !== 'cancelada');
              
              return (
                <div
                  id={`date-${dStr}`}
                  key={dStr}
                  onClick={() => setSelectedDate(dStr)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minWidth: 52, height: 68, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                    background: isSelected ? '#3B82F6' : isToday ? '#EFF6FF' : '#fff',
                    border: `1.5px solid ${isSelected ? '#3B82F6' : isToday ? '#BFDBFE' : '#E5E7EB'}`,
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: isSelected ? 'rgba(255,255,255,0.8)' : '#6B7280' }}>
                    {DAYS[d.getDay()]}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: isSelected ? '#fff' : '#111', lineHeight: 1.2 }}>
                    {d.getDate()}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: isSelected ? 'rgba(255,255,255,0.8)' : '#9CA3AF' }}>
                    {MONTHS[d.getMonth()]}
                  </span>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: hasActivity ? (isSelected ? '#fff' : '#10B981') : 'transparent', marginTop: 3 }} />
                </div>
              );
            })}
          </div>

          {/* DESGLOSE DEL DÍA */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 16 }}>
              {selectedDate === fmt(TODAY) ? 'Hoy, ' : ''} {parseD(selectedDate).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>

            {llegadas.length === 0 && salidas.length === 0 && hospedados.length === 0 && canceladas.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 30, fontSize: 13, background: '#fff', borderRadius: 12, border: '1px dashed #E5E7EB' }}>
                No hay movimientos registrados para este día.
              </div>
            )}

            {llegadas.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, color: '#059669', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📥 Llegadas ({llegadas.length})
                </h3>
                {llegadas.map(r => <ResCard key={r.id} r={r} />)}
              </div>
            )}

            {salidas.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, color: '#D97706', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📤 Salidas ({salidas.length})
                </h3>
                {salidas.map(r => <ResCard key={r.id} r={r} />)}
              </div>
            )}

            {hospedados.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, color: '#2563EB', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
  🛏️ Alojados ({hospedados.length})
</h3>
                {hospedados.map(r => <ResCard key={r.id} r={r} />)}
              </div>
            )}

            {canceladas.length > 0 && (
              <div style={{ marginBottom: 20, opacity: 0.7 }}>
                <h3 style={{ fontSize: 12, color: '#DC2626', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🚫 Canceladas ({canceladas.length})
                </h3>
                {canceladas.map(r => <ResCard key={r.id} r={r} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
