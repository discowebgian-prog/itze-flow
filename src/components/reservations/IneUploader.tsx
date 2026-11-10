/* eslint-disable */
// @ts-nocheck
import { useRef, useState } from 'react';
import { scanDocument } from '../../lib/docScan';
import { supabase } from '../../lib/supabase';
import { SCAN, notify, notifyError, humanError } from '../../lib/voice';
import { Icon, ic } from '../ui/Icon';

// ── RESERVATION FORM ──────────────────────────────────────────────────────────
// ── CARGADOR DE DOCUMENTO: GUARDA LA FOTO Y LEE LOS DATOS DEL FRENTE ─────────
export function IneUploader({ f, onUploadFrente, onUploadDorso, onScan }) {
  const [loadingF, setLoadingF] = useState(false);
  const [loadingD, setLoadingD] = useState(false);
  const [scan, setScan] = useState({ status: 'idle', text: '' });
  const lastScan = useRef(0);

  // Corre aparte de la subida: si la lectura falla, la foto se guarda igual.
  const readDocument = async (file) => {
    const scanId = ++lastScan.current;
    setScan({ status: 'reading', text: SCAN.reading });
    try {
      const data = await scanDocument(file);
      if (scanId !== lastScan.current) return;
      if (data) {
        onScan(data);
        setScan({ status: 'done', text: SCAN.done(data) });
      } else {
        setScan({ status: 'failed', text: SCAN.unreadable });
      }
    } catch (err) {
      if (scanId !== lastScan.current) return;
      console.error('Error al leer el documento:', err);
      setScan({ status: 'failed', text: SCAN.failed(err) });
    }
  };

  const processFile = async (e, side) => {
    const file = e.target.files[0];
    e.target.value = ''; // Permite volver a elegir la misma foto
    if (!file) return;

    side === 'frente' ? setLoadingF(true) : setLoadingD(true);
    if (side === 'frente') readDocument(file);

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error('imagen ilegible'));
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

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('documentos')
            .getPublicUrl(fileName);

          side === 'frente' ? onUploadFrente(publicUrl) : onUploadDorso(publicUrl);
        } catch (err) {
          notifyError(err, `subir la foto del ${side}`);
        } finally {
          side === 'frente' ? setLoadingF(false) : setLoadingD(false);
        }
      }, 'image/jpeg', 0.7);

    } catch (err) {
      console.error(err);
      notify(
        /ilegible/.test(err?.message || '')
          ? 'No se pudo abrir esa foto. Probá sacarla de nuevo.'
          : humanError(err, `subir la foto del ${side}`),
        'error'
      );
      side === 'frente' ? setLoadingF(false) : setLoadingD(false);
    }
  };

  return (
    <div style={{ padding: 14, background: 'var(--acc-soft)', borderRadius: 'var(--r-item)', marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--acc)', marginBottom: 10, lineHeight: 1.35 }}>
        Sacale foto al documento: se completan solos el nombre y casi todo lo demás.
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...camBtn, background: f.url_ine_frente ? '#DCFCE7' : 'var(--acc)', color: f.url_ine_frente ? '#15803D' : '#fff' }}>
          {loadingF ? SCAN.uploading : f.url_ine_frente ? <>{ic('tick', 16)}Frente listo</> : <>{ic('camera', 17)}Foto frente</>}
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => processFile(e, 'frente')} />
        </label>
        <label style={{ ...camBtn, background: f.url_ine_dorso ? '#DCFCE7' : 'var(--acc)', color: f.url_ine_dorso ? '#15803D' : '#fff' }}>
          {loadingD ? SCAN.uploading : f.url_ine_dorso ? <>{ic('tick', 16)}Dorso listo</> : <>{ic('camera', 17)}Foto dorso</>}
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => processFile(e, 'dorso')} />
        </label>
      </div>
      {scan.status === 'reading' && (
        <div key="reading" className="pop-in" style={{ marginTop: 10, fontSize: 12.5, color: 'var(--acc)', fontWeight: 600 }}>
          {ic('sparkles', 14)}{scan.text}
        </div>
      )}
      {scan.status === 'done' && (
        <div key="done" className="pop-in" style={{ marginTop: 10, fontSize: 12.5, color: '#15803D', fontWeight: 700 }}>
          {ic('check', 14)}{scan.text}
        </div>
      )}
      {scan.status === 'failed' && (
        <div key="failed" className="pop-in" style={{ marginTop: 10, fontSize: 12.5, color: '#B45309', fontWeight: 600 }}>
          {ic('camera', 14)}{scan.text}
        </div>
      )}
    </div>
  );
}

// Botones de foto: grandes, fáciles de tocar con el documento en la otra mano
const camBtn = {
  flex: 1,
  minHeight: 46,
  padding: '11px 10px',
  borderRadius: 'var(--r-field)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 14.5,
  transition: 'background .2s, color .2s',
};
