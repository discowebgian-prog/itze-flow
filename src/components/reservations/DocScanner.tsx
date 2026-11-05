/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { askClaude } from '../../lib/claude';

const MAX_LONG_EDGE = 1800;
const JPEG_QUALITY = 0.8;

const SCAN_PROMPT = `Extract identity document data. Return ONLY valid JSON:
{"firstName":"","lastName":"","fullName":"","docNumber":"","docType":"INE","nationality":"MX"}
fullName = given names first, then surnames (a Mexican INE prints surnames first, so reorder them).
docNumber = for a Mexican INE use the CLAVE DE ELECTOR (not the CURP); for a passport use the passport number.
docType = INE|Pasaporte|Otro. nationality = 2-letter ISO code. Leave a field empty if unclear.`;

// Las fotos de celular pesan varios MB y Vercel acepta hasta 4.5 MB por pedido.
const compressPhoto = async (file) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('No se pudo leer la imagen. Probá con otra foto.'));
    });

    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

// ── DOC SCANNER ───────────────────────────────────────────────────────────────
export function DocScanner({ onResult }) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [inputEl, setInputEl] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setSuccess(false);
    setScanning(true);
    try {
      const dataUrl = await compressPhoto(file);
      setPreview(dataUrl);

      const raw = await askClaude({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: dataUrl.split(',')[1] } },
              { type: 'text', text: SCAN_PROMPT },
            ],
          },
        ],
        maxTokens: 4000,
        effort: 'low',
      });

      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      const parsed = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) : {};

      if (!parsed.docNumber && !parsed.firstName && !parsed.fullName) {
        setError('No se detectaron datos. Usá buena iluminación.');
      } else {
        onResult(parsed);
        setSuccess(true);
      }
    } catch (err) {
      console.error('DocScanner Error:', err.name);
      setError(err instanceof SyntaxError ? 'No se pudo leer la respuesta. Probá de nuevo.' : err.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div
      style={{
        marginBottom: 14,
        background: '#F0F9FF',
        border: '1.5px solid #BAE6FD',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <input
        ref={(el) => setInputEl(el)}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files[0];
          e.target.value = ''; // Permite volver a elegir la misma foto
          if (file) handleFile(file);
        }}
      />
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#0369A1',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 8,
        }}
      >
        Escanear documento de identidad
      </div>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => inputEl && inputEl.click()}
          disabled={scanning}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            background: scanning ? '#E0F2FE' : '#0369A1',
            border: 'none',
            borderRadius: 9,
            color: '#fff',
            fontFamily: 'inherit',
            fontWeight: 700,
            fontSize: 14,
            cursor: scanning ? 'not-allowed' : 'pointer',
            minWidth: 180,
            justifyContent: 'center',
          }}
        >
          📷{' '}
          {scanning
            ? 'Analizando...'
            : preview
            ? 'Nueva foto'
            : 'Tomar foto / Subir'}
        </button>
        {preview && (
          <img
            src={preview}
            alt="doc"
            style={{
              height: 52,
              borderRadius: 8,
              border: '2px solid #BAE6FD',
              objectFit: 'cover',
              maxWidth: 80,
            }}
          />
        )}
      </div>
      {scanning && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#0369A1' }}>
          ✦ Claude está leyendo el documento...
        </div>
      )}
      {success && !scanning && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: '#059669',
            fontWeight: 700,
          }}
        >
          ✓ Datos extraídos. Revisá y corregí si es necesario.
        </div>
      )}
      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#DC2626' }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
