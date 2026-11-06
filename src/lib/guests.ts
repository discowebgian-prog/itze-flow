/* eslint-disable */
// @ts-nocheck

export const waLink = (phone, prefix, nationality) => {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/\D/g, '');
  const cleanPrefix = (prefix || '').replace(/\D/g, '');
  return `https://wa.me/${cleanPrefix}${cleanPhone}`;
};

// ── GUEST DB ──────────────────────────────────────────────────────────────────
export function buildGuestDB(reservations) {
  const db = {};
  reservations.forEach((r) => {
    // Ignoramos si por algún error la reserva no tiene nombre
    if (!r.guestName || r.guestName.trim() === '') return;
    // Las canceladas no son una visita ni suman al total gastado
    if (r.status === 'cancelada') return;

    // Si tiene documento, agrupa por documento. Si no, agrupa por el nombre.
    const k = guestKey(r);

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

export function freqBadge(n) {
  if (n >= 5) return { label: '⭐⭐ VIP', color: '#7C3AED', bg: '#EDE9FE' };
  if (n >= 3) return { label: '⭐ Frecuente', color: '#B45309', bg: '#FEF3C7' };
  if (n >= 2) return { label: '↩ Regresa', color: '#0369A1', bg: '#E0F2FE' };
  return null;
}

// ── NÚMERO DE ESTANCIA ────────────────────────────────────────────────────────
// Misma persona (la misma regla que la pestaña Huéspedes): si la reserva tiene documento,
// se junta con las que tienen ese documento. Si no tiene, se junta con las que tampoco
// tienen documento y tienen el mismo nombre (sin tildes, mayúsculas ni espacios de más).
// Una reserva con documento y otra sin documento nunca se juntan: puede haber varios
// "Juan Pérez" que no son la misma persona.
const normName = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const normDoc = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
export const guestKey = (r) => {
  const d = normDoc(r.guestDoc);
  return d ? 'doc:' + d : 'nom:' + normName(r.guestName);
};

export function samePerson(a, b) {
  if (!normDoc(a.guestDoc) && normName(a.guestName).length < 3) return false;
  return guestKey(a) === guestKey(b);
}

// Devuelve qué número de estancia es esta reserva para el huésped (sin contar canceladas),
// cuántas tiene en total y cuál fue la anterior. null si todavía no hay nombre ni documento.
export function stayInfo(allRes, res) {
  if (!normDoc(res.guestDoc) && normName(res.guestName).length < 3) return null;
  const others = (allRes || []).filter(
    (r) => r.id !== res.id && r.status !== 'cancelada' && samePerson(r, res)
  );
  const prev = others
    .filter((r) => !res.checkIn || (r.checkIn && r.checkIn < res.checkIn))
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return {
    number: prev.length + 1,
    total: others.length + 1,
    last: prev.length ? prev[prev.length - 1] : null,
  };
}

// Etiqueta lista para mostrar: "3ª estancia · Frecuente", con sus colores.
export function stayBadge(info) {
  if (!info) return null;
  if (info.number === 1) {
    return { label: '🆕 Primera estancia', color: '#475569', bg: '#F1F5F9' };
  }
  const f = freqBadge(info.number);
  const tag = f.label.replace(/^\S+\s/, ''); // "Regresa", "Frecuente", "VIP"
  const icon = f.label.split(' ')[0];
  return { label: `${icon} ${info.number}ª estancia · ${tag}`, color: f.color, bg: f.bg };
}
