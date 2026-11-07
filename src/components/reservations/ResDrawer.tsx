/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from 'react';
import { motion, useDragControls } from 'motion/react';
import { FADE, SPRING_SHEET, shouldClose, dragStartOk } from '../ui/Motion';
import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { srcLabel, srcColor, BLOCK_COLORS, ROOMS } from '../../lib/constants';
import { fmtD, fmtDT, diffDays, currency } from '../../lib/dates';
import { waLink, stayInfo, stayBadge } from '../../lib/guests';
import { DocLink } from '../ui/DocLink';
import { LATE_COLORS } from '../ui/LateBadge';
import { LatePicker } from './LatePicker';
import { lateHour, lateCostOf, findConflicts, calcStayTotal } from '../../lib/reservations';
import { groupOf, groupTitular, groupName, hasOwnContact, balanceOf } from '../../lib/groups';
import { GROUP_COLORS } from '../ui/GroupBadge';
import { quoteRoom, pricingMatches } from '../../lib/rates';
import { QuoteInfo } from './QuoteInfo';

// ── DRAWER ────────────────────────────────────────────────────────────────────
export function ResDrawer({
  res,
  onClose,
  onEdit,
  onDelete,
  onToggleBlacklist,
  properties,
  allRes,
  guestDecisions = [],
  isMobile,
  onCheckIn,
  onCheckOut,
  onSetLate,
  onOpenRes,
  onPay,
  onAddRoom,
  onUngroup,
  tarifas = [],
}) {
  const drag = useDragControls(); // gesto para cerrar arrastrando (ver la hoja más abajo)
  // "No grato" es un caso raro: enlace chico al pie y pide confirmar antes de marcar
  const [askBlacklist, setAskBlacklist] = useState(false);
  useEffect(() => setAskBlacklist(false), [res?.id]);
  // Late check-out rápido (se pide mucho durante la estancia)
  const [lateEdit, setLateEdit] = useState(false);
  const [lh, setLh] = useState('');
  const [lc, setLc] = useState('');
  const [lateSaving, setLateSaving] = useState(false);
  useEffect(() => setLateEdit(false), [res?.id]);
  const openLate = () => {
    setLh(lateHour(res));
    setLc(lateHour(res) ? lateCostOf(res) : '');
    setLateEdit(true);
  };
  const saveLate = async (hora, costo) => {
    if (!onSetLate || lateSaving) return;
    setLateSaving(true);
    const ok = await onSetLate(res.id, hora, costo);
    setLateSaving(false);
    if (ok) setLateEdit(false);
  };
  // ── GRUPO: varias habitaciones del mismo titular ──
  const members = groupOf(allRes, res).map((m) => (m.id === res.id ? res : m));
  const inGroup = members.length > 1;
  const titular = inGroup ? groupTitular(members) : null; // null = quien reservó no se aloja
  const isTit = inGroup && titular?.id === res.id;
  const bookerName = inGroup ? groupName(members) : '';
  const isActive = res.status === 'por_llegar' || res.status === 'hospedado';
  const needsContact = inGroup && !hasOwnContact(res, members) && isActive;

  // ── SUMAR HABITACIÓN (al grupo, o arma un grupo desde una reserva común) ──
  const canAddRoom = !!onAddRoom && res.propertyId === 'hostel' && isActive;
  const [addOpen, setAddOpen] = useState(false);
  const [addRoom, setAddRoom] = useState('');
  const [addGuests, setAddGuests] = useState(1);
  const [addRate, setAddRate] = useState('');
  const [addExtra, setAddExtra] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [askUngroup, setAskUngroup] = useState(false);
  useEffect(() => {
    setAddOpen(false);
    setAskUngroup(false);
  }, [res?.id]);
  const addNights = diffDays(res.checkIn, res.checkOut);
  const addMax = (ROOMS.find((r) => r.id === addRoom) || {}).maxGuests || 6;
  const addPricing = {
    ratePerNight: addRate,
    discountType: 'ninguno',
    discountValue: 0,
    rateLabel: '',
    additionals: Array.from({ length: Math.max(0, addGuests - 2) }, () => ({ ratePerNight: Number(addExtra) || 0, bonificada: false })),
  };
  const addTotal = calcStayTotal(addPricing, addNights, 0);
  // Cotizador: tarifa y adicional del tarifario hasta que se escriben a mano
  const [addAuto, setAddAuto] = useState(true);
  const addQuote = addRoom ? quoteRoom(addRoom, res.checkIn, res.checkOut, addGuests, tarifas) : null;
  const addQuoteOk = !!addQuote && !addQuote.missing;
  const addMatches = addQuoteOk && pricingMatches(addPricing, addQuote);
  useEffect(() => {
    if (!addAuto || !addQuoteOk || addMatches) return;
    setAddRate(addQuote.avg);
    if (addQuote.extraGuests) setAddExtra(addQuote.extraAvg);
  }, [addAuto, addQuoteOk, addMatches, addQuote?.avg, addQuote?.extraAvg, addQuote?.extraGuests]);
  const openAdd = () => {
    setAddOpen(true);
    setAddRoom('');
    setAddGuests(1);
    setAddRate('');
    setAddExtra('');
    setAddAuto(true);
    // El panel aparece arriba (debajo del grupo): lo llevamos a la vista
    setTimeout(() => document.getElementById('add-room-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const saveAdd = async () => {
    if (!addRoom || addRate === '' || addSaving) return;
    setAddSaving(true);
    const ok = await onAddRoom(res, { room: addRoom, totalGuests: addGuests, pricing: addPricing, totalAmount: addTotal });
    setAddSaving(false);
    if (ok) setAddOpen(false);
  };
  const groupSaldo = inGroup ? balanceOf(members) : 0;
  const toCheckIn = members.filter((m) => m.status === 'por_llegar');
  const toCheckOut = members.filter((m) => m.status === 'hospedado');
  // Cobro rápido desde el panel: 'room' (esta habitación) o 'group' (saldo de todo el grupo)
  const [payMode, setPayMode] = useState(null);
  const [payTarget, setPayTarget] = useState(0);
  const [payMethod, setPayMethod] = useState('efectivo');
  const [paySaving, setPaySaving] = useState(false);
  useEffect(() => setPayMode(null), [res?.id]);
  const openPay = (mode) => {
    setPayMode(mode);
    setPayTarget(Number(res.totalAmount) || 0);
    setPayMethod(res.paymentMethod && res.paymentMethod !== 'vcc' ? res.paymentMethod : 'efectivo');
  };
  const savePay = async () => {
    if (!onPay || paySaving) return;
    const pagos =
      payMode === 'group'
        ? members
            .filter((m) => (Number(m.totalAmount) || 0) > (Number(m.paid) || 0))
            .map((m) => ({ id: m.id, paid: Number(m.totalAmount) || 0, paymentMethod: payMethod }))
        : [{ id: res.id, paid: payTarget, paymentMethod: payMethod }];
    if (!pagos.length) return setPayMode(null);
    setPaySaving(true);
    const ok = await onPay(pagos);
    setPaySaving(false);
    if (ok) setPayMode(null);
  };

  const prop = properties.find((p) => p.id === res.propertyId);
  const saldo = res.totalAmount - res.paid;
  const nights = diffDays(res.checkIn, res.checkOut);
  // Qué número de estancia es esta reserva para el huésped
  const freq = stayBadge(stayInfo(allRes, res, guestDecisions));
  const pmLabel = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    debito: 'Débito',
    credito: 'Crédito',
    vcc: 'Tarjeta virtual (VCC)',
    otro: 'Otro',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: isMobile ? 'flex-end' : 'flex-end',
        alignItems: isMobile ? 'stretch' : 'flex-start',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        style={{ background: 'rgba(0,0,0,.4)', position: 'absolute', inset: 0 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, pointerEvents: 'none' }}
        transition={FADE}
        onClick={onClose}
      />
      {/* Animación tipo iOS: en el celular sube desde abajo y se cierra deslizando hacia abajo desde la barrita
          o el encabezado de color; en compu entra desde la derecha y se cierra deslizándolo hacia la derecha.
          La X y tocar afuera siguen funcionando. */}
      <motion.div
        initial={isMobile ? { y: '100%' } : { x: '100%' }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={{ ...(isMobile ? { y: '100%' } : { x: '100%' }), transition: { duration: 0.24, ease: [0.32, 0.72, 0, 1] } }}
        transition={SPRING_SHEET}
        drag={isMobile ? 'y' : 'x'}
        dragListener={false}
        dragControls={drag}
        dragConstraints={isMobile ? { top: 0, bottom: 0 } : { left: 0, right: 0 }}
        dragElastic={isMobile ? { top: 0, bottom: 1 } : { left: 0, right: 1 }}
        onDragEnd={(e, info) => shouldClose(info, isMobile ? 'y' : 'x') && onClose()}
        // Con mouse no se arrastra (así se puede seleccionar y copiar el nombre); con el dedo sí
        onPointerDown={(e) => e.pointerType !== 'mouse' && e.target.closest('[data-drag-handle]') && dragStartOk(e) && drag.start(e)}
        style={{
          position: 'relative',
          width: isMobile ? '100vw' : 380,
          background: '#fff',
          height: isMobile ? 'auto' : '100%',
          maxHeight: isMobile ? '92vh' : '100%',
          overflowY: 'auto',
          boxShadow: isMobile
            ? '0 -4px 40px rgba(0,0,0,.15)'
            : '-8px 0 32px rgba(0,0,0,.15)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: isMobile ? '20px 20px 0 0' : '0',
        }}
      >
        {isMobile && (
          <div data-drag-handle style={{ padding: '12px 0 4px', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
          <div
            style={{
              width: 36,
              height: 4,
              background: '#E5E7EB',
              borderRadius: 2,
              margin: '0 auto',
            }}
          />
          </div>
        )}
        <div
          data-drag-handle
          style={{
            touchAction: 'none',
            userSelect: isMobile ? 'none' : undefined,
            WebkitUserSelect: isMobile ? 'none' : undefined,
            padding: '16px 20px',
            borderBottom: '1px solid #F0F0F0',
            // MAGIA: Si está en lista negra usa rojo oscuro, si no, usa el color exacto del estado en el calendario
            background: res.lista_negra 
              ? '#991B1B' 
              : (BLOCK_COLORS[res.status]?.bg || '#3B82F6'), 
            transition: 'background 0.3s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              {/* Línea superior: Solo el nombre del Hostel limpio */}
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.75)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  marginBottom: 6,
                }}
              >
                {prop?.name}
              </div>
              {/* Línea principal: Nombre del Huésped + Placa de Habitación destacada */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  flexWrap: 'wrap' 
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                  {res.guestName}
                </span>
                {res.room && (
                  <span 
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.25)',
                      color: '#fff', 
                      padding: '3px 9px', 
                      borderRadius: 6, 
                      fontSize: 13, 
                      fontWeight: 900,
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      lineHeight: 1
                    }}
                  >
                    {res.room}
                  </span>
                )}
                {/* ── NUEVA ETIQUETA PAX ── */}
                <span 
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: '#fff', 
                    padding: '3px 9px', 
                    borderRadius: 6, 
                    fontSize: 13, 
                    fontWeight: 700,
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    lineHeight: 1
                  }}
                >
                  👥 {res.totalGuests || 1} Pax
                </span>
                {/* ── NUEVA ETIQUETA PIN TTLOCK ── */}
                {res.pin_acceso && (
                  <span 
                    style={{ 
                      background: '#10B981', 
                      color: '#fff', 
                      padding: '3px 9px', 
                      borderRadius: 6, 
                      fontSize: 13, 
                      fontWeight: 900,
                      border: '1px solid #059669',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    🔑 {res.pin_acceso}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,.2)',
                border: 'none',
                borderRadius: 8,
                width: 32,
                height: 32,
                cursor: 'pointer',
                fontSize: 18,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ padding: 20, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 16,
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
           <Badge status={res.status} large />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {res.lista_negra && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#fff',
                    background: '#DC2626',
                    padding: '2px 8px',
                    borderRadius: 20,
                  }}
                >
                  ⚠️ NO GRATO
                </span>
              )}
              {freq && !res.lista_negra && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: freq.color,
                    background: freq.bg,
                    padding: '2px 8px',
                    borderRadius: 20,
                  }}
                >
                  {freq.label}
                </span>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: res.source === 'Booking' ? '#EFF6FF' : '#ECFDF5',
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: `1.5px solid ${res.source === 'Booking' ? '#BFDBFE' : '#A7F3D0'}`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: srcColor(res.source),
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: res.source === 'Booking' ? '#1E40AF' : '#065F46',
                  }}
                >
                  {srcLabel(res.source)}
                </span>
              </div>
            </div>
          </div>
          {inGroup && (
            <div
              data-group-band
              style={{
                background: GROUP_COLORS.bg,
                border: `1.5px solid ${GROUP_COLORS.border}`,
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: GROUP_COLORS.txt, marginBottom: 8 }}>
                🔗 Grupo de {bookerName}
                {!titular && <span style={{ fontWeight: 600, color: '#4B5563' }}> · no se aloja</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {members.map((m) => {
                  const here = m.id === res.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={here}
                      onClick={() => onOpenRes && onOpenRes(m)}
                      title={m.guestName}
                      style={{
                        minHeight: 32,
                        padding: '4px 12px',
                        borderRadius: 8,
                        border: `1.5px solid ${here ? GROUP_COLORS.txt : GROUP_COLORS.border}`,
                        background: here ? GROUP_COLORS.txt : '#fff',
                        color: here ? '#fff' : GROUP_COLORS.txt,
                        fontFamily: 'inherit',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: here ? 'default' : 'pointer',
                      }}
                    >
                      {m.grupoTitular ? '★ ' : ''}
                      {m.room}
                    </button>
                  );
                })}
              </div>
              {needsContact && (
                <button
                  type="button"
                  onClick={() => onEdit(res, { focusDoc: true })}
                  style={{
                    ...mainBtn,
                    width: '100%',
                    marginTop: 10,
                    minHeight: 40,
                    fontSize: 13,
                    background: '#fff',
                    border: `1.5px solid ${GROUP_COLORS.txt}`,
                    color: GROUP_COLORS.txt,
                  }}
                >
                  📷 Cargar contacto de esta habitación
                </button>
              )}
              {canAddRoom && !addOpen && (
                <button
                  type="button"
                  onClick={openAdd}
                  style={{
                    ...mainBtn,
                    width: '100%',
                    marginTop: 8,
                    minHeight: 38,
                    fontSize: 13,
                    background: 'transparent',
                    border: `1.5px dashed ${GROUP_COLORS.txt}`,
                    color: GROUP_COLORS.txt,
                  }}
                >
                  ➕ Sumar habitación al grupo
                </button>
              )}
            </div>
          )}

          {addOpen && (() => {
            const lbl = { display: 'block', fontSize: 10.5, fontWeight: 700, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 };
            const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' };
            const mine = new Set(members.length ? members.map((m) => m.room) : [res.room]);
            return (
              <div id="add-room-panel" className="pop-in" style={{ background: '#fff', border: `1.5px solid ${GROUP_COLORS.border}`, borderRadius: 12, padding: 12, marginBottom: 12, scrollMarginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: GROUP_COLORS.txt, marginBottom: 4 }}>
                  ➕ Sumar habitación {inGroup ? 'al grupo' : `a la reserva de ${res.guestName}`}
                </div>
                <div style={{ fontSize: 11.5, color: '#6B7280', marginBottom: 10 }}>
                  Mismas fechas: {fmtD(res.checkIn)} → {fmtD(res.checkOut)} ({addNights} {addNights === 1 ? 'noche' : 'noches'}).
                  {!inGroup && ' Se arma un grupo con esta reserva.'} El contacto de la nueva habitación se carga al llegar.
                </div>
                <label style={lbl}>Habitación</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                  {ROOMS.map((r) => {
                    const taken = mine.has(r.id);
                    const busy = !taken && findConflicts(allRes, 'hostel', r.id, res.checkIn, res.checkOut, null).length > 0;
                    const off = taken || busy;
                    const on = addRoom === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={off}
                        onClick={() => {
                          setAddRoom(r.id);
                          setAddGuests(1);
                        }}
                        style={{
                          padding: '8px 4px',
                          minHeight: 44,
                          borderRadius: 8,
                          border: `1.5px solid ${on ? '#3B82F6' : '#E5E7EB'}`,
                          background: off ? '#F3F4F6' : on ? '#EFF6FF' : '#fff',
                          color: off ? '#9CA3AF' : on ? '#1E40AF' : '#111',
                          fontFamily: 'inherit',
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: off ? 'default' : 'pointer',
                        }}
                      >
                        {on ? '✓ ' : ''}
                        {r.id}
                        <div style={{ fontSize: 10, fontWeight: 600 }}>
                          {taken ? 'En el grupo' : busy ? 'Ocupada' : `hasta ${r.maxGuests}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {addRoom && (
                  <>
                    <label style={lbl}>Huéspedes</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {Array.from({ length: addMax }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAddGuests(n)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            border: `2px solid ${addGuests === n ? '#3B82F6' : '#E5E7EB'}`,
                            background: addGuests === n ? '#EFF6FF' : '#fff',
                            fontFamily: 'inherit',
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: 'pointer',
                            color: addGuests === n ? '#1E40AF' : '#6B7280',
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <label style={lbl}>{addMatches && addQuote.varied ? 'Tarifa/noche (promedio) $' : 'Tarifa/noche $'}</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={addRate}
                      placeholder="Tarifa de esta habitación"
                      onChange={(e) => {
                        setAddAuto(false);
                        setAddRate(e.target.value === '' ? '' : Number(e.target.value));
                      }}
                      style={{ ...inp, marginBottom: 8 }}
                    />
                    {addQuote && (
                      <div style={{ marginTop: -4, marginBottom: 8 }}>
                        <QuoteInfo q={addQuote} matches={addMatches} onUse={() => setAddAuto(true)} />
                      </div>
                    )}
                    {addGuests > 2 && (
                      <>
                        <label style={lbl}>Costo x noche por persona extra $</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={addExtra}
                          placeholder="0"
                          onChange={(e) => {
                            setAddAuto(false);
                            setAddExtra(e.target.value === '' ? '' : Number(e.target.value));
                          }}
                          style={inp}
                        />
                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4, marginBottom: 8 }}>
                          {addGuests - 2 === 1 ? '1 persona extra' : `${addGuests - 2} personas extra`} (la tarifa incluye 2)
                        </div>
                      </>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, margin: '6px 0 10px' }}>
                      <span style={{ color: '#6B7280', fontWeight: 600 }}>Total {addRoom}</span>
                      <b>{currency(addTotal)}</b>
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>
                      Queda por llegar y sin pagar. Acompañantes, descuento o late check-out los cargás después con Editar.
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={saveAdd}
                    disabled={!addRoom || addRate === '' || addSaving}
                    style={{
                      ...mainBtn,
                      flex: 2,
                      minHeight: 42,
                      fontSize: 13,
                      background: addRoom && addRate !== '' ? GROUP_COLORS.txt : '#99D5CC',
                      color: '#fff',
                    }}
                  >
                    {addSaving ? 'Guardando…' : addRoom ? `Sumar ${addRoom}` : 'Elegí una habitación'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    style={{ ...mainBtn, flex: 1, minHeight: 42, fontSize: 13, background: '#fff', border: '1px solid #E5E7EB', color: '#374151' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          })()}

          {/* FILA SUPERIOR: Tiempos de la estadía (3 columnas en línea) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              marginBottom: 8,
            }}
          >
            {[
              ['Check-in', fmtD(res.checkIn)],
              ['Check-out', fmtD(res.checkOut)],
              ['Duración', nights + ' noche' + (nights !== 1 ? 's' : '')],
            ].map(([l, v]) => (
              <div
                key={l}
                style={{
                  background: '#F9FAFB',
                  borderRadius: 10,
                  padding: '10px 4px',
                  border: '1px solid #F0F0F0',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 9.5,
                    color: '#9CA3AF',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: 2,
                  }}
                >
                  {l}
                </div>
                <div style={{ fontWeight: 700, color: '#111', fontSize: 12.5 }}>
                  {v}
                </div>
                {l === 'Check-out' && lateHour(res) && (
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: LATE_COLORS.txt, marginTop: 2 }}>
                    🕐 Late {lateHour(res)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* LATE CHECK-OUT: ver, agregar o cambiar sin abrir el formulario */}
          {!lateEdit && lateHour(res) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                background: LATE_COLORS.bg,
                border: `1px solid ${LATE_COLORS.border}`,
                borderRadius: 10,
                padding: '8px 12px',
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 800, color: LATE_COLORS.txt }}>
                🕐 Late check-out {lateHour(res)}
                <span style={{ fontWeight: 600 }}>
                  {' · '}
                  {lateCostOf(res) > 0 ? currency(lateCostOf(res)) : 'Cortesía'}
                </span>
              </span>
              {onSetLate && (
                <button type="button" onClick={openLate} style={{ ...blLink(LATE_COLORS.txt), fontWeight: 800 }}>
                  Cambiar
                </button>
              )}
            </div>
          )}
          {!lateEdit && !lateHour(res) && onSetLate && (res.status === 'por_llegar' || res.status === 'hospedado') && (
            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={openLate}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 32,
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: '1.5px dashed #A5B4FC',
                  background: '#fff',
                  color: LATE_COLORS.txt,
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                🕐 Agregar late check-out
              </button>
            </div>
          )}
          {lateEdit && (
            <div
              className="pop-in"
              style={{
                background: '#F5F7FF',
                border: `1px solid ${LATE_COLORS.border}`,
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: LATE_COLORS.txt, marginBottom: 10 }}>
                🕐 Late check-out
              </div>
              <LatePicker hour={lh} cost={lc} onHour={setLh} onCost={setLc} />
              <div style={{ fontSize: 11, color: '#6B7280', margin: '8px 0 10px' }}>
                El costo se suma solo al total de la reserva.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  disabled={!lh || lateSaving}
                  onClick={() => saveLate(lh, lc)}
                  style={{
                    ...mainBtn,
                    flex: 2,
                    minHeight: 40,
                    fontSize: 13,
                    background: lh ? LATE_COLORS.txt : '#C7D2FE',
                    color: '#fff',
                    cursor: lh ? 'pointer' : 'default',
                  }}
                >
                  {lateSaving ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setLateEdit(false)}
                  style={{
                    ...mainBtn,
                    flex: 1,
                    minHeight: 40,
                    fontSize: 13,
                    background: '#fff',
                    border: '1px solid #E5E7EB',
                    color: '#374151',
                  }}
                >
                  Cancelar
                </button>
              </div>
              {lateHour(res) && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <button type="button" onClick={() => saveLate('', 0)} style={blLink('#DC2626')}>
                    Quitar late check-out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FILA INFERIOR: Bloque masivo del Total General */}
          <div
            style={{
              background: '#F9FAFB',
              borderRadius: 10,
              padding: '12px 14px',
              border: '1px solid #F0F0F0',
              marginBottom: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Total Reserva
            </div>
            <div style={{ fontWeight: 800, color: '#111', fontSize: 16 }}>
              {currency(res.totalAmount)}
            </div>
          </div>
          {saldo <= 0 ? (
            // Pagado del todo: se lee primero "pagado", el saldo queda chiquito abajo
            <div
              style={{
                background: '#D1FAE5',
                border: '1.5px solid #A7F3D0',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#10B981',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                ✓
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#065F46', fontWeight: 800, textTransform: 'uppercase' }}>
                  Pagado completo
                </div>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#047857' }}>{currency(res.paid)}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                  {saldo < 0 ? `Pagó de más ${currency(-saldo)}` : 'Saldo $0'}
                  {res.paymentMethod ? ` · ${pmLabel[res.paymentMethod] || res.paymentMethod}` : ''}
                </div>
              </div>
            </div>
          ) : (
          <div
            style={{
              background: '#FEF3C7',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: '#92400E',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {inGroup ? 'Saldo de esta habitación' : 'Saldo pendiente'}
              </div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 20,
                  color: '#B45309',
                }}
              >
                {currency(saldo)}
              </div>
              {inGroup && onPay && payMode !== 'room' && (
                <button
                  type="button"
                  onClick={() => openPay('room')}
                  style={{ ...mainBtn, minHeight: 32, padding: '4px 12px', fontSize: 12, marginTop: 6, background: '#10B981', color: '#fff' }}
                >
                  Cobrar {res.room}
                </button>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>
                Pagado
              </div>
              <div style={{ fontWeight: 700 }}>{currency(res.paid)}</div>
              {res.paymentMethod && (
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  {pmLabel[res.paymentMethod] || res.paymentMethod}
                </div>
              )}
            </div>
          </div>
          )}
          {payMode && (() => {
            const total = Number(res.totalAmount) || 0;
            const paid = Number(res.paid) || 0;
            const half = Math.round(total / 2);
            const isGroupPay = payMode === 'group';
            const owing = members.filter((m) => (Number(m.totalAmount) || 0) > (Number(m.paid) || 0));
            const cobra = isGroupPay ? groupSaldo : Math.max(0, payTarget - paid);
            return (
              <div style={{ background: '#F0FDF4', border: '1.5px solid #A7F3D0', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#065F46', marginBottom: 8 }}>
                  {isGroupPay
                    ? `Cobrar saldo del grupo (${owing.map((m) => m.room).join(', ')})`
                    : `Cobrar ${res.room}`}
                </div>
                {!isGroupPay && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {[
                      ...(paid < half ? [{ k: 'Hasta 50%', v: half }] : []),
                      { k: 'Total', v: total },
                    ].map((q) => (
                      <button
                        key={q.k}
                        type="button"
                        onClick={() => setPayTarget(q.v)}
                        style={{
                          ...mainBtn,
                          flex: 1,
                          minHeight: 36,
                          fontSize: 12,
                          background: payTarget === q.v ? '#10B981' : '#D1FAE5',
                          color: payTarget === q.v ? '#fff' : '#065F46',
                          border: '1.5px solid #10B981',
                        }}
                      >
                        {q.k}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>
                    Cobra ahora <b>{currency(cobra)}</b>
                  </span>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    style={{ padding: '7px 8px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, background: '#fff' }}
                  >
                    {Object.entries(pmLabel)
                      .filter(([k]) => k !== 'vcc')
                      .map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={savePay}
                    disabled={paySaving || cobra <= 0}
                    style={{ ...mainBtn, flex: 2, minHeight: 40, fontSize: 13, background: cobra > 0 ? '#10B981' : '#A7F3D0', color: '#fff' }}
                  >
                    {paySaving ? 'Guardando…' : 'Guardar cobro'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMode(null)}
                    style={{ ...mainBtn, flex: 1, minHeight: 40, fontSize: 13, background: '#fff', border: '1px solid #E5E7EB', color: '#374151' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          })()}

          {inGroup && payMode !== 'group' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: 12,
                color: GROUP_COLORS.txt,
                padding: '6px 4px 10px',
                marginBottom: 6,
              }}
            >
              {groupSaldo > 0 ? (
                <span style={{ fontWeight: 700 }}>
                  🔗 Saldo del grupo: <b style={{ whiteSpace: 'nowrap' }}>{currency(groupSaldo)}</b>
                </span>
              ) : (
                <span style={{ fontWeight: 800, color: '#047857' }}>🔗 Grupo pagado completo ✓</span>
              )}
              {groupSaldo > 0 && onPay && (
                <button
                  type="button"
                  onClick={() => openPay('group')}
                  style={{ ...mainBtn, minHeight: 34, padding: '4px 14px', fontSize: 12, background: GROUP_COLORS.txt, color: '#fff', whiteSpace: 'nowrap' }}
                >
                  🔗 Cobrar saldo del grupo
                </button>
              )}
            </div>
          )}

          {(res.requiresInvoice || res.notes) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderBottom: '1px solid #F0F0F0', borderTop: '1px solid #F0F0F0', marginBottom: 14, background: '#FAFAFA' }}>
              {res.requiresInvoice && (
                <span style={{ fontSize: 12, color: '#7C3AED', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="invoice" size={14} /> Solicita factura fiscal
                </span>
              )}
              {res.notes && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', marginTop: 4 }}>
                  {/* Título en mayúsculas y pequeño como indicador */}
                  <span style={{ fontSize: 10, color: '#B45309', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    <Icon name="edit" size={13} /> Notas Internas
                  </span>
                  {/* Bloque de texto más grande, destacado y que respeta saltos de línea */}
                  <div style={{ fontSize: 13.5, color: '#78350F', fontWeight: 600, background: '#FEF3C7', padding: '8px 12px', borderRadius: 8, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                    {res.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {(res.url_ine_frente || res.url_ine_dorso) && (
            <div style={{ background: '#F0F9FF', borderRadius: 10, padding: '12px 16px', marginBottom: 14, border: '1px solid #BAE6FD' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', marginBottom: 8 }}>
                Documentos adjuntos
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {res.url_ine_frente && (
                  <DocLink url={res.url_ine_frente} style={{ flex: 1, textDecoration: 'none' }}>
                    <div style={{ background: '#0284C7', color: '#fff', padding: '8px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
                      📷 Ver Frente
                    </div>
                  </DocLink>
                )}
                {res.url_ine_dorso && (
                  <DocLink url={res.url_ine_dorso} style={{ flex: 1, textDecoration: 'none' }}>
                    <div style={{ background: '#0284C7', color: '#fff', padding: '8px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
                      📷 Ver Dorso
                    </div>
                  </DocLink>
                )}
              </div>
            </div>
          )}
          <div
            style={{
              background: '#F9FAFB',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 14,
              border: '1px solid #F0F0F0',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Datos del huésped
              </div>
            </div>
            {[
              ['Documento', (res.guestDocType || 'Doc') + ': ' + res.guestDoc],
              ['Teléfono', res.guestPhone],
              ['Email', res.guestEmail],
            ].map(
              ([l, v]) =>
                v && (
                  <div
                    key={l}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: '1px solid #F0F0F0',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: '#9CA3AF' }}>{l}</span>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span style={{ fontWeight: 600, color: '#374151' }}>
                        {v}
                      </span>
                      {l === 'Teléfono' && v && (
                        <a
                          href={waLink(
                            v,
                            res.guestPhonePrefix,
                            res.guestNationality
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: '#22C55E',
                            color: '#fff',
                            textDecoration: 'none',
                          }}
                          title="WhatsApp"
                        >
                          <Icon name="whatsapp" size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                )
            )}
          </div>
          {res.companions && res.companions.length > 0 && (
            <div
              style={{
                background: '#F9FAFB',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 14,
                border: '1px solid #F0F0F0',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Acompañantes ({res.companions.length})
              </div>
              {res.companions.map((c, i) => {
                // Preparamos el mensaje de WhatsApp para el acompañante
                const mensajeAcomp = encodeURIComponent(`¡Hola ${c.name ? c.name.split(' ')[0] : ''}! Bienvenido a Itzé Hostel. 🌴 Tu grupo está en la habitación ${res.room || 'asignada'}. El código de acceso a la puerta principal es *${res.pin_acceso || '---'}*. ¡Te esperamos!`);
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid #F0F0F0',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#374151' }}>
                      {c.name || `Acompañante ${i + 1}`}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {c.phone && (
                        <a
                          href={`${waLink(c.phone, res.guestPhonePrefix, res.guestNationality)}?text=${mensajeAcomp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#ECFDF5',
                            color: '#059669',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: 11,
                            border: '1px solid #A7F3D0'
                          }}
                          title="WhatsApp Acompañante"
                        >
                          <Icon name="whatsapp" size={12} /> {c.phone}
                        </a>
                      )}
                      {c.doc && (
                        <span style={{ color: '#9CA3AF', fontSize: 12 }}>{c.doc}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {(res.checkInAt || res.checkOutAt) && (
            <div
              style={{
                background: '#F8FAFC',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 11,
                color: '#6B7280',
                marginBottom: 14,
              }}
            >
              {res.checkInAt && (
                <div>
                  ⏱ <b>CI real:</b> {fmtDT(res.checkInAt)}
                </div>
              )}
              {res.checkOutAt && (
                <div>
                  ⏱ <b>CO real:</b> {fmtDT(res.checkOutAt)}
                </div>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #F0F0F0',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: '#FAFAFA',
          }}
        >
          {/* Acción principal (Check-in/out, más ancha) y Editar en la misma fila */}
          <div style={{ display: 'flex', gap: 8 }}>
            {res.status === 'por_llegar' && (
              <button
                onClick={() => onCheckIn(res)}
                style={{ ...mainBtn, flex: 2, background: '#10B981', color: '#fff' }}
              >
                <Icon name="checkIn" size={18} /> Hacer Check-in
              </button>
            )}
            {res.status === 'hospedado' && (
              <button
                onClick={() => onCheckOut(res)}
                style={{ ...mainBtn, flex: 2, background: '#F59E0B', color: '#fff' }}
              >
                <Icon name="checkOut" size={18} /> Hacer Check-out
              </button>
            )}
            <button
              onClick={() => onEdit(res)}
              style={{
                ...mainBtn,
                flex: 1,
                background: '#fff',
                border: '1px solid #E5E7EB',
                color: '#374151',
              }}
            >
              <Icon name="edit" size={16} /> Editar
            </button>
          </div>

          {/* Check-in / Check-out de todo el grupo de un toque */}
          {inGroup && res.status === 'por_llegar' && toCheckIn.length > 1 && (
            <button
              type="button"
              onClick={() => onCheckIn(toCheckIn)}
              style={{ ...mainBtn, minHeight: 38, fontSize: 13, background: '#fff', border: '1.5px solid #10B981', color: '#047857' }}
            >
              🔗 Hacer check-in de todo el grupo ({toCheckIn.length})
            </button>
          )}
          {inGroup && res.status === 'hospedado' && toCheckOut.length > 1 && (
            <button
              type="button"
              onClick={() => onCheckOut(toCheckOut)}
              style={{ ...mainBtn, minHeight: 38, fontSize: 13, background: '#fff', border: '1.5px solid #F59E0B', color: '#B45309' }}
            >
              🔗 Hacer check-out de todo el grupo ({toCheckOut.length})
            </button>
          )}

          {/* Reserva común del hostel: armar un grupo sumando otra habitación */}
          {!inGroup && canAddRoom && !addOpen && (
            <button
              type="button"
              onClick={openAdd}
              style={{
                ...mainBtn,
                minHeight: 38,
                fontSize: 13,
                background: '#fff',
                border: `1.5px dashed ${GROUP_COLORS.txt}`,
                color: GROUP_COLORS.txt,
              }}
            >
              ➕ Sumar otra habitación (grupo)
            </button>
          )}

          {/* Acciones poco frecuentes, discretas al pie: Eliminar (pide confirmar en ventana) y No grato */}
          {askUngroup ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 11, color: '#6B7280', marginTop: 4, flexWrap: 'wrap' }}>
              <span>
                ¿Separar {res.room} del grupo?{members.length === 2 ? ' (el grupo deja de existir)' : ''}
              </span>
              <button
                type="button"
                onClick={async () => {
                  setAskUngroup(false);
                  await onUngroup(res);
                }}
                style={{ ...blLink(GROUP_COLORS.txt), fontWeight: 800, padding: 0 }}
              >
                Sí, separar
              </button>
              <button type="button" onClick={() => setAskUngroup(false)} style={{ ...blLink('#6B7280'), padding: 0 }}>
                Cancelar
              </button>
            </div>
          ) : askBlacklist ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 11, color: '#6B7280', marginTop: 4 }}>
              <span>¿Marcar como no grato?</span>
              <button
                type="button"
                onClick={() => {
                  setAskBlacklist(false);
                  onToggleBlacklist(res.id, false);
                }}
                style={{ ...blLink('#DC2626'), fontWeight: 800, padding: 0 }}
              >
                Sí, marcar
              </button>
              <button
                type="button"
                onClick={() => setAskBlacklist(false)}
                style={{ ...blLink('#6B7280'), padding: 0 }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => onDelete(res.id)} style={blLink('#9CA3AF')}>
                Eliminar reserva
              </button>
              <span style={{ color: '#D1D5DB', fontSize: 11 }}>·</span>
              {inGroup && onUngroup && (
                <>
                  <button type="button" onClick={() => setAskUngroup(true)} style={blLink('#9CA3AF')}>
                    Separar del grupo
                  </button>
                  <span style={{ color: '#D1D5DB', fontSize: 11 }}>·</span>
                </>
              )}
              {res.lista_negra ? (
                <button
                  type="button"
                  onClick={() => onToggleBlacklist(res.id, true)}
                  style={blLink('#DC2626')}
                >
                  Quitar de lista negra
                </button>
              ) : (
                <button type="button" onClick={() => setAskBlacklist(true)} style={blLink('#9CA3AF')}>
                  Marcar como no grato
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

const mainBtn = {
  minHeight: 44,
  padding: '10px 12px',
  border: 'none',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  whiteSpace: 'nowrap',
};

const blLink = (color) => ({
  background: 'none',
  border: 'none',
  padding: '2px 0',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 600,
  color,
  cursor: 'pointer',
  textDecoration: 'underline',
  alignSelf: 'center',
});
