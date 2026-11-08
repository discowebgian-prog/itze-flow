/* eslint-disable */
// @ts-nocheck
import { supabase } from './supabase';
import { notify } from './voice';

// ── FOTOS DE DOCUMENTOS (bucket privado "documentos") ────────────────────────
// En la base se guarda el enlace de la foto. Con el bucket privado ese enlace
// ya no abre solo: hay que pedir a Supabase un enlace temporal (firmado), que
// solo se consigue con sesión iniciada y vence a los pocos minutos.
const BUCKET = 'documentos';
const SIGNED_SECONDS = 600; // 10 minutos

// De "https://xxx.supabase.co/storage/v1/object/public/documentos/ine_frente_1.jpg"
// saca "ine_frente_1.jpg". Si ya es solo el nombre del archivo, lo deja igual.
export function docPath(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  const marker = `/${BUCKET}/`;
  const i = s.indexOf(marker);
  if (i >= 0) return decodeURIComponent(s.slice(i + marker.length).split('?')[0]);
  return /^https?:/i.test(s) ? '' : s;
}

// Abre la foto en otra pestaña con un enlace temporal.
// La pestaña se abre antes de esperar a Supabase para que el celular no la bloquee.
export async function openDoc(url) {
  const w = window.open('', '_blank');
  const path = docPath(url);
  let target = '';
  if (path) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_SECONDS);
    if (!error && data?.signedUrl) target = data.signedUrl;
    else console.error('No se pudo firmar el enlace del documento:', error);
  }
  // Mientras el bucket siga público, el enlace viejo todavía funciona
  if (!target && /^https?:/i.test(String(url || ''))) target = url;
  if (!target) {
    if (w) w.close();
    notify('No se pudo abrir la foto del documento. Probá de nuevo en un momento.', 'error');
    return;
  }
  if (w) w.location.href = target;
  else if (!window.open(target, '_blank'))
    notify('El navegador no dejó abrir la foto. Permití las ventanas emergentes para Itzé Flow y probá de nuevo.', 'error');
}
