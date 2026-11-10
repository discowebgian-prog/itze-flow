/* eslint-disable */
// @ts-nocheck
import { RS } from '../../lib/constants';

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
export const Badge = ({ status, large }) => {
  // EL SALVAVIDAS: Si el estado no existe en la lista, le pone un color gris por defecto y muestra el nombre en lugar de explotar.
  const s = RS[status] || { bg: 'var(--c-F3F4F6)', txt: 'var(--c-6B7280)', label: status || 'Desconocido' };
  
  return (
    <span
      style={{
        background: s.bg,
        color: s.txt,
        padding: large ? '5px 12px' : '2px 9px',
        borderRadius: 20,
        fontSize: large ? 13 : 11,
        fontWeight: 800,
        textTransform: large ? 'uppercase' : 'none',
        letterSpacing: large ? 0.5 : 0,
        display: 'inline-block'
      }}
    >
      {s.label}
    </span>
  );
};
