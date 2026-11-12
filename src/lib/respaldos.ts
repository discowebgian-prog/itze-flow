/* eslint-disable */
// @ts-nocheck
// ── RESPALDOS (Finanzas › Respaldos) ──────────────────────────────────────────
// La planilla la arma /api/respaldo todas las noches (ver supabase/respaldos.sql) y queda en la tabla
// flow_respaldos. Acá: listarlos, bajarlos, "Hacer respaldo ahora" y la copia en una carpeta de la compu
// (Chrome / Edge en la compu: se elige la carpeta una vez y Flow guarda ahí el respaldo nuevo cada vez que se abre).
import { supabase } from './supabase';
import { notify } from './voice';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const TZ = 'America/Merida';

// "hoy 3:00" / "ayer 3:00" / "lun 9 nov · 3:00"
export function cuandoTexto(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = (x) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(x);
  const hora = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: false }).format(d);
  const hoy = dia(new Date());
  const ayer = dia(new Date(Date.now() - 86400000));
  const k = dia(d);
  if (k === hoy) return `hoy ${hora}`;
  if (k === ayer) return `ayer ${hora}`;
  const [y, m, dd] = k.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
  return `${DIAS[wd]} ${dd} ${MESES[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''} · ${hora}`;
}

export const pesoTexto = (b) => (!b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export async function listarRespaldos() {
  const { data, error } = await supabase
    .from('flow_respaldos')
    .select('id, creado_en, nombre, origen, hecho_por, tamano, resumen')
    .order('creado_en', { ascending: false })
    .limit(45);
  if (error) {
    const faltaSql = error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '');
    return { lista: [], faltaSql, error: faltaSql ? null : error };
  }
  return { lista: data || [], faltaSql: false, error: null };
}

async function bajarBytes(id) {
  const { data, error } = await supabase.from('flow_respaldos').select('nombre, archivo_b64').eq('id', id).single();
  if (error) throw error;
  const bin = atob(data.archivo_b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { nombre: data.nombre, bytes };
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function descargarRespaldo(id) {
  const { nombre, bytes } = await bajarBytes(id);
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_TYPE }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function hacerRespaldoAhora(hechoPor) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw Object.assign(new Error('Tu sesión venció. Volvé a entrar.'), { status: 401 });
  let resp;
  try {
    resp = await fetch('/api/respaldo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ hechoPor }),
    });
  } catch {
    throw new Error('Sin conexión: no pude hacer el respaldo.');
  }
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw Object.assign(new Error(data?.error || `Error del servidor (${resp.status}).`), { status: resp.status });
  return data;
}

// ── Carpeta de la compu (File System Access API) ──────────────────────────────
export const carpetaSoportada = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window && window.isSecureContext;

const DB = 'itze-flow';
const STORE = 'kv';
const KEY = 'carpeta-respaldos';
const ULTIMO = 'flow-respaldo-local'; // id del último respaldo guardado en la carpeta

function idb(modo, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, modo);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}

export async function carpetaGuardada() {
  if (!carpetaSoportada()) return null;
  try { return (await idb('readonly', (s) => s.get(KEY))) || null; } catch { return null; }
}

export async function elegirCarpeta() {
  const h = await window.showDirectoryPicker({ id: 'flow-respaldos', mode: 'readwrite', startIn: 'documents' });
  await idb('readwrite', (s) => s.put(h, KEY));
  try { localStorage.removeItem(ULTIMO); } catch {}
  return h;
}

export async function olvidarCarpeta() {
  await idb('readwrite', (s) => s.delete(KEY));
  try { localStorage.removeItem(ULTIMO); } catch {}
}

export async function permisoCarpeta(h, pedir = false) {
  if (!h) return 'denied';
  const opts = { mode: 'readwrite' };
  let p = await h.queryPermission?.(opts);
  if (p !== 'granted' && pedir) p = await h.requestPermission?.(opts);
  return p || 'denied';
}

export const ultimoLocal = () => { try { return localStorage.getItem(ULTIMO) || ''; } catch { return ''; } };

// Escribe el respaldo en la carpeta (pisa el del mismo día si ya estaba)
export async function guardarEnCarpeta(h, r) {
  const { nombre, bytes } = await bajarBytes(r.id);
  const f = await h.getFileHandle(nombre, { create: true });
  const w = await f.createWritable();
  await w.write(new Blob([bytes], { type: XLSX_TYPE }));
  await w.close();
  try { localStorage.setItem(ULTIMO, r.id); } catch {}
  return nombre;
}

// Al abrir Flow (dueños): si hay carpeta elegida y un respaldo nuevo, lo guarda solo.
// Si el navegador pide permiso otra vez (pasa al reabrir Chrome), lo pide con el primer toque en la pantalla.
let corriendo = false;
export async function autoGuardarLocal() {
  if (corriendo || !carpetaSoportada()) return;
  corriendo = true;
  try {
    const h = await carpetaGuardada();
    if (!h) return;
    const { lista } = await listarRespaldos();
    const ult = lista[0];
    if (!ult || ult.id === ultimoLocal()) return;
    const seguir = async (pedir) => {
      const p = await permisoCarpeta(h, pedir);
      if (p !== 'granted') return false;
      const nombre = await guardarEnCarpeta(h, ult);
      notify(`Guardé el respaldo en tu carpeta "${h.name}" (${nombre}).`, 'info');
      return true;
    };
    if (await seguir(false)) return;
    const alTocar = () => {
      window.removeEventListener('pointerdown', alTocar, true);
      seguir(true).catch(() => {});
    };
    window.addEventListener('pointerdown', alTocar, true);
  } catch (e) {
    console.warn('[respaldo local]', e);
  } finally {
    corriendo = false;
  }
}
