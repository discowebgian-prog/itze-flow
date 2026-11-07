/* eslint-disable */
// @ts-nocheck
import { motion, useDragControls } from 'motion/react';
import { Backdrop, SPRING_SHEET, SPRING_POP, shouldClose, dragStartOk } from './Motion';

// ── MODAL ─────────────────────────────────────────────────────────────────────
// tall: en el celular la hoja ocupa siempre el 92% del alto, así no crece ni se achica (y no mueve lo que estás tocando)
// Animación tipo iOS: en el celular la hoja sube desde abajo y se cierra deslizándola hacia abajo desde la barrita
// o el título (además de la X y tocar afuera). En compu aparece al centro con un leve zoom.
// Para que también se anime al salir, quien la usa la envuelve en <AnimatePresence> con una key.
export function Modal({ title, onClose, children, isMobile, tall = false }) {
  const drag = useDragControls();
  return (
    <Backdrop
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 12,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.94, y: 14 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobile ? { y: '100%', transition: { duration: 0.24, ease: [0.32, 0.72, 0, 1] } } : { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.16 } }}
        transition={isMobile ? SPRING_SHEET : SPRING_POP}
        drag={isMobile ? 'y' : false}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 1 }}
        onDragEnd={(e, info) => shouldClose(info) && onClose()}
        style={{
          background: '#fff',
          borderRadius: isMobile ? '20px 20px 0 0' : '16px',
          width: '100%',
          maxWidth: isMobile ? '100%' : 520,
          maxHeight: '92vh',
          height: isMobile && tall ? '92vh' : undefined,
          overflow: 'auto',
          boxShadow: '0 -4px 40px rgba(0,0,0,.18)',
        }}
      >
        {/* Barrita y título: de acá se arrastra la hoja para cerrarla */}
        <div
          onPointerDown={(e) => isMobile && dragStartOk(e) && drag.start(e)}
          style={{ touchAction: isMobile ? 'none' : undefined, cursor: isMobile ? 'grab' : undefined, userSelect: isMobile ? 'none' : undefined, WebkitUserSelect: isMobile ? 'none' : undefined }}
        >
        {isMobile && (
          <div
            style={{
              width: 36,
              height: 4,
              background: '#E5E7EB',
              borderRadius: 2,
              margin: '12px auto 0',
            }}
          />
        )}
        <div
          style={{
            padding: isMobile ? '14px 20px 0' : '20px 24px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #F0F0F0',
            paddingBottom: 14,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: isMobile ? 16 : 17,
              color: '#111',
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: '#F3F4F6',
              border: 'none',
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: 'pointer',
              fontSize: 18,
              color: '#555',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>
        </div>
        <div
          style={{ padding: isMobile ? '16px 20px 32px' : '20px 24px 28px' }}
        >
          {children}
        </div>
      </motion.div>
    </Backdrop>
  );
}
