/* eslint-disable */
// @ts-nocheck
// ── Finanzas › Egresos ────────────────────────────────────────────────────────
// Dos pestañas:
//   · Gastos del mes: elegís el mes (‹ Noviembre 2026 ›) y ves los fijos de ese mes + los gastos del mes.
//     Un fijo se puede ajustar solo en ese mes ("Este mes fue $X") o marcar "No hubo este mes" ($0).
//   · Gastos fijos: la lista que se carga una vez (renta, sueldos, internet…). Flow los suma solo en cada mes
//     (supabase/gastos_fijos.sql: crea una fila en `gastos` por mes, con fijo_id y mes).
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { currency, parseD, fmt, TODAY } from '../lib/dates';
import { Icon } from './ui/Icon';
import { notify, notifyError } from '../lib/voice';
import { Collapse } from './ui/Motion';

export const CATEGORIAS = [
  ['Renta', 'Renta'],
  ['Sueldos', 'Sueldos'],
  ['Servicios', 'Servicios (Luz/Agua/Internet)'],
  ['Insumos', 'Insumos (Limpieza/Desayuno)'],
  ['Mantenimiento', 'Mantenimiento'],
  ['Impuestos', 'Impuestos'],
  ['Comisiones', 'Comisiones (Booking/OTA)'],
  ['Otro', 'Otro'],
];
const CADA = [[1, 'Todos los meses'], [2, 'Cada 2 meses'], [3, 'Cada 3 meses'], [6, 'Cada 6 meses'], [12, 'Una vez al año']];
const cadaTexto = (n) => ({ 1: 'todos los meses', 2: 'cada 2 meses', 3: 'cada 3 meses', 6: 'cada 6 meses', 12: 'una vez al año' }[n] || 'todos los meses');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesActual = () => fmt(TODAY).slice(0, 7);
const mesDe = (g) => g.mes || (g.fecha || '').slice(0, 7);
const mesLargo = (k) => { const [y, m] = k.split('-').map(Number); return `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} ${y}`; };
const mesSolo = (k) => MESES[Number(k.slice(5, 7)) - 1];
const mesCorto = (k) => `${MES_CORTO[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const mover = (k, d) => { const [y, m] = k.split('-').map(Number); const t = new Date(y, m - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
const ultimoDia = (k) => { const [y, m] = k.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const diaCorto = (d) => (d ? parseD(d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '').replace(' de ', ' ') : '');
const faltaTabla = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || ''));

// Estilos
const LBL = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 5 };
const INP = { width: '100%', padding: '10px 12px', borderRadius: 'var(--r-field)', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' };
const BOX = { background: 'var(--inset)', padding: 14, borderRadius: 'var(--r-item)', display: 'flex', flexDirection: 'column', gap: 12 };
const BTN = (bg, color = '#fff') => ({ border: 'none', borderRadius: 'var(--r-field)', padding: '10px 14px', minHeight: 42, background: bg, color, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 });
const LINK = (color = 'var(--mut)') => ({ background: 'transparent', border: 'none', color, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 13, padding: '4px 6px' });
const CAT = { fontSize: 11.5, fontWeight: 700, color: 'var(--c-991B1B)', background: 'var(--c-FEE2E2)', padding: '2px 8px', borderRadius: 20 };
const FIJO = { fontSize: 11.5, fontWeight: 700, color: 'var(--acc)', background: 'var(--acc-soft)', padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 3 };
const SUB = { fontSize: 13, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: 0.3, margin: '14px 0 4px', display: 'flex', justifyContent: 'space-between' };

function Seg({ value, onChange, items }) {
  return (
    <div style={{ display: 'flex', background: 'var(--fill)', borderRadius: 12, padding: 3, gap: 3, marginBottom: 14 }}>
      {items.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className="tap" style={{
          flex: 1, border: 'none', borderRadius: 10, padding: '8px 10px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          background: value === k ? 'var(--card)' : 'transparent', color: value === k ? 'var(--ink)' : 'var(--mut)',
          boxShadow: value === k ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
        }}>{label}</button>
      ))}
    </div>
  );
}

const CatSelect = ({ value, onChange }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} style={INP}>
    {CATEGORIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    {!CATEGORIAS.some(([v]) => v === value) && value ? <option value={value}>{value}</option> : null}
  </select>
);

export function Egresos({ gastos, setGastos, recargar, who }) {
  const [vista, setVista] = useState('mes');
  const [mes, setMes] = useState(mesActual());
  const [fijos, setFijos] = useState([]);
  const [faltaSql, setFaltaSql] = useState(false);

  const cargarFijos = async () => {
    const { data, error } = await supabase.from('gastos_fijos').select('*').order('concepto');
    if (error) { setFaltaSql(faltaTabla(error)); if (!faltaTabla(error)) notifyError(error, 'cargar los gastos fijos'); return; }
    setFaltaSql(false);
    setFijos(data || []);
  };
  useEffect(() => { cargarFijos(); }, []);

  const fijoDe = (id) => fijos.find((f) => f.id === id);
  const hoyMes = mesActual();
  const activos = fijos.filter((f) => !f.hasta || f.hasta.slice(0, 7) >= hoyMes);
  const terminados = fijos.filter((f) => f.hasta && f.hasta.slice(0, 7) < hoyMes);
  const porMes = activos.reduce((s, f) => s + Number(f.monto) / (f.cada_meses || 1), 0);

  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--r-card)', padding: '16px 18px', marginBottom: 24, boxShadow: 'var(--shadow)' }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="wallet" size={20} color="var(--red)" />Egresos
      </h3>
      <Seg value={vista} onChange={setVista} items={[['mes', 'Gastos del mes'], ['fijos', `Gastos fijos${activos.length ? ` (${activos.length})` : ''}`]]} />
      {vista === 'mes' ? (
        <DelMes {...{ gastos, setGastos, mes, setMes, fijoDe, fijos, hayFijos: fijos.length > 0, irAFijos: () => setVista('fijos') }} />
      ) : (
        <Fijos {...{ activos, terminados, porMes, faltaSql, gastos, setGastos, recargar, cargarFijos, who }} />
      )}
    </div>
  );
}

// ── Gastos del mes ────────────────────────────────────────────────────────────
function DelMes({ gastos, setGastos, mes, setMes, fijoDe, fijos, hayFijos, irAFijos }) {
  const hoyMes = mesActual();
  const primero = gastos.reduce((min, g) => (mesDe(g) && mesDe(g) < min ? mesDe(g) : min), hoyMes);
  const delMes = gastos.filter((g) => mesDe(g) === mes);
  const fij = delMes.filter((g) => g.fijo_id).sort((a, b) => (a.notas || '').localeCompare(b.notas || ''));
  const vars = delMes.filter((g) => !g.fijo_id).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const totF = fij.reduce((s, g) => s + Number(g.monto || 0), 0);
  const totV = vars.reduce((s, g) => s + Number(g.monto || 0), 0);

  const [editando, setEditando] = useState(null); // id de fila fija que se ajusta en este mes
  const [montoEdit, setMontoEdit] = useState('');
  const [borrar, setBorrar] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const fechaInicial = () => (mes === hoyMes ? fmt(TODAY) : `${mes}-01`);
  const [form, setForm] = useState({ fecha: fechaInicial(), monto: '', categoria: 'Insumos', notas: '' });
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setForm((f) => ({ ...f, fecha: fechaInicial() })); setEditando(null); setBorrar(null); }, [mes]);

  const actualizar = async (g, monto, texto) => {
    const { error } = await supabase.from('gastos').update({ monto }).eq('id', g.id);
    if (error) return notifyError(error, 'cambiar el gasto');
    setGastos((prev) => prev.map((x) => (x.id === g.id ? { ...x, monto } : x)));
    setEditando(null);
    notify(texto);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.monto || Number(form.monto) <= 0) return;
    setGuardando(true);
    const { data, error } = await supabase.from('gastos').insert([{ fecha: form.fecha, monto: Number(form.monto), categoria: form.categoria, notas: form.notas }]).select();
    setGuardando(false);
    if (error || !data?.length) return notifyError(error, 'guardar el gasto');
    setGastos((prev) => [data[0], ...prev].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
    setForm({ ...form, monto: '', notas: '' });
    notify(`Gasto guardado · ${currency(data[0].monto)} en ${data[0].categoria}`);
  };

  const eliminar = async (id) => {
    const { error } = await supabase.from('gastos').delete().eq('id', id);
    setBorrar(null);
    if (error) return notifyError(error, 'eliminar el gasto');
    setGastos((prev) => prev.filter((g) => g.id !== id));
    notify('Gasto eliminado');
  };

  return (
    <div>
      {/* Mes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button aria-label="Mes anterior" disabled={mes <= primero} onClick={() => setMes(mover(mes, -1))} className="tap" style={{ ...BTN('var(--fill)', 'var(--ink)'), width: 40, minHeight: 40, padding: 0, opacity: mes <= primero ? 0.35 : 1 }}><Icon name="chevL" size={18} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 'var(--w-title)', color: 'var(--ink)' }}>{mesLargo(mes)}</div>
          <div style={{ fontSize: 14, color: 'var(--mut)' }}>Total <b style={{ color: 'var(--red)' }}>-{currency(totF + totV)}</b></div>
        </div>
        <button aria-label="Mes siguiente" disabled={mes >= hoyMes} onClick={() => setMes(mover(mes, 1))} className="tap" style={{ ...BTN('var(--fill)', 'var(--ink)'), width: 40, minHeight: 40, padding: 0, opacity: mes >= hoyMes ? 0.35 : 1 }}><Icon name="chev" size={18} /></button>
      </div>
      {mes !== hoyMes && (
        <div style={{ textAlign: 'center', marginTop: 4 }}><button onClick={() => setMes(hoyMes)} style={LINK('var(--acc)')}>Volver a {mesSolo(hoyMes)}</button></div>
      )}

      {/* Fijos de este mes */}
      <div style={SUB}><span>Fijos</span><span>{currency(totF)}</span></div>
      {fij.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--mut)', margin: '4px 0 8px' }}>
          {hayFijos ? 'Ningún gasto fijo cae en este mes.' : <>Todavía no cargaste gastos fijos. <button onClick={irAFijos} style={{ ...LINK('var(--acc)'), padding: 0, fontSize: 14 }}>Cargarlos una vez</button> y se suman solos cada mes.</>}
        </p>
      ) : (
        <div className="ui-group" style={{ boxShadow: 'none', margin: 0, padding: 0, background: 'transparent' }}>
          {fij.map((g) => {
            const f = fijoDe(g.fijo_id);
            const cero = Number(g.monto) === 0;
            const distinto = f && !cero && Number(g.monto) !== Number(f.monto);
            return (
              <div key={g.id} className="ui-row" style={{ cursor: 'default', padding: '11px 4px', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ minWidth: 0, opacity: cero ? 0.55 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={FIJO}><Icon name="repeat" size={11} strokeWidth={2.6} />Fijo</span>
                      <span style={CAT}>{g.categoria}</span>
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{g.notas}</div>
                    {cero && <div style={{ fontSize: 13, color: 'var(--mut)' }}>No hubo este mes</div>}
                    {distinto && <div style={{ fontSize: 13, color: 'var(--mut)' }}>Este mes fue distinto (normalmente {currency(f.monto)})</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, color: cero ? 'var(--mut)' : 'var(--red)', fontSize: 15, whiteSpace: 'nowrap', textDecoration: cero ? 'line-through' : 'none' }}>-{currency(cero && f ? f.monto : g.monto)}</span>
                    {cero ? (
                      <button onClick={() => actualizar(g, Number(f?.monto || 0), `${g.notas} vuelve a contar este mes`)} style={LINK('var(--acc)')}>Deshacer</button>
                    ) : editando !== g.id && (
                      <button onClick={() => { setEditando(g.id); setMontoEdit(String(g.monto)); }} style={LINK('var(--acc)')}>Ajustar</button>
                    )}
                  </div>
                </div>
                {editando === g.id && (
                  <div className="pop-in" style={{ ...BOX, gap: 10 }}>
                    <label style={LBL}>¿Cuánto fue en {mesSolo(mes)}?</label>
                    <input type="number" inputMode="decimal" autoFocus value={montoEdit} onChange={(e) => setMontoEdit(e.target.value)} style={INP} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="tap" onClick={() => Number(montoEdit) > 0 && actualizar(g, Number(montoEdit), `${g.notas}: ${currency(montoEdit)} en ${mesSolo(mes)}`)} style={{ ...BTN('var(--acc)'), flex: 2 }}>Guardar</button>
                      <button className="tap" onClick={() => actualizar(g, 0, `${g.notas}: no hubo en ${mesSolo(mes)}`)} style={{ ...BTN('var(--card)', 'var(--ink)'), flex: 2 }}>No hubo este mes</button>
                      <button onClick={() => setEditando(null)} style={LINK()}>Cancelar</button>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>Cambia solo {mesSolo(mes)}. Para cambiarlo de acá en adelante, editalo en Gastos fijos.</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Gastos del mes */}
      <div style={SUB}><span>Del mes</span><span>{currency(totV)}</span></div>
      {vars.length === 0 && <p style={{ fontSize: 14, color: 'var(--mut)', margin: '4px 0 8px' }}>Sin otros gastos en {mesSolo(mes)}.</p>}
      <div className="ui-group" style={{ boxShadow: 'none', margin: 0, padding: 0, background: 'transparent' }}>
        {vars.map((g) => (
          <div key={g.id} className="ui-row" style={{ cursor: 'default', justifyContent: 'space-between', padding: '11px 4px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={CAT}>{g.categoria}</span>
                <span style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 500 }}>{diaCorto(g.fecha)}</span>
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{g.notas}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontWeight: 700, color: 'var(--red)', fontSize: 15, whiteSpace: 'nowrap' }}>-{currency(g.monto)}</span>
              {borrar === g.id ? (
                <span className="pop-in" style={{ whiteSpace: 'nowrap' }}>
                  <button onClick={() => eliminar(g.id)} style={LINK('var(--red)')}>Sí, eliminar</button>
                  <button onClick={() => setBorrar(null)} style={LINK()}>Cancelar</button>
                </span>
              ) : (
                <button aria-label="Eliminar gasto" onClick={() => setBorrar(g.id)} style={{ background: 'var(--fill)', border: 'none', color: 'var(--mut)', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><Icon name="close" size={15} strokeWidth={2.5} /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Agregar */}
      {!abierto ? (
        <button className="tap" onClick={() => setAbierto(true)} style={{ ...BTN('var(--red)'), width: '100%', marginTop: 10 }}>
          <Icon name="plus" size={18} strokeWidth={2.5} />Agregar gasto de {mesSolo(mes)}
        </button>
      ) : (
        <form onSubmit={guardar} className="pop-in" style={{ ...BOX, marginTop: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={LBL}>Fecha</label>
              <input type="date" min={`${mes}-01`} max={`${mes}-${String(ultimoDia(mes)).padStart(2, '0')}`} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} style={INP} required />
            </div>
            <div>
              <label style={LBL}>Monto $</label>
              <input type="number" inputMode="decimal" placeholder="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} style={INP} required />
            </div>
          </div>
          <div><label style={LBL}>Categoría</label><CatSelect value={form.categoria} onChange={(v) => setForm({ ...form, categoria: v })} /></div>
          <div><label style={LBL}>Concepto</label><input type="text" placeholder="Ej. Pintura pasillo…" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} style={INP} required /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={guardando} type="submit" className="tap" style={{ ...BTN('var(--red)'), flex: 1, opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Guardando…' : 'Guardar gasto'}</button>
            <button type="button" onClick={() => setAbierto(false)} style={LINK()}>Cerrar</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Gastos fijos ──────────────────────────────────────────────────────────────
const VACIO = () => ({ concepto: '', monto: '', categoria: 'Renta', cada_meses: 1, desde: mesActual() });

function Fijos({ activos, terminados, porMes, faltaSql, gastos, setGastos, recargar, cargarFijos, who }) {
  const [form, setForm] = useState(null); // null = cerrado; { id? , ... }
  const [confirmar, setConfirmar] = useState(null); // 'parar' | 'borrar'
  const [guardando, setGuardando] = useState(false);
  const [verTerminados, setVerTerminados] = useState(false);
  const hoyMes = mesActual();

  if (faltaSql) {
    return (
      <div style={{ ...BOX, background: 'var(--c-FEF3C7)' }}>
        <div style={{ fontWeight: 700, color: 'var(--ink)' }}>Falta un paso</div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)' }}>Para usar los gastos fijos hay que correr <b>supabase/gastos_fijos.sql</b> en Supabase (SQL Editor).</div>
      </div>
    );
  }

  const abrirNuevo = () => { setConfirmar(null); setForm(VACIO()); };
  const abrirEditar = (f) => { setConfirmar(null); setForm({ id: f.id, concepto: f.concepto, monto: String(f.monto), categoria: f.categoria, cada_meses: f.cada_meses || 1, desde: f.desde.slice(0, 7), _orig: f }); };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.concepto.trim() || !(Number(form.monto) > 0) || !form.desde) return;
    setGuardando(true);
    const fila = { concepto: form.concepto.trim(), monto: Number(form.monto), categoria: form.categoria, cada_meses: Number(form.cada_meses), desde: `${form.desde}-01` };
    try {
      if (!form.id) {
        const { error } = await supabase.from('gastos_fijos').insert([{ ...fila, creado_por: who || null }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('gastos_fijos').update(fila).eq('id', form.id);
        if (error) throw error;
        // De este mes en adelante toma los datos nuevos (los meses pasados quedan como estaban;
        // si este mes se marcó "No hubo", sigue en $0)
        const { error: e2 } = await supabase.from('gastos').update({ monto: fila.monto, categoria: fila.categoria, notas: fila.concepto })
          .eq('fijo_id', form.id).gte('mes', hoyMes).gt('monto', 0);
        if (e2) throw e2;
        // Si ahora empieza más tarde, se sacan los meses de antes
        const { error: e3 } = await supabase.from('gastos').delete().eq('fijo_id', form.id).lt('mes', form.desde);
        if (e3) throw e3;
        if (Number(form.cada_meses) !== Number(form._orig.cada_meses)) {
          // Cambió cada cuánto: se rehacen los meses desde este en adelante con la nueva frecuencia
          await supabase.from('gastos').delete().eq('fijo_id', form.id).gte('mes', hoyMes);
        }
      }
      await cargarFijos();
      await recargar();
      const desdeAntes = form.desde < hoyMes;
      notify(form.id
        ? `Listo, ${fila.concepto} actualizado de ${mesSolo(hoyMes)} en adelante`
        : `Listo, ${fila.concepto} se suma solo ${cadaTexto(fila.cada_meses)}${desdeAntes ? ` (también desde ${mesCorto(form.desde)})` : ''}`);
      setForm(null);
    } catch (err) {
      notifyError(err, 'guardar el gasto fijo');
    } finally {
      setGuardando(false);
    }
  };

  // "Ya no lo pagamos": deja de sumarse desde este mes (los meses pasados quedan)
  const parar = async () => {
    const id = form.id;
    setGuardando(true);
    try {
      const { error } = await supabase.from('gastos_fijos').update({ hasta: `${mover(hoyMes, -1)}-01` }).eq('id', id);
      if (error) throw error;
      const { error: e2 } = await supabase.from('gastos').delete().eq('fijo_id', id).gte('mes', hoyMes);
      if (e2) throw e2;
      setGastos((prev) => prev.filter((g) => !(g.fijo_id === id && mesDe(g) >= hoyMes)));
      await cargarFijos();
      notify(`${form.concepto} deja de sumarse desde ${mesSolo(hoyMes)}. Los meses pasados quedan.`);
      setForm(null);
    } catch (err) { notifyError(err, 'cambiar el gasto fijo'); } finally { setGuardando(false); setConfirmar(null); }
  };

  // Borrar todo: de la lista y de todos los meses
  const borrarTodo = async () => {
    const id = form.id;
    setGuardando(true);
    try {
      const { error } = await supabase.from('gastos').delete().eq('fijo_id', id);
      if (error) throw error;
      const { error: e2 } = await supabase.from('gastos_fijos').delete().eq('id', id);
      if (e2) throw e2;
      setGastos((prev) => prev.filter((g) => g.fijo_id !== id));
      await cargarFijos();
      notify(`${form.concepto} borrado de la lista y de todos los meses`);
      setForm(null);
    } catch (err) { notifyError(err, 'borrar el gasto fijo'); } finally { setGuardando(false); setConfirmar(null); }
  };

  const filasDe = (id) => gastos.filter((g) => g.fijo_id === id);

  const Formulario = () => {
    const filas = form.id ? filasDe(form.id) : [];
    const total = filas.reduce((s, g) => s + Number(g.monto || 0), 0);
    return (
      <form onSubmit={guardar} className="pop-in" style={{ ...BOX, marginTop: 10 }}>
        <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 16 }}>{form.id ? `Editar ${form._orig.concepto}` : 'Nuevo gasto fijo'}</div>
        <div><label style={LBL}>Concepto</label><input type="text" autoFocus={!form.id} placeholder="Ej. Renta del local, Sueldo Mary, Internet…" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} style={INP} required /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={LBL}>Monto $</label><input type="number" inputMode="decimal" placeholder="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} style={INP} required /></div>
          <div><label style={LBL}>Desde</label><input type="month" max={hoyMes} value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} style={INP} required /></div>
        </div>
        <div><label style={LBL}>Categoría</label><CatSelect value={form.categoria} onChange={(v) => setForm({ ...form, categoria: v })} /></div>
        <div>
          <label style={LBL}>Se paga</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CADA.map(([n, l]) => (
              <button type="button" key={n} onClick={() => setForm({ ...form, cada_meses: n })} className="tap" style={{
                border: 'none', borderRadius: 20, padding: '7px 12px', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                background: Number(form.cada_meses) === n ? 'var(--acc-soft)' : 'var(--card)', color: Number(form.cada_meses) === n ? 'var(--acc)' : 'var(--ink)',
                boxShadow: Number(form.cada_meses) === n ? 'inset 0 0 0 1.5px var(--acc)' : 'inset 0 0 0 1px var(--line)',
              }}>{l}</button>
            ))}
          </div>
        </div>
        {!form.id && form.desde < hoyMes && (
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Se suma también en los meses de {mesCorto(form.desde)} a hoy, así Finanzas los tiene en cuenta.</div>
        )}
        {form.id && (
          <div style={{ fontSize: 13, color: 'var(--mut)' }}>Los cambios valen de {mesSolo(hoyMes)} en adelante; los meses pasados quedan como estaban.</div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button disabled={guardando} type="submit" className="tap" style={{ ...BTN('var(--acc)'), flex: 1, opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Guardar gasto fijo'}</button>
          <button type="button" onClick={() => { setForm(null); setConfirmar(null); }} style={LINK()}>Cerrar</button>
        </div>
        {form.id && !confirmar && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', borderTop: '0.5px solid var(--line)', paddingTop: 8 }}>
            {(!form._orig.hasta || form._orig.hasta.slice(0, 7) >= hoyMes) && <button type="button" onClick={() => setConfirmar('parar')} style={LINK()}>Ya no lo pagamos</button>}
            <span style={{ color: 'var(--mut)', alignSelf: 'center' }}>·</span>
            <button type="button" onClick={() => setConfirmar('borrar')} style={LINK('var(--red)')}>Borrar</button>
          </div>
        )}
        {confirmar === 'parar' && (
          <div className="pop-in" style={{ fontSize: 14, color: 'var(--ink)', textAlign: 'center' }}>
            ¿Deja de sumarse desde {mesSolo(hoyMes)}? Los meses pasados quedan.
            <div><button type="button" onClick={parar} style={LINK('var(--red)')}>Sí, ya no lo pagamos</button><button type="button" onClick={() => setConfirmar(null)} style={LINK()}>Cancelar</button></div>
          </div>
        )}
        {confirmar === 'borrar' && (
          <div className="pop-in" style={{ fontSize: 14, color: 'var(--ink)', textAlign: 'center' }}>
            Se borra de la lista y de {filas.length === 1 ? 'su mes' : `los ${filas.length} meses`} donde se sumó ({currency(total)}). Si solo dejaron de pagarlo, mejor "Ya no lo pagamos".
            <div><button type="button" onClick={borrarTodo} style={LINK('var(--red)')}>Sí, borrar todo</button><button type="button" onClick={() => setConfirmar(null)} style={LINK()}>Cancelar</button></div>
          </div>
        )}
      </form>
    );
  };

  const fila = (f, apagado = false) => (
    <div key={f.id} className="ui-row" onClick={() => abrirEditar(f)} style={{ justifyContent: 'space-between', padding: '11px 4px', opacity: apagado ? 0.6 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{f.concepto}</div>
        <div style={{ fontSize: 13, color: 'var(--mut)' }}>
          {f.categoria} · {cadaTexto(f.cada_meses)} · {apagado ? `hasta ${mesCorto(f.hasta.slice(0, 7))}` : `desde ${mesCorto(f.desde.slice(0, 7))}`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--red)', fontSize: 15, whiteSpace: 'nowrap' }}>-{currency(f.monto)}</span>
        <Icon name="chev" size={16} color="var(--mut)" />
      </div>
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--mut)', margin: '0 0 6px', lineHeight: 1.45 }}>
        Lo que se paga siempre (renta, sueldos, internet…). Se carga una vez y Flow lo suma solo en cada mes.
        {activos.length > 0 && <> En promedio, <b style={{ color: 'var(--ink)' }}>{currency(Math.round(porMes))} por mes</b>.</>}
      </p>
      {form && !form.id && Formulario()}
      <div className="ui-group" style={{ boxShadow: 'none', margin: 0, padding: 0, background: 'transparent' }}>
        {activos.map((f) => (form?.id === f.id ? <div key={f.id}>{Formulario()}</div> : fila(f)))}
      </div>
      {!form && (
        <button className="tap" onClick={abrirNuevo} style={{ ...BTN('var(--acc)'), width: '100%', marginTop: 10 }}>
          <Icon name="plus" size={18} strokeWidth={2.5} />Agregar gasto fijo
        </button>
      )}
      {terminados.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setVerTerminados((x) => !x)} style={LINK()}>{verTerminados ? 'Ocultar' : 'Ver'} los que ya no pagamos ({terminados.length})</button>
          <Collapse open={verTerminados}>
            <div className="ui-group" style={{ boxShadow: 'none', margin: 0, padding: 0, background: 'transparent' }}>
              {terminados.map((f) => (form?.id === f.id ? <div key={f.id}>{Formulario()}</div> : fila(f, true)))}
            </div>
          </Collapse>
        </div>
      )}
    </div>
  );
}
