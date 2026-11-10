/* eslint-disable */
// @ts-nocheck
// ── ETIQUETA DE GRUPO ("🔗 Grupo") ────────────────────────────────────────────
// Marca las reservas que son parte de un grupo (varias habitaciones de un titular).
import { Icon } from './Icon';

export const GROUP_COLORS = { bg: 'var(--c-CCFBF1)', txt: 'var(--c-0F766E)', border: 'var(--c-5EEAD4)' };

export function GroupBadge({ r, size = 11, count }) {
  if (!r || !r.grupoId) return null;
  return (
    <span
      title="Reserva de grupo"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: size,
        fontWeight: 800,
        color: GROUP_COLORS.txt,
        background: GROUP_COLORS.bg,
        padding: '1px 7px',
        borderRadius: 10,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      <Icon name="link" size={size + 1} strokeWidth={2.5} />Grupo{count ? ` · ${count}` : ''}
    </span>
  );
}
