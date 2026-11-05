/* eslint-disable */
// @ts-nocheck

// ── MODAL ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, isMobile }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 12,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: isMobile ? '20px 20px 0 0' : '16px',
          width: '100%',
          maxWidth: isMobile ? '100%' : 520,
          maxHeight: '92vh',
          overflow: 'auto',
          boxShadow: '0 -4px 40px rgba(0,0,0,.18)',
        }}
      >
        {isMobile && (
          <div
            style={{
              width: 36,
              height: 4,
              background: '#E5E7EB',
              borderRadius: 2,
              margin: '12px auto 0',
            }}
          />
        )}
        <div
          style={{
            padding: isMobile ? '14px 20px 0' : '20px 24px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #F0F0F0',
            paddingBottom: 14,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: isMobile ? 16 : 17,
              color: '#111',
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: '#F3F4F6',
              border: 'none',
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: 'pointer',
              fontSize: 18,
              color: '#555',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{ padding: isMobile ? '16px 20px 32px' : '20px 24px 28px' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
