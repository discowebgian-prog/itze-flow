/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';

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
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      setScanning(true);
      try {
        const apiKey = import.meta.env.VITE_CLAUDE_KEY;
        if (!apiKey) throw new Error('Falta la API Key en Vercel');

        const base64 = dataUrl.split(',')[1];
        const mt = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
        
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-5',
            max_tokens: 4000,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: mt, data: base64 } },
                  { type: 'text', text: 'Extract identity document data. Return ONLY valid JSON:\n{"firstName":"","lastName":"","fullName":"","docNumber":"","docType":"INE","nationality":"MX"}\ndocType=INE|Pasaporte|Otro. nationality=2-letter ISO code. Leave empty if unclear.' }
                ]
              }
            ]
          }),
        });

        if (!resp.ok) {
          const errData = await resp.json();
          throw new Error(errData.error?.message || 'API ' + resp.status);
        }

        const data = await resp.json();
        const raw = (data.content && data.content[0] && data.content[0].text) || '{}';
        const FENCE = String.fromCharCode(96, 96, 96);
        const clean = raw.split(FENCE + 'json').join('').split(FENCE).join('').trim();
        const parsed = JSON.parse(clean);
        
        if (!parsed.docNumber && !parsed.firstName && !parsed.fullName) {
          setError('No se detectaron datos. Usá buena iluminación.');
        } else {
          onResult(parsed);
          setSuccess(true);
        }
      } catch (err) {
        console.error('DocScanner Error:', err);
        setError(`Error: ${err.message}`);
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
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
          if (e.target.files[0]) handleFile(e.target.files[0]);
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
