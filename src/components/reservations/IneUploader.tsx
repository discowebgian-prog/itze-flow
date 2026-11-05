/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

// ── RESERVATION FORM ──────────────────────────────────────────────────────────
// ── CARGADOR DE INE COMPRIMIDO (CORREGIDO) ───────────────────────────────────
export function IneUploader({ f, onUploadFrente, onUploadDorso }) {
  const [loadingF, setLoadingF] = useState(false);
  const [loadingD, setLoadingD] = useState(false);

  const processFile = async (e, side) => {
    const file = e.target.files[0];
    if (!file) return;

    side === 'frente' ? setLoadingF(true) : setLoadingD(true);

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error("Error al leer la imagen del celular."));
      });

      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      let scaleSize = 1;
      if (img.width > MAX_WIDTH) {
        scaleSize = MAX_WIDTH / img.width;
      }
      canvas.width = img.width * scaleSize;
      canvas.height = img.height * scaleSize;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        try {
          const fileName = `ine_${side}_${Date.now()}.jpg`;
          
          const { error } = await supabase.storage
            .from('documentos')
            .upload(fileName, blob, { contentType: 'image/jpeg' });

          if (error) {
            console.error("Error de Supabase:", error);
            throw new Error("Supabase rechazó el archivo. ¿Revisaste las Políticas de Storage?");
          }

          const { data: { publicUrl } } = supabase.storage
            .from('documentos')
            .getPublicUrl(fileName);

          side === 'frente' ? onUploadFrente(publicUrl) : onUploadDorso(publicUrl);
        } catch (err) {
          console.error(err);
          alert(err.message);
        } finally {
          side === 'frente' ? setLoadingF(false) : setLoadingD(false);
        }
      }, 'image/jpeg', 0.7);

    } catch (err) {
      console.error(err);
      alert(err.message);
      side === 'frente' ? setLoadingF(false) : setLoadingD(false);
    }
  };

  return (
    <div style={{ padding: 16, background: '#F0F9FF', borderRadius: 10, border: '1px solid #BAE6FD', marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 }}>
        Fotografías del INE
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ flex: 1, padding: '12px 10px', background: f.url_ine_frente ? '#10B981' : '#0284C7', color: '#fff', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.2s' }}>
          {loadingF ? 'Subiendo...' : f.url_ine_frente ? '✓ Frente OK' : '📸 Foto Frente'}
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => processFile(e, 'frente')} />
        </label>
        <label style={{ flex: 1, padding: '12px 10px', background: f.url_ine_dorso ? '#10B981' : '#0284C7', color: '#fff', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.2s' }}>
          {loadingD ? 'Subiendo...' : f.url_ine_dorso ? '✓ Dorso OK' : '📸 Foto Dorso'}
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => processFile(e, 'dorso')} />
        </label>
      </div>
    </div>
  );
}
