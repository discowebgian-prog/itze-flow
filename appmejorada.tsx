/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabase';

// Font y Candado Anti-Zoom para Celulares
if (typeof document !== 'undefined') {
  // 1. Cargar la fuente
  if (!document.getElementById('gf')) {
    const l = document.createElement('link');
    l.id = 'gf';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
    document.head.appendChild(l);
  }

  // 2. Bloquear el zoom automático (Comportamiento de App Nativa)
  let metaViewport = document.querySelector('meta[name="viewport"]');
  if (!metaViewport) {
    metaViewport = document.createElement('meta');
    metaViewport.name = 'viewport';
    document.head.appendChild(metaViewport);
  }
  metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
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
    key: 'notes',
    color: '#8B5CF6', // Color Violeta para identificar las Notas
    label: 'Nota',
    check: (r) => r.notes && r.notes.trim() !== '' && r.status !== 'cancelada',
  },
  {
    key: 'saldo',
    color: '#F59E0B', // Color Naranja para el Saldo Pendiente
    label: 'Saldo',
    check: (r) => Number(r.paid) < Number(r.totalAmount) && r.status !== 'cancelada',
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
const waLink = (phone, prefix, nationality) => {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/\D/g, '');
  const cleanPrefix = (prefix || '').replace(/\D/g, '');
  return `https://wa.me/${cleanPrefix}${cleanPhone}`;
};
// ── GUEST DB ──────────────────────────────────────────────────────────────────
function buildGuestDB(reservations) {
  const db = {};
  reservations.forEach((r) => {
    // Ignoramos si por algún error la reserva no tiene nombre
    if (!r.guestName || r.guestName.trim() === '') return;

    // MAGIA: Si tiene documento, agrupa por documento. Si no, agrupa por el nombre (en minúsculas para evitar duplicados).
    const k = r.guestDoc
      ? r.guestDoc.replace(/\s+/g, '').toLowerCase()
      : r.guestName.trim().toLowerCase();

    if (!db[k]) {
      db[k] = {
        doc: r.guestDoc || '',
        name: r.guestName,
        phone: r.guestPhone || '',
        email: r.guestEmail || '',
        stays: [],
        totalSpent: 0,
        firstStay: r.checkIn,
        lastStay: r.checkIn,
      };
    }
    
    const g = db[k];
    
    // Sumamos sus estadísticas solo si no habíamos contado esta reserva antes
    if (!g.stays.includes(r.id)) {
      g.stays.push(r.id);
      g.totalSpent += r.totalAmount || 0;
    }

    if (r.checkIn < g.firstStay) g.firstStay = r.checkIn;
    if (r.checkIn > g.lastStay) {
      g.lastStay = r.checkIn;
      g.name = r.guestName; // Se queda con el último nombre registrado
      if (r.guestPhone) g.phone = r.guestPhone; // Se queda con el teléfono más actual
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
const Badge = ({ status, large }) => {
  // EL SALVAVIDAS: Si el estado no existe en la lista, le pone un color gris por defecto y muestra el nombre en lugar de explotar.
  const s = RS[status] || { bg: '#F3F4F6', txt: '#6B7280', label: status || 'Desconocido' };
  
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
function RangeCalendar({ checkIn, checkOut, onChange, minDate }) {
  const [base, setBase] = useState(checkIn ? parseD(checkIn) : TODAY);
  const [hover, setHover] = useState(null);
  const [step, setStep] = useState(checkIn && checkOut ? 2 : 0);

  // Candado inteligente: Si le pasamos una fecha mínima (ej. checkIn en el pasado), usa esa. Si no, usa HOY.
  const minD = null;

  const y = base.getFullYear(),
    m = base.getMonth();
  const daysInMo = new Date(y, m + 1, 0).getDate();
  const firstDow = new Date(y, m, 1).getDay();
  const grid = Array(firstDow)
    .fill(null)
    .concat(Array.from({ length: daysInMo }, (_, i) => new Date(y, m, i + 1)));

  const clickD = (d) => {
    if (!d || (minD && d < minD)) return;
    const s = fmt(d);
    
    // El nuevo estándar: Si ya hay un rango completo (step 2) y tocás cualquier fecha,
    // se limpia la selección previa y esa fecha se convierte en tu nuevo Check-In.
    if (step === 2) {
      onChange(s, '');
      setStep(1);
    } else if (step === 0) {
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

  let nights = 0;
  if (checkIn && checkOut) {
    nights = Math.round((parseD(checkOut) - parseD(checkIn)) / 86400000);
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1.5px solid #E5E7EB',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 12,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setBase(new Date(y, m - 1, 1))}
          style={{
            border: 'none',
            background: '#F3F4F6',
            borderRadius: 8,
            width: 30,
            height: 30,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 14,
            color: '#555',
          }}
        >
          ◀
        </button>
        <div
          style={{
            fontWeight: 900,
            fontSize: 16,
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
            width: 30,
            height: 30,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 14,
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
          marginBottom: 4,
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
          const isDisabled = false; // Sin restricciones de clics
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
          } else if (isDisabled) {
            col = '#D1D5DB';
          }

          return (
            <div
              key={i}
              onClick={() => clickD(d)}
              onMouseEnter={() => step === 1 && setHover(s)}
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
                cursor: isDisabled ? 'not-allowed' : 'pointer',
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
          alignItems: 'center',
          marginTop: 10,
          fontSize: 13,
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
        {nights > 0 && (
          <div style={{ color: '#3B82F6', fontSize: 12, fontWeight: 800 }}>
            {nights} noche{nights !== 1 ? 's' : ''}
          </div>
        )}
        <div>
          CO: <span style={{ color: '#111' }}>{fmtD(checkOut)}</span>
        </div>
      </div>
    </div>
  );
}

// ── RESERVATION FORM ──────────────────────────────────────────────────────────
// ── CARGADOR DE INE COMPRIMIDO (CORREGIDO) ───────────────────────────────────
function IneUploader({ f, onUploadFrente, onUploadDorso }) {
  const [loadingF, setLoadingF] = useState(false);
  const [loadingD, setLoadingD] = useState(false);

  const processFile = async (e, side) => {
    const file = e.target.files[0];
    if (!file) return;

    side === 'frente' ? setLoadingF(true) : setLoadingD(true);

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error("Error al leer la imagen del celular."));
      });

      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      let scaleSize = 1;
      if (img.width > MAX_WIDTH) {
        scaleSize = MAX_WIDTH / img.width;
      }
      canvas.width = img.width * scaleSize;
      canvas.height = img.height * scaleSize;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        try {
          const fileName = `ine_${side}_${Date.now()}.jpg`;
          
          const { error } = await supabase.storage
            .from('documentos')
            .upload(fileName, blob, { contentType: 'image/jpeg' });

          if (error) {
            console.error("Error de Supabase:", error);
            throw new Error("Supabase rechazó el archivo. ¿Revisaste las Políticas de Storage?");
          }

          const { data: { publicUrl } } = supabase.storage
            .from('documentos')
            .getPublicUrl(fileName);

          side === 'frente' ? onUploadFrente(publicUrl) : onUploadDorso(publicUrl);
        } catch (err) {
          console.error(err);
          alert(err.message);
        } finally {
          side === 'frente' ? setLoadingF(false) : setLoadingD(false);
        }
      }, 'image/jpeg', 0.7);

    } catch (err) {
      console.error(err);
      alert(err.message);
      side === 'frente' ? setLoadingF(false) : setLoadingD(false);
    }
  };

  return (
    <div style={{ padding: 16, background: '#F0F9FF', borderRadius: 10, border: '1px solid #BAE6FD', marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 }}>
        Fotografías del INE
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ flex: 1, padding: '12px 10px', background: f.url_ine_frente ? '#10B981' : '#0284C7', color: '#fff', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.2s' }}>
          {loadingF ? 'Subiendo...' : f.url_ine_frente ? '✓ Frente OK' : '📸 Foto Frente'}
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => processFile(e, 'frente')} />
        </label>
        <label style={{ flex: 1, padding: '12px 10px', background: f.url_ine_dorso ? '#10B981' : '#0284C7', color: '#fff', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.2s' }}>
          {loadingD ? 'Subiendo...' : f.url_ine_dorso ? '✓ Dorso OK' : '📸 Foto Dorso'}
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => processFile(e, 'dorso')} />
        </label>
      </div>
    </div>
  );
}

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
    checkOut: fmt(addDays(TODAY, 1)),
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
    lista_negra: false,
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
  const [f, setF] = useState(() => {
    if (!initial) return blank;
    
    // Rellenamos las cajas de adicionales si faltan datos en reservas viejas
    const addsCount = Math.max(0, (initial.totalGuests || 1) - 2);
    let loadedAdditionals = initial.pricing?.additionals || [];
    
    if (loadedAdditionals.length < addsCount) {
      loadedAdditionals = [
        ...loadedAdditionals,
        ...Array(addsCount - loadedAdditionals.length).fill({
          ratePerNight: 0,
          bonificada: false,
        })
      ];
    }

    return {
      ...blank,
      ...initial,
      companions: initial.companions || [],
      pricing: { 
        ...blank.pricing, 
        ...(initial.pricing || {}),
        additionals: loadedAdditionals 
      },
    };
  });
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

  const minDatePermitida = initial?.checkIn ? initial.checkIn : null;

  // ── EL RADAR DE LISTA NEGRA EN VIVO ──
  const matchBlacklist = allRes.find(r => 
    r.lista_negra && 
    r.guestName && 
    f.guestName &&
    r.guestName.toLowerCase().trim() === f.guestName.toLowerCase().trim() && 
    r.guestNationality === f.guestNationality &&
    r.id !== f.id
  );

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
    if (!nights) return 0;
    let b = Number(f.pricing.ratePerNight) * nights;
    if (f.pricing.discountType === 'porcentaje')
      b -= b * (Number(f.pricing.discountValue) / 100);
    else if (f.pricing.discountType === 'monto_fijo')
      b -= Number(f.pricing.discountValue);
    else if (f.pricing.discountType === 'noche_gratis')
      b -= Number(f.pricing.ratePerNight) * Number(f.pricing.discountValue);
    const addT = (f.pricing.additionals || []).reduce(
      (s, a) => s + (a.bonificada ? 0 : (Number(a.ratePerNight) || 0) * nights),
      0
    );
    return Math.max(0, b + addT);
  };

  useEffect(() => {
    if (f.pricing.ratePerNight !== '') {
      const t = calcTotal();
      if (f.totalAmount !== t) {
        sv('totalAmount', t);
      }
    }
  }, [
    f.pricing.ratePerNight,
    f.pricing.discountType,
    f.pricing.discountValue,
    f.pricing.additionals,
    nights,
  ]);

  const handleSave = () => {
    if (conflicts.length > 0) {
      setConfModal(() => () => {
        onSave(f);
        setConfModal(null);
      });
    } else onSave(f);
  };

  const saldoPendiente = Math.max(0, Number(f.totalAmount || 0) - Number(f.paid || 0));

  return (
    <div>
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
        minDate={minDatePermitida}
        onChange={(ci, co) => {
          sv('checkIn', ci);
          sv('checkOut', co);
        }}
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

      <Inp
        label="Nombre completo"
        value={f.guestName}
        onChange={(e) => sv('guestName', e.target.value)}
      />

      {/* ── ALERTA DE LISTA NEGRA (VISIBLE SOLO SI HAY COINCIDENCIA) ── */}
      {matchBlacklist && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ color: '#991B1B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            ⚠️ Alerta de Lista Negra
          </div>
          <div style={{ color: '#7F1D1D', fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>
            El sistema detectó un huésped marcado como "No Grato" con el mismo nombre y nacionalidad. Verificá si es la misma persona:
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {matchBlacklist.url_ine_frente && (
              <a href={matchBlacklist.url_ine_frente} target="_blank" rel="noreferrer" style={{ fontSize: 11, background: '#DC2626', color: '#fff', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontWeight: 700 }}>
                📷 ID Frente
              </a>
            )}
            {matchBlacklist.url_ine_dorso && (
              <a href={matchBlacklist.url_ine_dorso} target="_blank" rel="noreferrer" style={{ fontSize: 11, background: '#DC2626', color: '#fff', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontWeight: 700 }}>
                📷 ID Dorso
              </a>
            )}
            {!matchBlacklist.url_ine_frente && !matchBlacklist.url_ine_dorso && (
              <span style={{ fontSize: 11, color: '#991B1B', fontWeight: 600 }}>
                (No hay fotos previas para contrastar).
              </span>
            )}
          </div>
        </div>
      )}

      <CountrySelector
        value={f.guestNationality}
        onChange={(c) => {
          sv('guestNationality', c.code);
          sv('guestPhonePrefix', c.prefix);
        }}
      />
      <IneUploader 
        f={f} 
        onUploadFrente={(url) => sv('url_ine_frente', url)}
        onUploadDorso={(url) => sv('url_ine_dorso', url)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10 }}>
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
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 800,
              color: f.source === 'Booking' ? '#1E3A8A' : '#065F46',
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Canal
          </label>
          <select
            value={f.source}
            onChange={(e) => sv('source', e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px',
              border: `2px solid ${f.source === 'Booking' ? '#3B82F6' : '#10B981'}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              fontFamily: 'inherit',
              outline: 'none',
              background: f.source === 'Booking' ? '#EFF6FF' : '#ECFDF5',
              color: f.source === 'Booking' ? '#1E40AF' : '#065F46',
              boxSizing: 'border-box',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
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
                  border: `2px solid ${f.totalGuests === n ? '#3B82F6' : '#E5E7EB'}`,
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
          padding: '16px',
          border: '1px solid #E5E7EB',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#111',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          💰 Liquidación y Pago
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Inp
            label="Tarifa base/noche $"
            type="number"
            value={f.pricing.ratePerNight}
            onChange={(e) =>
              sv('pricing', {
                ...f.pricing,
                ratePerNight: e.target.value === '' ? '' : Number(e.target.value),
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
          <div style={{ marginTop: 8, borderTop: '1px dashed #E5E7EB', paddingTop: 8 }}>
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
                <div style={{ fontSize: 12, fontWeight: 600 }}>Persona {i + 1}</div>
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
                  style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
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
                      border: `2px solid ${a.bonificada ? '#22C55E' : '#D1D5DB'}`,
                      background: a.bonificada ? '#22C55E' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {a.bonificada && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: a.bonificada ? '#15803D' : '#9CA3AF' }}>
                    Bonif.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px dashed #D1D5DB', margin: '16px 0 14px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'end' }}>
          <Inp
            label="Total a cobrar $"
            type="number"
            value={f.totalAmount}
            onChange={(e) =>
              sv('totalAmount', e.target.value === '' ? '' : Number(e.target.value))
            }
          />
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
              Pagado $
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                value={f.paid}
                onChange={(e) => sv('paid', e.target.value === '' ? '' : Number(e.target.value))}
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
              />
              <button
                type="button"
                onClick={() => sv('paid', f.totalAmount)}
                style={{
                  padding: '0 12px',
                  background: '#D1FAE5',
                  color: '#065F46',
                  border: '1.5px solid #10B981',
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                Cobrar Total
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
          <div style={{ flex: 1, marginRight: 14 }}>
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
          </div>
          <div
            style={{
              background: saldoPendiente > 0 ? '#FEF2F2' : '#ECFDF5',
              padding: '10px 14px',
              borderRadius: 8,
              border: `1.5px solid ${saldoPendiente > 0 ? '#FECACA' : '#A7F3D0'}`,
              textAlign: 'right',
              minWidth: 130,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: saldoPendiente > 0 ? '#DC2626' : '#059669',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 2,
              }}
            >
              {saldoPendiente > 0 ? 'Saldo pendiente' : 'Cuenta saldada'}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: saldoPendiente > 0 ? '#B45309' : '#059669',
              }}
            >
              {currency(saldoPendiente)}
            </div>
          </div>
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
                <p style={{ fontSize: 13, color: '#374151', marginBottom: 16, lineHeight: 1.4 }}>
                  Ya hay una reserva actual de <b style={{ color: '#DC2626' }}>{conflicts.map(c => c.guestName).join(' y ')}</b> en estas fechas.
                  <br /><br />
                  ¿Deseas sobreescribir y guardar de todas formas?
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
                      fontWeight: 700,
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
                      border: '1.5px solid #FECACA',
                      borderRadius: 8,
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#DC2626',
                    }}
                  >
                    Sobreescribir
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
  onToggleBlacklist,
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
            // MAGIA: Si está en lista negra usa rojo oscuro, si no, usa el color exacto del estado en el calendario
            background: res.lista_negra 
              ? '#991B1B' 
              : (BLOCK_COLORS[res.status]?.bg || '#3B82F6'), 
            transition: 'background 0.3s ease',
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
              {/* Línea superior: Solo el nombre del Hostel limpio */}
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.75)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  marginBottom: 6,
                }}
              >
                {prop?.name}
              </div>
              {/* Línea principal: Nombre del Huésped + Placa de Habitación destacada */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  flexWrap: 'wrap' 
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                  {res.guestName}
                </span>
                {res.room && (
                  <span 
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.25)', // Fondo blanco translúcido cristal
                      color: '#fff', 
                      padding: '3px 9px', 
                      borderRadius: 6, 
                      fontSize: 13, 
                      fontWeight: 900, // Súper negrita
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      lineHeight: 1
                    }}
                  >
                    {res.room}
                  </span>
                )}
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
           <Badge status={res.status} large />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {res.lista_negra && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#fff',
                    background: '#DC2626',
                    padding: '2px 8px',
                    borderRadius: 20,
                  }}
                >
                  ⚠️ NO GRATO
                </span>
              )}
              {freq && !res.lista_negra && (
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: res.source === 'Booking' ? '#EFF6FF' : '#ECFDF5',
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: `1.5px solid ${res.source === 'Booking' ? '#BFDBFE' : '#A7F3D0'}`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: srcColor(res.source),
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: res.source === 'Booking' ? '#1E40AF' : '#065F46',
                  }}
                >
                  {srcLabel(res.source)}
                </span>
              </div>
            </div>
          </div>
          {/* FILA SUPERIOR: Tiempos de la estadía (3 columnas en línea) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              marginBottom: 8,
            }}
          >
            {[
              ['Check-in', fmtD(res.checkIn)],
              ['Check-out', fmtD(res.checkOut)],
              ['Duración', nights + ' noche' + (nights !== 1 ? 's' : '')],
            ].map(([l, v]) => (
              <div
                key={l}
                style={{
                  background: '#F9FAFB',
                  borderRadius: 10,
                  padding: '10px 4px',
                  border: '1px solid #F0F0F0',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 9.5,
                    color: '#9CA3AF',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: 2,
                  }}
                >
                  {l}
                </div>
                <div style={{ fontWeight: 700, color: '#111', fontSize: 12.5 }}>
                  {v}
                </div>
              </div>
            ))}
          </div>

          {/* FILA INFERIOR: Bloque masivo del Total General */}
          <div
            style={{
              background: '#F9FAFB',
              borderRadius: 10,
              padding: '12px 14px',
              border: '1px solid #F0F0F0',
              marginBottom: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Total Reserva
            </div>
            <div style={{ fontWeight: 800, color: '#111', fontSize: 16 }}>
              {currency(res.totalAmount)}
            </div>
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
          {(res.requiresInvoice || res.notes) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderBottom: '1px solid #F0F0F0', borderTop: '1px solid #F0F0F0', marginBottom: 14, background: '#FAFAFA' }}>
              {res.requiresInvoice && (
                <span style={{ fontSize: 12, color: '#7C3AED', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="invoice" size={14} /> Solicita factura fiscal
                </span>
              )}
              {res.notes && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', marginTop: 4 }}>
                  {/* Título en mayúsculas y pequeño como indicador */}
                  <span style={{ fontSize: 10, color: '#B45309', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    <Icon name="edit" size={13} /> Notas Internas
                  </span>
                  {/* Bloque de texto más grande, destacado y que respeta saltos de línea */}
                  <div style={{ fontSize: 13.5, color: '#78350F', fontWeight: 600, background: '#FEF3C7', padding: '8px 12px', borderRadius: 8, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                    {res.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {(res.url_ine_frente || res.url_ine_dorso) && (
            <div style={{ background: '#F0F9FF', borderRadius: 10, padding: '12px 16px', marginBottom: 14, border: '1px solid #BAE6FD' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', marginBottom: 8 }}>
                Documentos adjuntos
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {res.url_ine_frente && (
                  <a href={res.url_ine_frente} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
                    <div style={{ background: '#0284C7', color: '#fff', padding: '8px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
                      📷 Ver Frente
                    </div>
                  </a>
                )}
                {res.url_ine_dorso && (
                  <a href={res.url_ine_dorso} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
                    <div style={{ background: '#0284C7', color: '#fff', padding: '8px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
                      📷 Ver Dorso
                    </div>
                  </a>
                )}
              </div>
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
          
          {/* BOTÓN MÁGICO DE LISTA NEGRA */}
          <button
            onClick={() => onToggleBlacklist(res.id, res.lista_negra)}
            style={{
              width: '100%',
              padding: '10px',
              background: res.lista_negra ? '#FEF2F2' : '#fff',
              border: res.lista_negra ? '1.5px solid #FECACA' : '1px solid #E5E7EB',
              borderRadius: 8,
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              color: res.lista_negra ? '#DC2626' : '#4B5563',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            {res.lista_negra ? '⚠️ Quitar de Lista Negra' : '🚫 Marcar como No Grato'}
          </button>

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
                      <div style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span>{p?.name}{r.room ? ` · Hab.${r.room}` : ''}</span>
                        {/* NUEVO ETIQUETA BOOKING EN MOBILE */}
                        {r.source === 'Booking' && (
                          <span style={{ color: '#1E40AF', background: '#DBEAFE', padding: '2px 6px', borderRadius: 4, fontWeight: 800, fontSize: 10 }}>
                            Booking
                          </span>
                        )}
                        {r.requiresInvoice && <span style={{ color: '#7C3AED', fontWeight: 700 }}>· 🧾 Factura</span>}
                        {r.notes && <span style={{ color: '#D97706', fontWeight: 700 }}>· 📝 Notas</span>}
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
      
      {/* LEYENDA DE ESTADOS EN MOBILE */}
      <div style={{ marginTop: 20, padding: '12px 14px', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.4 }}>
          Leyenda de Estados
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(BLOCK_COLORS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151', fontWeight: 600 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: v.bg }} />
              <span style={{ textTransform: 'capitalize' }}>{k.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
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
  const NCOLS = isMobile ? 21 : 45,
    COL = 60,
    ROW = 62,
    LABEL = 70,
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
    const isPast = parseD(fmt(d)) < parseD(fmt(TODAY));
    if (fmt(d) === fmt(TODAY)) return '#EFF6FF'; 
    if (isPast) return '#F3F4F6'; 
    if (dow === 0 || dow === 6) return '#F5F3FF';
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
        const cutLeft = parseD(r.checkIn) < ws;
        const cutRight = parseD(r.checkOut) > we;
        const cs = Math.max(0, diffDays(fmt(ws), r.checkIn)),
          ce = Math.min(NCOLS, diffDays(fmt(ws), r.checkOut));
        const pxL = cs * COL + (cutLeft ? 0 : COL / 2);
        const pxR = ce * COL + (cutRight ? COL : COL / 2);

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
    if (e && e.stopPropagation) e.stopPropagation();
    setHdrDrag(null);
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
      setOffset(Math.max(-730, Math.min(730, hdrDrag.startOffset + dd)));
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
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {/* GRUPO IZQUIERDO: Título y Vistas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#111', letterSpacing: -0.5 }}>
            Calendario
          </h2>
          <div
            style={{
              display: 'flex',
              background: '#F1F5F9',
              borderRadius: 10,
              padding: 4,
              gap: 2,
            }}
          >
            <button
              onClick={() => setCalView('lista')}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                background: 'transparent',
                color: '#64748B',
                transition: 'all 0.2s'
              }}
            >
              📋 Lista
            </button>
            <button
              onClick={() => setCalView('timeline')}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                background: '#fff',
                color: '#1E40AF',
                boxShadow: '0 2px 4px rgba(0,0,0,.04)',
                transition: 'all 0.2s'
              }}
            >
              📅 Timeline
            </button>
          </div>
        </div>

        {/* GRUPO DERECHO: Navegación de Fechas y Acción Principal */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Navegador de fechas estilo "Píldora Unida" */}
          <div
            style={{
              display: 'flex',
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(0,0,0,.03)',
            }}
          >
            <button
              onClick={() => setOffset((s) => s - 7)}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderRight: '1px solid #E2E8F0',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: '#475569',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              ← 7d
            </button>
            <button
              onClick={() => {
                setOffset(-2);
                document.getElementById('calendario-scroll')?.scrollTo({ left: 0, behavior: 'smooth' });
              }}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRight: '1px solid #E2E8F0',
                background: '#F0F9FF',
                color: '#2563EB',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 800,
                fontFamily: 'inherit',
              }}
            >
              Hoy
            </button>
            <button
              onClick={() => setOffset((s) => s + 7)}
              style={{
                padding: '8px 14px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: '#475569',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              7d →
            </button>
          </div>

          {/* Botón de Acción Principal */}
          <button
            onClick={() => onAddRes()}
            style={{
              padding: '8px 16px',
              background: '#3B82F6',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 2px 6px rgba(59,130,246,.25)',
              transition: 'transform 0.1s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            + Reserva
          </button>
        </div>
      </div>
      <div
        id="calendario-scroll"  // <--- ¡AGREGAMOS ESTO!
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
                fontSize: 13,
                fontWeight: 800,
                color: '#374151',
                borderRight: '1px solid #E5E7EB',
                cursor: 'default',
                position: 'sticky',
                left: 0,
                background: '#F9FAFB',
                zIndex: 30,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              Itzé
            </div>
            {days.map((d, i) => {
              const it = fmt(d) === fmt(TODAY),
                dow = d.getDay();
              const isPast = parseD(fmt(d)) < parseD(fmt(TODAY)); 
              
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
                      color: it ? '#1E40AF' : isPast ? '#D1D5DB' : '#9CA3AF',
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
                    : isPast
                    ? '#9CA3AF'
                    : dow === 0 || dow === 6
                    ? '#8B5CF6' 
                    : '#374151',
                    }}
                  >
                    {d.getDate()}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: it ? '#1E40AF' : isPast ? '#D1D5DB' : '#9CA3AF',
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
                    zIndex: 25,
                    position: 'sticky',
                    left: 0,
                    borderLeft: `3px solid ${row.prop.color}`,
                  }}
                >
                  {row.type === 'room' ? (
                    <div style={{ width: '100%' }}>
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
                        fmt(d) === fmt(TODAY) ? '#DBEAFE' : getCellBg(d),
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
                  const H = ROW - 12; 
                  const W = Math.max(4, r.pxR - r.pxL - 4);
                  const isDrag = drag && drag.id === r.id;
                  const cid = `c${r.id}`;
                  const tx = (r.cutLeft ? 8 : Math.min(14, W * 0.2) + 4) + (r.source === 'Booking' ? 4 : 0);

                  const D = Math.min(10, W * 0.25);
                  const ptTopLeft = r.cutLeft ? '0,0' : `${D},0`;
                  const ptTopRight = r.cutRight ? `${W},0` : `${W},0`; 
                  const ptBottomRight = r.cutRight
                    ? `${W},${H}`
                    : `${W - D},${H}`; 
                  const ptBottomLeft = r.cutLeft ? `0,${H}` : `0,${H}`; 
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
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        const fakeEvent = { touches: [touch] };
                        
                        const timer = setTimeout(() => {
                          startDrag(fakeEvent, r, row);
                          if (window.navigator && window.navigator.vibrate) {
                            window.navigator.vibrate(40);
                          }
                        }, 400); 
                        lpt[1](timer);
                      }}
                      onTouchMove={() => {
                        if (lpt[0]) {
                          clearTimeout(lpt[0]);
                          lpt[1](null);
                        }
                      }}
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
                          {/* NUEVA MARCA VISUAL BOOKING EN PC */}
                          {r.source === 'Booking' && (
                            <rect
                              x={0}
                              y={0}
                              width={r.cutLeft ? 6 : 8}
                              height={H}
                              fill="#1E40AF"
                              clipPath={`url(#${cid})`}
                            />
                          )}
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
                            {r.source === 'Booking' ? '🔵 ' : ''}
                            {r.guestName}
                            {r.companions?.length > 0
                              ? ` +${r.companions.length}`
                              : ''}{' '}
                            ({srcShort(r.source)})
                          </text>
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
                            {r.source === 'Booking' ? '🔵 ' : ''}
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
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                width: '100%',
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
  
  return (
    <div>
      <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
          }}
        >
          {TODAY.toLocaleDateString('es-MX', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })}
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 900,
            color: '#0F172A',
            letterSpacing: -0.6,
          }}
        >
          Panorama de hoy
        </h2>
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
            val: (() => {
              const totalRooms = properties.reduce((s, p) => s + (p.rooms || 1), 0);
              return totalRooms > 0 
                ? Math.round((active.length / totalRooms) * 100) + '%' 
                : '0%';
            })(),
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
      {/* 📥 SECCIÓN DE INGRESOS DE HOY */}
      {ciToday.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 800,
              color: '#059669',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            📥 Ingresos de hoy ({ciToday.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ciToday.map((r) => {
              const prop = PROPS.find((p) => p.id === r.propertyId);
              return (
                <div
                  key={r.id + 'in'}
                  onClick={() => onGoTo('abrir_reserva', r)}
                  style={{
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    border: '1px solid #F0F0F0',
                    cursor: 'pointer',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.05)')}
                  onMouseOut={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: '#D1FAE5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                  >
                    📥
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
                        {r.guestName}
                      </span>
                      {r.room && (
                        <span 
                          style={{ 
                            background: '#F1F5F9', 
                            color: '#475569', 
                            padding: '1px 6px', 
                            borderRadius: 5, 
                            fontSize: 11, 
                            fontWeight: 800, 
                            border: '1px solid #E2E8F0',
                            lineHeight: 1
                          }}
                        >
                          {r.room}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                      {prop?.name}
                    </div>
                  </div>
                  <Badge status={r.status} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 📤 SECCIÓN DE SALIDAS DE HOY */}
      {coToday.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 800,
              color: '#D97706',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            📤 Salidas de hoy ({coToday.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {coToday.map((r) => {
              const prop = PROPS.find((p) => p.id === r.propertyId);
              return (
                <div
                  key={r.id + 'out'}
                  onClick={() => onGoTo('abrir_reserva', r)}
                  style={{
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    border: '1px solid #F0F0F0',
                    cursor: 'pointer',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.05)')}
                  onMouseOut={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: '#FEE2E2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                  >
                    📤
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
                        {r.guestName}
                      </span>
                      {r.room && (
                        <span 
                          style={{ 
                            background: '#F1F5F9', 
                            color: '#475569', 
                            padding: '1px 6px', 
                            borderRadius: 5, 
                            fontSize: 11, 
                            fontWeight: 800, 
                            border: '1px solid #E2E8F0',
                            lineHeight: 1
                          }}
                        >
                          {r.room}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                      {prop?.name}
                    </div>
                  </div>
                  <Badge status={r.status} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PROPERTIES PAGE (NOTAS Y CHECKLIST DE TAREAS - DISEÑO PREMIUM) ───────────
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
  onGoTo, 
}) {
  const [ap, setAp] = useState(initProp || properties[0]?.id);
  const [sub, setSub] = useState('notas'); // Por defecto arranca en Notas
  const [editNote, setEditNote] = useState(false);
  const [newItemText, setNewItemText] = useState(''); 

  const prop = properties.find((p) => p.id === ap);
  
  // Resguardo por si el estado dinámico aún no se cargó
  const currentChecklist = checklists[ap] || { items: [], checked: {} };
  const items = currentChecklist.items || [];
  const checked = currentChecklist.checked || {};
  const done = Object.values(checked).filter(Boolean).length;

  // Agregar una nueva tarea operativa
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    
    setChecklists((prev) => {
      const propData = prev[ap] || { items: [], checked: {} };
      return {
        ...prev,
        [ap]: {
          ...propData,
          items: [...(propData.items || []), newItemText.trim()]
        }
      };
    });
    setNewItemText('');
  };

  // Eliminar una tarea operativa específica
  const handleRemoveItem = (indexToRemove) => {
    setChecklists((prev) => {
      const propData = prev[ap] || { items: [], checked: {} };
      const newItems = (propData.items || []).filter((_, idx) => idx !== indexToRemove);
      
      const newChecked = {};
      Object.keys(propData.checked || {}).forEach((key) => {
        const numericKey = parseInt(key, 10);
        if (numericKey < indexToRemove) {
          newChecked[numericKey] = propData.checked[numericKey];
        } else if (numericKey > indexToRemove) {
          newChecked[numericKey - 1] = propData.checked[numericKey];
        }
      });

      return {
        ...prev,
        [ap]: { items: newItems, checked: newChecked }
      };
    });
  };

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
      
      {/* Selector superior de Propiedades */}
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
              setSub('notas'); 
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
          {/* Encabezado Principal */}
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
                <div style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'capitalize' }}>
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
                color: PS[propStatus[ap]]?.color || '#10B981',
                background: PS[propStatus[ap]]?.bg || '#D1FAE5',
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

          {/* ── NUEVO REDISEÑO DE BOTONES: CONTROL SEGMENTADO MODERNO (PULSE/iOS STYLE) ── */}
          <div 
            style={{ 
              display: 'flex', 
              background: '#E2E8F0', 
              borderRadius: 12, 
              padding: 4, 
              gap: 4, 
              marginBottom: 16 
            }}
          >
            <button
              onClick={() => setSub('notas')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 9,
                border: 'none',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                background: sub === 'notas' ? '#fff' : 'transparent',
                color: sub === 'notas' ? '#1E293B' : '#64748B',
                boxShadow: sub === 'notas' ? '0 2px 6px rgba(0,0,0,.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s ease'
              }}
            >
              📝 Notas Internas
            </button>
            <button
              onClick={() => setSub('tareas')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 9,
                border: 'none',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                background: sub === 'tareas' ? '#fff' : 'transparent',
                color: sub === 'tareas' ? '#1E293B' : '#64748B',
                boxShadow: sub === 'tareas' ? '0 2px 6px rgba(0,0,0,.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s ease'
              }}
            >
              📋 Tareas Operativas
            </button>
          </div>

          {/* VISTA: NOTAS */}
          {sub === 'notas' && (
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 20,
                border: '1px solid #F0F0F0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>
                  Notas internas de la propiedad
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
                    Guardar Notas
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
                  {notes[ap] || 'Sin notas registradas para esta propiedad.'}
                </pre>
              )}
            </div>
          )}

          {/* VISTA: TAREAS OPERATIVAS (CHECKLIST EDITABLE) */}
          {sub === 'tareas' && (
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 20,
                border: '1px solid #F0F0F0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>
                    Control de Tareas Operativas
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {done}/{items.length} completados
                  </div>
                </div>
                <button
                  onClick={() => setChecklists((c) => ({ ...c, [ap]: { items: items, checked: {} } }))}
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
                  ↺ Desmarcar Todo
                </button>
              </div>

              {/* Barra de Progreso */}
              <div
                style={{
                  height: 5,
                  background: '#F3F4F6',
                  borderRadius: 4,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: '#10B981',
                    borderRadius: 4,
                    width: items.length > 0 ? Math.round((done / items.length) * 100) + '%' : '0%',
                    transition: 'width .3s',
                  }}
                />
              </div>

              {/* Formulario para agregar ítems */}
              <form onSubmit={handleAddItem} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                <input 
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Ej: Comprar bombilla para baño P1..."
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: 8,
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '9px 14px',
                    background: '#10B981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  + Ítem
                </button>
              </form>

              {/* Lista de tareas */}
              {items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid #F9FAFB',
                    gap: 12
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      border: `1.5px solid ${checked[i] ? '#10B981' : '#D1D5DB'}`,
                      background: checked[i] ? '#10B981' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      cursor: 'pointer'
                    }}
                    onClick={() =>
                      setChecklists((c) => ({
                        ...c,
                        [ap]: {
                          items: items,
                          checked: { ...checked, [i]: !checked[i] }
                        }
                      }))
                    }
                  >
                    {checked[i] && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
                  </div>
                  
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: checked[i] ? '#D1D5DB' : '#374151',
                      textDecoration: checked[i] ? 'line-through' : 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() =>
                      setChecklists((c) => ({
                        ...c,
                        [ap]: {
                          items: items,
                          checked: { ...checked, [i]: !checked[i] }
                        }
                      }))
                    }
                  >
                    {item}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(i)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#EF4444',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 700,
                      padding: '0 6px',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}

              {items.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '20px 0', fontSize: 12 }}>
                  No hay tareas en el checklist. ¡Agrega una arriba!
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
// ── GUESTS PAGE (DIRECTORIO CRM) ──────────────────────────────────────────────
function GuestsPage({ reservations, properties, onView }) {
  const [q, setQ] = useState('');
  
  // Agrupamos el historial de los clientes
  const gdb = buildGuestDB(reservations);
  
  // Filtramos por búsqueda (nombre o documento)
  const allGuests = Object.values(gdb).filter(g => 
    !q || 
    g.name.toLowerCase().includes(q.toLowerCase()) || 
    (g.doc && g.doc.toLowerCase().includes(q.toLowerCase()))
  );

  // Ordenamos por los que más dinero han dejado (los mejores clientes primero)
  allGuests.sort((a, b) => b.totalSpent - a.totalSpent);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#111' }}>Directorio CRM</h2>
        <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Gestión de fidelización y valor de clientes</p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o documento..."
        style={{
          width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10,
          fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 16, boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {allGuests.map((g, idx) => {
          const freq = freqBadge(g.stays.length);
          // Obtenemos la última reserva para ver sus detalles rápidos
          const lastRes = reservations.find(r => r.id === g.stays[g.stays.length - 1]);

          return (
            <div
              key={idx}
              onClick={() => lastRes && onView(lastRes)}
              style={{
                background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #F0F0F0',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12,
                boxShadow: '0 2px 6px rgba(0,0,0,.02)', transition: 'transform 0.1s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Avatar name={g.name} size={46} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {g.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    <span>{g.doc || 'Sin DOC'}</span>
                    {freq && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: freq.color, background: freq.bg, padding: '2px 6px', borderRadius: 6 }}>
                        {freq.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#F8FAFC', borderRadius: 8, padding: '10px', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Visitas</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#374151' }}>{g.stays.length}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Inversión</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#10B981' }}>{currency(g.totalSpent)}</div>
                </div>
              </div>

              {g.phone && lastRes && (
                <a
                  href={waLink(g.phone, lastRes.guestPhonePrefix, lastRes.guestNationality)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    width: '100%', padding: '8px', borderRadius: 8, background: '#ECFDF5', color: '#059669',
                    textDecoration: 'none', fontWeight: 700, fontSize: 12, border: '1px solid #A7F3D0'
                  }}
                >
                  <Icon name="whatsapp" size={16} /> Enviar WhatsApp
                </a>
              )}
            </div>
          );
        })}
        
        {allGuests.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#D1D5DB', padding: 40, fontSize: 13 }}>
            No se encontraron clientes.
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

    // ORDENAMOS CRONOLÓGICAMENTE POR CHECK-IN (Comparación de Strings ISO para evitar bugs UTC)
    const reservasOrdenadas = [...reservations].sort((a, b) => a.checkIn.localeCompare(b.checkIn));

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

    // ORDENAMOS TAMBIÉN EL HISTORIAL DE ELIMINADAS (Comparación de Strings ISO para evitar bugs UTC)
    const eliminadasOrdenadas = [...(eliminadasDB || [])].sort((a, b) => (a.fecha_ingreso || '').localeCompare(b.fecha_ingreso || ''));

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
function FinancePage({ reservations, allRes, properties, user, restoreRes, onGoTo }) {
  const [showTrash, setShowTrash] = useState(false);
  const pending = reservations.filter(
    (r) => r.status !== 'cancelada' && r.paid < r.totalAmount
  );
  const deleted = (allRes || []).filter((r) => r.deleted);

  // --- NUEVA LÓGICA: AGRUPACIÓN MENSUAL ---
  const monthlyStats = reservations.reduce((acc, r) => {
    // Ignoramos las canceladas para la contabilidad real (y prevenimos pantalla blanca si no hay fecha)
    if (r.status === 'cancelada' || !r.checkIn) return acc;
    
    // Extraemos Año y Mes del Check-in (ej: "2026-06-12" -> y:"2026", m:"06")
    const [y, m] = r.checkIn.split('-');
    const key = `${y}-${m}`;
    
    if (!acc[key]) {
      const mName = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][parseInt(m, 10) - 1];
      acc[key] = { key, label: `${mName} ${y}`, total: 0, paid: 0, count: 0 };
    }
    acc[key].total += (r.totalAmount || 0);
    acc[key].paid += (r.paid || 0);
    acc[key].count += 1;
    
    return acc;
  }, {});

  // Convertimos a array y ordenamos (del mes más reciente al más antiguo)
  const monthlyArray = Object.values(monthlyStats).sort((a, b) => b.key.localeCompare(a.key));
  // ----------------------------------------

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

      {/* SECCIÓN 1: DESGLOSE MENSUAL */}
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: 15,
          fontWeight: 700,
          color: '#374151',
        }}
      >
        Reporte Mensual
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
          gap: 12,
          marginBottom: 28,
        }}
      >
        {monthlyArray.map((m) => {
          const saldo = m.total - m.paid;
          const pct = m.total > 0 ? Math.round((m.paid / m.total) * 100) : 0;
          return (
            <div
              key={m.key}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '16px',
                border: '1px solid #F0F0F0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: '#111',
                    textTransform: 'capitalize',
                  }}
                >
                  {m.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#9CA3AF',
                    fontWeight: 600,
                  }}
                >
                  {m.count} reservas
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#6B7280' }}>Facturado:</span>
                <span style={{ fontWeight: 700, color: '#111' }}>
                  {currency(m.total)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#6B7280' }}>Cobrado:</span>
                <span style={{ fontWeight: 700, color: '#10B981' }}>
                  {currency(m.paid)}
                </span>
              </div>

              <div
                style={{
                  height: 4,
                  background: '#F3F4F6',
                  borderRadius: 4,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: '#10B981',
                    borderRadius: 4,
                    width: `${pct}%`,
                    transition: 'width .3s',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTop: '1px dashed #E5E7EB',
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#6B7280', fontWeight: 600 }}>
                  Por cobrar:
                </span>
                <span
                  style={{
                    fontWeight: 800,
                    color: saldo > 0 ? '#EF4444' : '#9CA3AF',
                  }}
                >
                  {currency(saldo)}
                </span>
              </div>
            </div>
          );
        })}
        {monthlyArray.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              color: '#D1D5DB',
              padding: 20,
              fontSize: 13,
            }}
          >
            No hay reservas registradas.
          </div>
        )}
      </div>

      {/* SECCIÓN 2: DESGLOSE POR PROPIEDAD */}
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: 15,
          fontWeight: 700,
          color: '#374151',
        }}
      >
        Totales por Propiedad
      </h3>
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
                      {pRes.length} reservas históricas
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
                {pct}% cobrado general
              </div>
            </div>
          );
        })}
      </div>

      {/* SECCIÓN 3: SALDOS PENDIENTES */}
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: 15,
          fontWeight: 700,
          color: '#374151',
        }}
      >
        Huéspedes con saldos pendientes
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pending.map((r) => {
          const prop = properties.find((p) => p.id === r.propertyId);
          return (
            <div
              key={r.id}
              onClick={() => onGoTo && onGoTo('abrir_reserva', r)} // <--- ¡ABRE LA RESERVA AL HACER CLIC!
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid #F0F0F0',
                cursor: 'pointer', // <--- PONE LA MANITO INTERACTIVA
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)')}
              onMouseOut={(e) => (e.currentTarget.style.boxShadow = 'none')}
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
// ── RESERVATIONS LIST (AGENDA DIARIA ESTILO PULSE) ────────────────────────────
function ResList({ reservations, properties, onView, onAdd }) {
  const [selectedDate, setSelectedDate] = useState(fmt(TODAY));
  const [q, setQ] = useState('');

  // Generamos un carrusel de 60 días (15 días al pasado y 45 al futuro)
  const ribbonDates = Array.from({ length: 60 }, (_, i) => addDays(TODAY, i - 15));

  // Auto-scroll para centrar el día seleccionado
  useEffect(() => {
    if (!q) {
      const el = document.getElementById(`date-${selectedDate}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedDate, q]);

  // Si hay búsqueda, mostramos lista plana. Si no, mostramos la Agenda del Día.
  const isSearching = q.length > 0;
  const searchedRes = isSearching
    ? reservations
        .filter((r) => r.guestName.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
    : [];

  // Lógica de Agenda del Día Seleccionado
  const llegadas = reservations.filter(r => r.checkIn === selectedDate && r.status !== 'cancelada');
  const salidas = reservations.filter(r => r.checkOut === selectedDate && r.status !== 'cancelada');
  const hospedados = reservations.filter(r => r.checkIn < selectedDate && r.checkOut > selectedDate && r.status !== 'cancelada');
  const canceladas = reservations.filter(r => r.checkIn === selectedDate && r.status === 'cancelada');

  // Componente interno para dibujar cada tarjetita de reserva
  const ResCard = ({ r }) => {
    const prop = properties.find((p) => p.id === r.propertyId);
    const saldo = r.totalAmount - r.paid;
    return (
      <div
        onClick={() => onView(r)}
        style={{
          background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #F0F0F0',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,.02)', marginBottom: 8, gap: 12
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          
          {/* Fila Principal: Nombre + Habitación Destacada + WhatsApp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{r.guestName}</div>
            
            {r.room && (
              <span 
                style={{ 
                  background: '#F1F5F9', 
                  color: '#475569', 
                  padding: '1px 6px', 
                  borderRadius: 5, 
                  fontSize: 11, 
                  fontWeight: 800, 
                  border: '1px solid #E2E8F0',
                  lineHeight: 1
                }}
              >
                {r.room}
              </span>
            )}

            {r.guestPhone && (
              <a
                href={waLink(r.guestPhone, r.guestPhonePrefix, r.guestNationality)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: '#ECFDF5',
                  color: '#059669',
                  border: '1px solid #A7F3D0',
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
                title="Enviar WhatsApp"
                onMouseOver={(e) => (e.currentTarget.style.background = '#D1FAE5')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#ECFDF5')}
              >
                <Icon name="whatsapp" size={14} />
              </a>
            )}
          </div>

          {/* Fila Secundaria: Propiedad */}
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
            {prop?.name}
          </div>

          {/* Fila Inferior: Fechas de Estadía */}
          <div style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', marginTop: 4, display: 'flex', gap: 6 }}>
            <span>CI: {fmtD(r.checkIn)}</span>
            <span>CO: {fmtD(r.checkOut)}</span>
          </div>
        </div>

        {/* Lado Derecho: Estado y Saldos */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <Badge status={r.status} />
          {saldo > 0 ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#EF4444' }}>Debe {currency(saldo)}</span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#10B981' }}>Pagado</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}>Agenda Diaria</h2>
        <button
          onClick={() => onAdd()}
          style={{
            padding: '8px 16px', background: '#3B82F6', border: 'none', borderRadius: 8,
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + Nueva
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre de huésped..."
        style={{
          width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10,
          fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 16, boxSizing: 'border-box',
        }}
      />

      {isSearching ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase' }}>
            Resultados de búsqueda ({searchedRes.length})
          </div>
          {searchedRes.map((r) => <ResCard key={r.id} r={r} />)}
          {searchedRes.length === 0 && <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>No se encontraron huéspedes.</div>}
        </div>
      ) : (
        <>
          {/* CARRUSEL DE FECHAS ESTILO PULSE */}
          <div style={{ display: 'flex', overflowX: 'auto', gap: 8, paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid #E5E7EB', scrollBehavior: 'smooth' }} className="hide-scroll">
            {ribbonDates.map((d) => {
              const dStr = fmt(d);
              const isSelected = selectedDate === dStr;
              const isToday = fmt(TODAY) === dStr;
              const hasActivity = reservations.some(r => (r.checkIn === dStr || r.checkOut === dStr) && r.status !== 'cancelada');
              
              return (
                <div
                  id={`date-${dStr}`}
                  key={dStr}
                  onClick={() => setSelectedDate(dStr)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minWidth: 48, height: 56, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                    background: isSelected ? '#3B82F6' : isToday ? '#EFF6FF' : '#fff',
                    border: `1.5px solid ${isSelected ? '#3B82F6' : isToday ? '#BFDBFE' : '#E5E7EB'}`,
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: isSelected ? 'rgba(255,255,255,0.8)' : '#6B7280' }}>
                    {DAYS[d.getDay()]}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: isSelected ? '#fff' : '#111' }}>
                    {d.getDate()}
                  </span>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: hasActivity ? (isSelected ? '#fff' : '#10B981') : 'transparent', marginTop: 2 }} />
                </div>
              );
            })}
          </div>

          {/* DESGLOSE DEL DÍA */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 16 }}>
              {selectedDate === fmt(TODAY) ? 'Hoy, ' : ''} {parseD(selectedDate).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>

            {llegadas.length === 0 && salidas.length === 0 && hospedados.length === 0 && canceladas.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 30, fontSize: 13, background: '#fff', borderRadius: 12, border: '1px dashed #E5E7EB' }}>
                No hay movimientos registrados para este día.
              </div>
            )}

            {llegadas.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, color: '#059669', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📥 Llegadas ({llegadas.length})
                </h3>
                {llegadas.map(r => <ResCard key={r.id} r={r} />)}
              </div>
            )}

            {salidas.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, color: '#D97706', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📤 Salidas ({salidas.length})
                </h3>
                {salidas.map(r => <ResCard key={r.id} r={r} />)}
              </div>
            )}

            {hospedados.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, color: '#2563EB', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
  🛏️ Alojados ({hospedados.length})
</h3>
                {hospedados.map(r => <ResCard key={r.id} r={r} />)}
              </div>
            )}

            {canceladas.length > 0 && (
              <div style={{ marginBottom: 20, opacity: 0.7 }}>
                <h3 style={{ fontSize: 12, color: '#DC2626', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🚫 Canceladas ({canceladas.length})
                </h3>
                {canceladas.map(r => <ResCard key={r.id} r={r} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
// ── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [uid, setUid] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  const go = () => {
    const u = USERS.find((x) => x.id === uid && x.password === pw);
    if (u) onLogin(u);
    else setErr('Usuario o contraseña incorrectos');
  };

  const handleRecovery = () => {
    // Aquí a futuro se conecta la API para mandar el mail real
    setRecoverySent(true);
    // Vuelve a su estado normal después de 5 segundos
    setTimeout(() => setRecoverySent(false), 5000); 
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <img src="https://i.postimg.cc/3NDCCVdT/gecko2.png" alt="Itzé" style={{ width: 80, height: 80, objectFit: 'contain' }} />
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
            placeholder="Usuario"
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
          
          {/* SECCIÓN: RECUPERACIÓN DE DATOS */}
          <div style={{ marginTop: 24, textAlign: 'center', height: 40 }}>
            {recoverySent ? (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  color: '#34D399',
                  padding: '10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ✓ Los datos fueron enviados a itzehostel@gmail.com
              </div>
            ) : (
              <button
                onClick={handleRecovery}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,.4)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                }}
              >
                Olvidé mis datos de ingreso
              </button>
            )}
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
    gecko: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M18.5,3c-1.5,0-2.8,0.6-3.8,1.6l-1.2,1.2C12.8,5.4,12.2,5.2,11.5,5.2c-1.8,0-3.3,1.3-3.7,3.1c-0.1,0.5-0.1,1,0,1.5 c-0.6,0.3-1,0.9-1,1.6c0,1,0.8,1.8,1.8,1.8c0.5,0,1-0.2,1.3-0.6c0.8,0.5,1.7,0.7,2.7,0.6l1.3,1.3c1,1,1.6,2.3,1.6,3.8 c0,2.8-2.2,5-5,5s-5-2.2-5-5c0-1.5,0.6-2.8,1.6-3.8l1.3-1.3c0.9,0.1,1.8-0.1,2.6-0.6c0.3,0.4,0.8,0.6,1.3,0.6c1,0,1.8-0.8,1.8-1.8 c0-0.7-0.4-1.3-1-1.6c0.1-0.5,0.1-1,0-1.5c-0.4-1.8-1.9-3.1-3.7-3.1c-0.7,0-1.3,0.2-1.8,0.5L6.6,5.8C5.6,4.8,4.3,4.2,2.8,4.2" />
      </svg>
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

  // 1. CARGA DE DATOS Y VIGILANTE DE INICIO
  useEffect(() => {
    const fetchReservas = async () => {
      const { data, error } = await supabase
        .from('reservas')
        .select('*')
        .is('fecha_eliminacion', null);

      if (error) {
        console.error('Error al cargar reservas:', error);
        return;
      }

      // Hora actual estricta en Progreso, Yucatán
      const nowMerida = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Merida" }));
      const horaActual = nowMerida.getHours();
      const hoyFmt = fmt(nowMerida);

      const reservasCargadas = data.map((item) => {
        const nacionalidad = item.nacionalidad || 'MX';
        const pais = COUNTRIES.find((c) => c.code === nacionalidad);
        const prefijo = pais ? pais.prefix : '+52';

        let telefonoLimpio = item.telefono || '';
        if (telefonoLimpio.startsWith(prefijo)) {
          telefonoLimpio = telefonoLimpio.replace(prefijo, '').trim();
        }

        let estado = item.estado || 'por_llegar';
        let fechaCheckout = item.fecha_salida || '';

        // ── AUTO CHECK-OUT AL CARGAR LA APP (Si ya pasaron las 11:00 AM) ──
        if (horaActual >= 11 && estado === 'hospedado' && fechaCheckout <= hoyFmt) {
            estado = 'finalizada';
            supabase.from('reservas').update({ estado: 'finalizada' }).eq('id', item.id).then();
        }

        return {
          id: item.id,
          propertyId: item.propiedad || 'hostel',
          guestName: item.huesped || '',
          room: item.habitacion || '',
          checkIn: item.fecha_ingreso || '',
          checkOut: fechaCheckout,
          status: estado,
          totalAmount: Number(item.monto) || 0,
          paid: Number(item.monto_pagado) || 0,
          source: item.canal || 'Directo — Puerta',
          guestNationality: nacionalidad,
          guestDocType: item.tipo_doc || '',
          guestDoc: item.num_doc || '',
          guestPhonePrefix: prefijo,
          guestPhone: telefonoLimpio,
          guestEmail: item.email || '',
          totalGuests: Number(item.cantidad_huespedes) || 1,
          companions: item.acompanantes || [],
          paymentMethod: item.forma_pago || 'Efectivo',
          url_ine_frente: item.url_ine_frente || null,
          url_ine_dorso: item.url_ine_dorso || null,
          pricing: {
                ratePerNight: Number(item.tarifa_base) || 0,
                discountType: item.tipo_descuento || (Number(item.descuento) > 0 ? 'monto_fijo' : 'ninguno'),
                discountValue: Number(item.descuento) || 0,
                rateLabel: '',
                discountReason: item.motivo_descuento || '',
                additionals: Array.isArray(item.adicionales) ? item.adicionales : []
              },
          notes: item.notas || '',
          notas: item.notas || '',
          requiresInvoice: item.solicita_factura === 'true' || item.solicita_factura === true,
          solicita_factura: item.solicita_factura === 'true' || item.solicita_factura === true, // <--- ¡AQUÍ ESTÁ LA COMA QUE FALTABA!
          lista_negra: item.lista_negra === true || item.lista_negra === 'true'
        };
      });

      setRes(reservasCargadas);
    };

    fetchReservas();

    const canalReservas = supabase
      .channel('cambios-en-vivo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        (payload) => {
          setTimeout(() => {
            fetchReservas(); 
          }, 500);
        }
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchReservas();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(canalReservas);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // 2. VIGILANTE SILENCIOSO EN TIEMPO REAL (Por si la App queda abierta)
  useEffect(() => {
    const vigilante = setInterval(() => {
      const nowMerida = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Merida" }));
      
      if (nowMerida.getHours() >= 11) {
        const hoyFmt = fmt(nowMerida);
        
        setRes((prevRes) => {
          const paraHacerCheckout = prevRes.filter(r => r.status === 'hospedado' && r.checkOut <= hoyFmt);
          
          if (paraHacerCheckout.length === 0) return prevRes; // Todo en orden
          
          console.log(`⏰ 11:00 AM en Mérida: Haciendo check-out automático para ${paraHacerCheckout.length} reservas.`);
          
          // Actualiza en Supabase silenciosamente
          paraHacerCheckout.forEach(r => {
            supabase.from('reservas').update({ estado: 'finalizada' }).eq('id', r.id).then();
          });

          // Actualiza visualmente en tiempo real
          return prevRes.map(r => 
            paraHacerCheckout.some(pc => pc.id === r.id) 
              ? { ...r, status: 'finalizada', checkOutAt: nowMerida.toISOString() } 
              : r
          );
        });
      }
    }, 60000); // Revisa cada minuto

    return () => clearInterval(vigilante);
  }, []);

  // Estados restaurados: Las "memorias" que controlan tu interfaz
  const [drawer, setDrawer] = useState(null);
  const [modal, setModal] = useState(null);
  const [ciModal, setCiModal] = useState(null);
  const [coModal, setCoModal] = useState(null);
  const [propStatus, setPropStatus] = useState({});
  const [notes, setNotes] = useState({});
  // Estado dinámico para el Checklist Editable por propiedad
  const [checklists, setChecklists] = useState({
    hostel: {
      items: [
        'Cambio de sábanas y toallas',
        'Limpieza profunda de baño',
        'Barrido y trapeado de pisos',
        'Vaciado de basureros',
        'Reposición de papel y amenidades',
        'Revisión de luces y aire acondicionado'
      ],
      checked: {} // Guarda las tareas que ya se completaron (índice: true/false)
    }
  });
  const [calView, setCalView] = useState('timeline');
  const [prefill, setPrefill] = useState({});
  const [toastMsg, setToastMsg] = useState(null); 

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
  const goTo = (newTab, data) => {
    if (newTab === 'abrir_reserva') {
      setDrawer(data); // ¡Esto abre el panel lateral (Drawer) automáticamente con la reserva!
    } else {
      setTab(newTab);
    }
  };
  const saveRes = async (newRes) => {
    try {
      // Evaluamos si el tilde está activo en cualquiera de sus variantes
      const tieneFactura = newRes.requiresInvoice === true || newRes.requiresInvoice === 'true' || newRes.solicita_factura === true || newRes.solicita_factura === 'true';
      
      // Limpieza preventiva antes de guardar por si el usuario repitió el prefijo a mano
      let telefonoLimpioGuardar = (newRes.guestPhone || '').trim();
      if (newRes.guestPhonePrefix && telefonoLimpioGuardar.startsWith(newRes.guestPhonePrefix)) {
        telefonoLimpioGuardar = telefonoLimpioGuardar.replace(newRes.guestPhonePrefix, '').trim();
      }

      const datosLimpios = {
          huesped: newRes.guestName || 'Sin nombre',
          habitacion: newRes.room || null,
          fecha_ingreso: newRes.checkIn,
          fecha_salida: newRes.checkOut,
          estado: newRes.status || 'por_llegar',
          monto: String(newRes.totalAmount || ''),
          monto_pagado: String(newRes.paid || ''),
          canal: newRes.source || 'Directo — Puerta',
          nacionalidad: newRes.guestNationality || '',
          tipo_doc: newRes.guestDocType || '',
          num_doc: newRes.guestDoc || '',
          telefono: newRes.guestPhonePrefix ? `${newRes.guestPhonePrefix} ${telefonoLimpioGuardar}` : telefonoLimpioGuardar,
          email: newRes.guestEmail || '',
          cantidad_huespedes: String(newRes.totalGuests || 1),
          acompanantes: newRes.companions || [],
          forma_pago: newRes.paymentMethod || 'Efectivo',
          notas: String(newRes.notes || newRes.notas || ''),
          url_ine_frente: newRes.url_ine_frente || null,
          url_ine_dorso: newRes.url_ine_dorso || null,
          tarifa_base: String(newRes.pricing?.ratePerNight || ''),
          descuento: String(newRes.pricing?.discountValue || 0),
          tipo_descuento: newRes.pricing?.discountType || 'ninguno',
          motivo_descuento: newRes.pricing?.discountReason || '',
          adicionales: newRes.pricing?.additionals || [],
          solicita_factura: tieneFactura ? 'true' : 'false',  
          lista_negra: newRes.lista_negra || false
        };

      // Mantenemos duplicados los formatos en el estado de React para no romper las vistas
      const reservaParaEstado = {
        ...newRes,
        notes: newRes.notes || newRes.notas || '',
        notas: newRes.notes || newRes.notas || '',
        requiresInvoice: tieneFactura,
        solicita_factura: tieneFactura, 
        lista_negra: newRes.lista_negra || false,
      };

      if (newRes.id) {
        // 1. EDICIÓN
        const { error } = await supabase
          .from('reservas')
          .update(datosLimpios)
          .eq('id', newRes.id);

        if (error) throw error;
        setRes(res.map((r) => (r.id === newRes.id ? reservaParaEstado : r)));

      } else {
        // 2. NUEVA RESERVA
        const momentoExacto = new Date().toLocaleString('es-MX', {
          timeZone: 'America/Merida',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
        const responsable = user?.name || 'Usuario desconocido';

        datosLimpios.fecha_carga = momentoExacto;
        datosLimpios.usuario_carga = responsable;

        const { data, error } = await supabase
          .from('reservas')
          .insert([datosLimpios])
          .select();

        if (error) throw error;

        reservaParaEstado.fecha_carga = momentoExacto;
        reservaParaEstado.usuario_carga = responsable;

       if (data && data.length > 0) {
          setRes([...res, { ...reservaParaEstado, id: data[0].id }]);
        } else {
          setRes([...res, { ...reservaParaEstado, id: 'r' + Date.now() }]);
        }
      }

      setModal(null);
      
      // Lanzamos el cartel flotante y lo borramos al segundo y medio
      setToastMsg('Reserva guardada');
      setTimeout(() => setToastMsg(null), 1500);

    } catch (err) {
      console.error('Error al conectar con la base de datos:', err);
      alert('Hubo un problema al guardar la reserva en la nube: ' + err.message);
    }
  };
  const updateRes = async (id, changes) => {
    // 1. Movemos la reserva visualmente al instante para que la app se sienta rápida
    setRes(res.map((r) => (r.id === id ? { ...r, ...changes } : r)));

    // 2. Le mandamos los datos a la nube para que las demás pantallas se enteren
      const { error } = await supabase
        .from('reservas')
        .update({
          fecha_ingreso: changes.checkIn,
          fecha_salida: changes.checkOut,
          habitacion: changes.room
        })
        .eq('id', id);

    if (error) {
      console.error('Error al sincronizar el movimiento:', error);
      alert('Hubo un error al guardar el movimiento en la nube. Revisá tu conexión.');
    }
  };
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
const toggleBlacklist = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from('reservas')
      .update({ lista_negra: newStatus })
      .eq('id', id);

    if (error) {
      alert('Error al actualizar la lista negra en la nube.');
      return;
    }

    // 1. Actualiza la lista general de reservas (el fondo y el calendario)
    setRes(res.map(r => r.id === id ? { ...r, lista_negra: newStatus } : r));

    // 2. ¡EL DETALLE VISUAL! Actualiza el panel abierto para que el botón reaccione al instante
    setDrawer(prev => prev && prev.id === id ? { ...prev, lista_negra: newStatus } : prev);
  };
  const handleCI = (r) => {
    setDrawer(null);
    setCiModal(r);
  };
  const handleCO = (r) => {
    setDrawer(null);
    setCoModal(r);
  };
  const confCI = async (time) => {
    if (!ciModal) return;
    const targetId = ciModal.id;

    // 1. Actualizamos la vista local de inmediato para una experiencia fluida
    setRes(
      res.map((x) =>
        x.id === targetId ? { ...x, status: 'hospedado', checkInAt: time } : x
      )
    );
    setCiModal(null);

    // 2. Impactamos en la base de datos de Supabase de manera segura
    await supabase.from('reservas').update({ estado: 'hospedado' }).eq('id', targetId);
  };

  const confCO = async (time) => {
    if (!coModal) return;
    const targetId = coModal.id;

    // 1. Actualizamos la vista local
    setRes(
      res.map((x) =>
        x.id === targetId
          ? {
              ...x,
              status: 'finalizada',
              checkOutAt: time,
            }
          : x
      )
    );
    setCoModal(null);

    // 2. Impactamos en la base de datos de Supabase
    await supabase.from('reservas').update({ estado: 'finalizada' }).eq('id', targetId);
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
          html, body, #root { overflow-y: auto !important; overflow-x: hidden !important; }
          .app-layout { height: auto; min-height: calc(100vh - 54px); }
          .sidebar { display: none !important; }
          .main-content { padding: 16px 12px 100px !important; overflow-y: visible; }
          .bn { display: flex !important; position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #E5E7EB; z-index: 99; padding-bottom: env(safe-area-inset-bottom, 12px); box-shadow: 0 -2px 10px rgba(0,0,0,0.03); }
        }
      `}</style>

      {/* Navbar Superior */}
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img src="https://i.postimg.cc/3NDCCVdT/gecko2.png" alt="Itzé" style={{ width: 36, height: 36, objectFit: 'contain' }} />
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
              onGoTo={goTo}
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
              onGoTo={goTo}
            />
          )}
        </div>
      </div>

      {/* Menú inferior Mobile DESLIZABLE con filtro de seguridad */}
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
          paddingBottom: 'calc(env(safe-area-inset-bottom, 8px) + 20px)',
          display: 'flex',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, // Ahora se distribuyen equitativamente sin salirse
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
          onToggleBlacklist={toggleBlacklist}
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
     {/* MODAL DE CONFIRMACIÓN CHECK-IN */}
      {ciModal && (
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
                background: '#10B981',
                padding: '16px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Confirmar Check-in
              </div>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>
                ¿Confirmas el ingreso de <b>{ciModal.guestName}</b>?
              </p>
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>
                Esta acción marcará la reserva como "Hospedado" y registrará la hora de entrada.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCiModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#4B5563',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confCI(new Date().toISOString())}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#10B981',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#fff',
                  }}
                >
                  ✓ Check-in
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN CHECK-OUT */}
      {coModal && (
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
                background: '#F59E0B',
                padding: '16px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Confirmar Check-out
              </div>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>
                ¿Confirmas la salida de <b>{coModal.guestName}</b>?
              </p>
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>
                La estadía pasará a "Finalizada" y se liberará la propiedad en el calendario.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCoModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#4B5563',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confCO(new Date().toISOString())}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F59E0B',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#fff',
                  }}
                >
                  📤 Check-out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* DISEÑO DEL CARTEL FLOTANTE (TOAST) */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? 90 : 40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#10B981',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 30,
            fontSize: 14,
            fontWeight: 800,
            boxShadow: '0 8px 16px rgba(16,185,129,.25)',
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'slideUp 0.2s ease-out'
          }}
        >
          <span style={{ fontSize: 16 }}>✓</span> {toastMsg}
        </div>
      )} 
    </div>
  );
}

// --- MOTOR DE ARRANQUE ---
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<AppMejorada />);
}
      
