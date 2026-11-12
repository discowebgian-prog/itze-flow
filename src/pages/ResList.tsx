/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Badge } from '../components/ui/Badge';
import { Icon } from '../components/ui/Icon';
import { TODAY, fmt, fmtD, addDays, parseD, currency, MONTHS, DAYS } from '../lib/dates';
import { waLink } from '../lib/guests';
import { LateBadge } from '../components/ui/LateBadge';
import { GroupBadge } from '../components/ui/GroupBadge';
import { QuoteButton } from '../components/Quoter';
import { isFreeStay } from '../lib/reservations';
import { freeStayText } from '../lib/voice';

// ── RESERVATIONS LIST (AGENDA DIARIA ESTILO PULSE) ────────────────────────────
export function ResList({ reservations, properties, onView, onAdd, onQuote }) {
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

  // Fecha corta para las filas: "9 nov"
  const shortD = (d) => parseD(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '');

  // Fila de una reserva (lista tipo iPhone). Se llama como función (ResCard({ r, i })), no como <ResCard/>:
  // al estar definida adentro, como componente se rearmaba en cada render y la animación de entrada se repetía
  const ResCard = ({ r, i = 0 }) => {
    const prop = properties.find((p) => p.id === r.propertyId);
    const saldo = r.totalAmount - r.paid;
    return (
      <div key={r.id} className="li-in ui-row" onClick={() => onView(r)} style={{ '--i': i, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Nombre + habitación + etiquetas + WhatsApp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>{r.guestName}</div>
            {r.room && (
              <span style={{ background: 'var(--fill)', color: 'var(--ink-2)', padding: '2px 7px', borderRadius: 7, fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>
                {r.room}
              </span>
            )}
            {/* Solo parado en hoy: en otro día "mañana" confunde */}
            {selectedDate === fmt(TODAY) && r.checkOut === fmt(addDays(TODAY, 1)) && r.status !== 'finalizada' && r.status !== 'cancelada' && (
              <span style={{ background: 'var(--c-FFF7ED)', color: 'var(--c-EA580C)', padding: '1px 7px', borderRadius: 7, fontSize: 11, fontWeight: 800, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                Sale mañana
              </span>
            )}
            <LateBadge r={r} />
            <GroupBadge r={r} />
            {r.guestPhone && (
              <a
                href={waLink(r.guestPhone, r.guestPhonePrefix, r.guestNationality)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Enviar WhatsApp"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'var(--c-DCFCE7)',
                  color: 'var(--c-16A34A)',
                  textDecoration: 'none',
                }}
              >
                <Icon name="whatsapp" size={14} />
              </a>
            )}
          </div>
          {/* Propiedad y fechas */}
          <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 3 }}>
            {prop?.name} · {shortD(r.checkIn)} → {shortD(r.checkOut)}
          </div>
        </div>

        {/* Estado y saldo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          <Badge status={r.status} />
          {saldo > 0 ? (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--red)' }}>Debe {currency(saldo)}</span>
          ) : isFreeStay(r) ? (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--c-7C3AED)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="gift" size={13} />
              {freeStayText(r)}
            </span>
          ) : (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--c-16A34A)' }}>Pagado</span>
          )}
        </div>
      </div>
    );
  };

  // Grupo de filas con título (Llegadas, Salidas…)
  const section = (title, icon, col, list, extra = {}) =>
    list.length > 0 && (
      <section className="ui-group" style={extra}>
        <h3>
          <Icon name={icon} size={20} color={col} strokeWidth={2.2} />
          {title} ({list.length})
        </h3>
        {list.map((r, i) => ResCard({ r, i }))}
      </section>
    );

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 30, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: 'var(--ls-title)' }}>Agenda diaria</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {onQuote && <QuoteButton onClick={onQuote} />}
          <button
            onClick={() => onAdd()}
            style={{
              padding: '7px 14px', background: 'var(--acc)', border: 'none', borderRadius: 20,
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Icon name="plus" size={16} strokeWidth={2.5} />
            Nueva
          </button>
        </div>
      </div>

      {/* Buscador tipo iPhone */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', display: 'flex' }}>
          <Icon name="search" size={17} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre de huésped"
          style={{
            width: '100%', padding: '11px 14px 11px 38px', border: 'none', borderRadius: 'var(--r-field)',
            background: 'var(--fill)', color: 'var(--ink)', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {isSearching ? (
        <section className="ui-group">
          <h3>
            <Icon name="search" size={20} color="var(--acc)" strokeWidth={2.2} />
            Resultados ({searchedRes.length})
          </h3>
          {searchedRes.map((r, i) => ResCard({ r, i }))}
          {searchedRes.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mut)', padding: 20 }}>No se encontraron huéspedes.</div>}
        </section>
      ) : (
        <>
          {/* MES QUE SE ESTÁ VIENDO + IR A HOY */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 17, fontWeight: 'var(--w-title)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="cal" size={18} color="var(--acc)" />
              {monthLabel}
            </div>
            <button
              type="button"
              onClick={goToday}
              style={{
                padding: '6px 14px',
                minHeight: 32,
                borderRadius: 20,
                border: 'none',
                // Azul lleno cuando estás lejos de hoy; suave cuando ya estás en hoy
                background: selectedDate === todayStr && todayInView ? 'var(--acc-soft)' : 'var(--acc)',
                color: selectedDate === todayStr && todayInView ? 'var(--acc)' : '#fff',
                fontWeight: 700,
                fontSize: 13,
                fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Ir a hoy
            </button>
          </div>

          {/* TIRA DE FECHAS */}
          <div ref={ribbonRef} onScroll={updateViewMonth} style={{ display: 'flex', overflowX: 'auto', gap: 8, padding: '2px 2px 12px', marginBottom: 12, scrollBehavior: 'smooth' }} className="hide-scroll">
            {ribbonDates.map((d) => {
              const dStr = fmt(d);
              const isSelected = selectedDate === dStr;
              const isToday = fmt(TODAY) === dStr;
              const hasActivity = reservations.some((r) => (r.checkIn === dStr || r.checkOut === dStr) && r.status !== 'cancelada');
              return (
                <div
                  id={`date-${dStr}`}
                  key={dStr}
                  className="tap"
                  onClick={() => setSelectedDate(dStr)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minWidth: 52, height: 70, borderRadius: 16, cursor: 'pointer', flexShrink: 0,
                    background: isSelected ? 'var(--acc)' : isToday ? 'var(--acc-soft)' : 'var(--card)',
                    boxShadow: isSelected ? '0 4px 12px rgba(37,99,235,.28)' : 'var(--shadow)',
                    transition: 'background .2s, box-shadow .2s',
                  }}
                >
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: isSelected ? 'rgba(255,255,255,0.85)' : 'var(--mut)' }}>
                    {DAYS[d.getDay()]}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 'var(--w-title)', color: isSelected ? '#fff' : isToday ? 'var(--acc)' : 'var(--ink)', lineHeight: 1.2 }}>
                    {d.getDate()}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: isSelected ? 'rgba(255,255,255,0.85)' : 'var(--mut)' }}>
                    {MONTHS[d.getMonth()]}
                  </span>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: hasActivity ? (isSelected ? '#fff' : 'var(--ok)') : 'transparent', marginTop: 3 }} />
                </div>
              );
            })}
          </div>

          {/* DESGLOSE DEL DÍA */}
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--mut)', marginBottom: 12 }}>
              {(() => {
                const t = parseD(selectedDate).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                return selectedDate === fmt(TODAY) ? `Hoy, ${t}` : t.charAt(0).toUpperCase() + t.slice(1);
              })()}
            </div>

            {llegadas.length === 0 && salidas.length === 0 && hospedados.length === 0 && canceladas.length === 0 && (
              <div className="ui-card" style={{ textAlign: 'center', color: 'var(--mut)', padding: 30, fontSize: 15 }}>
                No hay movimientos registrados para este día.
              </div>
            )}

            {section('Llegadas', 'rin', 'var(--c-2563EB)', llegadas)}
            {section('Salidas', 'rout', 'var(--c-EA580C)', salidas)}
            {section('Alojados', 'bed', 'var(--c-059669)', hospedados)}
            {section('Canceladas', 'close', 'var(--c-DC2626)', canceladas, { opacity: 0.75 })}
          </div>
        </>
      )}
    </div>
  );
}
