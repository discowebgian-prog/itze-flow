/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useRef, useMemo } from 'react';
import { IneUploader } from './IneUploader';
import { ConflictWarn } from '../ui/ConflictWarn';
import { CountrySelector } from '../ui/CountrySelector';
import { Icon } from '../ui/Icon';
import { Inp } from '../ui/Inp';
import { RangeCalendar } from '../ui/RangeCalendar';
import { Sel } from '../ui/Sel';
import { ROOMS, SOURCES, RS, COUNTRIES, findCountry } from '../../lib/constants';
import { TODAY, fmt, fmtD, addDays, diffDays, currency } from '../../lib/dates';
import { findConflicts } from '../../lib/reservations';
import { stayInfo, stayBadge, suggestGuests } from '../../lib/guests';

export function ResForm({
  initial,
  visibleProps,
  onSave,
  onClose,
  prefillProp,
  prefillDate,
  allRes = [],
  guestDecisions = [],
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
    checkIn: prefillDate || fmt(TODAY),
    checkOut: fmt(addDays(TODAY, 1)),
    status: 'por_llegar',
    totalAmount: '',
    paid: '',
    paymentMethod: 'efectivo',
    source: 'Directo-Puerta',
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
  const applyScan = (scan) => {
    const name = (scan.fullName || [scan.firstName, scan.lastName].filter(Boolean).join(' ')).trim();
    const country = findCountry(scan.nationality);
    setF((x) => ({
      ...x,
      guestName: name || x.guestName,
      guestDoc: scan.docNumber || x.guestDoc,
      guestDocType: ['INE', 'Pasaporte', 'Otro'].includes(scan.docType) ? scan.docType : x.guestDocType,
      guestNationality: country ? country.code : x.guestNationality,
      guestPhonePrefix: country && !x.guestPhone ? country.prefix : x.guestPhonePrefix,
    }));
  };
  const nights = f.checkIn && f.checkOut ? diffDays(f.checkIn, f.checkOut) : 0;
  const isHostel = f.propertyId === 'hostel';
  const selRoom = isHostel ? ROOMS.find((r) => r.id === f.room) : null;
  const maxG = selRoom ? selRoom.maxGuests : isHostel ? 1 : 6;
  const addlCount = Math.max(0, f.totalGuests - 2);
  const conflicts = findConflicts(
    allRes,
    f.propertyId,
    f.room || '',
    f.checkIn,
    f.checkOut,
    initial?.id
  );
  // Cómo estaba el pago antes de tildar "VCC cobrada", para poder destildar
  const vccPrev = useRef(null);
  const [confModal, setConfModal] = useState(null);
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
  const GUEST_FIELDS = ['guestName', 'guestDoc', 'guestDocType', 'guestNationality', 'guestPhonePrefix', 'guestPhone', 'guestEmail'];
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

  const calcTotal = () => {
    if (!nights) return 0;
    let b = Number(f.pricing.ratePerNight) * nights;
    if (f.pricing.discountType === 'porcentaje')
      b -= b * (Number(f.pricing.discountValue) / 100);
    else if (f.pricing.discountType === 'monto_fijo')
      b -= Number(f.pricing.discountValue);
    else if (f.pricing.discountType === 'noche_gratis')
      b -= Number(f.pricing.ratePerNight) * Number(f.pricing.discountValue);
    const addT = (f.pricing.additionals || []).reduce(
      (s, a) => s + (a.bonificada ? 0 : (Number(a.ratePerNight) || 0) * nights),
      0
    );
    return Math.max(0, b + addT);
  };

  useEffect(() => {
    if (f.pricing.ratePerNight !== '') {
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
  ]);

  const handleSave = () => {
    if (isSaving) return; 

    // --- 1. VALIDACIÓN DE CAMPOS OBLIGATORIOS ---
    if (!f.guestName || f.guestName.trim() === '') {
      setValErr('El Nombre del huésped es obligatorio.');
      return;
    }
    if (f.pricing.ratePerNight === '' || f.pricing.ratePerNight === null) {
      setValErr('La Tarifa base/noche es obligatoria.');
      return;
    }
    if (f.paid === '' || f.paid === null) {
      setValErr('El Monto pagado es obligatorio (podés poner 0).');
      return;
    }
    
    setValErr(''); // Si todo está bien, limpiamos el error
    // --------------------------------------------

    if (conflicts.length > 0) {
      setConfModal(() => () => {
        setIsSaving(true);
        onSave(f);
        setConfModal(null);
      });
    } else {
      setIsSaving(true);
      onSave(f);
    }
  };

  const saldoPendiente = Math.max(0, Number(f.totalAmount || 0) - Number(f.paid || 0));

  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 700,
          color: '#888',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        Fechas de estadía
      </label>
      <RangeCalendar
        checkIn={f.checkIn}
        checkOut={f.checkOut}
        minDate={minDatePermitida}
        onChange={(ci, co) => {
          sv('checkIn', ci);
          sv('checkOut', co);
        }}
      />

      {isHostel && (
        <Sel
          label="Habitación"
          value={f.room}
          onChange={(e) => {
            sv('room', e.target.value);
            sv('companions', []);
            sv('totalGuests', 1);
          }}
          options={[
            { value: '', label: '— Seleccionar habitación —' },
            ...ROOMS.map((r) => ({
              value: r.id,
              label: `${r.name} (hasta ${r.maxGuests} personas)`,
            })),
          ]}
        />
      )}

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
            background: '#F0F9FF',
            border: '1.5px solid #BAE6FD',
            borderRadius: 10,
            padding: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#0369A1', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            ¿Ya se hospedó antes?
          </div>
          {suggestions.map((s) => {
            const c = findCountry(s.data.guestNationality);
            const ph = String(s.data.guestPhone || '').replace(/\D/g, '');
            return (
              <div
                key={s.key}
                style={{
                  background: '#fff',
                  border: `1px solid ${s.blacklisted ? '#FECACA' : '#E0F2FE'}`,
                  borderRadius: 8,
                  padding: '8px 10px',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                    {c ? c.flag + ' ' : ''}{s.data.guestName}
                    {s.blacklisted && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: '#fff', background: '#DC2626', padding: '2px 6px', borderRadius: 10 }}>
                        LISTA NEGRA
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {s.visits} {s.visits === 1 ? 'visita' : 'visitas'} · última {fmtD(s.lastStay)}
                    {s.lastRoom ? ` · ${s.lastRoom}` : ''}
                    {ph ? ` · 📱 …${ph.slice(-4)}` : ''}
                    {s.data.guestDoc ? ` · ${s.data.guestDocType || 'Doc'} …${String(s.data.guestDoc).slice(-4)}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => pickGuest(s)}
                  style={{
                    padding: '7px 10px',
                    background: '#0284C7',
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
              color: '#0369A1',
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
            color: '#065F46',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 8,
            padding: '6px 10px',
          }}
        >
          <span style={{ flex: 1 }}>✓ Se cargaron los datos de su estancia anterior. Revisá que sigan vigentes.</span>
          <button
            type="button"
            onClick={undoGuest}
            style={{ background: 'none', border: 'none', color: '#047857', fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
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
            {stayTag.label}
          </span>
          {stay.last && (
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>
              Anterior: {fmtD(stay.last.checkIn)}
              {stay.last.room ? ` · ${stay.last.room}` : ''}
            </span>
          )}
        </div>
      )}

      {/* ── ALERTA DE LISTA NEGRA (VISIBLE SOLO SI HAY COINCIDENCIA) ── */}
      {matchBlacklist && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ color: '#991B1B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            ⚠️ Alerta de Lista Negra
          </div>
          <div style={{ color: '#7F1D1D', fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>
            El sistema detectó un huésped marcado como "No Grato" con el mismo nombre y nacionalidad. Verificá si es la misma persona:
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {matchBlacklist.url_ine_frente && (
              <a href={matchBlacklist.url_ine_frente} target="_blank" rel="noreferrer" style={{ fontSize: 11, background: '#DC2626', color: '#fff', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontWeight: 700 }}>
                📷 ID Frente
              </a>
            )}
            {matchBlacklist.url_ine_dorso && (
              <a href={matchBlacklist.url_ine_dorso} target="_blank" rel="noreferrer" style={{ fontSize: 11, background: '#DC2626', color: '#fff', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontWeight: 700 }}>
                📷 ID Dorso
              </a>
            )}
            {!matchBlacklist.url_ine_frente && !matchBlacklist.url_ine_dorso && (
              <span style={{ fontSize: 11, color: '#991B1B', fontWeight: 600 }}>
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
      <IneUploader 
        f={f} 
        onUploadFrente={(url) => sv('url_ine_frente', url)}
        onUploadDorso={(url) => sv('url_ine_dorso', url)}
        onScan={applyScan}
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

      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 700,
            color: '#888',
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
              padding: '9px 12px',
              border: '1.5px solid #E5E7EB',
              borderRadius: 8,
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
              padding: '9px 12px',
              border: '1.5px solid #E5E7EB',
              borderRadius: 8,
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
            padding: '9px 14px', background: '#EEF2FF', border: '1.5px solid #C7D2FE',
            color: '#4F46E5', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', height: 38
          }}
        >
          🪄 Generar
        </button>
      </div>

      <ConflictWarn conflicts={conflicts} properties={visibleProps} />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Sel
          label="Estado"
          value={f.status}
          onChange={(e) => sv('status', e.target.value)}
          options={['por_llegar', 'hospedado', 'finalizada', 'cancelada'].map(
            (v) => ({ value: v, label: RS[v]?.label })
          )}
        />
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 800,
              color: f.source === 'Booking' ? '#1E3A8A' : '#065F46',
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Canal
          </label>
          <select
            value={f.source}
            onChange={(e) => sv('source', e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px',
              border: `2px solid ${f.source === 'Booking' ? '#3B82F6' : '#10B981'}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              fontFamily: 'inherit',
              outline: 'none',
              background: f.source === 'Booking' ? '#EFF6FF' : '#ECFDF5',
              color: f.source === 'Booking' ? '#1E40AF' : '#065F46',
              boxSizing: 'border-box',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(!isHostel || selRoom) && maxG > 1 && (
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 700,
              color: '#888',
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
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  border: `2px solid ${f.totalGuests === n ? '#3B82F6' : '#E5E7EB'}`,
                  background: f.totalGuests === n ? '#EFF6FF' : '#fff',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  color: f.totalGuests === n ? '#1E40AF' : '#6B7280',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {f.companions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 700,
              color: '#888',
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
                background: '#F9FAFB',
                border: '1px solid #EEF0F2',
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6B7280',
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
                  padding: '9px 12px',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: 8,
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
                  padding: '9px 12px',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: 8,
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

      <div
        style={{
          marginBottom: 16,
          background: '#F8FAFC',
          borderRadius: 10,
          padding: '16px',
          border: '1px solid #E5E7EB',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#111',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          💰 Liquidación y Pago
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Inp
            label="Tarifa base/noche $"
            type="number"
            value={f.pricing.ratePerNight}
            onChange={(e) =>
              sv('pricing', {
                ...f.pricing,
                ratePerNight: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
          />
          <Inp
            label="Etiqueta"
            value={f.pricing.rateLabel}
            onChange={(e) =>
              sv('pricing', { ...f.pricing, rateLabel: e.target.value })
            }
            placeholder="Tarifa rack"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Sel
            label="Descuento"
            value={f.pricing.discountType}
            onChange={(e) =>
              sv('pricing', { ...f.pricing, discountType: e.target.value })
            }
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
          <div style={{ marginTop: 8, borderTop: '1px dashed #E5E7EB', paddingTop: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#6B7280',
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
                  padding: '8px 10px',
                  background: a.bonificada ? '#F0FDF4' : '#fff',
                  borderRadius: 8,
                  border: `1px solid ${a.bonificada ? '#86EFAC' : '#E5E7EB'}`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>Persona {i + 1}</div>
                <input
                  type="number"
                  value={a.ratePerNight === 0 ? '' : a.ratePerNight}
                  disabled={a.bonificada}
                  onChange={(e) => {
                    const ads = [...(f.pricing.additionals || [])];
                    ads[i] = { ...ads[i], ratePerNight: +e.target.value };
                    sv('pricing', { ...f.pricing, additionals: ads });
                  }}
                  placeholder="$/noche"
                  style={{
                    padding: '7px 9px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: 7,
                    fontSize: 12,
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
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `2px solid ${a.bonificada ? '#22C55E' : '#D1D5DB'}`,
                      background: a.bonificada ? '#22C55E' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {a.bonificada && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: a.bonificada ? '#15803D' : '#9CA3AF' }}>
                    Bonif.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px dashed #D1D5DB', margin: '16px 0 14px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'end' }}>
          <Inp
            label="Total a cobrar $"
            type="number"
            value={f.totalAmount}
            onChange={(e) =>
              sv('totalAmount', e.target.value === '' ? '' : Number(e.target.value))
            }
          />
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                color: '#888',
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Pagado $
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                value={f.paid}
                onChange={(e) => sv('paid', e.target.value === '' ? '' : Number(e.target.value))}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => sv('paid', f.totalAmount)}
                style={{
                  padding: '0 12px',
                  background: '#D1FAE5',
                  color: '#065F46',
                  border: '1.5px solid #10B981',
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                Cobrar Total
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
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
          <div
            style={{
              background: saldoPendiente > 0 ? '#FEF2F2' : '#ECFDF5',
              padding: '10px 14px',
              borderRadius: 8,
              border: `1.5px solid ${saldoPendiente > 0 ? '#FECACA' : '#A7F3D0'}`,
              textAlign: 'right',
              minWidth: 130,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: saldoPendiente > 0 ? '#DC2626' : '#059669',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 2,
              }}
            >
              {saldoPendiente > 0 ? 'Saldo pendiente' : 'Cuenta saldada'}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: saldoPendiente > 0 ? '#B45309' : '#059669',
              }}
            >
              {currency(saldoPendiente)}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: f.requiresInvoice ? '#EDE9FE' : '#F9FAFB',
          borderRadius: 10,
          border: `1.5px solid ${f.requiresInvoice ? '#A855F7' : '#E5E7EB'}`,
          cursor: 'pointer',
        }}
        onClick={() => sv('requiresInvoice', !f.requiresInvoice)}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            border: `2px solid ${f.requiresInvoice ? '#A855F7' : '#D1D5DB'}`,
            background: f.requiresInvoice ? '#A855F7' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {f.requiresInvoice && (
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>
              ✓
            </span>
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: f.requiresInvoice ? '#7C3AED' : '#374151',
            }}
          >
            Solicita factura
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>
            El huésped requiere comprobante fiscal
          </div>
        </div>
      </div>

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
              background: vccOn ? '#EFF6FF' : '#F9FAFB',
              borderRadius: 10,
              border: `1.5px solid ${vccOn ? '#3B82F6' : '#E5E7EB'}`,
              cursor: 'pointer',
            }}
            onClick={toggleVcc}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                border: `2px solid ${vccOn ? '#3B82F6' : '#D1D5DB'}`,
                background: vccOn ? '#3B82F6' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {vccOn && (
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>
                  ✓
                </span>
              )}
            </div>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: vccOn ? '#1E40AF' : '#374151',
                }}
              >
                Tarjeta virtual cobrada (VCC)
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                {vccOn
                  ? 'Queda pagada con la tarjeta virtual de Booking'
                  : 'Tildalo cuando cobres la tarjeta virtual de Booking'}
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 700,
            color: '#888',
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
              padding: '9px 12px',
              border: '1.5px solid #E5E7EB',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ALERTA DE ERROR SI FALTAN CAMPOS OBLIGATORIOS */}
        {valErr && (
          <div
            style={{
              color: '#DC2626',
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 14,
              textAlign: 'center',
              background: '#FEF2F2',
              padding: '10px',
              borderRadius: 8,
              border: '1px solid #FECACA',
            }}
          >
            ⚠️ {valErr}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onClose}
          disabled={isSaving}
          style={{
            flex: 1,
            padding: '12px',
            background: '#F3F4F6',
            border: 'none',
            borderRadius: 8,
            fontFamily: 'inherit',
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            color: '#555',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            flex: 2,
            padding: '12px',
            background: conflicts.length > 0 ? '#DC2626' : '#3B82F6',
            border: 'none',
            borderRadius: 8,
            fontFamily: 'inherit',
            fontWeight: 700,
            cursor: isSaving ? 'wait' : 'pointer',
            color: '#fff',
            fontSize: 14,
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
              Guardar
              {conflicts.length > 0 ? ` (${conflicts.length} conflicto)` : ''}
            </>
          )}
        </button>
      </div>

      {confModal && (
        <div
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
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 380,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                background: '#DC2626',
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
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 16, lineHeight: 1.4 }}>
                Ya hay una reserva actual de <b style={{ color: '#DC2626' }}>{conflicts.map(c => c.guestName).join(' y ')}</b> en estas fechas.
                <br /><br />
                ¿Deseas forzar el empalme y guardar de todas formas?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#EFF6FF',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#1E40AF',
                  }}
                >
                  ← Corregir
                </button>
                <button
                  onClick={confModal}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#FEF2F2',
                    border: '1.5px solid #FECACA',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#DC2626',
                  }}
                >
                  Forzar Empalme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
