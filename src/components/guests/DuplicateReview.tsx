/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { COUNTRIES } from '../../lib/constants';
import { fmtD } from '../../lib/dates';
import { guestKey } from '../../lib/guests';
import { DocLink } from '../ui/DocLink';
import { Icon, ic } from '../ui/Icon';
import { Collapse } from '../ui/Motion';

// ── REVISIÓN DE POSIBLES HUÉSPEDES DUPLICADOS ─────────────────────────────────
// Muestra de a un par por vez. El admin decide: misma persona, son distintas o después.

const card = {
  background: 'var(--card)',
  borderRadius: 'var(--r-item)',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
};
const rowLabel = { fontSize: 10.5, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', marginRight: 4 };
const row = { fontSize: 13, color: 'var(--ink-2)', overflowWrap: 'anywhere' };

function GuestSide({ g, reservations }) {
  const stays = reservations
    .filter((r) => g.stays.includes(r.id))
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const latest = stays[0] || {};
  const withPhoto = stays.find((r) => r.url_ine_frente || r.url_ine_dorso);
  const nat = COUNTRIES.find((c) => c.code === latest.guestNationality);
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{g.name}</div>
      <div style={row}>
        <span style={rowLabel}>Documento</span>
        {g.doc ? g.doc : <span style={{ color: 'var(--mut)' }}>Sin documento</span>}
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
        <span style={rowLabel}>Reservas ({stays.length})</span>
        {stays
          .slice(0, 3)
          .map((r) => `${fmtD(r.checkIn)}${r.room ? ' · ' + r.room : ''}`)
          .join(' · ')}
        {stays.length > 3 ? '  …' : ''}
      </div>
      {withPhoto && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {withPhoto.url_ine_frente && (
            <DocLink url={withPhoto.url_ine_frente} style={photoLink}>
              {ic('camera', 13)}Doc. frente
            </DocLink>
          )}
          {withPhoto.url_ine_dorso && (
            <DocLink url={withPhoto.url_ine_dorso} style={photoLink}>
              {ic('camera', 13)}Doc. dorso
            </DocLink>
          )}
        </div>
      )}
    </div>
  );
}

const photoLink = {
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--acc)',
  background: 'var(--acc-soft)',
  borderRadius: 20,
  padding: '5px 11px',
  textDecoration: 'none',
};

const btn = (bg, color) => ({
  flex: '1 1 160px',
  minHeight: 46,
  padding: '11px 14px',
  borderRadius: 'var(--r-field)',
  border: 'none',
  background: bg,
  color,
  fontWeight: 700,
  fontSize: 14.5,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
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
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: 'var(--ls-title)' }}>Posibles duplicados</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--mut)' }}>
            {current
              ? `Quedan ${pending.length} por revisar${skipped.size ? ` (salteaste ${skipped.size})` : ''}`
              : 'Nada pendiente por ahora'}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ ...btn('var(--acc-soft)', 'var(--acc)'), flex: '0 0 auto', minHeight: 36, padding: '7px 14px 7px 10px', fontSize: 14, borderRadius: 20 }}
        >
          <Icon name="chevL" size={17} />
          Volver
        </button>
      </div>

      {current ? (
        <div style={{ background: 'var(--fill)', borderRadius: 'var(--r-card)', padding: 14 }}>
          <div style={{ marginBottom: 10, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
            ¿Son la misma persona?{' '}
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--c-92400E)',
                background: 'var(--c-FEF3C7)',
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
            <button disabled={busy} onClick={() => decide('misma')} style={btn('var(--c-16A34A)', '#fff')}>
              <Icon name="check" size={18} />
              Es la misma persona
            </button>
            <button disabled={busy} onClick={() => decide('distinta')} style={btn('var(--card)', 'var(--red)')}>
              <Icon name="close" size={18} />
              Son distintas
            </button>
            <button
              disabled={busy}
              onClick={() => setSkipped((s) => new Set(s).add(current.id))}
              style={{ ...btn('transparent', 'var(--mut)'), flex: '0 0 auto', fontWeight: 600 }}
            >
              Después
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--c-ECFDF5)',
            borderRadius: 'var(--r-item)',
            padding: 16,
            fontSize: 14,
            color: 'var(--c-065F46)',
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
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--acc)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ display: 'inline-flex', transform: showHistory ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
              <Icon name="chev" size={16} strokeWidth={2.5} />
            </span>
            Decisiones tomadas ({decisions.length})
          </button>
          <Collapse open={showHistory}>
            <div className="ui-group" style={{ marginTop: 8 }}>
              {[...decisions]
                .sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)))
                .map((d) => (
                  <div
                    key={d.id}
                    className="ui-row"
                    style={{ cursor: 'default', fontSize: 13.5 }}
                  >
                    <div style={{ flex: 1, minWidth: 0, color: 'var(--ink)', overflowWrap: 'anywhere' }}>
                      {nameOf(d.clave_a)} ↔ {nameOf(d.clave_b)}
                      <div style={{ fontSize: 12, color: d.decision === 'misma' ? 'var(--c-15803D)' : 'var(--red)', fontWeight: 700 }}>
                        {d.decision === 'misma' ? 'Misma persona' : 'Son distintas'}
                        <span style={{ color: 'var(--mut)', fontWeight: 500 }}>
                          {d.decidido_por ? ` · ${d.decidido_por}` : ''}
                          {d.creado_en ? ` · ${fmtD(String(d.creado_en).slice(0, 10))}` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onUndo(d.id)}
                      style={{
                        flexShrink: 0,
                        padding: '6px 12px',
                        borderRadius: 20,
                        border: 'none',
                        background: 'var(--fill)',
                        color: 'var(--acc)',
                        fontSize: 13,
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
          </Collapse>
        </div>
      )}
    </div>
  );
}
