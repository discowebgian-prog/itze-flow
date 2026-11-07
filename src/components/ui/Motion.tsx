/* eslint-disable */
// @ts-nocheck
import { motion } from 'motion/react';

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
