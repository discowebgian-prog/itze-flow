/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { Backdrop, PopCard } from './Motion';
import { PEOPLE } from '../../lib/device';

// "¿Quién usa este dispositivo?" — aparece la primera vez en cada aparato.
// Dos toques: Gian o Marce. "Otra persona" deja escribir un nombre.
export function WhoAmI({ current, onPick, onClose }) {
  const [other, setOther] = useState(current && !PEOPLE.includes(current) ? current : '');
  const [writing, setWriting] = useState(!!other);
  const btn = (active) => ({
    flex: 1,
    padding: '14px 10px',
    borderRadius: 12,
    border: active ? '2px solid #2563EB' : '1.5px solid var(--c-E5E7EB)',
    background: active ? '#EFF6FF' : 'var(--card)',
    color: active ? '#1D4ED8' : 'var(--c-111827)',
    fontFamily: 'inherit',
    fontWeight: 800,
    fontSize: 16,
    cursor: 'pointer',
  });
  return (
    <Backdrop
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.45)',
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <PopCard
        style={{
          background: 'var(--card)',
          borderRadius: 18,
          maxWidth: 360,
          width: '100%',
          padding: '22px 20px 18px',
          boxShadow: '0 24px 64px rgba(0,0,0,.25)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 30, marginBottom: 6 }}>👋</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--c-0F172A)', marginBottom: 6 }}>
          ¿Quién usa este dispositivo?
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-64748B)', marginBottom: 18, lineHeight: 1.4 }}>
          Así Flow te saluda por tu nombre y anota quién cargó cada cosa. Se guarda solo en este aparato.
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          {PEOPLE.map((p) => (
            <button key={p} className="tap" style={btn(current === p)} onClick={() => onPick(p)}>
              {p}
            </button>
          ))}
        </div>
        {writing ? (
          <div className="pop-in" style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && other.trim() && onPick(other.trim())}
              placeholder="Tu nombre"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--c-E5E7EB)', fontFamily: 'inherit', fontSize: 14 }}
            />
            <button
              disabled={!other.trim()}
              onClick={() => onPick(other.trim())}
              style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: other.trim() ? '#2563EB' : 'var(--c-CBD5E1)', color: '#fff', fontFamily: 'inherit', fontWeight: 800, cursor: other.trim() ? 'pointer' : 'default' }}
            >
              Listo
            </button>
          </div>
        ) : (
          <button
            onClick={() => setWriting(true)}
            style={{ background: 'none', border: 'none', color: 'var(--c-6B7280)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Otra persona
          </button>
        )}
      </PopCard>
    </Backdrop>
  );
}
