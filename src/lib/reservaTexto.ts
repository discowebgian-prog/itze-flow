/* eslint-disable */
// @ts-nocheck
// "Contame la reserva": Claude lee un texto libre (resumen pegado de WhatsApp, algo escrito
// abreviado o dictado con el teclado) y devuelve los datos para llenar el formulario.
import { askClaude } from './claude';
import { ROOMS, ROOM_DESC, findCountry } from './constants';
import { nowMerida } from './voice';
import { fmt, addDays, parseD } from './dates';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const prompt = (texto) => {
  const hoy = nowMerida();
  const rooms = ROOMS.map((r) => `${r.id} (Habitación ${r.id.slice(1)}): ${ROOM_DESC[r.id] || ''}, hasta ${r.maxGuests} personas`).join('\n');
  return `Sos el asistente de Itzé Hostel Boutique (Progreso, Yucatán, México). El equipo te pasa un texto sobre una reserva: puede ser un resumen pegado de WhatsApp, una charla entera con idas y vueltas, algo escrito abreviado o dictado. Sacá los datos de la reserva.

Hoy es ${DIAS[hoy.getDay()]} ${fmt(hoy)} (formato AAAA-MM-DD).

Habitaciones:
${rooms}

Reglas:
- Si hay idas y vueltas, quedate con lo último acordado.
- Fechas en AAAA-MM-DD. "Viernes", "el 20", "este finde" = la próxima vez que llega esa fecha desde hoy (nunca en el pasado, salvo que el texto diga que ya llegaron). checkOut = día de salida (si dicen "2 noches", checkIn + 2). Si dicen solo "viernes a domingo", la salida es el domingo.
- Habitación: "P2", "la 2", "habitación 2", "la de la king" (P4), "la matrimonial" (P6). Si piden varias, una entrada por habitación con cuántos van en cada una. Si no dicen habitación, rooms vacío.
- totalGuests = total de personas de toda la reserva.
- Nombres con mayúscula inicial. companions = nombres de acompañantes si aparecen.
- Teléfono: solo dígitos, sin el código de país; phonePrefix aparte ("+52") si se sabe. Si es un número mexicano de 10 dígitos, +52.
- nationality: código ISO de 2 letras si se sabe (por el texto, el idioma no alcanza).
- source: "Booking" si la reserva es de Booking; "Directo-Celular" si se arregló por WhatsApp, teléfono o mensaje; "Directo-Puerta" si llegaron sin reserva al hostel; "Redes" si vino de Instagram/Facebook; vacío si no se sabe.
- status: "hospedado" solo si el texto dice que ya están en el hostel; si no, "por_llegar".
- paid = lo que YA pagaron (seña, anticipo, transferencia hecha), en pesos; 0 si dicen que no pagaron; null si no se sabe. paymentMethod: efectivo | transferencia | debito | credito | otro, o vacío.
- agreedTotal = el precio total que se le pasó o se acordó con el huésped por toda la estadía, en pesos (si dicen "$990 la noche" por 2 noches, 1980); null si no se habló de precio.
- requiresInvoice = true si piden factura; company = nombre de la empresa si lo dicen.
- notes = cosas útiles para el equipo que no entran en otro campo (hora de llegada, late check-out pedido, mascota, cumpleaños, pedidos especiales). Corto. Vacío si no hay.
- doubts = lista corta, en español rioplatense neutro y amable, de lo que no quedó claro o no cierra (ej. "No quedó claro si son 3 o 4 personas", "Pidieron la habitación 4 pero son 5: no entran"). No inventes datos: si no está, dejalo vacío y, si es importante, anotalo en doubts.

Respondé SOLO con este JSON:
{"guestName":"","guestPhone":"","phonePrefix":"","guestEmail":"","nationality":"","checkIn":"","checkOut":"","rooms":[{"room":"P2","guests":2}],"totalGuests":null,"companions":[],"source":"","status":"","paid":null,"paymentMethod":"","agreedTotal":null,"requiresInvoice":false,"company":"","notes":"","doubts":[]}

Texto:
"""
${texto}
"""`;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));

// Devuelve los datos limpios (solo lo que vale), o null si no se pudo leer nada.
export async function leerReserva(texto) {
  const raw = await askClaude({
    messages: [{ role: 'user', content: prompt(String(texto).slice(0, 60000)) }],
    maxTokens: 4000,
    effort: 'low',
  });
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let d;
  try {
    d = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }

  const out = { doubts: Array.isArray(d.doubts) ? d.doubts.filter((x) => typeof x === 'string' && x.trim()).slice(0, 6) : [] };
  if (ISO.test(d.checkIn || '')) out.checkIn = d.checkIn;
  if (ISO.test(d.checkOut || '')) out.checkOut = d.checkOut;
  if (out.checkIn && (!out.checkOut || out.checkOut <= out.checkIn)) {
    if (out.checkOut) out.doubts.push('La salida quedaba antes de la entrada: puse una noche, revisá las fechas.');
    out.checkOut = fmt(addDays(parseD(out.checkIn), 1));
  }
  if (!out.checkIn) delete out.checkOut;

  const ids = ROOMS.map((r) => r.id);
  const seen = new Set();
  out.rooms = (Array.isArray(d.rooms) ? d.rooms : [])
    .map((r) => ({ room: String(r?.room || '').toUpperCase().replace(/^(\d)$/, 'P$1'), guests: Math.max(1, Math.round(num(r?.guests) || 1)) }))
    .filter((r) => ids.includes(r.room) && !seen.has(r.room) && seen.add(r.room));
  const tg = num(d.totalGuests);
  if (tg && tg > 0) out.totalGuests = Math.round(tg);

  const name = String(d.guestName || '').trim();
  if (name) out.guestName = name;
  const phone = String(d.guestPhone || '').replace(/\D/g, '');
  if (phone.length >= 7) out.guestPhone = phone;
  const pref = String(d.phonePrefix || '').replace(/[^\d+]/g, '');
  if (/^\+\d{1,4}$/.test(pref)) out.phonePrefix = pref;
  const email = String(d.guestEmail || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.guestEmail = email;
  const country = findCountry(d.nationality);
  if (country) out.nationality = country;
  out.companions = (Array.isArray(d.companions) ? d.companions : []).map((c) => String(c || '').trim()).filter(Boolean);

  if (['Booking', 'Directo-Puerta', 'Directo-Celular', 'Redes'].includes(d.source)) out.source = d.source;
  if (['por_llegar', 'hospedado'].includes(d.status)) out.status = d.status;
  const paid = num(d.paid);
  if (paid !== null && paid >= 0) out.paid = Math.round(paid);
  if (['efectivo', 'transferencia', 'debito', 'credito', 'otro'].includes(d.paymentMethod)) out.paymentMethod = d.paymentMethod;
  const agreed = num(d.agreedTotal);
  if (agreed && agreed > 0) out.agreedTotal = Math.round(agreed);
  if (d.requiresInvoice === true) out.requiresInvoice = true;
  const company = String(d.company || '').trim();
  if (company) out.company = company;
  const notes = String(d.notes || '').trim();
  if (notes) out.notes = notes;

  const algo = out.checkIn || out.guestName || out.rooms.length || out.guestPhone || out.totalGuests;
  return algo ? out : null;
}
