/* eslint-disable */
// @ts-nocheck
// Movimientos de Mary (paso 9, parte 4): lo que el equipo hace con reservas, para que los dueños lo marquen "Visto".
// Base: tabla equipo_movimientos (supabase/equipo_reservas_mary.sql; solo dueños, tiempo real). La llena la base sola.
// Se muestran: los que faltan ver (aunque sean de días anteriores) y los vistos de hoy (se renueva día a día, como Limpieza).
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { PROP, hoyStr, prevOf } from './equipo';
import { notifyError } from './voice';

const PAGO = { efectivo: 'efectivo', transferencia: 'transferencia', debito: 'débito', credito: 'crédito', vcc: 'tarjeta virtual', otro: 'otro medio' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const diaCorto = (d) => { const [, m, dd] = String(d).slice(0, 10).split('-').map(Number); return `${dd} ${MESES[m - 1]}`; };
const plata = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const ymd = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Merida' });
// "3:20 pm"
const hora = (iso) => { const [h, m] = new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Merida' }).split(':').map(Number); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); };

// Ícono y colores de cada tipo (los mismos nombres de <Icon>)
export const MOV_TIPO = {
  nueva: { icon: 'plus', col: 'var(--c-2563EB)', bg: 'var(--c-EFF6FF)' },
  edicion: { icon: 'edit', col: 'var(--c-7C3AED)', bg: 'var(--c-F5F3FF)' },
  cancelacion: { icon: 'close', col: 'var(--c-DC2626)', bg: 'var(--c-FEF2F2)' },
  checkin: { icon: 'checkIn', col: 'var(--c-059669)', bg: 'var(--c-ECFDF5)' },
  checkout: { icon: 'checkOut', col: 'var(--c-EA580C)', bg: 'var(--c-FFF7ED)' },
  cobro: { icon: 'money', col: 'var(--c-059669)', bg: 'var(--c-ECFDF5)' },
};

// Lo mismo que dice el aviso al celular (api/push.js, equipoMensaje), más el check-out
export function movTexto(m) {
  const por = m.por_nombre || 'Mary';
  const quien = (m.huesped || 'Sin nombre') + (m.habitacion ? ` (${m.habitacion})` : '');
  const forma = PAGO[String(m.forma_pago || '').toLowerCase()] || String(m.forma_pago || 'efectivo').toLowerCase();
  const fechas = m.fecha_ingreso && m.fecha_salida ? ` · ${diaCorto(m.fecha_ingreso)} → ${diaCorto(m.fecha_salida)}` : '';
  switch (m.tipo) {
    case 'nueva':
      return { title: `${por} cargó una reserva`, body: quien + fechas + (Number(m.pagado) > 0 ? ` · pagó ${plata(m.pagado)} en ${forma}` : ' · sin pago todavía') };
    case 'cobro': return { title: `${por} cobró ${plata(m.monto)} en ${forma}`, body: quien };
    case 'checkin': return { title: `${por} hizo el check-in`, body: quien };
    case 'checkout': return { title: `${por} hizo el check-out`, body: quien };
    case 'cancelacion': return { title: `${por} canceló una reserva`, body: quien + fechas };
    default: return { title: `${por} cambió una reserva`, body: quien + fechas };
  }
}

// "hoy 3:20 pm" · "ayer 3:20 pm" · "lun 9 nov · 3:20 pm"
export function cuando(iso) {
  if (!iso) return '';
  const d = ymd(iso), t = hoyStr();
  if (d === t) return 'hoy ' + hora(iso);
  if (d === prevOf(t)) return 'ayer ' + hora(iso);
  const [y, mm, dd] = d.split('-').map(Number);
  return `${DIAS[new Date(y, mm - 1, dd).getDay()]} ${dd} ${MESES[mm - 1]} · ${hora(iso)}`;
}
export const visoTexto = (m) => (m.visto ? `Visto${m.visto_por_nombre ? ' por ' + m.visto_por_nombre : ''}${m.visto_en ? ' · ' + hora(m.visto_en) : ''}` : '');

// Numerito del ícono de la app (dueños) = movimientos sin ver. El service worker suma 1 con cada aviso
// de un movimiento mientras la app está cerrada; al abrirla se pone el número exacto.
const BADGE_CACHE = 'itze-badge';
export async function setIconBadge(n) {
  try {
    if (n > 0) { if (navigator.setAppBadge) await navigator.setAppBadge(n); }
    else if (navigator.clearAppBadge) await navigator.clearAppBadge();
  } catch (_) {}
  try { if (window.caches) await (await caches.open(BADGE_CACHE)).put('/__mov', new Response(String(n || 0))); } catch (_) {}
}

// Trae y escucha los movimientos. activo = solo dueños (el equipo no puede leer la tabla).
export function useMovimientos(activo) {
  const [movs, setMovs] = useState([]);
  const [cargado, setCargado] = useState(false); // el número del ícono se toca recién con datos reales
  const tRef = useRef(null);
  const load = useCallback(async () => {
    if (!activo) return;
    const desde = hoyStr() + 'T00:00:00-06:00'; // inicio de hoy en Progreso
    const { data, error } = await supabase
      .from('equipo_movimientos')
      .select('*')
      .eq('propiedad', PROP)
      .or(`visto.eq.false,visto_en.gte.${desde}`)
      .order('creado_en', { ascending: false })
      .limit(200);
    if (!error) { setMovs(data || []); setCargado(true); }
  }, [activo]);
  const refresh = useCallback(() => { clearTimeout(tRef.current); tRef.current = setTimeout(load, 150); }, [load]);

  useEffect(() => {
    if (!activo) { setMovs([]); setCargado(false); return; }
    load();
    const ch = supabase.channel('equipo-movimientos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipo_movimientos' }, refresh)
      .subscribe();
    const vis = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', vis);
    // Cada 5 minutos: por si se cortó el tiempo real y para que los vistos de ayer se limpien solos
    const iv = setInterval(() => { if (!document.hidden) refresh(); }, 300000);
    return () => { supabase.removeChannel(ch); document.removeEventListener('visibilitychange', vis); clearInterval(iv); clearTimeout(tRef.current); };
  }, [activo, load, refresh]);

  const pendientes = movs.filter((m) => !m.visto);
  useEffect(() => { if (activo && cargado) setIconBadge(pendientes.length); }, [activo, cargado, pendientes.length]);

  // Marcar como visto (uno o varios). Se ve al instante; si falla, vuelve atrás y avisa.
  const marcarVisto = useCallback(async (ids, quien) => {
    if (!ids.length) return;
    const cambio = { visto: true, visto_en: new Date().toISOString(), visto_por_nombre: quien || 'Dueños' };
    setMovs((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, ...cambio } : m)));
    const { error } = await supabase.from('equipo_movimientos').update(cambio).in('id', ids);
    if (error) { notifyError(error, 'marcar como visto'); load(); }
  }, [load]);

  return { movs, pendientes, marcarVisto };
}
