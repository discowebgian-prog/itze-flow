/* eslint-disable */
// @ts-nocheck
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, animate, useReducedMotion } from 'motion/react';

// ── ANIMACIONES TIPO iOS ──────────────────────────────────────────────────────
// Resortes compartidos por toda la app (así todo se mueve igual).
// Si el teléfono pide "reducir movimiento", <MotionConfig reducedMotion="user"> (main.tsx)
// apaga los desplazamientos y deja solo el fundido.

// Hojas que suben desde abajo y paneles laterales: rápido, sin rebote exagerado
export const SPRING_SHEET = { type: 'spring', damping: 34, stiffness: 380, mass: 0.9 };
// Ventanitas centradas (confirmaciones): aparecen como las alertas de iPhone
export const SPRING_POP = { type: 'spring', damping: 26, stiffness: 460, mass: 0.8 };
export const FADE = { duration: 0.22, ease: [0.32, 0.72, 0, 1] };

// Gesto para cerrar arrastrando: alcanza con bajar 110 px o soltar con envión
export const shouldClose = (info, axis = 'y') =>
  axis === 'y' ? info.offset.y > 110 || info.velocity.y > 550 : info.offset.x > 110 || info.velocity.x > 550;

// No arrancar el gesto si se tocó un botón, campo o enlace (la X sigue funcionando normal)
export const dragStartOk = (e) => !e.target.closest('button, a, input, select, textarea, label');

// Fondo oscuro detrás de ventanas y paneles: aparece y se va con fundido.
// Recibe el mismo style que tenía el div (position: fixed, background, zIndex…).
export function Backdrop({ style = {}, children, ...rest }) {
  const { background, ...s } = style;
  return (
    <motion.div
      {...rest}
      style={s}
      initial={{ backgroundColor: 'rgba(0,0,0,0)' }}
      animate={{ backgroundColor: background || 'rgba(0,0,0,.5)' }}
      exit={{ backgroundColor: 'rgba(0,0,0,0)', pointerEvents: 'none' }}
      transition={FADE}
    >
      {children}
    </motion.div>
  );
}

// Tarjeta centrada (confirmaciones, avisos): entra apenas grande y se asienta; sale achicándose
export function PopCard({ style = {}, children, ...rest }) {
  return (
    <motion.div
      {...rest}
      style={style}
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
      transition={SPRING_POP}
    >
      {children}
    </motion.div>
  );
}

// ── ETAPA 3: DETALLES ─────────────────────────────────────────────────────────
const EASE_IOS = [0.32, 0.72, 0, 1];

// Desplegable que se abre y se cierra con suavidad (alto de 0 a su tamaño, con fundido).
// Al terminar de abrir deja overflow visible para no cortar sombras ni listas que sobresalen.
export function Collapse({ open, children, style = {}, ...rest }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          {...rest}
          initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
          animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
          exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
          transition={{ duration: 0.28, ease: EASE_IOS }}
          style={style}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Lo mismo pero solo al aparecer (para cuando un botón se reemplaza por un recuadro)
export function Reveal({ children, style = {}, ...rest }) {
  return (
    <motion.div
      {...rest}
      initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
      animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
      transition={{ duration: 0.28, ease: EASE_IOS }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// Números que "cuentan" hasta su valor (como en las apps de iPhone).
// value puede ser número o texto con número adentro: "45%", "$12,340", "$ 1,290.50".
// Al cambiar, cuenta desde el valor anterior. Con "reducir movimiento" muestra el valor directo.
const splitNum = (v) => {
  const m = String(v ?? '').match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (!m) return null;
  const raw = m[2].replace(/,/g, '');
  const dec = raw.includes('.') ? raw.split('.')[1].length : 0;
  return { pre: m[1], num: parseFloat(raw), dec, post: m[3], commas: m[2].includes(',') || Math.abs(parseFloat(raw)) >= 1000 };
};
const joinNum = (p, n) =>
  p.pre +
  (p.commas
    ? n.toLocaleString('en-US', { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec })
    : n.toFixed(p.dec)) +
  p.post;
export function CountUp({ value, duration = 0.7 }) {
  const ref = useRef(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  const parts = splitNum(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!parts || reduce || !isFinite(parts.num)) {
      el.textContent = String(value ?? '');
      if (parts) prev.current = parts.num;
      return;
    }
    const from = prev.current;
    prev.current = parts.num;
    if (from === parts.num) {
      el.textContent = String(value);
      return;
    }
    const ctl = animate(from, parts.num, {
      duration,
      ease: EASE_IOS,
      onUpdate: (n) => {
        el.textContent = joinNum(parts, n);
      },
      onComplete: () => {
        el.textContent = String(value);
      },
    });
    return () => ctl.stop();
  }, [value]);
  // Primer pintado: arranca en 0 (o el texto tal cual si no hay número)
  return <span ref={ref}>{parts ? joinNum(parts, prev.current) : String(value ?? '')}</span>;
}
