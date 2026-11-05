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

export function freqBadge(n) {
  if (n >= 5) return { label: '⭐⭐ VIP', color: '#7C3AED', bg: '#EDE9FE' };
  if (n >= 3) return { label: '⭐ Frecuente', color: '#B45309', bg: '#FEF3C7' };
  if (n >= 2) return { label: '↩ Regresa', color: '#0369A1', bg: '#E0F2FE' };
  return null;
}
