import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabase';

// Font
if (typeof document !== 'undefined' && !document.getElementById('gf')) {
  const l = document.createElement('link');
  l.id = 'gf';
  l.rel = 'stylesheet';
  l.href =
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
  document.head.appendChild(l);
}

const TODAY = new Date();
const fmt = (d) => {
  const y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, '0'),
    day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const fmtD = (s) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};
const fmtDT = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }) +
    ' ' +
    d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  );
};
const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const diffDays = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const parseD = (s) => {
  const [y, m, d] = s.split('-');
  return new Date(y, m - 1, d);
};
const currency = (n) => '$ ' + Number(n).toLocaleString('es-MX');
const MONTHS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function useW() {
  const [w, setW] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

const USERS = [
  {
    id: 'admin',
    name: 'Administrador',
    password: 'admin123',
    role: 'admin',
    ownedProps: [],
  },
  {
    id: 'staff',
    name: 'Staff',
    password: 'staff123',
    role: 'staff',
    ownedProps: ['hostel'],
  },
];
const PROPS = [
  {
    id: 'hostel',
    name: 'Itzé Hostel Boutique',
    type: 'hostel',
    ownerId: 'admin',
    color: '#E06C4F',
    emoji: '🏨',
    rooms: 6,
  },
];
const ROOMS = [
  { id: 'P1', name: 'P1', maxGuests: 5 },
  { id: 'P2', name: 'P2', maxGuests: 5 },
  { id: 'P3', name: 'P3', maxGuests: 6 },
  { id: 'P4', name: 'P4', maxGuests: 3 },
  { id: 'P5', name: 'P5', maxGuests: 5 },
  { id: 'P6', name: 'P6', maxGuests: 2 },
];
const SOURCES = [
  { value: 'Booking', label: 'Booking', short: 'Booking', color: '#003580' },
  {
    value: 'Directo-Puerta',
    label: 'Directo — Puerta',
    short: 'Por puerta',
    color: '#10B981',
  },
  {
    value: 'Directo-Celular',
    label: 'Directo — Celular',
    short: 'Por celular',
    color: '#059669',
  },
];
const srcShort = (v) => SOURCES.find((s) => s.value === v)?.short || v;
const srcLabel = (v) => SOURCES.find((s) => s.value === v)?.label || v;
const srcColor = (v) => SOURCES.find((s) => s.value === v)?.color || '#888';
const RS = {
  por_llegar: { bg: '#DBEAFE', txt: '#1E40AF', label: 'Por llegar' },
  hospedado: { bg: '#D1FAE5', txt: '#065F46', label: 'Hospedado' },
  finalizada: { bg: '#F3F4F6', txt: '#6B7280', label: 'Finalizada' },
  cancelada: { bg: '#FEE2E2', txt: '#991B1B', label: 'Cancelada' },
};
const PS = {
  libre: { label: 'Libre', color: '#10B981', bg: '#D1FAE5' },
  ocupado: { label: 'Ocupado', color: '#EF4444', bg: '#FEE2E2' },
};
const BLOCK_COLORS = {
  por_llegar: { bg: '#3B82F6', text: '#fff' },
  hospedado: { bg: '#10B981', text: '#fff' },
  finalizada: { bg: '#9CA3AF', text: '#fff' },
  cancelada: { bg: '#F87171', text: '#fff' },
};
const ALERTS = [
  {
    key: 'saldo',
    color: '#F59E0B',
    label: 'Saldo',
    check: (r) => r.paid < r.totalAmount && r.status !== 'cancelada',
  },
];
const getAlerts = (r) => ALERTS.filter((a) => a.check(r));

const INIT_RES = [
  {
    id: 'r1',
    propertyId: 'hostel',
    guestName: 'Lucía Torres',
    checkIn: fmt(addDays(TODAY, -3)),
    checkOut: fmt(addDays(TODAY, 3)),
    status: 'hospedado',
    totalAmount: 45000,
    paid: 45000,
    source: 'Booking',
    room: 'P1',
  },
];

// ── FALTANTES RECUPERADOS ─────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'MX', name: 'México', prefix: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', prefix: '+54', flag: '🇦🇷' },
  { code: 'CO', name: 'Colombia', prefix: '+57', flag: '🇨🇴' },
  { code: 'CL', name: 'Chile', prefix: '+56', flag: '🇨🇱' },
  { code: 'PE', name: 'Perú', prefix: '+51', flag: '🇵🇪' },
  { code: 'UY', name: 'Uruguay', prefix: '+598', flag: '🇺🇾' },
  { code: 'ES', name: 'España', prefix: '+34', flag: '🇪🇸' },
  { code: 'US', name: 'Estados Unidos', prefix: '+1', flag: '🇺🇸' },
];

const CHECKLIST = [
  'Cambio de sábanas y toallas',
  'Limpieza profunda de baño',
  'Barrido y trapeado de pisos',
  'Vaciado de basureros',
  'Reposición de papel y amenidades',
  'Revisión de luces y aire acondicionado',
];

const waLink = (phone, prefix, nationality) => {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/\D/g, '');
  const cleanPrefix = (prefix || '').replace(/\D/g, '');
  return `https://wa.me/${cleanPrefix}${cleanPhone}`;
};
// ── GUEST DB ──────────────────────────────────────────────────────────────────
function buildGuestDB(reservations) {
  const db = {};
  reservations
    .filter((r) => r.guestDoc)
    .forEach((r) => {
      const k = (r.guestDoc || '').replace(/\s+/g, '').toLowerCase();
      if (!db[k])
        db[k] = {
          doc: r.guestDoc,
          name: r.guestName,
          phone: r.guestPhone,
          email: r.guestEmail,
          stays: [],
          totalSpent: 0,
          firstStay: r.checkIn,
          lastStay: r.checkIn,
        };
      const g = db[k];
      g.stays.push(r.id);
      g.totalSpent += r.totalAmount || 0;
      if (r.checkIn < g.firstStay) g.firstStay = r.checkIn;
      if (r.checkIn > g.lastStay) {
        g.lastStay = r.checkIn;
        g.name = r.guestName;
      }
    });
  return db;
}
function freqBadge(n) {
  if (n >= 5) return { label: '⭐⭐ VIP', color: '#7C3AED', bg: '#EDE9FE' };
  if (n >= 3) return { label: '⭐ Frecuente', color: '#B45309', bg: '#FEF3C7' };
  if (n >= 2) return { label: '↩ Regresa', color: '#0369A1', bg: '#E0F2FE' };
  return null;
}

// ── OVERLAP ───────────────────────────────────────────────────────────────────
function findConflicts(all, propId, room, ci, co, excludeId) {
  if (!ci || !co || !propId) return [];
  const cid = parseD(ci),
    cod = parseD(co);
  return all.filter((r) => {
    // EL NUEVO ESCUDO: Ignora si es la misma reserva, si está cancelada, O si está en la papelera (deleted)
    if (
      r.id === excludeId ||
      r.status === 'cancelada' ||
      r.deleted === true ||
      r.propertyId !== propId
    )
      return false;
    if (room && r.room !== room) return false;
    return cid < parseD(r.checkOut) && cod > parseD(r.checkIn);
  });
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
const Badge = ({ status }) => {
  // EL SALVAVIDAS: Si el estado no existe en la lista, le pone un color gris por defecto y muestra el nombre en lugar de explotar.
  const s = RS[status] || { bg: '#F3F4F6', txt: '#6B7280', label: status || 'Desconocido' };
  
  return (
    <span
      style={{
        background: s.bg,
        color: s.txt,
        padding: '2px 9px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {s.label}
    </span>
  );
};
const Avatar = ({ name, size = 36 }) => {
  const ini = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const cols = [
    '#3B82F6',
    '#8B5CF6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#E06C4F',
  ];
  const c = cols[name.charCodeAt(0) % cols.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: c,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size * 0.36,
        flexShrink: 0,
      }}
    >
      {ini}
    </div>
  );
};

function Inp({ label, ...p }) {
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
function Sel({ label, options, ...p }) {
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
      <select
        {...p}
        style={{
          width: '100%',
          padding: '9px 12px',
          border: '1.5px solid #E5E7EB',
          borderRadius: 8,
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          background: '#fff',
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

// ── COUNTRY SELECTOR ──────────────────────────────────────────────────────────
function CountrySelector({ value, onChange }) {
  const country = COUNTRIES.find((c) => c.code === value) || COUNTRIES[0];
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const filtered =
    q.length > 0
      ? COUNTRIES.filter(
          (c) =>
            c.name.toLowerCase().includes(q.toLowerCase()) ||
            c.prefix.includes(q)
        ).slice(0, 8)
      : [];
  return (
    <div style={{ marginBottom: 12, position: 'relative' }}>
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
        Nacionalidad
      </label>
      <input
        value={open ? q : `${country.flag} ${country.name} (${country.prefix})`}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQ('');
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Buscar país..."
        style={{
          width: '100%',
          padding: '9px 12px',
          border: '1.5px solid #E5E7EB',
          borderRadius: 8,
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1.5px solid #E5E7EB',
            borderRadius: 8,
            zIndex: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            overflow: 'hidden',
            marginTop: 2,
          }}
        >
          {filtered.map((c) => (
            <div
              key={c.code}
              onMouseDown={() => {
                onChange(c);
                setOpen(false);
                setQ('');
              }}
              style={{
                padding: '9px 14px',
                cursor: 'pointer',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                fontSize: 13,
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = '#F0F7FF')
              }
              onMouseOut={(e) => (e.currentTarget.style.background = '#fff')}
            >
              <span style={{ fontSize: 18 }}>{c.flag}</span>
              <span style={{ flex: 1, fontWeight: 600, color: '#111' }}>
                {c.name}
              </span>
              <span style={{ color: '#9CA3AF', fontSize: 12 }}>{c.prefix}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, isMobile }) {
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

// ── DOC SCANNER ───────────────────────────────────────────────────────────────
function DocScanner({ onResult }) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [inputEl, setInputEl] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setSuccess(false);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      setScanning(true);
      try {
        const base64 = dataUrl.split(',')[1];
        const mt =
          file.type && file.type.startsWith('image/')
            ? file.type
            : 'image/jpeg';
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 400,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: { type: 'base64', media_type: mt, data: base64 },
                  },
                  {
                    type: 'text',
                    text: 'Extract identity document data. Return ONLY valid JSON:\n{"firstName":"","lastName":"","fullName":"","docNumber":"","docType":"INE","nationality":"MX"}\ndocType=INE|Pasaporte|Otro. nationality=2-letter ISO code. Leave empty if unclear.',
                  },
                ],
              },
            ],
          }),
        });
        if (!resp.ok) throw new Error('API ' + resp.status);
        const data = await resp.json();
        const raw =
          (data.content && data.content[0] && data.content[0].text) || '{}';
        const FENCE = String.fromCharCode(96, 96, 96);
        const clean = raw
          .split(FENCE + 'json')
          .join('')
          .split(FENCE)
          .join('')
          .trim();
        const parsed = JSON.parse(clean);
        if (!parsed.docNumber && !parsed.firstName && !parsed.fullName) {
          setError('No se detectaron datos. Usá buena iluminación.');
        } else {
          onResult(parsed);
          setSuccess(true);
        }
      } catch (err) {
        setError('Error al analizar. Intentá con imagen más clara.');
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      style={{
        marginBottom: 14,
        background: '#F0F9FF',
        border: '1.5px solid #BAE6FD',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <input
        ref={(el) => setInputEl(el)}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files[0]) handleFile(e.target.files[0]);
        }}
      />
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#0369A1',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 8,
        }}
      >
        Escanear documento de identidad
      </div>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => inputEl && inputEl.click()}
          disabled={scanning}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            background: scanning ? '#E0F2FE' : '#0369A1',
            border: 'none',
            borderRadius: 9,
            color: '#fff',
            fontFamily: 'inherit',
            fontWeight: 700,
            fontSize: 14,
            cursor: scanning ? 'not-allowed' : 'pointer',
            minWidth: 180,
            justifyContent: 'center',
          }}
        >
          📷{' '}
          {scanning
            ? 'Analizando...'
            : preview
            ? 'Nueva foto'
            : 'Tomar foto / Subir'}
        </button>
        {preview && (
          <img
            src={preview}
            alt="doc"
            style={{
              height: 52,
              borderRadius: 8,
              border: '2px solid #BAE6FD',
              objectFit: 'cover',
              maxWidth: 80,
            }}
          />
        )}
      </div>
      {scanning && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#0369A1' }}>
          ✦ Claude está leyendo el documento...
        </div>
      )}
      {success && !scanning && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: '#059669',
            fontWeight: 700,
          }}
        >
          ✓ Datos extraídos. Revisá y corregí si es necesario.
        </div>
      )}
      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#DC2626' }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

// ── CONFLICT WARNING ──────────────────────────────────────────────────────────
function ConflictWarn({ conflicts, properties }) {
  if (!conflicts || !conflicts.length) return null;
  return (
    <div
      style={{
        background: '#FEF2F2',
        border: '1.5px solid #FECACA',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 13,
          color: '#DC2626',
          marginBottom: 6,
        }}
      >
        ⚠️ Conflicto de disponibilidad
      </div>
      {conflicts.map((r) => {
        const p = properties.find((x) => x.id === r.propertyId);
        return (
          <div
            key={r.id}
            style={{
              fontSize: 12,
              color: '#7F1D1D',
              padding: '3px 0',
              borderTop: '1px solid #FECACA',
            }}
          >
            <b>{r.guestName}</b> · {fmtD(r.checkIn)} → {fmtD(r.checkOut)} ·{' '}
            {p?.name}
            {r.room ? ` Hab.${r.room}` : ''}
          </div>
        );
      })}
    </div>
  );
}
// ── RANGE CALENDAR ────────────────────────────────────────────────────────────
function RangeCalendar({ checkIn, checkOut, onChange }) {
  const [base, setBase] = useState(checkIn ? parseD(checkIn) : TODAY);
  const [hover, setHover] = useState(null);
  const [step, setStep] = useState(checkIn && checkOut ? 2 : 0);

  const y = base.getFullYear(),
    m = base.getMonth();
  const daysInMo = new Date(y, m + 1, 0).getDate();
  const firstDow = new Date(y, m, 1).getDay();
  const grid = Array(firstDow)
    .fill(null)
    .concat(Array.from({ length: daysInMo }, (_, i) => new Date(y, m, i + 1)));

  const clickD = (d) => {
    if (!d || d < parseD(fmt(TODAY))) return;
    const s = fmt(d);
    if (step === 0 || step === 2) {
      onChange(s, '');
      setStep(1);
    } else if (step === 1) {
      if (s <= checkIn) {
        onChange(s, '');
      } else {
        onChange(checkIn, s);
        setStep(2);
      }
    }
  };

  return (
    <div
      style={{
        background: '#fff',
        border: '1.5px solid #E5E7EB',
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setBase(new Date(y, m - 1, 1))}
          style={{
            border: 'none',
            background: '#F3F4F6',
            borderRadius: 8,
            width: 34,
            height: 34,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 16,
            color: '#555',
          }}
        >
          ◀
        </button>
        <div
          style={{
            fontWeight: 900,
            fontSize: 18,
            color: '#1E40AF',
            textTransform: 'capitalize',
            letterSpacing: 0.5,
          }}
        >
          {MONTHS[m]} {y}
        </div>
        <button
          type="button"
          onClick={() => setBase(new Date(y, m + 1, 1))}
          style={{
            border: 'none',
            background: '#F3F4F6',
            borderRadius: 8,
            width: 34,
            height: 34,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 16,
            color: '#555',
          }}
        >
          ▶
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
          textAlign: 'center',
          marginBottom: 6,
        }}
      >
        {DAYS.map((d) => (
          <div
            key={d}
            style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF' }}
          >
            {d.charAt(0)}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
          textAlign: 'center',
        }}
      >
        {grid.map((d, i) => {
          if (!d) return <div key={i} />;
          const s = fmt(d);
          const isPast = parseD(s) < parseD(fmt(TODAY));
          const isCI = s === checkIn;
          const isCO = s === checkOut;
          const isEnd = isCI || isCO;
          let inRange = false;
          if (checkIn && checkOut) inRange = s > checkIn && s < checkOut;
          else if (checkIn && hover && step === 1)
            inRange = s > checkIn && s <= hover;

          let bg = 'transparent',
            col = '#374151',
            radius = 8;
          if (isEnd) {
            bg = '#3B82F6';
            col = '#fff';
          } else if (inRange) {
            bg = '#DBEAFE';
            col = '#1E40AF';
            radius = 4;
          } else if (isPast) {
            col = '#D1D5DB';
          }

          return (
            <div
              key={i}
              onClick={() => clickD(d)}
              onMouseEnter={() => !isPast && step === 1 && setHover(s)}
              style={{
                aspectRatio: '1/1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: isEnd ? 800 : 600,
                background: bg,
                color: col,
                borderRadius: radius,
                cursor: isPast ? 'not-allowed' : 'pointer',
              }}
            >
              {d.getDate()}
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 14,
          fontSize: 12,
          fontWeight: 700,
          color: '#6B7280',
          background: '#F8FAFC',
          padding: '8px 12px',
          borderRadius: 8,
        }}
      >
        <div>
          CI: <span style={{ color: '#111' }}>{fmtD(checkIn)}</span>
        </div>
        <div>
          CO: <span style={{ color: '#111' }}>{fmtD(checkOut)}</span>
        </div>
      </div>
    </div>
  );
}
// ── RESERVATION FORM ──────────────────────────────────────────────────────────
function ResForm({
  initial,
  visibleProps,
  onSave,
  onClose,
  prefillProp,
  prefillDate,
  allRes = [],
}) {
  const blank = {
    propertyId: prefillProp || visibleProps[0]?.id || '',
    guestName: '',
    guestDoc: '',
    guestDocType: 'INE',
    guestPhone: '',
    guestPhonePrefix: '+52',
    guestNationality: 'MX',
    guestEmail: '',
    checkIn: prefillDate || fmt(TODAY),
    checkOut: fmt(addDays(TODAY, 3)),
    status: 'por_llegar',
    totalAmount: '',
    paid: '',
    paymentMethod: 'efectivo',
    source: 'Directo-Puerta',
    notes: '',
    room: '',
    totalGuests: 1,
    companions: [],
    requiresInvoice: false,
    pricing: {
      ratePerNight: '',
      rateLabel: '',
      discountType: 'ninguno',
      discountValue: '',
      discountReason: '',
      additionals: [],
      bonifications: [],
    },
  };
  const [f, setF] = useState(
    initial
      ? {
          ...blank,
          ...initial,
          companions: initial.companions || [],
          pricing: { ...blank.pricing, ...(initial.pricing || {}) },
        }
      : blank
  );
  const sv = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const nights = f.checkIn && f.checkOut ? diffDays(f.checkIn, f.checkOut) : 0;
  const isHostel = f.propertyId === 'hostel';
  const selRoom = isHostel ? ROOMS.find((r) => r.id === f.room) : null;
  const maxG = selRoom ? selRoom.maxGuests : isHostel ? 1 : 6;
  const addlCount = Math.max(0, f.totalGuests - 2);
  const conflicts = findConflicts(
    allRes,
    f.propertyId,
    f.room || '',
    f.checkIn,
    f.checkOut,
    initial?.id
  );
  const [confModal, setConfModal] = useState(null);

  const setTotalGuests = (n) => {
    sv('totalGuests', n);
    const need = n - 1,
      cur = f.companions;
    if (cur.length < need)
      sv('companions', [
        ...cur,
        ...Array(need - cur.length).fill({ name: '', doc: '' }),
      ]);
    else sv('companions', cur.slice(0, need));
    const adds = Math.max(0, n - 2);
    const curA = f.pricing.additionals || [];
    const nextA =
      adds > curA.length
        ? [
            ...curA,
            ...Array(adds - curA.length).fill({
              ratePerNight: 0,
              bonificada: false,
            }),
          ]
        : curA.slice(0, adds);
    sv('pricing', { ...f.pricing, additionals: nextA });
  };

  const calcTotal = () => {
    if (!f.pricing.ratePerNight || !nights) return 0;
    let b = f.pricing.ratePerNight * nights;
    if (f.pricing.discountType === 'porcentaje')
      b -= b * (f.pricing.discountValue / 100);
    else if (f.pricing.discountType === 'monto_fijo')
      b -= f.pricing.discountValue;
    else if (f.pricing.discountType === 'noche_gratis')
      b -= f.pricing.ratePerNight * f.pricing.discountValue;
    const addT = (f.pricing.additionals || []).reduce(
      (s, a) => s + (a.bonificada ? 0 : (a.ratePerNight || 0) * nights),
      0
    );
    return Math.max(0, b + addT);
  };

  const handleSave = () => {
    if (conflicts.length > 0) {
      setConfModal(() => () => {
        onSave(f);
        setConfModal(null);
      });
    } else onSave(f);
  };

  return (
    <div>
      <Sel
        label="Propiedad"
        value={f.propertyId}
        onChange={(e) => {
          sv('propertyId', e.target.value);
          sv('room', '');
          sv('companions', []);
          sv('totalGuests', 1);
        }}
        options={visibleProps.map((p) => ({ value: p.id, label: p.name }))}
      />
      {isHostel && (
        <Sel
          label="Habitación"
          value={f.room}
          onChange={(e) => {
            sv('room', e.target.value);
            sv('companions', []);
            sv('totalGuests', 1);
          }}
          options={[
            { value: '', label: '— Seleccionar habitación —' },
            ...ROOMS.map((r) => ({
              value: r.id,
              label: `${r.name} (hasta ${r.maxGuests} personas)`,
            })),
          ]}
        />
      )}
      <CountrySelector
        value={f.guestNationality}
        onChange={(c) => {
          sv('guestNationality', c.code);
          sv('guestPhonePrefix', c.prefix);
        }}
      />
      <DocScanner
        onResult={(ocr) => {
          if (ocr.fullName || ocr.firstName)
            sv(
              'guestName',
              ocr.fullName || (ocr.firstName + ' ' + ocr.lastName).trim()
            );
          if (ocr.docNumber) sv('guestDoc', ocr.docNumber);
          if (ocr.docType)
            sv(
              'guestDocType',
              ocr.docType === 'Pasaporte'
                ? 'Pasaporte'
                : ocr.docType === 'Otro'
                ? 'Otro'
                : 'INE'
            );
          if (ocr.nationality && ocr.nationality !== 'MX') {
            const c = COUNTRIES.find((x) => x.code === ocr.nationality);
            if (c) {
              sv('guestNationality', c.code);
              sv('guestPhonePrefix', c.prefix);
            }
          }
        }}
      />
      <Inp
        label="Nombre completo"
        value={f.guestName}
        onChange={(e) => sv('guestName', e.target.value)}
      />
      <div
        style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10 }}
      >
        <Sel
          label="Tipo doc."
          value={f.guestDocType}
          onChange={(e) => sv('guestDocType', e.target.value)}
          options={['INE', 'Pasaporte', 'Otro'].map((v) => ({
            value: v,
            label: v,
          }))}
        />
        <Inp
          label="Número de documento"
          value={f.guestDoc}
          onChange={(e) => sv('guestDoc', e.target.value)}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
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
          Teléfono
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={f.guestPhonePrefix}
            onChange={(e) => sv('guestPhonePrefix', e.target.value)}
            style={{
              width: 72,
              padding: '9px 12px',
              border: '1.5px solid #E5E7EB',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              textAlign: 'center',
              fontWeight: 700,
              boxSizing: 'border-box',
            }}
            placeholder="+52"
          />
          <input
            value={f.guestPhone}
            onChange={(e) => sv('guestPhone', e.target.value)}
            style={{
              flex: 1,
              padding: '9px 12px',
              border: '1.5px solid #E5E7EB',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            placeholder="55 1234 5678"
          />
        </div>
      </div>
      <Inp
        label="Email"
        value={f.guestEmail}
        onChange={(e) => sv('guestEmail', e.target.value)}
      />

      {/* AQUÍ ESTÁ EL NUEVO CALENDARIO CONECTADO */}
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 700,
          color: '#888',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        Fechas de estadía
      </label>
      <RangeCalendar
        checkIn={f.checkIn}
        checkOut={f.checkOut}
        onChange={(ci, co) => {
          sv('checkIn', ci);
          sv('checkOut', co);
        }}
      />

      {nights > 0 && (
        <p style={{ margin: '-4px 0 12px', fontSize: 12, color: '#6B7280' }}>
          {nights} noche{nights !== 1 ? 's' : ''}
        </p>
      )}
      <ConflictWarn conflicts={conflicts} properties={visibleProps} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Sel
          label="Estado"
          value={f.status}
          onChange={(e) => sv('status', e.target.value)}
          options={['por_llegar', 'hospedado', 'finalizada', 'cancelada'].map(
            (v) => ({ value: v, label: RS[v]?.label })
          )}
        />
        <Sel
          label="Canal"
          value={f.source}
          onChange={(e) => sv('source', e.target.value)}
          options={SOURCES.map((s) => ({ value: s.value, label: s.label }))}
        />
      </div>
      {(!isHostel || selRoom) && maxG > 1 && (
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 700,
              color: '#888',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            Total de huéspedes
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Array.from({ length: maxG }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTotalGuests(n)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  border: `2px solid ${
                    f.totalGuests === n ? '#3B82F6' : '#E5E7EB'
                  }`,
                  background: f.totalGuests === n ? '#EFF6FF' : '#fff',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  color: f.totalGuests === n ? '#1E40AF' : '#6B7280',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      {f.companions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 700,
              color: '#888',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            Acompañantes
          </label>
          {f.companions.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <input
                value={c.name}
                onChange={(e) =>
                  sv(
                    'companions',
                    f.companions.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x
                    )
                  )
                }
                placeholder={`Nombre ${i + 1}`}
                style={{
                  padding: '9px 12px',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <input
                value={c.doc}
                onChange={(e) =>
                  sv(
                    'companions',
                    f.companions.map((x, j) =>
                      j === i ? { ...x, doc: e.target.value } : x
                    )
                  )
                }
                placeholder="Documento"
                style={{
                  padding: '9px 12px',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginBottom: 16,
          background: '#F8FAFC',
          borderRadius: 10,
          padding: '14px 16px',
          border: '1px solid #E5E7EB',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 10,
          }}
        >
          Tarifa y beneficios
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
        >
          <Inp
            label="Tarifa base/noche $ (2p.)"
            type="number"
            value={f.pricing.ratePerNight}
            onChange={(e) =>
              sv('pricing', {
                ...f.pricing,
                ratePerNight:
                  e.target.value === '' ? '' : Number(e.target.value),
              })
            }
          />
          <Inp
            label="Etiqueta"
            value={f.pricing.rateLabel}
            onChange={(e) =>
              sv('pricing', { ...f.pricing, rateLabel: e.target.value })
            }
            placeholder="Tarifa rack"
          />
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
        >
          <Sel
            label="Descuento"
            value={f.pricing.discountType}
            onChange={(e) =>
              sv('pricing', { ...f.pricing, discountType: e.target.value })
            }
            options={[
              { value: 'ninguno', label: 'Sin descuento' },
              { value: 'porcentaje', label: '% Porcentaje' },
              { value: 'monto_fijo', label: '$ Monto fijo' },
              { value: 'noche_gratis', label: 'Noches gratis' },
            ]}
          />
          {f.pricing.discountType !== 'ninguno' && (
            <Inp
              label={
                f.pricing.discountType === 'porcentaje'
                  ? '%'
                  : f.pricing.discountType === 'noche_gratis'
                  ? 'Noches'
                  : '$'
              }
              type="number"
              value={f.pricing.discountValue}
              onChange={(e) =>
                sv('pricing', { ...f.pricing, discountValue: +e.target.value })
              }
            />
          )}
        </div>
        {f.pricing.discountType !== 'ninguno' && (
          <Inp
            label="Motivo"
            value={f.pricing.discountReason}
            onChange={(e) =>
              sv('pricing', { ...f.pricing, discountReason: e.target.value })
            }
            placeholder="Cliente frecuente..."
          />
        )}
        {addlCount > 0 && (
          <div
            style={{
              marginTop: 8,
              borderTop: '1px dashed #E5E7EB',
              paddingTop: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#6B7280',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Personas adicionales (desde 3ª)
            </div>
            {(f.pricing.additionals || []).slice(0, addlCount).map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px auto',
                  gap: 8,
                  marginBottom: 8,
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: a.bonificada ? '#F0FDF4' : '#fff',
                  borderRadius: 8,
                  border: `1px solid ${a.bonificada ? '#86EFAC' : '#E5E7EB'}`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  Persona adicional {i + 1}
                </div>
                <input
                  type="number"
                  value={a.ratePerNight === 0 ? '' : a.ratePerNight}
                  disabled={a.bonificada}
                  onChange={(e) => {
                    const ads = [...(f.pricing.additionals || [])];
                    ads[i] = { ...ads[i], ratePerNight: +e.target.value };
                    sv('pricing', { ...f.pricing, additionals: ads });
                  }}
                  placeholder="$/noche"
                  style={{
                    padding: '7px 9px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: 7,
                    fontSize: 12,
                    fontFamily: 'inherit',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    const ads = [...(f.pricing.additionals || [])];
                    ads[i] = { ...ads[i], bonificada: !ads[i].bonificada };
                    sv('pricing', { ...f.pricing, additionals: ads });
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `2px solid ${
                        a.bonificada ? '#22C55E' : '#D1D5DB'
                      }`,
                      background: a.bonificada ? '#22C55E' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {a.bonificada && (
                      <span
                        style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: a.bonificada ? '#15803D' : '#9CA3AF',
                    }}
                  >
                    Bonif.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {f.pricing.ratePerNight > 0 && nights > 0 && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: '#EFF6FF',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: '#374151' }}>
              Total calculado:{' '}
              <b style={{ color: '#1E40AF' }}>{currency(calcTotal())}</b>
            </span>
            <button
              type="button"
              onClick={() => sv('totalAmount', calcTotal())}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#1E40AF',
                background: '#DBEAFE',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          marginBottom: 16,
          background: '#F8FAFC',
          borderRadius: 10,
          padding: '14px 16px',
          border: '1px solid #E5E7EB',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 10,
          }}
        >
          Pago
        </div>
        <Sel
          label="Forma de pago"
          value={f.paymentMethod || 'efectivo'}
          onChange={(e) => sv('paymentMethod', e.target.value)}
          options={[
            { value: 'efectivo', label: 'Efectivo' },
            { value: 'transferencia', label: 'Transferencia' },
            { value: 'debito', label: 'Débito' },
            { value: 'credito', label: 'Crédito' },
            { value: 'otro', label: 'Otro' },
          ]}
        />
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
        >
          <Inp
            label="Monto total $"
            type="number"
            value={f.totalAmount}
            onChange={(e) =>
              sv(
                'totalAmount',
                e.target.value === '' ? '' : Number(e.target.value)
              )
            }
          />
          <Inp
            label="Monto pagado $"
            type="number"
            value={f.paid}
            onChange={(e) =>
              sv('paid', e.target.value === '' ? '' : Number(e.target.value))
            }
          />
        </div>
      </div>

      <div
        style={{
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: f.requiresInvoice ? '#EDE9FE' : '#F9FAFB',
          borderRadius: 10,
          border: `1.5px solid ${f.requiresInvoice ? '#A855F7' : '#E5E7EB'}`,
          cursor: 'pointer',
        }}
        onClick={() => sv('requiresInvoice', !f.requiresInvoice)}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            border: `2px solid ${f.requiresInvoice ? '#A855F7' : '#D1D5DB'}`,
            background: f.requiresInvoice ? '#A855F7' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {f.requiresInvoice && (
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>
              ✓
            </span>
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: f.requiresInvoice ? '#7C3AED' : '#374151',
            }}
          >
            Solicita factura
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>
            El huésped requiere comprobante fiscal
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
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
          Notas internas
        </label>
        <textarea
          value={f.notes}
          onChange={(e) => sv('notes', e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '9px 12px',
            border: '1.5px solid #E5E7EB',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: '12px',
            background: '#F3F4F6',
            border: 'none',
            borderRadius: 8,
            fontFamily: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
            color: '#555',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          style={{
            flex: 2,
            padding: '12px',
            background: conflicts.length > 0 ? '#DC2626' : '#3B82F6',
            border: 'none',
            borderRadius: 8,
            fontFamily: 'inherit',
            fontWeight: 700,
            cursor: 'pointer',
            color: '#fff',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {conflicts.length > 0 ? <Icon name="warning" size={18} /> : null}
          Guardar
          {conflicts.length > 0 ? ` (${conflicts.length} conflicto)` : ''}
        </button>
      </div>
      {confModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 380,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                background: '#DC2626',
                padding: '16px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="warning" size={20} color="#fff" />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Conflicto detectado
              </div>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
                Ya hay una reserva en esas fechas. ¿Guardar de todas formas?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#EFF6FF',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#1E40AF',
                  }}
                >
                  ← Corregir
                </button>
                <button
                  onClick={confModal}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#FEF2F2',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#DC2626',
                  }}
                >
                  Guardar igual
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DRAWER ────────────────────────────────────────────────────────────────────
function ResDrawer({
  res,
  onClose,
  onEdit,
  onDelete,
  properties,
  allRes,
  isMobile,
  onCheckIn,
  onCheckOut,
}) {
  const prop = properties.find((p) => p.id === res.propertyId);
  const saldo = res.totalAmount - res.paid;
  const nights = diffDays(res.checkIn, res.checkOut);
  const gdb = buildGuestDB(allRes);
  const gkey = (res.guestDoc || '').replace(/\s+/g, '').toLowerCase();
  const gp = gdb[gkey];
  const freq = gp ? freqBadge(gp.stays.length) : null;
  const pmLabel = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    debito: 'Débito',
    credito: 'Crédito',
    otro: 'Otro',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: isMobile ? 'flex-end' : 'flex-end',
        alignItems: isMobile ? 'stretch' : 'flex-start',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ background: 'rgba(0,0,0,.4)', position: 'absolute', inset: 0 }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'relative',
          width: isMobile ? '100vw' : 380,
          background: '#fff',
          height: isMobile ? 'auto' : '100%',
          maxHeight: isMobile ? '92vh' : '100%',
          overflowY: 'auto',
          boxShadow: isMobile
            ? '0 -4px 40px rgba(0,0,0,.15)'
            : '-8px 0 32px rgba(0,0,0,.15)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: isMobile ? '20px 20px 0 0' : '0',
        }}
      >
        {isMobile && (
          <div
            style={{
              width: 36,
              height: 4,
              background: '#E5E7EB',
              borderRadius: 2,
              margin: '12px auto 4px',
            }}
          />
        )}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #F0F0F0',
            background: prop?.color || '#3B82F6',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.7)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  marginBottom: 4,
                }}
              >
                {prop?.name}
                {res.room ? ` · Hab.${res.room}` : ''}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>
                {res.guestName}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,.2)',
                border: 'none',
                borderRadius: 8,
                width: 32,
                height: 32,
                cursor: 'pointer',
                fontSize: 18,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ padding: 20, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 16,
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <Badge status={res.status} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {freq && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: freq.color,
                    background: freq.bg,
                    padding: '2px 8px',
                    borderRadius: 20,
                  }}
                >
                  {freq.label}
                </span>
              )}
              <span style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: srcColor(res.source),
                    display: 'inline-block',
                    marginRight: 4,
                  }}
                />
                {srcLabel(res.source)}
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              ['Check-in', fmtD(res.checkIn)],
              ['Check-out', fmtD(res.checkOut)],
              ['Duración', nights + ' noche' + (nights !== 1 ? 's' : '')],
              ['Total', currency(res.totalAmount)],
            ].map(([l, v]) => (
              <div
                key={l}
                style={{
                  background: '#F9FAFB',
                  borderRadius: 10,
                  padding: '10px 14px',
                  border: '1px solid #F0F0F0',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: '#9CA3AF',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: 2,
                  }}
                >
                  {l}
                </div>
                <div style={{ fontWeight: 700, color: '#111' }}>{v}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: saldo > 0 ? '#FEF3C7' : '#D1FAE5',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: saldo > 0 ? '#92400E' : '#065F46',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Saldo pendiente
              </div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 20,
                  color: saldo > 0 ? '#B45309' : '#059669',
                }}
              >
                {currency(saldo)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>
                Pagado
              </div>
              <div style={{ fontWeight: 700 }}>{currency(res.paid)}</div>
              {res.paymentMethod && (
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  {pmLabel[res.paymentMethod] || res.paymentMethod}
                </div>
              )}
            </div>
          </div>
          {res.requiresInvoice && (
            <div
              style={{
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: '#7C3AED',
                fontWeight: 700,
                padding: '6px 12px',
                background: '#EDE9FE',
                borderRadius: 8,
              }}
            >
              <Icon name="invoice" size={16} /> Solicita factura
            </div>
          )}
          <div
            style={{
              background: '#F9FAFB',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 14,
              border: '1px solid #F0F0F0',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Datos del huésped
              </div>
              {freq && gp && gp.stays.length > 1 && (
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {gp.stays.length} estadías · {currency(gp.totalSpent)}
                </div>
              )}
            </div>
            {[
              ['Documento', (res.guestDocType || 'Doc') + ': ' + res.guestDoc],
              ['Teléfono', res.guestPhone],
              ['Email', res.guestEmail],
            ].map(
              ([l, v]) =>
                v && (
                  <div
                    key={l}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: '1px solid #F0F0F0',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: '#9CA3AF' }}>{l}</span>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span style={{ fontWeight: 600, color: '#374151' }}>
                        {v}
                      </span>
                      {l === 'Teléfono' && v && (
                        <a
                          href={waLink(
                            v,
                            res.guestPhonePrefix,
                            res.guestNationality
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: '#22C55E',
                            color: '#fff',
                            textDecoration: 'none',
                          }}
                          title="WhatsApp"
                        >
                          <Icon name="whatsapp" size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                )
            )}
          </div>
          {res.companions && res.companions.length > 0 && (
            <div
              style={{
                background: '#F9FAFB',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 14,
                border: '1px solid #F0F0F0',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Acompañantes ({res.companions.length})
              </div>
              {res.companions.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: '1px solid #F0F0F0',
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {c.name || `Acompañante ${i + 1}`}
                  </span>
                  <span style={{ color: '#9CA3AF' }}>{c.doc || '—'}</span>
                </div>
              ))}
            </div>
          )}
          {res.notes && (
            <div
              style={{
                background: '#FFFBEB',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 14,
                border: '1px solid #FDE68A',
                fontSize: 13,
                color: '#78350F',
                display: 'flex',
                gap: 6,
              }}
            >
              <Icon name="edit" size={16} /> {res.notes}
            </div>
          )}
          {(res.checkInAt || res.checkOutAt) && (
            <div
              style={{
                background: '#F8FAFC',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 11,
                color: '#6B7280',
                marginBottom: 14,
              }}
            >
              {res.checkInAt && (
                <div>
                  ⏱ <b>CI real:</b> {fmtDT(res.checkInAt)}
                </div>
              )}
              {res.checkOutAt && (
                <div>
                  ⏱ <b>CO real:</b> {fmtDT(res.checkOutAt)}
                </div>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #F0F0F0',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: '#FAFAFA',
          }}
        >
          {res.status === 'por_llegar' && (
            <button
              onClick={() => onCheckIn(res)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#10B981',
                border: 'none',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Icon name="checkIn" size={18} /> Hacer Check-in
            </button>
          )}
          {res.status === 'hospedado' && (
            <button
              onClick={() => onCheckOut(res)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#F59E0B',
                border: 'none',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Icon name="checkOut" size={18} /> Hacer Check-out
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onEdit(res)}
              style={{
                flex: 1,
                padding: '10px',
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Icon name="edit" size={16} /> Editar
            </button>
            <button
              onClick={() => onDelete(res.id)}
              style={{
                flex: 1,
                padding: '10px',
                background: '#FEF2F2',
                border: 'none',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Icon name="trash" size={16} /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CHECK-IN / CHECK-OUT MODALS ───────────────────────────────────────────────
function CIModal({ res, onConfirm, onCancel }) {
  const now = new Date();
  const isEarly = parseD(res.checkIn) > now;
  const isLate = fmt(now) > res.checkIn;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 380,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,.2)',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg,#10B981,#059669)',
            padding: '18px 22px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,.7)',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Check-in
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>
            {res.guestName}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,.8)',
              marginTop: 2,
            }}
          >
            {fmtD(res.checkIn)} → {fmtD(res.checkOut)}
          </div>
        </div>
        <div style={{ padding: '20px 22px' }}>
          {isEarly && (
            <div
              style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: '#92400E',
                marginBottom: 12,
              }}
            >
              ⚠️ Check-in anticipado — fecha reservada: {fmtD(res.checkIn)}
            </div>
          )}
          {isLate && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: '#991B1B',
                marginBottom: 12,
              }}
            >
              ⚠️ Check-in tardío — fecha reservada: {fmtD(res.checkIn)}
            </div>
          )}
          <div
            style={{
              background: '#F0FDF4',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 16,
              border: '1px solid #BBF7D0',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#15803D',
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              HORA DE INGRESO
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#15803D' }}>
              {now.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div style={{ fontSize: 11, color: '#86EFAC' }}>
              {now.toLocaleDateString('es-MX', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '11px',
                background: '#F3F4F6',
                border: 'none',
                borderRadius: 10,
                fontFamily: 'inherit',
                fontWeight: 700,
                cursor: 'pointer',
                color: '#555',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(new Date().toISOString())}
              style={{
                flex: 2,
                padding: '11px',
                background: 'linear-gradient(135deg,#10B981,#059669)',
                border: 'none',
                borderRadius: 10,
                fontFamily: 'inherit',
                fontWeight: 800,
                cursor: 'pointer',
                color: '#fff',
              }}
            >
              ✅ Confirmar CI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function COModal({ res, onConfirm, onCancel }) {
  const saldo = res.totalAmount - res.paid;
  const now = new Date();
  const isEarly = fmt(now) < res.checkOut;
  const newCO = fmt(now);
  const nights = isEarly
    ? diffDays(res.checkIn, newCO)
    : diffDays(res.checkIn, res.checkOut);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 380,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,.2)',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg,#F59E0B,#D97706)',
            padding: '18px 22px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,.7)',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Check-out
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>
            {res.guestName}
          </div>
        </div>
        <div style={{ padding: '20px 22px' }}>
          {isEarly && (
            <div
              style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12,
                color: '#92400E',
                marginBottom: 12,
              }}
            >
              <b>⚠️ Salida anticipada</b>
              <br />
              Check-out reservado: {fmtD(res.checkOut)}
              <br />
              Se acortará a {nights} noche{nights !== 1 ? 's' : ''} (hasta hoy)
            </div>
          )}
          {saldo > 0 && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12,
                color: '#991B1B',
                marginBottom: 12,
              }}
            >
              💰 Saldo pendiente: <b>{currency(saldo)}</b>
            </div>
          )}
          <div
            style={{
              background: '#FFFBEB',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 16,
              border: '1px solid #FDE68A',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#B45309',
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              HORA DE SALIDA
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#B45309' }}>
              {now.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '11px',
                background: '#F3F4F6',
                border: 'none',
                borderRadius: 10,
                fontFamily: 'inherit',
                fontWeight: 700,
                cursor: 'pointer',
                color: '#555',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() =>
                onConfirm(
                  new Date().toISOString(),
                  isEarly ? newCO : res.checkOut
                )
              }
              style={{
                flex: 2,
                padding: '11px',
                background: 'linear-gradient(135deg,#F59E0B,#D97706)',
                border: 'none',
                borderRadius: 10,
                fontFamily: 'inherit',
                fontWeight: 800,
                cursor: 'pointer',
                color: '#fff',
              }}
            >
              🚪 Confirmar CO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TIMELINE MOBILE ───────────────────────────────────────────────────────────
function TimelineMobile({ reservations, properties, onClickRes, onAddRes }) {
  const next14 = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i - 1));
  const dayRes = (d) =>
    reservations.filter(
      (r) =>
        r.status !== 'cancelada' &&
        parseD(r.checkIn) <= d &&
        d < parseD(r.checkOut)
    );
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}>
          Calendario
        </h2>
        <button
          onClick={() => onAddRes()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
            border: 'none',
            borderRadius: 9,
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Reserva
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {next14.map((d) => {
          const dRes = dayRes(d),
            isToday = fmt(d) === fmt(TODAY);
          return (
            <div
              key={fmt(d)}
              style={{
                background: isToday ? '#EFF6FF' : '#fff',
                borderRadius: 12,
                border: `1.5px solid ${isToday ? '#BFDBFE' : '#F0F0F0'}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isToday ? '#DBEAFE' : '#FAFAFA',
                  borderBottom: dRes.length > 0 ? '1px solid #F0F0F0' : 'none',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: isToday ? '#3B82F6' : '#E5E7EB',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: isToday ? 'rgba(255,255,255,.8)' : '#9CA3AF',
                      textTransform: 'uppercase',
                    }}
                  >
                    {DAYS[d.getDay()]}
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: isToday ? '#fff' : '#374151',
                    }}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: isToday ? '#1E40AF' : '#374151',
                    }}
                  >
                    {isToday ? 'Hoy — ' : ''}
                    {MONTHS[d.getMonth()]} {d.getFullYear()}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {dRes.length === 0
                      ? 'Libre'
                      : dRes.length === 1
                      ? '1 reserva activa'
                      : `${dRes.length} reservas`}
                  </div>
                </div>
              </div>
              {dRes.map((r) => {
                const p = properties.find((x) => x.id === r.propertyId);
                const bc = BLOCK_COLORS[r.status] || BLOCK_COLORS.por_llegar;
                const alerts = getAlerts(r);
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      borderBottom: '1px solid #F8FAFC',
                      cursor: 'pointer',
                    }}
                    onClick={() => onClickRes(r)}
                  >
                    <div
                      style={{
                        width: 4,
                        alignSelf: 'stretch',
                        borderRadius: 2,
                        background: bc.bg,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: '#111',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.guestName}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {p?.name}
                        {r.room ? ` · Hab.${r.room}` : ''}
                      </div>
                      {r.checkIn === fmt(d) && (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#059669',
                          }}
                        >
                          Check-in hoy
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 4,
                      }}
                    >
                      <Badge status={r.status} />
                      {alerts.length > 0 && (
                        <div style={{ display: 'flex', gap: 3 }}>
                          {alerts.map((a) => (
                            <div
                              key={a.key}
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 2,
                                background: a.color,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TIMELINE DESKTOP ──────────────────────────────────────────────────────────
function Timeline({
  reservations,
  properties,
  onClickRes,
  onAddRes,
  onUpdateRes,
  isMobile,
  calView,
  setCalView,
}) {
  const NCOLS = 21,
    COL = 44,
    ROW = 52,
    LABEL = 168,
    SH = 4;
  const [offset, setOffset] = useState(-2);
  const [drag, setDrag] = useState(null);
  const [dConf, setDConf] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [hdrDrag, setHdrDrag] = useState(null);
  const [gridEl, setGridEl] = useState(null);
  const lpt = useState(null);

  if (calView === 'lista')
    return (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <h2
            style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}
          >
            Calendario
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                background: '#F3F4F6',
                borderRadius: 9,
                padding: 3,
                gap: 2,
              }}
            >
              <button
                onClick={() => setCalView('lista')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  background: '#fff',
                  color: '#1E40AF',
                  boxShadow: '0 1px 3px rgba(0,0,0,.1)',
                }}
              >
                📋 Lista
              </button>
              <button
                onClick={() => setCalView('timeline')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: '#9CA3AF',
                }}
              >
                📅 Timeline
              </button>
            </div>
            <button
              onClick={() => onAddRes()}
              style={{
                padding: '6px 14px',
                background: '#3B82F6',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + Reserva
            </button>
          </div>
        </div>
        <TimelineMobile
          reservations={reservations}
          properties={properties}
          onClickRes={onClickRes}
          onAddRes={onAddRes}
        />
      </div>
    );

  const days = Array.from({ length: NCOLS }, (_, i) =>
    addDays(TODAY, offset + i)
  );
  const getCellBg = (d) => {
    const dow = new Date(d).getDay();
    if (fmt(d) === fmt(TODAY)) return '#EFF6FF';
    if (dow === 0 || dow === 6) return '#F9FAFB';
    return '#fff';
  };
  const rows = [];
  properties.forEach((p) => {
    if (p.type === 'hostel')
      ROOMS.forEach((r) => rows.push({ type: 'room', prop: p, room: r }));
    else rows.push({ type: 'prop', prop: p });
  });

  const getBlocks = (row) => {
    const pid = row.prop.id;
    const fn =
      row.type === 'room'
        ? (r) =>
            r.propertyId === pid &&
            r.room === row.room.id &&
            r.status !== 'cancelada'
        : (r) => r.propertyId === pid && r.status !== 'cancelada';
    const all = reservations.filter(fn);
    const ws = addDays(TODAY, offset),
      we = addDays(TODAY, offset + NCOLS);
    return all
      .map((r) => {
        if (parseD(r.checkOut) <= ws || parseD(r.checkIn) >= we) return null;

        // Evaluamos si el Check-in o Check-out real caen fuera del límite visual de la pantalla
        const cutLeft = parseD(r.checkIn) < ws;
        const cutRight = parseD(r.checkOut) > we;

        const cs = Math.max(0, diffDays(fmt(ws), r.checkIn)),
          ce = Math.min(NCOLS, diffDays(fmt(ws), r.checkOut));
        const pxL = cs * COL + (cutLeft ? 0 : COL / 2); // Si se corta a la izquierda, inicia recto en el borde del día (0)
        const pxR = ce * COL + (cutRight ? COL : COL / 2); // Si se corta a la derecha, termina recto al final del día (COL)

        return {
          ...r,
          colStart: cs,
          width: ce - cs,
          pxL,
          pxR,
          cutLeft,
          cutRight,
        };
      })
      .filter(Boolean);
  };

  const startDrag = (e, r, row) => {
    e.stopPropagation();
    const cx = e.touches ? e.touches[0].clientX : e.clientX,
      cy = e.touches ? e.touches[0].clientY : e.clientY;
    const gt = gridEl ? gridEl.getBoundingClientRect().top : 0;
    setDrag({
      id: r.id,
      guestName: r.guestName,
      orig: {
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        propId: row.prop.id,
        room: row.type === 'room' ? row.room.id : '',
      },
      startX: cx,
      startY: cy,
      startCol: r.colStart,
      origRowIdx: rows.indexOf(row),
      currentRowIdx: rows.indexOf(row),
      width: r.width,
      newPropId: row.prop.id,
      newRoom: row.type === 'room' ? row.room.id : '',
      newCheckIn: r.checkIn,
      gridTop: gt,
    });
  };

  const onMove = (e) => {
    if (drag) {
      const cx = e.touches ? e.touches[0].clientX : e.clientX,
        cy = e.touches ? e.touches[0].clientY : e.clientY;
      const cd = Math.round((cx - drag.startX) / COL);
      const ri = Math.max(
        0,
        Math.min(rows.length - 1, Math.floor((cy - drag.gridTop - 36) / ROW))
      );
      const nc = Math.max(0, Math.min(NCOLS - drag.width, drag.startCol + cd));
      const nr = rows[ri];
      setDrag((d) => ({
        ...d,
        currentCol: nc,
        currentRowIdx: ri,
        newPropId: nr.prop.id,
        newRoom: nr.type === 'room' ? nr.room.id : '',
        newCheckIn: fmt(addDays(addDays(TODAY, offset), nc)),
      }));
    }
    if (hdrDrag) {
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const dd = -Math.round((cx - hdrDrag.startX) / COL);
      setOffset(Math.max(-60, Math.min(60, hdrDrag.startOffset + dd)));
    }
  };

  const endDrag = () => {
    if (drag) {
      const ch =
        drag.newCheckIn !== drag.orig.checkIn ||
        drag.newPropId !== drag.orig.propId ||
        drag.newRoom !== drag.orig.room;
      if (ch) setDConf(drag);
      setDrag(null);
    }
    setHdrDrag(null);
  };

  const confDrag = (nci, nco, npid, nr) => {
    const confs = findConflicts(reservations, npid, nr, nci, nco, dConf.id);
    if (confs.length > 0) {
      setDConf((d) => ({ ...d, dragConflicts: confs }));
      return;
    }
    if (onUpdateRes)
      onUpdateRes(dConf.id, {
        checkIn: nci,
        checkOut: nco,
        propertyId: npid,
        room: nr,
      });
    setDConf(null);
  };

  const newCI = dConf?.newCheckIn;
  const newCO = dConf
    ? fmt(
        addDays(
          parseD(dConf.newCheckIn),
          diffDays(dConf.orig.checkIn, dConf.orig.checkOut)
        )
      )
    : null;

  return (
    <div
      onMouseMove={onMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchMove={(e) => {
        e.preventDefault();
        onMove(e);
      }}
      onTouchEnd={() => {
        endDrag();
        if (lpt[0]) {
          clearTimeout(lpt[0]);
          lpt[1](null);
        }
      }}
      style={{ userSelect: 'none' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}>
          Calendario
        </h2>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              background: '#F3F4F6',
              borderRadius: 9,
              padding: 3,
              gap: 2,
            }}
          >
            <button
              onClick={() => setCalView('lista')}
              style={{
                padding: '5px 11px',
                borderRadius: 7,
                border: 'none',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                background: 'transparent',
                color: '#9CA3AF',
              }}
            >
              📋 Lista
            </button>
            <button
              onClick={() => setCalView('timeline')}
              style={{
                padding: '5px 11px',
                borderRadius: 7,
                border: 'none',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                background: '#fff',
                color: '#1E40AF',
                boxShadow: '0 1px 3px rgba(0,0,0,.1)',
              }}
            >
              📅 Timeline
            </button>
          </div>
          <button
            onClick={() => setOffset((s) => s - 7)}
            style={{
              padding: '6px 12px',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              background: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            ← 7d
          </button>
          <button
            onClick={() => setOffset(-2)}
            style={{
              padding: '6px 12px',
              border: '1px solid #3B82F6',
              borderRadius: 8,
              background: '#EFF6FF',
              color: '#3B82F6',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            Hoy
          </button>
          <button
            onClick={() => setOffset((s) => s + 7)}
            style={{
              padding: '6px 12px',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              background: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            7d →
          </button>
          <button
            onClick={() => onAddRes()}
            style={{
              padding: '6px 14px',
              background: '#3B82F6',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Reserva
          </button>
        </div>
      </div>
      <div
        style={{
          overflowX: 'auto',
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          background: '#fff',
          cursor: drag ? 'grabbing' : hdrDrag ? 'grabbing' : 'grab',
        }}
      >
        <div
          ref={(el) => setGridEl(el)}
          style={{ minWidth: LABEL + COL * NCOLS, position: 'relative' }}
          onMouseDown={(e) => {
            e.preventDefault();
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            setHdrDrag({ startX: cx, startOffset: offset });
          }}
          onTouchStart={(e) => {
            const cx = e.touches[0].clientX;
            setHdrDrag({ startX: cx, startOffset: offset });
          }}
        >
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #E5E7EB',
              position: 'sticky',
              top: 0,
              zIndex: 20,
              background: '#F9FAFB',
              cursor: hdrDrag ? 'grabbing' : 'grab',
              touchAction: 'none',
            }}
          >
            <div
              style={{
                width: LABEL,
                flexShrink: 0,
                padding: '8px 14px',
                fontSize: 11,
                fontWeight: 700,
                color: '#9CA3AF',
                borderRight: '1px solid #E5E7EB',
                cursor: 'default',
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              PROPIEDAD / HAB.
            </div>
            {days.map((d, i) => {
              const it = fmt(d) === fmt(TODAY),
                dow = d.getDay();
              return (
                <div
                  key={i}
                  style={{
                    width: COL,
                    flexShrink: 0,
                    padding: '5px 2px',
                    textAlign: 'center',
                    borderRight: '1px solid #F0F0F0',
                    background: it ? '#DBEAFE' : getCellBg(d),
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      color: it ? '#1E40AF' : '#9CA3AF',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {DAYS[dow]}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: it ? 800 : 500,
                      color: it
                        ? '#1E40AF'
                        : dow === 0 || dow === 6
                        ? '#D1D5DB'
                        : '#374151',
                    }}
                  >
                    {d.getDate()}
                  </div>
                  {/* Ahora el mes se muestra siempre y se pinta de azul si es el día de hoy */}
                  <div
                    style={{
                      fontSize: 9,
                      color: it ? '#1E40AF' : '#9CA3AF',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {MONTHS[d.getMonth()]}
                  </div>
                </div>
              );
            })}
          </div>
          {rows.map((row, ri) => {
            const ilp = ri === 0 || rows[ri - 1].prop.id !== row.prop.id;
            const ilast =
              ri === rows.length - 1 || rows[ri + 1].prop.id !== row.prop.id;
            const pst = PS[row.prop._status] || PS.libre;
            const rk =
              row.type === 'room'
                ? `${row.prop.id}-${row.room.id}`
                : row.prop.id;
            const blocks = getBlocks(row);
            const ghost = drag && drag.currentRowIdx === ri ? drag : null;
            return (
              <div
                key={rk}
                style={{
                  display: 'flex',
                  borderBottom: ilast
                    ? '2px solid #D1D5DB'
                    : '1px solid #F0F0F0',
                  position: 'relative',
                  height: ROW,
                }}
              >
                <div
                  style={{
                    width: LABEL,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    borderRight: '1px solid #E5E7EB',
                    background: row.type === 'room' ? '#FAFAFA' : '#F3F4F6',
                    zIndex: 5,
                    borderLeft: `3px solid ${row.prop.color}`,
                  }}
                >
                  {row.type === 'room' ? (
                    <div style={{ width: '100%' }}>
                      {ilp && (
                        <div
                          style={{
                            fontSize: 9,
                            color: '#9CA3AF',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                            marginBottom: 1,
                          }}
                        >
                          {row.prop.name}
                        </div>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: '#111',
                          }}
                        >
                          {row.room.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: '#C4C4C4',
                            fontWeight: 600,
                          }}
                        >
                          ≤{row.room.maxGuests}p
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#111',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 130,
                        }}
                      >
                        {row.prop.emoji} {row.prop.name}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: pst.color,
                        }}
                      >
                        {pst.label}
                      </span>
                    </div>
                  )}
                </div>
                {days.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      width: COL,
                      flexShrink: 0,
                      height: '100%',
                      borderRight: '1px solid #F0F0F0',
                      background:
                        fmt(d) === fmt(TODAY) ? '#F0F7FF' : getCellBg(d),
                      cursor: hdrDrag ? 'grabbing' : 'cell',
                    }}
                    onDoubleClick={() => {
                      if (!drag && !hdrDrag) onAddRes(row.prop.id, fmt(d));
                    }}
                    onTouchEnd={(e) => {
                      if (drag || hdrDrag) return;
                      const n = Date.now();
                      if (
                        e.currentTarget._lt &&
                        n - e.currentTarget._lt < 350
                      ) {
                        e.preventDefault();
                        onAddRes(row.prop.id, fmt(d));
                        e.currentTarget._lt = 0;
                      } else {
                        e.currentTarget._lt = n;
                      }
                    }}
                  />
                ))}
                {ghost && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      height: ROW - SH * 3 - 10,
                      left: LABEL + ghost.currentCol * COL + 2,
                      width: ghost.width * COL - 4,
                      borderRadius: 6,
                      background: 'rgba(59,130,246,.2)',
                      border: '2px dashed #3B82F6',
                      zIndex: 6,
                      pointerEvents: 'none',
                    }}
                  />
                )}
                {blocks.map((r) => {
                  const bc = BLOCK_COLORS[r.status] || BLOCK_COLORS.por_llegar;
                  const alerts = getAlerts(r);
                  const H = ROW - 12 - alerts.length * SH;
                  const W = Math.max(4, r.pxR - r.pxL - 4);
                  const isDrag = drag && drag.id === r.id;
                  const cid = `c${r.id}`;
                  const tx = r.cutLeft ? 8 : Math.min(14, W * 0.2) + 4;

                  // Creamos los puntos del polígono dinámicamente según si está cortado o no
                  const D = Math.min(10, W * 0.25);
                  const ptTopLeft = r.cutLeft ? '0,0' : `${D},0`;
                  const ptTopRight = r.cutRight ? `${W},0` : `${W},0`; // El tope derecho siempre es plano en check-out
                  const ptBottomRight = r.cutRight
                    ? `${W},${H}`
                    : `${W - D},${H}`; // Si se corta a la derecha, baja recto
                  const ptBottomLeft = r.cutLeft ? `0,${H}` : `0,${H}`; // El fondo izquierdo siempre es plano en check-in
                  const cp = `${ptTopLeft} ${ptTopRight} ${ptBottomRight} ${ptBottomLeft}`;

                  return (
                    <div
                      key={r.id}
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: LABEL + r.pxL + 2,
                        width: W,
                        zIndex: isDrag ? 10 : 4,
                        opacity: isDrag ? 0.3 : 1,
                        touchAction: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isMobile)
                          setTooltip({ r, x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onMouseMove={(e) => {
                        if (!isMobile && tooltip)
                          setTooltip({ r, x: e.clientX, y: e.clientY });
                      }}
                      onMouseDown={(e) => {
                        setTooltip(null);
                        startDrag(e, r, row);
                      }}
                      onTouchStart={(e) => startDrag(e, r, row)}
                      onClick={(e) => {
                        if (!drag) {
                          e.stopPropagation();
                          onClickRes(r);
                        }
                      }}
                    >
                      {W > 12 ? (
                        <svg
                          width={W}
                          height={H}
                          style={{
                            display: 'block',
                            overflow: 'visible',
                            cursor: 'grab',
                            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.18))',
                          }}
                        >
                          <defs>
                            <clipPath id={cid}>
                              <polygon points={cp} />
                            </clipPath>
                          </defs>
                          <rect
                            x={0}
                            y={0}
                            width={W}
                            height={H}
                            fill={bc.bg}
                            clipPath={`url(#${cid})`}
                            rx={r.cutLeft ? 0 : 4}
                          />
                          {/* Línea 1: Nombre del Huésped */}
                          <text
                            x={tx}
                            y={H / 2 - 2}
                            fontSize={10}
                            fontWeight={700}
                            fill={bc.text}
                            style={{
                              fontFamily: 'system-ui,sans-serif',
                              pointerEvents: 'none',
                            }}
                            clipPath={`url(#${cid})`}
                          >
                            {r.guestName}
                            {r.companions?.length > 0
                              ? ` +${r.companions.length}`
                              : ''}{' '}
                            ({srcShort(r.source)})
                          </text>
                          {/* Línea 2: Fechas de Check-in y Check-out */}
                          <text
                            x={tx}
                            y={H / 2 + 10}
                            fontSize={8}
                            fontWeight={600}
                            fill={bc.text}
                            style={{
                              fontFamily: 'system-ui,sans-serif',
                              pointerEvents: 'none',
                              opacity: 0.85,
                            }}
                            clipPath={`url(#${cid})`}
                          >
                            {fmtD(r.checkIn).slice(0, 5)} al{' '}
                            {fmtD(r.checkOut).slice(0, 5)}
                          </text>
                        </svg>
                      ) : (
                        <div
                          style={{
                            height: H,
                            borderRadius:
                              alerts.length > 0 ? '5px 5px 0 0' : '5px',
                            background: bc.bg,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            paddingLeft: 8,
                            overflow: 'hidden',
                            boxShadow: '0 1px 3px rgba(0,0,0,.15)',
                            cursor: 'grab',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: bc.text,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              pointerEvents: 'none',
                              lineHeight: '1.2',
                            }}
                          >
                            {r.guestName} ({srcShort(r.source)})
                          </span>
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 600,
                              color: bc.text,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              pointerEvents: 'none',
                              lineHeight: '1.2',
                              opacity: 0.85,
                            }}
                          >
                            {fmtD(r.checkIn).slice(0, 5)} al{' '}
                            {fmtD(r.checkOut).slice(0, 5)}
                          </span>
                        </div>
                      )}
                      {alerts.length > 0 && (
                        <div
                          style={{
                            overflow: 'hidden',
                            borderRadius: '0 0 4px 4px',
                          }}
                        >
                          {alerts.map((a) => (
                            <div
                              key={a.key}
                              style={{ height: SH, background: a.color }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#9CA3AF',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Estado:
        </span>
        {Object.entries(BLOCK_COLORS).map(([k, v]) => (
          <div
            key={k}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: '#374151',
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: v.bg,
              }}
            />
            {RS[k]?.label || k}
          </div>
        ))}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#9CA3AF',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Alertas:
        </span>
        {ALERTS.map((a) => (
          <div
            key={a.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: '#374151',
            }}
          >
            <div
              style={{
                width: 18,
                height: 4,
                borderRadius: 2,
                background: a.color,
              }}
            />
            {a.label}
          </div>
        ))}
      </div>
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(tooltip.x + 12, window.innerWidth - 220),
            top: Math.max(tooltip.y - 10, 8),
            zIndex: 500,
            background: '#1E293B',
            borderRadius: 10,
            padding: '10px 14px',
            boxShadow: '0 8px 32px rgba(0,0,0,.35)',
            width: 210,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 13,
              color: '#fff',
              marginBottom: 4,
            }}
          >
            {tooltip.r.guestName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,.5)',
              marginBottom: 8,
            }}
          >
            {fmtD(tooltip.r.checkIn)} → {fmtD(tooltip.r.checkOut)} ·{' '}
            {diffDays(tooltip.r.checkIn, tooltip.r.checkOut)}n
          </div>
          {getAlerts(tooltip.r).map((a) => (
            <div
              key={a.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 11,
                marginBottom: 3,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: a.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: 'rgba(255,255,255,.85)', fontWeight: 600 }}>
                {a.label}
              </span>
              {a.key === 'saldo' && (
                <span
                  style={{
                    color: '#FCA5A5',
                    marginLeft: 'auto',
                    fontWeight: 700,
                  }}
                >
                  {currency(tooltip.r.totalAmount - tooltip.r.paid)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {dConf && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 400,
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
              overflow: 'hidden',
            }}
          >
            <div style={{ background: '#1E293B', padding: '18px 22px' }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.5)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Confirmar cambio
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>
                {dConf.guestName}
              </div>
            </div>
            <div style={{ padding: '20px 22px' }}>
              {dConf.newCheckIn !== dConf.orig.checkIn && (
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: '#9CA3AF',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Cambio de fechas
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {fmtD(dConf.orig.checkIn)} →{' '}
                    <b style={{ color: '#1E40AF' }}>{fmtD(newCI)}</b>
                  </div>
                </div>
              )}
              {(dConf.newPropId !== dConf.orig.propId ||
                dConf.newRoom !== dConf.orig.room) && (
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: '#9CA3AF',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Cambio de habitación
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {dConf.orig.propId} {dConf.orig.room} →{' '}
                    <b style={{ color: '#1E40AF' }}>
                      {dConf.newPropId} {dConf.newRoom}
                    </b>
                  </div>
                </div>
              )}
              {dConf.dragConflicts?.length > 0 && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 8,
                    padding: '10px 12px',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      color: '#DC2626',
                      marginBottom: 4,
                    }}
                  >
                    ⚠️ Conflicto en el destino
                  </div>
                  {dConf.dragConflicts.map((r) => (
                    <div key={r.id} style={{ fontSize: 11, color: '#7F1D1D' }}>
                      {r.guestName} · {fmtD(r.checkIn)} → {fmtD(r.checkOut)}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => setDConf(null)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 10,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#555',
                    fontSize: 14,
                  }}
                >
                  Cancelar
                </button>
                {(!dConf.dragConflicts || !dConf.dragConflicts.length) && (
                  <button
                    onClick={() =>
                      confDrag(newCI, newCO, dConf.newPropId, dConf.newRoom)
                    }
                    style={{
                      flex: 2,
                      padding: '11px',
                      background: '#10B981',
                      border: 'none',
                      borderRadius: 10,
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#fff',
                      fontSize: 14,
                    }}
                  >
                    ✓ Confirmar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({
  user,
  reservations,
  properties,
  propStatus,
  setPropStatus,
  onGoTo,
}) {
  const isNow = (r) => parseD(r.checkIn) <= TODAY && TODAY < parseD(r.checkOut);
  const active = reservations.filter(isNow);
  const ciToday = reservations.filter((r) => r.checkIn === fmt(TODAY));
  const coToday = reservations.filter((r) => r.checkOut === fmt(TODAY));
  const pending = reservations.filter(
    (r) => r.status !== 'cancelada' && r.paid < r.totalAmount
  );
  const totalRev = reservations
    .filter((r) => r.status !== 'cancelada')
    .reduce((s, r) => s + r.totalAmount, 0);
  const totalPaid = reservations
    .filter((r) => r.status !== 'cancelada')
    .reduce((s, r) => s + r.paid, 0);
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            margin: '0 0 3px',
            fontSize: 22,
            fontWeight: 800,
            color: '#111',
          }}
        >
          Panel general
        </h2>
        <p style={{ margin: 0, color: '#9CA3AF', fontSize: 13 }}>
          {TODAY.toLocaleDateString('es-MX', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))',
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: 'Check-ins hoy',
            val: ciToday.length,
            icon: '📥',
            col: '#3B82F6',
            bg: '#EFF6FF',
          },
          {
            label: 'Check-outs hoy',
            val: coToday.length,
            icon: '📤',
            col: '#F59E0B',
            bg: '#FFFBEB',
          },
          {
            label: 'En casa',
            val: active.length,
            icon: '🛏️',
            col: '#10B981',
            bg: '#ECFDF5',
          },
          {
            label: 'Saldos pend.',
            val: pending.length,
            icon: '💰',
            col: '#EF4444',
            bg: '#FEF2F2',
          },
          {
            label: 'Ocupación',
            val:
              properties.length > 0
                ? Math.round((active.length / properties.length) * 100) + '%'
                : '0%',
            icon: '📊',
            col: '#8B5CF6',
            bg: '#EDE9FE',
          },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '16px',
              border: '1px solid #F0F0F0',
              boxShadow: '0 1px 3px rgba(0,0,0,.05)',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.col }}>
              {k.val}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                marginTop: 3,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              {k.label}
            </div>
          </div>
        ))}
      </div>
      {/* Solo mostramos finanzas si no es staff */}
      {user.role !== 'staff' && (
        <div
          style={{
            background: '#0F172A',
            borderRadius: 14,
            padding: '20px 24px',
            marginBottom: 20,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 20,
          }}
        >
          {[
            ['FACTURADO', totalRev, '#fff'],
            ['COBRADO', totalPaid, '#34D399'],
            ['PENDIENTE', totalRev - totalPaid, '#FCA5A5'],
          ].map(([l, v, c]) => (
            <div key={l}>
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,.4)',
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                {l}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c }}>
                {currency(v)}
              </div>
            </div>
          ))}
        </div>
      )}
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: 15,
          fontWeight: 700,
          color: '#374151',
        }}
      >
        Estado de propiedades
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
          gap: 10,
          marginBottom: 20,
        }}
      >
        {properties.map((prop) => {
          const pst = PS[propStatus[prop.id]] || PS.libre;
          const cur = reservations.find(
            (r) =>
              r.propertyId === prop.id &&
              parseD(r.checkIn) <= TODAY &&
              TODAY < parseD(r.checkOut)
          );
          return (
            <div
              key={prop.id}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 16,
                border: '1px solid #F0F0F0',
                cursor: 'pointer',
              }}
              onClick={() => onGoTo('propiedades', prop.id)}
              onMouseOver={(e) =>
                (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)')
              }
              onMouseOut={(e) => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 24 }}>{prop.emoji}</span>
                <select
                  value={propStatus[prop.id] || 'libre'}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    setPropStatus((s) => ({ ...s, [prop.id]: e.target.value }));
                  }}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: pst.color,
                    background: pst.bg,
                    border: 'none',
                    borderRadius: 8,
                    padding: '3px 6px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {Object.entries(PS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#111',
                  marginBottom: 3,
                }}
              >
                {prop.name}
              </div>
              {cur ? (
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                  👤 {cur.guestName}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#D1D5DB' }}>
                  Sin huésped
                </div>
              )}
            </div>
          );
        })}
      </div>
      {ciToday.length + coToday.length > 0 && (
        <>
          <h3
            style={{
              margin: '0 0 12px',
              fontSize: 15,
              fontWeight: 700,
              color: '#374151',
            }}
          >
            Movimientos de hoy
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ...ciToday.map((r) => ({ ...r, type: 'in' })),
              ...coToday.map((r) => ({ ...r, type: 'out' })),
            ].map((r) => {
              const prop = PROPS.find((p) => p.id === r.propertyId);
              return (
                <div
                  key={r.id + r.type}
                  style={{
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    border: '1px solid #F0F0F0',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: r.type === 'in' ? '#D1FAE5' : '#FEE2E2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                  >
                    {r.type === 'in' ? '📥' : '📤'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ fontWeight: 700, fontSize: 13, color: '#111' }}
                    >
                      {r.guestName}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {prop?.name} ·{' '}
                      {r.type === 'in' ? 'Check-in' : 'Check-out'}
                    </div>
                  </div>
                  <Badge status={r.status} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── PROPERTIES PAGE ───────────────────────────────────────────────────────────
function PropertiesPage({
  properties,
  reservations,
  notes,
  setNotes,
  checklists,
  setChecklists,
  propStatus,
  setPropStatus,
  initProp,
}) {
  const [ap, setAp] = useState(initProp || properties[0]?.id);
  const [sub, setSub] = useState('info');
  const [editNote, setEditNote] = useState(false);
  const prop = properties.find((p) => p.id === ap);
  const propRes = reservations
    .filter((r) => r.propertyId === ap)
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const cl = checklists[ap] || {};
  const done = Object.values(cl).filter(Boolean).length;
  return (
    <div>
      <h2
        style={{
          margin: '0 0 16px',
          fontSize: 20,
          fontWeight: 800,
          color: '#111',
        }}
      >
        Propiedades
      </h2>
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          marginBottom: 18,
          paddingBottom: 4,
        }}
      >
        {properties.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setAp(p.id);
              setSub('info');
            }}
            style={{
              flexShrink: 0,
              padding: '7px 14px',
              borderRadius: 20,
              border: `1.5px solid ${ap === p.id ? p.color : '#E5E7EB'}`,
              background: ap === p.id ? p.color + '18' : '#fff',
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              color: ap === p.id ? '#111' : '#9CA3AF',
              whiteSpace: 'nowrap',
            }}
          >
            {p.emoji} {p.name}
          </button>
        ))}
      </div>
      {prop && (
        <>
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 14,
              border: '1px solid #F0F0F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 28 }}>{prop.emoji}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>
                  {prop.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#9CA3AF',
                    textTransform: 'capitalize',
                  }}
                >
                  {prop.type}
                </div>
              </div>
            </div>
            <select
              value={propStatus[ap] || 'libre'}
              onChange={(e) =>
                setPropStatus((s) => ({ ...s, [ap]: e.target.value }))
              }
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: PS[propStatus[ap]]?.color,
                background: PS[propStatus[ap]]?.bg,
                border: 'none',
                borderRadius: 8,
                padding: '6px 10px',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {Object.entries(PS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {['info', 'reservas', 'notas', 'limpieza'].map((t) => (
              <button
                key={t}
                onClick={() => setSub(t)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  background: sub === t ? '#1E293B' : '#F3F4F6',
                  color: sub === t ? '#fff' : '#6B7280',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {sub === 'info' && (
            <div>
              {(() => {
                const r = propRes.find(
                  (x) =>
                    parseD(x.checkIn) <= TODAY && TODAY < parseD(x.checkOut)
                );
                return r ? (
                  <div
                    style={{
                      background: `linear-gradient(135deg,${prop.color},${prop.color}cc)`,
                      borderRadius: 12,
                      padding: '16px 20px',
                      marginBottom: 14,
                      color: '#fff',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        opacity: 0.7,
                        marginBottom: 6,
                      }}
                    >
                      Huésped actual
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>
                      {r.guestName}
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 12, marginTop: 3 }}>
                      {fmtD(r.checkIn)} → {fmtD(r.checkOut)} · {r.guestPhone}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <span
                        style={{
                          background: 'rgba(255,255,255,.2)',
                          borderRadius: 8,
                          padding: '3px 10px',
                          fontSize: 11,
                        }}
                      >
                        Saldo: {currency(r.totalAmount - r.paid)}
                      </span>
                    </div>
                  </div>
                ) : null;
              })()}
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: '16px 20px',
                  border: '1px solid #F0F0F0',
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: '#374151',
                    marginBottom: 12,
                  }}
                >
                  Últimas reservas
                </div>
                {propRes.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #F9FAFB',
                    }}
                  >
                    <div>
                      <div
                        style={{ fontWeight: 600, fontSize: 13, color: '#111' }}
                      >
                        {r.guestName}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {fmtD(r.checkIn)} → {fmtD(r.checkOut)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Badge status={r.status} />
                      <div
                        style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}
                      >
                        {currency(r.totalAmount)}
                      </div>
                    </div>
                  </div>
                ))}
                {propRes.length === 0 && (
                  <div
                    style={{
                      color: '#D1D5DB',
                      fontSize: 13,
                      textAlign: 'center',
                      padding: 20,
                    }}
                  >
                    Sin reservas
                  </div>
                )}
              </div>
            </div>
          )}
          {sub === 'reservas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {propRes.map((r) => (
                <div
                  key={r.id}
                  style={{
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 16px',
                    border: '1px solid #F0F0F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {r.guestName}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {fmtD(r.checkIn)} → {fmtD(r.checkOut)} ·{' '}
                      {currency(r.totalAmount)}
                    </div>
                  </div>
                  <Badge status={r.status} />
                </div>
              ))}
              {propRes.length === 0 && (
                <div
                  style={{
                    color: '#D1D5DB',
                    fontSize: 13,
                    textAlign: 'center',
                    padding: 30,
                  }}
                >
                  Sin reservas
                </div>
              )}
            </div>
          )}
          {sub === 'notas' && (
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 20,
                border: '1px solid #F0F0F0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}
                >
                  Notas internas
                </div>
                <button
                  onClick={() => setEditNote((x) => !x)}
                  style={{
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 8,
                    padding: '5px 12px',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    color: '#555',
                  }}
                >
                  {editNote ? 'Cerrar' : '✏️ Editar'}
                </button>
              </div>
              {editNote ? (
                <div>
                  <textarea
                    value={notes[ap] || ''}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [ap]: e.target.value }))
                    }
                    rows={8}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1.5px solid #E5E7EB',
                      borderRadius: 8,
                      fontSize: 13,
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    onClick={() => setEditNote(false)}
                    style={{
                      marginTop: 8,
                      background: '#3B82F6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '9px 18px',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    color: '#374151',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.7,
                  }}
                >
                  {notes[ap] || 'Sin notas.'}
                </pre>
              )}
            </div>
          )}
          {sub === 'limpieza' && (
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 20,
                border: '1px solid #F0F0F0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <div>
                  <div
                    style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}
                  >
                    Checklist
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {done}/{CHECKLIST.length} completados
                  </div>
                </div>
                <button
                  onClick={() => setChecklists((c) => ({ ...c, [ap]: {} }))}
                  style={{
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: 'none',
                    borderRadius: 8,
                    padding: '5px 12px',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  ↺ Reiniciar
                </button>
              </div>
              <div
                style={{
                  height: 4,
                  background: '#F3F4F6',
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: '#10B981',
                    borderRadius: 4,
                    width:
                      CHECKLIST.length > 0
                        ? Math.round((done / CHECKLIST.length) * 100) + '%'
                        : '0%',
                    transition: 'width .3s',
                  }}
                />
              </div>
              {CHECKLIST.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid #F9FAFB',
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    setChecklists((c) => ({
                      ...c,
                      [ap]: { ...cl, [i]: !cl[i] },
                    }))
                  }
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      border: `1.5px solid ${cl[i] ? '#10B981' : '#D1D5DB'}`,
                      background: cl[i] ? '#10B981' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {cl[i] && (
                      <span
                        style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      color: cl[i] ? '#D1D5DB' : '#374151',
                      textDecoration: cl[i] ? 'line-through' : 'none',
                    }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── GUESTS PAGE ───────────────────────────────────────────────────────────────
function GuestsPage({ reservations, properties, onView }) {
  const [q, setQ] = useState('');
  const all = reservations.filter(
    (r) => !q || r.guestName.toLowerCase().includes(q.toLowerCase())
  );
  const unique = [...new Map(all.map((r) => [r.guestName, r])).values()];
  const gdb = buildGuestDB(reservations);
  return (
    <div>
      <h2
        style={{
          margin: '0 0 16px',
          fontSize: 20,
          fontWeight: 800,
          color: '#111',
        }}
      >
        Huéspedes
      </h2>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar huésped..."
        style={{
          width: '100%',
          padding: '10px 14px',
          border: '1.5px solid #E5E7EB',
          borderRadius: 10,
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          marginBottom: 14,
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {unique.map((r) => {
          const stays = all.filter((x) => x.guestName === r.guestName);
          const prop = properties.find((p) => p.id === r.propertyId);
          const gk = (r.guestDoc || '').replace(/\s+/g, '').toLowerCase();
          const gp = gdb[gk];
          const freq = gp ? freqBadge(gp.stays.length) : null;
          return (
            <div
              key={r.id}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '14px 18px',
                border: '1px solid #F0F0F0',
                cursor: 'pointer',
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}
              onClick={() => onView(r)}
            >
              <Avatar name={r.guestName} size={40} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 2,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                    {r.guestName}
                  </div>
                  {freq && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: freq.color,
                        background: freq.bg,
                        padding: '1px 7px',
                        borderRadius: 12,
                      }}
                    >
                      {freq.label}
                    </span>
                  )}
                </div>
                {/* NUEVO: Fechas de Check-in y Check-out agregadas abajo del nombre */}
                <div
                  style={{
                    fontSize: 12,
                    color: '#2563EB',
                    fontWeight: 600,
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>📅</span>
                  <span>
                    {fmtD(r.checkIn)} al {fmtD(r.checkOut)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#9CA3AF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{r.guestDoc}</span>
                  {r.guestPhone && (
                    <>
                      <span>·</span>
                      <span>{r.guestPhone}</span>
                      <a
                        href={waLink(
                          r.guestPhone,
                          r.guestPhonePrefix,
                          r.guestNationality
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          background: '#22C55E',
                          textDecoration: 'none',
                        }}
                        title="WhatsApp"
                      >
                        💬
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {prop?.emoji} {prop?.name}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  {stays.length} estadía{stays.length !== 1 ? 's' : ''}
                </div>
                <Badge status={r.status} />
              </div>
            </div>
          );
        })}
        {unique.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#D1D5DB',
              padding: 40,
              fontSize: 13,
            }}
          >
            Sin resultados
          </div>
        )}
      </div>
    </div>
  );
}

// ── EXPORT EXCEL ──────────────────────────────────────────────────────────────
async function exportToExcel(reservations, properties) {
  // 1. Traemos el historial de eliminadas directo desde Supabase
  const { data: eliminadasDB, error } = await supabase
    .from('reservas')
    .select('*')
    .eq('estado', 'eliminada');

  if (error) {
    console.error('Error al traer eliminadas para Excel:', error);
  }

  const doExport = (XLSX) => {
    const pmLabel = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      debito: 'Débito',
      credito: 'Crédito',
      otro: 'Otro',
    };

    // ORDENAMOS CRONOLÓGICAMENTE POR CHECK-IN ANTES DE CREAR LAS FILAS
    const reservasOrdenadas = [...reservations].sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));

    // --- PESTAÑA 1: ACTIVAS ---
    const rowsActivas = reservasOrdenadas.map((r) => {
      const prop = properties.find((p) => p.id === r.propertyId);
      const nights = diffDays(r.checkIn, r.checkOut);
      return {
        ID: r.id,
        Huésped: r.guestName,
        Documento: r.guestDoc || '—',
        'Tipo doc.': r.guestDocType || '—',
        Teléfono: r.guestPhone || '—',
        Email: r.guestEmail || '—',
        Propiedad: prop?.name || r.propertyId,
        Habitación: r.room || '—',
        'Check-in': fmtD(r.checkIn),
        'Check-out': fmtD(r.checkOut),
        Noches: nights,
        Huéspedes: r.totalGuests || 1,
        Estado: RS[r.status]?.label || r.status,
        Canal: srcLabel(r.source),
        'Total $': r.totalAmount || 0,
        'Pagado $': r.paid || 0,
        'Saldo $': (r.totalAmount || 0) - (r.paid || 0),
        'Forma de pago': pmLabel[r.paymentMethod] || r.paymentMethod || '—',
        Factura: r.requiresInvoice ? 'Sí' : 'No',
        'CI real': r.checkInAt ? fmtDT(r.checkInAt) : '—',
        'CO real': r.checkOutAt ? fmtDT(r.checkOutAt) : '—',
        Notas: r.notes || '',
        'Fecha de Carga': r.fecha_carga || '—',
        'Cargado por': r.usuario_carga || '—',
      };
    });

    // ORDENAMOS TAMBIÉN EL HISTORIAL DE ELIMINADAS
    const eliminadasOrdenadas = [...(eliminadasDB || [])].sort((a, b) => new Date(a.fecha_ingreso || 0) - new Date(b.fecha_ingreso || 0));

    // --- PESTAÑA 2: ELIMINADAS ---
    const rowsEliminadas = eliminadasOrdenadas.map((db) => {
      return {
        ID: db.id,
        Huésped: db.Huesped || db.huesped || '—',
        Habitación: db.habitacion || '—',
        'Check-in': db.fecha_ingreso || '—',
        'Check-out': db.fecha_salida || '—',
        'Total $': Number(db.monto) || 0,
        Estado: db.estado || '—',
        'Fecha de Carga': db.fecha_carga || '—',
        'Cargado por': db.usuario_carga || '—',
        'Fecha de Eliminación': db.fecha_eliminacion || '—',
        'Eliminado por': db.usuario_eliminacion || '—',
      };
    });

    const wb = XLSX.utils.book_new();

    const wsActivas = XLSX.utils.json_to_sheet(rowsActivas);
    const colWidthsActivas = Object.keys(rowsActivas[0] || {}).map((k) => ({
      wch: Math.max(k.length, 14),
    }));
    wsActivas['!cols'] = colWidthsActivas;
    XLSX.utils.book_append_sheet(wb, wsActivas, 'Activas');

    const datosEliminadas = rowsEliminadas.length > 0 ? rowsEliminadas : [{ Mensaje: 'No hay reservas eliminadas' }];
    const wsEliminadas = XLSX.utils.json_to_sheet(datosEliminadas);
    const colWidthsElim = Object.keys(datosEliminadas[0] || {}).map((k) => ({
      wch: Math.max(k.length, 14),
    }));
    wsEliminadas['!cols'] = colWidthsElim;
    XLSX.utils.book_append_sheet(wb, wsEliminadas, 'Historial Eliminadas');

    const today = fmt(new Date());
    XLSX.writeFile(wb, `itze_reservas_${today}.xlsx`);
  };

  if (window.XLSX) {
    doExport(window.XLSX);
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  script.onload = () => doExport(window.XLSX);
  document.head.appendChild(script);
}

// ── FINANCE PAGE ──────────────────────────────────────────────────────────────
function FinancePage({ reservations, allRes, properties, user, restoreRes }) {
  const [showTrash, setShowTrash] = useState(false);
  const pending = reservations.filter(
    (r) => r.status !== 'cancelada' && r.paid < r.totalAmount
  );
  const deleted = (allRes || []).filter((r) => r.deleted);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}>
          Finanzas
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {user?.role === 'admin' && deleted.length > 0 && (
            <button
              onClick={() => setShowTrash((x) => !x)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: showTrash ? '#FEF2F2' : '#F3F4F6',
                border: `1.5px solid ${showTrash ? '#FECACA' : '#E5E7EB'}`,
                borderRadius: 8,
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                color: showTrash ? '#DC2626' : '#6B7280',
              }}
            >
              🗑 Papelera{' '}
              {deleted.length > 0 && (
                <span
                  style={{
                    background: '#DC2626',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '1px 6px',
                    fontSize: 10,
                  }}
                >
                  {deleted.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => exportToExcel(reservations, properties)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: '#ECFDF5',
              border: '1.5px solid #6EE7B7',
              borderRadius: 8,
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              color: '#065F46',
            }}
          >
            📥 Exportar Excel
          </button>
        </div>
      </div>

      {/* PAPELERA — solo visible para admin cuando hay eliminadas */}
      {showTrash && user?.role === 'admin' && (
        <div
          style={{
            marginBottom: 24,
            background: '#FEF2F2',
            borderRadius: 12,
            padding: '16px 20px',
            border: '1.5px solid #FECACA',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: '#991B1B',
              marginBottom: 12,
            }}
          >
            🗑 Reservas eliminadas — solo tú podés ver esto
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deleted.map((r) => {
              const prop = properties.find((p) => p.id === r.propertyId);
              return (
                <div
                  key={r.id}
                  style={{
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid #FECACA',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: '#374151',
                      }}
                    >
                      {r.guestName}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {prop?.name}
                      {r.room ? ` · Hab.${r.room}` : ''} · {fmtD(r.checkIn)} →{' '}
                      {fmtD(r.checkOut)}
                    </div>
                    <div
                      style={{ fontSize: 10, color: '#EF4444', marginTop: 2 }}
                    >
                      Eliminada por {r.deletedBy || '—'} el{' '}
                      {r.deletedAt ? fmtDT(r.deletedAt) : '—'}
                    </div>
                  </div>
                  <button
                    onClick={() => restoreRes(r.id)}
                    style={{
                      padding: '7px 14px',
                      background: '#ECFDF5',
                      border: '1.5px solid #6EE7B7',
                      borderRadius: 8,
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      color: '#065F46',
                      flexShrink: 0,
                    }}
                  >
                    ↩ Restaurar
                  </button>
                </div>
              );
            })}
            {deleted.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  color: '#9CA3AF',
                  padding: 16,
                  fontSize: 13,
                }}
              >
                La papelera está vacía
              </div>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 28,
        }}
      >
        {properties.map((prop) => {
          const pRes = reservations.filter(
            (r) => r.propertyId === prop.id && r.status !== 'cancelada'
          );
          const total = pRes.reduce((s, r) => s + r.totalAmount, 0);
          const paid = pRes.reduce((s, r) => s + r.paid, 0);
          const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
          return (
            <div
              key={prop.id}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '18px 20px',
                border: '1px solid #F0F0F0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 22 }}>{prop.emoji}</span>
                  <div>
                    <div
                      style={{ fontWeight: 700, fontSize: 14, color: '#111' }}
                    >
                      {prop.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {pRes.length} reservas
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>
                    {currency(total)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: total - paid > 0 ? '#EF4444' : '#10B981',
                    }}
                  >
                    Pendiente: {currency(total - paid)}
                  </div>
                </div>
              </div>
              <div
                style={{ height: 6, background: '#F3F4F6', borderRadius: 4 }}
              >
                <div
                  style={{
                    height: '100%',
                    background: prop.color,
                    borderRadius: 4,
                    width: pct + '%',
                    transition: 'width .3s',
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#9CA3AF',
                  marginTop: 5,
                  textAlign: 'right',
                }}
              >
                {pct}% cobrado
              </div>
            </div>
          );
        })}
      </div>
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: 15,
          fontWeight: 700,
          color: '#374151',
        }}
      >
        Saldos pendientes
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pending.map((r) => {
          const prop = properties.find((p) => p.id === r.propertyId);
          return (
            <div
              key={r.id}
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid #F0F0F0',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
                  {r.guestName}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {prop?.name} · CI: {fmtD(r.checkIn)}
                </div>
              </div>
              <div style={{ fontWeight: 800, color: '#EF4444', fontSize: 16 }}>
                {currency(r.totalAmount - r.paid)}
              </div>
            </div>
          );
        })}
        {pending.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#D1D5DB',
              padding: 30,
              fontSize: 13,
            }}
          >
            ✅ Sin saldos pendientes
          </div>
        )}
      </div>
    </div>
  );
}

// ── RESERVATIONS LIST ─────────────────────────────────────────────────────────
function ResList({ reservations, properties, onView, onAdd }) {
  const [filter, setFilter] = useState('todas');
  const [q, setQ] = useState('');
  const filtered = reservations.filter((r) => {
    if (filter !== 'todas' && r.status !== filter) return false;
    if (q && !r.guestName.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}>
          Reservas
        </h2>
        <button
          onClick={() => onAdd()}
          style={{
            padding: '8px 16px',
            background: '#3B82F6',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Nueva
        </button>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar huésped..."
        style={{
          width: '100%',
          padding: '10px 14px',
          border: '1.5px solid #E5E7EB',
          borderRadius: 10,
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          marginBottom: 12,
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}
      >
        {['todas', 'hospedado', 'por_llegar', 'finalizada', 'cancelada'].map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 14px',
                borderRadius: 16,
                border: 'none',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
                background: filter === f ? '#1E293B' : '#F3F4F6',
                color: filter === f ? '#fff' : '#6B7280',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          )
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((r) => {
          const prop = properties.find((p) => p.id === r.propertyId);
          const saldo = r.totalAmount - r.paid;
          return (
            <div
              key={r.id}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '14px 18px',
                border: '1px solid #F0F0F0',
                cursor: 'pointer',
              }}
              onClick={() => onView(r)}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Avatar name={r.guestName} size={36} />
                  <div>
                    <div
                      style={{ fontWeight: 700, fontSize: 14, color: '#111' }}
                    >
                      {r.guestName}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {prop?.emoji} {prop?.name}
                      {r.room ? ` · Hab.${r.room}` : ''}
                    </div>
                  </div>
                </div>
                <Badge status={r.status} />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: '#9CA3AF' }}>CI</span>
                  <br />
                  <b style={{ color: '#374151' }}>{fmtD(r.checkIn)}</b>
                </div>
                <div>
                  <span style={{ color: '#9CA3AF' }}>CO</span>
                  <br />
                  <b style={{ color: '#374151' }}>{fmtD(r.checkOut)}</b>
                </div>
                <div>
                  <span style={{ color: '#9CA3AF' }}>Saldo</span>
                  <br />
                  <b style={{ color: saldo > 0 ? '#EF4444' : '#10B981' }}>
                    {currency(saldo)}
                  </b>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 6,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: '#555' }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: srcColor(r.source),
                      display: 'inline-block',
                      marginRight: 4,
                    }}
                  />
                  {srcLabel(r.source)}
                </span>
                {r.requiresInvoice && (
                  <span
                    style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED' }}
                  >
                    🧾 Factura
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#D1D5DB',
              padding: 40,
              fontSize: 13,
            }}
          >
            Sin reservas
          </div>
        )}
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [uid, setUid] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const go = () => {
    const u = USERS.find((x) => x.id === uid && x.password === pw);
    if (u) onLogin(u);
    else setErr('Usuario o contraseña incorrectos');
  };
  const si = {
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(255,255,255,.1)',
    border: '1px solid rgba(255,255,255,.2)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 12,
  };
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F172A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter',system-ui,sans-serif",
        padding: 20,
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 8px 24px rgba(99,102,241,.4)',
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <path d="M22 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="11" r="3" />
            </svg>
          </div>
          <h1
            style={{
              color: '#fff',
              fontSize: 26,
              fontWeight: 800,
              margin: '0 0 4px',
              letterSpacing: -0.5,
            }}
          >
            Itzé Flow
          </h1>
          <p
            style={{ color: 'rgba(255,255,255,.45)', margin: 0, fontSize: 13 }}
          >
            Sistema de gestión de reservas
          </p>
        </div>
        <div
          style={{
            background: 'rgba(255,255,255,.06)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 16,
            padding: 28,
          }}
        >
          <label
            style={{
              display: 'block',
              color: 'rgba(255,255,255,.5)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginBottom: 6,
            }}
          >
            Usuario
          </label>
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="admin"
            style={si}
          />
          <label
            style={{
              display: 'block',
              color: 'rgba(255,255,255,.5)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginBottom: 6,
            }}
          >
            Contraseña
          </label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
            placeholder="••••••••"
            style={si}
          />
          {err && (
            <p
              style={{
                color: '#FCA5A5',
                fontSize: 12,
                margin: '0 0 10px',
                textAlign: 'center',
              }}
            >
              {err}
            </p>
          )}
          <button
            onClick={go}
            style={{
              width: '100%',
              padding: '12px',
              background: '#3B82F6',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginTop: 4,
            }}
          >
            Ingresar
          </button>
          <div
            style={{
              marginTop: 20,
              background: 'rgba(255,255,255,.04)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 12,
              color: 'rgba(255,255,255,.35)',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: 'rgba(255,255,255,.4)',
                marginBottom: 5,
              }}
            >
              Accesos demo
            </div>
            <div>
              Admin:{' '}
              <span style={{ color: 'rgba(255,255,255,.6)' }}>
                admin / admin123
              </span>
            </div>
            <div>
              Staff:{' '}
              <span style={{ color: 'rgba(255,255,255,.6)' }}>
                staff / staff123
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ── ICONOS SVG (Estilo SF Symbols / Linear) ───────────────────────────────────
const Icon = ({ name, size = 20, color = 'currentColor' }) => {
  const icons = {
    home: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    ),
    calendar: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    ),
    list: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    ),
    building: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    ),
    users: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    ),
    finance: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
    checkIn: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
      />
    ),
    checkOut: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    ),
    edit: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    ),
    trash: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    ),
    whatsapp: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    ),
    invoice: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    ),
    warning: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="2"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {icons[name]}
    </svg>
  );
};
// ── APP ───────────────────────────────────────────────────────────────────────
export default function AppMejorada() {
  const [user, setUser] = useState(null);
  const [res, setRes] = useState(INIT_RES);
  const [tab, setTab] = useState('dashboard');
  const winW = useW();
  const isMobile = winW < 769;
  const isTablet = winW >= 769 && winW < 1280;

  useEffect(() => {
    const fetchReservas = async () => {
      const { data, error } = await supabase.from('reservas').select('*');

      if (error) {
        console.error('Error rojo en Supabase:', error);
      } else if (data) {
        const reservasCargadas = data.map((item) => ({
          id: item.id,
          propertyId: 'hostel', // ¡LA LLAVE MAESTRA! Le dice al calendario dónde dibujarlo
          guestName: item.Huesped || item.huesped || 'Sin nombre',
          checkIn: item.fecha_ingreso,
          checkOut: item.fecha_salida,
          status: item.estado || 'por_llegar',
          totalAmount: Number(item.monto) || 0,
          paid: 0, // Dato por defecto para que no falle
          source: 'Directo', // Dato por defecto para que no falle
          room: String(item.habitacion).trim(),
          fecha_carga: item.fecha_carga || '—', // Mapea la fecha de creación desde Supabase
          usuario_carga: item.usuario_carga || '—', // Mapea el usuario creador desde Supabase
          deleted: item.estado === 'eliminada', // ¡LA LLAVE PARA QUE DESAPAREZCA DEL CALENDARIO!
          deletedAt: item.fecha_eliminacion,
          deletedBy: item.usuario_eliminacion,
        }));

        setRes(reservasCargadas);
      }
    };

    // 1. Carga inicial
    fetchReservas();

    // 2. Suscripción a la señal de Supabase en tiempo real (CON EL FRENO DE 500ms)
    const canalReservas = supabase
      .channel('cambios-en-vivo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        (payload) => {
          console.log('Sincronizando cambio detectado...', payload);
          
          // Le damos a la base de datos medio segundo (500 ms) para asentarse antes de buscar los datos nuevos
          setTimeout(() => {
            fetchReservas(); 
          }, 500);
          
        }
      )
      .subscribe();

    // 3. Apagar el canal cuando se cierra la app para no consumir recursos
    return () => {
      supabase.removeChannel(canalReservas);
    };
  }, []);

  // Estados restaurados: Las "memorias" que controlan tu interfaz
  const [drawer, setDrawer] = useState(null);
  const [modal, setModal] = useState(null);
  const [ciModal, setCiModal] = useState(null);
  const [coModal, setCoModal] = useState(null);
  const [propStatus, setPropStatus] = useState({});
  const [notes, setNotes] = useState({});
  const [checklists, setChecklists] = useState({});
  const [calView, setCalView] = useState('timeline');
  const [prefill, setPrefill] = useState({});

  // 1. Verificación de Login
  if (!user) return <Login onLogin={setUser} />;

  // 2. Definición de permisos y datos
  const visProps =
    user.role === 'admin'
      ? PROPS
      : PROPS.filter((p) => user.ownedProps.includes(p.id));
  const visRes = res.filter(
    (r) => visProps.some((p) => p.id === r.propertyId) && !r.deleted
  );
  const propsWS = visProps;
  const effectiveCalView = calView;
  const initProp = visProps[0]?.id;

  // 3. Pestañas permitidas
  const TABS_ALL = [
    { id: 'dashboard', label: 'Inicio', icon: 'home' },
    { id: 'calendario', label: 'Calendario', icon: 'calendar' },
    { id: 'reservas', label: 'Reservas', icon: 'list' },
    { id: 'propiedades', label: 'Propiedades', icon: 'building' },
    { id: 'huespedes', label: 'Huéspedes', icon: 'users' },
    { id: 'finanzas', label: 'Finanzas', icon: 'finance' },
  ];
  const TABS =
    user.role === 'staff'
      ? TABS_ALL.filter((t) => t.id !== 'finanzas')
      : TABS_ALL;

  // Funciones operativas restauradas
  const openAdd = (pid = '', date = '') => {
    setPrefill({ pid, date });
    setModal('new');
  };
  const goTo = (newTab, pid) => {
    setTab(newTab);
  };
  const saveRes = async (newRes) => {
    try {
      if (newRes.id) {
        // 1. EDICIÓN: Solo actualizamos los datos básicos
        const { error } = await supabase
          .from('reservas')
          .update({
            huesped: newRes.guestName,
            habitacion: newRes.room,
            fecha_ingreso: newRes.checkIn,
            fecha_salida: newRes.checkOut,
            estado: newRes.status || 'Pendiente',
            monto: String(newRes.totalAmount || ''),
          })
          .eq('id', newRes.id);

        if (error) throw error;
        setRes(res.map((r) => (r.id === newRes.id ? newRes : r)));

      } else {
        // 2. NUEVA RESERVA: Activamos el reloj y registramos al responsable
        const momentoExacto = new Date().toLocaleString('es-MX', {
          timeZone: 'America/Merida',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
        const responsable = user?.name || 'Usuario desconocido';

        const { data, error } = await supabase
          .from('reservas')
          .insert([
            {
              huesped: newRes.guestName,
              habitacion: newRes.room,
              fecha_ingreso: newRes.checkIn,
              fecha_salida: newRes.checkOut,
              estado: newRes.status || 'Pendiente',
              monto: String(newRes.totalAmount || ''),
              fecha_carga: momentoExacto,
              usuario_carga: responsable
            },
          ])
          .select();

        if (error) throw error;

        // Actualizamos la pantalla incluyendo los datos de auditoría
        const reservaConAuditoria = {
          ...newRes,
          fecha_carga: momentoExacto,
          usuario_carga: responsable
        };

        if (data && data.length > 0) {
          setRes([...res, { ...reservaConAuditoria, id: data[0].id }]);
        } else {
          setRes([...res, { ...reservaConAuditoria, id: 'r' + Date.now() }]);
        }
      }

      // 3. Cerramos el formulario
      setModal(null);
    } catch (err) {
      console.error('Error al conectar con la base de datos:', err);
      alert('Hubo un problema al guardar la reserva en la nube. Revisa la consola.');
    }
  };
  const updateRes = (id, changes) =>
    setRes(res.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  const delRes = async (id) => {
    // Capturamos la fecha y hora exacta con la zona horaria de Progreso, Yucatán
    const momentoExacto = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Merida',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });

    const responsable = user?.name || 'Usuario desconocido';

    // 1. Borrado Lógico en Supabase
    const { error } = await supabase
      .from('reservas')
      .update({ 
        estado: 'eliminada',
        fecha_eliminacion: momentoExacto,
        usuario_eliminacion: responsable
      })
      .eq('id', id);

    if (error) {
      console.error('Error al archivar en Supabase:', error);
      alert('Hubo un problema al intentar borrar la reserva.');
      return;
    }

    // 2. La sacamos de la vista inmediatamente
    setRes(res.filter((r) => r.id !== id));
    setDrawer(null);
  };
  const restoreRes = async (id) => {
    // 1. Le avisamos a Supabase que la reserva vuelve a la vida
    const { error } = await supabase
      .from('reservas')
      .update({ 
        estado: 'por_llegar', 
        fecha_eliminacion: null, 
        usuario_eliminacion: null 
      })
      .eq('id', id);

    if (error) {
      console.error('Error al restaurar:', error);
      alert('Hubo un problema al restaurar la reserva.');
      return;
    }

    // 2. La revivimos en la pantalla
    setRes(
      res.map((r) =>
        r.id === id
          ? { ...r, deleted: false, status: 'por_llegar', deletedAt: null, deletedBy: null }
          : r
      )
    );
  };
  const handleCI = (r) => {
    setDrawer(null);
    setCiModal(r);
  };
  const handleCO = (r) => {
    setDrawer(null);
    setCoModal(r);
  };
  const confCI = (time) => {
    setRes(
      res.map((x) =>
        x.id === ciModal.id ? { ...x, status: 'hospedado', checkInAt: time } : x
      )
    );
    setCiModal(null);
  };
  const confCO = (time, newCO) => {
    setRes(
      res.map((x) =>
        x.id === coModal.id
          ? {
              ...x,
              status: 'finalizada',
              checkOutAt: time,
              checkOut: newCO || x.checkOut,
            }
          : x
      )
    );
    setCoModal(null);
  };

  // 4. EL DISEÑO VISUAL (Ahora sí, adentro de la función principal)
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <style>{`
        /* Reset y Tipografía Global */
        *, *::before, *::after { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif !important; }
        html, body, #root { margin: 0 !important; padding: 0 !important; max-width: 100% !important; width: 100%; background: #F8FAFC; color: #111; overflow: hidden; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
        input[type=date]::-webkit-calendar-picker-indicator { opacity: .4; }
        button, input, select, textarea { font-family: inherit; }
        
        /* Sistema de Layout Responsivo (CSS Puro) */
        .app-layout { display: flex; width: 100%; height: calc(100vh - 54px); }
        .sidebar { display: flex; flex-direction: column; flex-shrink: 0; background: #fff; border-right: 1px solid #F0F0F0; height: 100%; overflow-y: auto; transition: width 0.2s ease; }
        
        /* Contenido principal ocupando 100% con scroll independiente */
        .main-content { flex: 1; min-width: 0; padding: 16px; height: 100%; overflow-y: auto; transition: padding 0.2s ease; }
        
        /* Ocultar menú inferior en escritorio */
        .bn { display: none; } 
        
        /* Animación Modal Bottom Sheet para Mobile */
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

        /* Desktop Amplio (>1280px) */
        @media (min-width: 1281px) { .sidebar { width: 220px; padding: 24px 16px; } }

        /* Desktop Regular y Tablet (769px - 1280px) */
        @media (min-width: 769px) and (max-width: 1280px) {
          .sidebar { width: 64px; padding: 20px 8px; align-items: center; }
          .sl, .sa { display: none !important; }
        }

        /* Mobile (<768px) */
        @media (max-width: 768px) {
          body { overflow: auto; }
          .app-layout { height: auto; min-height: calc(100vh - 54px); }
          .sidebar { display: none !important; }
          .main-content { padding: 16px 12px 100px !important; overflow-y: visible; }
          .bn { display: flex !important; position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #E5E7EB; z-index: 99; padding-bottom: env(safe-area-inset-bottom, 12px); box-shadow: 0 -2px 10px rgba(0,0,0,0.03); }
        }
      `}</style>

      {/* Navbar Superior */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #F0F0F0',
          padding: '0 16px',
          height: 54,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
              fontSize: 18,
            }}
          >
            🏨
          </div>
          <div>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>
              Itzé Flow Pro
            </span>
            {isMobile && (
              <div
                style={{
                  fontSize: 10,
                  color: '#9CA3AF',
                  lineHeight: 1,
                  marginTop: 1,
                }}
              >
                Itzé Hostel Boutique
              </div>
            )}
          </div>
          {!isMobile && (
            <>
              {user.role === 'owner' && (
                <span
                  style={{
                    fontSize: 11,
                    background: '#EDE9FE',
                    color: '#7C3AED',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  Propietario
                </span>
              )}
              {user.role === 'admin' && (
                <span
                  style={{
                    fontSize: 11,
                    background: '#DBEAFE',
                    color: '#1E40AF',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  Admin
                </span>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMobile ? (
            <button
              onClick={() => openAdd()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 12px',
                background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Nueva
            </button>
          ) : (
            <>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                {user.name}
              </span>
              <button
                onClick={() => setUser(null)}
                style={{
                  background: '#F3F4F6',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#6B7280',
                  cursor: 'pointer',
                }}
              >
                Salir
              </button>
            </>
          )}
        </div>
      </div>

      <div className="app-layout">
        {/* Sidebar Lateral */}
        <div className="sidebar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={isTablet ? t.label : ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: isTablet ? '10px' : '9px 12px',
                  borderRadius: 9,
                  border: 'none',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  background: tab === t.id ? '#EFF6FF' : 'transparent',
                  color: tab === t.id ? '#2563EB' : '#6B7280',
                  textAlign: 'left',
                  justifyContent: isTablet ? 'center' : 'flex-start',
                }}
              >
                <span style={{ display: 'flex', flexShrink: 0 }}>
                  <Icon name={t.icon} size={20} />
                </span>
                <span
                  className="sl"
                  style={{ display: isTablet ? 'none' : 'inline' }}
                >
                  {t.label}
                </span>
              </button>
            ))}
            <div
              style={{
                borderTop: '1px solid #F0F0F0',
                margin: '12px 0',
                paddingTop: 12,
              }}
            >
              <button
                onClick={() => openAdd()}
                title={isTablet ? 'Nueva reserva' : ''}
                style={{
                  width: '100%',
                  padding: isTablet ? '10px' : '9px 12px',
                  background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
                  border: 'none',
                  borderRadius: 9,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(99,102,241,.3)',
                }}
              >
                +{' '}
                <span
                  className="sa"
                  style={{ display: isTablet ? 'none' : 'inline' }}
                >
                  Nueva reserva
                </span>
              </button>
            </div>
            {!isTablet && (
              <button
                onClick={() => setUser(null)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 9,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: 12,
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                ↩ Cerrar sesión
              </button>
            )}
          </div>
        </div>

        {/* Contenido Principal Dinámico */}
        <div className="main-content" key={tab}>
          {tab === 'dashboard' && (
            <Dashboard
              user={user}
              reservations={visRes}
              properties={propsWS}
              propStatus={propStatus}
              setPropStatus={setPropStatus}
              onGoTo={goTo}
            />
          )}
          {tab === 'calendario' && (
            <Timeline
              reservations={visRes}
              properties={propsWS}
              onClickRes={(r) => setDrawer(r)}
              onAddRes={openAdd}
              onUpdateRes={updateRes}
              isMobile={isMobile}
              calView={effectiveCalView}
              setCalView={setCalView}
            />
          )}
          {tab === 'reservas' && (
            <ResList
              reservations={visRes}
              properties={visProps}
              onView={(r) => setDrawer(r)}
              onAdd={openAdd}
            />
          )}
          {tab === 'propiedades' && (
            <PropertiesPage
              properties={visProps}
              reservations={visRes}
              notes={notes}
              setNotes={setNotes}
              checklists={checklists}
              setChecklists={setChecklists}
              propStatus={propStatus}
              setPropStatus={setPropStatus}
              initProp={initProp}
            />
          )}
          {tab === 'huespedes' && (
            <GuestsPage
              reservations={visRes}
              properties={visProps}
              onView={(r) => setDrawer(r)}
            />
          )}
          {tab === 'finanzas' && (
            <FinancePage
              reservations={visRes}
              allRes={res}
              properties={visProps}
              user={user}
              restoreRes={restoreRes}
            />
          )}
        </div>
      </div>

      {/* Menú inferior Mobile */}
      <div
        className="bn"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #F0F0F0',
          zIndex: 99,
          paddingBottom: 'env(safe-area-inset-bottom,8px)',
        }}
      >
        {TABS.slice(0, 5).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '8px 2px 4px',
              minHeight: 52,
            }}
          >
            <span
              style={{
                display: 'flex',
                color: tab === t.id ? '#2563EB' : '#9CA3AF',
              }}
            >
              <Icon name={t.icon} size={22} />
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: tab === t.id ? '#2563EB' : '#9CA3AF',
                marginTop: 1,
              }}
            >
              {t.label}
            </span>
            {tab === t.id && (
              <div
                style={{
                  width: 20,
                  height: 2.5,
                  background: '#2563EB',
                  borderRadius: 4,
                  marginTop: 2,
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Modales y Paneles flotantes */}
      {drawer && (
        <ResDrawer
          res={drawer}
          onClose={() => setDrawer(null)}
          onEdit={(r) => {
            setModal({ type: 'edit', data: r });
            setDrawer(null);
          }}
          onDelete={(id) => setModal({ type: 'confirmDel', id })}
          properties={visProps}
          allRes={res}
          isMobile={isMobile}
          onCheckIn={handleCI}
          onCheckOut={handleCO}
        />
      )}
      {modal?.type === 'confirmDel' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 360,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                background: '#FEF2F2',
                padding: '18px 22px',
                borderBottom: '1px solid #FECACA',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#991B1B' }}>
                🗑 ¿Eliminar reserva?
              </div>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151' }}>
                La reserva <b>no se borrará definitivamente</b>. Quedará en la
                papelera y solo el administrador podrá recuperarla.
              </p>
              <p style={{ margin: '0 0 20px', fontSize: 12, color: '#9CA3AF' }}>
                Para eliminar permanentemente, contactá al administrador.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#374151',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    delRes(modal.id);
                    setModal(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#FEF2F2',
                    border: '1.5px solid #FECACA',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#DC2626',
                  }}
                >
                  Mover a papelera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {modal === 'new' && (
        <Modal
          title="Nueva reserva"
          onClose={() => setModal(null)}
          isMobile={isMobile}
        >
          <ResForm
            visibleProps={visProps}
            onSave={saveRes}
            onClose={() => setModal(null)}
            prefillProp={prefill.pid}
            prefillDate={prefill.date}
            allRes={res}
          />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal
          title="Editar reserva"
          onClose={() => setModal(null)}
          isMobile={isMobile}
        >
          <ResForm
            initial={modal.data}
            visibleProps={visProps}
            onSave={saveRes}
            onClose={() => setModal(null)}
            allRes={res}
          />
        </Modal>
      )}
      {ciModal && (
        <CIModal
          res={ciModal}
          onConfirm={confCI}
          onCancel={() => setCiModal(null)}
        />
      )}
      {coModal && (
        <COModal
          res={coModal}
          onConfirm={confCO}
          onCancel={() => setCoModal(null)}
        />
      )}
    </div>
  );
}

// --- MOTOR DE ARRANQUE ---
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<AppMejorada />);
}
