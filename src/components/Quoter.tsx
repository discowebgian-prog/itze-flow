/* eslint-disable */
// @ts-nocheck
import { useState, useMemo, useEffect, useRef } from 'react';
import { ROOMS, ROOM_DESC, ROOM_BEDS } from '../lib/constants';
import { roomTypeOf, quoteStay } from '../lib/rates';
import { findConflicts } from '../lib/reservations';
import { TODAY, fmt, addDays, parseD, diffDays, currency, DAYS } from '../lib/dates';
import { RangeCalendar } from './ui/RangeCalendar';
import { Icon, ic } from './ui/Icon';
import { money } from './reservations/QuoteInfo';
import {
  nightAvailability,
  busyText,
  noRoomText,
  nightsText,
  stayPlan,
  planText,
  nearestDates,
  listY,
  lateOutOn,
  entradaSalida,
  roomNum,
  oneDay,
} from '../lib/availability';
import { quoteMessageEn } from '../lib/guestMessages';

// ── COTIZAR (sin crear reserva) ───────────────────────────────────────────────
// Se arma paso a paso: fechas → personas → en qué habitación va cada uno → cotización
// (subtotal por habitación, total, por persona y promedio por persona por noche) y texto para WhatsApp.

const msgMoney = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return '$' + v.toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
};
const noches = (n) => (n === 1 ? '1 noche' : `${n} noches`);
const personas = (n) => (n === 1 ? '1 persona' : `${n} personas`);
export { listY } from '../lib/availability';

// Animaciones: entrada de pasos y habitaciones (una debajo de otra) y expansión al tocar
export const QT_CSS = `
@keyframes qtIn { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
.qt-in { animation: qtIn .38s cubic-bezier(.2,.8,.2,1) both; }
/* Resaltado de una vez (Personas al elegir fechas): aro azul que se apaga */
@keyframes qtGlow {
  0% { box-shadow: 0 0 0 0 rgba(37,99,235,.5); border-color: var(--acc); background: var(--acc-soft); }
  65% { box-shadow: 0 0 0 10px rgba(37,99,235,0); border-color: #93C5FD; background: var(--card); }
  100% { box-shadow: var(--shadow); border-color: transparent; background: var(--card); }
}
.qt-in.qt-glow { animation: qtIn .38s cubic-bezier(.2,.8,.2,1) both, qtGlow 1.4s .3s ease-out both; }
@media (prefers-reduced-motion: reduce) { .qt-in, .qt-in.qt-glow { animation: none; } }
`;
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Desliza la ventana hasta el paso (arriba de todo, o lo justo para que se vea entero con 'nearest')
export const scrollToStep = (ref, block = 'start') =>
  ref.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block });
export const HOSTEL_CAPACITY = ROOMS.reduce((s, r) => s + r.maxGuests, 0);

// Texto para WhatsApp: termina en los precios (la charla sigue según venga)
// items con nightsLabel (cambio de habitación): "• Habitación con … (3 personas), las noches del vie 27 y sáb 28 de nov: $X"
export function quoteMessage({ checkIn, checkOut, guests, items, total }) {
  const n = diffDays(checkIn, checkOut);
  // Sin saludo: es un insert en una charla que ya empezó
  const lines = [`Para ${personas(guests)}, ${entradaSalida(checkIn, checkOut)} (${noches(n)}):`];
  // Habitaciones iguales (mismas camas, personas y precio) van en una línea: "• 2 habitaciones con … c/u"
  const groups = [];
  items.forEach((it) => {
    const key = `${it.desc}|${it.guests}|${it.total}|${it.nightsLabel || ''}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.count++;
    else groups.push({ key, it, count: 1 });
  });
  groups.forEach(({ it, count }) =>
    lines.push(
      count === 1
        ? `• Habitación con ${it.desc} (${personas(it.guests)})${it.nightsLabel ? `, ${it.nightsLabel}` : ''}: ${msgMoney(it.total)}`
        : `• ${count} habitaciones con ${it.desc} (${personas(it.guests)} c/u)${it.nightsLabel ? `, ${it.nightsLabel}` : ''}: ${msgMoney(it.total)} c/u`
    )
  );
  if (items.length > 1 || guests > 1) {
    lines.push(`Total: ${msgMoney(total)}${guests > 1 ? ` (${msgMoney(total / guests)} por persona)` : ''}`);
    lines.push(`Promedio por persona por noche: ${msgMoney(total / guests / n)}`);
  } else {
    lines.push(`Promedio por noche: ${msgMoney(total / n)}`);
  }
  return lines.join('\n');
}

// Tarjeta de cada paso: número en un círculo (✓ verde cuando el paso está resuelto) y título
// note: aclaración chica en gris al lado del título (ej. "opcional")
export function Step({ num, title, done = false, glow = false, boxRef = undefined, note = '', children }) {
  return (
    <section
      ref={boxRef}
      className={glow ? 'qt-in qt-glow' : 'qt-in'}
      style={{
        scrollMarginTop: 12,
        background: 'var(--card)',
        border: '1px solid transparent',
        borderRadius: 20,
        padding: '15px 15px 16px',
        marginBottom: 10,
        boxShadow: 'var(--shadow)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            flexShrink: 0,
            background: done ? 'var(--ok)' : 'var(--acc)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {done ? <Icon name="tick" size={15} strokeWidth={3} /> : num}
        </span>
        <span style={{ fontSize: 16, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: '-.01em' }}>{title}</span>
        {note && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mut)' }}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

export function Quoter({ allRes = [], tarifas = [], onReserve, onClose }) {
  // Arranca sin fechas: Personas aparece recién al elegir entrada y salida
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(0); // 0 = todavía no eligieron (las habitaciones aparecen al elegir)
  const [share, setShare] = useState(null); // ¿pueden compartir cama? null = sin responder
  const [sofa, setSofa] = useState(null); // ¿quieren usar el sofá cama? null = sin responder
  const [dist, setDist] = useState({}); // habitación → personas
  const [openRoom, setOpenRoom] = useState(''); // habitación con el selector desplegado
  const [copied, setCopied] = useState(false);
  // Idioma del mensaje para WhatsApp (en Cotizar todavía no sabemos la nacionalidad)
  const [lang, setLang] = useState('es');
  const [planOn, setPlanOn] = useState(false); // cotizar con cambio de habitación
  const [calKey, setCalKey] = useState(0); // para que el almanaque salte al mes de las fechas sugeridas
  // Entrada tocada, esperando la salida: lo de abajo sigue con las fechas anteriores (atenuado) para que nada salte
  const [draftIn, setDraftIn] = useState(null);
  const picking = draftIn !== null;
  // Recorrido guiado: fechas → Personas (resaltado) → habitaciones → cotización
  const [glowKey, setGlowKey] = useState(0); // sube al elegir fechas: Personas entra con resaltado
  const personasRef = useRef(null);
  const planRef = useRef(null);
  const quoteRef = useRef(null);
  const commitDates = (ci, co) => {
    setCheckIn(ci);
    setCheckOut(co);
    setDraftIn(null);
    setGlowKey((k) => k + 1);
  };
  const n = checkIn && checkOut ? diffDays(checkIn, checkOut) : 0;
  useEffect(() => setPlanOn(false), [checkIn, checkOut, guests]);

  // Disponibilidad noche por noche (una habitación ocupada alguna noche no suma lugar)
  const av = useMemo(() => nightAvailability(allRes, checkIn, checkOut, n), [allRes, checkIn, checkOut, n]);
  const rooms = ROOMS.map((r) => ({
    ...r,
    desc: ROOM_DESC[r.id] || r.name,
    busyNights: av.busy[r.id] || [],
    free: n > 0 && (av.busy[r.id] || []).length === 0,
  }));
  const freeRooms = rooms.filter((r) => r.free);
  const busyRooms = rooms.filter((r) => !r.free);
  const freeCap = freeRooms.reduce((s, r) => s + r.maxGuests, 0);
  const full = n > 0 && freeCap === 0;
  const esosDias = n === 1 ? 'Ese día' : 'Esos días';
  const short = n > 0 && guests > freeCap; // no entran todos sin mudarse
  // ¿Se puede con cambio de habitación? (habitaciones fijas + las personas que se mudan)
  const plan = useMemo(() => (short ? stayPlan(av, guests) : null), [short, av, guests]);
  const planActive = planOn && !!plan;
  // Fechas más cercanas (antes y después) con lugar para todos sin mudarse
  const near = useMemo(
    () => (short ? nearestDates(allRes, checkIn, n, guests, fmt(TODAY)) : null),
    [short, allRes, checkIn, n, guests]
  );
  const goDates = (ci) => {
    commitDates(ci, fmt(addDays(parseD(ci), n)));
    setCalKey((k) => k + 1);
  };
  const warnBox = {
    marginTop: 8,
    fontSize: 13,
    fontWeight: 600,
    color: '#92400E',
    background: '#FFFBEB',
    borderRadius: 'var(--r-field)',
    padding: '10px 12px',
    lineHeight: 1.4,
  };

  // Si una habitación elegida quedó ocupada con las fechas nuevas, sale de la distribución
  const distFree = {};
  Object.keys(dist).forEach((id) => {
    if (dist[id] > 0 && freeRooms.some((r) => r.id === id)) distFree[id] = dist[id];
  });
  const placed = Object.values(distFree).reduce((s, v) => s + v, 0);
  const left = guests - placed;

  const mkItem = (room, g, ci, co, nightsLabel = '') => {
    const t = roomTypeOf(room);
    const q = t ? quoteStay(ci, co, t.id, g, tarifas) : null;
    return { key: room + ci, room, desc: ROOM_DESC[room] || room, guests: g, q, total: q && !q.missing ? q.total : null, from: ci, to: co, nightsLabel };
  };
  const items = planActive
    ? [
        ...plan.fixed.map((f) => mkItem(f.room, f.guests, checkIn, checkOut)),
        ...plan.segs.map((sg) => mkItem(sg.room, plan.moving, sg.from, sg.to, nightsText(sg.nights))),
      ]
    : ROOMS.filter((r) => distFree[r.id]).map((r) => mkItem(r.id, distFree[r.id], checkIn, checkOut));
  const missingPrice = items.some((it) => it.total === null);
  const total = items.reduce((s, it) => s + (it.total || 0), 0);
  const done = n > 0 && (planActive || left === 0) && items.length > 0 && !missingPrice;

  // Deslizamientos del recorrido guiado
  const allPlaced = n > 0 && guests > 0 && !planActive && left === 0 && items.length > 0;
  const allPlacedRef = useRef(allPlaced);
  allPlacedRef.current = allPlaced;
  // Al elegir fechas: que Personas (recién aparecida) se vea entera
  useEffect(() => {
    if (!glowKey) return;
    const t = setTimeout(() => scrollToStep(personasRef, 'nearest'), 250);
    return () => clearTimeout(t);
  }, [glowKey]);
  // Al dejar de tocar + / − (0,4 s): el almanaque sube y quedan Personas arriba y las habitaciones a la vista
  useEffect(() => {
    if (!guests) return;
    const t = setTimeout(() => !allPlacedRef.current && scrollToStep(personasRef), 400);
    return () => clearTimeout(t);
  }, [guests]);
  // Todos ubicados: las habitaciones suben y queda a la vista la cotización
  useEffect(() => {
    if (!allPlaced) return;
    const t = setTimeout(() => scrollToStep(quoteRef), 350);
    return () => clearTimeout(t);
  }, [allPlaced]);
  // Con cambio de habitación: lo mismo, desde ese paso
  useEffect(() => {
    if (!planActive) return;
    const t = setTimeout(() => scrollToStep(planRef), 300);
    return () => clearTimeout(t);
  }, [planActive]);

  // Para la reserva: una o varias (con cambio de habitación, una tras otra con los mismos datos del huésped)
  const reserveQueue = () => {
    if (!planActive) {
      return [
        {
          initial: { propertyId: 'hostel', checkIn, checkOut, room: items[0].room, totalGuests: items[0].guests },
          rooms: items.length > 1 ? items.map((it) => ({ room: it.room, guests: it.guests })) : null,
        },
      ];
    }
    const notes = `🔀 Cambio de habitación: ${planText(plan, guests)}.`;
    const q = [];
    if (plan.fixed.length)
      q.push({
        initial: { propertyId: 'hostel', checkIn, checkOut, room: plan.fixed[0].room, totalGuests: plan.fixed[0].guests, notes },
        rooms: plan.fixed.length > 1 ? plan.fixed : null,
      });
    plan.segs.forEach((sg) =>
      q.push({
        initial: { propertyId: 'hostel', checkIn: sg.from, checkOut: sg.to, room: sg.room, totalGuests: plan.moving, notes },
        rooms: null,
      })
    );
    return q;
  };

  // Habitación recomendada para las personas que faltan ubicar: la que menos lugar desperdicia
  // (así quedan libres las grandes para grupos); si ninguna alcanza, la más grande. Empate: la más barata.
  const priceFor = (room, g) => {
    const t = roomTypeOf(room);
    const q = t ? quoteStay(checkIn, checkOut, t.id, g, tarifas) : null;
    return q && !q.missing ? q.total : null;
  };
  const unassigned = freeRooms.filter((r) => !distFree[r.id]);
  const bedInfo = (r) => ROOM_BEDS[r.id] || { camas: r.maxGuests, plazas: r.maxGuests, sofa: 0 };
  const sofaOK = sofa !== false;
  // Por defecto el sofá cama cuenta como una cama más (a la mayoría no le molesta); "No" lo saca
  const sofaMode = sofa === false ? 'no' : 'ok';
  const selKey = (sel) => (sel ? sel.map((x) => x.id + x.g + (x.alts || []).join('')).join() : '-');
  // Lugares de una habitación según si comparten cama (sh) y si usan el sofá cama (sf)
  const noSofaCap = (r, sh) => (sh ? bedInfo(r).plazas : bedInfo(r).camas);
  const capFor = (r, sh, sf) => noSofaCap(r, sh) + (sf ? bedInfo(r).sofa : 0);
  // Elige habitaciones para "need" personas: entre las que alcanzan, la más chica de verdad (capacidad
  // de la habitación, así quedan libres las grandes para grupos); empate, la que no necesita el sofá cama
  // y después la más barata. Si siguen empatadas (ej. 1, 2, 3 y 5 para 2 personas), son alternativas
  // iguales: van todas en `alts` y la sugerencia las nombra a todas.
  // Si ninguna alcanza sola, la más grande y sigue con las que faltan. Con varias habitaciones también
  // se guardan las iguales de cada una (ver `roomsTxt`).
  // mode: 'ok' (por defecto: el sofá cama vale igual que una cama) · 'no' (no quieren usarlo)
  const pickRooms = (need, sh, mode) => {
    const capOf = (r) => capFor(r, sh, mode !== 'no');
    const byPrice = (a, b) => (priceFor(a.id, Math.min(need, a.maxGuests)) || 0) - (priceFor(b.id, Math.min(need, b.maxGuests)) || 0);
    let pool = unassigned.filter((r) => capOf(r) > 0);
    let rest = need;
    const out = [];
    while (rest > 0 && pool.length) {
      const fit = pool.filter((r) => capOf(r) >= rest);
      const sofaUse = (r) => (Math.min(rest, capOf(r)) > noSofaCap(r, sh) ? 1 : 0);
      // Empate de tamaño: siempre mejor la que no necesita el sofá cama
      const cmpFit = (a, b) => a.maxGuests - b.maxGuests || sofaUse(a) - sofaUse(b) || byPrice(a, b);
      const cmpBig = (a, b) => capOf(b) - capOf(a) || sofaUse(a) - sofaUse(b) || byPrice(a, b);
      const cmp = fit.length ? cmpFit : cmpBig;
      const sorted = [...(fit.length ? fit : pool)].sort(cmp);
      const r = sorted[0];
      const g = Math.min(rest, capOf(r));
      const alts = sorted.slice(1).filter((x) => cmp(x, r) === 0).map((x) => x.id);
      out.push({ id: r.id, g, cap: capOf(r), max: r.maxGuests, sofa: g > noSofaCap(r, sh), alts });
      rest -= g;
      pool = pool.filter((x) => x !== r);
    }
    return rest > 0 ? null : out;
  };
  // Habitaciones que llevan ⭐: las de la sugerencia y sus iguales
  const recIds = (sel) => sel.flatMap((x) => [x.id, ...x.alts]);
  const listO = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} o ${a[a.length - 1]}`);
  // "la habitación 1, con una persona en el sofá cama" · "cualquiera de estas: la habitación 1, 2, 3 o 5"
  // · "la habitación 1 (3, una en el sofá cama) y la 6 (1)" · "la habitación 1 (5; o la 2, 3 o 5) y la 6 (2)"
  const roomsTxt = (sel) =>
    sel.length === 1
      ? sel[0].alts.length
        ? `cualquiera de estas: la habitación ${listO([sel[0].id, ...sel[0].alts].sort().map(roomNum))}${
            sel[0].sofa ? ', con una persona en el sofá cama' : ''
          }`
        : `la habitación ${roomNum(sel[0].id)}${sel[0].sofa ? ', con una persona en el sofá cama' : ''}`
      : listY(manyTxt(sel));
  // Varias habitaciones, con sus iguales: "la habitación 1 (5; o la 2, 3 o 5) y la 6 (2)". Si dos o más de
  // la sugerencia son iguales entre sí y hay más para elegir: "dos entre la 1, 2 y 5 (3 en cada una, …)".
  const manyTxt = (sel) => {
    const picked = new Set(sel.map((x) => x.id));
    const done = new Set();
    const named = new Set();
    const parts = [];
    sel.forEach((x) => {
      if (done.has(x.id)) return;
      const first = parts.length === 0;
      const eq = [x.id, ...x.alts];
      const mates = sel.filter((y) => y !== x && !done.has(y.id) && x.alts.includes(y.id));
      const k = mates.length + 1;
      if (mates.length && eq.length > k && mates.every((y) => y.g === x.g && y.sofa === x.sofa)) {
        [x, ...mates].forEach((y) => done.add(y.id));
        eq.forEach((id) => named.add(id));
        const cuantas = ['', '', 'dos', 'tres', 'cuatro', 'cinco'][k] || String(k);
        parts.push(
          `${cuantas}${first ? ' habitaciones' : ''} entre la ${listY([...eq].sort().map(roomNum))} (${x.g} en cada una${
            x.sofa ? ', una en el sofá cama' : ''
          })`
        );
        return;
      }
      done.add(x.id);
      const alts = x.alts.filter((id) => !picked.has(id) && !named.has(id)).sort();
      alts.forEach((id) => named.add(id));
      parts.push(
        `${first ? 'la habitación' : 'la'} ${roomNum(x.id)} (${x.g}${x.sofa ? ', una en el sofá cama' : ''}${
          alts.length ? `; o la ${listO(alts.map(roomNum))}` : ''
        })`
      );
    });
    return parts;
  };
  let recRooms = [];
  let recText = '';
  let sofaAsk = false; // ¿mostrar "¿Quieren usar el sofá cama?"?
  if (left > 0 && unassigned.length > 1) {
    // Antes de elegir: "Para 4 personas…"; con alguna habitación elegida: "Para las 2 que faltan…"
    const para = placed === 0 ? `Para ${personas(left)}` : left === 1 ? 'Para la persona que falta' : `Para las ${left} que faltan`;
    const biggest = Math.max(...unassigned.map((r) => r.maxGuests));
    const why = (sel) =>
      sel.length === 1 && sel[0].max < biggest && !sel[0].sofa ? ': así quedan libres las más grandes para grupos' : '';
    const sinSofa = sofa === false ? ', sin usar el sofá cama,' : '';
    if (left === 1 || share !== null) {
      const sh = left === 1 ? true : share;
      const sel = pickRooms(left, sh, sofaMode);
      // La pregunta del sofá cama aparece cuando la sugerencia lo usa (o si ya la respondieron)
      sofaAsk = left > 1 && (sofa !== null || !!(pickRooms(left, sh, 'ok') || []).some((x) => x.sofa));
      const como = left === 1 ? '' : share ? ', compartiendo cama' : ', cada uno en su cama';
      if (sel) {
        recRooms = recIds(sel);
        recText = `⭐ ${para}${como}${sinSofa || (como ? ',' : '')} te conviene ${roomsTxt(sel)}${why(sel)}.`;
      } else {
        recText = `${para}${como}${sofa === false ? ' y sin usar el sofá cama' : ''} no nos alcanzan las habitaciones libres.`;
      }
    } else {
      // Sin responder: los dos casos
      const shared = pickRooms(left, true, sofaMode);
      const solo = pickRooms(left, false, sofaMode);
      const same = shared && solo && selKey(shared) === selKey(solo);
      if (same) {
        recRooms = recIds(shared);
        // Mismas habitaciones, pero si cada uno quiere su cama alguien va al sofá cama: se aclara
        const soloSofa = solo.some((x) => x.sofa) && !shared.some((x) => x.sofa);
        recText = soloSofa
          ? `⭐ ${para} te conviene ${roomsTxt(shared)} (si cada uno quiere su cama, una persona va en el sofá cama).`
          : `⭐ ${para} te conviene ${roomsTxt(shared)}${why(shared)}.`;
      } else if (shared && solo) {
        recRooms = [...new Set([...recIds(shared), ...recIds(solo)])];
        recText = `⭐ ${para}: si pueden compartir cama, te conviene ${roomsTxt(shared)}; si cada uno quiere su cama, ${roomsTxt(solo)}.`;
      } else if (shared || solo) {
        const sel = shared || solo;
        recRooms = recIds(sel);
        recText = `⭐ ${para} te conviene ${roomsTxt(sel)}.`;
      }
    }
  }
  const msg = done ? (lang === 'en' ? quoteMessageEn : quoteMessage)({ checkIn, checkOut, guests, items, total }) : '';
  const cap1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  const setRoomGuests = (id, g) => {
    setDist((d) => {
      const x = { ...d };
      if (g > 0) x[id] = g;
      else delete x[id];
      return x;
    });
    setOpenRoom('');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = msg;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e2) {}
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lbl = { fontSize: 11, fontWeight: 800, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 };
  const stepBtn = (disabled) => ({
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 'none',
    background: disabled ? 'var(--bg)' : 'var(--fill)',
    color: disabled ? 'var(--handle)' : 'var(--acc)',
    fontSize: 24,
    fontWeight: 600,
    lineHeight: 1,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
  });

  return (
    <div>
      <style>{QT_CSS}</style>
      {/* 1 · Fechas */}
      <Step num={1} title="Fechas" done={n > 0 && !picking}>
      <RangeCalendar
        key={calKey}
        fixedRows
        checkIn={picking ? draftIn : checkIn}
        checkOut={picking ? '' : checkOut}
        onChange={(ci, co) => (co ? commitDates(ci, co) : setDraftIn(ci))}
      />
      {/* Alto fijo de dos renglones: el texto cambia sin mover lo de abajo */}
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--acc)', marginTop: 10, lineHeight: 1.35, minHeight: 37 }}>
        {picking
          ? `Entrada el ${oneDay(draftIn)}. Ahora tocá la fecha de salida.`
          : n > 0
          ? `${cap1(entradaSalida(checkIn, checkOut))} · ${noches(n)}`
          : checkIn
          ? 'Elegí la fecha de salida'
          : 'Tocá la fecha de entrada'}
      </div>
      </Step>

      {n > 0 && (
        <div
          aria-hidden={picking}
          style={{ opacity: picking ? 0.4 : 1, pointerEvents: picking ? 'none' : 'auto', transition: 'opacity .2s' }}
        >
          {/* 2 · Personas */}
          <Step
            key={'personas' + glowKey}
            num={2}
            title="Personas"
            done={guests > 0 && (!short || planActive)}
            glow={glowKey > 0}
            boxRef={personasRef}
          >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" disabled={guests <= 1} onClick={() => setGuests((g) => Math.max(1, g - 1))} style={stepBtn(guests <= 1)}>
              −
            </button>
            <div style={{ fontSize: 26, fontWeight: 800, minWidth: 40, textAlign: 'center', color: guests ? 'var(--ink)' : 'var(--handle)' }}>{guests}</div>
            {!guests && <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>Tocá + para elegir</div>}
            <button
              type="button"
              disabled={guests >= HOSTEL_CAPACITY}
              onClick={() => setGuests((g) => Math.min(HOSTEL_CAPACITY, g + 1))}
              style={stepBtn(guests >= HOSTEL_CAPACITY)}
            >
              +
            </button>
          </div>
          {full ? (
            <div className="pop-in" style={warnBox}>{noRoomText(av, checkIn, checkOut, guests)}</div>
          ) : guests > freeCap ? (
            <div className="pop-in" style={warnBox}>
              {esosDias} solo nos queda lugar para {personas(freeCap)}. {busyText(av, busyRooms.map((r) => r.id))}
              {plan ? ` Pero ${planText(plan, guests)}.` : ''}
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--mut)' }}>
              {busyRooms.length
                ? `${esosDias} tenemos lugar para hasta ${personas(freeCap)}.`
                : `${esosDias} tenemos todo el hostel libre: lugar para hasta ${personas(freeCap)}.`}
            </div>
          )}

          {short && (plan || (near && (near.before || near.after)) || (near && !near.before && !near.after)) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {plan && (
                <button
                  type="button"
                  onClick={() => setPlanOn(!planOn)}
                  style={{
                    minHeight: 44,
                    borderRadius: 'var(--r-field)',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    background: planOn ? '#7C3AED' : '#F5F3FF',
                    color: planOn ? '#fff' : '#6D28D9',
                    border: 'none',
                  }}
                >
                  {ic(planOn ? 'tick' : 'shuffle', 16)}
                  {planOn ? 'Cotizando con el cambio de habitación' : 'Cotizar con este cambio de habitación'}
                </button>
              )}
              {near && (near.before || near.after) && (
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}>
                  {ic('cal', 14)}Fechas más cercanas con lugar para {guests === 1 ? 'esa persona' : `las ${guests} personas`}
                  {plan ? ' sin cambiar de habitación' : ''}:
                </div>
              )}
              {near &&
                [near.after, near.before]
                  .filter(Boolean)
                  .sort((a, b) => Math.abs(diffDays(checkIn, a)) - Math.abs(diffDays(checkIn, b)))
                  .map((ci) => (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => goDates(ci)}
                      style={{
                        minHeight: 44,
                        borderRadius: 'var(--r-field)',
                        fontFamily: 'inherit',
                        fontWeight: 600,
                        fontSize: 13.5,
                        cursor: 'pointer',
                        background: 'var(--acc-soft)',
                        color: 'var(--acc)',
                        border: 'none',
                        textAlign: 'left',
                        padding: '9px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      {cap1(entradaSalida(ci, fmt(addDays(parseD(ci), n))))}
                      <Icon name="chev" size={17} />
                    </button>
                  ))}
              {near && !near.before && !near.after && !plan && (
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>
                  No encontré fechas cercanas (3 meses antes o después) con lugar para {personas(guests)} juntas.
                </div>
              )}
            </div>
          )}

          </Step>

          {planActive && (
            <Step num={3} title="Con cambio de habitación" done boxRef={planRef}>
            <div style={{ fontSize: 13, color: '#5B21B6', background: '#F5F3FF', borderRadius: 'var(--r-field)', padding: '10px 12px', lineHeight: 1.4 }}>
              {ic('shuffle', 14)}Cotizando con cambio de habitación. Al reservar se cargan una tras otra, con los mismos datos del huésped.
            </div>
            </Step>
          )}

          {guests > 0 && !full && !planActive && (
          <>
          {/* 3 · Distribución */}
          <Step num={3} title="¿Qué habitación/es prefieren?" done={left === 0}>
          {/* ¿Comparten cama? cambia la sugerencia (amigos o compañeros de trabajo suelen querer cada uno la suya) */}
          {guests >= 2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginRight: 2 }}>¿Pueden compartir cama?</span>
              {[
                [true, 'Sí'],
                [false, 'No, cada uno en su cama'],
              ].map(([v, l]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setShare(share === v ? null : v)}
                  style={{
                    minHeight: 36,
                    padding: '0 14px',
                    borderRadius: 999,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                    background: share === v ? 'var(--acc)' : 'var(--fill)',
                    color: share === v ? '#fff' : 'var(--ink)',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {share === v && <Icon name="tick" size={14} strokeWidth={3} />}
                  {l}
                </button>
              ))}
            </div>
          )}
          {sofaAsk && (
            <div className="qt-in" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginRight: 2 }}>¿Quieren usar el sofá cama?</span>
              {[
                [true, 'Sí'],
                [false, 'No'],
              ].map(([v, l]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setSofa(sofa === v ? null : v)}
                  style={{
                    minHeight: 36,
                    padding: '0 14px',
                    borderRadius: 999,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                    background: sofa === v ? 'var(--acc)' : 'var(--fill)',
                    color: sofa === v ? '#fff' : 'var(--ink)',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {sofa === v && <Icon name="tick" size={14} strokeWidth={3} />}
                  {l}
                </button>
              ))}
            </div>
          )}
          {/* Va apareciendo según el proceso: sugerencia → (al elegir) cuántos faltan → listo */}
          {placed > 0 && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 8,
                color: left === 0 ? '#047857' : left > 0 ? '#B45309' : '#B91C1C',
              }}
            >
              {left === 0
                ? <>{ic('check', 15)}¡Listo! Todos tienen lugar.</>
                : left > 0
                ? `Falta ubicar a ${personas(left)}`
                : `Hay ${personas(-left)} de más: quitá en alguna habitación.`}
            </div>
          )}
          {recText && (
            <div style={{ display: 'flex', gap: 7, fontSize: 13, color: '#92400E', background: '#FFFBEB', borderRadius: 'var(--r-field)', padding: '9px 11px', marginBottom: 10, lineHeight: 1.4 }}>
              <Icon name="star" size={16} color="#D97706" style={{ marginTop: 1 }} />
              <span>{recText.replace(/^⭐ /, '')}</span>
            </div>
          )}
          {placed === 0 && <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 8 }}>Tocá la habitación que prefieran.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {freeRooms.map((r, idx) => {
              const g = distFree[r.id] || 0;
              const isOpen = openRoom === r.id;
              const canAdd = left > 0 || g > 0;
              const maxHere = Math.min(r.maxGuests, g + Math.max(0, left));
              return (
                <div
                  key={r.id}
                  className="qt-in"
                  style={{
                    animationDelay: `${idx * 60}ms`,
                    background: g ? 'var(--acc-soft)' : isOpen ? 'var(--card)' : 'var(--bg)',
                    borderRadius: 'var(--r-item)',
                    overflow: 'hidden',
                    boxShadow: g
                      ? 'inset 0 0 0 1.5px var(--acc)'
                      : isOpen
                      ? 'inset 0 0 0 1.5px #93C5FD, 0 4px 14px rgba(37,99,235,.12)'
                      : 'none',
                    transition: 'background .2s, box-shadow .25s',
                  }}
                >
                  <div
                    className={!g && canAdd ? "tap" : undefined}
                    onClick={() => !g && canAdd && setOpenRoom(isOpen ? '' : r.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '11px 12px 11px 14px',
                      cursor: !g && canAdd ? 'pointer' : 'default',
                    }}
                  >
                    {/* Datos de la habitación (sin personas: tocar la tarjeta abre "¿Cuántas van aquí?") */}
                    <div style={{ flex: 1, minWidth: 0, opacity: canAdd ? 1 : 0.5 }}>
                    <span>
                        <span style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--ink)' }}>{r.id}</span>
                        <span style={{ fontSize: 12, color: 'var(--mut)' }}> · {r.desc} · hasta {r.maxGuests}</span>
                        {(() => {
                          const k = g || Math.min(Math.max(left, 1), r.maxGuests);
                          const pr = priceFor(r.id, k);
                          const late = lateOutOn(allRes, r.id, checkIn);
                          return (
                            <span style={{ display: 'block', fontSize: 11.5, marginTop: 2 }}>
                              {pr !== null && (
                                <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>
                                  {g ? currency(pr) : `${personas(k)}: ${currency(pr)}`}
                                  {g > 0 &&
                                    (() => {
                                      // Cómo duermen en esta habitación con esa cantidad
                                      const bi = bedInfo(r);
                                      let note = '';
                                      let warn = false;
                                      if (share === false) {
                                        const conSofa = bi.camas + (sofaOK ? bi.sofa : 0);
                                        if (g > conSofa) {
                                          note = `${(g - conSofa) * 2} comparten cama`;
                                          warn = true;
                                        } else if (g > bi.camas) note = '1 en el sofá cama';
                                      } else if (sofa === false && g > bi.plazas) {
                                        note = '1 en el sofá cama';
                                        warn = true;
                                      } else if (share === null && g > bi.camas + bi.sofa) {
                                        note = `${(g - bi.camas - bi.sofa) * 2} comparten cama`;
                                      }
                                      return note ? (
                                        <span style={{ color: warn ? '#B45309' : 'var(--mut)', fontWeight: warn ? 800 : 600 }}>
                                          {' '}
                                          · {warn ? ic('warning', 12, { marginRight: 3 }) : ''}
                                          {note}
                                        </span>
                                      ) : null;
                                    })()}
                                </span>
                              )}
                              {recRooms.includes(r.id) && (
                                <span style={{ marginLeft: 6, color: '#B45309', fontWeight: 700, whiteSpace: 'nowrap' }}>{ic('star', 12, { marginRight: 3 })}Recomendada</span>
                              )}
                              {late && (
                                <span style={{ display: 'block', color: '#4F46E5', fontWeight: 700 }}>
                                  {ic('clock', 12, { marginRight: 3 })}Libre desde las {late}: ese día sale alguien con late check-out
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </span>
                    </div>
                    {g ? (
                      // Con personas: contador − N + (con 1, el − la quita)
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          title={g === 1 ? `Quitar ${r.id}` : 'Una persona menos'}
                          onClick={() => setRoomGuests(r.id, g - 1)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            fontFamily: 'inherit',
                            fontWeight: 600,
                            fontSize: 22,
                            lineHeight: 1,
                            cursor: 'pointer',
                            background: 'var(--card)',
                            color: g === 1 ? 'var(--red)' : 'var(--acc)',
                            border: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                          }}
                        >
                          {g === 1 ? <Icon name="close" size={17} strokeWidth={2.5} /> : '−'}
                        </button>
                        <div style={{ textAlign: 'center', minWidth: 58 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--acc)', lineHeight: 1.1 }}>{g}</div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--acc)' }}>{g === 1 ? 'persona' : 'personas'}</div>
                        </div>
                        <button
                          type="button"
                          title="Una persona más"
                          disabled={g >= maxHere}
                          onClick={() => setRoomGuests(r.id, g + 1)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            fontFamily: 'inherit',
                            fontWeight: 600,
                            fontSize: 22,
                            lineHeight: 1,
                            cursor: g >= maxHere ? 'default' : 'pointer',
                            background: g >= maxHere ? 'var(--card)' : 'var(--acc)',
                            color: g >= maxHere ? 'var(--handle)' : '#fff',
                            border: 'none',
                            padding: 0,
                          }}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      // Sin personas: flechita gris (se toca la tarjeta entera)
                      <span
                        aria-hidden
                        style={{
                          flexShrink: 0,
                          display: 'inline-flex',
                          color: !canAdd ? 'var(--line)' : isOpen ? 'var(--acc)' : 'var(--handle)',
                          transform: isOpen ? 'rotate(90deg)' : 'none',
                          transition: 'transform .15s',
                        }}
                      >
                        <Icon name="chev" size={20} strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                  {!g && (
                    // Expansión suave al tocar la habitación
                    <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows .28s ease' }}>
                      <div style={{ overflow: 'hidden', opacity: isOpen ? 1 : 0, transition: 'opacity .22s ease' }}>
                    <div style={{ padding: '0 12px 12px' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--acc)', marginBottom: 6 }}>¿Cuántas van aquí?</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Array.from({ length: r.maxGuests }, (_, i) => i + 1).map((k) => {
                          const dis = k > maxHere;
                          return (
                            <button
                              key={k}
                              type="button"
                              disabled={dis}
                              onClick={() => setRoomGuests(r.id, k)}
                              style={{
                                minWidth: 44,
                                minHeight: 42,
                                borderRadius: 'var(--r-field)',
                                fontFamily: 'inherit',
                                fontWeight: 700,
                                fontSize: 16,
                                cursor: dis ? 'default' : 'pointer',
                                background: g === k ? 'var(--acc)' : 'var(--fill)',
                                color: g === k ? '#fff' : dis ? 'var(--handle)' : 'var(--ink)',
                                border: 'none',
                                opacity: dis ? 0.5 : 1,
                              }}
                            >
                              {k}
                            </button>
                          );
                        })}
                        {g > 0 && (
                          <button
                            type="button"
                            onClick={() => setRoomGuests(r.id, 0)}
                            style={{
                              minHeight: 42,
                              padding: '0 14px',
                              borderRadius: 'var(--r-field)',
                              fontFamily: 'inherit',
                              fontWeight: 600,
                              fontSize: 14,
                              cursor: 'pointer',
                              background: '#FEF2F2',
                              color: 'var(--red)',
                              border: 'none',
                            }}
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {busyRooms.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {busyRooms.map((r, idx) => (
                <div
                  key={r.id}
                  className="qt-in"
                  style={{
                    animationDelay: `${(freeRooms.length + idx) * 60}ms`,
                    padding: '8px 14px',
                    borderRadius: 'var(--r-field)',
                    background: 'var(--bg)',
                    opacity: 0.75,
                    fontSize: 12.5,
                    color: 'var(--mut)',
                  }}
                >
                  <b style={{ color: 'var(--mut)' }}>{r.id}</b> ·{' '}
                  {r.busyNights.length === n ? `ocupada ${n === 1 ? 'ese día' : 'esos días'}` : `ocupada ${nightsText(r.busyNights)}`}
                </div>
              ))}
            </div>
          )}

          </Step>
          </>
          )}

          {/* 4 · Cotización */}
          {items.length > 0 && (
            <Step num={4} title="Cotización" done={done} boxRef={quoteRef}>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-item)', overflow: 'hidden' }}>
                {items.map((it) => (
                  <div key={it.key} style={{ padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                        <b>{it.room}</b> · {personas(it.guests)}
                        {it.nightsLabel && <span style={{ color: '#7C3AED', fontSize: 12 }}> · {it.nightsLabel}</span>}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>
                        {it.total === null ? 'Sin precio' : currency(it.total)}
                      </div>
                    </div>
                    {it.q && !it.q.missing && (
                      <div style={{ fontSize: 11.5, color: 'var(--mut)', marginTop: 2, lineHeight: 1.45 }}>
                        {it.q.lines.map((l) => `${l.count} × ${currency(l.price)}`).join(' + ')}
                        {it.q.extraGuests > 0 &&
                          ` + ${it.q.extraGuests === 1 ? '1 persona extra' : `${it.q.extraGuests} personas extra`} ${currency(it.q.extraTotal)}`}
                      </div>
                    )}
                  </div>
                ))}
                {done ? (
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Total</div>
                      <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink)' }}>
                        {currency(total)}
                        {guests > 1 && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}> ({money(total / guests)} por persona)</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12.5, color: 'var(--mut)', marginTop: 4 }}>
                      Promedio por persona por noche: <b style={{ color: 'var(--ink)' }}>{money(Math.round((total / guests / n) * 100) / 100)}</b>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '11px 14px', fontSize: 13, color: '#92400E', background: '#FFFBEB' }}>
                    {missingPrice
                      ? 'Una de las habitaciones no tiene precio cargado en Tarifas para esas fechas.'
                      : left > 0
                      ? 'Cuando ubiques a todos, te muestro el total.'
                      : 'Ajustá las habitaciones y te muestro el total.'}
                  </div>
                )}
              </div>
            </Step>
          )}

          {done && (
            <Step num={5} title="Mensaje para WhatsApp" done={copied}>
              {/* Español / English: para huéspedes que no hablan español (en inglés aclara que son pesos MXN) */}
              <div style={{ display: 'inline-flex', gap: 2, padding: 2, marginBottom: 10, background: 'var(--fill)', borderRadius: 10 }}>
                {[['es', 'Español'], ['en', 'English']].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setLang(k);
                      setCopied(false);
                    }}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: lang === k ? 700 : 600,
                      cursor: 'pointer',
                      border: 'none',
                      background: lang === k ? 'var(--card)' : 'transparent',
                      boxShadow: lang === k ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
                      color: lang === k ? 'var(--ink)' : 'var(--mut)',
                      transition: 'background .15s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: '#F0FDF4',
                  borderRadius: 'var(--r-item)',
                  padding: '12px 14px',
                  color: '#14532D',
                }}
              >
                {msg}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={copy}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    borderRadius: 'var(--r-field)',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: 'pointer',
                    background: copied ? '#047857' : '#16A34A',
                    color: '#fff',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                  }}
                >
                  <Icon name={copied ? 'tick' : 'whatsapp'} size={18} strokeWidth={copied ? 3 : 2} />
                  {copied ? 'Copiado' : 'Copiar para WhatsApp'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500, marginTop: 10, lineHeight: 1.45 }}>
                * Ojo: si entró una reserva de Booking que todavía no aparece en el calendario, esa habitación puede figurar libre.
              </div>
            </Step>
          )}

          {/* 6 · Reservar: en su propia tarjeta, separado del mensaje */}
          {done && onReserve && (
            <Step num={6} title="Reservar">
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 10, lineHeight: 1.45 }}>
                {planActive
                  ? `Se abren ${reserveQueue().length} reservas una tras otra (cambio de habitación), con los datos del huésped de la primera.`
                  : items.length > 1
                  ? `Abre el formulario como reserva de grupo, con las ${items.length} habitaciones, sus personas y tarifas cargadas.`
                  : 'Abre el formulario con fechas, habitación, personas y tarifa cargadas.'}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <button
                type="button"
                onClick={() => onReserve({ queue: reserveQueue() })}
                style={{
                  flex: 2,
                  minHeight: 48,
                  borderRadius: 'var(--r-field)',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  background: 'var(--acc)',
                  color: '#fff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Icon name="plus" size={18} strokeWidth={2.5} />
                Reservar
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 'var(--r-field)',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    fontSize: 13.5,
                    cursor: 'pointer',
                    background: 'var(--fill)',
                    color: 'var(--ink)',
                    border: 'none',
                    lineHeight: 1.2,
                  }}
                >
                  Cerrar sin reservar
                </button>
              )}
              </div>
            </Step>
          )}
        </div>
      )}
    </div>
  );
}

// Botón "Cotizar" (calculadora) (va al lado de cada "+ Reserva" / "+ Nueva")
export function QuoteButton({ onClick, compact = false, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Cotizar"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: compact ? '7px 10px' : '7px 13px',
        background: 'var(--acc-soft)',
        border: 'none',
        borderRadius: 20,
        color: 'var(--acc)',
        fontFamily: 'inherit',
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <Icon name="calculator" size={16} />{compact ? '' : 'Cotizar'}
    </button>
  );
}
