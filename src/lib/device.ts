/* eslint-disable */
// @ts-nocheck
// ── QUIÉN USA ESTE DISPOSITIVO ────────────────────────────────────────────────
// Gian y Marce comparten usuario. Cada aparato recuerda quién lo usa (solo en ese
// aparato), para saludar por nombre y anotar quién cargó o cambió algo.
const KEY = 'itze-flow-quien';
export const PEOPLE = ['Gian', 'Marce'];

export function getDeviceName() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setDeviceName(name) {
  try {
    if (name) localStorage.setItem(KEY, name);
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: se pregunta de nuevo la próxima vez */
  }
}
