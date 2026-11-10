/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useMemo, useRef } from 'react';
import { ResDrawer } from './components/reservations/ResDrawer';
import { ResForm } from './components/reservations/ResForm';
import { Quoter, QuoteButton } from './components/Quoter';
import { Icon } from './components/ui/Icon';
import { Modal } from './components/ui/Modal';
import { useW } from './hooks/useW';
import { PROPS, INIT_RES, COUNTRIES } from './lib/constants';
import { TODAY, fmt, diffDays } from './lib/dates';
import { supabase } from './lib/supabase';
import { findDuplicates } from './lib/duplicates';
import { checkoutTimePassed, lateCostOf } from './lib/reservations';
import { groupOf, groupBooker, bookerOf, newGroupId, PERSON_FIELDS } from './lib/groups';
import { Dashboard } from './pages/Dashboard';
import { FinancePage } from './pages/FinancePage';
import { GuestsPage } from './pages/GuestsPage';
import { Login } from './pages/Login';
import { RatesPage } from './pages/RatesPage';
import { ResList } from './pages/ResList';
import { Timeline } from './pages/Timeline';
import appLayoutCss from './styles/app-layout.css?raw';
import { AnimatePresence, motion } from 'motion/react';
import { Backdrop, PopCard, SPRING_POP, SPRING_SHEET } from './components/ui/Motion';
import { Toast, OfflineBanner, useOnline } from './components/ui/Toast';
import { notify, notifyError, humanError, SAVED, checkInText, checkOutText, deleteText, afterCheckIn, afterCheckOut, afterPay, describeChange, describeChanges } from './lib/voice';
import { WhoAmI } from './components/ui/WhoAmI';
import { getDeviceName, setDeviceName } from './lib/device';
import { syncPush, sendPush } from './lib/push';


// ── APP ───────────────────────────────────────────────────────────────────────
export default function AppMejorada() {
  const [user, setUser] = useState(null);
  const [res, setRes] = useState(INIT_RES);
  // Decisiones de "misma persona / son distintas" sobre huéspedes (tabla huespedes_decisiones)
  const [guestDecisions, setGuestDecisions] = useState([]);
  const [decisionsOk, setDecisionsOk] = useState(false);
  // Tarifario (tabla tarifas): períodos Normal, promos y fechas especiales
  const [tarifas, setTarifas] = useState([]);
  const [tarifasOk, setTarifasOk] = useState(false);
  const [tarifasLoading, setTarifasLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [highlightStatus, setHighlightStatus] = useState(null);
  const winW = useW();
  const isMobile = winW < 769;
  // Igual que el CSS (app-layout.css): tablet/compu angosta de 769 a 1280 px inclusive (menú lateral angosto)
  const isTablet = winW >= 769 && winW <= 1280;

  // ── QUIÉN HIZO CADA CAMBIO (avisos entre Gian y Marce) ──
  // Todo lo que esta app escribe en reservas lleva modificado_por = quien usa este aparato
  // (supabase/modificado_por.sql). El check-out automático firma 'Flow' (no avisa).
  const whoRef = useRef('');
  const resRef = useRef(res);
  resRef.current = res;
  // Foto de las reservas justo antes de escribir: así el aviso al otro aparato puede decir qué cambió
  // (cuando vuelve el eco del tiempo real, la pantalla ya muestra el cambio)
  const writeRef = useRef({ at: 0, res: [] });
  const markWrite = () => {
    if (Date.now() - writeRef.current.at > 3000) writeRef.current = { at: Date.now(), res: resRef.current };
    else writeRef.current.at = Date.now();
  };
  // OJO: adentro va supabase.from('reservas') directo (si se llama a rdb, se llama a sí mismo y no guarda nada)
  const rdb = {
    update: (obj) => {
      if (obj.modificado_por !== 'Flow') markWrite();
      return supabase.from('reservas').update({ modificado_por: whoRef.current || null, ...obj });
    },
    insert: (rows) => {
      markWrite();
      return supabase.from('reservas').insert(rows.map((r) => ({ modificado_por: whoRef.current || null, ...r })));
    },
  };

  // Tarifas: si la tabla todavía no existe, la pestaña Tarifas avisa que falta el SQL
  const fetchTarifas = async () => {
    const { data, error } = await supabase.from('tarifas').select('*');
    setTarifasLoading(false);
    if (error) {
      console.error('Error al cargar tarifas:', error);
      setTarifasOk(false);
      return;
    }
    setTarifas(data || []);
    setTarifasOk(true);
  };

  // 1. CARGA DE DATOS Y VIGILANTE DE INICIO
  // Espera al login: con RLS activo, sin sesión la base no devuelve datos.
  useEffect(() => {
    if (!user?.id) return undefined;

    const fetchReservas = async () => {
      const { data, error } = await supabase
        .from('reservas')
        .select('*')
        .is('fecha_eliminacion', null);

      if (error) {
        console.error('Error al cargar reservas:', error);
        return;
      }

      // Hora actual estricta en Progreso, Yucatán
      const nowMerida = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Merida" }));
      const horaActual = nowMerida.getHours();
      const hoyFmt = fmt(nowMerida);

      const reservasCargadas = data.map((item) => {
        const nacionalidad = item.nacionalidad || 'MX';
        const pais = COUNTRIES.find((c) => c.code === nacionalidad);
        const prefijo = pais ? pais.prefix : '+52';

        let telefonoLimpio = item.telefono || '';
        if (telefonoLimpio.startsWith(prefijo)) {
          telefonoLimpio = telefonoLimpio.replace(prefijo, '').trim();
        }

        let estado = item.estado || 'por_llegar';
        let fechaCheckout = item.fecha_salida || '';

        // ── AUTO CHECK-OUT AL CARGAR LA APP (desde las 14:00, o la hora del late check-out) ──
        if (estado === 'hospedado' && checkoutTimePassed(fechaCheckout, item.late_checkout_hora, nowMerida, hoyFmt)) {
            estado = 'finalizada';
            rdb.update({ estado: 'finalizada', modificado_por: 'Flow' }).eq('id', item.id).then();
        }

        return {
          id: item.id,
          propertyId: item.propiedad || 'hostel',
          guestName: item.huesped || '',
          room: item.habitacion || '',
          checkIn: item.fecha_ingreso || '',
          checkOut: fechaCheckout,
          status: estado,
          totalAmount: Number(item.monto) || 0,
          paid: Number(item.monto_pagado) || 0,
          source: item.canal || 'Directo — Puerta',
          guestNationality: nacionalidad,
          guestDocType: item.tipo_doc || '',
          guestDoc: item.num_doc || '',
          guestPhonePrefix: prefijo,
          guestPhone: telefonoLimpio,
          guestEmail: item.email || '',
          company: item.empresa || '',
          birthDate: item.fecha_nacimiento || '',
          lateCheckout: item.late_checkout_hora || '',
          lateCost: item.late_checkout_costo ?? '',
          totalGuests: Number(item.cantidad_huespedes) || 1,
          companions: item.acompanantes || [],
          paymentMethod: item.forma_pago || 'Efectivo',
          pin_acceso: item.pin_acceso || '',
          url_ine_frente: item.url_ine_frente || null,
          url_ine_dorso: item.url_ine_dorso || null,
          pricing: {
                ratePerNight: Number(item.tarifa_base) || 0,
                discountType: item.tipo_descuento || (Number(item.descuento) > 0 ? 'monto_fijo' : 'ninguno'),
                discountValue: Number(item.descuento) || 0,
                rateLabel: '',
                discountReason: item.motivo_descuento || '',
                additionals: Array.isArray(item.adicionales) ? item.adicionales : []
              },
          notes: item.notas || '',
          notas: item.notas || '',
          requiresInvoice: item.solicita_factura === 'true' || item.solicita_factura === true,
          solicita_factura: item.solicita_factura === 'true' || item.solicita_factura === true, // <--- ¡AQUÍ ESTÁ LA COMA QUE FALTABA!
          lista_negra: item.lista_negra === true || item.lista_negra === 'true',
          // Reserva de grupo (varias habitaciones de un mismo titular)
          grupoId: item.grupo_id || null,
          grupoTitular: item.grupo_titular === true,
          grupoReservante: item.grupo_reservante || null,
        };
      });

      setRes(reservasCargadas);
    };

    const fetchDecisiones = async () => {
      const { data, error } = await supabase.from('huespedes_decisiones').select('*');
      if (error) {
        // Si la tabla todavía no existe, la revisión de duplicados queda apagada
        console.error('Error al cargar decisiones de huéspedes:', error);
        setDecisionsOk(false);
        return;
      }
      setGuestDecisions(data || []);
      setDecisionsOk(true);
    };

    fetchReservas();
    fetchDecisiones();
    fetchTarifas();

    // Aviso de lo que hizo la otra persona ("Marce hizo el check-in de Ana López (P2)").
    // Se juntan los cambios que llegan seguidos (un grupo son varias filas) y sale un solo cartelito.
    let pend = [];
    let pendTimer = null;
    // Lo que hizo ESTE aparato: aviso al celular de los demás (con la app cerrada), vía /api/push
    let mine = [];
    let mineTimer = null;
    const announce = (payload) => {
      const row = payload.new || {};
      const by = row.modificado_por;
      if (!by || by === 'Flow') return;
      if (by === whoRef.current) {
        const w = writeRef.current;
        if (Date.now() - w.at > 8000) return; // lo hizo otro aparato con el mismo nombre
        const prev = w.res.find((r) => String(r.id) === String(row.id));
        const dm = describeChange(by, payload.eventType, row, prev);
        if (!dm) return;
        mine.push(dm);
        clearTimeout(mineTimer);
        mineTimer = setTimeout(() => {
          sendPush(describeChanges(mine), by);
          mine = [];
        }, 1200);
        return;
      }
      const old = resRef.current.find((r) => String(r.id) === String(row.id));
      const d = describeChange(by, payload.eventType, row, old);
      if (!d) return;
      pend.push(d);
      clearTimeout(pendTimer);
      pendTimer = setTimeout(() => {
        notify(describeChanges(pend), 'info');
        pend = [];
      }, 1200);
    };

    const canalReservas = supabase
      .channel('cambios-en-vivo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        (payload) => {
          announce(payload);
          setTimeout(() => {
            fetchReservas(); 
          }, 500);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'huespedes_decisiones' },
        () => fetchDecisiones()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tarifas' },
        () => fetchTarifas()
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchReservas();
        fetchDecisiones();
        fetchTarifas();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    // Al volver internet, se pone al día solo
    const handleOnline = () => {
      fetchReservas();
      fetchDecisiones();
      fetchTarifas();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      supabase.removeChannel(canalReservas);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [user?.id]);

  // 2. VIGILANTE SILENCIOSO EN TIEMPO REAL (Por si la App queda abierta)
  useEffect(() => {
    const vigilante = setInterval(() => {
      const nowMerida = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Merida" }));
      
      {
        const hoyFmt = fmt(nowMerida);
        
        setRes((prevRes) => {
          // Desde las 14:00, o a la hora del late check-out si la reserva tiene
          const paraHacerCheckout = prevRes.filter(r => r.status === 'hospedado' && checkoutTimePassed(r.checkOut, r.lateCheckout, nowMerida, hoyFmt));
          
          if (paraHacerCheckout.length === 0) return prevRes; // Todo en orden
          
          console.log(`⏰ Check-out automático (Mérida) para ${paraHacerCheckout.length} reservas.`);
          
          // Actualiza en Supabase silenciosamente
          paraHacerCheckout.forEach(r => {
            rdb.update({ estado: 'finalizada', modificado_por: 'Flow' }).eq('id', r.id).then();
          });

          // Actualiza visualmente en tiempo real
          return prevRes.map(r => 
            paraHacerCheckout.some(pc => pc.id === r.id) 
              ? { ...r, status: 'finalizada', checkOutAt: nowMerida.toISOString() } 
              : r
          );
        });
      }
    }, 60000); // Revisa cada minuto

    return () => clearInterval(vigilante);
  }, []);

  // Estados restaurados: Las "memorias" que controlan tu interfaz
  const [drawer, setDrawer] = useState(null);
  const [modal, setModal] = useState(null);
  const [ciModal, setCiModal] = useState(null);
  const [coModal, setCoModal] = useState(null);
  const [propStatus, setPropStatus] = useState({});
  const [calView, setCalView] = useState('timeline');
  const [prefill, setPrefill] = useState({});
  const [calOffset, setCalOffset] = useState(-2);  

  // Cierra la sesión de este dispositivo; el resto del equipo sigue conectado.
  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setRes([]);
    setUser(null);
  };

  // Posibles huéspedes duplicados (se recalcula solo cuando cambian reservas o decisiones)
  const dupPairs = useMemo(
    () => (decisionsOk ? findDuplicates(res.filter((r) => !r.deleted), guestDecisions) : []),
    [res, guestDecisions, decisionsOk]
  );

  // 1. Verificación de Login
  // Cotizar (antes del "if (!user)": los useState no pueden ir después de un return)
  const [quoterOpen, setQuoterOpen] = useState(false);
  // Sin conexión: franja ámbar arriba (y cartelito al volver)
  const online = useOnline();
  // Quién usa este aparato (Gian / Marce): se pregunta la primera vez y se recuerda acá
  const [deviceName, setDeviceNameState] = useState(getDeviceName);
  const [whoOpen, setWhoOpen] = useState(false);
  whoRef.current = deviceName || user?.name || '';
  // Avisos con la app cerrada: renueva la suscripción de este aparato con su nombre
  useEffect(() => {
    if (user?.id && deviceName) syncPush(deviceName);
  }, [user?.id, deviceName]);
  // Desde el aviso de cumpleaños de Inicio: qué huésped resaltar en Huéspedes › Cumpleaños
  const [guestFocus, setGuestFocus] = useState(null);
  useEffect(() => {
    if (tab !== 'huespedes') setGuestFocus(null);
  }, [tab]);
  const pickWho = (name) => {
    setDeviceName(name);
    setDeviceNameState(name);
    setWhoOpen(false);
    notify(`Listo, ${name} · este aparato queda a tu nombre`);
  };
  // Animación al cambiar de pantalla: de qué lado entra la nueva (según el orden del menú)
  const prevTabRef = useRef(tab);
  const tabDirRef = useRef(0);
  if (!user) return <Login onLogin={setUser} />;

  const isAdmin = user.role === 'admin';
  // Nombre para anotar quién cargó/eliminó/decidió algo
  const who = deviceName || user.name || 'Usuario desconocido';
  // Numerito rojo de "posibles duplicados" en el menú
  const dupDotStyle = {
    position: 'absolute',
    top: -6,
    right: -9,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 8,
    background: 'var(--c-EF4444)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
    lineHeight: '16px',
    textAlign: 'center',
    boxSizing: 'border-box',
  };
  const dupCount = isAdmin ? dupPairs.length : 0;

  // Guarda la decisión de un admin sobre un par de huéspedes
  const decideGuests = async (pair, decision) => {
    const [clave_a, clave_b] = [pair.a.key, pair.b.key].sort();
    const { error } = await supabase
      .from('huespedes_decisiones')
      .upsert([{ clave_a, clave_b, decision, decidido_por: who }], {
        onConflict: 'clave_a,clave_b',
      });
    if (error) {
      notifyError(error, 'guardar la decisión');
      return false;
    }
    const { data } = await supabase.from('huespedes_decisiones').select('*');
    if (data) setGuestDecisions(data);
    return true;
  };

  const undoGuestDecision = async (id) => {
    const { error } = await supabase.from('huespedes_decisiones').delete().eq('id', id);
    if (error) {
      notifyError(error, 'deshacer');
      return;
    }
    setGuestDecisions((ds) => ds.filter((d) => d.id !== id));
  };

  // 2. Definición de permisos y datos
  const visProps =
    user.role === 'admin'
      ? PROPS
      : PROPS.filter((p) => user.ownedProps.includes(p.id));
  const visRes = res.filter(
    (r) => visProps.some((p) => p.id === r.propertyId) && !r.deleted
  );
  const propsWS = visProps;
  const effectiveCalView = calView;
  const initProp = visProps[0]?.id;

  // 3. Pestañas permitidas
  const TABS_ALL = [
    { id: 'dashboard', label: 'Inicio', icon: 'home' },
    { id: 'calendario', label: 'Calendario', icon: 'calendar' },
    { id: 'reservas', label: 'Reservas', icon: 'list' },
    // Propiedades se sacó del menú (10 nov 2026): sus tareas y notas competían con Itzé Limpieza
    // y no se guardaban. Vuelve como ficha de cada propiedad cuando haya más de una (ver decisiones).
    { id: 'huespedes', label: 'Huéspedes', icon: 'users' },
    { id: 'finanzas', label: 'Finanzas', icon: 'finance' },
    { id: 'tarifas', label: 'Tarifas', icon: 'tag' },
  ];
  if (prevTabRef.current !== tab) {
    const ix = (id) => TABS_ALL.findIndex((t) => t.id === id);
    tabDirRef.current = ix(tab) > ix(prevTabRef.current) ? 1 : -1;
    prevTabRef.current = tab;
  }
  const TABS =
    user.role === 'staff'
      ? TABS_ALL.filter((t) => t.id !== 'finanzas')
      : TABS_ALL;

  // Funciones operativas restauradas
  // queue: reservas que siguen después de guardar esta (cambio de habitación desde Cotizar)
  // chain: { i, total } para el título "2 de 3"
  const openAdd = (pid = '', date = '', initial = null, rooms = null, queue = [], chain = null) => {
    setPrefill({ pid, date, initial, rooms, queue, chain, key: Date.now() });
    setModal('new');
  };
  // Cotizar: ventana sin crear reserva; "Reservar" abre el formulario ya cargado
  const openQuote = () => setQuoterOpen(true);
  const goTo = (newTab, data) => {
    if (newTab === 'abrir_reserva') {
      setDrawer(data);
    } else {
      setTab(newTab);
      // Desde el inicio ("En casa", "Ocupación de hoy") el calendario se abre en hoy,
      // igual que el botón "Hoy" del calendario
      if (newTab === 'calendario') setCalOffset(-2);
      if (typeof data === 'string') {
        setHighlightStatus(data);
        setTimeout(() => setHighlightStatus(null), 2700);
      }
      // { birthday: clave del huésped } → Huéspedes › Cumpleaños con su tarjeta resaltada
      if (data && typeof data === 'object' && 'birthday' in data) setGuestFocus({ key: data.birthday || null });
    }
  };
  // Convierte una reserva de la app al formato de la base (y al de la pantalla)
  const prepRes = (newRes) => {
      // Evaluamos si el tilde está activo en cualquiera de sus variantes
      const tieneFactura = newRes.requiresInvoice === true || newRes.requiresInvoice === 'true' || newRes.solicita_factura === true || newRes.solicita_factura === 'true';
      
      // Limpieza preventiva antes de guardar por si el usuario repitió el prefijo a mano
      let telefonoLimpioGuardar = (newRes.guestPhone || '').trim();
      if (newRes.guestPhonePrefix && telefonoLimpioGuardar.startsWith(newRes.guestPhonePrefix)) {
        telefonoLimpioGuardar = telefonoLimpioGuardar.replace(newRes.guestPhonePrefix, '').trim();
      }

      // Empresa: solo se guarda si pidió factura (quien pide factura se considera Empresa)
      const empresaGuardar = tieneFactura ? String(newRes.company || '').trim() : '';

      const datosLimpios = {
          huesped: newRes.guestName || 'Sin nombre',
          habitacion: newRes.room || null,
          fecha_ingreso: newRes.checkIn,
          fecha_salida: newRes.checkOut,
          estado: newRes.status || 'por_llegar',
          monto: String(newRes.totalAmount || ''),
          monto_pagado: String(newRes.paid || ''),
          canal: newRes.source || 'Directo — Puerta',
          nacionalidad: newRes.guestNationality || '',
          tipo_doc: newRes.guestDocType || '',
          num_doc: newRes.guestDoc || '',
          telefono: newRes.guestPhonePrefix ? `${newRes.guestPhonePrefix} ${telefonoLimpioGuardar}` : telefonoLimpioGuardar,
          email: newRes.guestEmail || '',
          empresa: empresaGuardar,
          late_checkout_hora: newRes.lateCheckout || null,
          late_checkout_costo: newRes.lateCheckout ? Number(newRes.lateCost) || 0 : null,
          cantidad_huespedes: String(newRes.totalGuests || 1),
          acompanantes: newRes.companions || [],
          forma_pago: newRes.paymentMethod || 'Efectivo',
          notas: String(newRes.notes || newRes.notas || ''),
          url_ine_frente: newRes.url_ine_frente || null,
          url_ine_dorso: newRes.url_ine_dorso || null,
          tarifa_base: String(newRes.pricing?.ratePerNight || ''),
          descuento: String(newRes.pricing?.discountValue || 0),
          tipo_descuento: newRes.pricing?.discountType || 'ninguno',
          motivo_descuento: newRes.pricing?.discountReason || '',
          adicionales: newRes.pricing?.additionals || [],
            solicita_factura: tieneFactura ? 'true' : 'false',
            lista_negra: newRes.lista_negra || false,
            pin_acceso: newRes.pin_acceso || ''
          };
      // Las columnas de grupo solo se mandan si la reserva es de un grupo
      // (así las reservas comunes se siguen guardando aunque falte correr grupos.sql)
      // Fecha de nacimiento (supabase/fecha_nacimiento.sql): solo se manda si hay una cargada
      if (newRes.birthDate) datosLimpios.fecha_nacimiento = newRes.birthDate;
      if (newRes.grupoId) {
        datosLimpios.grupo_id = newRes.grupoId;
        datosLimpios.grupo_titular = !!newRes.grupoTitular;
        if (newRes.grupoReservante) datosLimpios.grupo_reservante = newRes.grupoReservante;
      }

        // Mantenemos duplicados los formatos en el estado de React para no romper las vistas
        const reservaParaEstado = {
          ...newRes,
          notes: newRes.notes || newRes.notas || '',
          notas: newRes.notes || newRes.notas || '',
          requiresInvoice: tieneFactura,
          solicita_factura: tieneFactura, 
          company: empresaGuardar,
          lateCheckout: newRes.lateCheckout || '',
          lateCost: newRes.lateCheckout ? Number(newRes.lateCost) || 0 : '',
          lista_negra: newRes.lista_negra || false,
          pin_acceso: newRes.pin_acceso || ''
        };
      return { datosLimpios, reservaParaEstado };
  };

  // Guarda una reserva, o varias:
  // - input es un array → reserva de grupo nueva (todas las habitaciones en un solo pedido:
  //   si falla una, no se guarda ninguna)
  // - opts.also → otras habitaciones del grupo a actualizar junto con esta
  const saveRes = async (input, opts = {}) => {
    try {
      const lista = Array.isArray(input) ? input : [input];
      const first = lista[0];

      if (!Array.isArray(input) && input.id) {
        // 1. EDICIÓN (esta habitación y, si se eligió "todo el grupo", las demás)
        const todas = [input, ...(opts.also || [])];
        const preparadas = todas.map((r) => ({ id: r.id, ...prepRes(r) }));
        for (const p of preparadas) {
          const { error } = await rdb.update(p.datosLimpios).eq('id', p.id);
          if (error) throw error;
        }
        setRes((prev) =>
          prev.map((r) => {
            const p = preparadas.find((x) => x.id === r.id);
            return p ? p.reservaParaEstado : r;
          })
        );

      } else {
        // 2. NUEVA RESERVA (una o varias habitaciones)
        const momentoExacto = new Date().toLocaleString('es-MX', {
          timeZone: 'America/Merida',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
        const responsable = who;

        const preparadas = lista.map((r) => {
          const p = prepRes(r);
          p.datosLimpios.fecha_carga = momentoExacto;
          p.datosLimpios.usuario_carga = responsable;
          p.reservaParaEstado.fecha_carga = momentoExacto;
          p.reservaParaEstado.usuario_carga = responsable;
          return p;
        });

        const { data, error } = await rdb.insert(preparadas.map((p) => p.datosLimpios))
          .select();

        if (error) {
          if (first.grupoId && /grupo_/.test(error.message || '')) {
            throw Object.assign(new Error('falta correr el SQL de grupos en Supabase (supabase/grupos_reservante.sql).'), { code: '42703' });
          }
          throw error;
        }

        const nuevas = preparadas.map((p, i) => ({
          ...p.reservaParaEstado,
          id: data && data[i] ? data[i].id : 'r' + Date.now() + i,
        }));
        setRes((prev) => [...prev, ...nuevas]);
      }

      setModal(null);

      // ¡LA MAGIA DEL SALTO! Calculamos la distancia en días y movemos el calendario
      const diasDistancia = diffDays(fmt(TODAY), first.checkIn);
      setCalOffset(diasDistancia - 2); // Lo centramos dejando 2 días de margen a la izquierda
      setTab('calendario'); // Forzamos ir a la pestaña del calendario para ver la reserva
      
      // Editar que hizo check-in, check-out o saldó la cuenta: mismo cartelito al centro que desde el panel
      if (!Array.isArray(input) && input.id) {
        const prev = res.find((r) => r.id === input.id);
        const touched = [input, ...(opts.also || [])];
        const after = res.map((r) => touched.find((t) => t.id === r.id) || r);
        const ids = touched.map((t) => t.id);
        const debt = (r) => (Number(r?.totalAmount) || 0) - (Number(r?.paid) || 0);
        if (prev && prev.status !== 'hospedado' && input.status === 'hospedado') {
          notify(afterCheckIn(touched, after), 'ok', { center: true });
          return true;
        }
        if (prev && prev.status !== 'finalizada' && input.status === 'finalizada') {
          notify(afterCheckOut(touched, after), 'ok', { center: true });
          return true;
        }
        if (prev && Number(input.paid) > Number(prev.paid) && debt(prev) > 0) {
          notify(afterPay(ids, after), 'ok', { center: true });
          return true;
        }
      }
      // Cartelito que se va solo
      notify(
        Array.isArray(input) && input.length > 1
          ? SAVED.grupo(input)
          : opts.also?.length
          ? SAVED.grupoCambios(first)
          : !Array.isArray(input) && input.id
          ? SAVED.cambios(first)
          : SAVED.reserva(first)
      );
      return true;
    } catch (err) {
      // El formulario queda abierto con lo que se escribió
      notifyError(err, Array.isArray(input) && input.length > 1 ? 'guardar el grupo' : 'guardar la reserva', { keep: true });
      return false;
    }
  };
  const updateRes = async (id, changes) => {
    const before = res.find((r) => r.id === id);
    // 1. Movemos la reserva visualmente al instante para que la app se sienta rápida
    setRes(res.map((r) => (r.id === id ? { ...r, ...changes } : r)));

    // 2. Le mandamos los datos a la nube para que las demás pantallas se enteren
      const { error } = await rdb.update({
          fecha_ingreso: changes.checkIn,
          fecha_salida: changes.checkOut,
          habitacion: changes.room
        })
        .eq('id', id);

    if (error) {
      // Vuelve a donde estaba, para que la pantalla no muestre algo que no se guardó
      if (before) setRes((prev) => prev.map((r) => (r.id === id ? before : r)));
      notifyError(error, 'mover la reserva');
    }
  };
  const delRes = async (idOrIds) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    // Capturamos la fecha y hora exacta con la zona horaria de Progreso, Yucatán
    const momentoExacto = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Merida',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });

    const responsable = who;

    // 1. Borrado Lógico en Supabase
    const { error } = await rdb.update({ 
        estado: 'eliminada',
        fecha_eliminacion: momentoExacto,
        usuario_eliminacion: responsable
      })
      .in('id', ids);

    if (error) {
      notifyError(error, 'eliminar la reserva');
      return;
    }

    // 2. La sacamos de la vista inmediatamente
    setRes((prev) => prev.filter((r) => !ids.includes(r.id)));
    setDrawer(null);
    notify(SAVED.eliminada(ids.length));
  };

  // Cobro desde el panel: cambia lo pagado (y la forma de pago) de una o varias habitaciones.
  // pagos: [{ id, paid, paymentMethod }]
  // ── SUMAR HABITACIÓN desde el panel ──
  // Si la reserva no era de un grupo, se arma uno: ella queda como la del titular.
  // La nueva habitación copia fechas, canal, factura, notas y PIN; queda por llegar, sin pagar
  // y con los datos de quien reservó hasta que llegue su contacto.
  const addRoomToGroup = async (base, extra) => {
    const members = groupOf(res, base);
    const isGroup = members.length > 1;
    const gid = isGroup ? base.grupoId : base.grupoId || newGroupId();
    const booker = isGroup ? groupBooker(members) : bookerOf(base);
    const momento = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Merida',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    const nueva = {
      ...base,
      id: undefined,
      room: extra.room,
      totalGuests: extra.totalGuests,
      companions: [],
      pricing: extra.pricing,
      totalAmount: extra.totalAmount,
      paid: 0,
      status: 'por_llegar',
      checkInAt: undefined,
      checkOutAt: undefined,
      lateCheckout: '',
      lateCost: '',
      guestName: booker.name,
      guestDoc: booker.doc,
      guestDocType: booker.docType || base.guestDocType,
      guestNationality: booker.nationality || base.guestNationality,
      guestPhonePrefix: booker.phonePrefix || base.guestPhonePrefix,
      guestPhone: booker.phone,
      guestEmail: booker.email,
      url_ine_frente: null,
      url_ine_dorso: null,
      lista_negra: false,
      grupoId: gid,
      grupoTitular: false,
      grupoReservante: booker,
    };
    try {
      const pn = prepRes(nueva);
      pn.datosLimpios.fecha_carga = momento;
      pn.datosLimpios.usuario_carga = who;
      // Reserva común → pasa a ser la habitación del titular del nuevo grupo
      let baseAct = null;
      if (!isGroup) {
        baseAct = { ...base, grupoId: gid, grupoTitular: true, grupoReservante: booker };
        const { error: e1 } = await rdb.update({ grupo_id: gid, grupo_titular: true, grupo_reservante: booker })
          .eq('id', base.id);
        if (e1) throw e1;
      }
      const { data, error } = await rdb.insert([pn.datosLimpios]).select();
      if (error) throw error;
      const creada = {
        ...pn.reservaParaEstado,
        fecha_carga: momento,
        id: data && data[0] ? data[0].id : 'r' + Date.now(),
      };
      setRes((prev) => [...prev.map((r) => (baseAct && r.id === base.id ? baseAct : r)), creada]);
      if (baseAct) setDrawer(baseAct);
      notify(SAVED.sumada(extra.room));
      return true;
    } catch (err) {
      const e = /grupo_/.test(err?.message || '') ? Object.assign(err, { code: '42703' }) : err;
      notifyError(e, `sumar ${extra.room || 'la habitación'}`);
      return false;
    }
  };

  // ── SEPARAR DEL GRUPO ── (si quedan menos de 2, el grupo deja de existir)
  const ungroupRes = async (r) => {
    const members = groupOf(res, r);
    const ids = members.length <= 2 ? members.map((m) => m.id) : [r.id];
    const { error } = await rdb.update({ grupo_id: null, grupo_titular: false, grupo_reservante: null })
      .in('id', ids);
    if (error) {
      notifyError(error, `separar ${r.room} del grupo`);
      return false;
    }
    const clean = (x) => (ids.includes(x.id) ? { ...x, grupoId: null, grupoTitular: false, grupoReservante: null } : x);
    setRes((prev) => prev.map(clean));
    setDrawer((prev) => (prev ? clean(prev) : prev));
    notify(SAVED.separada(r.room));
    return true;
  };

  const payRes = async (pagos) => {
    for (const p of pagos) {
      const { error } = await rdb.update({ monto_pagado: String(p.paid), forma_pago: p.paymentMethod })
        .eq('id', p.id);
      if (error) {
        notifyError(error, 'guardar el cobro');
        return false;
      }
    }
    const apply = (r) => {
      const p = pagos.find((x) => x.id === r.id);
      return p ? { ...r, paid: Number(p.paid) || 0, paymentMethod: p.paymentMethod } : r;
    };
    setRes((prev) => prev.map(apply));
    setDrawer((prev) => (prev ? apply(prev) : prev));
    notify(afterPay(pagos.map((p) => p.id), res.map(apply)), 'ok', { center: true });
    return true;
  };
  const restoreRes = async (id) => {
    // 1. Le avisamos a Supabase que la reserva vuelve a la vida
    const { error } = await rdb.update({ 
        estado: 'por_llegar', 
        fecha_eliminacion: null, 
        usuario_eliminacion: null 
      })
      .eq('id', id);

    if (error) {
      notifyError(error, 'recuperar la reserva');
      return;
    }
    notify(SAVED.restaurada);

    // 2. La revivimos en la pantalla
    setRes(
      res.map((r) =>
        r.id === id
          ? { ...r, deleted: false, status: 'por_llegar', deletedAt: null, deletedBy: null }
          : r
      )
    );
  };
const toggleBlacklist = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    const { error } = await rdb.update({ lista_negra: newStatus })
      .eq('id', id);

    if (error) {
      notifyError(error, newStatus ? 'marcar como no grato' : 'quitar de la lista negra');
      return;
    }

    // 1. Actualiza la lista general de reservas (el fondo y el calendario)
    setRes(res.map(r => r.id === id ? { ...r, lista_negra: newStatus } : r));

    // 2. ¡EL DETALLE VISUAL! Actualiza el panel abierto para que el botón reaccione al instante
    setDrawer(prev => prev && prev.id === id ? { ...prev, lista_negra: newStatus } : prev);
    notify(SAVED.listaNegra(newStatus));
  };
  // Late check-out rápido desde el panel: guarda hora y costo y ajusta el total
  // (resta el costo anterior y suma el nuevo). hora vacía = quitar late check-out.
  const setLateCheckout = async (id, hora, costo) => {
    const r = res.find((x) => x.id === id);
    if (!r) return false;
    const newCost = hora ? Number(costo) || 0 : 0;
    const newTotal = Math.max(0, (Number(r.totalAmount) || 0) - lateCostOf(r) + newCost);
    const { error } = await rdb.update({
        late_checkout_hora: hora || null,
        late_checkout_costo: hora ? newCost : null,
        monto: String(newTotal),
      })
      .eq('id', id);
    if (error) {
      notifyError(error, 'guardar el late check-out');
      return false;
    }
    const changes = { lateCheckout: hora || '', lateCost: hora ? newCost : '', totalAmount: newTotal };
    setRes((prev) => prev.map((x) => (x.id === id ? { ...x, ...changes } : x)));
    setDrawer((prev) => (prev && prev.id === id ? { ...prev, ...changes } : prev));
    notify(SAVED.late(hora));
    return true;
  };
  const handleCI = (r) => {
    setDrawer(null);
    setCiModal(r);
  };
  const handleCO = (r) => {
    setDrawer(null);
    setCoModal(r);
  };
  // ciModal / coModal: una reserva, o un array (check-in/out de todo el grupo)
  const modalIds = (m) => (Array.isArray(m) ? m.map((x) => x.id) : [m.id]);

  const confCI = async (time) => {
    if (!ciModal) return;
    const ids = modalIds(ciModal);

    const before = res.filter((x) => ids.includes(x.id));
    // 1. Actualizamos la vista local de inmediato para una experiencia fluida
    const after = res.map((x) =>
      ids.includes(x.id) ? { ...x, status: 'hospedado', checkInAt: time } : x
    );
    setRes(after);
    setCiModal(null);

    // 2. Impactamos en la base de datos de Supabase (si falla, vuelve a como estaba)
    const { error } = await rdb.update({ estado: 'hospedado' }).in('id', ids);
    if (error) {
      setRes((prev) => prev.map((x) => before.find((b) => b.id === x.id) || x));
      notifyError(error, 'hacer el check-in');
      return;
    }
    notify(afterCheckIn(after.filter((x) => ids.includes(x.id)), after), 'ok', { center: true });
  };

  const confCO = async (time) => {
    if (!coModal) return;
    const ids = modalIds(coModal);
    const before = res.filter((x) => ids.includes(x.id));

    // 1. Actualizamos la vista local
    setRes(
      res.map((x) =>
        ids.includes(x.id)
          ? {
              ...x,
              status: 'finalizada',
              checkOutAt: time,
            }
          : x
      )
    );
    setCoModal(null);

    // 2. Impactamos en la base de datos de Supabase (si falla, vuelve a como estaba)
    const { error } = await rdb.update({ estado: 'finalizada' }).in('id', ids);
    if (error) {
      setRes((prev) => prev.map((x) => before.find((b) => b.id === x.id) || x));
      notifyError(error, 'hacer el check-out');
      return;
    }
    notify(afterCheckOut(before, res), 'ok', { center: true });
  };

  // 4. EL DISEÑO VISUAL (Ahora sí, adentro de la función principal)
  return (
    <motion.div
      // Al entrar (después del login o al abrir la app) aparece con un fundido
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        fontFamily: 'var(--font)',
      }}
    >
      <style>{appLayoutCss}</style>

      {/* Navbar Superior */}
      <div
        className="top-nav"
        style={{
          background: 'var(--bar)',
          WebkitBackdropFilter: 'var(--blur)',
          backdropFilter: 'var(--blur)',
          borderBottom: '.5px solid var(--line)',
          padding: '0 16px',
          height: 54,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img src="https://i.postimg.cc/3NDCCVdT/gecko2.png" alt="Itzé" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          </div>
          <div>
            <span style={{ fontWeight: 'var(--w-title)', fontSize: 16, color: 'var(--ink)', letterSpacing: '-.01em' }}>
              Itzé Flow Pro
            </span>
            {isMobile && (
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--mut)',
                  lineHeight: 1,
                  marginTop: 1,
                }}
              >
                Itzé Hostel Boutique
              </div>
            )}
          </div>
          {!isMobile && (
            <>
              {user.role === 'owner' && (
                <span
                  style={{
                    fontSize: 11,
                    background: 'var(--c-EDE9FE)',
                    color: 'var(--c-7C3AED)',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  Propietario
                </span>
              )}
              {user.role === 'admin' && (
                <span
                  style={{
                    fontSize: 11,
                    background: 'var(--c-DBEAFE)',
                    color: 'var(--c-1E40AF)',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  Admin
                </span>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMobile ? (
            <>
            <QuoteButton onClick={openQuote} />
            <button
              onClick={() => openAdd()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 13px',
                background: 'var(--acc)',
                border: 'none',
                borderRadius: 20,
                color: '#fff',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <Icon name="plus" size={16} strokeWidth={2.5} />Nueva
            </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setWhoOpen(true)}
                title="Cambiar quién usa este aparato"
                style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px', borderRadius: 6 }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="user" size={16} />{deviceName || user.name}</span>
              </button>
              <button
                onClick={handleLogout}
                style={{
                  background: 'var(--fill)',
                  border: 'none',
                  borderRadius: 20,
                  padding: '6px 13px',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                Salir
              </button>
            </>
          )}
        </div>
      </div>
      <OfflineBanner show={!online} />

      <div className="app-layout">
        {/* Sidebar Lateral */}
        <div className="sidebar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={isTablet ? t.label : ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: isTablet ? '10px' : '9px 12px',
                  borderRadius: 12,
                  border: 'none',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: tab === t.id ? 'var(--acc)' : 'var(--ink-2)',
                  textAlign: 'left',
                  justifyContent: isTablet ? 'center' : 'flex-start',
                  position: 'relative',
                  isolation: 'isolate',
                }}
              >
                {/* Resaltado de la pestaña elegida: se desliza de una a otra */}
                {tab === t.id && (
                  <motion.span
                    layoutId="sb-ind"
                    transition={SPRING_SHEET}
                    style={{ position: 'absolute', inset: 0, background: 'var(--acc-soft)', borderRadius: 12, zIndex: -1 }}
                  />
                )}
                <span style={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
                  <Icon name={t.icon} size={20} />
                  {t.id === 'huespedes' && dupCount > 0 && isTablet && (
                    <span style={dupDotStyle}>{dupCount}</span>
                  )}
                </span>
                <span
                  className="sl"
                  style={{ display: isTablet ? 'none' : 'inline', flex: 1 }}
                >
                  {t.label}
                </span>
                {t.id === 'huespedes' && dupCount > 0 && !isTablet && (
                  <span
                    title="Posibles huéspedes duplicados para revisar"
                    style={{ ...dupDotStyle, position: 'static' }}
                  >
                    {dupCount}
                  </span>
                )}
              </button>
            ))}
            <div
              style={{
                borderTop: '.5px solid var(--line)',
                margin: '12px 0',
                paddingTop: 12,
              }}
            >
              <button
                onClick={() => openAdd()}
                title={isTablet ? 'Nueva reserva' : ''}
                style={{
                  width: '100%',
                  padding: isTablet ? '10px' : '10px 12px',
                  background: 'var(--acc)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Icon name="plus" size={16} strokeWidth={2.5} />
                <span
                  className="sa"
                  style={{ display: isTablet ? 'none' : 'inline' }}
                >
                  Nueva reserva
                </span>
              </button>
              <QuoteButton
                onClick={openQuote}
                compact={isTablet}
                style={{ width: '100%', marginTop: 8, borderRadius: 12, padding: isTablet ? '9px' : '9px 12px' }}
              />
            </div>
            {!isTablet && (
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 12,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: 12,
                  color: 'var(--mut)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon name="checkOut" size={15} />Cerrar sesión
              </button>
            )}
          </div>
        </div>

        {/* Contenido Principal Dinámico */}
        {/* Cambio de pantalla: la nueva entra deslizándose desde el lado hacia donde vas en el menú */}
        <motion.div
          className="main-content"
          key={tab}
          initial={{ opacity: 0, x: tabDirRef.current * 26 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ x: SPRING_SHEET, opacity: { duration: 0.22 } }}
        >
          {tab === 'dashboard' && (
            <Dashboard
              user={user}
              reservations={visRes}
              properties={propsWS}
              propStatus={propStatus}
              setPropStatus={setPropStatus}
              onGoTo={goTo}
              deviceName={deviceName}
              onWho={() => setWhoOpen(true)}
              decisions={guestDecisions}
            />
          )}
          {tab === 'calendario' && (
            <Timeline
              reservations={visRes}
              properties={propsWS}
              onClickRes={(r) => setDrawer(r)}
              onAddRes={openAdd}
              onQuote={openQuote}
              onUpdateRes={updateRes}
              isMobile={isMobile}
              calView={effectiveCalView}
              setCalView={setCalView}
              offset={calOffset}
              setOffset={setCalOffset}
              highlightStatus={highlightStatus}
            />
          )}
          {tab === 'reservas' && (
            <ResList
              reservations={visRes}
              properties={visProps}
              onView={(r) => setDrawer(r)}
              onAdd={openAdd}
              onQuote={openQuote}
            />
          )}
          {tab === 'huespedes' && (
            <GuestsPage
              reservations={visRes}
              properties={visProps}
              onView={(r) => setDrawer(r)}
              decisions={guestDecisions}
              dupPairs={isAdmin ? dupPairs : []}
              canReview={isAdmin && decisionsOk}
              onDecide={decideGuests}
              onUndo={undoGuestDecision}
              focusBirthday={guestFocus}
            />
          )}
          {tab === 'tarifas' && (
            <RatesPage
              periods={tarifas}
              ok={tarifasOk}
              loading={tarifasLoading}
              canEdit={isAdmin}
              user={user}
              onReload={fetchTarifas}
              isMobile={isMobile}
            />
          )}
          {tab === 'finanzas' && (
            <FinancePage
              reservations={visRes}
              allRes={res}
              properties={visProps}
              user={user}
              restoreRes={restoreRes}
              onGoTo={goTo}
              tarifas={tarifas}
            />
          )}
        </motion.div>
      </div>

      {/* Menú inferior Mobile DESLIZABLE con filtro de seguridad */}
      <div
        className="bn"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--bar)',
          WebkitBackdropFilter: 'var(--blur)',
          backdropFilter: 'var(--blur)',
          borderTop: '.5px solid var(--line)',
          zIndex: 99,
          // Más aire abajo para que los íconos no queden pegados al borde del teléfono (pedido de Gian).
          // Si se cambia, ajustar también el espacio final de .main-content (app-layout.css) y el cartelito verde.
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 34px)',
          // Sin display acá: lo maneja el CSS (.bn), así en compu/tablet no aparece (está el menú lateral)
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, // Ahora se distribuyen equitativamente sin salirse
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '8px 2px 4px',
              minHeight: 52,
            }}
          >
            <motion.span
              // Rebote chiquito del ícono al elegir la pestaña
              animate={{ scale: tab === t.id ? [1, 1.18, 1] : 1 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
              style={{
                display: 'flex',
                color: tab === t.id ? 'var(--acc)' : 'var(--mut)',
                position: 'relative',
                transition: 'color .2s ease',
              }}
            >
              <Icon name={t.icon} size={22} />
              {t.id === 'huespedes' && dupCount > 0 && (
                <span style={dupDotStyle}>{dupCount}</span>
              )}
            </motion.span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: tab === t.id ? 'var(--acc)' : 'var(--mut)',
                marginTop: 1,
              }}
            >
              {t.label}
            </span>
            {/* Rayita azul: se desliza hasta la pestaña elegida (lugar fijo para que nada salte) */}
            <span style={{ height: 2.5, marginTop: 2, display: 'flex', justifyContent: 'center', width: 20 }}>
              {tab === t.id && (
                <motion.span
                  layoutId="bn-ind"
                  className="nav-indicator"
                  transition={SPRING_SHEET}
                  style={{ width: 20, height: 2.5, background: 'var(--acc)', borderRadius: 4 }}
                />
              )}
            </span>
          </button>
        ))}
      </div>

     {/* Modales y Paneles flotantes */}
      <AnimatePresence>{drawer && (
        <ResDrawer
          key="drawer"
          res={drawer}
          onClose={() => setDrawer(null)}
          onEdit={(r, extra = {}) => {
            setModal({ type: 'edit', data: r, focusDoc: !!extra.focusDoc });
            setDrawer(null);
          }}
          onDelete={(id) => {
            const r = res.find((x) => x.id === id);
            const members = groupOf(res, r);
            setModal({ type: 'confirmDel', id, groupIds: members.length > 1 ? members.map((m) => m.id) : null });
          }}
          onOpenRes={(r) => setDrawer(r)}
          onPay={payRes}
          onAddRoom={addRoomToGroup}
          onUngroup={ungroupRes}
          tarifas={tarifas}
          onToggleBlacklist={toggleBlacklist}
          properties={visProps}
          allRes={res}
          guestDecisions={guestDecisions}
          isMobile={isMobile}
          onCheckIn={handleCI}
          onCheckOut={handleCO}
          onSetLate={setLateCheckout}
        />
      )}</AnimatePresence>
      <AnimatePresence>{modal?.type === 'confirmDel' && (
        <Backdrop key="confirmDel"
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
              borderRadius: 16,
              maxWidth: 360,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                background: 'var(--c-FEF2F2)',
                padding: '18px 22px',
                borderBottom: '1px solid var(--c-FECACA)',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-991B1B)' }}>
                🗑 {deleteText(res.find((x) => x.id === modal.id)).title}
              </div>
              {deleteText(res.find((x) => x.id === modal.id)).where && (
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-B91C1C)', marginTop: 3 }}>
                  {deleteText(res.find((x) => x.id === modal.id)).where}
                </div>
              )}
            </div>
            <div style={{ padding: '18px 22px' }}>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--c-374151)' }}>
                {deleteText(res.find((x) => x.id === modal.id)).detail}
              </p>
              {modal.groupIds && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-374151)' }}>
                    🔗 Esta habitación es parte de un grupo de {modal.groupIds.length}.
                  </div>
                  <button
                    onClick={() => {
                      delRes(modal.id);
                      setModal(null);
                    }}
                    style={{ padding: '10px', background: 'var(--c-FEF2F2)', border: '1.5px solid var(--c-FECACA)', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', color: 'var(--c-DC2626)' }}
                  >
                    Solo esta habitación
                  </button>
                  <button
                    onClick={() => {
                      delRes(modal.groupIds);
                      setModal(null);
                    }}
                    style={{ padding: '10px', background: 'var(--c-FEF2F2)', border: '1.5px solid var(--c-FECACA)', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', color: 'var(--c-DC2626)' }}
                  >
                    Todo el grupo ({modal.groupIds.length} habitaciones)
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'var(--c-F3F4F6)',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--c-374151)',
                  }}
                >
                  Cancelar
                </button>
                {!modal.groupIds && <button
                  onClick={() => {
                    delRes(modal.id);
                    setModal(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'var(--c-FEF2F2)',
                    border: '1.5px solid var(--c-FECACA)',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: 'var(--c-DC2626)',
                  }}
                >
                  Mover a papelera
                </button>}
              </div>
            </div>
          </PopCard>
        </Backdrop>
      )}</AnimatePresence>
      <AnimatePresence>{quoterOpen && (
        <Modal key="quoter" title="Cotizar" icon="calculator" onClose={() => setQuoterOpen(false)} isMobile={isMobile} tall>
          <Quoter
            allRes={res}
            tarifas={tarifas}
            onClose={() => setQuoterOpen(false)}
            onReserve={({ queue }) => {
              setQuoterOpen(false);
              const [first, ...rest] = queue;
              openAdd('hostel', first.initial.checkIn, first.initial, first.rooms, rest, queue.length > 1 ? { i: 1, total: queue.length } : null);
            }}
          />
        </Modal>
      )}</AnimatePresence>
      <AnimatePresence>{modal === 'new' && (
        <Modal key="new"
          title={prefill.chain ? `Nueva reserva · ${prefill.chain.i} de ${prefill.chain.total} (cambio de habitación)` : 'Nueva reserva'}
          onClose={() => setModal(null)}
          isMobile={isMobile}
          tall
        >
          <ResForm
            key={prefill.key}
            visibleProps={visProps}
            onSave={async (p, o) => {
              const ok = await saveRes(p, o);
              const q = prefill.queue || [];
              if (!ok || !q.length) return;
              // Cambio de habitación: abre la siguiente con los mismos datos del huésped
              const g = Array.isArray(p) ? p[0] : p;
              const carry = {};
              [...PERSON_FIELDS, 'source', 'requiresInvoice', 'company', 'status'].forEach((k) => {
                if (g && g[k] !== undefined) carry[k] = g[k];
              });
              const [next, ...rest] = q;
              const ch = prefill.chain || { i: 1, total: q.length + 1 };
              openAdd('hostel', next.initial.checkIn, { ...next.initial, ...carry }, next.rooms, rest, { i: ch.i + 1, total: ch.total });
            }}
            onClose={() => setModal(null)}
            prefillProp={prefill.pid}
            prefillDate={prefill.date}
            initial={prefill.initial || undefined}
            initialRooms={prefill.rooms || null}
            allRes={res}
            guestDecisions={guestDecisions}
            tarifas={tarifas}
          />
        </Modal>
      )}</AnimatePresence>
      <AnimatePresence>{modal?.type === 'edit' && (
        <Modal key="edit"
          title="Editar reserva"
          onClose={() => setModal(null)}
          isMobile={isMobile}
        >
          <ResForm
            initial={modal.data}
            focusDoc={modal.focusDoc}
            visibleProps={visProps}
            onSave={saveRes}
            onClose={() => setModal(null)}
            allRes={res}
            guestDecisions={guestDecisions}
            tarifas={tarifas}
          />
        </Modal>
      )}</AnimatePresence>
     {/* MODAL DE CONFIRMACIÓN CHECK-IN */}
      <AnimatePresence>{ciModal && (
        <Backdrop key="ciModal"
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
              borderRadius: 16,
              maxWidth: 380,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                background: 'var(--c-10B981)',
                padding: '16px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Confirmar Check-in
              </div>
            </div>
            <div style={{ padding: '20px 22px' }}>
              {(() => {
                const t = checkInText(ciModal);
                return (
                  <>
                    <p style={{ fontSize: 14, color: 'var(--c-374151)', marginBottom: 6 }}>
                      ¿Confirmás el ingreso de <b>{t.who}</b>{t.where}?
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--c-6B7280)', marginBottom: t.warn ? 10 : 20 }}>{t.detail}</p>
                    {t.warn && (
                      <p style={{ fontSize: 12, color: 'var(--c-92400E)', background: 'var(--c-FEF3C7)', border: '1px solid var(--c-FDE68A)', borderRadius: 8, padding: '7px 10px', margin: '0 0 18px', fontWeight: 600 }}>
                        💰 {t.warn}
                      </p>
                    )}
                  </>
                );
              })()}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCiModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'var(--c-F3F4F6)',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--c-4B5563)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confCI(new Date().toISOString())}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'var(--c-10B981)',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#fff',
                  }}
                >
                  ✓ Check-in
                </button>
              </div>
            </div>
          </PopCard>
        </Backdrop>
      )}</AnimatePresence>

      {/* MODAL DE CONFIRMACIÓN CHECK-OUT */}
      <AnimatePresence>{coModal && (
        <Backdrop key="coModal"
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
              borderRadius: 16,
              maxWidth: 380,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                background: 'var(--c-F59E0B)',
                padding: '16px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                Confirmar Check-out
              </div>
            </div>
            <div style={{ padding: '20px 22px' }}>
              {(() => {
                const t = checkOutText(coModal);
                return (
                  <>
                    <p style={{ fontSize: 14, color: 'var(--c-374151)', marginBottom: 6 }}>
                      ¿Confirmás la salida de <b>{t.who}</b>{t.where}?
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--c-6B7280)', marginBottom: t.warn ? 10 : 20 }}>{t.detail}</p>
                    {t.warn && (
                      <p style={{ fontSize: 12, color: 'var(--c-92400E)', background: 'var(--c-FEF3C7)', border: '1px solid var(--c-FDE68A)', borderRadius: 8, padding: '7px 10px', margin: '0 0 18px', fontWeight: 600 }}>
                        💰 {t.warn}
                      </p>
                    )}
                  </>
                );
              })()}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCoModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'var(--c-F3F4F6)',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--c-4B5563)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confCO(new Date().toISOString())}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'var(--c-F59E0B)',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#fff',
                  }}
                >
                  📤 Check-out
                </button>
              </div>
            </div>
          </PopCard>
        </Backdrop>
      )}</AnimatePresence>
      {/* ¿Quién usa este dispositivo? (la primera vez, o al tocar el nombre) */}
      <AnimatePresence>{(whoOpen || !deviceName) && (
        <WhoAmI key="who" current={deviceName} onPick={pickWho} onClose={deviceName ? () => setWhoOpen(false) : null} />
      )}</AnimatePresence>
      {/* CARTELITO: aparece abajo y se va solo (src/components/ui/Toast.tsx) */}
      <Toast isMobile={isMobile} />

    </motion.div>
  );
}
