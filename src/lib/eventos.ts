/* eslint-disable */
// @ts-nocheck
// ── RADAR DE EVENTOS (Inicio › "Se viene") ────────────────────────────────────
// Los eventos los busca /api/eventos cada lunes (ver supabase/eventos.sql). Acá: cargarlos,
// cuándo mostrar cada uno (anticipación según el tipo y el impacto), cuánto hay reservado
// esas noches y las acciones (Ya lo vimos, No nos interesa, Buscar ahora).
import { supabase } from './supabase';
import { ROOMS } from './constants';
import { TODAY, fmt, addDays, parseD, diffDays } from './dates';

// Días antes del evento en que conviene empezar a prepararse.
// Las fechas grandes se reservan con mucha anticipación; un evento deportivo o un congreso, sobre la marcha.
const LEAD = {
  temporada: { alto: 120, medio: 75, bajo: 45 },
  feriado: { alto: 90, medio: 60, bajo: 30 },
  festival: { alto: 75, medio: 45, bajo: 21 },
  cultural: { alto: 60, medio: 40, bajo: 21 },
  religioso: { alto: 60, medio: 40, bajo: 21 },
  deportivo: { alto: 45, medio: 30, bajo: 14 },
  concierto: { alto: 45, medio: 30, bajo: 14 },
  congreso: { alto: 45, medio: 30, bajo: 14 },
  crucero: { alto: 10, medio: 10, bajo: 7 },
  otro: { alto: 45, medio: 30, bajo: 14 },
};
export const leadDays = (e) => (LEAD[e.tipo] || LEAD.otro)[e.impacto] || 30;

export const finOf = (e) => e.fecha_hasta || e.fecha_desde;
export const diasPara = (e) => diffDays(fmt(TODAY), e.fecha_desde);

// ¿Ya es momento de prepararse? (desde `leadDays` antes hasta que termina)
export const enVentana = (e) => {
  const hoy = fmt(TODAY);
  return finOf(e) >= hoy && hoy >= fmt(addDays(parseD(e.fecha_desde), -leadDays(e)));
};

// Ocupación ya reservada de las noches del evento (de la noche anterior hasta la del último día)
export function reservadoPct(reservations, e) {
  const desde = fmt(addDays(parseD(e.fecha_desde), -1));
  const hasta = finOf(e);
  const n = diffDays(desde, hasta) + 1;
  if (n <= 0) return 0;
  let occ = 0;
  reservations.forEach((r) => {
    if (!r || r.status === 'cancelada' || !r.checkIn) return;
    const k = diffDays(r.checkIn, r.checkOut);
    for (let i = 0; i < k; i++) {
      const d = fmt(addDays(parseD(r.checkIn), i));
      if (d >= desde && d <= hasta) occ++;
    }
  });
  return Math.min(100, Math.round((occ / (ROOMS.length * n)) * 100));
}

// Período sugerido para Tarifas: desde la noche anterior al evento hasta la noche de su último día
export const periodoSugerido = (e) => ({
  nombre: e.nombre,
  desde: fmt(addDays(parseD(e.fecha_desde), -1)),
  hasta: finOf(e),
});

// Prioridad: falta poco (un tercio de la anticipación o menos) y se reservó menos de la mitad
export const urgente = (e, pct) => diasPara(e) >= 0 && diasPara(e) <= Math.ceil(leadDays(e) / 3) && pct < 50;

// ── Base ──
// Devuelve { ok, eventos, ultima } — ok false si falta correr el SQL (la tarjeta no se muestra)
export async function cargarEventos() {
  const hoy = fmt(TODAY);
  const r = await supabase.from('eventos').select('*').gte('fecha_hasta', hoy).order('fecha_desde');
  // fecha_hasta puede venir vacía: se piden aparte los de un solo día
  const r2 = await supabase.from('eventos').select('*').is('fecha_hasta', null).gte('fecha_desde', hoy).order('fecha_desde');
  if (r.error || r2.error) return { ok: false, eventos: [], ultima: null };
  const eventos = [...(r.data || []), ...(r2.data || [])].sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde));
  const b = await supabase.from('eventos_busquedas').select('hecho_en, nuevos, error').order('hecho_en', { ascending: false }).limit(1);
  return { ok: true, eventos, ultima: (b.data && b.data[0]) || null };
}

export async function marcarEvento(id, estado) {
  const { error } = await supabase.from('eventos').update({ estado, actualizado_en: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// "Buscar ahora": la búsqueda puede tardar 1 a 3 minutos
export async function buscarAhora() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw Object.assign(new Error('Tu sesión venció.'), { status: 401 });
  let resp;
  try {
    resp = await fetch('/api/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: '{}',
    });
  } catch {
    throw new Error('Error de red al buscar eventos.');
  }
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw Object.assign(new Error(data?.error || `Error del servidor (${resp.status}).`), { status: resp.status });
  return data; // { encontrados, nuevos }
}

// Para el Asesor IA: eventos de un rango de fechas
export async function eventosEntre(desde, hasta) {
  const { data, error } = await supabase
    .from('eventos')
    .select('nombre, tipo, fecha_desde, fecha_hasta, impacto, estado')
    .lte('fecha_desde', hasta)
    .gte('fecha_desde', desde)
    .neq('estado', 'descartado')
    .order('fecha_desde');
  return error ? [] : data || [];
}

// "sáb 6 dic" / "6 al 9 feb"
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export function fechasTexto(e) {
  const a = parseD(e.fecha_desde);
  if (!e.fecha_hasta || e.fecha_hasta === e.fecha_desde) return `${DIA[a.getDay()]} ${a.getDate()} ${MES[a.getMonth()]}`;
  const b = parseD(e.fecha_hasta);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} al ${b.getDate()} ${MES[b.getMonth()]}`
    : `${a.getDate()} ${MES[a.getMonth()]} al ${b.getDate()} ${MES[b.getMonth()]}`;
}
export function cuandoTexto(e) {
  const d = diasPara(e);
  if (d < 0) return 'ya empezó';
  if (d === 0) return 'es hoy';
  if (d === 1) return 'mañana';
  if (d < 14) return `en ${d} días`;
  if (d < 60) return `en ${Math.round(d / 7)} semanas`;
  return `en ${Math.round(d / 30)} meses`;
}
