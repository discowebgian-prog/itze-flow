/* eslint-disable */
// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING_POP } from './Motion';
import { onNotify, toastMs, OFFLINE_BANNER, BACK_ONLINE, notify } from '../../lib/voice';

// ── CARTELITO (TOAST) ─────────────────────────────────────────────────────────
// Aparece abajo y se va solo: no hay que tocar "OK" (pedido de Gian).
// Uno a la vez: si llega otro, reemplaza al anterior y su tiempo arranca de cero.
// Los errores son rojos, quedan un poco más y se pueden cerrar tocándolos.
const KIND = {
  ok: { bg: '#10B981', shadow: 'rgba(16,185,129,.28)', icon: '✓' },
  info: { bg: '#2563EB', shadow: 'rgba(37,99,235,.28)', icon: 'ℹ︎' },
  error: { bg: '#DC2626', shadow: 'rgba(220,38,38,.28)', icon: '!' },
};

export function Toast({ isMobile }) {
  const [t, setT] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    const off = onNotify((n) => {
      clearTimeout(timer.current);
      setT(n);
      timer.current = setTimeout(() => setT(null), toastMs(n));
    });
    return () => {
      off();
      clearTimeout(timer.current);
    };
  }, []);

  const k = KIND[t?.kind] || KIND.ok;
  const close = () => {
    clearTimeout(timer.current);
    setT(null);
  };
  return (
    <AnimatePresence>
      {t && t.center && (
        // Al centro (check-in, check-out, cobro): tarjeta más grande, sin fondo oscuro y sin
        // bloquear la pantalla (el toque pasa de largo). Se va sola.
        <div
          key="toast-center"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'none',
            padding: 24,
          }}
        >
          <motion.div
            key={t.id}
            role="status"
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
            transition={SPRING_POP}
            style={{
              background: k.bg,
              color: '#fff',
              borderRadius: 22,
              padding: '20px 24px 18px',
              maxWidth: 330,
              textAlign: 'center',
              boxShadow: `0 18px 40px ${k.shadow}, 0 2px 8px rgba(0,0,0,.08)`,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                background: 'rgba(255,255,255,.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 900,
                margin: '0 auto 10px',
              }}
            >
              {k.icon}
            </div>
            {/* Primera parte en grande; lo demás (separado por " · ") debajo, más chico */}
            {(() => {
              const [head, ...rest] = String(t.text).split(' · ');
              return (
                <>
                  <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>{head}</div>
                  {rest.map((x) => (
                    <div key={x} style={{ fontSize: 13.5, fontWeight: 600, opacity: 0.92, marginTop: 4, lineHeight: 1.3 }}>
                      {x}
                    </div>
                  ))}
                </>
              );
            })()}
          </motion.div>
        </div>
      )}
      {t && !t.center && (
        <div
          key="toast"
          style={{
            position: 'fixed',
            bottom: isMobile ? 106 : 40, // en el celular, arriba del menú de abajo
            left: 0,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'none',
            padding: '0 16px',
            boxSizing: 'border-box',
          }}
        >
          <motion.div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            onClick={close}
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.18 } }}
            transition={SPRING_POP}
            style={{
              background: k.bg,
              color: '#fff',
              padding: '12px 20px',
              borderRadius: 22,
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.35,
              boxShadow: `0 8px 18px ${k.shadow}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 9,
              maxWidth: 460,
              // Solo el rojo se cierra tocándolo; los demás dejan pasar el toque (no tapan botones)
              pointerEvents: t.kind === 'error' ? 'auto' : 'none',
              cursor: t.kind === 'error' ? 'pointer' : 'default',
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 20,
                height: 20,
                borderRadius: 10,
                background: 'rgba(255,255,255,.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 900,
                marginTop: 0,
              }}
            >
              {k.icon}
            </span>
            <span>{t.text}</span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── AVISO SIN CONEXIÓN ────────────────────────────────────────────────────────
// Franja ámbar arriba mientras no hay internet. Al volver: cartelito azul y onBack()
// (recarga reservas, decisiones y tarifas).
export function useOnline(onBack) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => {
    const up = () => {
      setOnline(true);
      notify(BACK_ONLINE, 'info');
      back.current && back.current();
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export function OfflineBanner({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="offline"
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          style={{ overflow: 'hidden', position: 'sticky', top: 54, zIndex: 99 }}
        >
          <div
            style={{
              background: '#FEF3C7',
              borderBottom: '1px solid #FCD34D',
              color: '#92400E',
              fontSize: 12.5,
              fontWeight: 700,
              padding: '8px 16px',
              textAlign: 'center',
            }}
          >
            📡 {OFFLINE_BANNER}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
