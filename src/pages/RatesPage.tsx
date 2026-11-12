/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from 'react';
import { TODAY, fmt, addDays, parseD, currency } from '../lib/dates';
import { supabase } from '../lib/supabase';
import { notify, notifyError, humanError } from '../lib/voice';
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
import { Icon, ic } from '../components/ui/Icon';
import { Collapse } from '../components/ui/Motion';

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
  { bg: 'var(--c-FEF3C7)', txt: 'var(--c-92400E)', border: 'var(--c-FCD34D)' },
  { bg: 'var(--c-FCE7F3)', txt: 'var(--c-9D174D)', border: 'var(--c-F9A8D4)' },
  { bg: 'var(--c-DCFCE7)', txt: 'var(--c-166534)', border: 'var(--c-86EFAC)' },
  { bg: 'var(--c-E0E7FF)', txt: 'var(--c-3730A3)', border: 'var(--c-A5B4FC)' },
  { bg: 'var(--c-FFEDD5)', txt: 'var(--c-9A3412)', border: 'var(--c-FDBA74)' },
];
const NORMAL_COLOR = { bg: 'var(--fill)', txt: 'var(--ink-2)', border: 'var(--handle)' };

const todayStr = () => fmt(TODAY);

function statusOf(p) {
  if (isNormal(p)) return null;
  const t = todayStr();
  if (p.hasta < t) return { label: 'Terminado', bg: 'var(--c-F3F4F6)', txt: 'var(--mut)' };
  if (p.desde > t) return { label: 'Próximo', bg: 'var(--c-E0F2FE)', txt: 'var(--c-0369A1)' };
  return { label: 'Vigente hoy', bg: 'var(--c-DCFCE7)', txt: 'var(--c-15803D)' };
}

const emptyPrecios = (from) =>
  Object.fromEntries(
    ROOM_TYPES.map((t) => {
      const p = (from || {})[t.id] || {};
      return [t.id, { entre: p.entre ?? '', finde: p.finde ?? '', extra: t.extra ? p.extra ?? '' : 0 }];
    })
  );

// ── PÁGINA DE TARIFAS ─────────────────────────────────────────────────────────
export function RatesPage({ periods = [], ok, loading, canEdit, user, onReload, isMobile, prefill = null, onPrefillUsed = null }) {
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
  // Desde un evento de Inicio ("Crear fecha especial"): abre el período nuevo con nombre y fechas puestos
  useEffect(() => {
    if (!prefill || !canEdit || loading) return;
    setErr('');
    setConfirmDelId(null);
    setEditing({ nombre: prefill.nombre || '', desde: prefill.desde || '', hasta: prefill.hasta || '', precios: emptyPrecios(normal?.precios), normal: false });
    onPrefillUsed && onPrefillUsed();
    setTimeout(() => document.getElementById('editor-periodo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  }, [prefill, canEdit, loading]);
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
      return setErr(humanError(error, 'guardar el período'));
    }
    setEditing(null);
    onReload && onReload();
  };

  const remove = async (p) => {
    const { error } = await supabase.from('tarifas').delete().eq('id', p.id);
    if (error) {
      setConfirmDelId(null);
      notifyError(error, `eliminar "${p.nombre || 'el período'}"`);
      return;
    }
    notify(`"${p.nombre || 'Período'}" eliminado`);
    setConfirmDelId(null);
    onReload && onReload();
  };

  const sectionTitle = { fontSize: 20, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: '-.01em', margin: '22px 0 10px' };
  const card = { background: 'var(--card)', borderRadius: 'var(--r-card)', boxShadow: 'var(--shadow)', padding: 16, marginBottom: 14 };
  const smallBtn = {
    padding: '7px 14px', borderRadius: 20, border: 'none', background: 'var(--acc-soft)',
    fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, color: 'var(--acc)', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
  };

  if (!ok) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 30, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: 'var(--ls-title)' }}>Tarifas</h2>
        <div style={{ ...card, background: 'var(--c-FFFBEB)', boxShadow: 'none', color: 'var(--c-92400E)', fontSize: 13.5, lineHeight: 1.5 }}>
          {loading
            ? 'Cargando tarifas…'
            : <>{ic('warning', 14)}Todavía no está la tabla de tarifas en la base. Hay que correr <b>supabase/tarifas.sql</b> en Supabase (SQL Editor).</>}
        </div>
      </div>
    );
  }

  // ── Fila de precios de un período (vista) ──
  const priceTable = (p) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) repeat(3, minmax(0,1fr))', rowGap: 8, columnGap: 8, fontSize: 13.5, alignItems: 'center', background: 'var(--inset)', borderRadius: 'var(--r-item)', padding: '10px 12px' }}>
      <div />
      <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--c-D97706)', textTransform: 'uppercase', textAlign: 'right' }}>Lun–Mié</div>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--c-7C3AED)', textTransform: 'uppercase', textAlign: 'right' }}>Jue–Dom</div>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--mut)', textTransform: 'uppercase', textAlign: 'right' }}>+ Persona</div>
      {ROOM_TYPES.map((ty) => {
        const x = (p.precios || {})[ty.id] || {};
        return [
          <div key={ty.id + 'l'} style={{ fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>
            {ty.label}
          </div>,
          <div key={ty.id + 'e'} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>{x.entre ? currency(x.entre) : '—'}</div>,
          <div key={ty.id + 'f'} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>{x.finde ? currency(x.finde) : '—'}</div>,
          <div key={ty.id + 'x'} style={{ textAlign: 'right', fontWeight: 500, color: 'var(--mut)', fontSize: 12.5 }}>{ty.extra ? (Number(x.extra) ? currency(x.extra) : 'No cobra') : 'No admite'}</div>,
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
        style={{ width: '100%', padding: '8px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', background: 'var(--card)', color: 'var(--ink)', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', textAlign: 'right', boxSizing: 'border-box', minHeight: 42, outline: 'none' }}
      />
    );
    const draft = { ...e, id: e.id || '__nuevo__', creado_en: new Date().toISOString() };
    const overlaps = !e.normal && e.desde && e.hasta && e.desde <= e.hasta ? overlapsOf(draft, periods) : [];
    const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--mut)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 };
    const inp = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', background: 'var(--card)', color: 'var(--ink)', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', minHeight: 42, outline: 'none' };

    return (
      <div key={key} id={key === 'nuevo' ? 'editor-periodo' : undefined} style={{ ...card, boxShadow: 'inset 0 0 0 2px var(--acc), var(--shadow)', scrollMarginTop: 80 }}>
        <div style={{ fontWeight: 'var(--w-title)', fontSize: 18, color: 'var(--ink)', marginBottom: 14 }}>
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
            <div style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 12 }}>
              Son noches: “hasta el 24” incluye la noche del 24 al 25.
              {e.desde && e.hasta && e.desde <= e.hasta && <b> {periodNights(e)} {periodNights(e) === 1 ? 'noche' : 'noches'}.</b>}
            </div>
            {overlaps.length > 0 && (
              <div style={{ background: 'var(--c-FFFBEB)', borderRadius: 'var(--r-field)', padding: '10px 12px', fontSize: 13, color: 'var(--c-92400E)', marginBottom: 12, lineHeight: 1.45 }}>
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
          <div style={{ fontSize: 13, color: 'var(--mut)', marginBottom: 12 }}>Rige todos los días que no tengan otro período.</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) repeat(3, minmax(0,1fr))', rowGap: 8, columnGap: 8, alignItems: 'center' }}>
          <div />
          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--c-D97706)', textTransform: 'uppercase', textAlign: 'center' }}>Lun–Mié $</div>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--c-7C3AED)', textTransform: 'uppercase', textAlign: 'center' }}>Jue–Dom $</div>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--mut)', textTransform: 'uppercase', textAlign: 'center' }}>+ Persona $</div>
          {ROOM_TYPES.map((ty) => [
            <div key={ty.id + 'l'} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>
              {ty.label}
            </div>,
            <div key={ty.id + 'e'}>{numInp(ty.id, 'entre')}</div>,
            <div key={ty.id + 'f'}>{numInp(ty.id, 'finde')}</div>,
            <div key={ty.id + 'x'} style={{ textAlign: 'center', fontSize: 11, color: 'var(--mut)' }}>{ty.extra ? numInp(ty.id, 'extra') : 'No admite'}</div>,
          ])}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 8, lineHeight: 1.45 }}>
          Precio por noche para {BASE_GUESTS} personas. “+ Persona” se suma por noche desde la 3.ª. Si cobran lo mismo toda la semana, poné el mismo número en las dos columnas.
        </div>

        {err && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ flex: 2, minHeight: 46, borderRadius: 'var(--r-field)', border: 'none', background: 'var(--acc)', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={() => { setEditing(null); setErr(''); }}
            style={{ flex: 1, minHeight: 46, borderRadius: 'var(--r-field)', border: 'none', background: 'var(--fill)', color: 'var(--ink)', fontFamily: 'inherit', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
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
      <div key={p.id} style={{ ...card, position: 'relative', overflow: 'hidden' }}>
        <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: c.border }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 'var(--w-title)', fontSize: 17, color: 'var(--ink)' }}>{p.nombre}</span>
              {st && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.txt }}>{st.label}</span>}
              {todayPeriod && todayPeriod.id === p.id && isNormal(p) && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'var(--c-DCFCE7)', color: 'var(--c-15803D)' }}>Rige hoy</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mut)', marginTop: 3 }}>
              {isNormal(p) ? 'Todos los días que no tengan otro período' : `${fmtRange(p.desde, p.hasta)} · ${periodNights(p)} ${periodNights(p) === 1 ? 'noche' : 'noches'}`}
            </div>
          </div>
          {canEdit && !editing && (
            <button onClick={() => startEdit(p)} style={smallBtn}><Icon name="edit" size={14} />Editar</button>
          )}
        </div>
        {priceTable(p)}
        {canEdit && !isNormal(p) && !editing && (
          <div style={{ marginTop: 10, fontSize: 13, textAlign: 'right' }}>
            {confirmDelId === p.id ? (
              <span style={{ color: 'var(--mut)' }}>
                ¿Eliminar «{p.nombre}»?{' '}
                <button onClick={() => remove(p)} style={{ border: 'none', background: 'none', color: 'var(--red)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 4 }}>Sí, eliminar</button>
                ·
                <button onClick={() => setConfirmDelId(null)} style={{ border: 'none', background: 'none', color: 'var(--mut)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 4 }}>Cancelar</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelId(p.id)} style={{ border: 'none', background: 'none', color: 'var(--mut)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 4 }}>Eliminar período</button>
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
    const navBtn = { width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--fill)', color: 'var(--acc)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 };
    const chip = (bg, txt) => ({ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: bg, color: txt });
    return (
      <div style={{ ...card, padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? 'var(--acc)' : 'var(--mut)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {isToday ? 'Tarifas de hoy' : 'Tarifas del día'}
            </div>
            <div
              style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '6px 14px',
                borderRadius: 999,
                background: isToday ? 'var(--acc)' : 'var(--ink)',
                color: isToday ? '#fff' : 'var(--card)',
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {DIA_LARGO[sel.getDay()]} {sel.getDate()} de {MES_LARGO[sel.getMonth()]}
              {sel.getFullYear() !== TODAY.getFullYear() ? ` ${sel.getFullYear()}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={selFinde ? chip('var(--c-F5F3FF)', 'var(--c-7C3AED)') : chip('var(--c-FFFBEB)', 'var(--c-D97706)')}>{selFinde ? 'Jue–Dom' : 'Lun–Mié'}</span>
              {selPeriod && <span style={chip(colorOf(selPeriod).bg, colorOf(selPeriod).txt)}>{selPeriod.nombre}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setCalOpen((v) => !v)}
              style={{ ...smallBtn, minHeight: 36, background: calOpen ? 'var(--fill)' : 'var(--acc-soft)', color: calOpen ? 'var(--ink)' : 'var(--acc)' }}
            >
              <Icon name={calOpen ? 'close' : 'cal'} size={15} />
              {calOpen ? 'Cerrar' : 'Otro día'}
            </button>
            {!isToday && (
              <button onClick={backToToday} style={{ border: 'none', background: 'none', color: 'var(--acc)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 2, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <Icon name="chevL" size={15} />Volver a hoy
              </button>
            )}
          </div>
        </div>

        <Collapse open={calOpen}>
          <div style={{ marginTop: 12, padding: '10px 0 2px', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <button onClick={() => moveMonth(-1)} style={navBtn} aria-label="Mes anterior"><Icon name="chevL" size={18} strokeWidth={2.5} /></button>
              <div style={{ fontWeight: 'var(--w-title)', fontSize: 17, color: 'var(--ink)', textTransform: 'capitalize' }}>{MES_LARGO[calM]} {calY}</div>
              <button onClick={() => moveMonth(1)} style={navBtn} aria-label="Mes siguiente"><Icon name="chev" size={18} strokeWidth={2.5} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
              {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', padding: '2px 0' }}>{d}</div>
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
                      height: 40,
                      borderRadius: 12,
                      border: 'none',
                      background: isSel ? 'var(--acc)' : special ? c.bg : 'transparent',
                      color: isSel ? '#fff' : isTodayCell ? 'var(--acc)' : special ? c.txt : 'var(--ink)',
                      fontFamily: 'inherit',
                      fontSize: 15,
                      fontWeight: isTodayCell || isSel ? 800 : 500,
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
              <span style={{ fontSize: 12, color: 'var(--mut)' }}>{monthPeriods.length ? 'Sin color: Normal' : 'Todo el mes rige la Normal'}</span>
            </div>
          </div>
        </Collapse>

        <div style={{ marginTop: 12, background: 'var(--inset)', borderRadius: 'var(--r-item)', padding: '2px 12px 10px' }}>
          {selPeriod ? (
            ROOM_TYPES.map((ty) => {
              const n = nightPrice(selDay, ty.id, periods);
              return (
                <div key={ty.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                    {ty.label}
                  </span>
                  {/* Precio y adicional en columnas fijas: todos los precios quedan alineados; sin adicional, un guion centrado */}
                  <span style={{ display: 'grid', gridTemplateColumns: 'auto 128px', alignItems: 'baseline', columnGap: 8, flexShrink: 0 }}>
                    <b style={{ fontSize: 17, color: 'var(--ink)', textAlign: 'right' }}>{n.price ? currency(n.price) : '—'}</b>
                    {ty.extra && n.extra > 0
                      ? <span style={{ fontSize: 12, color: 'var(--mut)', whiteSpace: 'nowrap' }}>+{currency(n.extra)} por persona</span>
                      : <span style={{ fontSize: 13, color: 'var(--handle)', textAlign: 'center' }}>–</span>}
                  </span>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: 'var(--mut)', padding: '10px 0' }}>Sin tarifa cargada para este día.</div>
          )}
          <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 8 }}>Precio por noche para {BASE_GUESTS} personas.</div>
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
            style={{ ...smallBtn, minHeight: 34, background: 'var(--acc)', color: '#fff', letterSpacing: 'normal' }}
          >
            <Icon name="plus" size={15} strokeWidth={2.5} />Nuevo período
          </button>
        )}
      </div>
      {editing && !editing.id && renderEditor()}
      {current.length === 0 && !(editing && !editing.id) && (
        <div style={{ ...card, boxShadow: 'none', background: 'var(--fill)', textAlign: 'center', color: 'var(--mut)', fontSize: 13.5, padding: '16px 14px' }}>
          No hay promos ni fechas especiales cargadas. Mientras tanto rige la Normal.
        </div>
      )}
      {current.map((p) => renderPeriod(p))}
    </>
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 40 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 30, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: 'var(--ls-title)' }}>Tarifas</h2>
      {!canEdit && <div style={{ fontSize: 13, color: 'var(--mut)', marginBottom: 10 }}>Solo admin puede cambiar las tarifas.</div>}
      <div style={{ height: 8 }} />

      {dayCard()}

      {!normal && !editing && (
        <div style={{ ...card, background: 'var(--c-FFFBEB)', boxShadow: 'none', color: 'var(--c-92400E)', fontSize: 13.5 }}>
          {ic('warning', 14)}Falta la tarifa Normal (la que rige cuando no hay otro período).
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
          <button onClick={() => setShowPast((v) => !v)} style={{ ...smallBtn, background: 'transparent', color: 'var(--acc)', padding: '6px 0', fontSize: 15 }}>
            <span style={{ display: 'inline-flex', transform: showPast ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><Icon name="chev" size={17} strokeWidth={2.5} /></span>
            Terminados ({past.length})
          </button>
          <Collapse open={showPast}>{past.map((p) => renderPeriod(p))}</Collapse>
        </div>
      )}

      <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 16, lineHeight: 1.5 }}>
        Si dos períodos se pisan, en esos días manda el más corto (una fecha especial le gana a una promo, y una promo a la Normal).
        Las tarifas son las directas; en Booking se cobra aparte.
      </div>
    </div>
  );
}
