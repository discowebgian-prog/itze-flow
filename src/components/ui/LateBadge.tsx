/* eslint-disable */
// @ts-nocheck
import { lateHour } from '../../lib/reservations';

// Etiqueta "🕐 Late 16:00" para reservas con late check-out (no muestra nada si no tiene)
export const LATE_COLORS = { bg: '#E0E7FF', txt: '#3730A3', border: '#A5B4FC' };

// La etiqueta va llena (índigo) con letra blanca
export function LateBadge({ r, size = 11, style = {} }) {
  const h = lateHour(r);
  if (!h) return null;
  return (
    <span
      title={`Late check-out a las ${h}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        // Lleno y con color para que no pase desapercibida (mismo tamaño)
        background: '#4F46E5',
        color: '#fff',
        border: '1px solid #4F46E5',
        padding: '1px 6px',
        borderRadius: 5,
        fontSize: size,
        fontWeight: 800,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      🕐 Late {h}
    </span>
  );
}
