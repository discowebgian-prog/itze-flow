/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useRef, useMemo } from 'react';
import { IneUploader } from './IneUploader';
import { ConflictWarn } from '../ui/ConflictWarn';
import { CountrySelector } from '../ui/CountrySelector';
import { Icon, ic } from '../ui/Icon';
import { Inp } from '../ui/Inp';
import { RangeCalendar } from '../ui/RangeCalendar';
import { Sel } from '../ui/Sel';
import { ROOMS, SOURCES, RS, COUNTRIES, findCountry } from '../../lib/constants';
import { TODAY, fmt, fmtD, addDays, diffDays, currency, parseD } from '../../lib/dates';
import { lastVisitText, birthdayInStay, birthdayText, cleanBirthDate } from '../../lib/guestMessages';
import { findConflicts, calcStayTotal, lateCostOf } from '../../lib/reservations';
import { freeStayText, nowMerida, pastStartText } from '../../lib/voice';
import { quoteRoom, pricingMatches, applyQuote } from '../../lib/rates';
import { QuoteInfo, money } from './QuoteInfo';
import { listY, Step, QT_CSS, scrollToStep } from '../Quoter';
import { stayInfo, stayBadge, suggestGuests } from '../../lib/guests';
import {
  groupOf,
  groupTitular,
  groupBooker,
  bookerOf,
  hasOwnContact,
  changedFields,
  sameName,
  splitPaid,
  newGroupId,
  PERSON_FIELDS,
  SHARED_FIELDS,
  SHARED_LABELS,
} from '../../lib/groups';
import { DocLink } from '../ui/DocLink';
import { LatePicker } from './LatePicker';
import { LATE_COLORS } from '../ui/LateBadge';
import { GROUP_COLORS } from '../ui/GroupBadge';
import { AnimatePresence } from 'motion/react';
import { Backdrop, PopCard } from '../ui/Motion';

export function ResForm({
  initial,
  visibleProps,
  onSave,
  onClose,
  prefillProp,
  prefillDate,
  allRes = [],
  guestDecisions = [],
  focusDoc = false,
  tarifas = [],
  initialRooms = null, // desde Cotizar: [{ room, guests }] → con 2 o más arranca como grupo
  fixedSource = '', // Equipo (paso 9): canal fijo ('Directo-Puerta'); solo se muestra ese
  soloDatos = false, // Equipo (paso 9), reserva que no cargó: solo huésped, documento y acompañantes
  canPrice = true, // Equipo sin permiso "precio": tarifa, descuento y total quedan como el tarifario
}) {
  const blank = {
    propertyId: prefillProp || visibleProps[0]?.id || '',
    guestName: '',
    guestDoc: '',
    guestDocType: 'INE',
    guestPhone: '',
    guestPhonePrefix: '+52',
    guestNationality: 'MX',
    guestEmail: '',
    company: '', // nombre de la empresa (solo si solicita factura)
    lateCheckout: '', // hora del late check-out ('16:00') o vacío
    lateCost: '',
    checkIn: prefillDate || fmt(TODAY),
    checkOut: fmt(addDays(prefillDate ? parseD(prefillDate) : TODAY, 1)),
    status: '', // se elige al cargar (junto con el canal abre el resto del formulario)
    totalAmount: '',
    paid: '',
    paymentMethod: 'efectivo',
    source: fixedSource || '', // se elige al cargar (abre el resto del formulario); Equipo: fijo
    notes: '',
    room: '',
    totalGuests: 1,
    companions: [],
    requiresInvoice: false,
    lista_negra: false,
    pin_acceso: '',
    pricing: {
      ratePerNight: '',
      rateLabel: '',
      discountType: 'ninguno',
      discountValue: '',
      discountReason: '',
      additionals: [],
      bonifications: [],
    },
  };
  const [f, setF] = useState(() => {
    if (!initial) return blank;
    
    // Rellenamos las cajas de adicionales si faltan datos en reservas viejas
    const addsCount = Math.max(0, (initial.totalGuests || 1) - 2);
    let loadedAdditionals = initial.pricing?.additionals || [];
    
    if (loadedAdditionals.length < addsCount) {
      loadedAdditionals = [
        ...loadedAdditionals,
        ...Array(addsCount - loadedAdditionals.length).fill({
          ratePerNight: 0,
          bonificada: false,
        })
      ];
    }

    return {
      ...blank,
      ...initial,
      companions: initial.companions || [],
      pricing: { 
        ...blank.pricing, 
        ...(initial.pricing || {}),
        additionals: loadedAdditionals 
      },
    };
  });
  const sv = (k, v) => setF((x) => ({ ...x, [k]: v }));
  // Cotizador: en una reserva nueva la tarifa sigue al tarifario hasta que se escribe a mano
  const [rateAuto, setRateAuto] = useState(() => !initial?.id);

  // ── GRUPO AL EDITAR: esta habitación es parte de un grupo ──
  const members = useMemo(() => (initial?.grupoId ? groupOf(allRes, initial) : []), [allRes, initial?.grupoId]);
  const inGroup = !!initial?.id && members.length > 1;
  const titular = inGroup ? groupTitular(members) : null; // null = quien reservó no se aloja
  const booker = inGroup ? groupBooker(members) : null;
  const isTitRoom = inGroup && titular?.id === initial.id;
  // Sigue con los datos de quien reservó (todavía no se cargó el contacto de esta habitación)
  const wasPlaceholder = inGroup && !isTitRoom && !hasOwnContact(initial, members);

  const applyScan = (scan) => {
    const name = (scan.fullName || [scan.firstName, scan.lastName].filter(Boolean).join(' ')).trim();
    const country = findCountry(scan.nationality);
    setF((x) => {
      const next = { ...x };
      // En una habitación del grupo, el documento escaneado es el contacto de ESTA habitación
      if (inGroup && !isTitRoom && name) {
        // Si tenía los datos del titular, el teléfono y el email eran del titular: se vacían
        if (wasPlaceholder && !sameName(name, initial.guestName)) {
          next.guestPhone = '';
          next.guestEmail = '';
        }
        // Si estaba anotado como acompañante, se libera ese lugar para no contarlo dos veces
        next.companions = (x.companions || []).map((c) => (sameName(c.name, name) ? { name: '', phone: '' } : c));
      }
      next.guestName = name || x.guestName;
      next.guestDoc = scan.docNumber || x.guestDoc;
      next.guestDocType = ['INE', 'Pasaporte', 'Otro'].includes(scan.docType) ? scan.docType : x.guestDocType;
      next.guestNationality = country ? country.code : x.guestNationality;
      next.guestPhonePrefix = country && !next.guestPhone ? country.prefix : x.guestPhonePrefix;
      // Fecha de nacimiento (para el 🎂): la lee del documento; con CURP igual sale de ahí
      next.birthDate = cleanBirthDate(scan.birthDate) || (name ? '' : x.birthDate);
      return next;
    });
  };

  // Atajo "Cargar contacto de esta habitación": abre el formulario en el documento
  const docRef = useRef(null);
  useEffect(() => {
    if (focusDoc && docRef.current) {
      setTimeout(() => docRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }
  }, [focusDoc]);
  const nights = f.checkIn && f.checkOut ? diffDays(f.checkIn, f.checkOut) : 0;
  const isHostel = f.propertyId === 'hostel';
  const selRoom = isHostel ? ROOMS.find((r) => r.id === f.room) : null;
  const maxG = selRoom ? selRoom.maxGuests : isHostel ? 1 : 6;
  const addlCount = Math.max(0, f.totalGuests - 2);

  // ── VARIAS HABITACIONES (solo al crear una reserva del hostel) ──
  // Titular, fechas, estado, canal y pago se cargan una vez; cada habitación tiene su tarjeta
  // con huéspedes, acompañantes y tarifa. Al guardar se crea una reserva por habitación.
  const fromQuote = Array.isArray(initialRooms) && initialRooms.length > 1 ? initialRooms : null;
  const [multi, setMulti] = useState(!!fromQuote);
  const [selRooms, setSelRooms] = useState(() => (fromQuote ? fromQuote.map((r) => r.room) : []));
  const [alloc, setAlloc] = useState(() => {
    // habitación → { guests, companions, rate, extra, paid }
    const a = {};
    (fromQuote || []).forEach(
      (r) => (a[r.room] = { guests: r.guests, companions: [], rate: '', extra: '', paid: '', auto: true })
    );
    return a;
  });
  const [titularRoom, setTitularRoom] = useState('');
  const [splitPay, setSplitPay] = useState(false);
  const multiOn = !initial?.id && isHostel && multi;
  const isGroupNew = multiOn && selRooms.length > 1;
  // auto: la tarifa de la tarjeta sigue al tarifario (se apaga al escribirla a mano)
  const blankAlloc = () => ({ guests: 1, companions: [], rate: '', extra: '', paid: '', auto: true });
  const setA = (id, changes) => setAlloc((a) => ({ ...a, [id]: { ...(a[id] || blankAlloc()), ...changes } }));
  const toggleMulti = () => {
    if (!multi) {
      // Pasa la habitación ya elegida (con sus huéspedes) a la primera tarjeta
      if (f.room) {
        setSelRooms([f.room]);
        setAlloc({
          [f.room]: {
            ...blankAlloc(),
            guests: f.totalGuests || 1,
            companions: f.companions || [],
            rate: f.pricing.ratePerNight ?? '',
            auto: rateAuto,
          },
        });
        setTitularRoom(''); // se elige con la pregunta "¿En qué habitación duerme el titular?"
      }
      setMulti(true);
    } else {
      // Vuelve a una sola habitación: se queda la primera elegida
      const first = selRooms[0] || '';
      const a = alloc[first] || blankAlloc();
      setF((x) => ({
        ...x,
        room: first,
        totalGuests: first ? a.guests : 1,
        companions: first ? a.companions : [],
        pricing: {
          ...x.pricing,
          ratePerNight: first && a.rate !== '' ? a.rate : x.pricing.ratePerNight,
          additionals: Array.from({ length: Math.max(0, (first ? a.guests : 1) - 2) }, () => ({ ratePerNight: 0, bonificada: false })),
        },
      }));
      if (first) setRateAuto(a.auto !== false);
      setSelRooms([]);
      setSplitPay(false);
      setMulti(false);
    }
  };
  const toggleRoom = (id) => {
    const next = selRooms.includes(id) ? selRooms.filter((x) => x !== id) : [...selRooms, id];
    setSelRooms(next);
    if (!alloc[id]) setA(id, {});
    if (!next.includes(titularRoom)) setTitularRoom('');
  };
  // Precio de cada habitación: su tarifa (o la general) y el extra por persona desde la 3ª
  const roomPricing = (id) => {
    const a = alloc[id] || blankAlloc();
    const rate = a.rate !== null && a.rate !== undefined ? a.rate : '';
    return {
      ...f.pricing,
      ratePerNight: rate,
      additionals: Array.from({ length: Math.max(0, (a.guests || 1) - 2) }, () => ({
        ratePerNight: Number(a.extra) || 0,
        bonificada: false,
      })),
    };
  };
  const roomLate = f.lateCheckout ? Number(f.lateCost) || 0 : 0;
  const roomTotal = (id) => calcStayTotal(roomPricing(id), nights, roomLate);
  const groupTotal = multiOn ? selRooms.reduce((s, id) => s + roomTotal(id), 0) : 0;
  const groupGuests = multiOn ? selRooms.reduce((s, id) => s + ((alloc[id] || {}).guests || 1), 0) : 0;
  const groupPaidSplit = multiOn && splitPay ? selRooms.reduce((s, id) => s + (Number((alloc[id] || {}).paid) || 0), 0) : 0;

  // ── COTIZADOR (tarifario noche por noche) ──
  // Una habitación: en reservas nuevas la tarifa sigue al tarifario hasta que se escribe a mano.
  // Al editar una reserva que ya existe no cambia sola: si el tarifario da distinto, se ofrece usarlo.
  const quote = useMemo(
    () => (isHostel && f.room && !multiOn ? quoteRoom(f.room, f.checkIn, f.checkOut, f.totalGuests, tarifas) : null),
    [isHostel, f.room, f.checkIn, f.checkOut, f.totalGuests, tarifas, multiOn]
  );
  const quoteOk = !!quote && !quote.missing;
  const quoteMatches = quoteOk && pricingMatches(f.pricing, quote);
  useEffect(() => {
    if (!rateAuto || !quoteOk || quoteMatches) return;
    setF((x) => ({ ...x, pricing: applyQuote(x.pricing, quote, x.totalGuests) }));
  }, [rateAuto, quote, quoteOk, quoteMatches]);

  // Varias habitaciones: cada tarjeta con su tipo de habitación
  const roomQuote = (id) => quoteRoom(id, f.checkIn, f.checkOut, (alloc[id] || blankAlloc()).guests, tarifas);
  const cardMatches = (a, q) =>
    !!q && !q.missing && pricingMatches({ ratePerNight: a.rate, additionals: Array.from({ length: q.extraGuests }, () => ({ ratePerNight: a.extra })) }, q);
  useEffect(() => {
    if (!multiOn) return;
    const changes = {};
    selRooms.forEach((id) => {
      const a = alloc[id] || blankAlloc();
      if (a.auto === false) return;
      const q = roomQuote(id);
      if (!q || q.missing || cardMatches(a, q)) return;
      changes[id] = { rate: q.avg, extra: q.extraGuests ? q.extraAvg : a.extra };
    });
    if (Object.keys(changes).length) {
      setAlloc((al) => {
        const n = { ...al };
        Object.keys(changes).forEach((id) => (n[id] = { ...(n[id] || blankAlloc()), ...changes[id] }));
        return n;
      });
    }
  }, [multiOn, selRooms, alloc, f.checkIn, f.checkOut, tarifas]);

  // Grupo al editar con fechas nuevas: ¿el tarifario da distinto en alguna habitación?
  const groupDatesChanged = inGroup && (f.checkIn !== initial.checkIn || f.checkOut !== initial.checkOut);
  const [requoted, setRequoted] = useState(null); // { [id de otra habitación]: pricing del tarifario }
  const [requotePrev, setRequotePrev] = useState(null); // pricing de esta habitación antes de aplicar
  const [requoteOpen, setRequoteOpen] = useState(false);
  useEffect(() => {
    setRequoted(null);
    setRequotePrev(null);
  }, [f.checkIn, f.checkOut]);
  const groupQuotes = useMemo(() => {
    if (!groupDatesChanged) return [];
    const n = diffDays(f.checkIn, f.checkOut);
    return members
      .map((m) => {
        const isMe = m.id === initial.id;
        const pricing = isMe ? f.pricing : m.pricing;
        const guests = isMe ? f.totalGuests : m.totalGuests;
        const q = quoteRoom(m.room, f.checkIn, f.checkOut, guests, tarifas);
        if (!q || q.missing) return null;
        const late = isMe ? (f.lateCheckout ? Number(f.lateCost) || 0 : 0) : lateCostOf(m);
        const newPricing = applyQuote(pricing, q, guests);
        return {
          m,
          isMe,
          q,
          same: pricingMatches(pricing, q),
          nowRate: Number(pricing.ratePerNight) || 0,
          nowTotal: calcStayTotal(pricing, n, late),
          newPricing,
          newTotal: calcStayTotal(newPricing, n, late),
        };
      })
      .filter(Boolean);
  }, [groupDatesChanged, members, f.checkIn, f.checkOut, f.pricing, f.totalGuests, f.lateCheckout, f.lateCost, tarifas]);
  const requoteDiff = groupQuotes.filter((x) => !x.same && !(requoted && requoted[x.m.id]));
  const applyRequote = () => {
    const me = requoteDiff.find((x) => x.isMe);
    if (me) {
      setRequotePrev(f.pricing);
      sv('pricing', me.newPricing);
    }
    const others = {};
    requoteDiff.filter((x) => !x.isMe).forEach((x) => (others[x.m.id] = x.newPricing));
    setRequoted({ ...(requoted || {}), ...others });
    setRequoteOpen(false);
  };
  const undoRequote = () => {
    if (requotePrev) sv('pricing', requotePrev);
    setRequoted(null);
    setRequotePrev(null);
  };
  const requotedRooms = members
    .filter((m) => (requoted && requoted[m.id]) || (m.id === initial?.id && requotePrev))
    .map((m) => m.room);

  // En el hostel, sin habitación elegida no hay con qué comparar: no se avisa conflicto
  const conflicts = multiOn
    ? selRooms.flatMap((id) => findConflicts(allRes, f.propertyId, id, f.checkIn, f.checkOut, null))
    : isHostel && !f.room
    ? []
    : findConflicts(allRes, f.propertyId, f.room || '', f.checkIn, f.checkOut, initial?.id);
  // Cómo estaba el pago antes de tildar "VCC cobrada", para poder destildar
  const vccPrev = useRef(null);
  const [confModal, setConfModal] = useState(null);
  const [pastAsk, setPastAsk] = useState(null); // entrada antes de hoy: pedir OK antes de guardar
  const [isSaving, setIsSaving] = useState(false);
  const [valErr, setValErr] = useState(''); 

  // ── NÚMERO DE ESTANCIA DEL HUÉSPED (se actualiza mientras se escribe) ──
  const stay = stayInfo(allRes, f, guestDecisions);
  const stayTag = stayBadge(stay);

  // ── SUGERENCIA DE HUÉSPED ANTERIOR (al escribir el nombre a mano) ──
  // Solo aparece mientras se escribe en "Nombre completo" (no al abrir una reserva
  // ni cuando el escáner completa el nombre). Al confirmar, carga sus datos.
  const [nameTyped, setNameTyped] = useState(false);
  const [sugDismissed, setSugDismissed] = useState(false);
  const [picked, setPicked] = useState(null); // { name, prev } para poder deshacer
  const suggestions = useMemo(
    () =>
      nameTyped && !sugDismissed && !picked
        ? suggestGuests(allRes, f.guestName, guestDecisions, initial?.id)
        : [],
    [nameTyped, sugDismissed, picked, allRes, f.guestName, guestDecisions, initial?.id]
  );
  const GUEST_FIELDS = ['guestName', 'guestDoc', 'guestDocType', 'guestNationality', 'guestPhonePrefix', 'guestPhone', 'guestEmail', 'company', 'birthDate'];
  const pickGuest = (s) => {
    const prev = {};
    GUEST_FIELDS.forEach((k) => (prev[k] = f[k]));
    setF((x) => {
      const next = { ...x };
      GUEST_FIELDS.forEach((k) => {
        if (s.data[k]) next[k] = s.data[k];
      });
      return next;
    });
    setPicked({ name: s.data.guestName, visits: s.visits, prev });
  };
  const undoGuest = () => {
    if (!picked) return;
    setF((x) => ({ ...x, ...picked.prev }));
    setPicked(null);
    setSugDismissed(true);
  };

  const minDatePermitida = initial?.checkIn ? initial.checkIn : null;

  // ── EL RADAR DE LISTA NEGRA EN VIVO ──
  const matchBlacklist = allRes.find(r => 
    r.lista_negra && 
    r.guestName && 
    f.guestName &&
    r.guestName.toLowerCase().trim() === f.guestName.toLowerCase().trim() && 
    r.guestNationality === f.guestNationality &&
    r.id !== f.id
  );

  const setTotalGuests = (n) => {
    sv('totalGuests', n);
    const need = n - 1,
      cur = f.companions;
    if (cur.length < need)
      sv('companions', [
        ...cur,
        ...Array(need - cur.length).fill({ name: '', phone: '' }),
      ]);
    else sv('companions', cur.slice(0, need));
    const adds = Math.max(0, n - 2);
    const curA = f.pricing.additionals || [];
    const nextA =
      adds > curA.length
        ? [
            ...curA,
            ...Array(adds - curA.length).fill({
              ratePerNight: 0,
              bonificada: false,
            }),
          ]
        : curA.slice(0, adds);
    sv('pricing', { ...f.pricing, additionals: nextA });
  };

  // El late check-out se suma al total
  const calcTotal = () => calcStayTotal(f.pricing, nights, f.lateCheckout ? Number(f.lateCost) || 0 : 0);

  useEffect(() => {
    // Con varias habitaciones, el total es la suma de las tarjetas
    if (multiOn) {
      if (f.totalAmount !== groupTotal) sv('totalAmount', groupTotal);
    } else if (f.pricing.ratePerNight !== '') {
      const t = calcTotal();
      if (f.totalAmount !== t) {
        sv('totalAmount', t);
      }
    }
  }, [
    f.pricing.ratePerNight,
    f.pricing.discountType,
    f.pricing.discountValue,
    f.pricing.additionals,
    nights,
    f.lateCheckout,
    f.lateCost,
    multiOn,
    groupTotal,
  ]);

  // Late check-out: el apartado se abre con el botón; sin hora elegida no se guarda
  const [lateOpen, setLateOpen] = useState(() => !!initial?.lateCheckout);
  const toggleLate = () => {
    if (lateOpen) {
      setF((x) => ({ ...x, lateCheckout: '', lateCost: '' }));
      setLateOpen(false);
    } else {
      setLateOpen(true);
    }
  };

  // Arma una reserva por habitación (la del titular primero). Con una sola, es una reserva común.
  const buildRooms = () => {
    // "none" = quien reserva no se aloja: ninguna habitación es la del titular
    const tr = titularRoom === 'none' ? '' : titularRoom;
    const ordered = [tr, ...selRooms.filter((x) => x !== tr)].filter(Boolean);
    const totals = ordered.map(roomTotal);
    const paids = splitPay
      ? ordered.map((id) => Number((alloc[id] || {}).paid) || 0)
      : splitPaid(f.paid, totals);
    const gid = ordered.length > 1 ? newGroupId() : null;
    return ordered.map((id, i) => {
      const a = alloc[id] || blankAlloc();
      return {
        ...f,
        room: id,
        totalGuests: a.guests,
        companions: a.companions,
        pricing: roomPricing(id),
        totalAmount: totals[i],
        paid: paids[i],
        grupoId: gid,
        grupoTitular: !!gid && id === tr,
        grupoReservante: gid ? bookerOf(f) : null,
      };
    });
  };

  // ¿Aplicar a todo el grupo o solo a esta habitación? (al editar una del grupo)
  const [scopeAsk, setScopeAsk] = useState(null);

  // Guarda (pasando antes por el aviso de conflicto si hace falta)
  const proceed = (payload, opts) => {
    const go = () => {
      setIsSaving(true);
      onSave(payload, opts);
    };
    if (conflicts.length > 0) {
      setConfModal(() => () => {
        go();
        setConfModal(null);
      });
    } else go();
  };

  // Entrada antes de hoy: solo cuenta en reservas nuevas o si se cambió la fecha de entrada
  // (al editar una estadía en curso, que la entrada sea pasada es lo normal)
  const todayStr = fmt(nowMerida());
  const startsInPast = !!f.checkIn && f.checkIn < todayStr && (!initial?.id || f.checkIn !== initial.checkIn);

  const handleSave = (skipPast = false) => {
    if (isSaving) return;

    // --- 1. VALIDACIÓN DE CAMPOS OBLIGATORIOS ---
    if (!f.status) {
      setValErr('Elegí el estado de la reserva (Por llegar, Hospedado…).');
      return;
    }
    if (!f.source) {
      setValErr('Elegí el canal de la reserva.');
      return;
    }
    if (!f.guestName || f.guestName.trim() === '') {
      setValErr('Falta el nombre del huésped.');
      return;
    }
    if (multiOn) {
      if (!selRooms.length) {
        setValErr('Elegí al menos una habitación.');
        return;
      }
      if (isGroupNew && !titularRoom) {
        setValErr('Elegí en qué habitación duerme el titular (arriba, debajo de las habitaciones).');
        return;
      }
      const sinTarifa = selRooms.filter((id) => {
        const r = roomPricing(id).ratePerNight;
        return r === '' || r === null || r === undefined;
      });
      if (sinTarifa.length) {
        setValErr(`Falta la tarifa/noche de ${sinTarifa.join(', ')}.`);
        return;
      }
      if (!splitPay && !freeStay && (f.paid === '' || f.paid === null)) {
        setValErr('Falta cuánto pagó el grupo (si todavía nada, poné 0).');
        return;
      }
    } else {
      if (!soloDatos && (f.pricing.ratePerNight === '' || f.pricing.ratePerNight === null)) {
        setValErr('Falta la tarifa por noche.');
        return;
      }
      if (!soloDatos && !freeStay && (f.paid === '' || f.paid === null)) {
        setValErr('Falta cuánto pagó (si todavía nada, poné 0).');
        return;
      }
    }
    if (lateOpen && !f.lateCheckout) {
      setValErr('Elegí la hora del late check-out (o desactivalo).');
      return;
    }

    setValErr(''); // Si todo está bien, limpiamos el error
    // --------------------------------------------

    // Entrada antes de hoy (reserva nueva o fecha de entrada cambiada): se puede, pero pide OK
    if (startsInPast && !skipPast) {
      setPastAsk(true);
      return;
    }

    if (multiOn) {
      const rows = buildRooms();
      proceed(rows.length === 1 ? rows[0] : rows);
      return;
    }

    if (inGroup) {
      // Lo que es del grupo pregunta; los datos de la persona de esta habitación se guardan solo acá.
      // Si es la habitación del titular y se corrigieron sus datos, se ofrece pasarlos a las
      // habitaciones que todavía tienen sus datos.
      const shared = changedFields(f, initial, SHARED_FIELDS);
      const person = isTitRoom ? changedFields(f, initial, PERSON_FIELDS) : [];
      const followers = members.filter((m) => m.id !== initial.id && !hasOwnContact(m, members));
      if (shared.length || (person.length && followers.length)) {
        setScopeAsk({ shared, person: followers.length ? person : [], followers });
        return;
      }
    }
    proceed(f);
  };

  // "Todo el grupo": copia los cambios a las otras habitaciones
  const applyToGroup = () => {
    const { shared, person, followers } = scopeAsk;
    const datesChanged = shared.includes('checkIn') || shared.includes('checkOut');
    // Si se corrigen los datos del titular para todo el grupo, también se actualiza "quien reservó"
    const newBooker = person.length ? bookerOf(f) : null;
    const also = members
      .filter((m) => m.id !== initial.id)
      .map((m) => {
        const n = { ...m };
        shared.forEach((k) => (n[k] = f[k]));
        if (followers.some((x) => x.id === m.id)) person.forEach((k) => (n[k] = f[k]));
        if (newBooker) n.grupoReservante = newBooker;
        // Nuevas fechas: se recalcula el total de cada habitación con su propia tarifa
        // (o con la del tarifario, si se tocó "Aplicar tarifario")
        if (datesChanged && requoted && requoted[m.id]) n.pricing = requoted[m.id];
        if (datesChanged) n.totalAmount = calcStayTotal(n.pricing, diffDays(n.checkIn, n.checkOut), lateCostOf(m));
        return n;
      })
      .filter((n) => {
        const m = members.find((x) => x.id === n.id);
        return (
          changedFields(n, m, [...SHARED_FIELDS, ...PERSON_FIELDS, 'totalAmount']).length > 0 ||
          !!newBooker ||
          n.pricing !== m.pricing
        );
      });
    setScopeAsk(null);
    proceed(newBooker ? { ...f, grupoReservante: newBooker } : f, also.length ? { also } : undefined);
  };

  // ── PASO A PASO (como Cotizar) ──
  // Reserva nueva: primero fechas y habitación; al elegirlas aparecen Estado y canal; al tocar el canal,
  // el resto (empezando por las fotos del documento, que completan casi todo). Lo que ya apareció no
  // vuelve a esconderse. Al editar se ve todo de una.
  const isNew = !initial?.id;
  const picking = !f.checkOut; // entrada tocada, falta la salida: lo de abajo queda atenuado
  const roomsDone =
    nights > 0 && (!isHostel || (multiOn ? selRooms.length > 1 && !!titularRoom : !!f.room));
  const target = roomsDone ? (f.status && f.source ? 3 : 2) : 1;
  const [stage, setStage] = useState(() => (isNew ? target : 3));
  const [glowStep, setGlowStep] = useState(''); // paso recién aparecido: entra con resaltado de una vez
  const roomRef = useRef(null);
  const canalRef = useRef(null);
  const guestRef = useRef(null);
  useEffect(() => {
    if (target <= stage) return;
    setStage(target);
    setGlowStep(target === 2 ? 'canal' : 'huesped');
  }, [target]);
  // Deslizamientos: al elegir la habitación, Habitación queda arriba y Estado y canal entero debajo
  // (si no entran las dos, Estado y canal arriba); al tocar el canal, Huésped queda arriba (fotos primero)
  const showCanal = () => {
    const c = canalRef.current;
    const r = roomRef.current;
    if (!c) return;
    let box = c.parentElement;
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    const viewH = box ? box.clientHeight : window.innerHeight;
    const both = r ? c.getBoundingClientRect().bottom - r.getBoundingClientRect().top : Infinity;
    scrollToStep(both + 40 <= viewH ? roomRef : canalRef);
  };
  useEffect(() => {
    if (!glowStep) return;
    const t = glowStep === 'canal' ? setTimeout(showCanal, 250) : setTimeout(() => scrollToStep(guestRef), 350);
    return () => clearTimeout(t);
  }, [glowStep]);

  // Qué paso está resuelto (✓ verde): ayuda a no pasar nada por alto
  const ratesOk = multiOn
    ? selRooms.length > 0 &&
      selRooms.every((id) => {
        const r = roomPricing(id).ratePerNight;
        return r !== '' && r !== null && r !== undefined;
      })
    : f.pricing.ratePerNight !== '' && f.pricing.ratePerNight !== null;
  const paidShown = multiOn && splitPay ? groupPaidSplit : f.paid;
  const saldoPendiente = Math.max(0, Number(f.totalAmount || 0) - Number(paidShown || 0));
  // Sin cargo (noches gratis que cubren todo…): no pide "Pagado" y no dice "Cuenta saldada"
  const freeStay = ratesOk && f.totalAmount !== '' && Number(f.totalAmount) <= 0 && !(Number(paidShown) > 0);
  const paidOk = multiOn && splitPay ? true : (f.paid !== '' && f.paid !== null) || freeStay;
  const cobroDone = ratesOk && paidOk && !(lateOpen && !f.lateCheckout);
  const showPersonas = multiOn ? selRooms.length > 0 : ((!isHostel || selRoom) && maxG > 1) || f.companions.length > 0;
  const personasDone = multiOn || f.companions.every((c) => (c.name || '').trim());
  // Números de los pasos (sin habitación fuera del hostel, sin Personas si no corresponde)
  const nums = {};
  let k = 0;
  (soloDatos ? ['huesped', showPersonas && 'personas'] : ['fechas', isHostel && 'hab', 'canal', 'huesped', showPersonas && 'personas', 'cobro', 'extras'])
    .filter(Boolean)
    .forEach((id) => (nums[id] = ++k));


  return (
    <div>
      <style>{QT_CSS}</style>
      {inGroup && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 10,
            background: GROUP_COLORS.bg,
            border: `1.5px solid ${GROUP_COLORS.border}`,
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 800, color: GROUP_COLORS.txt }}>
            {ic('link', 14)}Grupo de {booker?.name} · {members.map((m) => m.room).filter(Boolean).join(' · ')}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.4 }}>
            {isTitRoom
              ? `Estás editando ${initial.room}, la habitación del titular.`
              : `Estás editando ${initial.room}. Los datos de la persona se guardan solo en esta habitación.`}
            {!titular && ' Quien reservó no se aloja.'}
            {wasPlaceholder && (
              <>
                {' '}
                <b>Todavía tiene los datos de quien reservó:</b> sacá la foto del documento de quien se queda acá
                y se reemplazan solo en {initial.room}.
              </>
            )}
          </div>
        </div>
      )}

      {!soloDatos && (<>
      {/* 1 · Fechas */}
      <Step num={nums.fechas} title="Fechas" done={nights > 0}>
      <RangeCalendar
        checkIn={f.checkIn}
        checkOut={f.checkOut}
        minDate={minDatePermitida}
        onChange={(ci, co) => {
          sv('checkIn', ci);
          sv('checkOut', co);
        }}
      />

      {/* Entrada antes de hoy: aviso suave acá; al guardar se pide confirmar */}
      {startsInPast && (
        <div
          className="pop-in"
          style={{
            marginTop: 10,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--c-92400E)',
            background: 'var(--c-FFFBEB)',
            borderRadius: 'var(--r-field)',
            padding: '9px 12px',
            lineHeight: 1.4,
          }}
        >
          {ic('warning', 14)}
          {pastStartText(f.checkIn).line}
        </div>
      )}

      {/* Grupo con fechas nuevas: aviso si el tarifario da distinto (Ver abre la explicación) */}
      {groupDatesChanged && requoteDiff.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            margin: '-4px 0 12px',
            padding: '8px 10px',
            background: 'var(--c-FFFBEB)',
            border: '1px solid var(--c-FCD34D)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--c-92400E)',
            fontWeight: 600,
          }}
        >
          <span>{ic('calculator', 14)}Con las fechas nuevas, el tarifario tiene otro precio</span>
          <button
            type="button"
            onClick={() => setRequoteOpen(true)}
            style={{
              padding: '4px 12px',
              background: 'var(--card)',
              border: '1.5px solid var(--c-D97706)',
              color: 'var(--c-B45309)',
              borderRadius: 7,
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Ver
          </button>
        </div>
      )}
      {groupDatesChanged && requoteDiff.length === 0 && requotedRooms.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            margin: '-4px 0 12px',
            padding: '8px 10px',
            background: 'var(--acc-soft)',
            border: '1px solid var(--c-BFDBFE)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--acc)',
            fontWeight: 600,
          }}
        >
          <span>
            {ic('tick', 14)}Listo, {listY(requotedRooms)} {requotedRooms.length === 1 ? 'queda' : 'quedan'} con el precio del tarifario. Se
            guarda al tocar Guardar.
          </span>
          <button
            type="button"
            onClick={undoRequote}
            style={{ background: 'none', border: 'none', color: 'var(--mut)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
          >
            Deshacer
          </button>
        </div>
      )}

      {picking && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--acc)', marginTop: -4 }}>Ahora tocá la fecha de salida.</div>
      )}
      </Step>
      </>)}

      <div
        aria-hidden={picking}
        style={{ opacity: picking ? 0.4 : 1, pointerEvents: picking ? 'none' : 'auto', transition: 'opacity .2s' }}
      >
      {/* 2 · Habitación (o varias) */}
      {isHostel && !soloDatos && (
        <Step num={nums.hab} title={multiOn ? 'Habitaciones' : 'Habitación'} done={roomsDone} boxRef={roomRef}>
          {multiOn && (
            <div style={{ fontSize: 12, color: 'var(--mut)', margin: '-6px 0 8px' }}>Tocá todas las del grupo.</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {ROOMS.map((r) => {
              const on = multiOn ? selRooms.includes(r.id) : f.room === r.id;
              // Ocupada en estas fechas (se puede elegir igual: aparece el aviso de conflicto)
              const busy =
                findConflicts(allRes, f.propertyId, r.id, f.checkIn, f.checkOut, initial?.id).length > 0;
              const ring = busy ? 'var(--red)' : 'var(--acc)';
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    if (multiOn) return toggleRoom(r.id);
                    if (on) return;
                    sv('room', r.id);
                    sv('companions', []);
                    sv('totalGuests', 1);
                  }}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 'var(--r-field)',
                    border: 'none',
                    boxShadow: on ? `inset 0 0 0 2px ${ring}` : 'none',
                    background: on ? (busy ? 'var(--c-FEF2F2)' : 'var(--acc-soft)') : 'var(--fill)',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    lineHeight: 1.2,
                    opacity: busy && !on ? 0.6 : 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: on ? (busy ? 'var(--red)' : 'var(--acc)') : 'var(--ink)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                    }}
                  >
                    {on && <Icon name="tick" size={14} strokeWidth={3} />}
                    {r.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: busy ? 700 : 500,
                      color: busy && on ? 'var(--red)' : 'var(--mut)',
                    }}
                  >
                    {busy ? 'Ocupada' : `hasta ${r.maxGuests}`}
                  </div>
                </button>
              );
            })}
          </div>
          {!initial?.id && (
            <button
              type="button"
              onClick={toggleMulti}
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 32,
                padding: '5px 12px',
                borderRadius: 20,
                border: `1.5px ${multi ? 'solid' : 'dashed'} ${multi ? GROUP_COLORS.txt : GROUP_COLORS.border}`,
                background: multi ? GROUP_COLORS.bg : 'var(--card)',
                color: GROUP_COLORS.txt,
                fontFamily: 'inherit',
                fontWeight: multi ? 800 : 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {ic(multi ? 'tick' : 'link', 14)}
              {multi ? 'Varias habitaciones' : 'Reservar varias habitaciones'}
            </button>
          )}

          {/* Paso siguiente al elegir las habitaciones: dónde se aloja el titular */}
          {isGroupNew && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 10,
                background: titularRoom ? GROUP_COLORS.bg : 'var(--c-FFFBEB)',
                border: `1.5px solid ${titularRoom ? GROUP_COLORS.border : 'var(--c-FCD34D)'}`,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 800, color: titularRoom ? GROUP_COLORS.txt : 'var(--c-92400E)', marginBottom: 8 }}>
                ¿En qué habitación duerme el titular (quien reserva)?
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[...selRooms, 'none'].map((id) => {
                  const on = titularRoom === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setTitularRoom(id);
                        setValErr('');
                      }}
                      style={
                        id === 'none'
                          ? {
                              // Caso poco frecuente: botón chico y discreto
                              alignSelf: 'center',
                              minHeight: 26,
                              padding: '2px 9px',
                              borderRadius: 14,
                              border: `1px solid ${on ? GROUP_COLORS.txt : 'var(--handle)'}`,
                              background: on ? GROUP_COLORS.solid : 'var(--card)',
                              color: on ? '#fff' : 'var(--mut)',
                              fontFamily: 'inherit',
                              fontWeight: 600,
                              fontSize: 11,
                              cursor: 'pointer',
                            }
                          : {
                              minWidth: 56,
                              minHeight: 36,
                              padding: '4px 12px',
                              borderRadius: 20,
                              border: `1.5px solid ${on ? GROUP_COLORS.txt : 'var(--line)'}`,
                              background: on ? GROUP_COLORS.solid : 'var(--card)',
                              color: on ? '#fff' : 'var(--ink-2)',
                              fontFamily: 'inherit',
                              fontWeight: 800,
                              fontSize: 13,
                              cursor: 'pointer',
                            }
                      }
                    >
                      {on && id !== 'none' ? ic('star', 13) : ''}
                      {id === 'none' ? (on ? <>{ic('tick', 12)}Ninguna (no se aloja)</> : 'Ninguna (no se aloja)') : id}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 6 }}>
                {titularRoom === 'none'
                  ? 'Quien reserva no se aloja (ej. una empresa): en todas las habitaciones el contacto se carga al llegar.'
                  : 'En las demás, el contacto de cada habitación se carga al llegar.'}
              </div>
            </div>
          )}
          {multiOn && selRooms.length === 1 && (
            <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 8 }}>Elegí al menos una habitación más.</div>
          )}
          {conflicts.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <ConflictWarn conflicts={conflicts} properties={visibleProps} />
            </div>
          )}
        </Step>
      )}
      {!isHostel && <ConflictWarn conflicts={conflicts} properties={visibleProps} />}

      {/* 3 · Estado y canal (aparece al elegir fechas y habitación) */}
      {stage >= 2 && !soloDatos && (
      <Step num={nums.canal} title="Estado y canal" done={!!(f.status && f.source)} glow={glowStep === 'canal'} boxRef={canalRef}>
      <ChipGroup
        label="Estado"
        value={f.status}
        onChange={(v) => sv('status', v)}
        options={['por_llegar', 'hospedado', 'finalizada', 'cancelada'].map((v) => ({
          value: v,
          label: RS[v]?.label || v,
          bg: RS[v]?.bg,
          txt: RS[v]?.txt,
        }))}
      />
      <ChipGroup
        label="Canal"
        value={f.source}
        onChange={(v) => sv('source', v)}
        options={SOURCES.filter((s) => !fixedSource || s.value === fixedSource).map((s) => ({
          value: s.value,
          label: s.short || s.label,
          ...(s.value === 'Booking'
            ? { bg: 'var(--c-DBEAFE)', txt: 'var(--acc)' }
            : s.value === 'Redes'
            ? { bg: 'var(--c-FCE7F3)', txt: 'var(--c-9D174D)' }
            : { bg: 'var(--c-D1FAE5)', txt: 'var(--c-065F46)' }),
        }))}
      />
      {(!f.status || !f.source) && (
        <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: -4, lineHeight: 1.4 }}>
          {!f.status && !f.source
            ? 'Tocá el estado y el canal para seguir.'
            : !f.status
            ? 'Tocá el estado para seguir.'
            : '¿Por dónde llegó la reserva? Tocá el canal para seguir.'}
          {!f.status && f.checkIn === fmt(TODAY) && ' Si ya está en el hostel, elegí Hospedado.'}
        </div>
      )}
      </Step>
      )}
      {/* Esperando estado y canal: lugar vacío debajo para que Habitación pueda quedar arriba y Estado y canal
          entero (en iPhone la barra de Safari tapa el final de la hoja). Se va al aparecer el resto. */}
      {stage === 2 && <div aria-hidden style={{ height: '45vh' }} />}

      {/* 4 en adelante: aparece al tocar el canal */}
      {stage >= 3 && (
      <>
      {/* 4 · Huésped: primero las fotos del documento (el escáner completa casi todo) */}
      <Step num={nums.huesped} title="Huésped" done={!!(f.guestName || '').trim()} glow={glowStep === 'huesped'} boxRef={guestRef}>
      <div ref={docRef} />
      <IneUploader
        f={f}
        onUploadFrente={(url) => sv('url_ine_frente', url)}
        onUploadDorso={(url) => sv('url_ine_dorso', url)}
        onScan={applyScan}
      />

      <Inp
        label="Nombre completo"
        value={f.guestName}
        autoComplete="off"
        onChange={(e) => {
          sv('guestName', e.target.value);
          setNameTyped(true);
          if (!e.target.value.trim()) setSugDismissed(false);
        }}
      />

      {suggestions.length > 0 && (
        <div
          style={{
            marginTop: -4,
            marginBottom: 12,
            background: 'var(--c-F0F9FF)',
            border: '1.5px solid var(--c-BAE6FD)',
            borderRadius: 10,
            padding: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-0369A1)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            ¿Ya se hospedó antes?
          </div>
          {suggestions.map((s) => {
            const c = findCountry(s.data.guestNationality);
            const ph = String(s.data.guestPhone || '').replace(/\D/g, '');
            return (
              <div
                key={s.key}
                style={{
                  background: 'var(--card)',
                  border: `1px solid ${s.blacklisted ? 'var(--c-FECACA)' : 'var(--c-E0F2FE)'}`,
                  borderRadius: 8,
                  padding: '8px 10px',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    {c ? c.flag + ' ' : ''}{s.data.guestName}
                    {s.blacklisted && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--red)', padding: '2px 6px', borderRadius: 10 }}>
                        LISTA NEGRA
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
                    {s.visits} {s.visits === 1 ? 'visita' : 'visitas'} · última {fmtD(s.lastStay)}
                    {s.lastRoom ? ` · ${s.lastRoom}` : ''}
                    {ph ? ` · tel. …${ph.slice(-4)}` : ''}
                    {s.data.guestDoc ? ` · ${s.data.guestDocType || 'Doc'} …${String(s.data.guestDoc).slice(-4)}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => pickGuest(s)}
                  style={{
                    padding: '7px 10px',
                    background: 'var(--c-0284C7)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 7,
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Es esta persona
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setSugDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--c-0369A1)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              padding: '2px 0',
              fontFamily: 'inherit',
            }}
          >
            No, es alguien nuevo
          </button>
        </div>
      )}

      {picked && (
        <div
          style={{
            marginTop: -4,
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: 'var(--c-065F46)',
            background: 'var(--c-ECFDF5)',
            border: '1px solid var(--c-A7F3D0)',
            borderRadius: 8,
            padding: '6px 10px',
          }}
        >
          <span style={{ flex: 1 }}>{ic('tick', 13)}Se cargaron los datos de su estancia anterior. Revisá que sigan vigentes.</span>
          <button
            type="button"
            onClick={undoGuest}
            style={{ background: 'none', border: 'none', color: 'var(--c-047857)', fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            Deshacer
          </button>
        </div>
      )}

      {stayTag && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginTop: -4,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: stayTag.color,
              background: stayTag.bg,
              padding: '3px 10px',
              borderRadius: 20,
            }}
          >
            {ic(stayTag.icon, 12)}{stayTag.label}
          </span>
          {stay.last && lastVisitText(stay) && (
            <span style={{ fontSize: 11.5, color: 'var(--mut)' }}>{lastVisitText(stay)}</span>
          )}
        </div>
      )}

      {/* 🎂 Cumple durante la estadía (fecha de la CURP): solo informa, no frena nada */}
      {birthdayInStay(f) && f.status !== 'cancelada' && (
        <div
          className="pop-in"
          style={{ background: 'var(--c-FDF2F8)', border: '1.5px solid var(--c-FBCFE8)', borderRadius: 10, padding: '9px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--c-9D174D)', fontWeight: 700, lineHeight: 1.4 }}
        >
          {birthdayText(birthdayInStay(f))}
          <span style={{ fontWeight: 500, color: 'var(--c-BE185D)' }}> · un lindo detalle para tener en cuenta</span>
        </div>
      )}

      {/* ── ALERTA DE LISTA NEGRA (VISIBLE SOLO SI HAY COINCIDENCIA) ── */}
      {matchBlacklist && (
        <div style={{ background: 'var(--c-FEF2F2)', border: '1.5px solid var(--c-FECACA)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ color: 'var(--c-991B1B)', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            {ic('warning', 13)}Alerta de Lista Negra
          </div>
          <div style={{ color: 'var(--c-7F1D1D)', fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>
            El sistema detectó un huésped marcado como "No Grato" con el mismo nombre y nacionalidad. Verificá si es la misma persona:
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {matchBlacklist.url_ine_frente && (
              <DocLink url={matchBlacklist.url_ine_frente} style={{ fontSize: 11, background: 'var(--red)', color: '#fff', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontWeight: 700 }}>
                {ic('camera', 13)}ID Frente
              </DocLink>
            )}
            {matchBlacklist.url_ine_dorso && (
              <DocLink url={matchBlacklist.url_ine_dorso} style={{ fontSize: 11, background: 'var(--red)', color: '#fff', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontWeight: 700 }}>
                {ic('camera', 13)}ID Dorso
              </DocLink>
            )}
            {!matchBlacklist.url_ine_frente && !matchBlacklist.url_ine_dorso && (
              <span style={{ fontSize: 11, color: 'var(--c-991B1B)', fontWeight: 600 }}>
                (No hay fotos previas para contrastar).
              </span>
            )}
          </div>
        </div>
      )}

      <CountrySelector
        value={f.guestNationality}
        onChange={(c) => {
          sv('guestNationality', c.code);
          sv('guestPhonePrefix', c.prefix);
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10 }}>
        <Sel
          label="Tipo doc."
          value={f.guestDocType}
          onChange={(e) => sv('guestDocType', e.target.value)}
          options={['INE', 'Pasaporte', 'Otro'].map((v) => ({
            value: v,
            label: v,
          }))}
        />
        <Inp
          label="Número de documento"
          value={f.guestDoc}
          onChange={(e) => sv('guestDoc', e.target.value)}
        />
      </div>
      {/* Fecha de nacimiento (para el 🎂): solo automática. Con CURP sale de ahí; con pasaporte la lee el escáner. */}

      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--mut)',
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Teléfono
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={f.guestPhonePrefix}
            onChange={(e) => sv('guestPhonePrefix', e.target.value)}
            style={{
              width: 72,
              padding: '10px 12px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-field)',
              background: 'var(--card)',
              color: 'var(--ink)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              textAlign: 'center',
              fontWeight: 700,
              boxSizing: 'border-box',
            }}
            placeholder="+52"
          />
          <input
            value={f.guestPhone}
            onChange={(e) => sv('guestPhone', e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-field)',
              background: 'var(--card)',
              color: 'var(--ink)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            placeholder="55 1234 5678"
          />
        </div>
      </div>

      <Inp
        label="Email"
        value={f.guestEmail}
        onChange={(e) => sv('guestEmail', e.target.value)}
      />
      </Step>

      {/* 5 · Personas: cuántos son y acompañantes (en grupo, una tarjeta por habitación) */}
      {showPersonas && (
      <Step num={nums.personas} title={multiOn ? 'Personas por habitación' : 'Personas'} done={personasDone}>
      {multiOn && selRooms.length > 0 && (
        <RoomCards
          rooms={selRooms}
          titularName={f.guestName}
          alloc={alloc}
          setA={setA}
          titularRoom={titularRoom}
          roomTotal={roomTotal}
          splitPay={splitPay}
          isGroup={isGroupNew}
          roomQuote={roomQuote}
          cardMatches={cardMatches}
        />
      )}

      {!multiOn && (!isHostel || selRoom) && maxG > 1 && (
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--mut)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            Total de huéspedes
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Array.from({ length: maxG }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTotalGuests(n)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--r-field)',
                  border: 'none',
                  boxShadow: f.totalGuests === n ? 'inset 0 0 0 2px var(--acc)' : 'none',
                  background: f.totalGuests === n ? 'var(--acc-soft)' : 'var(--fill)',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer',
                  color: f.totalGuests === n ? 'var(--acc)' : 'var(--ink-2)',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {!multiOn && f.companions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--mut)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            Acompañantes
          </label>
          {f.companions.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginBottom: 10,
                padding: 10,
                background: 'var(--inset)',
                borderRadius: 'var(--r-item)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--mut)',
                }}
              >
                Acompañante {i + 1}
              </div>
              <input
                value={c.name}
                onChange={(e) =>
                  sv(
                    'companions',
                    f.companions.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x
                    )
                  )
                }
                placeholder="Nombre"
                style={{
                  width: '100%',
                  minWidth: 0,
                  padding: '10px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-field)',
                  background: 'var(--card)',
                  color: 'var(--ink)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="tel"
                inputMode="tel"
                value={c.phone || ''}
                onChange={(e) =>
                  sv(
                    'companions',
                    f.companions.map((x, j) =>
                      j === i ? { ...x, phone: e.target.value } : x
                    )
                  )
                }
                placeholder="WhatsApp (ej. 55...)"
                style={{
                  width: '100%',
                  minWidth: 0,
                  padding: '10px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-field)',
                  background: 'var(--card)',
                  color: 'var(--ink)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
        </div>
      )}

      </Step>
      )}

      {!soloDatos && (<>
      {/* 6 · Tarifa y pago */}
      <Step num={nums.cobro} title="Tarifa y pago" done={cobroDone}>
      {/* ── LATE CHECK-OUT: botón chico; al activarlo, hora acordada y costo (se suma al total) ── */}
      <div style={{ marginBottom: lateOpen ? 8 : 14 }}>
        <button
          type="button"
          onClick={toggleLate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 36,
            padding: '7px 14px',
            borderRadius: 20,
            // Con color también apagado para que se vea; activado va lleno como la etiqueta
            border: 'none',
            background: lateOpen ? 'var(--c-4F46E5)' : 'var(--c-EEF2FF)',
            color: lateOpen ? '#fff' : 'var(--c-4338CA)',
            fontFamily: 'inherit',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {ic(lateOpen ? 'tick' : 'clock', 14, { marginRight: 0 })}Late check-out{f.lateCheckout ? ` · ${f.lateCheckout}` : ''}
        </button>
      </div>
      {lateOpen && (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 'var(--r-item)',
            background: 'var(--c-F5F7FF)',
            border: `1px solid ${LATE_COLORS.border}`,
          }}
        >
          <LatePicker
            hour={f.lateCheckout}
            cost={f.lateCost}
            onHour={(h) => {
              sv('lateCheckout', h);
              if (valErr.startsWith('Elegí la hora del late')) setValErr('');
            }}
            onCost={(c) => sv('lateCost', c)}
          />
          <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 8 }}>
            {isGroupNew
              ? 'Se aplica a todas las habitaciones; el costo es por habitación y se suma a cada una.'
              : 'El costo se suma solo al Total a cobrar.'}
          </div>
        </div>
      )}

      <div>

        {!canPrice && (
          <div style={{ fontSize: 12.5, color: 'var(--mut)', margin: '0 0 10px', lineHeight: 1.4 }}>
            El precio sale del tarifario. Para un descuento o un precio distinto, consulta con Gian o Marce :)
          </div>
        )}
        <fieldset disabled={!canPrice} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, opacity: canPrice ? 1 : 0.6 }}>
        {/* Con varias habitaciones la tarifa va en cada tarjeta (pueden ser de distinto tipo) */}
        <div style={{ display: 'grid', gridTemplateColumns: multiOn ? '1fr' : '1fr 1fr', gap: 10 }}>
          {!multiOn && <Inp
            label={quoteMatches && quote.varied ? 'Tarifa/noche (promedio) $' : 'Tarifa base/noche $'}
            type="number"
            value={f.pricing.ratePerNight}
            onChange={(e) => {
              setRateAuto(false);
              sv('pricing', {
                ...f.pricing,
                ratePerNight: e.target.value === '' ? '' : Number(e.target.value),
              });
            }}
          />}
          <Inp
            label={multiOn ? 'Etiqueta de tarifa' : 'Etiqueta'}
            value={f.pricing.rateLabel}
            onChange={(e) =>
              sv('pricing', { ...f.pricing, rateLabel: e.target.value })
            }
            placeholder="Tarifa rack"
          />
        </div>
        {!multiOn && quote && (
          <div style={{ marginBottom: 10, marginTop: -4 }}>
            <QuoteInfo q={quote} matches={quoteMatches} onUse={() => setRateAuto(true)} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Sel
            label="Descuento"
            value={f.pricing.discountType}
            onChange={(e) => {
              const v = e.target.value;
              // Noches gratis: arranca con todas las noches de la estadía (sin cargo); si son menos, se cambia el número
              const val = v === 'noche_gratis' ? nights || 1 : f.pricing.discountValue;
              sv('pricing', { ...f.pricing, discountType: v, discountValue: val });
            }}
            options={[
              { value: 'ninguno', label: 'Sin descuento' },
              { value: 'porcentaje', label: '% Porcentaje' },
              { value: 'monto_fijo', label: '$ Monto fijo' },
              { value: 'noche_gratis', label: 'Noches gratis' },
            ]}
          />
          {f.pricing.discountType !== 'ninguno' && (
            <Inp
              label={
                f.pricing.discountType === 'porcentaje'
                  ? '%'
                  : f.pricing.discountType === 'noche_gratis'
                  ? 'Noches'
                  : isGroupNew
                  ? '$ por hab.'
                  : '$'
              }
              type="number"
              value={f.pricing.discountValue}
              onChange={(e) =>
                sv('pricing', { ...f.pricing, discountValue: +e.target.value })
              }
            />
          )}
        </div>
        {f.pricing.discountType !== 'ninguno' && (
          <Inp
            label="Motivo"
            value={f.pricing.discountReason}
            onChange={(e) =>
              sv('pricing', { ...f.pricing, discountReason: e.target.value })
            }
            placeholder="Cliente frecuente..."
          />
        )}

        {addlCount > 0 && (
          <div style={{ marginTop: 8, borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--mut)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Personas adicionales (desde 3ª)
            </div>
            {(f.pricing.additionals || []).slice(0, addlCount).map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px auto',
                  gap: 8,
                  marginBottom: 8,
                  alignItems: 'center',
                  padding: '8px 10px 8px 12px',
                  background: a.bonificada ? 'var(--c-F0FDF4)' : 'var(--inset)',
                  borderRadius: 'var(--r-field)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Persona {i + 1}</div>
                <input
                  type="number"
                  value={a.ratePerNight === 0 ? '' : a.ratePerNight}
                  disabled={a.bonificada}
                  onChange={(e) => {
                    setRateAuto(false);
                    const ads = [...(f.pricing.additionals || [])];
                    ads[i] = { ...ads[i], ratePerNight: +e.target.value };
                    sv('pricing', { ...f.pricing, additionals: ads });
                  }}
                  placeholder="$/noche"
                  style={{
                    padding: '8px 10px',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    background: 'var(--card)',
                    color: 'var(--ink)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                  onClick={() => {
                    const ads = [...(f.pricing.additionals || [])];
                    ads[i] = { ...ads[i], bonificada: !ads[i].bonificada };
                    sv('pricing', { ...f.pricing, additionals: ads });
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: `2px solid ${a.bonificada ? 'var(--c-22C55E)' : 'var(--handle)'}`,
                      background: a.bonificada ? 'var(--c-22C55E)' : 'var(--card)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {a.bonificada && <Icon name="tick" size={12} strokeWidth={3.5} />}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: a.bonificada ? 'var(--c-15803D)' : 'var(--mut)' }}>
                    Bonif.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        </fieldset>
        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '16px 0 14px' }} />

        {/* Sin cargo (noches gratis, total $0): no hay nada que cobrar, solo queda el recuadro violeta */}
        {!freeStay && (() => {
          // Botones rápidos de cobro: 50% (redondeado al peso) y Total (100%).
          // El que coincide con lo pagado queda resaltado.
          const totalNum = Number(f.totalAmount) || 0;
          const half = Math.round(totalNum / 2);
          const paidNum = f.paid === '' ? null : Number(f.paid);
          if (isGroupNew && splitPay) {
            // Cobro por separado: cada habitación tiene su Pagado en su tarjeta
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <ReadBox label="Total del grupo" value={currency(totalNum)} />
                <ReadBox label="Pagado (suma)" value={currency(groupPaidSplit)} />
              </div>
            );
          }
          const quick = [
            { key: 'half', label: '50%', value: f.totalAmount === '' ? '' : half, active: totalNum > 0 && paidNum === half },
            { key: 'full', label: 'Total', value: f.totalAmount, active: totalNum > 0 && paidNum === totalNum },
          ];
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
              {multiOn || !canPrice ? (
                <ReadBox label={isGroupNew ? 'Total del grupo' : 'Total a cobrar'} value={currency(totalNum)} />
              ) : (
              <Inp
                label="Total a cobrar $"
                type="number"
                value={f.totalAmount}
                onChange={(e) =>
                  sv('totalAmount', e.target.value === '' ? '' : Number(e.target.value))
                }
              />
              )}
              <Inp
                label={isGroupNew ? 'Pagado grupo $' : 'Pagado $'}
                type="number"
                value={f.paid}
                onChange={(e) => sv('paid', e.target.value === '' ? '' : Number(e.target.value))}
              />
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--mut)',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  Cobrar
                </label>
                <div style={{ display: 'flex', gap: 4, height: 36 }}>
                  {quick.map((q) => (
                    <button
                      key={q.key}
                      type="button"
                      onClick={() => sv('paid', q.value)}
                      style={{
                        padding: '0 10px',
                        background: q.active ? 'var(--c-10B981)' : 'var(--c-D1FAE5)',
                        color: q.active ? '#fff' : 'var(--c-065F46)',
                        border: '1.5px solid var(--c-10B981)',
                        borderRadius: 8,
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {isGroupNew && !freeStay && (
          <div style={{ margin: '-2px 0 10px' }}>
            <button
              type="button"
              onClick={() => {
                // Al separar, arranca con lo que tocaría a cada habitación del pago del grupo
                if (!splitPay) {
                  const tr = titularRoom === 'none' ? '' : titularRoom;
                  const ordered = [tr, ...selRooms.filter((x) => x !== tr)].filter(Boolean);
                  const parts = splitPaid(f.paid, ordered.map(roomTotal));
                  ordered.forEach((id, i) => setA(id, { paid: f.paid === '' ? '' : parts[i] }));
                } else {
                  sv('paid', groupPaidSplit);
                }
                setSplitPay(!splitPay);
              }}
              style={{
                minHeight: 34,
                padding: '5px 14px',
                borderRadius: 20,
                border: `1.5px solid ${GROUP_COLORS.txt}`,
                background: splitPay ? GROUP_COLORS.solid : 'var(--card)',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 800,
                color: splitPay ? '#fff' : GROUP_COLORS.txt,
                cursor: 'pointer',
              }}
            >
              {ic(splitPay ? 'tick' : 'link', 13)}
              {splitPay ? 'Cobro por separado · volver a junto' : 'Cobrar por separado (cada habitación)'}
            </button>
            {!splitPay && (
              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4 }}>
                Lo pagado se reparte entre las habitaciones según lo que cuesta cada una.
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
          {!freeStay && (
          <div style={{ flex: 1, marginRight: 14 }}>
            <Sel
              label="Forma de pago"
              value={f.paymentMethod || 'efectivo'}
              onChange={(e) => sv('paymentMethod', e.target.value)}
              options={[
                { value: 'efectivo', label: 'Efectivo' },
                { value: 'transferencia', label: 'Transferencia' },
                { value: 'debito', label: 'Débito' },
                { value: 'credito', label: 'Crédito' },
                { value: 'vcc', label: 'Tarjeta virtual (VCC)' },
                { value: 'otro', label: 'Otro' },
              ]}
            />
          </div>
          )}
          <div
            style={{
              flex: freeStay ? 1 : undefined,
              background: freeStay ? 'var(--c-F5F3FF)' : saldoPendiente > 0 ? 'var(--c-FEF2F2)' : 'var(--c-ECFDF5)',
              padding: '10px 14px',
              borderRadius: 'var(--r-item)',
              textAlign: freeStay ? 'left' : 'right',
              minWidth: 130,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: freeStay ? 'var(--c-5B21B6)' : saldoPendiente > 0 ? 'var(--red)' : 'var(--c-059669)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 2,
              }}
            >
              {freeStay ? 'Sin cargo' : saldoPendiente > 0 ? 'Saldo pendiente' : 'Cuenta saldada'}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: freeStay ? 'var(--c-6D28D9)' : saldoPendiente > 0 ? 'var(--c-B45309)' : 'var(--c-059669)',
              }}
            >
              {freeStay
                ? freeStayText(f) === 'Sin cargo'
                  ? currency(0)
                  : <>{ic('gift', 16)}{freeStayText(f)}</>
                : currency(saldoPendiente)}
            </div>
          </div>
        </div>
      </div>

      {/* VCC de Booking: va con el pago */}
      {f.source === 'Booking' && (() => {
        const vccOn = f.paymentMethod === 'vcc';
        const toggleVcc = () => {
          if (vccOn) {
            // Destildar: vuelve a como estaba antes de tildar (o sin pago)
            const prev = vccPrev.current || { paid: '', paymentMethod: 'efectivo' };
            setF((x) => ({ ...x, paid: prev.paid, paymentMethod: prev.paymentMethod }));
            vccPrev.current = null;
          } else {
            vccPrev.current = { paid: f.paid, paymentMethod: f.paymentMethod };
            setF((x) => ({ ...x, paid: x.totalAmount, paymentMethod: 'vcc' }));
            if (multiOn && splitPay) selRooms.forEach((id) => setA(id, { paid: roomTotal(id) }));
          }
        };
        return (
          <div
            style={{
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: vccOn ? 'var(--acc-soft)' : 'var(--inset)',
              borderRadius: 'var(--r-item)',
              boxShadow: vccOn ? 'inset 0 0 0 1.5px var(--acc)' : 'none',
              cursor: 'pointer',
            }}
            onClick={toggleVcc}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: `2px solid ${vccOn ? 'var(--acc)' : 'var(--handle)'}`,
                background: vccOn ? 'var(--acc)' : 'var(--card)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {vccOn && <Icon name="tick" size={14} strokeWidth={3} />}
            </div>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: vccOn ? 'var(--acc)' : 'var(--ink-2)',
                }}
              >
                Tarjeta virtual cobrada (VCC)
              </div>
              <div style={{ fontSize: 11, color: 'var(--mut)' }}>
                {vccOn
                  ? 'Queda pagada con la tarjeta virtual de Booking'
                  : 'Tildalo cuando cobres la tarjeta virtual de Booking'}
              </div>
            </div>
          </div>
        );
      })()}
      </Step>
      </>)}

      {!soloDatos && (<>
      {/* 7 · Factura, notas y PIN (opcional) */}
      <Step num={nums.extras} title="Factura, notas y PIN" note="opcional" done={!!(f.requiresInvoice || (f.notes || '').trim() || f.pin_acceso)}>
      {/* ── FACTURA: botón chico; al pedir factura se despliega Empresa (opcional).
             Con nombre de empresa cuenta como Empresa; vacío (persona física) queda Particular ── */}
      <div style={{ marginBottom: f.requiresInvoice ? 8 : 14 }}>
        <button
          type="button"
          onClick={() => sv('requiresInvoice', !f.requiresInvoice)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 36,
            padding: '7px 14px',
            borderRadius: 20,
            border: 'none',
            boxShadow: f.requiresInvoice ? 'inset 0 0 0 1.5px var(--c-7C3AED)' : 'none',
            background: f.requiresInvoice ? 'var(--c-EDE9FE)' : 'var(--fill)',
            color: f.requiresInvoice ? 'var(--c-5B21B6)' : 'var(--ink-2)',
            fontFamily: 'inherit',
            fontWeight: f.requiresInvoice ? 800 : 600,
            fontSize: 14,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {ic(f.requiresInvoice ? 'tick' : 'invoice', 14, { marginRight: 0 })}Solicita factura
        </button>
      </div>
      {f.requiresInvoice && (
        <Inp
          label="Empresa (opcional)"
          value={f.company || ''}
          autoComplete="off"
          onChange={(e) => sv('company', e.target.value)}
          placeholder="Nombre (vacío si es persona física)"
        />
      )}


      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--mut)',
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          Notas internas
        </label>
        <textarea
            value={f.notes}
            onChange={(e) => sv('notes', e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-field)',
              background: 'var(--card)',
              color: 'var(--ink)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ── SECCIÓN TTLOCK: PIN DE ACCESO ── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <Inp
              label="PIN Puerta (TTLock)"
              value={f.pin_acceso || ''}
              onChange={(e) => sv('pin_acceso', e.target.value)}
              placeholder="Ej. 145892"
              maxLength={9}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              // Extrae los últimos 6 números del celular, o genera uno al azar si no hay
              const digits = (f.guestPhone || '').replace(/\D/g, '');
              const pin = digits.length >= 6 ? digits.slice(-6) : String(Math.floor(100000 + Math.random() * 900000));
              sv('pin_acceso', pin);
            }}
            style={{
              padding: '9px 14px', background: 'var(--acc-soft)', border: 'none', fontFamily: 'inherit',
              color: 'var(--acc)', borderRadius: 'var(--r-field)', fontWeight: 700, fontSize: 14, cursor: 'pointer', height: 40,
              marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}
          >
            <Icon name="wand" size={16} />
            Generar
          </button>
        </div>
      </Step>
      </>)}

        {isGroupNew && (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: GROUP_COLORS.bg,
              border: `1.5px solid ${GROUP_COLORS.border}`,
              fontSize: 13,
              fontWeight: 800,
              color: GROUP_COLORS.txt,
              textAlign: 'center',
            }}
          >
            {ic('link', 14)}{selRooms.length} habitaciones · {groupGuests} huéspedes · Total del grupo {currency(groupTotal)}
          </div>
        )}

        {/* ALERTA DE ERROR SI FALTAN CAMPOS OBLIGATORIOS */}
        {valErr && (
          <div
            style={{
              color: 'var(--red)',
              fontSize: 13.5,
              fontWeight: 700,
              marginBottom: 14,
              textAlign: 'center',
              background: 'var(--c-FEF2F2)',
              padding: '11px 12px',
              borderRadius: 'var(--r-item)',
            }}
          >
            {ic('warning', 15)}{valErr}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onClose}
          disabled={isSaving}
          style={{
            flex: 1,
            padding: '13px',
            background: 'var(--fill)',
            border: 'none',
            borderRadius: 'var(--r-field)',
            fontFamily: 'inherit',
            fontWeight: 600,
            fontSize: 15,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            color: 'var(--ink)',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={() => handleSave()}
          disabled={isSaving}
          style={{
            flex: 2,
            padding: '13px',
            background: conflicts.length > 0 ? 'var(--red)' : 'var(--acc)',
            border: 'none',
            borderRadius: 'var(--r-field)',
            fontFamily: 'inherit',
            fontWeight: 700,
            cursor: isSaving ? 'wait' : 'pointer',
            color: '#fff',
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? (
            'Guardando...'
          ) : (
            <>
              {conflicts.length > 0 ? <Icon name="warning" size={18} /> : null}
              {isGroupNew ? `Guardar ${selRooms.length} habitaciones` : 'Guardar'}
              {conflicts.length > 0 ? ` (${conflicts.length} conflicto)` : ''}
            </>
          )}
        </button>
      </div>
      </>
      )}
      </div>

      <AnimatePresence>{requoteOpen && (
        <Backdrop key="requote"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <PopCard style={{ background: 'var(--card)', borderRadius: 22, maxWidth: 400, width: '100%', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>
            <div style={{ background: 'var(--acc)', padding: '16px 22px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{ic('calculator', 17)}Con las fechas nuevas cambia el precio</div>
              <div style={{ fontSize: 12, color: '#DBEAFE', marginTop: 4 }}>
                {fmtD(f.checkIn)} → {fmtD(f.checkOut)} · {nights === 1 ? '1 noche' : `${nights} noches`}
              </div>
            </div>
            <div style={{ padding: '16px 22px' }}>
              {groupQuotes.map((x) => {
                const pending = requoteDiff.some((d) => d.m.id === x.m.id);
                return (
                  <div
                    key={x.m.id}
                    style={{ padding: '8px 0', borderBottom: '1px solid var(--inset)', fontSize: 12.5, color: 'var(--ink-2)' }}
                  >
                    <div style={{ fontWeight: 800, color: 'var(--ink)' }}>
                      {x.m.room}
                      {x.isMe ? ' (esta)' : ''}
                    </div>
                    {pending ? (
                      <div style={{ lineHeight: 1.5 }}>
                        Cargado: {money(x.nowRate)}/noche ({currency(x.nowTotal)}) →{' '}
                        <b style={{ color: 'var(--acc)' }}>
                          Tarifario: {money(x.q.avg)}/noche ({currency(x.newTotal)})
                        </b>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--mut)' }}>Queda igual</div>
                    )}
                  </div>
                );
              })}
              <p style={{ fontSize: 11.5, color: 'var(--mut)', margin: '12px 0 14px', lineHeight: 1.45 }}>
                Se guarda cuando tocás Guardar. Si después elegís "Solo esta habitación", solo cambia {initial?.room}.
                Lo que ya pagaron no se toca: si el total sube, queda más saldo por cobrar.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={applyRequote}
                  style={{ padding: '11px', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: 'var(--acc)', color: '#fff', border: 'none' }}
                >
                  Aplicar tarifario
                </button>
                <button
                  type="button"
                  onClick={() => setRequoteOpen(false)}
                  style={{ padding: '11px', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: 'var(--card)', color: 'var(--ink-2)', border: '1.5px solid var(--line)' }}
                >
                  Cerrar sin cambios
                </button>
              </div>
            </div>
          </PopCard>
        </Backdrop>
      )}</AnimatePresence>

      <AnimatePresence>{scopeAsk && (() => {
        const others = members.filter((m) => m.id !== initial.id);
        const labels = [...new Set(scopeAsk.shared.map((k) => SHARED_LABELS[k]))];
        const datesChanged = scopeAsk.shared.includes('checkIn') || scopeAsk.shared.includes('checkOut');
        // Si las fechas pasan a todo el grupo, ¿alguna otra habitación queda empalmada?
        const otherConf = datesChanged
          ? others.flatMap((m) =>
              findConflicts(allRes, m.propertyId, m.room, f.checkIn, f.checkOut, m.id).map((c) => ({ room: m.room, c }))
            )
          : [];
        const onlyPerson = !labels.length;
        const btn = {
          padding: '11px',
          borderRadius: 8,
          fontFamily: 'inherit',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
        };
        return (
          <Backdrop key="scopeAsk"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,.5)',
              zIndex: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <PopCard style={{ background: 'var(--card)', borderRadius: 22, maxWidth: 380, width: '100%', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>
              <div style={{ background: GROUP_COLORS.solid, padding: '16px 22px' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{ic('link', 17)}¿Aplicar a todo el grupo?</div>
              </div>
              <div style={{ padding: '18px 22px' }}>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 12px', lineHeight: 1.45 }}>
                  {onlyPerson ? (
                    <>
                      Corregiste datos del titular. ¿Pasarlos también a las habitaciones que todavía tienen sus datos (
                      <b>{scopeAsk.followers.map((m) => m.room).join(', ')}</b>)?
                    </>
                  ) : (
                    <>
                      Cambiaste <b>{labels.join(', ')}</b>
                      {scopeAsk.person.length ? ' y datos del titular' : ''}. ¿Va para todo el grupo (
                      {members.map((m) => m.room).join(', ')}) o solo para {initial.room}?
                    </>
                  )}
                </p>
                {datesChanged && (
                  <p style={{ fontSize: 11.5, color: 'var(--mut)', margin: '0 0 12px' }}>
                    Con las fechas nuevas, cada habitación recalcula su total con su tarifa
                    {requotedRooms.length ? ` (${listY(requotedRooms)} con la del tarifario)` : ''}.
                  </p>
                )}
                {otherConf.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--c-991B1B)', background: 'var(--c-FEF2F2)', border: '1px solid var(--c-FECACA)', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
                    {ic('warning', 13)}Para todo el grupo quedarían empalmadas:{' '}
                    {otherConf.map((x) => `${x.room} con ${x.c.guestName}`).join(' · ')}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    onClick={applyToGroup}
                    style={{ ...btn, background: GROUP_COLORS.solid, color: '#fff', border: 'none' }}
                  >
                    {onlyPerson ? 'Sí, pasarlos' : `Todo el grupo (${members.length} habitaciones)`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScopeAsk(null);
                      proceed(f);
                    }}
                    style={{ ...btn, background: 'var(--card)', color: 'var(--ink-2)', border: '1.5px solid var(--line)' }}
                  >
                    Solo esta habitación ({initial.room})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopeAsk(null)}
                    style={{ ...btn, background: 'none', color: 'var(--mut)', border: 'none', fontWeight: 600 }}
                  >
                    {ic('chevL', 15)}Volver al formulario
                  </button>
                </div>
              </div>
            </PopCard>
          </Backdrop>
        );
      })()}</AnimatePresence>

      <AnimatePresence>{pastAsk && (() => {
        const t = pastStartText(f.checkIn);
        const btn = {
          flex: 1,
          padding: '12px',
          border: 'none',
          borderRadius: 'var(--r-field)',
          fontFamily: 'inherit',
          fontWeight: 700,
          fontSize: 14.5,
          cursor: 'pointer',
        };
        return (
          <Backdrop key="pastAsk"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          >
            <PopCard
              style={{ background: 'var(--card)', borderRadius: 22, maxWidth: 360, width: '100%', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}
            >
              <div style={{ padding: '22px 22px 18px', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--c-FEF3C7)', color: 'var(--c-B45309)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Icon name="cal" size={24} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 'var(--w-title)', color: 'var(--ink)', marginBottom: 6 }}>{t.title}</div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.45, margin: '0 0 6px' }}>{t.body}</p>
                <p style={{ fontSize: 13, color: 'var(--mut)', lineHeight: 1.45, margin: '0 0 18px' }}>{t.hint}</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => setPastAsk(null)} style={{ ...btn, background: 'var(--fill)', color: 'var(--ink)' }}>
                    Corregir fecha
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPastAsk(null);
                      handleSave(true);
                    }}
                    style={{ ...btn, background: 'var(--acc)', color: '#fff' }}
                  >
                    Sí, guardar
                  </button>
                </div>
              </div>
            </PopCard>
          </Backdrop>
        );
      })()}</AnimatePresence>

      <AnimatePresence>{confModal && (
        <Backdrop key="confModal"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <PopCard
            style={{
              background: 'var(--card)',
              borderRadius: 22,
              maxWidth: 380,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                background: 'var(--red)',
                padding: '16px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="warning" size={20} color="#fff" />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Conflicto detectado
              </div>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 16, lineHeight: 1.4 }}>
                Ya hay una reserva actual de <b style={{ color: 'var(--red)' }}>{conflicts.map(c => c.guestName).join(' y ')}</b> en estas fechas.
                <br /><br />
                ¿Deseas forzar el empalme y guardar de todas formas?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'var(--acc-soft)',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: 'var(--acc)',
                  }}
                >
                  {ic('chevL', 15)}Corregir
                </button>
                <button
                  onClick={confModal}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'var(--c-FEF2F2)',
                    border: '1.5px solid var(--c-FECACA)',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: 'var(--red)',
                  }}
                >
                  Forzar Empalme
                </button>
              </div>
            </div>
          </PopCard>
        </Backdrop>
      )}</AnimatePresence>
    </div>
  );
}

// ── OPCIONES EN PÍLDORAS (un solo toque) ──────────────────────────────────────
// La elegida se pinta con su color; si la reserva tiene un valor viejo que no está
// en la lista, se muestra igual para no perderlo.
function ChipGroup({ label, value, onChange, options }) {
  const opts =
    value && !options.some((o) => o.value === value)
      ? [...options, { value, label: value }]
      : options;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--mut)',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
      {/* De a dos por fila: así entran los nombres enteros en el celular ("Por llegar", "Hospedado") */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
        {opts.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              style={{
                minWidth: 0,
                minHeight: 42,
                padding: '8px 8px',
                borderRadius: 'var(--r-field)',
                border: 'none',
                boxShadow: on ? `inset 0 0 0 1.5px ${o.txt || 'var(--acc)'}` : 'none',
                background: on ? o.bg || 'var(--acc-soft)' : 'var(--fill)',
                color: on ? o.txt || 'var(--acc)' : 'var(--ink-2)',
                fontFamily: 'inherit',
                fontWeight: on ? 700 : 600,
                fontSize: 14,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              {on && <Icon name="tick" size={15} strokeWidth={3} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── CAJA SOLO LECTURA (mismo alto que un campo) ──────────────────────────────
function ReadBox({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--mut)',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </label>
      <div
        style={{
          padding: '10px 12px',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-field)',
          fontSize: 13,
          fontWeight: 800,
          background: 'var(--inset)',
          color: 'var(--ink)',
          minHeight: 36,
          boxSizing: 'border-box',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── REPARTO POR HABITACIÓN (reserva de varias habitaciones) ──────────────────
// Una tarjeta por habitación: dónde duerme el titular, huéspedes, acompañantes,
// tarifa (si no se carga, usa la tarifa base) y, si se cobra por separado, su Pagado.
function RoomCards({ rooms, alloc, setA, titularRoom, titularName, roomTotal, splitPay, isGroup, roomQuote, cardMatches }) {
  const inputSt = {
    width: '100%',
    minWidth: 0,
    padding: '10px 12px',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-field)',
    background: 'var(--card)',
    color: 'var(--ink)',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };
  const lbl = { display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--mut)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: GROUP_COLORS.txt, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {isGroup ? <>{ic('link', 12)}Reparto por habitación</> : 'Huéspedes de la habitación'}
      </div>
      {rooms.map((id) => {
        const room = ROOMS.find((r) => r.id === id);
        const max = room ? room.maxGuests : 6;
        const a = alloc[id] || { guests: 1, companions: [], rate: '', extra: '', paid: '', auto: true };
        const isTit = id === titularRoom;
        const q = roomQuote ? roomQuote(id) : null;
        const qMatch = q ? cardMatches(a, q) : false;
        const total = roomTotal(id);
        const setGuests = (n) => {
          const need = n - 1;
          const cur = a.companions || [];
          setA(id, {
            guests: n,
            companions:
              cur.length < need
                ? [...cur, ...Array.from({ length: need - cur.length }, () => ({ name: '', phone: '' }))]
                : cur.slice(0, need),
          });
        };
        const half = Math.round(total / 2);
        const paidNum = a.paid === '' ? null : Number(a.paid);
        return (
          <div
            key={id}
            style={{
              boxShadow: isTit && isGroup ? `inset 0 0 0 1.5px ${GROUP_COLORS.border}` : 'none',
              background: 'var(--inset)',
              borderRadius: 'var(--r-item)',
              padding: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>{id}</span>
                <span style={{ fontSize: 11, color: 'var(--mut)' }}>hasta {max}</span>
              </div>
              {isGroup && isTit && (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: GROUP_COLORS.solid,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {ic('star', 12)}Titular{titularName ? ` · ${titularName}` : ''}
                </span>
              )}
            </div>
            {isGroup && titularRoom && !isTit && (
              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: -4, marginBottom: 8 }}>
                Contacto: se carga al llegar (le sacás la foto al documento).
              </div>
            )}

            <label style={lbl}>Huéspedes</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGuests(n)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--r-field)',
                    border: 'none',
                    boxShadow: a.guests === n ? 'inset 0 0 0 2px var(--acc)' : 'none',
                    background: a.guests === n ? 'var(--acc-soft)' : 'var(--card)',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: 'pointer',
                    color: a.guests === n ? 'var(--acc)' : 'var(--ink-2)',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            {(a.companions || []).map((c, i) => (
              <div
                key={i}
                style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8, padding: 10, background: 'var(--card)', borderRadius: 'var(--r-field)' }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)' }}>Acompañante {i + 1}</div>
                <input
                  value={c.name}
                  placeholder="Nombre"
                  onChange={(e) => setA(id, { companions: a.companions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  style={inputSt}
                />
                <input
                  type="tel"
                  inputMode="tel"
                  value={c.phone || ''}
                  placeholder="WhatsApp (ej. 55...)"
                  onChange={(e) => setA(id, { companions: a.companions.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)) })}
                  style={inputSt}
                />
              </div>
            ))}

            <div style={{ marginTop: 4 }}>
              <label style={lbl}>{qMatch && q.varied ? 'Tarifa/noche (promedio) $' : 'Tarifa/noche $'}</label>
              <input
                type="number"
                inputMode="numeric"
                value={a.rate}
                placeholder="Tarifa de esta habitación"
                onChange={(e) => setA(id, { rate: e.target.value === '' ? '' : Number(e.target.value), auto: false })}
                style={inputSt}
              />
              {q && <QuoteInfo q={q} matches={qMatch} onUse={() => setA(id, { auto: true })} />}
            </div>
            {a.guests > 2 && (
              <div style={{ marginTop: 8 }}>
                <label style={lbl}>Costo x noche por persona extra $</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={a.extra}
                  placeholder="0"
                  onChange={(e) => setA(id, { extra: e.target.value === '' ? '' : Number(e.target.value), auto: false })}
                  style={inputSt}
                />
                <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4 }}>
                  {a.guests - 2 === 1 ? '1 persona extra' : `${a.guests - 2} personas extra`} (la tarifa incluye 2)
                  {Number(a.extra) > 0 ? ` · +${currency(Number(a.extra) * (a.guests - 2))} por noche` : ''}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12.5 }}>
              <span style={{ color: 'var(--mut)', fontWeight: 600 }}>Total {id}</span>
              <span style={{ fontWeight: 900, color: 'var(--ink)' }}>{currency(total)}</span>
            </div>

            {splitPay && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end', marginTop: 8 }}>
                <div>
                  <label style={lbl}>Pagado {id} $</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={a.paid}
                    placeholder="0"
                    onChange={(e) => setA(id, { paid: e.target.value === '' ? '' : Number(e.target.value) })}
                    style={inputSt}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4, height: 38 }}>
                  {[
                    { k: '50%', v: half, on: total > 0 && paidNum === half },
                    { k: 'Total', v: total, on: total > 0 && paidNum === total },
                  ].map((q) => (
                    <button
                      key={q.k}
                      type="button"
                      onClick={() => setA(id, { paid: q.v })}
                      style={{
                        padding: '0 10px',
                        background: q.on ? 'var(--c-10B981)' : 'var(--c-D1FAE5)',
                        color: q.on ? '#fff' : 'var(--c-065F46)',
                        border: '1.5px solid var(--c-10B981)',
                        borderRadius: 8,
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {q.k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
