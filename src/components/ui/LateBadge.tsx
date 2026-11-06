/* eslint-disable */
// @ts-nocheck
import { lateHour } from '../../lib/reservations';

// Etiqueta "🕐 Late 16:00" para reservas con late check-out (no muestra nada si no tiene)
export const LATE_COLORS = { bg: '#E0E7FF', txt: '#3730A3', border: '#A5B4FC' };

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
        background: LATE_COLORS.bg,
        color: LATE_COLORS.txt,
        border: `1px solid ${LATE_COLORS.border}`,
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
