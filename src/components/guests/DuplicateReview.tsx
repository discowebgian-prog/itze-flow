/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { COUNTRIES } from '../../lib/constants';
import { fmtD } from '../../lib/dates';
import { guestKey } from '../../lib/guests';

// ── REVISIÓN DE POSIBLES HUÉSPEDES DUPLICADOS ─────────────────────────────────
// Muestra de a un par por vez. El admin decide: misma persona, son distintas o después.

const card = {
  background: '#fff',
  borderRadius: 10,
  border: '1px solid #E5E7EB',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
};
const rowLabel = { fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginRight: 4 };
const row = { fontSize: 12, color: '#374151', overflowWrap: 'anywhere' };

function GuestSide({ g, reservations }) {
  const stays = reservations
    .filter((r) => g.stays.includes(r.id))
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const latest = stays[0] || {};
  const withPhoto = stays.find((r) => r.url_ine_frente || r.url_ine_dorso);
  const nat = COUNTRIES.find((c) => c.code === latest.guestNationality);
  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>{g.name}</div>
      <div style={row}>
        <span style={rowLabel}>Documento</span>
        {g.doc ? g.doc : <span style={{ color: '#9CA3AF' }}>Sin documento</span>}
      </div>
      {nat && (
        <div style={row}>
          <span style={rowLabel}>Nacionalidad</span>
          {nat.flag} {nat.name}
        </div>
      )}
      {g.phone && (
        <div style={row}>
          <span style={rowLabel}>Teléfono</span>
          {latest.guestPhonePrefix ? `${latest.guestPhonePrefix} ` : ''}
          {g.phone}
        </div>
      )}
      {g.email && (
        <div style={row}>
          <span style={rowLabel}>Email</span>
          {g.email}
        </div>
      )}
      <div style={row}>
        <span style={rowLabel}>Estancias ({stays.length})</span>
        {stays
          .slice(0, 3)
          .map((r) => `${fmtD(r.checkIn)}${r.room ? ' · ' + r.room : ''}`)
          .join('  |  ')}
        {stays.length > 3 ? '  …' : ''}
      </div>
      {withPhoto && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {withPhoto.url_ine_frente && (
            <a href={withPhoto.url_ine_frente} target="_blank" rel="noreferrer" style={photoLink}>
              📷 Doc. frente
            </a>
          )}
          {withPhoto.url_ine_dorso && (
            <a href={withPhoto.url_ine_dorso} target="_blank" rel="noreferrer" style={photoLink}>
              📷 Doc. dorso
            </a>
          )}
        </div>
      )}
    </div>
  );
}

const photoLink = {
  fontSize: 11,
  fontWeight: 700,
  color: '#1E40AF',
  background: '#EFF6FF',
  border: '1px solid #BFDBFE',
  borderRadius: 6,
  padding: '4px 8px',
  textDecoration: 'none',
};

const btn = (bg, color, border) => ({
  flex: '1 1 160px',
  padding: '11px 14px',
  borderRadius: 9,
  border: `1.5px solid ${border}`,
  background: bg,
  color,
  fontWeight: 800,
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
});

export function DuplicateReview({ pairs, reservations, decisions, onDecide, onUndo, onClose }) {
  const [skipped, setSkipped] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const pending = pairs.filter((p) => !skipped.has(p.id));
  const current = pending[0];

  const decide = async (decision) => {
    if (!current || busy) return;
    setBusy(true);
    await onDecide(current, decision);
    setBusy(false);
  };

  // Nombre para mostrar de una clave guardada en una decisión
  const nameOf = (key) => {
    const r = [...reservations]
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
      .find((x) => guestKey(x) === key);
    if (r) return r.guestName + (r.guestDoc ? ` (${r.guestDoc})` : ' (sin doc.)');
    return key.replace(/^(doc|nom):/, '');
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111' }}>Posibles duplicados</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>
            {current
              ? `Quedan ${pending.length} por revisar${skipped.size ? ` (salteaste ${skipped.size})` : ''}`
              : 'Nada pendiente por ahora'}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ ...btn('#fff', '#374151', '#E5E7EB'), flex: '0 0 auto', padding: '8px 12px', fontSize: 12 }}
        >
          ← Volver
        </button>
      </div>

      {current ? (
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
          <div style={{ marginBottom: 10, fontSize: 12, color: '#475569' }}>
            ¿Son la misma persona?{' '}
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#92400E',
                background: '#FEF3C7',
                padding: '2px 8px',
                borderRadius: 20,
                marginLeft: 4,
              }}
            >
              {current.reasonText}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
              marginBottom: 14,
            }}
          >
            <GuestSide g={current.a} reservations={reservations} />
            <GuestSide g={current.b} reservations={reservations} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button disabled={busy} onClick={() => decide('misma')} style={btn('#ECFDF5', '#065F46', '#10B981')}>
              ✅ Es la misma persona
            </button>
            <button disabled={busy} onClick={() => decide('distinta')} style={btn('#FEF2F2', '#991B1B', '#FECACA')}>
              ❌ Son distintas
            </button>
            <button
              disabled={busy}
              onClick={() => setSkipped((s) => new Set(s).add(current.id))}
              style={{ ...btn('transparent', '#6B7280', 'transparent'), flex: '0 0 auto' }}
            >
              Después
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 12,
            padding: 16,
            fontSize: 13,
            color: '#065F46',
            fontWeight: 600,
          }}
        >
          {skipped.size
            ? `Listo por ahora. Salteaste ${skipped.size}: te los vuelvo a mostrar la próxima vez.`
            : '¡Listo! No quedan posibles duplicados por revisar.'}
        </div>
      )}

      {decisions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowHistory((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              color: '#2563EB',
              cursor: 'pointer',
            }}
          >
            {showHistory ? '▾' : '▸'} Decisiones tomadas ({decisions.length})
          </button>
          {showHistory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {[...decisions]
                .sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)))
                .map((d) => (
                  <div
                    key={d.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, color: '#374151', overflowWrap: 'anywhere' }}>
                      {nameOf(d.clave_a)} ↔ {nameOf(d.clave_b)}
                      <div style={{ fontSize: 11, color: d.decision === 'misma' ? '#059669' : '#B91C1C', fontWeight: 700 }}>
                        {d.decision === 'misma' ? 'Misma persona' : 'Son distintas'}
                        <span style={{ color: '#9CA3AF', fontWeight: 500 }}>
                          {d.decidido_por ? ` · ${d.decidido_por}` : ''}
                          {d.creado_en ? ` · ${fmtD(String(d.creado_en).slice(0, 10))}` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onUndo(d.id)}
                      style={{
                        flexShrink: 0,
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #E5E7EB',
                        background: '#F9FAFB',
                        color: '#374151',
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      Deshacer
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
