/* eslint-disable */
// @ts-nocheck
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import AppMejorada from './App';
import { registerSW } from './lib/push';
// Estilo de Flow (colores, letra, formas) en un solo lugar
import './styles/theme.css';
import './styles/colores.css';

// Service worker solo para los avisos con la app cerrada (no guarda la app en caché)
registerSW();

// Font y Candado Anti-Zoom para Celulares
if (typeof document !== 'undefined') {
  // 1. Letra: la redondeada del sistema (como Itzé Limpieza), sin descargar nada. Está en --font (theme.css).
  //    Si el aparato no la tiene, se marca <html class="no-rounded"> y los títulos usan un grosor más liviano.
  try {
    const c = document.createElement('canvas').getContext('2d');
    const w = (f) => { c.font = `40px ${f}`; return c.measureText('Buenas tardes, Gian 0123').width; };
    if (w('ui-rounded, monospace') === w('monospace')) document.documentElement.classList.add('no-rounded');
  } catch (e) {}

  // 2. Bloquear el zoom automático (Comportamiento de App Nativa)
  let metaViewport = document.querySelector('meta[name="viewport"]');
  if (!metaViewport) {
    metaViewport = document.createElement('meta');
    metaViewport.name = 'viewport';
    document.head.appendChild(metaViewport);
  }
  metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  // El iPhone ignora user-scalable=no desde iOS 10: se frena a mano el zoom con dos dedos en toda la app
  // (el calendario ya lo frenaba por su touch-action). El doble toque lo frena el CSS (touch-action en html).
  const stop = (e) => e.preventDefault();
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, stop, { passive: false }));
  document.addEventListener('touchmove', (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });

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
