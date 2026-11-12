/* eslint-disable */
// @ts-nocheck
// ── QUÉ VIO CADA PERSONA (tabla flow_vistos, ver supabase/mejoras_nov.sql) ─────
// Gian y Marce comparten usuario: se distinguen por el nombre del aparato (`deviceName`).
// Si Gian abre "Se viene", a Marce le sigue apareciendo el circulito hasta que lo abra ella.
// Claves: 'evento:<id>' y 'estrategia:<lunes AAAA-MM-DD>'.
import { supabase } from './supabase';

export const quienDe = (deviceName) => deviceName || 'Dueños';

// Set de claves vistas por `quien`; null si la tabla todavía no existe (sin circulitos)
export async function cargarVistos(quien) {
  const { data, error } = await supabase.from('flow_vistos').select('clave').eq('quien', quien);
  if (error) return null;
  return new Set((data || []).map((r) => r.clave));
}

export async function marcarVistos(quien, claves) {
  if (!claves || !claves.length) return;
  const rows = claves.map((clave) => ({ quien, clave }));
  await supabase.from('flow_vistos').upsert(rows, { onConflict: 'quien,clave', ignoreDuplicates: true });
}
