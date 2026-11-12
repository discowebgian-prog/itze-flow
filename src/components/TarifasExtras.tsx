/* eslint-disable */
// @ts-nocheck
// ── TARIFAS › "Eventos que conocemos" y "Competencia" (solo dueños) ──────────
// Eventos a mano: se guardan en la misma tabla del radar (`eventos`, origen 'manual') y aparecen en
//   Inicio › Se viene con las mismas reglas de anticipación. Sirve para lo que el radar no encuentra.
// Competencia: 3 o 4 lugares parecidos con su precio Lun–Mié y Jue–Dom (tabla `competencia`,
//   supabase/mejoras_nov.sql). Se compara solo con el tarifario de hoy y avisa si un precio quedó viejo.
// Las dos cosas le llegan al Asesor IA.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icon, ic } from './ui/Icon';
import { notify, notifyError } from '../lib/voice';
import { currency, TODAY, fmt, addDays, diffDays } from '../lib/dates';
import { ROOM_TYPES, nightPrice, isFindeDow } from '../lib/rates';
import { fechasTexto, leadDays } from '../lib/eventos';

const TIPOS_EV = [
  ['festival', 'Festival'], ['cultural', 'Cultura'], ['deportivo', 'Deporte'], ['concierto', 'Concierto'],
  ['congreso', 'Congreso'], ['crucero', 'Crucero'], ['religioso', 'Fiesta religiosa'], ['feriado', 'Feriado'], ['otro', 'Otro'],
];
const IMPACTOS = [['alto', 'Alto'], ['medio', 'Medio'], ['bajo', 'Bajo']];
const claveDe = (nombre, desde) =>
  String(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + '|' + desde;

const card = { background: 'var(--card)', borderRadius: 'var(--r-card)', boxShadow: 'var(--shadow)', padding: 16, marginBottom: 14 };
const sectionTitle = { fontSize: 20, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: '-.01em', margin: '22px 0 6px', display: 'flex', alignItems: 'center', gap: 8 };
const help = { fontSize: 13, color: 'var(--mut)', margin: '0 0 10px', lineHeight: 1.45 };
const inp = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', background: 'var(--card)', color: 'var(--ink)', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', minHeight: 42, outline: 'none' };
const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', margin: '10px 0 4px', display: 'block' };
const btn = (bg, color) => ({ padding: '10px 16px', background: bg, color, border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', minHeight: 42 });
const link = { background: 'none', border: 'none', padding: 0, color: 'var(--acc)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
const chips = (opts, val, set) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {opts.map(([k, l]) => (
      <button key={k} type="button" onClick={() => set(k)} className="tap"
        style={{ padding: '6px 12px', borderRadius: 999, border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          background: val === k ? 'var(--acc)' : 'var(--fill)', color: val === k ? '#fff' : 'var(--ink-2)' }}>
        {l}
      </button>
    ))}
  </div>
);
const faltaSql = (error) => error && /does not exist|schema cache|PGRST20|42P01/i.test(String(error.message || error.code || ''));

// ── EVENTOS QUE CONOCEMOS ──
export function EventosManuales() {
  const [lista, setLista] = useState(null); // null = cargando / sin tabla
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [borrar, setBorrar] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.from('eventos').select('*').eq('origen', 'manual').order('fecha_desde');
    if (error) return setLista(faltaSql(error) ? false : []);
    const hoy = fmt(TODAY);
    setLista((data || []).filter((e) => (e.fecha_hasta || e.fecha_desde) >= hoy));
  };
  useEffect(() => { load(); }, []);
  if (lista === false) return null; // sin la tabla del radar

  const nuevo = () => setForm({ nombre: '', fecha_desde: fmt(addDays(TODAY, 7)), fecha_hasta: '', tipo: 'festival', impacto: 'medio', descripcion: '' });
  const guardar = async () => {
    if (!form.nombre.trim()) return notify('Falta el nombre del evento.', 'error');
    if (!form.fecha_desde) return notify('Falta la fecha.', 'error');
    if (form.fecha_hasta && form.fecha_hasta < form.fecha_desde) return notify('La fecha de fin es antes que la de inicio.', 'error');
    setSaving(true);
    const row = {
      nombre: form.nombre.trim(), fecha_desde: form.fecha_desde, fecha_hasta: form.fecha_hasta || null, tipo: form.tipo, impacto: form.impacto,
      descripcion: form.descripcion.trim() || null, origen: 'manual', confianza: 'confirmado', actualizado_en: new Date().toISOString(),
    };
    const { error } = form.id
      ? await supabase.from('eventos').update(row).eq('id', form.id)
      : await supabase.from('eventos').insert({ ...row, clave: claveDe(row.nombre, row.fecha_desde) });
    setSaving(false);
    if (error && /duplicate|unique/i.test(String(error.message))) return notify('Ese evento ya está cargado con esa fecha.', 'error');
    if (error) return notifyError(error, 'guardar el evento');
    notify(form.id ? 'Evento actualizado.' : `Listo: aparece en Inicio › Se viene unos ${leadDays(row)} días antes.`);
    setForm(null);
    load();
  };
  const eliminar = async (e) => {
    const { error } = await supabase.from('eventos').delete().eq('id', e.id);
    if (error) return notifyError(error, 'borrar el evento');
    setBorrar(null);
    notify('Evento borrado.', 'info');
    load();
  };

  return (
    <>
      <div style={sectionTitle}><Icon name="megaphone" size={20} color="var(--c-DB2777)" />Eventos que conocemos</div>
      <p style={help}>Lo que el radar no encuentra solo: un crucero, una boda en la zona, un torneo. Aparece en Inicio › Se viene con tiempo para prepararse, aunque no cambie el precio.</p>
      <div style={card}>
        {lista === null ? (
          <div style={{ color: 'var(--mut)', fontSize: 13.5 }}>Cargando…</div>
        ) : lista.length === 0 && !form ? (
          <div style={{ color: 'var(--mut)', fontSize: 13.5 }}>Todavía no anotaron ninguno.</div>
        ) : (
          lista.map((e) => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 15 }}>{e.nombre}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                  {fechasTexto(e)} · {(TIPOS_EV.find(([k]) => k === e.tipo) || [, 'Evento'])[1]} · impacto {e.impacto}
                </div>
                {e.descripcion && <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>{e.descripcion}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <button type="button" style={link} onClick={() => setForm({ ...e, fecha_hasta: e.fecha_hasta || '', descripcion: e.descripcion || '' })}>Editar</button>
                {borrar === e.id ? (
                  <span style={{ fontSize: 12.5 }}>
                    <button type="button" style={{ ...link, color: 'var(--red)' }} onClick={() => eliminar(e)}>Sí, borrar</button> ·{' '}
                    <button type="button" style={{ ...link, color: 'var(--mut)' }} onClick={() => setBorrar(null)}>No</button>
                  </span>
                ) : (
                  <button type="button" style={{ ...link, color: 'var(--mut)' }} onClick={() => setBorrar(e.id)}>Borrar</button>
                )}
              </div>
            </div>
          ))
        )}
        {form ? (
          <div className="pop-in" style={{ marginTop: 10 }}>
            <span style={lbl}>Nombre</span>
            <input style={inp} value={form.nombre} placeholder="Ej: Crucero Carnival, Torneo de pesca" onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={lbl}>Desde</span><input type="date" style={inp} value={form.fecha_desde} onChange={(ev) => setForm({ ...form, fecha_desde: ev.target.value })} /></div>
              <div><span style={lbl}>Hasta (opcional)</span><input type="date" style={inp} value={form.fecha_hasta} onChange={(ev) => setForm({ ...form, fecha_hasta: ev.target.value })} /></div>
            </div>
            <span style={lbl}>Tipo</span>
            {chips(TIPOS_EV, form.tipo, (k) => setForm({ ...form, tipo: k }))}
            <span style={lbl}>¿Cuánta gente mueve?</span>
            {chips(IMPACTOS, form.impacto, (k) => setForm({ ...form, impacto: k }))}
            <span style={lbl}>Nota (opcional)</span>
            <input style={inp} value={form.descripcion} placeholder="Quiénes vienen, dónde es…" onChange={(ev) => setForm({ ...form, descripcion: ev.target.value })} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="tap" disabled={saving} onClick={guardar} style={{ ...btn('var(--acc)', '#fff'), flex: 2, opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
              <button type="button" className="tap" onClick={() => setForm(null)} style={{ ...btn('var(--fill)', 'var(--ink)'), flex: 1 }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button type="button" className="tap" onClick={nuevo} style={{ ...btn('var(--acc-soft)', 'var(--acc)'), width: '100%', marginTop: lista && lista.length ? 12 : 10 }}>
            {ic('plus', 15)}Anotar un evento
          </button>
        )}
      </div>
    </>
  );
}

// ── PÁGINAS QUE REVISA EL RADAR (tabla eventos_fuentes, supabase/mejoras_nov.sql) ──
// Links que conocen los dueños (agenda del Ayuntamiento, página de un organizador, calendario de eventos).
// El radar las lee enteras cada lunes. Facebook e Instagram no se pueden leer.
export function FuentesRadar() {
  const [lista, setLista] = useState(null);
  const [url, setUrl] = useState('');
  const [nombre, setNombre] = useState('');
  const [abierto, setAbierto] = useState(false);
  const load = async () => {
    const { data, error } = await supabase.from('eventos_fuentes').select('*').order('creado_en');
    if (error) return setLista(faltaSql(error) ? false : []);
    setLista(data || []);
  };
  useEffect(() => { load(); }, []);
  if (lista === false) return null;
  const agregar = async () => {
    let u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    if (/facebook\.com|instagram\.com|fb\.com|tiktok\.com/i.test(u)) return notify('Facebook, Instagram y TikTok no se pueden leer desde el radar. Probá con una página web.', 'error');
    const { error } = await supabase.from('eventos_fuentes').insert({ url: u, nombre: nombre.trim() || null });
    if (error && /duplicate|unique/i.test(String(error.message))) return notify('Esa página ya está en la lista.', 'error');
    if (error) return notifyError(error, 'guardar la página');
    setUrl(''); setNombre(''); setAbierto(false);
    notify('Listo: el radar la va a leer el próximo lunes (o al tocar "Buscar ahora").');
    load();
  };
  const quitar = async (f) => {
    const { error } = await supabase.from('eventos_fuentes').delete().eq('id', f.id);
    if (error) return notifyError(error, 'quitar la página');
    load();
  };
  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>{ic('link', 15)}Páginas que revisa el radar</div>
      <div style={{ fontSize: 12.5, color: 'var(--mut)', margin: '2px 0 8px', lineHeight: 1.45 }}>
        Si conocen una página con agenda de eventos (del Ayuntamiento, de un organizador, de un club de playa), péguenla acá: el radar la lee entera cada lunes. Facebook e Instagram no se pueden leer.
      </div>
      {(lista || []).map((f) => (
        <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
          <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--acc)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {f.nombre || f.url.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
          <button type="button" style={{ ...link, color: 'var(--mut)', flexShrink: 0 }} onClick={() => quitar(f)}>Quitar</button>
        </div>
      ))}
      {abierto ? (
        <div className="pop-in" style={{ marginTop: 8 }}>
          <input style={inp} value={url} placeholder="https://… (la página con la agenda)" onChange={(ev) => setUrl(ev.target.value)} />
          <input style={{ ...inp, marginTop: 8 }} value={nombre} placeholder="Nombre (opcional): Agenda del Ayuntamiento" onChange={(ev) => setNombre(ev.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="tap" onClick={agregar} style={{ ...btn('var(--acc)', '#fff'), flex: 2 }}>Agregar</button>
            <button type="button" className="tap" onClick={() => setAbierto(false)} style={{ ...btn('var(--fill)', 'var(--ink)'), flex: 1 }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" style={{ ...link, marginTop: 8 }} onClick={() => setAbierto(true)}>{ic('plus', 13)}Agregar una página</button>
      )}
    </div>
  );
}

// ── COMPETENCIA ──
// Próxima noche Lun–Mié y Jue–Dom desde hoy (para comparar con el tarifario que rige)
const proxima = (finde) => {
  for (let i = 0; i < 7; i++) {
    const d = addDays(TODAY, i);
    if (isFindeDow(d.getDay()) === finde) return fmt(d);
  }
  return fmt(TODAY);
};
export function nuestroPrecio(tipo, periods) {
  return { entre: nightPrice(proxima(false), tipo, periods).price, finde: nightPrice(proxima(true), tipo, periods).price };
}
// "Estás 12% más barato" (positivo = ellos cobran más)
const difTxt = (nuestro, ellos) => {
  if (!nuestro || !ellos) return null;
  const d = Math.round(((ellos - nuestro) / nuestro) * 100);
  if (Math.abs(d) < 3) return { t: 'igual', c: 'var(--mut)' };
  return d > 0 ? { t: `estás ${d}% más barato`, c: 'var(--c-047857)' } : { t: `estás ${-d}% más caro`, c: 'var(--c-B45309)' };
};

export function Competencia({ periods = [] }) {
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [borrar, setBorrar] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.from('competencia').select('*').order('tipo').order('nombre');
    if (error) return setLista(faltaSql(error) ? false : []);
    setLista(data || []);
  };
  useEffect(() => { load(); }, []);
  if (lista === false) return null; // sin supabase/mejoras_nov.sql

  const nuevo = () => setForm({ nombre: '', link: '', tipo: 'privada', habitacion: '', precio_entre: '', precio_finde: '', notas: '' });
  const guardar = async () => {
    if (!form.nombre.trim()) return notify('Falta el nombre del lugar.', 'error');
    if (!Number(form.precio_entre) && !Number(form.precio_finde)) return notify('Poné al menos un precio.', 'error');
    setSaving(true);
    const row = {
      nombre: form.nombre.trim(), link: form.link.trim() || null, tipo: form.tipo, habitacion: form.habitacion.trim() || null,
      precio_entre: Number(form.precio_entre) || null, precio_finde: Number(form.precio_finde) || null, notas: form.notas.trim() || null,
      actualizado_en: new Date().toISOString(),
    };
    const { error } = form.id ? await supabase.from('competencia').update(row).eq('id', form.id) : await supabase.from('competencia').insert(row);
    setSaving(false);
    if (error) return notifyError(error, 'guardar el lugar');
    notify(form.id ? 'Precios actualizados.' : 'Lugar agregado.');
    setForm(null);
    load();
  };
  const eliminar = async (c) => {
    const { error } = await supabase.from('competencia').delete().eq('id', c.id);
    if (error) return notifyError(error, 'borrar el lugar');
    setBorrar(null);
    load();
  };

  // Resumen por tipo: promedio de ellos vs nuestro precio de esta semana
  const resumen = ROOM_TYPES.map((t) => {
    const del = (lista || []).filter((c) => c.tipo === t.id);
    if (!del.length) return null;
    const prom = (k) => { const v = del.map((c) => Number(c[k])).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
    const n = nuestroPrecio(t.id, periods);
    return { t, n, e: prom('precio_entre'), f: prom('precio_finde'), cant: del.length };
  }).filter(Boolean);

  return (
    <>
      <div style={sectionTitle}><Icon name="target" size={20} color="var(--c-4F46E5)" />Competencia</div>
      <p style={help}>3 o 4 lugares parecidos de la zona, con lo que cobran por noche para 2 personas. Flow los compara con el tarifario de esta semana y el Asesor IA los usa. Conviene actualizarlos cada mes.</p>
      {resumen.length > 0 && (
        <div style={{ ...card, background: 'var(--acc-soft)', boxShadow: 'none' }}>
          {resumen.map(({ t, n, e, f, cant }) => {
            const de = difTxt(n.entre, e), df = difTxt(n.finde, f);
            return (
              <div key={t.id} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{t.label} <span style={{ fontWeight: 600, color: 'var(--mut)', fontSize: 12 }}>· contra {cant} {cant === 1 ? 'lugar' : 'lugares'}</span></div>
                {e > 0 && de && <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Lun–Mié: vos {currency(n.entre)} · ellos {currency(Math.round(e))} → <b style={{ color: de.c }}>{de.t}</b></div>}
                {f > 0 && df && <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Jue–Dom: vos {currency(n.finde)} · ellos {currency(Math.round(f))} → <b style={{ color: df.c }}>{df.t}</b></div>}
              </div>
            );
          })}
        </div>
      )}
      <div style={card}>
        {lista === null ? (
          <div style={{ color: 'var(--mut)', fontSize: 13.5 }}>Cargando…</div>
        ) : lista.length === 0 && !form ? (
          <div style={{ color: 'var(--mut)', fontSize: 13.5 }}>Todavía no cargaron ningún lugar.</div>
        ) : (
          lista.map((c) => {
            const dias = diffDays(String(c.actualizado_en).slice(0, 10), fmt(TODAY));
            const tipo = ROOM_TYPES.find((t) => t.id === c.tipo);
            return (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 15 }}>
                    {c.link ? <a href={c.link} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{c.nombre}</a> : c.nombre}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                    {c.habitacion || 'Habitación'} · como {tipo ? tipo.label.toLowerCase() : 'otra'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 700 }}>
                    {c.precio_entre ? `Lun–Mié ${currency(c.precio_entre)}` : ''}{c.precio_entre && c.precio_finde ? ' · ' : ''}{c.precio_finde ? `Jue–Dom ${currency(c.precio_finde)}` : ''}
                  </div>
                  <div style={{ fontSize: 11.5, color: dias > 60 ? 'var(--c-B45309)' : 'var(--mut)', fontWeight: dias > 60 ? 700 : 500 }}>
                    {dias > 60 ? ic('warning', 12) : null}{dias <= 0 ? 'Actualizado hoy' : dias === 1 ? 'Actualizado ayer' : `Actualizado hace ${dias} días`}{dias > 60 ? ': conviene revisar el precio' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <button type="button" style={link} onClick={() => setForm({ ...c, link: c.link || '', habitacion: c.habitacion || '', precio_entre: c.precio_entre || '', precio_finde: c.precio_finde || '', notas: c.notas || '' })}>Actualizar</button>
                  {borrar === c.id ? (
                    <span style={{ fontSize: 12.5 }}>
                      <button type="button" style={{ ...link, color: 'var(--red)' }} onClick={() => eliminar(c)}>Sí, borrar</button> ·{' '}
                      <button type="button" style={{ ...link, color: 'var(--mut)' }} onClick={() => setBorrar(null)}>No</button>
                    </span>
                  ) : (
                    <button type="button" style={{ ...link, color: 'var(--mut)' }} onClick={() => setBorrar(c.id)}>Borrar</button>
                  )}
                </div>
              </div>
            );
          })
        )}
        {form ? (
          <div className="pop-in" style={{ marginTop: 10 }}>
            <span style={lbl}>Nombre del lugar</span>
            <input style={inp} value={form.nombre} placeholder="Ej: Hotel Playa Progreso" onChange={(ev) => setForm({ ...form, nombre: ev.target.value })} />
            <span style={lbl}>Link (opcional)</span>
            <input style={inp} value={form.link} placeholder="Booking, Airbnb, su web…" onChange={(ev) => setForm({ ...form, link: ev.target.value })} />
            <span style={lbl}>Se compara con</span>
            {chips(ROOM_TYPES.map((t) => [t.id, t.label]), form.tipo, (k) => setForm({ ...form, tipo: k }))}
            <span style={lbl}>Cómo llaman ellos a la habitación (opcional)</span>
            <input style={inp} value={form.habitacion} placeholder="Ej: Doble con vista al mar" onChange={(ev) => setForm({ ...form, habitacion: ev.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={lbl}>Lun–Mié $</span><input inputMode="numeric" style={inp} value={form.precio_entre} onChange={(ev) => setForm({ ...form, precio_entre: ev.target.value.replace(/[^\d.]/g, '') })} /></div>
              <div><span style={lbl}>Jue–Dom $</span><input inputMode="numeric" style={inp} value={form.precio_finde} onChange={(ev) => setForm({ ...form, precio_finde: ev.target.value.replace(/[^\d.]/g, '') })} /></div>
            </div>
            <span style={lbl}>Nota (opcional)</span>
            <input style={inp} value={form.notas} placeholder="Incluye desayuno, tiene alberca…" onChange={(ev) => setForm({ ...form, notas: ev.target.value })} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="tap" disabled={saving} onClick={guardar} style={{ ...btn('var(--acc)', '#fff'), flex: 2, opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
              <button type="button" className="tap" onClick={() => setForm(null)} style={{ ...btn('var(--fill)', 'var(--ink)'), flex: 1 }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button type="button" className="tap" onClick={nuevo} style={{ ...btn('var(--acc-soft)', 'var(--acc)'), width: '100%', marginTop: lista && lista.length ? 12 : 10 }}>
            {ic('plus', 15)}Agregar un lugar
          </button>
        )}
      </div>
    </>
  );
}

// Para el Asesor IA: competencia como texto ("Hotel X (como Habitaciones 1, 2, 3 y 5): Lun–Mié $1,200, Jue–Dom $1,500; nosotros …")
export async function competenciaParaAsesor(periods) {
  const { data, error } = await supabase.from('competencia').select('*');
  if (error || !data || !data.length) return [];
  return data.map((c) => {
    const t = ROOM_TYPES.find((x) => x.id === c.tipo);
    const n = t ? nuestroPrecio(t.id, periods) : null;
    return `${c.nombre}${c.habitacion ? ' (' + c.habitacion + ')' : ''}, comparable a ${t ? t.label : 'otra habitación'}: Lun-Mié $${c.precio_entre || '?'}, Jue-Dom $${c.precio_finde || '?'}${n ? ` (nosotros $${n.entre} / $${n.finde})` : ''}; actualizado ${String(c.actualizado_en).slice(0, 10)}${c.notas ? '; ' + c.notas : ''}`;
  });
}
