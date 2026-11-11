/* eslint-disable */
// @ts-nocheck
// Sección Equipo (ex Itzé Limpieza) dentro de Flow. Paso 5 del plan de estilo y fusión.
// - Mary (rol equipo con permiso "limpieza") la ve a pantalla completa, exactamente como hoy en Limpieza, en naranja.
// - Los dueños la ven como pestaña "Equipo" (vista de dueños) y pueden tocar "Ver como Mary".
// Copia la lógica de render() de Limpieza (app.js). Estilos: limpieza-base.css (los de Limpieza dentro de .eq).
// Las habitaciones del día salen de las reservas de Flow (equipo_reservas), sin carga a mano.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { notify, notifyError, nowMerida } from '../../lib/voice';
import {
  PROP, hoyStr, mananaStr, prevOf, hhmm, ampm, money, RST, roomsOfDay, linOn, rOrd, rKey, stayDay, priceToday,
  ALLZ, ALLH, ZONE_ROOMS, COMMON, PRIV, SECTORES, sectorOf, DOWS, progLabel, loadEquipo, shrink, WA,
} from '../../lib/equipo';
import { ROOMS } from '../../lib/constants';
import { fmt } from '../../lib/dates';
import { TIPS, careLine, WATER_NUDGE, waterText, HELP } from '../../lib/equipoVoz';
import { I } from './icons';
import { movTexto, cuando, visoTexto } from '../../lib/movimientos';
import { pushSupported, pushGranted, pushBlocked, isIOS, isStandalone, enablePush, syncPush } from '../../lib/push';
import Sortable from 'sortablejs';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import { Modal } from '../../components/ui/Modal';
import { Toast } from '../../components/ui/Toast';
import { Quoter } from '../../components/Quoter';
import { ResForm } from '../../components/reservations/ResForm';
import { ResDrawer } from '../../components/reservations/ResDrawer';
import { puede } from '../../lib/roles';
import { prepRes } from '../../lib/resDb';
import { PERSON_FIELDS } from '../../lib/groups';
import { PROPS } from '../../lib/constants';
import { SAVED } from '../../lib/voice';
import './limpieza-base.css';
import './equipo.css';

const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
};
const ymdMerida = (iso) => fmt(new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/Merida' })));
const vib = (n) => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) {} };

// Consejo del día de "Tu momento" (igual que Limpieza: según las tareas de hoy, sin repetir; si no, día por medio)
function pickTip(t, tareas) {
  try {
    const saved = ls.get('eq-tip-' + t);
    if (saved !== null) return saved === '-' ? '' : TIPS[+saved] ? TIPS[+saved].t : '';
    const txt = tareas.filter((x) => x.tipo === 'hoy' && x.fecha === t).map((x) => x.texto + ' ' + (x.zona || '')).join(' ').toLowerCase();
    const day = Math.floor(Date.now() / 864e5);
    let seen = JSON.parse(ls.get('eq-tips-vistos') || '[]');
    const idx = TIPS.map((x, i) => i);
    let pool = txt ? idx.filter((i) => TIPS[i].k && TIPS[i].k.test(txt) && !seen.includes(i)) : [];
    if (!pool.length) {
      if (day % 2) { ls.set('eq-tip-' + t, '-'); return ''; }
      const base = idx.filter((i) => !TIPS[i].k);
      pool = base.filter((i) => !seen.includes(i));
      if (!pool.length) { seen = seen.filter((i) => TIPS[i] && TIPS[i].k); pool = base; }
    }
    const i = pool[Math.floor(Math.random() * pool.length)];
    seen.push(i); ls.set('eq-tips-vistos', JSON.stringify(seen)); ls.set('eq-tip-' + t, String(i));
    return TIPS[i].t;
  } catch (e) { return ''; }
}

function burst() {
  for (let i = 0; i < 22; i++) {
    const s = document.createElement('span');
    s.className = 'eq-conf'; s.textContent = ['🎉', '✨', '🧼', '⭐', '💛'][i % 5];
    s.style.left = Math.random() * 95 + '%'; s.style.animationDelay = Math.random() * 0.6 + 's';
    document.body.appendChild(s); setTimeout(() => s.remove(), 3200);
  }
}

export function EquipoView({ user, who = '', standalone = false, onLogout = null, movs = [], onOpenMov = null, onVisto = null }) {
  const isDueno = user?.role === 'dueno';
  const role = isDueno ? 'owner' : 'mary';
  const myName = isDueno ? who || 'Dueños' : user?.name || 'Mary';
  const maryName = isDueno ? 'Mary' : myName;
  const [view, setView] = useState(isDueno ? 'owner' : 'mary');
  const own = isDueno && view === 'owner';
  // Paso 9: Mary cotiza y reserva (los mismos Cotizar y formulario de los dueños, canal Por puerta)
  const canQuote = !isDueno && puede(user, 'cotizar');
  const canBook = !isDueno && puede(user, 'reservar');
  const canCheck = !isDueno && puede(user, 'checkin'); // check-in/out y cobrar el saldo
  const canOpen = canBook || canCheck; // tocar el nombre abre el panel de la reserva
  const [drawerId, setDrawerId] = useState(null);
  const [editRes, setEditRes] = useState(null); // reserva a editar (propia: todo; ajena: solo datos del huésped)
  const [quoter, setQuoter] = useState(null); // { initialIn }
  const [form, setForm] = useState(null); // { initial, rooms, queue, chain, key }
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 769);
  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  const [data, setData] = useState({ tareas: [], fotos: {}, dia: null, insumos: [], marcas: [], reservas: [], tarifas: [] });
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [, setTick] = useState(0);
  const [dial, setDial] = useState(false);
  const [showDay, setShowDay] = useState(false);
  const [zoom, setZoom] = useState('');
  const [ask, setAsk] = useState(null); // { text, yes, resolve }
  const [sheet, setSheet] = useState(null); // nota: { edit }
  const [sup, setSup] = useState(null); // { fin }
  const [fin, setFin] = useState(null); // 'warn' | 'first' | 'again' | 'sup'
  const lastAll = useRef(false);
  const finStep = useRef('first'); // paso del cierre desde el que se abrió la nota

  // ── carga y tiempo real ─────────────────────────────────────────────────────
  const rt = useRef(null);
  const dragging = useRef(false);
  const rootRef = useRef(null);
  const load = useCallback(async () => {
    if (dragging.current) { clearTimeout(rt.current); rt.current = setTimeout(load, 400); return; }
    try { const d = await loadEquipo({ conReservas: canQuote || canOpen }); if (!dragging.current) { setData(d); setLoaded(true); setLoadErr(''); } }
    catch (e) { setLoadErr(e?.message || 'sin conexión'); }
  }, [canQuote, canBook]);
  const refresh = useCallback(() => { clearTimeout(rt.current); rt.current = setTimeout(load, 80); }, [load]);
  useEffect(() => {
    load();
    const ch = supabase.channel('equipo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipo_tareas' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipo_dias' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipo_insumos' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipo_habitaciones' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarifas' }, refresh)
      .subscribe();
    // Las reservas no llegan en tiempo real al equipo (no puede leer la tabla): se vuelven a pedir cada minuto
    const iv = setInterval(() => { setTick((x) => x + 1); if (!document.hidden) refresh(); }, 60000);
    const vis = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', vis);
    return () => { supabase.removeChannel(ch); clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, [load, refresh]);

  // Avisos (paso 7): Mary anota este aparato con su nombre al abrir; al abrir se borra el numerito del ícono
  const [pushOn, setPushOn] = useState(() => pushGranted());
  useEffect(() => {
    if (isDueno) return undefined;
    syncPush(myName);
    const clear = () => {
      try {
        if (navigator.clearAppBadge) navigator.clearAppBadge();
        if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then((r) => r.getNotifications()).then((l) => l.forEach((n) => n.close())).catch(() => {});
      } catch (e) {}
    };
    clear();
    const vis = () => { if (!document.hidden) clear(); };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [isDueno, myName]);
  async function activarAvisos() {
    if (!pushSupported()) {
      notify(isIOS() && !isStandalone()
        ? 'Para recibir avisos en iPhone: abre Flow en Safari, toca Compartir › "Agregar a pantalla de inicio" y abre la app desde ese ícono. Ahí toca otra vez "Activar avisos".'
        : 'Este navegador no permite avisos.', 'info');
      return;
    }
    if (pushBlocked()) { notify('Los avisos están bloqueados. Actívalos en los ajustes del navegador o de la app para este sitio.', 'info'); return; }
    try {
      const r = await enablePush(myName);
      if (r === 'ok') { setPushOn(true); notify('¡Listo! Avisos activados.'); }
    } catch (e) { notifyError(e, 'activar los avisos'); }
  }

  const t = hoyStr();
  const { tareas, fotos, dia, insumos, marcas, reservas, tarifas } = data;
  const closed = !!dia?.cerrado;
  const started = dia?.empezo_en || null;

  // ── confirmación (en vez de confirm()) ──────────────────────────────────────
  const confirmar = (text, yes = 'Sí') => new Promise((resolve) => setAsk({ text, yes, resolve }));
  const fail = (err) => { notifyError(err, 'guardar'); refresh(); };
  const patchLocal = (key, fn) => setData((d) => ({ ...d, [key]: fn(d[key]) }));

  // ── tareas ───────────────────────────────────────────────────────────────────
  const isDone = (x) => (x.tipo === 'rutina' ? x.hecha_fecha === t : !!x.hecha);
  const mine = tareas.filter((x) => x.tipo === 'rutina' || (x.tipo === 'hoy' && (x.fecha === t || (!x.hecha && x.fecha < t))));
  const srt = (a) => a.slice().sort((p, q) => (isDone(p) - isDone(q)) || ((p.orden ?? 1e9) - (q.orden ?? 1e9)) || (p.creada_en < q.creada_en ? -1 : 1));
  const late = srt(mine.filter((x) => x.tipo === 'hoy' && x.fecha < t));
  const hoy = srt(mine.filter((x) => x.tipo === 'hoy' && x.fecha === t));
  const fij = srt(mine.filter((x) => x.tipo === 'rutina'));
  const total = mine.length, done = mine.filter(isDone).length, all = total > 0 && done === total;
  const pendNames = mine.filter((x) => !isDone(x)).map((x) => x.texto);
  const pct = total ? Math.round((done / total) * 100) : 0;

  useEffect(() => {
    if (loaded && all && !lastAll.current) burst();
    lastAll.current = all;
  }, [loaded, all]);

  useEffect(() => {
    if (!own || !rootRef.current) return undefined;
    const list = [...rootRef.current.querySelectorAll('.grp')].map((g) => {
      let before = [];
      return Sortable.create(g, {
        draggable: '.it', animation: 180, forceFallback: true, delay: 350, delayOnTouchOnly: true, touchStartThreshold: 6,
        ghostClass: 'drag-ghost', chosenClass: 'drag-chosen', filter: '.ck, .x, .okb, .ph', preventOnFilter: false,
        onChoose: () => { dragging.current = true; vib(25); before = [...g.querySelectorAll('.it[data-id]')]; },
        onUnchoose: () => setTimeout(() => { dragging.current = false; }, 0),
        onEnd: async () => {
          const ids = [...g.querySelectorAll('.it[data-id]')].map((el) => el.dataset.id);
          before.forEach((el) => g.appendChild(el)); // React vuelve a ordenar con el estado nuevo
          dragging.current = false;
          patchLocal('tareas', (a) => a.map((q) => (ids.includes(q.id) ? { ...q, orden: ids.indexOf(q.id) } : q)));
          const res = await Promise.all(ids.map((id, i) => supabase.from('equipo_tareas').update({ orden: i }).eq('id', id)));
          const err = res.find((r) => r.error); if (err) fail(err.error);
        },
      });
    });
    return () => list.forEach((x) => x.destroy());
  });

  async function tog(x) {
    if (role === 'owner' && !(x.tipo === 'mensaje')) return; // los dueños no tildan tareas (solo Mary)
    const patch = x.tipo === 'rutina'
      ? { hecha_fecha: x.hecha_fecha === t ? null : t, hecha_por_nombre: myName }
      : { hecha: !x.hecha, hecha_en: new Date().toISOString(), hecha_por_nombre: myName };
    patchLocal('tareas', (a) => a.map((q) => (q.id === x.id ? { ...q, ...patch } : q)));
    const { error } = await supabase.from('equipo_tareas').update(patch).eq('id', x.id);
    if (error) fail(error);
  }
  async function del(x) {
    if (!(await confirmar('¿Borrar esto?', 'Sí, borrar'))) return;
    const { error } = await supabase.from('equipo_tareas').delete().eq('id', x.id);
    if (error) return fail(error);
    if (x.foto && !tareas.some((q) => q.id !== x.id && q.foto === x.foto)) supabase.storage.from('equipo_fotos').remove([x.foto]);
    refresh();
  }
  async function startDay() {
    const now = new Date().toISOString();
    patchLocal('dia', (d) => ({ ...(d || {}), empezo_en: now })); vib(30);
    const { error } = await supabase.from('equipo_dias').upsert({ propiedad: PROP, fecha: t, empezo_en: now });
    if (error) fail(error);
  }
  async function closeDay() {
    const { error } = await supabase.from('equipo_dias').upsert({ propiedad: PROP, fecha: t, cerrado: true, cerrado_en: new Date().toISOString(), cerrado_por_nombre: myName, pendientes: pendNames.length });
    if (error) return fail(error);
    setFin(null); setSup(null); setShowDay(false); burst(); refresh();
  }

  // ── Reservas de Mary (paso 9) ───────────────────────────────────────────────
  // Guarda como los dueños (prepRes); la base anota quién la cargó y avisa a los dueños.
  async function guardarReserva(input) {
    const lista = Array.isArray(input) ? input : [input];
    const momento = new Date().toLocaleString('es-MX', { timeZone: 'America/Merida', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const filas = lista.map((r) => {
      const p = prepRes({ ...r, source: r.source || 'Directo-Puerta' });
      return { ...p.datosLimpios, fecha_carga: momento, usuario_carga: myName, modificado_por: myName };
    });
    const { error } = await supabase.from('reservas').insert(filas);
    if (error) { notifyError(error, lista.length > 1 ? 'guardar el grupo' : 'guardar la reserva', { keep: true }); return false; }
    notify(lista.length > 1 ? SAVED.grupo(lista) : SAVED.reserva(lista[0]));
    refresh();
    return true;
  }
  function abrirReserva(queue) {
    const [first, ...rest] = queue;
    const ini = { ...first.initial, source: 'Directo-Puerta' };
    if (!ini.status) ini.status = ini.checkIn === t ? 'hospedado' : 'por_llegar';
    setForm({ initial: ini, rooms: first.rooms, queue: rest, chain: queue.length > 1 ? { i: 1, total: queue.length } : null, key: Date.now() });
  }

  // Panel de la reserva: check-in, check-out ("Ya salieron") y cobro, por funciones de la base
  const resById = (id) => (data.allRes || []).find((x) => String(x.id) === String(id));
  const saldoDe = (r) => (r.sinMontos ? Number(r.saldo) || 0 : Math.max(0, (Number(r.totalAmount) || 0) - (Number(r.paid) || 0)));
  const nombreDe = (lista) => (lista.length > 1 ? lista.length + ' habitaciones' : (lista[0].guestName || 'el huésped') + ' (' + (lista[0].room || '') + ')');
  async function rpcTodas(fn, lista, que) {
    for (const r of lista) {
      const { error } = await supabase.rpc(fn, { p_id: String(r.id) });
      if (error) { notifyError(error, que); refresh(); return false; }
    }
    refresh();
    return true;
  }
  async function hacerCheckIn(x) {
    const lista = Array.isArray(x) ? x : [x];
    setDrawerId(null);
    if (!(await confirmar('¿Ya llegó ' + nombreDe(lista) + '?', 'Sí, hacer check-in'))) return;
    if (await rpcTodas('equipo_checkin', lista, 'hacer el check-in')) { vib(30); notify('Check-in hecho · ' + nombreDe(lista)); }
  }
  async function hacerCheckOut(x) {
    const lista = Array.isArray(x) ? x : [x];
    setDrawerId(null);
    const debe = lista.reduce((a, r) => a + saldoDe(r), 0);
    const txt = debe > 0 ? 'Todavía debe ' + money(debe) + '. ¿Hacer el check-out igual?' : '¿Ya salió ' + nombreDe(lista) + '?';
    if (!(await confirmar(txt, 'Sí, hacer check-out'))) return;
    if (await rpcTodas('equipo_checkout', lista, 'hacer el check-out')) { vib(30); notify('Check-out hecho · ' + nombreDe(lista)); }
  }
  async function cobrar(r, monto, forma) {
    const { error } = await supabase.rpc('equipo_cobrar', { p_id: String(r.id), p_monto: monto, p_forma: forma });
    if (error) { notifyError(error, 'guardar el cobro'); return false; }
    notify('Cobro guardado · ' + money(monto));
    refresh();
    return true;
  }
  // Cobro de sus propias reservas (el panel completo manda el nuevo total pagado)
  async function cobrarPagos(pagos) {
    for (const p of pagos) {
      const r = resById(p.id);
      const delta = (Number(p.paid) || 0) - (Number(r?.paid) || 0);
      if (!r || delta <= 0) continue;
      if (!(await cobrar(r, delta, p.paymentMethod))) return false;
    }
    return true;
  }
  async function guardarEdicion(p) {
    const r = editRes;
    const { datosLimpios } = prepRes(p);
    let error;
    if (r.propia) ({ error } = await supabase.from('reservas').update({ ...datosLimpios, modificado_por: myName }).eq('id', r.id));
    else {
      const k = ['huesped', 'telefono', 'email', 'nacionalidad', 'tipo_doc', 'num_doc', 'url_ine_frente', 'url_ine_dorso', 'fecha_nacimiento', 'acompanantes'];
      const datos = {};
      k.forEach((c) => { if (datosLimpios[c] !== undefined) datos[c] = datosLimpios[c]; });
      ({ error } = await supabase.rpc('equipo_contacto', { p_id: String(r.id), p_datos: datos }));
    }
    if (error) { notifyError(error, 'guardar los cambios', { keep: true }); return; }
    notify('Cambios guardados · ' + (p.guestName || r.guestName || ''));
    setEditRes(null);
    refresh();
  }

  // ── habitaciones del día ────────────────────────────────────────────────────
  async function markRoom(r, field) {
    const key = field === 'lista' ? 'ready_at' : 'out_at';
    const sale = field === 'salieron' && !r.out_at && canCheck && r.sale_id ? resById(r.sale_id) : null;
    if (sale && sale.status === 'hospedado') {
      // "Ya salieron" también hace el check-out (la base marca que salieron)
      if (saldoDe(sale) > 0 && !(await confirmar('Todavía debe ' + money(saldoDe(sale)) + '. ¿Marcar que salieron igual?', 'Sí, salieron'))) return;
      patchLocal('marcas', (a) => [...a.filter((m) => !(m.fecha === t && m.habitacion === r.room)), { ...(a.find((m) => m.fecha === t && m.habitacion === r.room) || {}), propiedad: PROP, fecha: t, habitacion: r.room, salieron_en: new Date().toISOString(), salieron_por_nombre: myName }]);
      vib(30);
      await rpcTodas('equipo_checkout', [sale], 'hacer el check-out');
      return;
    }
    if (r[key] && !(await confirmar(field === 'lista' ? '¿Desmarcar la habitación ' + r.num + '?' : '¿Desmarcar que salieron de la habitación ' + r.num + '?', 'Sí, desmarcar'))) return;
    const now = new Date().toISOString();
    const on = !r[key];
    const row = { propiedad: PROP, fecha: t, habitacion: r.room };
    if (field === 'lista') Object.assign(row, { lista_en: on ? now : null, lista_por_nombre: on ? myName : null });
    else Object.assign(row, { salieron_en: on ? now : null, salieron_por_nombre: on ? myName : null });
    patchLocal('marcas', (a) => [...a.filter((m) => !(m.fecha === t && m.habitacion === r.room)), { ...(a.find((m) => m.fecha === t && m.habitacion === r.room) || {}), ...row }]);
    if (on) vib(30);
    const { error } = await supabase.from('equipo_habitaciones').upsert(row);
    if (error) fail(error);
  }

  // ── insumos ─────────────────────────────────────────────────────────────────
  async function supDone(s) {
    const { error } = await supabase.from('equipo_insumos').update({ estado: 'repuesto', repuesto_en: new Date().toISOString(), repuesto_por_nombre: myName }).eq('id', s.id);
    if (error) return fail(error); refresh();
  }
  async function supDel(s) {
    if (!(await confirmar('¿Borrar este insumo?', 'Sí, borrar'))) return;
    const { error } = await supabase.from('equipo_insumos').delete().eq('id', s.id);
    if (error) return fail(error); refresh();
  }

  // ── pantalla ────────────────────────────────────────────────────────────────
  const now = nowMerida();
  const h = now.getHours();
  const hi = (h < 12 ? 'Buen día' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + (view === 'mary' ? ', ' + maryName + ' 💛' : ', ' + myName);
  const f = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const fecha = f.charAt(0).toUpperCase() + f.slice(1);

  const obs = tareas.filter((x) => x.tipo === 'mensaje' && (view === 'owner' ? !x.hecha || x.fecha === t : x.fecha === t || (x.de_rol === 'dueno' && !x.hecha)));
  const obsM = obs.filter((x) => x.de_rol !== 'dueno'), obsO = obs.filter((x) => x.de_rol === 'dueno');

  const item = (x, cls = '') => {
    const d = isDone(x), m = x.tipo === 'mensaje' && x.de_rol === 'dueno', n = x.tipo === 'mensaje' && !m;
    const tag = x.zona ? <div className="zt">{x.zona.split(' · ').map((z) => <span key={z} className="ztag">{z}</span>)}</div> : null;
    const hr = x.hecha_en ? ' · ' + hhmm(x.hecha_en) : '';
    let ack = null;
    if (m) ack = own
      ? <div className={'ack ' + (d ? 'ok' : '')}>{d ? <><I n="tick" /> Mary lo vio{hr}</> : 'Esperando que Mary lo vea'}</div>
      : d ? <div className="ack ok"><I n="tick" /> Lo viste</div>
      : role === 'mary' ? <button className="btn okb" onClick={() => tog(x)}><I n="thumb" /> Entendido</button> : <div className="ack">Esperando que Mary lo vea</div>;
    if (n) ack = own
      ? (d ? <div className="ack ok"><I n="tick" /> Atendido{hr}</div> : <button className="btn okb" onClick={() => tog(x)}><I n="tick" /> Listo</button>)
      : d ? <div className="ack ok"><I n="tick" /> Lo vieron</div> : null;
    const noCk = x.tipo === 'mensaje' || x.tipo === 'programada' || (x.tipo === 'hoy' && x.fecha > t);
    const ck = noCk ? null : role === 'owner'
      ? <span className="ck">{d ? <I n="tick" /> : null}</span>
      : <button className="ck" onClick={() => tog(x)} aria-label="Hecho">{d ? <I n="tick" /> : null}</button>;
    const canEdit = (own && !n) || (role === 'mary' && n);
    return (
      <div key={x.id} data-id={x.id} className={'it ' + cls + ' ' + (d ? (x.tipo === 'mensaje' ? 'seen' : 'd') : '')}>
        {ck}
        <div className="tx">
          {tag}<b>{x.texto}</b>
          {x.tipo === 'programada' ? <span className="chip pchip">{progLabel(x)}</span> : null}
          {x.foto && fotos[x.foto] ? <img className="ph" src={fotos[x.foto]} alt="Foto" onClick={() => setZoom(fotos[x.foto])} /> : null}
          {ack}
        </div>
        {canEdit ? <button className="x" aria-label="Editar" onClick={() => setSheet({ edit: x })}><I n="pencil" /></button> : null}
        {canEdit ? <button className="x" aria-label="Borrar" onClick={() => del(x)}><I n="trash" /></button> : null}
      </div>
    );
  };
  const sec = (key, title, a, c) => (a.length ? <div key={key} className={'grp ' + c} data-grp={c}><h2>{title}</h2>{a.map((x) => item(x, c))}</div> : null);
  const obsSec = (key, title, a) => (a.length ? <div key={key}><h2 className="hl">{title}</h2>{a.map((x) => item(x, 'obs'))}</div> : null);

  // Movimientos de Mary con reservas (paso 9, solo dueños): los que faltan ver quedan hasta tocar "Visto";
  // los vistos de hoy quedan abajo en gris y al día siguiente se limpian (como Limpieza)
  const MOV_I = { nueva: 'cal', edicion: 'pencil', cancelacion: 'alert', checkin: 'rin', checkout: 'rout', cobro: 'check' };
  const movSec = () => {
    if (!own || !movs.length) return null;
    const pend = movs.filter((m) => !m.visto), vis = movs.filter((m) => m.visto);
    const mi = (m) => {
      const tx = movTexto(m);
      return (
        <div key={m.id} className={'it eq-mov ' + (m.visto ? 'seen' : 'obs')} onClick={() => onOpenMov && onOpenMov(m)}>
          <span className="ico"><I n={MOV_I[m.tipo] || 'pencil'} c={m.visto ? 'm' : m.tipo === 'cancelacion' ? 'r' : 'a'} /></span>
          <div className="tx">
            <b>{tx.title}</b>
            <div className="eq-movb">{tx.body}</div>
            <div className="eq-movt">{cuando(m.creado_en)}</div>
            {m.visto
              ? <div className="ack ok"><I n="tick" /> {visoTexto(m)}</div>
              : <button className="btn okb" onClick={(e) => { e.stopPropagation(); onVisto && onVisto([m.id]); }}><I n="tick" /> Visto</button>}
          </div>
        </div>
      );
    };
    return (
      <div key="movs">
        <h2 className="hl"><I n="eye" />Movimientos de Mary{pend.length ? ` (${pend.length})` : ''}</h2>
        {pend.map(mi)}
        {pend.length > 1 ? <button className="fdlink eq-movall" onClick={() => onVisto && onVisto(pend.map((m) => m.id))}>Marcar todos como vistos</button> : null}
        {vis.length ? <><div className="zl">Vistos hoy</div>{vis.map(mi)}</> : null}
      </div>
    );
  };

  // Tu momento
  const care = () => {
    const day = Math.floor(Date.now() / 864e5), pick = (a) => a[day % a.length];
    const mins = h * 60 + now.getMinutes();
    let start = 8;
    if (started) { const s = new Date(new Date(started).toLocaleString('en-US', { timeZone: 'America/Merida' })); start = s.getHours() + s.getMinutes() / 60; }
    else { const k = 'eq-turno-' + t; let v = ls.get(k); if (!v && role === 'mary') { v = mins < 570 ? '8' : '10'; ls.set(k, v); } if (v) start = +v; }
    const el = mins / 60 - start;
    const rit = careLine({ total, pct, all }, el, start, pick);
    const ag = +(ls.get('eq-agua-' + t) || 0), goal = 6, expected = Math.floor(Math.max(0, el));
    const tip = pickTip(t, tareas);
    return (
      <div className="card care" key="care">
        <div className="ch2">Tu momento</div>
        <div className="crit">{rit}</div>
        <div className="cag">
          <div className="agh"><span className="agt"><I n="drop" /> Tu agua de hoy</span><span className="agn">{ag}/{goal}</span></div>
          <div className="muted agd">{waterText(ag, goal)}</div>
          <div className="vasos">
            {Array.from({ length: goal }, (_, i) => (
              <button key={i} className={'vaso ' + (i < ag ? 'on' : '') + ' ' + (ag === 0 && i === 0 ? 'next' : '')} aria-label={'Vaso ' + (i + 1)}
                onClick={() => { ls.set('eq-agua-' + t, String(ag === i + 1 ? i : i + 1)); setTick((x) => x + 1); }}><I n="drop" /></button>
            ))}
          </div>
        </div>
        {ag < goal && el >= 2 && ag < expected - 1 ? <div className="cw">{pick(WATER_NUDGE)}</div> : null}
        {tip ? <div className="ctip"><I n="sparkles" c="a" /> {tip}</div> : null}
      </div>
    );
  };

  // Habitaciones de hoy + Libres hoy
  const roomsSec = () => {
    const list = roomsOfDay(reservas, marcas, t).sort((p, q) => (!!p.ready_at - !!q.ready_at) || (rOrd(p) - rOrd(q)) || rKey(p).localeCompare(rKey(q)) || p.room.localeCompare(q.room));
    const occ = new Set(list.filter((r) => r.status !== 'salida').map((r) => r.room));
    const free = ROOMS.filter((r) => !occ.has(r.id)).map((r) => {
      const x = list.find((q) => q.room === r.id);
      return { n: r.id.replace(/^P/, ''), ok: !x || !!x.ready_at, rate: priceToday(r.id, t, tarifas) };
    });
    const freeSec = (
      <div className="rfree">
        <div className="rfh"><I n="key" />Libres hoy</div>
        {free.length ? <>
          {!own ? <div className="muted rfs">Revisa que estén todas ok, por cualquier detalle :)</div> : null}
          {free.map((fr) => (
            <div className={'rfr' + (canQuote ? ' eq-tap' : '')} key={fr.n} onClick={canQuote ? () => setQuoter({ initialIn: t }) : undefined}>
              <div className="rft"><b>Hab {fr.n}</b><span className={'rfst ' + (fr.ok ? 'ok' : '')}>{fr.ok ? 'lista' : 'falta limpiar'}</span><span className={'rfp ' + (fr.rate ? '' : 'rfq')}>{fr.rate ? money(fr.rate.price) : 'consultar precio'}</span></div>
              {fr.rate ? <div className="muted rfd">Tarifa para {fr.rate.guests} personas{fr.rate.extra ? ' · ' + money(fr.rate.extra) + ' por persona adicional' : ''}</div> : null}
            </div>
          ))}
          {!own ? <><div className="muted rfm">{canQuote ? 'Precio por noche de hoy. Para varias noches, más personas o promos, toca Cotizar :)' : 'Precio por noche de hoy. Para promos o varias noches, consulta antes :)'}</div>{canQuote ? <button className="pill rfwa" onClick={() => setQuoter({ initialIn: t })}><I n="calc" c="a" /> Cotizar</button> : null}</> : null}
        </> : <div className="muted">Hoy no queda ninguna libre.</div>}
      </div>
    );
    const head = <div className="rmh"><h2><I n="bed" />Habitaciones de hoy</h2></div>;
    if (data.sinReservas) return <div className="rgrp" key="rooms">{head}<div className="muted rme">No se pudieron leer las reservas. Avisa a Gian o Marce :){data.errReservas ? <div style={{ marginTop: 6, fontSize: 12 }}>Detalle: {data.errReservas}</div> : null}</div></div>;
    if (!list.length) return <div className="rgrp" key="rooms">{head}<div className="muted rme">Hoy no hay salidas, entradas ni huéspedes.</div>{freeSec}</div>;
    const tot = list.length, ready = list.filter((r) => r.ready_at).length;
    const pend = list.filter((r) => !r.ready_at), pendSE = pend.filter((r) => r.status === 'sale_entra').length;
    const sub = [];
    if (tot > 1) sub.push(ready === tot ? '¡Todas listas!' : `${ready} de ${tot} listas`);
    if (!own && pendSE && pend.length > pendSE) sub.push(pendSE === 1 ? 'Empieza por la que tiene entrada :)' : 'Empieza por las que tienen entrada :)');
    const ln = (icn, cls, lab, name, hr, hc = '', id = null) => {
      const go = canOpen && id && resById(id) ? () => setDrawerId(id) : null;
      return (
        <div className={'rln ' + cls + (go ? ' eq-tap' : '')} onClick={go || undefined}><I n={icn} /><span className="rlb">{lab}</span><span className="rnm">{name || ''}{go ? <I n="chev" /> : null}</span><span className={'rtm ' + hc}>{hr}</span></div>
      );
    };
    const row = (r) => {
      const s = RST[r.status], est = r.status === 'estancia', ok = !!r.ready_at, lin = linOn(r, r.date), dN = est ? stayDay(r, r.date) : 0;
      const islate = r.departure && r.departure.slice(0, 5) !== '11:00';
      const dep = islate ? ampm(r.departure) : '11 am';
      const arr = r.arrival ? ampm(r.arrival) : '2 pm';
      const doneTxt = ok ? (est ? (lin ? 'Cambio hecho' : 'Repaso hecho') : 'Lista') + ' · ' + hhmm(r.ready_at) : '';
      const hasOut = r.status === 'salida' || r.status === 'sale_entra', out = !!r.out_at;
      const outTxt = out ? 'Salieron · ' + hhmm(r.out_at) : '';
      let act;
      if (role === 'mary') {
        if (ok) act = <button className="rbtn ok" onClick={() => markRoom(r, 'lista')}><I n="tick" /> {doneTxt}</button>;
        else if (hasOut && !out) act = <button className="rbtn" onClick={() => markRoom(r, 'salieron')}><I n="circ" /> Marcar que salieron</button>;
        else act = <>
          {out ? <><button className="rbtn ok" onClick={() => markRoom(r, 'salieron')}><I n="tick" /> {outTxt}</button><div className="rwash"><I n="drop" /> Saca sábanas y toallas y ponlas a lavar :)</div></> : null}
          <button className="rbtn" onClick={() => markRoom(r, 'lista')}><I n="circ" /> {est ? (lin ? 'Marcar cambio hecho' : 'Marcar repaso hecho') : 'Marcar como lista'}</button>
        </>;
      } else {
        if (ok) act = <div className="ack ok"><I n="tick" /> {out ? outTxt + ' · ' : ''}{doneTxt}</div>;
        else if (hasOut && !out) act = <><div className="ack">Todavía no salen</div><button className="rbtn g" onClick={() => markRoom(r, 'salieron')}><I n="rout" /> Marcar que salieron</button></>;
        else if (out) act = <><button className="rbtn ok" onClick={() => markRoom(r, 'salieron')}><I n="tick" /> {outTxt}</button><div className="ack">Falta dejarla lista</div></>;
        else act = <div className="ack">{est ? (lin ? 'Cambio pendiente' : 'Repaso pendiente') : 'Todavía no está lista'}</div>;
      }
      return (
        <div key={r.room} className={'it ' + (ok ? 'rok' : '') + ' rs-' + r.status + ' ' + (lin ? 'rlin' : '')}>
          <div className="rnum"><small>Hab</small>{r.num}</div>
          <div className="tx">
            <span className="rchip">{lin ? 'Cambio de sábanas y toallas' : s.l}</span>{own && dN ? <span className="rday">Día {dN}</span> : null}
            <div className="rls">
              {r.status === 'salida' || r.status === 'sale_entra' ? ln('rout', 'out', 'Sale', r.guest, dep, islate ? 'late' : '', r.sale_id) : null}
              {r.status === 'entrada' || r.status === 'sale_entra' ? ln('rin', 'in', 'Entra', r.guest_in, arr, '', r.entra_id) : null}
              {est ? ln('rstay', 'stay', 'Se queda', r.guest, lin ? 'Limpieza profunda' : 'Repaso', lin ? 'deep' : '', r.queda_id) : null}
            </div>
            {act}
          </div>
        </div>
      );
    };
    return <div className="rgrp" key="rooms">{head}{sub.length ? <div className="muted rme">{sub.join(' · ')}</div> : null}{list.map(row)}{freeSec}</div>;
  };

  // Insumos (pendientes agrupados por sector y los repuestos de hoy)
  const supSec = () => {
    const sPend = insumos.filter((s) => s.estado === 'falta').sort((a, b) => b.urgente - a.urgente);
    const sDone = insumos.filter((s) => s.estado === 'repuesto' && s.repuesto_en && ymdMerida(s.repuesto_en) === t);
    const supItem = (s) => {
      const d = s.estado === 'repuesto';
      return (
        <div className={'it ' + (d ? 'd' : '')} key={s.id}>
          {own && !d ? <button className="ck" aria-label="Repuesto" onClick={() => supDone(s)} /> : <span className="ico">{d ? <I n="check" c="g" /> : s.urgente ? <I n="alert" c="r" /> : <I n="package" c="m" />}</span>}
          <div className="tx"><b>{s.nombre}</b><span className="chip">{d ? 'repuesto' : s.urgente ? 'se acabó' : 'queda poco'}</span></div>
          {own && !d ? <button className="x" aria-label="Borrar" onClick={() => supDel(s)}><I n="trash" /></button> : null}
        </div>
      );
    };
    const supAll = sPend.concat(sDone);
    if (!supAll.length) return null;
    const groups = SECTORES.map((g) => ({ ...g, list: supAll.filter((s) => (s.sector || sectorOf(s.nombre)) === g.id) })).filter((g) => g.list.length);
    return (
      <div key="sup">
        <h2><I n="package" />Insumos{own && sPend.length ? ' por reponer' : ''}</h2>
        {groups.map((g) => <div key={g.id}>{groups.length > 1 ? <div className="zl eq-supl">{g.label}</div> : null}{g.list.map(supItem)}</div>)}
      </div>
    );
  };

  let body;
  if (!loaded) body = <div className="card muted">{loadErr ? 'No se pudo cargar: revisa la conexión.' : 'Cargando…'}</div>;
  else if (view === 'mary' && closed && !showDay) {
    const notes = tareas.filter((x) => x.tipo === 'mensaje' && x.de_rol !== 'dueno' && x.fecha === t).length;
    body = (
      <div className="endscreen">
        <div className="fdic big2"><I n="moon" /></div>
        <div className="eth">¡Gracias, {maryName}!</div>
        <div className="ets">Tu día quedó cerrado.</div>
        <div className="card esum">
          {total ? <div><I n="check" c="g" /> Hiciste {done} de {total} tareas</div> : null}
          {notes ? <div><I n="pencil" c="a" /> Anotaste {notes} cosa{notes > 1 ? 's' : ''}</div> : null}
          {pendNames.length ? <div><I n="history" c="r" /> {pendNames.length} pendiente{pendNames.length > 1 ? 's pasan' : ' pasa'} para mañana</div> : <div><I n="sparkles" c="a" /> No quedó nada pendiente</div>}
        </div>
        <div className="etb">Hasta mañana 💛</div>
        <button className="fdlink" onClick={() => setShowDay(true)}>Ver mi día</button>
      </div>
    );
  } else {
    const [mi, mc, mt] = !total ? ['smile', 'a', 'Hoy no hay tareas cargadas'] : all ? ['check', 'g', '¡Todo listo!'] : pct === 0 ? ['sun', 'a', '¡Arrancamos el día!'] : pct < 50 ? ['zap', 'a', '¡Buen ritmo!'] : ['sparkles', 'a', '¡Ya casi!'];
    const td = new Date(now); td.setDate(td.getDate() + 1); const tm = mananaStr(), tdw = td.getDay();
    const onTm = (x) => (x.tipo === 'hoy' ? x.fecha > t : x.tipo === 'programada' && (x.dias_semana && x.dias_semana.length ? x.dias_semana.includes(tdw) && x.fecha <= tm : x.fecha === tm));
    body = <>
      {view === 'owner' ? <div className="stl">{started ? <><I n="sun" c="a" /> Mary empezó su día a las {hhmm(started)}</> : <><I n="sun" c="m" /> Mary todavía no empezó su día</>}</div> : null}
      {view === 'mary' && !closed && !started ? (
        <div className="card startc">
          <div className="fdic"><I n="sun" /></div>
          <div className="stt">¡Buen día, {maryName}!</div>
          <div className="muted">Cuando llegues, toca aquí para empezar tu jornada.</div>
          <button className="btn fdbig" onClick={startDay} disabled={role !== 'mary'}><I n="sun" /> Empezar mi día</button>
        </div>
      ) : null}
      {view === 'mary' && started ? care() : null}
      <div className="card">
        <div className="big"><I n={mi} c={mc} />{mt}</div>
        {total ? <><div className="bar"><i style={{ width: pct + '%' }} /></div><div className="muted">{done} de {total} hechas</div></> : null}
        {view === 'mary' && total && !done ? <div className="hint"><I n="check" /> Toca el círculo en cuanto termines cada tarea :)</div> : null}
        {view === 'mary' ? (closed ? <div className="closed"><I n="check" c="g" /> Día cerrado · Gracias por todo 💛</div> : all ? <button className="btn fin2" onClick={() => role === 'mary' && setFin(pendNames.length ? 'warn' : 'first')}><I n="moon" /> Cerrar el día</button> : null) : null}
      </div>
      {movSec()}
      {view === 'owner'
        ? <>{obsSec('am', <><I n="pencil" />Avisos de Mary</>, obsM)}{obsSec('mm', <><I n="megaphone" />Mensajes para Mary</>, obsO)}</>
        : <>{obsSec('mt', <><I n="megaphone" />Mensajes para ti</>, obsO)}{obsSec('la', <><I n="pencil" />Lo que anotaste hoy</>, obsM)}</>}
      {roomsSec()}
      {sec('late', <><I n="history" />{late.length === 1 ? '¡Acuérdate de este pendiente de ayer!' : '¡Acuérdate de estos pendientes de ayer!'}</>, late, 'late')}
      {sec('hoy', <><I n="sun" />Tareas de hoy</>, hoy, 'hoy')}
      {sec('fija', <><I n="repeat" />Rutina diaria</>, fij, 'fija')}
      {view === 'owner' ? sec('man', <><I n="moon" />Para mañana</>, srt(tareas.filter(onTm)), 'man') : null}
      {view === 'owner' ? sec('prog', <><I n="cal" />Programadas</>, srt(tareas.filter((x) => x.tipo === 'programada' && ((x.dias_semana && x.dias_semana.length) || x.fecha >= t))), 'prog') : null}
      {view === 'owner' && !closed ? <div className="muted" style={{ margin: '8px 4px' }}>Cierre del día: pendiente</div> : null}
      {supSec()}
      {view === 'owner' && closed ? (pendNames.length
        ? <div className="card endo"><I n="alert" c="r" /> Mary cerró el día con {pendNames.length} pendiente{pendNames.length > 1 ? 's' : ''}. Pasan para mañana.</div>
        : <div className="muted" style={{ margin: '8px 4px' }}><I n="check" c="g" /> Mary cerró el día con todo listo.</div>) : null}
      {view === 'mary' && !closed && !all ? (
        <div className="card endc">
          <div className="endt"><I n="moon" c="a" /> ¿Terminaste por hoy?</div>
          <div className="muted">Aunque haya quedado algo, cierra el día y cuéntanos qué faltó.</div>
          <button className="btn g fin2" onClick={() => role === 'mary' && setFin(pendNames.length ? 'warn' : 'first')}>Finalizar día</button>
        </div>
      ) : null}
    </>;
  }

  return (
    <div ref={rootRef} className={'eq ' + (own ? 'own ' : '') + (dial ? 'dial-open ' : '') + (standalone ? 'eq-solo' : 'eq-tab')}>
      <div className="top">
        <div><h1>{hi}</h1><div className="sub">{fecha}</div></div>
        <div className="row">
          {canQuote ? <button className="pill" onClick={() => setQuoter({})}><I n="calc" c="a" /> Cotizar</button> : null}
          {canBook ? <button className="pill" onClick={() => setForm({ initial: null, key: Date.now() })}><I n="cal" c="a" /> Reservar</button> : null}
          {!isDueno && !pushOn ? <button className="pill" onClick={activarAvisos}><I n="bell" c="a" /> Activar avisos</button> : null}
          {isDueno ? <button className="pill" onClick={() => setView(view === 'owner' ? 'mary' : 'owner')}>{view === 'owner' ? 'Ver como Mary' : 'Volver a dueños'}</button> : null}
          {onLogout ? <button className="pill" onClick={onLogout}>Salir</button> : null}
        </div>
      </div>
      {body}

      {/* Botón + y sus burbujas */}
      <div className="dback" onClick={() => setDial(false)} />
      <div className="dopts">
        <button className="dopt wa om" onClick={() => { setDial(false); location.href = 'whatsapp://send?phone=' + WA.Mary; }}><span>Mary</span><i><img src="/whatsapp.png" alt="" /></i></button>
        <button className="dopt wa mo" onClick={() => { setDial(false); location.href = 'whatsapp://send?phone=' + WA.Marce; }}><span>Marce</span><i><img src="/whatsapp.png" alt="" /></i></button>
        <button className="dopt wa mo" onClick={() => { setDial(false); location.href = 'whatsapp://send?phone=' + WA.Gian; }}><span>Gian</span><i><img src="/whatsapp.png" alt="" /></i></button>
        <button className="dopt mo" onClick={() => { setDial(false); setSup({}); }}><span>Insumos</span><i>🧴</i></button>
        <button className="dopt" onClick={() => { setDial(false); setSheet({}); }}><span>Notas</span><i>📝</i></button>
      </div>
      {loaded && !drawerId && !editRes && !form && !quoter ? <button className="fab" aria-label="Agregar" onClick={() => setDial(!dial)}>＋</button> : null}

      {sheet ? <NoteSheet key={sheet.edit?.id || 'new'} edit={sheet.edit} owner={view === 'owner'} role={role} myName={myName} tareas={tareas} fotos={fotos}
        onClose={(saved) => { const wasFin = fin; setSheet(null); refresh(); if (wasFin === 'note') setFin(saved && !sheet.edit ? 'again' : finStep.current); }} /> : null}
      {sup ? <SupSheet insumos={insumos} myName={myName} fin={sup.fin}
        onClose={(ok) => { const f = sup.fin; setSup(null); refresh(); if (f) { if (ok) closeDay(); else setFin('sup'); } }} /> : null}
      {fin && fin !== 'note' ? <FinSheet mode={fin} pendNames={pendNames}
        onYes={() => { if (fin === 'warn') setFin('first'); else if (fin === 'sup') { setFin(null); setSup({ fin: true }); } else { finStep.current = fin; setFin('note'); setSheet({}); } }}
        onNo={() => { if (fin === 'warn') setFin(null); else if (fin === 'sup') closeDay(); else setFin('sup'); }}
        onClose={() => setFin(null)} /> : null}
      {(canQuote || canOpen) && typeof document !== 'undefined' ? createPortal(<div style={{ fontFamily: 'var(--font)', color: 'var(--ink)', WebkitFontSmoothing: 'antialiased' }}>
        <AnimatePresence>{quoter && (
          <Modal key="quoter" title="Cotizar" icon="calculator" onClose={() => setQuoter(null)} isMobile={isMobile} tall>
            <Quoter allRes={data.allRes || []} tarifas={tarifas} initialIn={quoter.initialIn || ''} onClose={() => setQuoter(null)}
              onReserve={({ queue }) => { setQuoter(null); if (canBook) abrirReserva(queue); }} />
          </Modal>
        )}</AnimatePresence>
        <AnimatePresence>{form && (
          <Modal key="new" title={form.chain ? `Nueva reserva · ${form.chain.i} de ${form.chain.total} (cambio de habitación)` : 'Nueva reserva'} onClose={() => setForm(null)} isMobile={isMobile} tall>
            <ResForm key={form.key} visibleProps={PROPS} prefillProp="hostel" prefillDate={form.initial?.checkIn || t}
              initial={form.initial} initialRooms={form.rooms || null} allRes={data.allRes || []} guestDecisions={[]} tarifas={tarifas}
              fixedSource="Directo-Puerta" canPrice={puede(user, 'precio')}
              onClose={() => setForm(null)}
              onSave={async (p) => {
                const ok = await guardarReserva(p);
                if (!ok) return;
                const q = form.queue || [];
                if (!q.length) { setForm(null); return; }
                // Cambio de habitación: abre la siguiente con los mismos datos del huésped
                const g = Array.isArray(p) ? p[0] : p;
                const carry = {};
                [...PERSON_FIELDS, 'source', 'requiresInvoice', 'company', 'status'].forEach((k) => { if (g && g[k] !== undefined) carry[k] = g[k]; });
                const [next, ...rest] = q;
                const ch = form.chain || { i: 1, total: q.length + 1 };
                setForm({ initial: { ...next.initial, ...carry }, rooms: next.rooms, queue: rest, chain: { i: ch.i + 1, total: ch.total }, key: Date.now() });
              }} />
          </Modal>
        )}</AnimatePresence>
        <AnimatePresence>{drawerId && resById(drawerId) && (
          <ResDrawer key="drawer" res={resById(drawerId)} onClose={() => setDrawerId(null)}
            onEdit={(r) => { setDrawerId(null); setEditRes(r); }}
            onDelete={() => {}} onToggleBlacklist={() => {}}
            onOpenRes={(r) => setDrawerId(r.id)}
            onCheckIn={canCheck ? hacerCheckIn : undefined} onCheckOut={canCheck ? hacerCheckOut : undefined}
            onPay={canCheck ? cobrarPagos : undefined}
            properties={PROPS} allRes={data.allRes || []} guestDecisions={[]} isMobile={isMobile} tarifas={tarifas}
            equipo={{ onCobrar: canCheck ? cobrar : null }} />
        )}</AnimatePresence>
        <AnimatePresence>{editRes && (
          <Modal key="edit" title={editRes.propia ? 'Editar reserva' : 'Datos del huésped'} onClose={() => setEditRes(null)} isMobile={isMobile} tall>
            <ResForm initial={editRes} visibleProps={PROPS} allRes={data.allRes || []} guestDecisions={[]} tarifas={tarifas}
              soloDatos={!editRes.propia} canPrice={puede(user, 'precio')} fixedSource={editRes.propia ? 'Directo-Puerta' : ''}
              onClose={() => setEditRes(null)} onSave={guardarEdicion} />
          </Modal>
        )}</AnimatePresence>
      </div>, document.body) : null}
      {standalone ? <Toast isMobile={isMobile} /> : null}
      {zoom ? <div className="zoom on" onClick={() => setZoom('')}><img src={zoom} alt="" /></div> : null}
      {ask ? (
        <div className="sheet on" onClick={(e) => { if (e.target === e.currentTarget) { ask.resolve(false); setAsk(null); } }}>
          <div className="fdbox">
            <div className="fdt" style={{ fontSize: 22 }}>{ask.text}</div>
            <button className="btn fdbig" style={{ marginTop: 22 }} onClick={() => { ask.resolve(true); setAsk(null); }}>{ask.yes}</button>
            <button className="btn g fdbig" onClick={() => { ask.resolve(false); setAsk(null); }}>Cancelar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Nueva nota / editar (tareas de dueños o "Anotar lo que vi" de Mary) ────────
function NoteSheet({ edit, owner, role, myName, tareas, fotos, onClose }) {
  const x = edit || null;
  const mNote = !!(x && x.tipo === 'mensaje' && x.de_rol !== 'dueno');
  const pick = owner && !mNote;
  const kinds = pick
    ? [['hoy', 'sun', 'Tarea de hoy'], ['rutina', 'repeat', 'Rutina diaria'], ['mensaje', 'megaphone', 'Mensaje para Mary'], ['programada', 'cal', 'Programada']]
    : [['mensaje', 'eye', 'Anotar lo que vi']];
  const t = hoyStr();
  const [kind, setKind] = useState(x ? x.tipo : kinds[0][0]);
  const [text, setText] = useState(x ? x.texto : '');
  const [zSel, setZSel] = useState(x && x.zona ? x.zona.split(' · ') : []);
  const [zOpen, setZOpen] = useState(false);
  const [tom, setTom] = useState(!!(x && x.tipo === 'hoy' && x.fecha > t));
  const [pmode, setPmode] = useState(x && x.tipo === 'programada' && !(x.dias_semana && x.dias_semana.length) ? 'dia' : 'rep');
  const [pdays, setPdays] = useState(x && x.dias_semana ? [...x.dias_semana] : []);
  const [pdate, setPdate] = useState(x && x.tipo === 'programada' && pmode === 'dia' ? x.fecha : mananaStr());
  const [photo, setPhoto] = useState(null);
  const [keep, setKeep] = useState(x ? x.foto || null : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const zText = () => ALLZ.filter((z) => zSel.includes(z)).join(' · ');
  const togZ = (n) => {
    let s = zSel.includes(n) ? zSel.filter((q) => q !== n) : [...zSel, n];
    if (n === ALLH && s.includes(ALLH)) s = s.filter((q) => !q.startsWith('Hab '));
    if (n.startsWith('Hab ')) s = s.filter((q) => q !== ALLH);
    setZSel(s);
  };
  const title = x ? (pick ? 'Editar' : owner ? 'Editar aviso de Mary' : 'Corregir mi nota') : owner ? 'Nueva nota' : '¿Hay algo que reportar?';
  async function save() {
    if (!text.trim()) return setErr('Escribe qué hay que hacer o qué viste.');
    if (kind === 'programada') {
      if (pmode === 'rep' && !pdays.length) return setErr('Elige al menos un día de la semana.');
      if (pmode === 'dia' && (!pdate || pdate < t)) return setErr('Elige una fecha de hoy en adelante.');
    }
    setBusy(true); setErr('');
    try {
      let foto = x ? keep : null;
      if (photo) {
        const { data: u } = await supabase.auth.getUser();
        foto = `${u?.user?.id || 'equipo'}/${Date.now()}.jpg`;
        const up = await supabase.storage.from('equipo_fotos').upload(foto, photo, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
      }
      let fecha = kind === 'hoy' && tom ? mananaStr() : x && x.tipo === kind && x.fecha <= t ? x.fecha : t;
      if (kind === 'programada') fecha = pmode === 'dia' ? pdate : x && x.tipo === 'programada' && x.dias_semana && x.dias_semana.length ? x.fecha : t;
      const row = { propiedad: PROP, texto: text.trim(), zona: zText(), tipo: kind, fecha, foto, dias_semana: kind === 'programada' && pmode === 'rep' ? pdays.slice().sort() : null };
      if (x) {
        Object.assign(row, { editada_en: new Date().toISOString(), editada_por_nombre: myName });
        if (x.tipo !== kind) Object.assign(row, { hecha: false, hecha_fecha: null, hecha_en: null });
        else if (kind === 'mensaje' && x.de_rol === 'dueno' && owner) Object.assign(row, { hecha: false, hecha_en: null });
        if (!pick) { delete row.tipo; delete row.fecha; delete row.dias_semana; delete row.propiedad; }
        const { error } = await supabase.from('equipo_tareas').update(row).eq('id', x.id);
        if (error) throw error;
        if (x.foto && x.foto !== foto && !tareas.some((q) => q.id !== x.id && q.foto === x.foto)) supabase.storage.from('equipo_fotos').remove([x.foto]);
      } else {
        row.creada_por_nombre = myName;
        const { error } = await supabase.from('equipo_tareas').insert(row);
        if (error) throw error;
      }
      if (kind === 'programada') await supabase.rpc('equipo_programadas_hoy');
      onClose(true);
    } catch (e) { notifyError(e, 'guardar'); setBusy(false); }
  }
  return (
    <div className="sheet on" onClick={(e) => e.target === e.currentTarget && onClose(false)}>
      <div>
        <div className="big" style={{ marginBottom: 8 }}>{title}</div>
        {pick ? <div className="seg row">{kinds.map(([k, ic, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}><I n={ic} /> {l}</button>)}</div> : null}
        {owner && pick ? <div className="muted" id="khelp">{HELP[kind]}</div> : null}
        <input type="text" placeholder={pick ? '¿Qué hay que hacer?' : 'Cuéntame qué viste…'} maxLength={200} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <button type="button" className={'where ' + (zSel.length ? 'on' : '')} onClick={() => setZOpen(!zOpen)}><I n="pin" /><span>{zSel.length ? zText() : '¿Dónde? (opcional)'}</span></button>
        {zOpen ? (
          <div className="zones">
            <div className="zl">Habitaciones</div>
            <div className="zrow">{ZONE_ROOMS.map((n) => <button key={n} type="button" className={'zc zn ' + (zSel.includes('Hab ' + n) ? 'on' : '')} onClick={() => togZ('Hab ' + n)}>{n}</button>)}<button type="button" className={'zc ' + (zSel.includes(ALLH) ? 'on' : '')} onClick={() => togZ(ALLH)}>Todas</button></div>
            <div className="zl">Áreas comunes</div>
            <div className="zrow">{COMMON.map((n) => <button key={n} type="button" className={'zc ' + (zSel.includes(n) ? 'on' : '')} onClick={() => togZ(n)}>{n}</button>)}</div>
            <div className="zl">Áreas privadas</div>
            <div className="zrow">{PRIV.map((n) => <button key={n} type="button" className={'zc ' + (zSel.includes(n) ? 'on' : '')} onClick={() => togZ(n)}>{n}</button>)}</div>
          </div>
        ) : null}
        {kind === 'hoy' && pick ? <label className="muted" style={{ display: 'block' }}><input type="checkbox" checked={tom} onChange={(e) => setTom(e.target.checked)} /> Es para mañana</label> : null}
        {kind === 'programada' && pick ? (
          <div>
            <div className="seg row"><button type="button" className={pmode === 'rep' ? 'on' : ''} onClick={() => setPmode('rep')}>Repetir</button><button type="button" className={pmode === 'dia' ? 'on' : ''} onClick={() => setPmode('dia')}>Un día</button></div>
            {pmode === 'dia' ? <input type="date" min={t} value={pdate} onChange={(e) => setPdate(e.target.value)} /> : (
              <div className="zrow" style={{ margin: '6px 0 4px', justifyContent: 'space-between' }}>
                {DOWS.map(([v, l]) => <button key={v} type="button" className={'zc zn ' + (pdays.includes(v) ? 'on' : '')} onClick={() => setPdays(pdays.includes(v) ? pdays.filter((q) => q !== v) : [...pdays, v])}>{l}</button>)}
              </div>
            )}
          </div>
        ) : null}
        <div className="row" style={{ marginTop: 10 }}>
          <label className="btn g"><I n="camera" /> Foto<input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files[0]; if (f) { setPhoto(await shrink(f)); } e.target.value = ''; }} /></label>
          <span className="muted" style={{ alignSelf: 'center' }}>
            {photo ? <><I n="check" c="g" /> Foto lista <button type="button" className="fpx" onClick={() => setPhoto(null)}>Quitar</button></>
              : keep ? <>{fotos[keep] ? <img className="fpt" src={fotos[keep]} alt="" /> : null}<button type="button" className="fpx" onClick={() => setKeep(null)}>Quitar foto</button></> : null}
          </span>
        </div>
        {err ? <div className="muted" style={{ color: 'var(--red)', marginTop: 8 }}>{err}</div> : null}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn g" onClick={() => onClose(false)}>Cancelar</button>
          <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={save}>{x ? 'Guardar cambios' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Insumos: lista rápida agrupada por sector ─────────────────────────────────
function SupSheet({ insumos, myName, fin, onClose }) {
  const pend = new Set(insumos.filter((s) => s.estado === 'falta').map((s) => s.nombre.toLowerCase()));
  const [sel, setSel] = useState([]);
  const [other, setOther] = useState('');
  const [urg, setUrg] = useState(false);
  const [busy, setBusy] = useState(false);
  async function send() {
    const names = [...sel, ...(other.trim() ? [other.trim()] : [])].filter((n) => !pend.has(n.toLowerCase()));
    if (!names.length) return onClose(false);
    setBusy(true);
    const { error } = await supabase.from('equipo_insumos').insert(names.map((nombre) => ({ propiedad: PROP, nombre, sector: sectorOf(nombre), urgente: urg, estado: 'falta', creado_por_nombre: myName })));
    setBusy(false);
    if (error) return notifyError(error, 'guardar');
    onClose(true);
  }
  return (
    <div className="sheet on" onClick={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className="rmbox">
        <div className="big" style={{ marginBottom: 4 }}>¿Qué insumo falta?</div>
        <div className="muted">Toca los que hagan falta.</div>
        {SECTORES.map((g) => (
          <div key={g.id}>
            <div className="zl">{g.label}</div>
            <div className="chips" style={{ marginTop: 0 }}>
              {g.items.map((it) => {
                const done = pend.has(it.name.toLowerCase()), on = sel.includes(it.name);
                return <button key={it.name} className={'sc ' + (on ? 'on' : '')} disabled={done} title={done ? 'Ya avisado' : ''} onClick={() => setSel(on ? sel.filter((q) => q !== it.name) : [...sel, it.name])}>{it.label}{done ? <> <I n="tick" /></> : null}</button>;
              })}
            </div>
          </div>
        ))}
        <input type="text" placeholder="Otro (escríbelo)" maxLength={60} value={other} onChange={(e) => setOther(e.target.value)} />
        <label className="muted"><input type="checkbox" checked={urg} onChange={(e) => setUrg(e.target.checked)} /> <I n="alert" c="r" /> Ya se acabó (si no, queda poco)</label>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn g" onClick={() => onClose(false)}>Cancelar</button>
          <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={send}>{fin ? 'Avisar y cerrar el día' : 'Avisar'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Cerrar el día (2 pasos) ───────────────────────────────────────────────────
function FinSheet({ mode, pendNames, onYes, onNo, onClose }) {
  const n = pendNames.length;
  let step = '', title, msg, no, yes, noCls = 'btn g fdbig', yesCls = 'btn g fdbig';
  if (mode === 'warn') {
    title = n === 1 ? 'Te queda 1 tarea sin marcar' : `Te quedan ${n} tareas sin marcar`;
    msg = <><div className="fdl">{pendNames.slice(0, 4).map((x, i) => <div key={i}>• {x}</div>)}{n > 4 ? '…' : null}</div>¿Ya las hiciste? Regresa y márcalas como listas. Si no se pudieron, los pendientes de hoy pasarán para mañana.</>;
    no = <><I n="tick" /> Regresar a mi lista</>; yes = 'Lo dejamos para mañana'; noCls = 'btn fdbig';
  } else if (mode === 'sup') {
    step = 'Paso 2 de 2'; title = '¿Algún insumo se acabó o queda poco?'; msg = 'Así lo reponemos antes de que haga falta.';
    no = <><I n="moon" /> No, cerrar el día</>; yes = <><I n="package" /> Sí, avisar</>;
  } else {
    const again = mode === 'again';
    step = 'Paso 1 de 2';
    title = again ? '¿Algo más?' : '¿Quedó algo pendiente o viste algo?';
    msg = again ? 'Si te acordaste de otra cosa, anótala.' : 'Algo roto, algo que no se pudo terminar o algo que tengamos que saber.';
    no = <><I n="tick" />{again ? ' No, seguir' : ' No, nada'}</>; yes = <><I n="pencil" />{again ? ' Sí, anotar otra cosa' : ' Sí, anotar algo'}</>;
  }
  return (
    <div className="sheet on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fdbox">
        <div className="fdic"><I n="moon" /></div>
        {step ? <div className="fdstep">{step}</div> : null}
        <div className="fdt">{title}</div>
        <div className="fdm">{msg}</div>
        <button className={noCls} onClick={onNo}>{no}</button>
        <button className={yesCls} onClick={onYes}>{yes}</button>
      </div>
    </div>
  );
}
