/* eslint-disable */
// @ts-nocheck

export const waLink = (phone, prefix, nationality) => {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/\D/g, '');
  const cleanPrefix = (prefix || '').replace(/\D/g, '');
  return `https://wa.me/${cleanPrefix}${cleanPhone}`;
};

// ── MISMA PERSONA ─────────────────────────────────────────────────────────────
// Regla base (la usan la pestaña Huéspedes y la etiqueta de estancia): si la reserva
// tiene documento, se junta con las que tienen ese documento. Si no tiene, se junta con
// las que tampoco tienen documento y tienen el mismo nombre (sin tildes, mayúsculas ni
// espacios de más). Una con documento y otra sin documento no se juntan solas: puede
// haber varios "Juan Pérez". Esos casos los decide un admin en "Posibles duplicados",
// y esas decisiones (tabla huespedes_decisiones) se respetan acá.
export const normName = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const normDoc = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
export const guestKey = (r) => {
  const d = normDoc(r.guestDoc);
  return d ? 'doc:' + d : 'nom:' + normName(r.guestName);
};

// Convierte una clave base en la clave del grupo, uniendo las marcadas como "misma persona".
export function makeResolver(decisions) {
  const parent = {};
  const find = (k) => {
    while (parent[k] && parent[k] !== k) k = parent[k];
    return k;
  };
  (decisions || [])
    .filter((d) => d.decision === 'misma')
    .forEach((d) => {
      const a = find(d.clave_a);
      const b = find(d.clave_b);
      if (a !== b) {
        // Siempre queda como raíz la menor, así el resultado no depende del orden
        if (a < b) parent[b] = a;
        else parent[a] = b;
      }
    });
  return find;
}

// Agrupa reservas de una misma persona en visitas: las que se superponen en fechas
// (por ejemplo, dos habitaciones para un grupo) son una sola visita.
// Devuelve las visitas ordenadas por fecha; cada visita es una lista de reservas.
export function groupVisits(list) {
  const sorted = [...list]
    .filter((r) => r.checkIn)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const visits = [];
  let end = '';
  sorted.forEach((r) => {
    const out = r.checkOut && r.checkOut > r.checkIn ? r.checkOut : r.checkIn;
    if (visits.length && r.checkIn < end) {
      visits[visits.length - 1].push(r);
      if (out > end) end = out;
    } else {
      visits.push([r]);
      end = out;
    }
  });
  return visits;
}

const hasIdentity = (r) => normDoc(r.guestDoc) || normName(r.guestName).length >= 3;

export function samePerson(a, b, resolve = (k) => k) {
  if (!hasIdentity(a)) return false;
  return resolve(guestKey(a)) === resolve(guestKey(b));
}

// ── GUEST DB ──────────────────────────────────────────────────────────────────
export function buildGuestDB(reservations, decisions = []) {
  const resolve = makeResolver(decisions);
  const db = {};
  reservations.forEach((r) => {
    // Ignoramos si por algún error la reserva no tiene nombre
    if (!r.guestName || r.guestName.trim() === '') return;
    // Las canceladas no son una visita ni suman al total gastado
    if (r.status === 'cancelada') return;

    const base = guestKey(r);
    const k = resolve(base);

    if (!db[k]) {
      db[k] = {
        key: k,
        doc: r.guestDoc || '',
        name: r.guestName,
        phone: r.guestPhone || '',
        email: r.guestEmail || '',
        stays: [],
        totalSpent: 0,
        firstStay: r.checkIn,
        lastStay: r.checkIn,
        resList: [],
        visits: 0, // visitas reales (reservas superpuestas cuentan una vez)
        keys: new Set(), // claves base que forman este huésped
        names: new Set(),
        phones: new Set(),
        emails: new Set(),
        nats: new Set(),
      };
    }

    const g = db[k];
    g.keys.add(base);
    g.names.add(normName(r.guestName));
    const ph = String(r.guestPhone || '').replace(/\D/g, '');
    if (ph.length >= 7) g.phones.add(ph.slice(-10));
    const em = String(r.guestEmail || '').trim().toLowerCase();
    if (em.includes('@')) g.emails.add(em);
    if (r.guestNationality) g.nats.add(r.guestNationality);
    if (!g.doc && r.guestDoc) g.doc = r.guestDoc;

    // Sumamos sus estadísticas solo si no habíamos contado esta reserva antes
    if (!g.stays.includes(r.id)) {
      g.stays.push(r.id);
      g.resList.push(r);
      g.totalSpent += r.totalAmount || 0;
    }

    if (r.checkIn < g.firstStay) g.firstStay = r.checkIn;
    if (r.checkIn >= g.lastStay) {
      g.lastStay = r.checkIn;
      g.name = r.guestName; // Se queda con el último nombre registrado
      if (r.guestPhone) g.phone = r.guestPhone; // Se queda con el teléfono más actual
      if (r.guestEmail) g.email = r.guestEmail;
    }
  });
  Object.values(db).forEach((g) => {
    g.visits = groupVisits(g.resList).length || g.stays.length;
    // Empresa: tiene cargado el nombre de una empresa (se escribe al pedir factura).
    // Quien pide factura sin empresa (profesional, persona física) queda como Particular.
    const recent = [...g.resList].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
    g.company = (recent.find((r) => String(r.company || '').trim()) || {}).company || '';
    g.isCompany = !!g.company;
  });
  return db;
}

// ── SUGERENCIA DE HUÉSPED AL ESCRIBIR EL NOMBRE ───────────────────────────────
// Busca huéspedes anteriores cuyo nombre coincida con lo que se está escribiendo.
// Cada palabra escrita tiene que ser el comienzo de alguna palabra del nombre
// (sin tildes ni mayúsculas): "juan per" encuentra a "Juan Pérez".
export function suggestGuests(allRes, query, decisions = [], excludeId = null, max = 4) {
  const words = normName(query).split(' ').filter(Boolean);
  if (normName(query).replace(/ /g, '').length < 3) return [];
  const list = (allRes || []).filter((r) => r.id !== excludeId);
  const db = buildGuestDB(list, decisions);
  const matches = Object.values(db).filter((g) =>
    [...g.names].some((n) => {
      const parts = n.split(' ');
      return words.every((w) => parts.some((p) => p.startsWith(w)));
    })
  );
  return matches
    .sort((a, b) => b.visits - a.visits || b.lastStay.localeCompare(a.lastStay))
    .slice(0, max)
    .map((g) => {
      // Datos más recientes que tenga cargados (cada campo por separado)
      const recent = [...g.resList].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
      const pick = (k) => (recent.find((r) => String(r[k] || '').trim()) || {})[k] || '';
      const withDoc = recent.find((r) => String(r.guestDoc || '').trim());
      return {
        key: g.key,
        visits: g.visits,
        lastStay: g.lastStay,
        lastRoom: recent[0]?.room || '',
        blacklisted: g.resList.some((r) => r.lista_negra),
        data: {
          guestName: g.name,
          guestDoc: withDoc ? withDoc.guestDoc : '',
          guestDocType: withDoc ? withDoc.guestDocType || 'INE' : '',
          guestNationality: pick('guestNationality'),
          guestPhonePrefix: (recent.find((r) => r.guestPhone) || {}).guestPhonePrefix || '',
          guestPhone: pick('guestPhone'),
          guestEmail: pick('guestEmail'),
          company: pick('company'),
          birthDate: pick('birthDate'),
        },
      };
    });
}

export function freqBadge(n) {
  if (n >= 5) return { label: '⭐⭐ VIP', color: '#7C3AED', bg: '#EDE9FE' };
  if (n >= 3) return { label: '⭐ Frecuente', color: '#B45309', bg: '#FEF3C7' };
  if (n >= 2) return { label: '↩ Regresa', color: '#0369A1', bg: '#E0F2FE' };
  return null;
}

// ── NÚMERO DE ESTANCIA ────────────────────────────────────────────────────────
// Devuelve qué número de estancia es esta reserva para el huésped (sin contar canceladas),
// cuántas tiene en total y cuál fue la anterior. null si todavía no hay nombre ni documento.
export function stayInfo(allRes, res, decisions = []) {
  if (!hasIdentity(res)) return null;
  const resolve = makeResolver(decisions);
  const others = (allRes || []).filter(
    (r) => r.id !== res.id && r.status !== 'cancelada' && samePerson(r, res, resolve)
  );
  // Sin fecha todavía: sería la visita siguiente a todas las anteriores
  if (!res.checkIn) {
    const visits = groupVisits(others);
    const lastVisit = visits[visits.length - 1];
    return {
      number: visits.length + 1,
      total: visits.length + 1,
      last: lastVisit ? lastVisit[lastVisit.length - 1] : null,
    };
  }
  const me = { ...res, id: res.id || '__esta__' };
  const visits = groupVisits([...others, me]);
  const idx = visits.findIndex((v) => v.includes(me));
  const prevVisit = idx > 0 ? visits[idx - 1] : null;
  return {
    number: idx + 1,
    total: visits.length,
    last: prevVisit ? [...prevVisit].sort((a, b) => a.checkIn.localeCompare(b.checkIn))[prevVisit.length - 1] : null,
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
