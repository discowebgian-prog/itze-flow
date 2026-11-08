/* eslint-disable */
// @ts-nocheck
import { COUNTRIES, findCountry } from './constants';
import { currency, fmt, addDays, parseD } from './dates';
import { groupName } from './groups';
import { birthdayInStay } from './guestMessages';
import { dayNum, mes, dayRange, listY } from './availability';

// ── LA VOZ DE FLOW ────────────────────────────────────────────────────────────
// Todo lo que la app le dice al equipo, en un solo lugar, para que hable siempre igual.
// Tono (decisión de Gian): humano, cálido, corto y claro. Nada robótico ni códigos.
// Regla: lo frecuente, corto; lo raro o importante, un poco más cálido.
// Los textos los lee el equipo (no el huésped): cuentan lo útil para ese momento.

// ── CARTELITO (aparece abajo y se va solo, sin "OK") ──────────────────────────
// notify('Reserva guardada')            → verde, se va en 2–4 s según el largo
// notify('No se pudo…', 'error')        → rojo, queda ~6 s (tocarlo lo cierra)
// notify('Volvió la conexión', 'info')  → azul
const listeners = new Set();
export const onNotify = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
// notify('Listo, Ana…', 'ok', { center: true }) → al centro y un poco más (check-in, check-out, cobro;
// pedido de Gian). No bloquea: el toque pasa de largo y se puede seguir trabajando.
export const notify = (text, kind = 'ok', opts = {}) => {
  if (!text) return;
  listeners.forEach((fn) => fn({ text, kind, center: !!opts.center, id: Date.now() + Math.random() }));
};
// Cuánto queda en pantalla: lo justo para leerlo (los del centro, un poco más)
export const toastMs = (t) =>
  t.kind === 'error'
    ? 6500
    : t.center
    ? Math.min(6000, Math.max(3500, 2000 + String(t.text).length * 45))
    : Math.min(4500, Math.max(2000, 1200 + String(t.text).length * 45));

// ── ERRORES EN PALABRAS ───────────────────────────────────────────────────────
// humanError(err, 'guardar la reserva') → "No se pudo guardar la reserva: parece que se cortó internet…"
// El detalle técnico va a la consola (console.error), no a la pantalla.
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function errorKind(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  const status = Number(err?.status || err?.statusCode || 0);
  if (isOffline() || /failed to fetch|networkerror|load failed|network request failed|error de red|err_internet|fetch failed/i.test(msg))
    return 'red';
  if (/abort|timeout|timed out|tardó/i.test(msg) || status === 504) return 'lento';
  if (status === 401 || /jwt|sesi[oó]n (venci|no v[aá]lida)|not authenticated|refresh token/i.test(msg)) return 'sesion';
  if (code === 'PGRST204' || code === '42703' || /column .* does not exist|could not find the .* column|falta correr el sql/i.test(msg))
    return 'sql';
  if (code === '42501' || status === 403 || /row-level security|permission denied|not allowed|unauthorized/i.test(msg))
    return 'permiso';
  if (status === 429 || /rate limit|overloaded|demasiados/i.test(msg)) return 'ocupado';
  return 'otro';
}

const MOTIVO = {
  red: 'parece que se cortó internet. Probá de nuevo cuando vuelva la señal.',
  lento: 'la nube tardó demasiado en responder. Probá de nuevo en un ratito.',
  sesion: 'tu sesión venció. Salí y volvé a entrar.',
  sql: 'a la base le falta una actualización (un SQL pendiente en Supabase).',
  permiso: 'no hay permiso para hacer esto con este usuario.',
  ocupado: 'el servicio está con mucho trabajo. Esperá un minuto y probá de nuevo.',
  otro: 'algo falló del lado de la nube. Probá de nuevo en un momento.',
};

// keep: true → suma "Lo que escribiste sigue acá." (para formularios que quedan abiertos)
export function humanError(err, que = 'guardar', { keep = false } = {}) {
  const k = errorKind(err);
  return `No se pudo ${que}: ${MOTIVO[k]}${keep && k !== 'sesion' ? ' Lo que escribiste sigue acá.' : ''}`;
}

// Atajo: avisa el error en el cartelito rojo y lo deja en la consola
export function notifyError(err, que, opts) {
  console.error(`Error al ${que}:`, err);
  notify(humanError(err, que, opts), 'error');
}

// ── CONEXIÓN ──────────────────────────────────────────────────────────────────
export const OFFLINE_BANNER = 'Sin conexión · lo que ves puede no estar al día. Cuando vuelva, se actualiza solo.';
export const BACK_ONLINE = 'Volvió la conexión · todo al día';

// ── FECHAS Y NOMBRES (para confirmaciones y avisos) ───────────────────────────
const firstName = (n) => String(n || '').trim() || 'el huésped';
// "P2" → "P2"; ["P1","P4"] → "P1 y P4"
export const roomsText = (rooms) => listY(rooms.filter(Boolean));
// "hasta el dom 15 de nov"
export const untilText = (co) => (co ? `hasta el ${dayNum(co)} de ${mes(co)}` : '');
export const stayRange = (ci, co) => (ci && co ? dayRange(ci, co) : '');
export const countryName = (code) => {
  const c = findCountry(code) || COUNTRIES.find((x) => x.code === code);
  return c ? c.name : '';
};

// ── CONFIRMACIONES ────────────────────────────────────────────────────────────
// list: una reserva o varias (check-in/out de todo el grupo)
const asList = (m) => (Array.isArray(m) ? m : [m]).filter(Boolean);
const debe = (list) =>
  list.reduce((s, r) => s + Math.max(0, (Number(r.totalAmount) || 0) - (Number(r.paid) || 0)), 0);

export function checkInText(m) {
  const list = asList(m);
  const g = list[0] || {};
  const rooms = roomsText(list.map((r) => r.room));
  const who = list.length > 1 ? `el grupo de ${firstName(g.guestName)}` : firstName(g.guestName);
  const saldo = debe(list);
  return {
    who,
    where: rooms ? ` a ${rooms}` : '',
    detail:
      (list.length > 1 ? 'Se quedan ' : 'Se queda ') + (untilText(g.checkOut) || 'hasta su salida') + '.',
    warn: saldo > 0 ? `Le queda un saldo de ${currency(saldo)}. Si podés, cobralo ahora.` : '',
  };
}

export function checkOutText(m) {
  const list = asList(m);
  const g = list[0] || {};
  const rooms = roomsText(list.map((r) => r.room));
  const who = list.length > 1 ? `el grupo de ${firstName(g.guestName)}` : firstName(g.guestName);
  const saldo = debe(list);
  return {
    who,
    where: rooms ? ` de ${rooms}` : '',
    detail: rooms
      ? `${rooms} ${list.length > 1 ? 'quedan libres' : 'queda libre'} en el calendario.`
      : 'La propiedad queda libre en el calendario.',
    warn: saldo > 0 ? `Ojo: todavía debe ${currency(saldo)}. Cobralo antes de que se vaya.` : '',
  };
}

// Eliminar: "¿Eliminar la reserva de Ana López?" · "P3 · del jue 12 al sáb 14 de nov"
export function deleteText(r) {
  const parts = [r?.room, stayRange(r?.checkIn, r?.checkOut)].filter(Boolean);
  return {
    title: r?.guestName ? `¿Eliminar la reserva de ${firstName(r.guestName)}?` : '¿Eliminar esta reserva?',
    where: parts.join(' · '),
    detail: 'No se borra del todo: queda en la papelera y el administrador la puede recuperar.',
  };
}

// ── CARTELITOS DE CADA ACCIÓN ─────────────────────────────────────────────────
// Al guardar no se pregunta nada (tocar Guardar ya confirma); el cartelito dice qué y dónde
// quedó, así se ve en el momento si algo quedó mal (pedido de Gian).
const whoOf = (r) => String(r?.guestName || '').trim();
const whereOf = (list) => {
  const rooms = roomsText(list.map((r) => r.room));
  const fechas = stayRange(list[0]?.checkIn, list[0]?.checkOut);
  return [rooms, fechas].filter(Boolean).join(', ');
};
export const SAVED = {
  // "Reserva de Lucía Gómez guardada · P1, del dom 8 al lun 9 de nov"
  reserva: (r) => {
    const w = whereOf([r]);
    return `${whoOf(r) ? `Reserva de ${whoOf(r)} guardada` : 'Reserva guardada'}${w ? ` · ${w}` : ''}`;
  },
  // "Grupo de Lucía Gómez guardado · P1, P3 y P5, del dom 8 al lun 9 de nov"
  grupo: (list) => {
    const w = whereOf(list);
    const g = list.find((r) => r.grupoTitular) || list[0];
    return `${whoOf(g) ? `Grupo de ${whoOf(g)} guardado` : 'Grupo guardado'}${w ? ` · ${w}` : ''}`;
  },
  // Editar: "Cambios guardados · Lucía Gómez, P1"
  cambios: (r) => {
    const parts = [whoOf(r), r?.room].filter(Boolean).join(', ');
    return `Cambios guardados${parts ? ` · ${parts}` : ''}`;
  },
  grupoCambios: (r) => `Cambios guardados en todo el grupo${whoOf(r) ? ` de ${whoOf(r)}` : ''}`,
  sumada: (room) => `${room} sumada al grupo`,
  separada: (room) => `${room} separada del grupo`,
  cobro: (n) => (n > 1 ? `Cobro guardado · ${n} habitaciones` : 'Cobro guardado'),
  late: (hora) => (hora ? `Late check-out guardado · sale a las ${hora}` : 'Late check-out quitado'),
  listaNegra: (on) => (on ? 'Marcado como no grato' : 'Quitado de la lista negra'),
  restaurada: 'Reserva recuperada de la papelera',
  eliminada: (n) => (n > 1 ? `Grupo eliminado · ${n} habitaciones a la papelera` : 'Reserva enviada a la papelera'),
};

// ── ESCÁNER DE DOCUMENTOS ─────────────────────────────────────────────────────
export const SCAN = {
  reading: 'Leyendo el documento…',
  // data: lo que leyó Claude
  done: (data) => {
    const name = String(data?.fullName || [data?.firstName, data?.lastName].filter(Boolean).join(' ')).trim();
    const pais = countryName(data?.nationality);
    if (name && pais) return `Listo, es ${name}, de ${pais}. Revisá que esté todo bien.`;
    if (name) return `Listo, es ${name}. Revisá que esté todo bien.`;
    return 'Listo, ya cargué lo que pude leer. Revisá que esté todo bien.';
  },
  unreadable:
    'No pude leer bien la foto. Probá con más luz, sin reflejo y con el documento entero. La foto quedó guardada igual.',
  failed: (err) => {
    const k = errorKind(err);
    if (k === 'otro') return 'No pude leer el documento esta vez. La foto quedó guardada; podés probar de nuevo o escribir los datos a mano.';
    return `No pude leer el documento: ${MOTIVO[k]} La foto quedó guardada.`;
  },
  uploading: 'Subiendo…',
};

// ── ETAPA 2: INICIO QUE HABLA ─────────────────────────────────────────────────
// Hora de Progreso (Mérida), sin depender de la zona del aparato
export const nowMerida = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Merida' }));

// "Buen día, Gian ☀️" · "Buenas tardes, Marce 🌤️" · "Buenas noches 🌙"
export function greeting(name, now = nowMerida()) {
  const h = now.getHours();
  const [txt, emoji] = h >= 5 && h < 12 ? ['Buen día', '☀️'] : h >= 12 && h < 19 ? ['Buenas tardes', '🌤️'] : ['Buenas noches', '🌙'];
  return { text: name ? `${txt}, ${name}` : txt, emoji };
}

const live = (r) => r && !r.deleted && r.status !== 'cancelada' && r.status !== 'eliminada';

// Junta las habitaciones de un mismo grupo en una sola "llegada" o "salida"
function units(list) {
  const out = [];
  const byGroup = {};
  list.forEach((r) => {
    if (r.grupoId) {
      if (!byGroup[r.grupoId]) {
        byGroup[r.grupoId] = { group: true, res: [] };
        out.push(byGroup[r.grupoId]);
      }
      byGroup[r.grupoId].res.push(r);
    } else out.push({ group: false, res: [r] });
  });
  return out.map((u) => {
    const rooms = u.res.map((r) => r.room).filter(Boolean);
    const tit = u.res.find((r) => r.grupoTitular) || u.res[0];
    const name = u.group ? groupName(u.res) || whoOf(tit) : whoOf(tit);
    return {
      ...u,
      name,
      rooms,
      people: u.res.reduce((s, r) => s + (Number(r.totalGuests) || 1), 0),
      debt: debe(u.res),
      label: u.group && u.res.length > 1
        ? `el grupo de ${name || 'sin nombre'} (${roomsText(rooms)})`
        : `${name || 'alguien'}${rooms.length ? ` (${roomsText(rooms)})` : ''}`,
    };
  });
}

// "llega Ana López (P2)" · "llegan Ana López (P2) y Juan Pérez (P4)" · "llegan 3 reservas"
function moves(list, one, many) {
  const u = units(list);
  if (!u.length) return '';
  if (u.length === 1) return `${one} ${u[0].label}`;
  if (u.length === 2) return `${many} ${u[0].label} y ${u[1].label}`;
  return `${many} ${u.length} reservas`;
}
const cap1 = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

// Resumen del día para Inicio: 1 a 3 renglones cortos, en palabras.
// De día cuenta lo que falta de hoy; desde las 19:00, lo que falta y lo de mañana.
export function daySummary(reservations, now = nowMerida()) {
  const today = fmt(now);
  const tomorrow = fmt(addDays(parseD(today), 1));
  const all = reservations.filter(live);
  const arrivals = all.filter((r) => r.checkIn === today && r.status === 'por_llegar');
  const departures = all.filter((r) => r.checkOut === today && r.status === 'hospedado');
  const doneIn = all.filter((r) => r.checkIn === today && r.status === 'hospedado').length;
  const doneOut = all.filter((r) => r.checkOut === today && r.status === 'finalizada').length;
  const night = now.getHours() >= 19;
  const lines = [];

  const hoy = night
    ? [moves(arrivals, 'que llegue', 'que lleguen'), moves(departures, 'que se vaya', 'que se vayan')].filter(Boolean)
    : [moves(arrivals, 'llega', 'llegan'), moves(departures, 'se va', 'se van')].filter(Boolean);
  if (hoy.length) {
    lines.push(night ? `Todavía falta ${hoy.join(' y ')}.` : `Hoy ${hoy.join(' y ')}.`);
    // Late check-out de los que se van hoy (de noche ya no hace falta)
    units(night ? [] : departures)
      .filter((u) => u.res.some((r) => r.lateCheckout))
      .slice(0, 2)
      .forEach((u) => {
        const h = u.res.find((r) => r.lateCheckout).lateCheckout;
        lines.push(`${cap1(u.label)} sale a las ${h} con late check-out.`);
      });
    // Saldos de los que llegan
    const conSaldo = units(arrivals).filter((u) => u.debt > 0);
    if (conSaldo.length === 1) lines.push(`${cap1(conSaldo[0].name || 'Alguien')} llega con saldo de ${currency(conSaldo[0].debt)}.`);
    else if (conSaldo.length > 1) lines.push(`${conSaldo.length} de las que llegan tienen saldo por cobrar.`);
  } else if (doneIn || doneOut) {
    lines.push('Los movimientos de hoy ya están hechos ✓');
  } else if (!night) {
    lines.push('Día tranquilo: nadie entra ni sale hoy.');
  }

  // 🎂 Cumpleaños de hoy entre los que están o llegan (fecha sacada de la CURP)
  const cumple = all.filter(
    (r) => r.checkIn <= today && today <= r.checkOut && r.status !== 'finalizada' && birthdayInStay(r, now)?.today
  );
  if (cumple.length) {
    const quien = listY(cumple.slice(0, 3).map((r) => `${whoOf(r) || 'alguien'}${r.room ? ` (${r.room})` : ''}`));
    lines.unshift(`🎂 Hoy ${cumple.length > 1 ? 'cumplen' : 'cumple'} años ${quien}.`);
  }

  if (night) {
    const mIn = all.filter((r) => r.checkIn === tomorrow && r.status === 'por_llegar');
    const mOut = all.filter((r) => r.checkOut === tomorrow && r.status !== 'finalizada');
    const man = [moves(mIn, 'llega', 'llegan'), moves(mOut, 'se va', 'se van')].filter(Boolean);
    lines.push(man.length ? `Mañana ${man.join(' y ')}.` : 'Mañana no hay entradas ni salidas.');
  }
  return lines;
}

// ── CARTELITOS ÚTILES DEL EQUIPO ──────────────────────────────────────────────
// after: todas las reservas ya con el cambio aplicado

// Check-in: "Listo, Ana López ya está en P2 · se va el mié 11 · le queda saldo de $1,100"
// Grupo completo: "Listo, los 8 del grupo de Ana López ya están en casa · P1, P2 y P3"
export function afterCheckIn(list, after) {
  const l = asList(list);
  const g = l[0] || {};
  if (g.grupoId) {
    const members = after.filter((r) => live(r) && r.grupoId === g.grupoId);
    if (members.length > 1 && members.every((r) => r.status === 'hospedado')) {
      const u = units(members)[0];
      return `Listo, los ${u.people} del grupo de ${u.name || 'sin nombre'} ya están en casa · ${roomsText(u.rooms)}`;
    }
  }
  if (l.length > 1) return `Listo, ${roomsText(l.map((r) => r.room))} ya están en casa`;
  const saldo = debe(l);
  return [
    `Listo, ${whoOf(g) || 'el huésped'} ya está${g.room ? ` en ${g.room}` : ' en casa'}`,
    g.checkOut ? `se va el ${dayNum(g.checkOut)}` : '',
    saldo > 0 ? `le queda saldo de ${currency(saldo)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

// Check-out: "P2 quedó libre · mañana entra Lucía Gómez" (o "hoy entra…", "libre hasta el jue 12")
export function afterCheckOut(list, after, now = nowMerida()) {
  const l = asList(list);
  const today = fmt(now);
  const tomorrow = fmt(addDays(parseD(today), 1));
  const rooms = l.map((r) => r.room).filter(Boolean);
  const saldo = debe(l);
  const owe = saldo > 0 ? `quedó debiendo ${currency(saldo)}` : '';
  if (!rooms.length) return [`${whoOf(l[0]) || 'El huésped'} ya hizo check-out`, owe].filter(Boolean).join(' · ');
  if (rooms.length > 1) return [`${roomsText(rooms)} quedaron libres`, owe].filter(Boolean).join(' · ');
  const r = l[0];
  const next = after
    .filter((x) => live(x) && x.id !== r.id && x.room === r.room && x.propertyId === r.propertyId && x.status === 'por_llegar' && x.checkIn >= today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
  const nextTxt = !next
    ? 'sin reservas próximas'
    : next.checkIn === today
    ? `hoy entra ${whoOf(next) || 'otra reserva'}`
    : next.checkIn === tomorrow
    ? `mañana entra ${whoOf(next) || 'otra reserva'}`
    : `libre hasta el ${dayNum(next.checkIn)} de ${mes(next.checkIn)}`;
  return [`${r.room} quedó libre`, nextTxt, owe].filter(Boolean).join(' · ');
}

// Cobro: "Ana López pagó todo · cuenta saldada" · "Cobro guardado · le queda $500"
// Grupo: "Grupo de Ana López pagado completo" · "Cobro guardado · al grupo le queda $X"
export function afterPay(ids, after) {
  const paid = after.filter((r) => ids.includes(r.id));
  const g = paid[0] || {};
  if (g.grupoId) {
    const members = after.filter((r) => live(r) && r.grupoId === g.grupoId);
    if (members.length > 1) {
      const total = debe(members);
      const name = groupName(members);
      if (total <= 0) return `Grupo de ${name || 'sin nombre'} pagado completo`;
      if (paid.length === 1 && debe(paid) <= 0) return `${g.room} pagó todo · al grupo le queda ${currency(total)}`;
      return `Cobro guardado · al grupo le queda ${currency(total)}`;
    }
  }
  const saldo = debe(paid);
  if (saldo <= 0) return whoOf(g) ? `${whoOf(g)} pagó todo · cuenta saldada` : 'Pagó todo · cuenta saldada';
  return `Cobro guardado · le queda ${currency(saldo)}`;
}
