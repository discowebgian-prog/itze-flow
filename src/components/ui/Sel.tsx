/* eslint-disable */
// @ts-nocheck

export function Sel({ label, options, ...p }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--mut)',
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {label}
        </label>
      )}
      <select
        {...p}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-field)',
          background: 'var(--card)',
          color: 'var(--ink)',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
