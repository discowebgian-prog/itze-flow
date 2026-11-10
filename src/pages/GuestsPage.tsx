/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Icon, ic } from '../components/ui/Icon';
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
  // En el celular los filtros se deslizan: el elegido siempre queda a la vista (ej. Cumpleaños desde Inicio)
  const filtersRef = useRef(null);
  useEffect(() => {
    const el = filtersRef.current?.querySelector('[data-on="1"]');
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [tipo]);

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

  // Cumpleaños (CURP o fecha de nacimiento cargada), del más cercano al más lejano
  const bdays = birthdayList(Object.values(gdb));
  const bdayOf = Object.fromEntries(bdays.map((x) => [x.g.key, x]));
  // 🎂 Cumpleaños: solo los de esta semana (hoy y los próximos 7 días; pedido de Gian).
  // La fecha de todos se ve en su tarjeta en Todos / Empresas / Particulares.
  const weekBdays = bdays.filter((x) => x.next.days <= 7);

  if (tipo === 'cumple') {
    const keep = new Set(allGuests.map((g) => g.key));
    allGuests.length = 0;
    weekBdays.forEach((x) => keep.has(x.g.key) && allGuests.push(x.g));
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

  const filters = [
    { v: 'todos', label: 'Todos' },
    { v: 'empresa', icon: 'company', label: `Empresas (${nEmpresas})` },
    { v: 'particular', icon: 'user', label: `Particulares (${nParticulares})` },
    { v: 'cumple', icon: 'cake', label: `Cumpleaños esta semana (${weekBdays.length})`, bg: '#DB2777' },
  ];

  return (
    <div>
      {/* ── TÍTULO (estilo Limpieza) ── */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 30, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: 'var(--ls-title)' }}>
          Huéspedes
        </h2>
        <div style={{ fontSize: 13, color: 'var(--mut)', marginTop: 2 }}>
          {Object.values(gdb).length} en total · {tipo === 'cumple' ? 'del cumple más cercano al más lejano' : 'primero los que más gastaron'}
        </div>
      </div>

      {/* ── AVISO DE POSIBLES DUPLICADOS (solo admin) ── */}
      {canReview && dupPairs.length > 0 && (
        <div className="pop-in"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, background: '#FFFBEB',
            borderRadius: 'var(--r-item)', padding: '12px 14px', marginBottom: 14,
          }}
        >
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#FEF3C7', color: '#B45309', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="search" size={17} />
          </span>
          <div style={{ flex: 1, fontSize: 13.5, color: '#92400E', fontWeight: 600, lineHeight: 1.35 }}>
            Encontramos {dupPairs.length}{' '}
            {dupPairs.length === 1 ? 'posible huésped duplicado' : 'posibles huéspedes duplicados'}
          </div>
          <button
            onClick={() => setReviewing(true)}
            style={{
              padding: '8px 16px', borderRadius: 20, border: 'none', background: '#F59E0B', color: '#fff',
              fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
            }}
          >
            Revisar
          </button>
        </div>
      )}

      {/* Buscador tipo iPhone */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', display: 'flex' }}>
          <Icon name="search" size={17} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, documento o empresa"
          style={{
            width: '100%', padding: '11px 14px 11px 38px', border: 'none', borderRadius: 'var(--r-field)',
            background: 'var(--fill)', color: 'var(--ink)', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filtros en píldoras (deslizables en el celular) */}
      <div ref={filtersRef} className="g-filters" style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {filters.map((o) => {
          const on = tipo === o.v;
          return (
            <button
              key={o.v}
              type="button"
              className="ui-pill"
              data-on={on ? '1' : '0'}
              onClick={() => setTipo(o.v)}
              style={{
                flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: on ? o.bg || 'var(--acc)' : 'var(--fill)',
                color: on ? '#fff' : 'var(--ink)',
              }}
            >
              {o.icon && <Icon name={o.icon} size={15} />}
              {o.label}
            </button>
          );
        })}
      </div>

      {tipo === 'cumple' && (
        <div style={{ fontSize: 13, color: 'var(--mut)', margin: '-4px 4px 14px', lineHeight: 1.45 }}>
          {weekBdays.length
            ? 'Los que cumplen hoy y en los próximos 7 días. El día del cumple aparece "Saludar", que abre WhatsApp con el mensaje listo.'
            : 'Nadie cumple años esta semana. La fecha de cada huésped se ve en su fila (sale de la CURP de la INE o de la fecha de nacimiento del pasaporte).'}
        </div>
      )}

      {allGuests.length > 0 && (
        <div className="ui-group g-list">
          {allGuests.map((g, idx) => GuestRow({ g, idx }))}
        </div>
      )}

      {allGuests.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--mut)', padding: 40, fontSize: 14 }}>
          {tipo === 'empresa' && !q
            ? 'Todavía no hay empresas. Aparecen cuando una reserva pide factura y se escribe el nombre de la empresa.'
            : 'No se encontraron huéspedes.'}
        </div>
      )}

      {canReview && dupPairs.length === 0 && decisions.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <button
            onClick={() => setReviewing(true)}
            style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--mut)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Ver decisiones de duplicados ({decisions.length})
          </button>
        </div>
      )}
      <style>{G_CSS}</style>
    </div>
  );

  // ── UNA FILA POR HUÉSPED (llamada como función, para no repetir animaciones) ──
  function GuestRow({ g, idx }) {
    const freq = freqBadge(g.visits);
    const lastRes = reservations.find((r) => r.id === g.stays[g.stays.length - 1]);
    // Fecha de cumpleaños en todas las filas que la tienen (cuenta regresiva solo la última semana)
    const bd = bdayOf[g.key];
    const today = bd && bd.next.days === 0;
    const soon = bd && bd.next.days <= 7;
    const greeted = today && wasGreeted(g.key);
    const flash = flashKey === g.key;
    const wa = g.phone && lastRes ? waLink(g.phone, lastRes.guestPhonePrefix, lastRes.guestNationality) : null;
    const initials = g.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

    return (
      <div
        key={g.key || idx}
        className="ui-row li-in"
        data-gkey={g.key}
        onClick={() => lastRes && onView(lastRes)}
        style={{
          '--i': idx, alignItems: 'flex-start',
          background: flash ? '#FDF2F8' : undefined,
          boxShadow: flash ? 'inset 0 0 0 2px #DB2777' : 'none',
          borderRadius: flash ? 'var(--r-item)' : 0,
          transition: 'background .3s, box-shadow .3s',
        }}
      >
        {/* Inicial en círculo; violeta si es empresa */}
        <div
          style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0, marginTop: 1,
            background: g.isCompany ? '#EDE9FE' : 'var(--acc-soft)', color: g.isCompany ? '#5B21B6' : 'var(--acc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14.5,
          }}
        >
          {g.isCompany ? <Icon name="company" size={18} /> : initials || <Icon name="user" size={18} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {g.name}
            </span>
            {freq && (
              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: freq.color, background: freq.bg, padding: '2px 7px', borderRadius: 20 }}>
                {ic(freq.icon, 11, { marginRight: 3 })}{freq.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {g.isCompany && <span style={{ color: '#5B21B6', fontWeight: 600 }}>{g.company} · </span>}
            {g.visits} {g.visits === 1 ? 'visita' : 'visitas'} ·{' '}
            <span style={{ color: '#15803D', fontWeight: 600 }}>{currency(g.totalSpent)}</span>
            {g.doc ? ` · ${g.doc}` : ''}
          </div>

          {bd && (
            <div
              style={{
                marginTop: 5, fontSize: 12.5, fontWeight: soon ? 700 : 500,
                color: today ? '#9D174D' : soon ? '#BE185D' : 'var(--mut)', lineHeight: 1.35,
              }}
            >
              {ic('cake', 13, { marginRight: 4 })}
              {whenText(bd.next)} · cumple {bd.next.age}
              {soon && bd.staying ? ' · lo pasa en el hostel' : ''}
            </div>
          )}
        </div>

        {/* A la derecha: Saludar el día del cumple; si no, WhatsApp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, alignSelf: 'center' }}>
          {wa && today ? (
            <a
              href={`${wa}?text=${encodeURIComponent(birthdayMessage(g.name, bd.lang, bd.staying))}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                markGreeted(g.key);
                setTick((t) => t + 1);
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 11px', borderRadius: 20,
                textDecoration: 'none', fontWeight: 700, fontSize: 13,
                background: greeted ? '#FCE7F3' : '#DB2777', color: greeted ? '#9D174D' : '#fff',
              }}
            >
              <Icon name={greeted ? 'tick' : 'whatsapp'} size={14} strokeWidth={greeted ? 3 : 2} />
              {greeted ? 'Saludado' : 'Saludar'}
            </a>
          ) : wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`WhatsApp a ${g.name}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', color: '#15803D',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
              }}
            >
              <Icon name="whatsapp" size={18} />
            </a>
          ) : null}
          <span style={{ color: 'var(--handle)', display: 'inline-flex' }}>
            <Icon name="chev" size={18} strokeWidth={2.5} />
          </span>
        </div>
      </div>
    );
  }
}

// Filtros sin barra de desplazamiento; en la compu la lista va en dos columnas
const G_CSS = `
.g-filters { scrollbar-width: none; }
.g-filters::-webkit-scrollbar { display: none; }
@media (min-width: 1100px) {
  .g-list { display: grid; grid-template-columns: 1fr 1fr; column-gap: 8px; }
  .g-list > .ui-row + .ui-row::before { display: none; }
  .g-list > .ui-row { border-top: .5px solid var(--line); }
  .g-list > .ui-row:nth-child(-n+2) { border-top: none; }
}
`;
