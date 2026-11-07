/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import { Backdrop, PopCard } from './Motion';
import { GLOSSARY } from '../../lib/glossary';

// ── "?" CON EXPLICACIÓN ───────────────────────────────────────────────────────
// Circulito azul al lado de una sigla. Al tocarlo abre una ventanita (como alerta de iPhone)
// con qué es, cómo se calcula, un ejemplo y cómo usarlo. Textos en lib/glossary.ts.
// Se dibuja en document.body para que nada de la tarjeta lo tape ni lo mueva.
export function InfoTip({ k, light = false }) {
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[k];
  if (!g) return null;
  const stop = (e) => e.stopPropagation();
  const section = (label, children) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
  return (
    <>
      <button
        type="button"
        aria-label={`¿Qué es ${g.title}?`}
        title={`¿Qué es ${g.title}?`}
        onClick={(e) => {
          stop(e);
          setOpen(true);
        }}
        style={{
          width: 15,
          height: 15,
          minWidth: 15,
          borderRadius: '50%',
          border: 'none',
          background: light ? 'rgba(255,255,255,.9)' : '#2563EB',
          color: light ? '#2563EB' : '#fff',
          fontSize: 10,
          fontWeight: 900,
          lineHeight: '15px',
          padding: 0,
          marginLeft: 5,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          verticalAlign: 'middle',
          textTransform: 'none',
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >
        ?
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <Backdrop
              key="tip"
              onClick={(e) => {
                stop(e);
                if (e.target === e.currentTarget) setOpen(false);
              }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            >
              <PopCard
                onClick={stop}
                style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 400, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.25)', padding: '18px 20px 16px', textAlign: 'left', textTransform: 'none', letterSpacing: 'normal' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, flexShrink: 0 }}>?</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color: '#111' }}>{g.title}</div>
                    <div style={{ fontSize: 12.5, color: '#6B7280', fontWeight: 600, marginTop: 1 }}>{g.sub}</div>
                  </div>
                </div>
                {section('Qué es', <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{g.what}</div>)}
                {section('Cómo sale', <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{g.how}</div>)}
                {section(
                  'Ejemplo',
                  <div style={{ fontSize: 13, color: '#1E3A8A', lineHeight: 1.5, background: '#F8FAFF', border: '1px solid #DBEAFE', borderRadius: 10, padding: '8px 10px' }}>{g.example}</div>
                )}
                {section(
                  'Cómo usarlo',
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                    {g.use.map((u, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{u}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{ marginTop: 14, width: '100%', minHeight: 44, borderRadius: 12, border: 'none', background: '#2563EB', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Entendido
                </button>
              </PopCard>
            </Backdrop>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
