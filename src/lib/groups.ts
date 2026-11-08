/* eslint-disable */
// @ts-nocheck
// ── RESERVAS DE GRUPO ─────────────────────────────────────────────────────────
// Un grupo son varias reservas (una por habitación) con el mismo grupoId.
// Una de ellas es la del titular (quien reservó). Las demás arrancan con sus
// datos hasta que llega el contacto principal de cada habitación.

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const sameName = (a, b) => !!norm(a) && norm(a) === norm(b);

// Habitaciones del grupo (sin eliminadas), la del titular primero y después por habitación
export function groupOf(all, r) {
  if (!r || !r.grupoId) return [];
  return all
    .filter((x) => x.grupoId === r.grupoId && !x.deleted && x.status !== 'eliminada')
    .sort((a, b) =>
      a.grupoTitular === b.grupoTitular
        ? String(a.room || '').localeCompare(String(b.room || ''))
        : a.grupoTitular
        ? -1
        : 1
    );
}

// Habitación donde duerme el titular (null si eligió "Ninguna": quien reservó no se aloja)
export const groupTitular = (members) => members.find((m) => m.grupoTitular) || null;

// Datos de quien reservó el grupo. Se guardan en todas las habitaciones (grupoReservante).
// Grupos anteriores a esa columna: se toman de la habitación del titular.
export const bookerOf = (r) => ({
  name: r.guestName || '',
  doc: r.guestDoc || '',
  docType: r.guestDocType || '',
  nationality: r.guestNationality || '',
  phonePrefix: r.guestPhonePrefix || '',
  phone: r.guestPhone || '',
  email: r.guestEmail || '',
});
export function groupBooker(members) {
  const withSnap = members.find((m) => m.grupoReservante && m.grupoReservante.name);
  if (withSnap) return withSnap.grupoReservante;
  const tit = members.find((m) => m.grupoTitular) || members[0];
  return tit ? bookerOf(tit) : null;
}
export const groupName = (members) => groupBooker(members)?.name || '';

// Datos de la persona de contacto de una habitación
export const PERSON_FIELDS = [
  'guestName',
  'guestDoc',
  'guestDocType',
  'guestNationality',
  'guestPhonePrefix',
  'guestPhone',
  'guestEmail',
  'birthDate',
  'url_ine_frente',
  'url_ine_dorso',
];
// Lo que es de todo el grupo (al cambiarlo en una habitación se pregunta)
export const SHARED_FIELDS = ['checkIn', 'checkOut', 'status', 'source', 'requiresInvoice', 'company', 'notes'];
export const SHARED_LABELS = {
  checkIn: 'fechas',
  checkOut: 'fechas',
  status: 'estado',
  source: 'canal',
  requiresInvoice: 'factura',
  company: 'empresa',
  notes: 'notas',
};

const val = (v) => (v === true ? 'true' : v === false ? 'false' : String(v ?? '').trim());
export const changedFields = (a, b, fields) => fields.filter((k) => val(a?.[k]) !== val(b?.[k]));

// ¿Esta habitación ya tiene su propio contacto, o sigue con los datos de quien reservó?
// La habitación del titular siempre tiene su contacto (es el titular).
export function hasOwnContact(r, members) {
  if (!r || r.grupoTitular) return true;
  const b = groupBooker(members || []);
  if (!b) return true;
  if (!sameName(r.guestName, b.name)) return true;
  return val(r.guestDoc) !== val(b.doc);
}

// Reparte un pago entre habitaciones según el total de cada una (redondeado al peso).
// Lo que sobra por redondeo (o si se paga de más) va a la primera (la del titular).
export function splitPaid(amount, totals) {
  const amt = Math.max(0, Number(amount) || 0);
  const sum = totals.reduce((s, t) => s + (Number(t) || 0), 0);
  if (!totals.length) return [];
  if (sum <= 0) return totals.map((_, i) => (i === 0 ? amt : 0));
  const parts = totals.map((t) => Math.floor((Math.min(amt, sum) * (Number(t) || 0)) / sum));
  const rest = amt - parts.reduce((s, p) => s + p, 0);
  parts[0] += rest;
  return parts;
}

export const newGroupId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

// Saldo de una lista de reservas
export const balanceOf = (list) =>
  list.reduce((s, r) => s + Math.max(0, (Number(r.totalAmount) || 0) - (Number(r.paid) || 0)), 0);
