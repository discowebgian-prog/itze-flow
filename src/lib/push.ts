/* eslint-disable */
// @ts-nocheck
import { supabase } from './supabase';

// ── AVISOS CON LA APP CERRADA (notificaciones del celular) ────────────────────
// Igual que en Itzé Limpieza: service worker (public/sw.js) + suscripción del navegador
// guardada en la tabla push_subs (supabase/push.sql). Quien hace un cambio le pide a
// /api/push que avise a los demás aparatos (no a los que tienen su mismo nombre).
// Clave pública VAPID: la da /api/push (se arma sola en el servidor; nadie la genera a mano)
let publicKey = '';
async function getPublicKey() {
  if (publicKey) return publicKey;
  const r = await fetch('/api/push');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.publicKey) throw new Error(j?.error || 'No se pudo preparar los avisos.');
  publicKey = j.publicKey;
  return publicKey;
}

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const pushGranted = () => pushSupported() && Notification.permission === 'granted';
export const pushBlocked = () => pushSupported() && Notification.permission === 'denied';

const b64u = (s) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4);
  const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...r].map((c) => c.charCodeAt(0)));
};

export function registerSW() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

async function subscription() {
  const reg = await navigator.serviceWorker.ready;
  const key = b64u(await getPublicKey());
  const old = await reg.pushManager.getSubscription();
  if (old) {
    // Si las claves del servidor cambiaron, se vuelve a anotar sola (sin que nadie haga nada)
    const was = old.options?.applicationServerKey ? new Uint8Array(old.options.applicationServerKey) : null;
    const same = was && was.length === key.length && was.every((b, i) => b === key[i]);
    if (same || !was) return old;
    await old.unsubscribe().catch(() => {});
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

async function saveSub(sub, quien) {
  const j = sub.toJSON();
  // push_anotar (equipo_avisos.sql): deja el aparato a nombre de quien entró, dueños o equipo
  const rpc = await supabase.rpc('push_anotar', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_quien: quien || '' });
  if (!rpc.error) return;
  if (rpc.error.code !== 'PGRST202') throw rpc.error; // si la función todavía no existe, como antes
  const { error } = await supabase.from('push_subs').upsert(
    [{ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, quien: quien || '', actualizado_en: new Date().toISOString() }],
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
}

// Botón "Activar avisos": pide permiso y guarda la suscripción. Devuelve 'ok' | 'denied' | 'unsupported'
export async function enablePush(quien) {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  await saveSub(await subscription(), quien);
  return 'ok';
}

// Al abrir la app (y al cambiar quién usa el aparato): renueva la suscripción con el nombre actual
export async function syncPush(quien) {
  try {
    if (!pushGranted()) return;
    await saveSub(await subscription(), quien);
  } catch (e) {
    console.warn('No se pudo renovar el aviso:', e);
  }
}

// Avisar a los otros aparatos. No frena nada si falla (los avisos son un extra).
export async function sendPush(body, from) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !body) return;
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ title: 'Itzé Flow', body, from }),
    });
  } catch (e) {
    console.warn('No se pudo mandar el aviso:', e);
  }
}
