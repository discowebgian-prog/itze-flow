/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { ResDrawer } from './components/reservations/ResDrawer';
import { ResForm } from './components/reservations/ResForm';
import { Icon } from './components/ui/Icon';
import { Modal } from './components/ui/Modal';
import { useW } from './hooks/useW';
import { PROPS, INIT_RES, COUNTRIES } from './lib/constants';
import { TODAY, fmt, diffDays } from './lib/dates';
import { supabase } from './lib/supabase';
import { findDuplicates } from './lib/duplicates';
import { checkoutTimePassed, lateCostOf } from './lib/reservations';
import { groupOf, groupBooker, bookerOf, newGroupId } from './lib/groups';
import { Dashboard } from './pages/Dashboard';
import { FinancePage } from './pages/FinancePage';
import { GuestsPage } from './pages/GuestsPage';
import { Login } from './pages/Login';
import { PropertiesPage } from './pages/PropertiesPage';
import { RatesPage } from './pages/RatesPage';
import { ResList } from './pages/ResList';
import { Timeline } from './pages/Timeline';
import appLayoutCss from './styles/app-layout.css?raw';


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
  const isTablet = winW >= 769 && winW < 1280;

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
            supabase.from('reservas').update({ estado: 'finalizada' }).eq('id', item.id).then();
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

    const canalReservas = supabase
      .channel('cambios-en-vivo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        (payload) => {
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

    return () => {
      supabase.removeChannel(canalReservas);
      document.removeEventListener('visibilitychange', handleVisibility);
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
            supabase.from('reservas').update({ estado: 'finalizada' }).eq('id', r.id).then();
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
  const [notes, setNotes] = useState({});
  // Estado dinámico para el Checklist Editable por propiedad
  const [checklists, setChecklists] = useState({
    hostel: {
      items: [
        'Cambio de sábanas y toallas',
        'Limpieza profunda de baño',
        'Barrido y trapeado de pisos',
        'Vaciado de basureros',
        'Reposición de papel y amenidades',
        'Revisión de luces y aire acondicionado'
      ],
      checked: {} // Guarda las tareas que ya se completaron (índice: true/false)
    }
  });
  const [calView, setCalView] = useState('timeline');
  const [prefill, setPrefill] = useState({});
  const [toastMsg, setToastMsg] = useState(null); 
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
  if (!user) return <Login onLogin={setUser} />;

  const isAdmin = user.role === 'admin';
  // Numerito rojo de "posibles duplicados" en el menú
  const dupDotStyle = {
    position: 'absolute',
    top: -6,
    right: -9,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 8,
    background: '#EF4444',
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
      .upsert([{ clave_a, clave_b, decision, decidido_por: user.name || '' }], {
        onConflict: 'clave_a,clave_b',
      });
    if (error) {
      console.error('Error al guardar decisión:', error);
      alert('No se pudo guardar la decisión. Probá de nuevo.');
      return false;
    }
    const { data } = await supabase.from('huespedes_decisiones').select('*');
    if (data) setGuestDecisions(data);
    return true;
  };

  const undoGuestDecision = async (id) => {
    const { error } = await supabase.from('huespedes_decisiones').delete().eq('id', id);
    if (error) {
      console.error('Error al deshacer decisión:', error);
      alert('No se pudo deshacer. Probá de nuevo.');
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
    { id: 'propiedades', label: 'Propiedades', icon: 'building' },
    { id: 'huespedes', label: 'Huéspedes', icon: 'users' },
    { id: 'finanzas', label: 'Finanzas', icon: 'finance' },
    { id: 'tarifas', label: 'Tarifas', icon: 'tag' },
  ];
  const TABS =
    user.role === 'staff'
      ? TABS_ALL.filter((t) => t.id !== 'finanzas')
      : TABS_ALL;

  // Funciones operativas restauradas
  const openAdd = (pid = '', date = '') => {
    setPrefill({ pid, date });
    setModal('new');
  };
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
          const { error } = await supabase.from('reservas').update(p.datosLimpios).eq('id', p.id);
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
        const responsable = user?.name || 'Usuario desconocido';

        const preparadas = lista.map((r) => {
          const p = prepRes(r);
          p.datosLimpios.fecha_carga = momentoExacto;
          p.datosLimpios.usuario_carga = responsable;
          p.reservaParaEstado.fecha_carga = momentoExacto;
          p.reservaParaEstado.usuario_carga = responsable;
          return p;
        });

        const { data, error } = await supabase
          .from('reservas')
          .insert(preparadas.map((p) => p.datosLimpios))
          .select();

        if (error) {
          if (first.grupoId && /grupo_/.test(error.message || '')) {
            throw new Error('falta correr el SQL de grupos en Supabase (supabase/grupos_reservante.sql).');
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
      
      // Lanzamos el cartel flotante y lo borramos a los 2 segundos
      setToastMsg(
        Array.isArray(input) && input.length > 1
          ? `Grupo guardado · ${input.length} habitaciones`
          : opts.also?.length
          ? 'Cambios guardados en todo el grupo'
          : 'Reserva guardada'
      );
      setTimeout(() => setToastMsg(null), 2000);

    } catch (err) {
      console.error('Error al conectar con la base de datos:', err);
      alert('Hubo un problema al guardar la reserva en la nube: ' + err.message);
    }
  };
  const updateRes = async (id, changes) => {
    // 1. Movemos la reserva visualmente al instante para que la app se sienta rápida
    setRes(res.map((r) => (r.id === id ? { ...r, ...changes } : r)));

    // 2. Le mandamos los datos a la nube para que las demás pantallas se enteren
      const { error } = await supabase
        .from('reservas')
        .update({
          fecha_ingreso: changes.checkIn,
          fecha_salida: changes.checkOut,
          habitacion: changes.room
        })
        .eq('id', id);

    if (error) {
      console.error('Error al sincronizar el movimiento:', error);
      alert('Hubo un error al guardar el movimiento en la nube. Revisá tu conexión.');
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

    const responsable = user?.name || 'Usuario desconocido';

    // 1. Borrado Lógico en Supabase
    const { error } = await supabase
      .from('reservas')
      .update({ 
        estado: 'eliminada',
        fecha_eliminacion: momentoExacto,
        usuario_eliminacion: responsable
      })
      .in('id', ids);

    if (error) {
      console.error('Error al archivar en Supabase:', error);
      alert('Hubo un problema al intentar borrar la reserva.');
      return;
    }

    // 2. La sacamos de la vista inmediatamente
    setRes((prev) => prev.filter((r) => !ids.includes(r.id)));
    setDrawer(null);
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
      pn.datosLimpios.usuario_carga = user?.name || 'Usuario desconocido';
      // Reserva común → pasa a ser la habitación del titular del nuevo grupo
      let baseAct = null;
      if (!isGroup) {
        baseAct = { ...base, grupoId: gid, grupoTitular: true, grupoReservante: booker };
        const { error: e1 } = await supabase
          .from('reservas')
          .update({ grupo_id: gid, grupo_titular: true, grupo_reservante: booker })
          .eq('id', base.id);
        if (e1) throw e1;
      }
      const { data, error } = await supabase.from('reservas').insert([pn.datosLimpios]).select();
      if (error) throw error;
      const creada = {
        ...pn.reservaParaEstado,
        fecha_carga: momento,
        id: data && data[0] ? data[0].id : 'r' + Date.now(),
      };
      setRes((prev) => [...prev.map((r) => (baseAct && r.id === base.id ? baseAct : r)), creada]);
      if (baseAct) setDrawer(baseAct);
      setToastMsg(`${extra.room} sumada al grupo`);
      setTimeout(() => setToastMsg(null), 2000);
      return true;
    } catch (err) {
      const msg = /grupo_/.test(err?.message || '')
        ? 'falta correr el SQL de grupos en Supabase (supabase/grupos_reservante.sql).'
        : err?.message;
      alert('No se pudo sumar la habitación: ' + msg);
      return false;
    }
  };

  // ── SEPARAR DEL GRUPO ── (si quedan menos de 2, el grupo deja de existir)
  const ungroupRes = async (r) => {
    const members = groupOf(res, r);
    const ids = members.length <= 2 ? members.map((m) => m.id) : [r.id];
    const { error } = await supabase
      .from('reservas')
      .update({ grupo_id: null, grupo_titular: false, grupo_reservante: null })
      .in('id', ids);
    if (error) {
      alert('No se pudo separar del grupo: ' + error.message);
      return false;
    }
    const clean = (x) => (ids.includes(x.id) ? { ...x, grupoId: null, grupoTitular: false, grupoReservante: null } : x);
    setRes((prev) => prev.map(clean));
    setDrawer((prev) => (prev ? clean(prev) : prev));
    setToastMsg(`${r.room} separada del grupo`);
    setTimeout(() => setToastMsg(null), 2000);
    return true;
  };

  const payRes = async (pagos) => {
    for (const p of pagos) {
      const { error } = await supabase
        .from('reservas')
        .update({ monto_pagado: String(p.paid), forma_pago: p.paymentMethod })
        .eq('id', p.id);
      if (error) {
        alert('No se pudo guardar el cobro: ' + error.message);
        return false;
      }
    }
    const apply = (r) => {
      const p = pagos.find((x) => x.id === r.id);
      return p ? { ...r, paid: Number(p.paid) || 0, paymentMethod: p.paymentMethod } : r;
    };
    setRes((prev) => prev.map(apply));
    setDrawer((prev) => (prev ? apply(prev) : prev));
    setToastMsg(pagos.length > 1 ? `Cobro guardado · ${pagos.length} habitaciones` : 'Cobro guardado');
    setTimeout(() => setToastMsg(null), 2000);
    return true;
  };
  const restoreRes = async (id) => {
    // 1. Le avisamos a Supabase que la reserva vuelve a la vida
    const { error } = await supabase
      .from('reservas')
      .update({ 
        estado: 'por_llegar', 
        fecha_eliminacion: null, 
        usuario_eliminacion: null 
      })
      .eq('id', id);

    if (error) {
      console.error('Error al restaurar:', error);
      alert('Hubo un problema al restaurar la reserva.');
      return;
    }

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
    const { error } = await supabase
      .from('reservas')
      .update({ lista_negra: newStatus })
      .eq('id', id);

    if (error) {
      alert('Error al actualizar la lista negra en la nube.');
      return;
    }

    // 1. Actualiza la lista general de reservas (el fondo y el calendario)
    setRes(res.map(r => r.id === id ? { ...r, lista_negra: newStatus } : r));

    // 2. ¡EL DETALLE VISUAL! Actualiza el panel abierto para que el botón reaccione al instante
    setDrawer(prev => prev && prev.id === id ? { ...prev, lista_negra: newStatus } : prev);
  };
  // Late check-out rápido desde el panel: guarda hora y costo y ajusta el total
  // (resta el costo anterior y suma el nuevo). hora vacía = quitar late check-out.
  const setLateCheckout = async (id, hora, costo) => {
    const r = res.find((x) => x.id === id);
    if (!r) return false;
    const newCost = hora ? Number(costo) || 0 : 0;
    const newTotal = Math.max(0, (Number(r.totalAmount) || 0) - lateCostOf(r) + newCost);
    const { error } = await supabase
      .from('reservas')
      .update({
        late_checkout_hora: hora || null,
        late_checkout_costo: hora ? newCost : null,
        monto: String(newTotal),
      })
      .eq('id', id);
    if (error) {
      alert('No se pudo guardar el late check-out: ' + error.message);
      return false;
    }
    const changes = { lateCheckout: hora || '', lateCost: hora ? newCost : '', totalAmount: newTotal };
    setRes((prev) => prev.map((x) => (x.id === id ? { ...x, ...changes } : x)));
    setDrawer((prev) => (prev && prev.id === id ? { ...prev, ...changes } : prev));
    setToastMsg(hora ? 'Late check-out guardado' : 'Late check-out quitado');
    setTimeout(() => setToastMsg(null), 2000);
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
  const modalWho = (m) =>
    Array.isArray(m)
      ? `el grupo de ${m[0]?.guestName || ''} (${m.map((x) => x.room).filter(Boolean).join(', ')})`
      : m.guestName;

  const confCI = async (time) => {
    if (!ciModal) return;
    const ids = modalIds(ciModal);

    // 1. Actualizamos la vista local de inmediato para una experiencia fluida
    setRes(
      res.map((x) =>
        ids.includes(x.id) ? { ...x, status: 'hospedado', checkInAt: time } : x
      )
    );
    setCiModal(null);

    // 2. Impactamos en la base de datos de Supabase de manera segura
    await supabase.from('reservas').update({ estado: 'hospedado' }).in('id', ids);
  };

  const confCO = async (time) => {
    if (!coModal) return;
    const ids = modalIds(coModal);

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

    // 2. Impactamos en la base de datos de Supabase
    await supabase.from('reservas').update({ estado: 'finalizada' }).in('id', ids);
  };

  // 4. EL DISEÑO VISUAL (Ahora sí, adentro de la función principal)
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <style>{appLayoutCss}</style>

      {/* Navbar Superior */}
      <div
        className="top-nav"
        style={{
          background: '#fff',
          borderBottom: '1px solid #F0F0F0',
          padding: '0 16px',
          height: 54,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 3px rgba(0,0,0,.04)',
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
            <span style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>
              Itzé Flow Pro
            </span>
            {isMobile && (
              <div
                style={{
                  fontSize: 10,
                  color: '#9CA3AF',
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
                    background: '#EDE9FE',
                    color: '#7C3AED',
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
                    background: '#DBEAFE',
                    color: '#1E40AF',
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
            <button
              onClick={() => openAdd()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 12px',
                background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Nueva
            </button>
          ) : (
            <>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  background: '#F3F4F6',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#6B7280',
                  cursor: 'pointer',
                }}
              >
                Salir
              </button>
            </>
          )}
        </div>
      </div>

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
                  borderRadius: 9,
                  border: 'none',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  background: tab === t.id ? '#EFF6FF' : 'transparent',
                  color: tab === t.id ? '#2563EB' : '#6B7280',
                  textAlign: 'left',
                  justifyContent: isTablet ? 'center' : 'flex-start',
                }}
              >
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
                borderTop: '1px solid #F0F0F0',
                margin: '12px 0',
                paddingTop: 12,
              }}
            >
              <button
                onClick={() => openAdd()}
                title={isTablet ? 'Nueva reserva' : ''}
                style={{
                  width: '100%',
                  padding: isTablet ? '10px' : '9px 12px',
                  background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
                  border: 'none',
                  borderRadius: 9,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(99,102,241,.3)',
                }}
              >
                +{' '}
                <span
                  className="sa"
                  style={{ display: isTablet ? 'none' : 'inline' }}
                >
                  Nueva reserva
                </span>
              </button>
            </div>
            {!isTablet && (
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 9,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: 12,
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                ↩ Cerrar sesión
              </button>
            )}
          </div>
        </div>

        {/* Contenido Principal Dinámico */}
        <div className="main-content" key={tab}>
          {tab === 'dashboard' && (
            <Dashboard
              user={user}
              reservations={visRes}
              properties={propsWS}
              propStatus={propStatus}
              setPropStatus={setPropStatus}
              onGoTo={goTo}
            />
          )}
          {tab === 'calendario' && (
            <Timeline
              reservations={visRes}
              properties={propsWS}
              onClickRes={(r) => setDrawer(r)}
              onAddRes={openAdd}
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
            />
          )}
          {tab === 'propiedades' && (
            <PropertiesPage
              properties={visProps}
              reservations={visRes}
              notes={notes}
              setNotes={setNotes}
              checklists={checklists}
              setChecklists={setChecklists}
              propStatus={propStatus}
              setPropStatus={setPropStatus}
              initProp={initProp}
              onGoTo={goTo}
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
            />
          )}
        </div>
      </div>

      {/* Menú inferior Mobile DESLIZABLE con filtro de seguridad */}
      <div
        className="bn"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #F0F0F0',
          zIndex: 99,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 8px) + 20px)',
          display: 'flex',
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
            <span
              style={{
                display: 'flex',
                color: tab === t.id ? '#2563EB' : '#9CA3AF',
                position: 'relative',
              }}
            >
              <Icon name={t.icon} size={22} />
              {t.id === 'huespedes' && dupCount > 0 && (
                <span style={dupDotStyle}>{dupCount}</span>
              )}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: tab === t.id ? '#2563EB' : '#9CA3AF',
                marginTop: 1,
              }}
            >
              {t.label}
            </span>
            {tab === t.id && (
              <div
                className="nav-indicator"
                style={{
                  width: 20,
                  height: 2.5,
                  background: '#2563EB',
                  borderRadius: 4,
                  marginTop: 2,
                }}
              />
            )}
          </button>
        ))}
      </div>

     {/* Modales y Paneles flotantes */}
      {drawer && (
        <ResDrawer
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
          onToggleBlacklist={toggleBlacklist}
          properties={visProps}
          allRes={res}
          guestDecisions={guestDecisions}
          isMobile={isMobile}
          onCheckIn={handleCI}
          onCheckOut={handleCO}
          onSetLate={setLateCheckout}
        />
      )}
      {modal?.type === 'confirmDel' && (
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
              maxWidth: 360,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                background: '#FEF2F2',
                padding: '18px 22px',
                borderBottom: '1px solid #FECACA',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#991B1B' }}>
                🗑 ¿Eliminar reserva?
              </div>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151' }}>
                La reserva <b>no se borrará definitivamente</b>. Quedará en la
                papelera y solo el administrador podrá recuperarla.
              </p>
              <p style={{ margin: '0 0 20px', fontSize: 12, color: '#9CA3AF' }}>
                Para eliminar permanentemente, contactá al administrador.
              </p>
              {modal.groupIds && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                    🔗 Esta habitación es parte de un grupo de {modal.groupIds.length}.
                  </div>
                  <button
                    onClick={() => {
                      delRes(modal.id);
                      setModal(null);
                    }}
                    style={{ padding: '10px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', color: '#DC2626' }}
                  >
                    Solo esta habitación
                  </button>
                  <button
                    onClick={() => {
                      delRes(modal.groupIds);
                      setModal(null);
                    }}
                    style={{ padding: '10px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', color: '#DC2626' }}
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
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#374151',
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
                    background: '#FEF2F2',
                    border: '1.5px solid #FECACA',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#DC2626',
                  }}
                >
                  Mover a papelera
                </button>}
              </div>
            </div>
          </div>
        </div>
      )}
      {modal === 'new' && (
        <Modal
          title="Nueva reserva"
          onClose={() => setModal(null)}
          isMobile={isMobile}
        >
          <ResForm
            visibleProps={visProps}
            onSave={saveRes}
            onClose={() => setModal(null)}
            prefillProp={prefill.pid}
            prefillDate={prefill.date}
            allRes={res}
            guestDecisions={guestDecisions}
          />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal
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
          />
        </Modal>
      )}
     {/* MODAL DE CONFIRMACIÓN CHECK-IN */}
      {ciModal && (
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
                background: '#10B981',
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
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>
                ¿Confirmas el ingreso de <b>{modalWho(ciModal)}</b>?
              </p>
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>
                Esta acción marcará la reserva como "Hospedado" y registrará la hora de entrada.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCiModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#4B5563',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confCI(new Date().toISOString())}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#10B981',
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
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN CHECK-OUT */}
      {coModal && (
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
                background: '#F59E0B',
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
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>
                ¿Confirmas la salida de <b>{modalWho(coModal)}</b>?
              </p>
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>
                La estadía pasará a "Finalizada" y se liberará la propiedad en el calendario.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCoModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#4B5563',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confCO(new Date().toISOString())}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F59E0B',
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
          </div>
        </div>
      )}
      {/* DISEÑO DEL CARTEL FLOTANTE (TOAST) */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? 90 : 40,
            left: 0,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: '#10B981',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 30,
              fontSize: 14,
              fontWeight: 800,
              boxShadow: '0 8px 16px rgba(16,185,129,.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              animation: 'slideUp 0.2s ease-out'
            }}
          >
            <span style={{ fontSize: 16 }}>✓</span> {toastMsg}
          </div>
        </div>
      )}

    </div>
  );
}
