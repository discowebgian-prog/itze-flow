/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { TODAY, fmt, addDays, parseD, currency } from '../lib/dates';
import { supabase } from '../lib/supabase';
import {
  ROOM_TYPES,
  BASE_GUESTS,
  isNormal,
  periodNights,
  periodFor,
  nightPrice,
  overlapsOf,
  isFindeDow,
} from '../lib/rates';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// "1 nov 2026"
const fmtDay = (s) => {
  const d = parseD(s);
  return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`;
};
// "1 – 30 nov 2026" / "20 dic 2026 – 3 ene 2027"
const fmtRange = (a, b) => {
  const da = parseD(a), db = parseD(b);
  if (da.getFullYear() !== db.getFullYear()) return `${fmtDay(a)} – ${fmtDay(b)}`;
  if (da.getMonth() !== db.getMonth()) return `${da.getDate()} ${MES[da.getMonth()]} – ${fmtDay(b)}`;
  return `${da.getDate()} – ${fmtDay(b)}`;
};

// Colores para distinguir períodos en "Cómo queda"
const PERIOD_COLORS = [
  { bg: '#FEF3C7', txt: '#92400E', border: '#FCD34D' },
  { bg: '#FCE7F3', txt: '#9D174D', border: '#F9A8D4' },
  { bg: '#DCFCE7', txt: '#166534', border: '#86EFAC' },
  { bg: '#E0E7FF', txt: '#3730A3', border: '#A5B4FC' },
  { bg: '#FFEDD5', txt: '#9A3412', border: '#FDBA74' },
];
const NORMAL_COLOR = { bg: '#F1F5F9', txt: '#334155', border: '#CBD5E1' };

const todayStr = () => fmt(TODAY);

function statusOf(p) {
  if (isNormal(p)) return null;
  const t = todayStr();
  if (p.hasta < t) return { label: 'Terminado', bg: '#F3F4F6', txt: '#6B7280' };
  if (p.desde > t) return { label: 'Próximo', bg: '#E0F2FE', txt: '#0369A1' };
  return { label: 'Vigente hoy', bg: '#DCFCE7', txt: '#15803D' };
}

const emptyPrecios = (from) =>
  Object.fromEntries(
    ROOM_TYPES.map((t) => {
      const p = (from || {})[t.id] || {};
      return [t.id, { entre: p.entre ?? '', finde: p.finde ?? '', extra: t.extra ? p.extra ?? '' : 0 }];
    })
  );

// ── PÁGINA DE TARIFAS ─────────────────────────────────────────────────────────
export function RatesPage({ periods = [], ok, loading, canEdit, user, onReload, isMobile }) {
  const [editing, setEditing] = useState(null); // { id?, nombre, desde, hasta, precios, normal }
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [calBase, setCalBase] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [selDay, setSelDay] = useState(fmt(TODAY));
  const [calOpen, setCalOpen] = useState(false);

  const normal = periods.find(isNormal);
  const dated = periods.filter((p) => !isNormal(p)).sort((a, b) => a.desde.localeCompare(b.desde));
  const t = todayStr();
  const current = dated.filter((p) => p.hasta >= t);
  const past = dated.filter((p) => p.hasta < t).reverse();

  // Color fijo por período (según su orden de inicio)
  const colorOf = (p) => (!p || isNormal(p) ? NORMAL_COLOR : PERIOD_COLORS[dated.findIndex((x) => x.id === p.id) % PERIOD_COLORS.length]);

  const todayPeriod = periodFor(t, periods);

  const startNew = () => {
    setErr('');
    setConfirmDelId(null);
    setEditing({ nombre: '', desde: '', hasta: '', precios: emptyPrecios(normal?.precios), normal: false });
  };
  const startEdit = (p) => {
    setErr('');
    setConfirmDelId(null);
    setEditing({ id: p.id, nombre: p.nombre, desde: p.desde || '', hasta: p.hasta || '', precios: emptyPrecios(p.precios), normal: isNormal(p) });
  };

  const save = async () => {
    const e = editing;
    if (!e.normal && !e.nombre.trim()) return setErr('Poné un nombre (ej. "Navidad" o "Promo enero").');
    if (!e.normal && (!e.desde || !e.hasta)) return setErr('Elegí desde y hasta qué noche rige.');
    if (!e.normal && e.desde > e.hasta) return setErr('La fecha "Hasta" no puede ser antes que "Desde".');
    for (const ty of ROOM_TYPES) {
      const p = e.precios[ty.id];
      if (!(Number(p.entre) > 0) || !(Number(p.finde) > 0)) return setErr(`Falta el precio de ${ty.label} (Lun–Mié y Jue–Dom).`);
      if (ty.extra && (p.extra === '' || Number(p.extra) < 0)) return setErr(`Falta el adicional por persona de ${ty.label} (0 si no se cobra).`);
    }
    const precios = Object.fromEntries(
      ROOM_TYPES.map((ty) => {
        const p = e.precios[ty.id];
        return [ty.id, { entre: Number(p.entre), finde: Number(p.finde), extra: ty.extra ? Number(p.extra) : 0 }];
      })
    );
    const row = {
      nombre: e.normal ? 'Normal' : e.nombre.trim(),
      desde: e.normal ? null : e.desde,
      hasta: e.normal ? null : e.hasta,
      precios,
      actualizado_en: new Date().toISOString(),
    };
    setSaving(true);
    setErr('');
    const q = e.id
      ? supabase.from('tarifas').update(row).eq('id', e.id)
      : supabase.from('tarifas').insert([{ ...row, creado_por: user?.name || '' }]);
    const { error } = await q;
    setSaving(false);
    if (error) {
      console.error('Error al guardar tarifa:', error);
      return setErr('No se pudo guardar. Probá de nuevo.');
    }
    setEditing(null);
    onReload && onReload();
  };

  const remove = async (p) => {
    const { error } = await supabase.from('tarifas').delete().eq('id', p.id);
    if (error) {
      console.error('Error al borrar tarifa:', error);
      alert('No se pudo eliminar. Probá de nuevo.');
      return;
    }
    setConfirmDelId(null);
    onReload && onReload();
  };

  const sectionTitle = { fontSize: 12, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', margin: '18px 0 8px' };
  const card = { background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: 16, marginBottom: 14 };
  const smallBtn = {
    padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#fff',
    fontFamily: 'inherit', fontWeight: 700, fontSize: 12, color: '#374151', cursor: 'pointer',
  };

  if (!ok) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800, color: '#111' }}>Tarifas</h2>
        <div style={{ ...card, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 13, lineHeight: 1.5 }}>
          {loading
            ? 'Cargando tarifas…'
            : <>⚠️ Todavía no está la tabla de tarifas en la base. Hay que correr <b>supabase/tarifas.sql</b> en Supabase (SQL Editor).</>}
        </div>
      </div>
    );
  }

  // ── Fila de precios de un período (vista) ──
  const priceTable = (p) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) repeat(3, minmax(0,1fr))', rowGap: 6, columnGap: 8, fontSize: 12, alignItems: 'center' }}>
      <div />
      <div style={{ fontSize: 10, fontWeight: 800, color: '#D97706', textTransform: 'uppercase', textAlign: 'right' }}>Lun–Mié</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', textAlign: 'right' }}>Jue–Dom</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>+ Persona</div>
      {ROOM_TYPES.map((ty) => {
        const x = (p.precios || {})[ty.id] || {};
        return [
          <div key={ty.id + 'l'} style={{ fontWeight: 700, color: '#111' }}>
            {ty.label}
          </div>,
          <div key={ty.id + 'e'} style={{ textAlign: 'right', fontWeight: 800, color: '#111' }}>{x.entre ? currency(x.entre) : '—'}</div>,
          <div key={ty.id + 'f'} style={{ textAlign: 'right', fontWeight: 800, color: '#111' }}>{x.finde ? currency(x.finde) : '—'}</div>,
          <div key={ty.id + 'x'} style={{ textAlign: 'right', fontWeight: 600, color: '#6B7280' }}>{ty.extra ? (Number(x.extra) ? currency(x.extra) : 'No cobra') : 'No admite'}</div>,
        ];
      })}
    </div>
  );

  // ── Formulario de edición (en la misma tarjeta) ──
  const renderEditor = (key = 'nuevo') => {
    const e = editing;
    const setP = (tid, field, v) =>
      setEditing({ ...e, precios: { ...e.precios, [tid]: { ...e.precios[tid], [field]: v === '' ? '' : Number(v) } } });
    const numInp = (tid, field) => (
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={e.precios[tid][field]}
        onChange={(ev) => setP(tid, field, ev.target.value)}
        style={{ width: '100%', padding: '8px 6px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', textAlign: 'right', boxSizing: 'border-box', minHeight: 40 }}
      />
    );
    const draft = { ...e, id: e.id || '__nuevo__', creado_en: new Date().toISOString() };
    const overlaps = !e.normal && e.desde && e.hasta && e.desde <= e.hasta ? overlapsOf(draft, periods) : [];
    const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 };
    const inp = { width: '100%', padding: '9px 10px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', minHeight: 40 };

    return (
      <div key={key} style={{ ...card, border: '2px solid #3B82F6' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#1E40AF', marginBottom: 12 }}>
          {e.normal ? 'Editar tarifa Normal' : e.id ? `Editar «${e.nombre}»` : 'Nuevo período (promo o fecha especial)'}
        </div>
        {!e.normal && (
          <>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Nombre</label>
              <input value={e.nombre} onChange={(ev) => setEditing({ ...e, nombre: ev.target.value })} placeholder="Ej. Navidad, Puente de marzo, Promo enero" style={inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 6 }}>
              <div>
                <label style={lbl}>Desde la noche del</label>
                <input type="date" value={e.desde} onChange={(ev) => setEditing({ ...e, desde: ev.target.value, hasta: e.hasta && e.hasta < ev.target.value ? ev.target.value : e.hasta })} style={inp} />
              </div>
              <div>
                <label style={lbl}>Hasta la noche del</label>
                <input type="date" value={e.hasta} min={e.desde || undefined} onChange={(ev) => setEditing({ ...e, hasta: ev.target.value })} style={inp} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>
              Son noches: “hasta el 24” incluye la noche del 24 al 25.
              {e.desde && e.hasta && e.desde <= e.hasta && <b> {periodNights(e)} {periodNights(e) === 1 ? 'noche' : 'noches'}.</b>}
            </div>
            {overlaps.length > 0 && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#92400E', marginBottom: 12, lineHeight: 1.45 }}>
                {overlaps.map((o) => {
                  const wins = periodNights(draft) <= periodNights(o);
                  return (
                    <div key={o.id}>
                      Se pisa con <b>«{o.nombre}»</b> ({fmtRange(o.desde, o.hasta)}). En esos días manda <b>«{wins ? e.nombre || 'este' : o.nombre}»</b>, por ser el más corto.
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {e.normal && (
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Rige todos los días que no tengan otro período.</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) repeat(3, minmax(0,1fr))', rowGap: 8, columnGap: 8, alignItems: 'center' }}>
          <div />
          <div style={{ fontSize: 10, fontWeight: 800, color: '#D97706', textTransform: 'uppercase', textAlign: 'center' }}>Lun–Mié $</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', textAlign: 'center' }}>Jue–Dom $</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', textAlign: 'center' }}>+ Persona $</div>
          {ROOM_TYPES.map((ty) => [
            <div key={ty.id + 'l'} style={{ fontSize: 12, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>
              {ty.label}
            </div>,
            <div key={ty.id + 'e'}>{numInp(ty.id, 'entre')}</div>,
            <div key={ty.id + 'f'}>{numInp(ty.id, 'finde')}</div>,
            <div key={ty.id + 'x'} style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>{ty.extra ? numInp(ty.id, 'extra') : 'No admite'}</div>,
          ])}
        </div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>
          Precio por noche para {BASE_GUESTS} personas. “+ Persona” se suma por noche desde la 3.ª. Si cobran lo mismo toda la semana, poné el mismo número en las dos columnas.
        </div>

        {err && <div style={{ marginTop: 10, color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ flex: 2, minHeight: 44, borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontFamily: 'inherit', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={() => { setEditing(null); setErr(''); }}
            style={{ flex: 1, minHeight: 44, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  };

  // ── Tarjeta de un período (vista) ──
  const renderPeriod = (p) => {
    if (editing && editing.id === p.id) return renderEditor(p.id);
    const st = statusOf(p);
    const c = colorOf(p);
    return (
      <div key={p.id} style={{ ...card, borderLeft: `5px solid ${c.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>{p.nombre}</span>
              {st && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.txt }}>{st.label}</span>}
              {todayPeriod && todayPeriod.id === p.id && isNormal(p) && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: '#DCFCE7', color: '#15803D' }}>Rige hoy</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
              {isNormal(p) ? 'Todos los días que no tengan otro período' : `${fmtRange(p.desde, p.hasta)} · ${periodNights(p)} ${periodNights(p) === 1 ? 'noche' : 'noches'}`}
            </div>
          </div>
          {canEdit && !editing && (
            <button onClick={() => startEdit(p)} style={smallBtn}>✏️ Editar</button>
          )}
        </div>
        {priceTable(p)}
        {canEdit && !isNormal(p) && !editing && (
          <div style={{ marginTop: 12, fontSize: 11, textAlign: 'right' }}>
            {confirmDelId === p.id ? (
              <span style={{ color: '#6B7280' }}>
                ¿Eliminar «{p.nombre}»?{' '}
                <button onClick={() => remove(p)} style={{ border: 'none', background: 'none', color: '#DC2626', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, padding: 4 }}>Sí, eliminar</button>
                ·
                <button onClick={() => setConfirmDelId(null)} style={{ border: 'none', background: 'none', color: '#6B7280', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, padding: 4 }}>Cancelar</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelId(p.id)} style={{ border: 'none', background: 'none', color: '#9CA3AF', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, padding: 4 }}>Eliminar período</button>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Almanaque (dentro de la tarjeta del día) ──
  const calY = calBase.getFullYear(), calM = calBase.getMonth();
  const daysInMo = new Date(calY, calM + 1, 0).getDate();
  const firstDow = new Date(calY, calM, 1).getDay();
  const cells = Array(firstDow).fill(null).concat(Array.from({ length: daysInMo }, (_, i) => fmt(new Date(calY, calM, i + 1))));
  const monthPeriods = dated.filter((p) => cells.some((d) => d && periodFor(d, periods)?.id === p.id));
  const moveMonth = (n) => setCalBase(new Date(calY, calM + n, 1));

  // Tarjeta de arriba: tarifas del día elegido (hoy al entrar) y, a pedido, el almanaque para elegir otro día
  const backToToday = () => {
    setSelDay(t);
    setCalBase(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  };
  const dayCard = () => {
    const sel = parseD(selDay);
    const isToday = selDay === t;
    const selPeriod = periodFor(selDay, periods);
    const selFinde = isFindeDow(sel.getDay());
    const navBtn = { width: 36, height: 36, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 16, fontWeight: 700, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' };
    const chip = (bg, txt) => ({ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: bg, color: txt });
    return (
      <div style={{ ...card, padding: '14px 14px 16px', border: '1px solid #DBEAFE' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: isToday ? '#2563EB' : '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {isToday ? 'Tarifas de hoy' : 'Tarifas del día'}
            </div>
            <div
              style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '6px 14px',
                borderRadius: 999,
                background: isToday ? '#2563EB' : '#1E293B',
                color: '#fff',
                fontWeight: 800,
                fontSize: 15,
                boxShadow: isToday ? '0 2px 8px rgba(37,99,235,0.25)' : 'none',
              }}
            >
              {DIA_LARGO[sel.getDay()]} {sel.getDate()} de {MES_LARGO[sel.getMonth()]}
              {sel.getFullYear() !== TODAY.getFullYear() ? ` ${sel.getFullYear()}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={selFinde ? chip('#F5F3FF', '#7C3AED') : chip('#FFFBEB', '#D97706')}>{selFinde ? 'Jue–Dom' : 'Lun–Mié'}</span>
              {selPeriod && <span style={chip(colorOf(selPeriod).bg, colorOf(selPeriod).txt)}>{selPeriod.nombre}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setCalOpen((v) => !v)}
              style={{ ...smallBtn, minHeight: 36, background: calOpen ? '#EFF6FF' : '#fff', borderColor: calOpen ? '#93C5FD' : '#E5E7EB', color: calOpen ? '#1D4ED8' : '#374151' }}
            >
              {calOpen ? '✕ Cerrar' : '📅 Otro día'}
            </button>
            {!isToday && (
              <button onClick={backToToday} style={{ border: 'none', background: 'none', color: '#2563EB', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 2 }}>
                ← Volver a hoy
              </button>
            )}
          </div>
        </div>

        {calOpen && (
          <div style={{ marginTop: 12, padding: '10px 0 2px', borderTop: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <button onClick={() => moveMonth(-1)} style={navBtn} aria-label="Mes anterior">‹</button>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#111', textTransform: 'capitalize' }}>{MES_LARGO[calM]} {calY}</div>
              <button onClick={() => moveMonth(1)} style={navBtn} aria-label="Mes siguiente">›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
              {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                <div key={i} style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', padding: '2px 0' }}>{d}</div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={'e' + i} />;
                const pr = periodFor(d, periods);
                const special = pr && !isNormal(pr);
                const c = colorOf(pr);
                const isSel = d === selDay;
                const isTodayCell = d === t;
                return (
                  <button
                    key={d}
                    onClick={() => setSelDay(d)}
                    style={{
                      height: 38,
                      borderRadius: 8,
                      border: isSel ? '2px solid #2563EB' : isTodayCell ? '1.5px solid #94A3B8' : '1.5px solid transparent',
                      background: isSel ? '#2563EB' : special ? c.bg : 'transparent',
                      color: isSel ? '#fff' : special ? c.txt : '#374151',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: isTodayCell || isSel ? 800 : 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {parseD(d).getDate()}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
              {monthPeriods.map((p) => (
                <span key={p.id} style={chip(colorOf(p).bg, colorOf(p).txt)}>{p.nombre}</span>
              ))}
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>{monthPeriods.length ? 'Sin color: Normal' : 'Todo el mes rige la Normal'}</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, paddingTop: 4, borderTop: '1px solid #F1F5F9' }}>
          {selPeriod ? (
            ROOM_TYPES.map((ty) => {
              const n = nightPrice(selDay, ty.id, periods);
              return (
                <div key={ty.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '8px 0', borderBottom: '1px dashed #F1F5F9', fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: '#111' }}>
                    {ty.label}
                  </span>
                  {/* Precio y adicional en columnas fijas: todos los precios quedan alineados; sin adicional, un guion centrado */}
                  <span style={{ display: 'grid', gridTemplateColumns: 'auto 128px', alignItems: 'baseline', columnGap: 8, flexShrink: 0 }}>
                    <b style={{ fontSize: 16, color: '#111', textAlign: 'right' }}>{n.price ? currency(n.price) : '—'}</b>
                    {ty.extra && n.extra > 0
                      ? <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>+{currency(n.extra)} por persona</span>
                      : <span style={{ fontSize: 13, color: '#CBD5E1', textAlign: 'center' }}>–</span>}
                  </span>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0' }}>Sin tarifa cargada para este día.</div>
          )}
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>Precio por noche para {BASE_GUESTS} personas.</div>
        </div>
      </div>
    );
  };

  // Sección "Promos y fechas especiales": el botón para agregar va en su título y el formulario nuevo justo debajo
  const promosSection = () => (
    <>
      <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>Promos y fechas especiales</span>
        {canEdit && !editing && (
          <button
            onClick={startNew}
            style={{ padding: '6px 12px', minHeight: 34, borderRadius: 999, border: '1.5px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', fontFamily: 'inherit', fontWeight: 800, fontSize: 12, cursor: 'pointer', textTransform: 'none' }}
          >
            + Nuevo período
          </button>
        )}
      </div>
      {editing && !editing.id && renderEditor()}
      {current.length === 0 && !(editing && !editing.id) && (
        <div style={{ ...card, borderStyle: 'dashed', textAlign: 'center', color: '#9CA3AF', fontSize: 12, padding: '14px 12px' }}>
          No hay promos ni fechas especiales cargadas. Mientras tanto rige la Normal.
        </div>
      )}
      {current.map((p) => renderPeriod(p))}
    </>
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 40 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#111' }}>Tarifas</h2>
      {!canEdit && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Solo admin puede cambiar las tarifas.</div>}
      <div style={{ height: 8 }} />

      {dayCard()}

      {!normal && !editing && (
        <div style={{ ...card, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 13 }}>
          ⚠️ Falta la tarifa Normal (la que rige cuando no hay otro período).
        </div>
      )}

      {/* Con promos o fechas especiales van primero; si no hay, la Normal queda arriba */}
      {current.length > 0 ? (
        <>
          {promosSection()}
          {normal && <div style={sectionTitle}>Tarifa normal</div>}
          {normal && renderPeriod(normal)}
        </>
      ) : (
        <>
          {normal && <div style={sectionTitle}>Tarifa normal</div>}
          {normal && renderPeriod(normal)}
          {(canEdit || (editing && !editing.id)) && promosSection()}
        </>
      )}

      {past.length > 0 && (
        <div style={{ marginTop: 4, marginBottom: 6 }}>
          <button onClick={() => setShowPast((v) => !v)} style={{ ...smallBtn, border: 'none', background: 'transparent', color: '#6B7280', padding: '6px 0' }}>
            {showPast ? '▾' : '▸'} Terminados ({past.length})
          </button>
          {showPast && past.map((p) => renderPeriod(p))}
        </div>
      )}

      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 16, lineHeight: 1.5 }}>
        Si dos períodos se pisan, en esos días manda el más corto (una fecha especial le gana a una promo, y una promo a la Normal).
        Las tarifas son las directas; en Booking se cobra aparte.
      </div>
    </div>
  );
}
