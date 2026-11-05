/* eslint-disable */
// @ts-nocheck

export function Inp({ label, ...p }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 700,
            color: '#888',
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {label}
        </label>
      )}
      <input
        {...p}
        style={{
          width: '100%',
          padding: '9px 12px',
          border: '1.5px solid #E5E7EB',
          borderRadius: 8,
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
          ...(p.style || {}),
        }}
      />
    </div>
  );
}
