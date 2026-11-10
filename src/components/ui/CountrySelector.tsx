/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { COUNTRIES } from '../../lib/constants';
import { motion, AnimatePresence } from 'motion/react';

// ── COUNTRY SELECTOR ──────────────────────────────────────────────────────────
export function CountrySelector({ value, onChange }) {
  const country = COUNTRIES.find((c) => c.code === value) || COUNTRIES[0];
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  // Busca sin importar tildes ni mayúsculas ("canada" encuentra "Canadá")
  const norm = (t) =>
    String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtered =
    q.length > 0
      ? COUNTRIES.filter(
          (c) =>
            norm(c.name).includes(norm(q)) ||
            c.prefix.includes(q)
        ).slice(0, 8)
      : [];
  return (
    <div style={{ marginBottom: 12, position: 'relative' }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--mut)',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        Nacionalidad
      </label>
      <input
        value={open ? q : `${country.flag} ${country.name} (${country.prefix})`}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQ('');
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Buscar país..."
        style={{
          width: '100%',
          padding: '9px 12px',
          border: '1.5px solid var(--line)',
          borderRadius: 8,
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <AnimatePresence>{open && filtered.length > 0 && (
        <motion.div
          key="list"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          style={{ transformOrigin: 'top center',
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--card)',
            border: '1.5px solid var(--line)',
            borderRadius: 8,
            zIndex: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            overflow: 'hidden',
            marginTop: 2,
          }}
        >
          {filtered.map((c) => (
            <div
              key={c.code}
              onMouseDown={() => {
                onChange(c);
                setOpen(false);
                setQ('');
              }}
              style={{
                padding: '9px 14px',
                cursor: 'pointer',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                fontSize: 13,
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = '#F0F7FF')
              }
              onMouseOut={(e) => (e.currentTarget.style.background = '#fff')}
            >
              <span style={{ fontSize: 18 }}>{c.flag}</span>
              <span style={{ flex: 1, fontWeight: 600, color: 'var(--ink)' }}>
                {c.name}
              </span>
              <span style={{ color: 'var(--mut)', fontSize: 12 }}>{c.prefix}</span>
            </div>
          ))}
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
