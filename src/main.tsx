/* eslint-disable */
// @ts-nocheck
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import AppMejorada from './App';

// Font y Candado Anti-Zoom para Celulares
if (typeof document !== 'undefined') {
  // 1. Cargar la fuente
  if (!document.getElementById('gf')) {
    const l = document.createElement('link');
    l.id = 'gf';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
    document.head.appendChild(l);
  }

  // 2. Bloquear el zoom automático (Comportamiento de App Nativa)
  let metaViewport = document.querySelector('meta[name="viewport"]');
  if (!metaViewport) {
    metaViewport = document.createElement('meta');
    metaViewport.name = 'viewport';
    document.head.appendChild(metaViewport);
  }
  metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

  // 3. En iPhone, :active (efecto al apretar un botón) solo funciona si hay un listener de toque
  document.addEventListener('touchstart', () => {}, { passive: true });
}

const rootElement = document.getElementById('root');
if (rootElement) {
    // reducedMotion="user": si el teléfono pide reducir movimiento, las animaciones solo hacen fundido
  createRoot(rootElement).render(
    <MotionConfig reducedMotion="user">
      <AppMejorada />
    </MotionConfig>
  );
}
