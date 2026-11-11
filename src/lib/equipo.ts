/* eslint-disable */
// @ts-nocheck
// Sección Equipo (ex Itzé Limpieza): datos, fechas y reglas. La pantalla está en src/pages/equipo/.
// Base: supabase/equipo.sql (tablas equipo_*) y supabase/equipo_reservas.sql (habitaciones del día sin montos).
import { supabase } from './supabase';
import { nowMerida } from './voice';
import { fmt, addDays } from './dates';
import { ROOMS } from './constants';
import { roomTypeOf, nightPrice, BASE_GUESTS } from './rates';

export const PROP = 'hostel'; // por ahora una sola propiedad (las tablas ya guardan cuál)

// ── Fechas (hora de Progreso) ─────────────────────────────────────────────────
export const hoyStr = () => fmt(nowMerida());
export const mananaStr = () => fmt(addDays(nowMerida(), 1));
export const prevOf = (d) => { const [y, m, dd] = d.split('-').map(Number); return fmt(new Date(y, m - 1, dd - 1)); };
export const dnum = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
export const hhmm = (s) => new Date(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Merida' });
export const ampm = (v) => { const [h, m] = v.split(':').map(Number); return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? ' am' : ' pm'); };
export const money = (n) => '$' + Number(n).toLocaleString('es-MX');

// Horas de siempre (decisión de Gian, 10 nov 2026): sale 11 am, entra 2 pm
export const SALIDA = '11:00';
export const LLEGADA = '14:00';

// ── Zonas del "¿Dónde?" (tal cual Limpieza; la Hab 7 todavía inactiva para la venta) ──
export const ZONE_ROOMS = [1, 2, 3, 4, 5, 6, 7];
export const COMMON = ['Terraza entrada', 'Patio alberca', 'Baño alberca', 'Ingreso', 'Comedor', 'Cocina', 'Escalera', 'Corredor planta alta', 'Tendedero', 'Terraza/balcón'];
export const PRIV = ['Lavadero', 'Bodega'];
export const ALLH = 'Todas las habitaciones';
export const ALLZ = [...ZONE_ROOMS.map((n) => 'Hab ' + n), ALLH, ...COMMON, ...PRIV];

// ── Insumos de la lista rápida, por sector (aprobado por Gian el 10 nov 2026) ──
// label = lo que dice el botón; name = lo que se guarda y se avisa
export const SECTORES = [
  { id: 'banos', label: 'Baños', items: ['Papel higiénico', 'Jabón líquido de manos', 'Jabón para ducha', 'Harpic', 'Sarricida'] },
  { id: 'cocina', label: 'Cocina y café', items: ['Café', 'Azúcar', 'Stevia', 'Detergente para cocina', 'Esponjas'] },
  { id: 'pisos', label: 'Pisos y superficies', items: ['Cloro', 'Fabuloso', 'Limpiavidrios', 'Trapito microfibra', 'Trapo de piso', 'Palo trapeador'] },
  { id: 'bolsas', label: 'Bolsas de basura', items: [['Cocina', 'Bolsas de basura · Cocina'], ['Baños (chicas)', 'Bolsas de basura · Baños (chicas)'], ['Habitaciones (medianas)', 'Bolsas de basura · Habitaciones (medianas)']] },
  { id: 'otros', label: 'Lavandería y otros', items: ['Jabón para lavar ropa', 'Raid'] },
].map((s) => ({ ...s, items: s.items.map((i) => (Array.isArray(i) ? { label: i[0], name: i[1] } : { label: i, name: i })) }));
export const sectorOf = (name) => (SECTORES.find((s) => s.items.some((i) => i.name.toLowerCase() === String(name).toLowerCase())) || { id: 'otros' }).id;

// ── Programadas ───────────────────────────────────────────────────────────────
export const DOWS = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
const DNAME = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DSHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export function progLabel(x) {
  if (x.dias_semana && x.dias_semana.length) {
    const d = DOWS.map((q) => q[0]).filter((v) => x.dias_semana.includes(v));
    return d.length === 1 ? 'Cada ' + DNAME[d[0]] : d.map((v) => DSHORT[v]).join(' · ');
  }
  const [y, m, dd] = x.fecha.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Habitaciones del día, desde las reservas ──────────────────────────────────
// status: salida | entrada | sale_entra | estancia (como en Limpieza)
export const RST = {
  sale_entra: { l: 'Salida + entrada', o: 0 },
  salida: { l: 'Salida', o: 1 },
  entrada: { l: 'Entrada', o: 2 },
  estancia: { l: 'Estancia', o: 3 },
};
export const roomNum = (id) => String(id).replace(/^P/i, '');

export function roomsOfDay(reservas, marks, d) {
  const out = [];
  ROOMS.forEach(({ id }) => {
    const rs = reservas.filter((r) => r.habitacion === id);
    const sale = rs.find((r) => r.fecha_salida === d);
    const entra = rs.find((r) => r.fecha_ingreso === d);
    const queda = rs.find((r) => r.fecha_ingreso < d && r.fecha_salida > d);
    let status = null;
    if (sale && entra) status = 'sale_entra';
    else if (sale) status = 'salida';
    else if (entra) status = 'entrada';
    else if (queda) status = 'estancia';
    if (!status) return;
    const m = marks.find((x) => x.fecha === d && x.habitacion === id) || {};
    const stay = queda || (status === 'salida' ? sale : null);
    const late = sale && sale.late_checkout_hora ? String(sale.late_checkout_hora).slice(0, 5) : '';
    out.push({
      date: d, room: id, num: roomNum(id), status,
      guest: status === 'estancia' ? queda.huesped : sale ? sale.huesped : '',
      guest_in: entra ? entra.huesped : '',
      departure: late || SALIDA,
      arrival: LLEGADA,
      checkin: stay ? stay.fecha_ingreso : entra ? entra.fecha_ingreso : '',
      checkout: status === 'estancia' ? queda.fecha_salida : entra ? entra.fecha_salida : '',
      linens: m.sabanas ?? null,
      out_at: m.salieron_en || null, out_by: m.salieron_por_nombre || '',
      ready_at: m.lista_en || null, ready_by: m.lista_por_nombre || '',
    });
  });
  return out;
}

// Cambio de sábanas y toallas: cada 5 días de estancia, salvo que se vaya en menos de 2
export const stayDay = (x, d) => (x.checkin ? dnum(x.checkin, d) + 1 : 0);
export function linAuto(x, d) {
  if (x.status !== 'estancia') return false;
  const n = stayDay(x, d);
  if (n < 5 || n % 5) return false;
  return !(x.checkout && dnum(d, x.checkout) < 2);
}
export const linOn = (x, d) => x.status === 'estancia' && (x.linens ?? linAuto(x, d));
export const rOrd = (r) => (linOn(r, r.date) ? 2.5 : RST[r.status].o);
export const rKey = (r) => (r.status === 'salida' ? r.departure || SALIDA : r.arrival || LLEGADA);

// Precio de hoy de una habitación libre, del tarifario de Flow (promo, fecha especial o Normal)
export function priceToday(roomId, d, tarifas) {
  const t = roomTypeOf(roomId);
  if (!t || !tarifas.length) return null;
  const p = nightPrice(d, t.id, tarifas);
  if (!p.price) return null;
  return { price: p.price, guests: BASE_GUESTS, extra: t.extra ? p.extra : 0 };
}

// ── Carga ─────────────────────────────────────────────────────────────────────
let spawned = '';
export async function loadEquipo() {
  const hoy = hoyStr();
  if (spawned !== hoy) { spawned = hoy; await supabase.rpc('equipo_programadas_hoy'); }
  const [t, d, s, m, r, ta] = await Promise.all([
    supabase.from('equipo_tareas').select('*').eq('propiedad', PROP).order('creada_en', { ascending: false }).limit(300),
    supabase.from('equipo_dias').select('*').eq('propiedad', PROP).eq('fecha', hoy).maybeSingle(),
    supabase.from('equipo_insumos').select('*').eq('propiedad', PROP).order('creado_en', { ascending: false }).limit(100),
    supabase.from('equipo_habitaciones').select('*').eq('propiedad', PROP).in('fecha', [prevOf(hoy), hoy, mananaStr()]),
    supabase.rpc('equipo_reservas', { p_desde: prevOf(hoy), p_hasta: mananaStr() }),
    supabase.from('tarifas').select('*'),
  ]);
  if (t.error) throw t.error;
  const tareas = t.data || [];
  // Fotos: enlace temporal (el bucket es privado)
  const paths = [...new Set(tareas.map((x) => x.foto).filter(Boolean))];
  let fotos = {};
  if (paths.length) {
    const { data } = await supabase.storage.from('equipo_fotos').createSignedUrls(paths, 3600);
    (data || []).forEach((f) => { if (f.signedUrl) fotos[f.path] = f.signedUrl; });
  }
  return {
    tareas, fotos,
    dia: d.data || null,
    insumos: s.error ? [] : s.data || [],
    marcas: m.error ? [] : m.data || [],
    reservas: (r.error ? [] : r.data || []).filter((x) => (x.propiedad || PROP) === PROP),
    tarifas: ta.error ? [] : ta.data || [],
    sinReservas: !!r.error,
  };
}

// Achica la foto antes de subirla (como Limpieza: 1200 px, calidad 0,7)
export function shrink(file, max = 1200, q = 0.7) {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => {
      const k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas');
      c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
      c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); c.toBlob(res, 'image/jpeg', q);
    };
    i.src = URL.createObjectURL(file);
  });
}

// Números de WhatsApp del botón + (los mismos de Limpieza)
export const WA = { Mary: '529991612998', Marce: '529981023652', Gian: '529982434504' };
