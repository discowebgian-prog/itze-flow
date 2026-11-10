/* eslint-disable */
// @ts-nocheck
import { COUNTRIES, findCountry } from './constants';
import { currency, fmt, addDays, parseD } from './dates';
import { groupName } from './groups';
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

// Nombres de los que faltan: hasta 3; si son más, los 2 primeros "y N más"
function whoList(u) {
  if (u.length <= 3) return listY(u.map((x) => x.label));
  return `${u.slice(0, 2).map((x) => x.label).join(', ')} y ${u.length - 2} más`;
}
// Avance de llegadas o salidas de hoy (pending = faltan, done = ya hechas)
// "Ya llegó Ana López (P2); falta que llegue Juan Pérez (P4)." · "Ya llegaron 2 de 5; falta que lleguen…"
// Sin ninguna hecha: "Hoy llegan …" · Todas hechas: "Ya llegaron todos los de hoy ✓" (con una sola, su nombre)
function progress(pending, done, did1, didN, will1, willN, hoy1, hoyN, allDone) {
  const d = units(done);
  // Grupo que llega (o se va) por partes: "parte del grupo de Torres (P1)" · "el resto del grupo de Torres (P3)"
  const split = new Set(
    units(pending).filter((u) => u.group && d.some((x) => x.group && x.res[0].grupoId === u.res[0].grupoId)).map((u) => u.res[0].grupoId)
  );
  const relabel = (u, word) =>
    u.group && split.has(u.res[0].grupoId) ? { ...u, label: `${word} grupo de ${u.name || 'sin nombre'} (${roomsText(u.rooms)})` } : u;
  const p = units(pending).map((u) => relabel(u, 'el resto del'));
  d.forEach((u, i) => (d[i] = relabel(u, 'parte del')));
  if (!p.length && !d.length) return '';
  if (!d.length) return `${p.length === 1 ? hoy1 : hoyN} ${whoList(p)}.`;
  if (!p.length) return d.length === 1 ? `Ya ${did1} ${d[0].label} ✓` : allDone;
  const ya = d.length === 1 ? `Ya ${did1} ${d[0].label}` : `Ya ${didN} ${d.length} de ${d.length + p.length}`;
  return `${ya}; falta que ${p.length === 1 ? will1 : willN} ${whoList(p)}.`;
}

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

  // Ya hechos hoy (para contar el avance después del primer check-in o check-out)
  const inDone = all.filter((r) => r.checkIn === today && (r.status === 'hospedado' || r.status === 'finalizada'));
  const outDone = all.filter((r) => r.checkOut === today && r.status === 'finalizada');
  const started = !night && (inDone.length > 0 || outDone.length > 0);

  const hoy = night
    ? [moves(arrivals, 'que llegue', 'que lleguen'), moves(departures, 'que se vaya', 'que se vayan')].filter(Boolean)
    : [moves(arrivals, 'llega', 'llegan'), moves(departures, 'se va', 'se van')].filter(Boolean);
  if (hoy.length) {
    if (started) {
      // Con el día en marcha: quién ya llegó o se fue y quién falta, con nombres
      // "Ya llegó Ana López (P2); falta que llegue Juan Pérez (P4)." · "Ya llegaron todos los de hoy ✓"
      lines.push(
        ...[
          progress(arrivals, inDone, 'llegó', 'llegaron', 'llegue', 'lleguen', 'Hoy llega', 'Hoy llegan', 'Ya llegaron todos los de hoy ✓'),
          progress(departures, outDone, 'se fue', 'se fueron', 'se vaya', 'se vayan', 'Hoy se va', 'Hoy se van', 'Ya se fueron todos los de hoy ✓'),
        ].filter(Boolean)
      );
    } else lines.push(night ? `Todavía falta ${hoy.join(' y ')}.` : `Hoy ${hoy.join(' y ')}.`);
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

// ── ETAPA 4: FINANZAS EN PALABRAS ─────────────────────────────────────────────
// Dos o tres frases arriba de cada mes, sin reemplazar los números:
// "Noviembre va en 58% del potencial, 6 puntos más que octubre. Los Lun–Mié son los que
//  más cuestan (31% contra 64% de Jue–Dom). Ganancia hasta hoy: $12,300; si sigue así, cerraría cerca de $48,000."
// m: { name, prevName, isCurrent, pot, potPrev, occPct, profit, projected }
export function financeReading({ name, prevName, isCurrent, pot, potPrev, occPct, profit, projected }) {
  const N = name ? name.charAt(0).toUpperCase() + name.slice(1) : 'El mes';
  const out = [];
  const verbo = isCurrent ? 'va en' : 'cerró en';
  if (pot && pot.pct != null) {
    let t = `${N} ${verbo} ${pot.pct}% del potencial`;
    if (potPrev && potPrev.pct != null && potPrev.earned > 0) {
      const d = pot.pct - potPrev.pct;
      t += d > 0 ? `, ${d} ${d === 1 ? 'punto' : 'puntos'} más que ${prevName}` : d < 0 ? `, ${-d} ${d === -1 ? 'punto' : 'puntos'} menos que ${prevName}` : `, igual que ${prevName}`;
    }
    out.push(t + '.');
    if (pot.entre != null && pot.finde != null) {
      const gap = pot.finde - pot.entre;
      if (gap >= 10) out.push(`Los Lun–Mié son los que más cuestan (${pot.entre}% contra ${pot.finde}% de Jue–Dom).`);
      else if (gap <= -10) out.push(`Los Jue–Dom vienen más flojos que los Lun–Mié (${pot.finde}% contra ${pot.entre}%).`);
      else out.push('Lun–Mié y Jue–Dom van parejos.');
    }
  } else {
    out.push(`${N} ${isCurrent ? 'va con' : 'cerró con'} ${occPct}% de ocupación.`);
  }
  const p = Math.round(Number(profit) || 0);
  let money = p >= 0
    ? `${isCurrent ? 'Ganancia hasta hoy' : 'Ganancia del mes'}: ${currency(p)}`
    : `${isCurrent ? 'Por ahora los gastos superan a lo que entró' : 'Los gastos superaron a lo que entró'} por ${currency(-p)}`;
  if (isCurrent && projected) money += `; si sigue así, el mes cerraría con unos ${currency(Math.round(projected / 1000) * 1000)} de ingresos`;
  out.push(money + '.');
  return out.join(' ');
}

// ── AVISOS ENTRE GIAN Y MARCE ─────────────────────────────────────────────────
// Llega un cambio de la base (realtime) hecho desde OTRO aparato: se cuenta en palabras.
// row: fila de la base (huesped, habitacion, fecha_ingreso…); old: la reserva como estaba en pantalla.
// Devuelve { by, text, group, type } o null si no hay nada para contar.
export function describeChange(by, type, row, old) {
  if (!row || !row.id) return null;
  const h = String(row.huesped || '').trim() || 'una reserva';
  const hab = row.habitacion ? ` (${row.habitacion})` : '';
  const base = { by, group: row.grupo_id || null, type, name: h, room: row.habitacion || '' };
  const fechas = row.fecha_ingreso && row.fecha_salida ? dayRange(row.fecha_ingreso, row.fecha_salida) : '';
  if (type === 'INSERT') return { ...base, text: `${by} cargó una reserva: ${h}${hab}${fechas ? `, ${fechas}` : ''}` };
  if (type !== 'UPDATE') return null;
  if (row.fecha_eliminacion && !(old && old.deleted)) {
    if (!old) return null; // ya no estaba en pantalla
    return { ...base, type: 'DELETE', text: `${by} eliminó la reserva de ${h}${hab}` };
  }
  if (!old) return { ...base, text: `${by} cambió la reserva de ${h}${hab}` };
  if (row.estado !== old.status) {
    if (row.estado === 'hospedado') return { ...base, type: 'CHECKIN', text: `${by} hizo el check-in de ${h}${hab}` };
    if (row.estado === 'finalizada') return { ...base, type: 'CHECKOUT', text: `${by} hizo el check-out de ${h}${hab}` };
    if (row.estado === 'cancelada') return { ...base, text: `${by} canceló la reserva de ${h}${hab}` };
  }
  if (row.habitacion && old.room && row.habitacion !== old.room)
    return { ...base, text: `${by} pasó a ${h} de ${old.room} a ${row.habitacion}` };
  if (row.fecha_ingreso !== old.checkIn || row.fecha_salida !== old.checkOut)
    return { ...base, text: `${by} movió la reserva de ${h}${hab}: ahora ${fechas}` };
  const paidDiff = (Number(row.monto_pagado) || 0) - (Number(old.paid) || 0);
  if (paidDiff > 0) return { ...base, type: 'PAY', text: `${by} cobró ${currency(paidDiff)} a ${h}${hab}` };
  if ((row.late_checkout_hora || '') !== (old.lateCheckout || ''))
    return { ...base, text: row.late_checkout_hora ? `${by} le dio late check-out a ${h}${hab} hasta las ${row.late_checkout_hora}` : `${by} quitó el late check-out de ${h}${hab}` };
  return { ...base, text: `${by} hizo cambios en la reserva de ${h}${hab}` };
}

// Varios cambios seguidos → un solo cartelito
export function describeChanges(list) {
  if (!list.length) return '';
  if (list.length === 1) return list[0].text;
  const by = list[0].by;
  const g = list[0].group;
  if (g && list.every((x) => x.group === g)) {
    const rooms = roomsText([...new Set(list.map((x) => x.room).filter(Boolean))]);
    const tipo = list.every((x) => x.type === list[0].type) ? list[0].type : '';
    const verb =
      tipo === 'INSERT' ? 'cargó un grupo' : tipo === 'CHECKIN' ? 'hizo el check-in del grupo' : tipo === 'CHECKOUT' ? 'hizo el check-out del grupo' : tipo === 'PAY' ? 'cobró al grupo' : tipo === 'DELETE' ? 'eliminó el grupo' : 'hizo cambios en el grupo';
    return `${by} ${verb} de ${list[0].name}${rooms ? ` (${rooms})` : ''}`;
  }
  return `${by} hizo ${list.length} cambios en reservas`;
}

// Estadía sin cargo (ver isFreeStay en reservations.ts): "Noche gratis" / "Noches gratis" si fue por ese
// descuento; si no, "Sin cargo". En vez de "Pagado", porque no hubo pago.
export const freeStayText = (r) => {
  const p = r?.pricing || {};
  if (p.discountType !== 'noche_gratis') return 'Sin cargo';
  return (Number(p.discountValue) || 0) > 1 ? 'Noches gratis' : 'Noche gratis';
};

// ── RESERVA QUE EMPIEZA ANTES DE HOY ──────────────────────────────────────────
// Se puede cargar (a veces queda algo sin cargar), pero se avisa y hay que confirmar (pedido de Gian).
// "La entrada es de ayer" / "La entrada es de hace 5 días" + cuándo
export function pastStartText(ci, now = nowMerida()) {
  const today = fmt(now);
  const n = Math.round((parseD(today) - parseD(ci)) / 86400000);
  const when = n === 1 ? 'de ayer' : `de hace ${n} días`;
  return {
    title: `La entrada es ${when}`,
    body: `Estás cargando una estadía que empezó el ${dayNum(ci)} de ${mes(ci)}, antes de hoy.`,
    hint: 'Si es algo que quedó sin cargar, seguí. Si no, corregí la fecha de entrada.',
    line: `Ojo: la entrada es ${when} (${dayNum(ci)} de ${mes(ci)}).`,
  };
}

// ── Equipo (rol equipo, paso 4 de roles) ──
// Pantalla del equipo mientras su sección se arma (pasos 5 a 9 del plan de estilo y fusión)
export const EQUIPO_PRONTO = {
  title: 'Tu espacio en Flow ya está listo',
  body: 'Muy pronto vas a ver acá tus habitaciones del día, tareas e insumos. Mientras tanto, seguí usando Itzé Limpieza como siempre :)',
  logout: 'Cerrar sesión',
};
