/* eslint-disable */
// @ts-nocheck
// "Contame la reserva": Claude lee un texto libre (resumen pegado de WhatsApp, algo escrito
// abreviado o dictado con el teclado) y devuelve los datos para llenar el formulario.
// Interpreta con criterio y no avisa de más: lo que falta lo pide el formulario y las dudas
// reales (fechas o personas que se entienden de dos formas) vuelven como opciones para tocar.
import { askClaude } from './claude';
import { ROOMS, ROOM_DESC, findCountry } from './constants';
import { nowMerida } from './voice';
import { fmt, addDays, parseD } from './dates';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const prompt = (texto) => {
  const hoy = nowMerida();
  const rooms = ROOMS.map((r) => `${r.id} (Habitación ${r.id.slice(1)}): ${ROOM_DESC[r.id] || ''}, hasta ${r.maxGuests} personas`).join('\n');
  return `Sos el asistente de Itzé Hostel Boutique (Progreso, Yucatán, México). El equipo te pasa un texto sobre una reserva: puede ser un resumen pegado de WhatsApp, una charla entera con idas y vueltas, algo escrito abreviado o dictado (con errores de dictado). Sacá los datos de la reserva.

Hoy es ${DIAS[hoy.getDay()]} ${fmt(hoy)} (formato AAAA-MM-DD).

Habitaciones:
${rooms}

Reglas (interpretá con criterio, como lo haría alguien del equipo):
- Si hay idas y vueltas, quedate con lo último acordado.
- Fechas en AAAA-MM-DD. "Viernes", "el 20", "este finde", "mañana" = la próxima vez que llega esa fecha desde hoy (nunca en el pasado, salvo que digan que ya llegaron). "Finde" = viernes a domingo. checkOut = día de salida ("2 noches" = checkIn + 2; "viernes a domingo" sale el domingo; "del 20 al 22" sale el 22). Si dan solo la entrada, una noche.
- Si las fechas se pueden entender de dos formas que cambian la reserva, poné la más probable en checkIn/checkOut y las dos en dateOptions; si no, dateOptions vacío.
- Habitación: "P2", "la 2", "hab 2", "dos" cuando se habla de habitación = P2; "la king" = P4; "la matrimonial" o "la chica" = P6. Si piden varias, una entrada por habitación con cuántos van en cada una. Si no dicen habitación, rooms vacío (no elijas vos).
- totalGuests = total de personas ("somos 3", "pareja" = 2, "con mi novia" = 2, "solo" = 1). null si no se sabe. Si dudan entre dos números ("3 o 4"), poné el último en totalGuests y los dos en guestOptions.
- Nombres con mayúscula inicial y tildes. companions = nombres de acompañantes si aparecen.
- Teléfono: solo dígitos, sin código de país; phonePrefix aparte ("+52") si se sabe. Número mexicano de 10 dígitos = +52.
- nationality: código ISO de 2 letras solo si el texto lo dice o es obvio por el teléfono.
- source: "Booking" si la reserva es de Booking; "Directo-Celular" si se arregló por WhatsApp, teléfono o mensaje (un resumen o una charla de WhatsApp cuenta); "Directo-Puerta" si llegaron sin reserva al hostel; "Redes" si vino de Instagram/Facebook; vacío si no hay ninguna pista.
- status: "hospedado" solo si dice que ya están en el hostel; si no, "por_llegar".
- paid = lo que YA pagaron, en pesos. "Pagó la mitad" sin monto: paidHalf = true y paid null. "Pagó todo" sin monto: paidAll = true y paid null. "No pagó" / "paga al llegar" = 0. null si no se habla de pago. paymentMethod: efectivo | transferencia | debito | credito | otro, o vacío ("transf", "depósito" = transferencia; "tarjeta" = credito).
- specialTotal = SOLO si se acordó un precio especial (descuento, precio cerrado, "se lo dejé en…", "le cobro…"): el total en pesos por toda la estadía ("$900 la noche" por 2 noches = 1800). null si no hubo precio especial o solo se repite la tarifa normal.
- requiresInvoice = true si piden factura; company = nombre de la empresa si lo dicen.
- notes = cosas útiles para el equipo que no entran en otro campo (hora de llegada, late check-out pedido, mascota, cumpleaños, pedidos especiales). Corto. Vacío si no hay.
- No inventes datos: lo que no está, vacío o null.

Respondé SOLO con este JSON:
{"guestName":"","guestPhone":"","phonePrefix":"","guestEmail":"","nationality":"","checkIn":"","checkOut":"","rooms":[{"room":"P2","guests":2}],"totalGuests":null,"companions":[],"source":"","status":"","paid":null,"paidHalf":false,"paidAll":false,"paymentMethod":"","specialTotal":null,"requiresInvoice":false,"company":"","notes":"","dateOptions":[],"guestOptions":[]}

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

  const out = {};
  if (ISO.test(d.checkIn || '')) out.checkIn = d.checkIn;
  if (ISO.test(d.checkOut || '')) out.checkOut = d.checkOut;
  if (out.checkIn && (!out.checkOut || out.checkOut <= out.checkIn)) out.checkOut = fmt(addDays(parseD(out.checkIn), 1));
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
  else if (d.paidAll === true) out.paidAll = true;
  else if (d.paidHalf === true) out.paidHalf = true;
  if (['efectivo', 'transferencia', 'debito', 'credito', 'otro'].includes(d.paymentMethod)) out.paymentMethod = d.paymentMethod;
  const special = num(d.specialTotal);
  if (special && special > 0) out.specialTotal = Math.round(special);
  if (d.requiresInvoice === true) out.requiresInvoice = true;
  const company = String(d.company || '').trim();
  if (company) out.company = company;
  const notes = String(d.notes || '').trim();
  if (notes) out.notes = notes;

  // Dudas reales que se resuelven con un toque
  out.dateOptions = (Array.isArray(d.dateOptions) ? d.dateOptions : [])
    .filter((o) => ISO.test(o?.checkIn || '') && ISO.test(o?.checkOut || '') && o.checkOut > o.checkIn)
    .map((o) => ({ checkIn: o.checkIn, checkOut: o.checkOut }))
    .filter((o, i, a) => a.findIndex((x) => x.checkIn === o.checkIn && x.checkOut === o.checkOut) === i)
    .slice(0, 3);
  if (out.dateOptions.length < 2) out.dateOptions = [];
  out.guestOptions = [...new Set((Array.isArray(d.guestOptions) ? d.guestOptions : []).map((n) => Math.round(num(n) || 0)).filter((n) => n > 0 && n < 30))].slice(0, 4);
  if (out.guestOptions.length < 2) out.guestOptions = [];

  const algo = out.checkIn || out.guestName || out.rooms.length || out.guestPhone || out.totalGuests;
  return algo ? out : null;
}
