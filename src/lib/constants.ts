/* eslint-disable */
// @ts-nocheck
import { TODAY, fmt, addDays } from './dates';

export const PROPS = [
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

export const ROOMS = [
  { id: 'P1', name: 'P1', maxGuests: 5 },
  { id: 'P2', name: 'P2', maxGuests: 5 },
  { id: 'P3', name: 'P3', maxGuests: 6 },
  { id: 'P4', name: 'P4', maxGuests: 3 },
  { id: 'P5', name: 'P5', maxGuests: 5 },
  { id: 'P6', name: 'P6', maxGuests: 2 },
];

export const SOURCES = [
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

export const srcShort = (v) => SOURCES.find((s) => s.value === v)?.short || v;

export const srcLabel = (v) => SOURCES.find((s) => s.value === v)?.label || v;

export const srcColor = (v) => SOURCES.find((s) => s.value === v)?.color || '#888';

export const RS = {
  por_llegar: { bg: '#DBEAFE', txt: '#1E40AF', label: 'Por llegar' },
  hospedado: { bg: '#D1FAE5', txt: '#065F46', label: 'Hospedado' },
  finalizada: { bg: '#F3F4F6', txt: '#6B7280', label: 'Finalizada' },
  cancelada: { bg: '#FEE2E2', txt: '#991B1B', label: 'Cancelada' },
};

export const PS = {
  libre: { label: 'Libre', color: '#10B981', bg: '#D1FAE5' },
  ocupado: { label: 'Ocupado', color: '#EF4444', bg: '#FEE2E2' },
};

export const BLOCK_COLORS = {
  por_llegar: { bg: '#3B82F6', text: '#fff' },
  hospedado: { bg: '#10B981', text: '#fff' },
  finalizada: { bg: '#9CA3AF', text: '#fff' },
  cancelada: { bg: '#F87171', text: '#fff' },
};

export const ALERTS = [
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

export const getAlerts = (r) => ALERTS.filter((a) => a.check(r));

export const INIT_RES = [
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
export const COUNTRIES = [
  { code: 'MX', name: 'México', prefix: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', prefix: '+54', flag: '🇦🇷' },
  { code: 'CO', name: 'Colombia', prefix: '+57', flag: '🇨🇴' },
  { code: 'CL', name: 'Chile', prefix: '+56', flag: '🇨🇱' },
  { code: 'PE', name: 'Perú', prefix: '+51', flag: '🇵🇪' },
  { code: 'UY', name: 'Uruguay', prefix: '+598', flag: '🇺🇾' },
  { code: 'ES', name: 'España', prefix: '+34', flag: '🇪🇸' },
  { code: 'US', name: 'Estados Unidos', prefix: '+1', flag: '🇺🇸' },
];
