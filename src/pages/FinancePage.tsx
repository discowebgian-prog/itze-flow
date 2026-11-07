/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from 'react';
import { TODAY, fmt, fmtD, addDays, diffDays, parseD, currency, MONTHS } from '../lib/dates';
import { askClaude } from '../lib/claude';
import { exportToExcel } from '../lib/excel';
import { supabase } from '../lib/supabase';
import { isFindeDow } from '../lib/rates';
import { AnimatePresence } from 'motion/react';
import { Backdrop, PopCard, CountUp, Collapse } from '../components/ui/Motion';

const PROJECTION_START_DAY = 8; // Antes hay muy pocos días para estimar


const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Título de las flechas de comparación, al pie de cada recuadro
function CmpTitle({ label }) {
  return (
    <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #E2E8F0', fontSize: 9, color: '#64748B', fontWeight: 700, textAlign: 'center' }}>
      ▲▼ Comparado con el mes anterior <span style={{ fontWeight: 600, color: '#9CA3AF' }}>({label})</span>
    </div>
  );
}

// Variación contra el mes anterior: ▲ 12% (verde), ▼ 8% (rojo), = 0% (gris), — sin dato previo
function Delta({ cur, prev, style = {} }) {
  if (!prev) return <span title="El mes anterior no tuvo ingresos acá" style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', ...style }}>—</span>;
  const p = Math.round(((cur - prev) / prev) * 100);
  const color = p > 0 ? '#059669' : p < 0 ? '#DC2626' : '#6B7280';
  return (
    <span title={`Mes anterior: ${currency(prev)}`} style={{ fontSize: 9, fontWeight: 800, color, whiteSpace: 'nowrap', cursor: 'help', ...style }}>
      {p > 0 ? '▲' : p < 0 ? '▼' : '='} {Math.abs(p)}%
    </span>
  );
}

// ── FINANCE PAGE ──────────────────────────────────────────────────────────────
export function FinancePage({ reservations, allRes, properties, user, restoreRes, onGoTo }) {
  const [showTrash, setShowTrash] = useState(false);
  const [gastos, setGastos] = useState([]);
  const [formGasto, setFormGasto] = useState({ fecha: fmt(TODAY), monto: '', categoria: 'Insumos', notas: '' });
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  // ── ESTADOS PARA REVENUE INTELLIGENCE Y EL POP-UP ──
  const [analyzingMonth, setAnalyzingMonth] = useState(null);
  const [aiInsights, setAiInsights] = useState({});
    const [insightModal, setInsightModal] = useState(null);
  const [chatMessages, setChatMessages] = useState({});
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const pending = reservations.filter(
    (r) => r.status !== 'cancelada' && r.paid < r.totalAmount
  );
  const deleted = (allRes || []).filter((r) => r.deleted);
  const currentMonthKey = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    const fetchGastos = async () => {
      const { data, error } = await supabase.from('gastos').select('*').order('fecha', { ascending: false });
      if (!error && data) setGastos(data);
    };
    fetchGastos();
  }, []);

  const handleGuardarGasto = async (e) => {
    e.preventDefault();
    if (!formGasto.monto || Number(formGasto.monto) <= 0) return;
    setGuardandoGasto(true);
    const { data, error } = await supabase.from('gastos').insert([{
      fecha: formGasto.fecha,
      monto: Number(formGasto.monto),
      categoria: formGasto.categoria,
      notas: formGasto.notas
    }]).select();
    setGuardandoGasto(false);
    
    if (!error && data) {
      setGastos([data[0], ...gastos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
      setFormGasto({ ...formGasto, monto: '', notas: '' });
    }
  };

  const eliminarGasto = async (id) => {
    if(!window.confirm('¿Eliminar gasto?')) return;
    await supabase.from('gastos').delete().eq('id', id);
    setGastos(gastos.filter((g) => g.id !== id));
  };

  const analizarRevenue = async (m, metrics) => {
    setAnalyzingMonth(m.key);
    try {
      // ============================================================
      // 1) VARIABLES DE REVENUE MANAGEMENT (EDITABLES MES A MES)
      // ============================================================
      const rmMetaOcupacion = 70; // Tu meta de ocupación, en %

      // Completar si hay eventos especiales (ej: [{ fecha: "2026-10-31", nombre: "Kitesurf Fest", tipo: "deportivo" }])
      const rmEventos = [];
      
      // Completar si tenés relevamiento de la zona (ej: [{ nombre: "Hostal X", tarifaEntreSemana: 500, tarifaFinde: 900 }])
      const rmCompetencia = [];

      // Datos extra. Lo que quede vacío o en 0, Claude lo marcará como dato faltante.
      const rmExtra = {
        distribucionEstadia: "", // Ej: "80% 1 noche, 20% 2 noches"
        ocupacionPorDiaSemana: "", // Ej: "Dom 12%, Lun 10%, Vie 60%, Sáb 70%"
        adrPorDiaSemana: "", 
        mixCanales: "", // Ej: "Booking 55%, Airbnb 20%, Directo 25%"
        anticipacionReservas: "", 
        reservasYaTomadas: "", 
        costoVariablePorNocheOcupada: 0, 
        comisionPromedioPct: 0, 
      };

      // ============================================================
      // 2) FUNCIONES AUXILIARES PARA EL PROMPT
      // ============================================================
      const rmHoy = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
      const rmBloque = (titulo, dato) => {
        const tieneDato = Array.isArray(dato) ? dato.length > 0 : (dato !== "" && dato !== 0 && dato != null);
        const texto = typeof dato === "string" || typeof dato === "number" ? dato : JSON.stringify(dato);
        return `${titulo}: ${tieneDato ? texto : "SIN DATOS (inclúyelo en DATOS QUE FALTAN)"}`;
      };

      // ============================================================
      // 3) EL PROMPT MAESTRO
      // ============================================================
      const prompt = `Actúa como Consultor Senior en Revenue Management (gestión de ingresos hoteleros) de "Itzé Hostel Boutique": 6 habitaciones privadas en Progreso, Yucatán (P6 matrimonial, P4 king, P1-P3 y P5 privadas).
Tu objetivo es maximizar la ganancia operativa por habitación disponible (GOPPAR), no solo la ocupación, y llenar los días flojos (Lun-Mié) sin bajar el precio de Jue-Dom.
Meta del dueño: acercar la ocupación a ${rmMetaOcupacion}%. En temporada baja hoy está por debajo de 30%.
Fecha de hoy: ${rmHoy}. Si el mes analizado ya terminó, haz un análisis retrospectivo y proyecta el plan al mes siguiente.

REGLAS ESTRICTAS:
1. No repitas ni describas los números que te envío; el dueño ya los ve en pantalla. Úsalos solo como evidencia dentro de una conclusión.
2. Cruza los datos del hotel con el contexto de mercado: cada recomendación debe conectar un número del hotel con un patrón del mercado.
3. Etiqueta lo importante como [DATO HOTEL], [DATO MERCADO] o [HIPÓTESIS A PROBAR].
4. No inventes precios de competidores, eventos ni cifras. Si falta un dato, dilo en DATOS QUE FALTAN.
5. NO propongas estadía mínima (MinLOS) de 2 o más noches para fines de semana. Asume que la inmensa mayoría del turismo en Progreso es de 1 sola noche. Sí puedes proponer incentivos opcionales (ej. 2da noche con descuento Dom-Jue).
6. Un descuento solo es válido si está "vallado" (limitado a un día, canal, mismo día, solo directo, etc.) para que no lo aproveche quien pagaría el precio completo.
7. REGLA DE ORO: Si los Egresos Operativos son $0, empieza obligatoriamente con una advertencia crítica indicando que el GOPPAR es una ilusión financiera.

CONTEXTO DE MERCADO: PROGRESO, YUCATÁN (datos 2026):
- La mayoría de quienes visitan el malecón es local/regional (Mérida está a 30 min) y buena parte va y vuelve el mismo día. El que pernocta, suele hacerlo solo por UNA noche.
- Oferta informal (rentas vacacionales) es altísima y presiona las tarifas hacia abajo.
- Picos de demanda: Fines de semana, Carnaval, Semana Santa, Julio-Agosto. Valles: entre semana y meses de Sep-Nov.

PALANCAS DISPONIBLES (Elige solo las que apliquen):
- Tarifa "escapada entre semana" para residentes de Yucatán (Lun-Mié), vallada con ID.
- Paquete trabajo remoto de Dom a Jue (orientado a contratistas del puerto).
- Precio de último minuto (mismo día) entre semana por canales directos.
- Jue-Dom: subir tarifa o cerrar promociones; upselling (late check-out, experiencias).

DATOS DEL HOTEL (${m.label}). Ingresos, ocupación, ADR, RevPAR y GOPPAR consideran solo las noches transcurridas hasta hoy:
- Ingreso Base Real: $${metrics.trueRevenue} | Egresos Operativos: $${metrics.gastos}
- Reservado del mes completo, incluyendo noches futuras: ${metrics.bookedPct}% de ocupación | $${metrics.bookedRevenue}${metrics.projectedPct !== null ? `
- Proyectado del mes [HIPÓTESIS A PROBAR: estimación según el ritmo de Lun-Mié y Jue-Dom hasta hoy, no incluye eventos futuros]: ${metrics.projectedPct}% de ocupación | $${metrics.projectedRevenue}` : ''}
- Ocupación Física: ${metrics.occPct}% | ADR: $${metrics.adr} | RevPAR Global: $${metrics.revpar} | GOPPAR: $${metrics.goppar}
- RevPAR (Lun-Mié): $${metrics.revparEntre} vs RevPAR (Jue-Dom): $${metrics.revparFinde}${metrics.prevCmp ? `
- Mes anterior (${metrics.prevCmp.label}): RevPAR Global $${metrics.prevCmp.revpar} | Lun-Mié $${metrics.prevCmp.entre} | Jue-Dom $${metrics.prevCmp.finde}` : ''}
- Ocup. Habitaciones 1, 2, 3 y 5 (privadas): ${metrics.oComp}% | Habitación 4 (king): ${metrics.oKing}% | Habitación 6 (matrimonial): ${metrics.oMat}%
${rmBloque("- Distribución de estadía", rmExtra.distribucionEstadia)}
${rmBloque("- Ocupación por día de la semana", rmExtra.ocupacionPorDiaSemana)}
${rmBloque("- ADR por día de la semana", rmExtra.adrPorDiaSemana)}
${rmBloque("- Mix de canales de venta", rmExtra.mixCanales)}
${rmBloque("- Anticipación de reservas", rmExtra.anticipacionReservas)}
${rmBloque("- Reservas tomadas a futuro", rmExtra.reservasYaTomadas)}
${rmBloque("- Costo variable por noche", rmExtra.costoVariablePorNocheOcupada)}
${rmBloque("- Comisión promedio", rmExtra.comisionPromedioPct)}
${rmBloque("- Eventos locales", rmEventos)}
${rmBloque("- Competencia", rmCompetencia)}

TU TAREA:
Responde en texto plano (sin asteriscos, sin markdown, usa MAYÚSCULAS para títulos y guiones para listas), máximo 800 palabras, sin introducciones. Usa estas secciones:
ALERTAS CRÍTICAS: (Solo si egresos son $0 o hay datos vitales faltantes).
LO QUE NO SE VE A SIMPLE VISTA: 3 hallazgos estratégicos cruzando datos y mercado.
¿ES REALISTA LA META?: Veredicto sobre la meta del ${rmMetaOcupacion}% con los datos actuales.
PLAN DE ACCIÓN: 4 acciones concretas (A quién, Qué ofrecer, A qué precio, Cuándo, Por qué canal).
EXPERIMENTOS: 1 prueba ágil de 2 semanas con métrica de éxito.
DATOS QUE FALTAN: Los 3 datos más urgentes a cargar en el sistema para mejorar el próximo análisis.`;

      const respuesta = await askClaude({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 5000,
      });
      const text = respuesta || 'No se pudo generar el diagnóstico.';

      setAiInsights(prev => ({ ...prev, [m.key]: text }));
      setChatMessages(prev => ({ ...prev, [m.key]: [{ role: 'user', content: prompt }, { role: 'assistant', content: text }] }));
      setInsightModal({ title: `Diagnóstico Estratégico: ${m.label}`, content: text, monthKey: m.key });
    } catch (err) {
      console.error('Error:', err);
      alert(`⚠️ ${err.message}`);
    } finally {
      setAnalyzingMonth(null);
    }
  };

  const enviarPregunta = async () => {
    if (!chatInput.trim() || !insightModal) return;
    const monthKey = insightModal.monthKey;
    const pregunta = chatInput.trim();
    const historialPrevio = chatMessages[monthKey] || [];
    const nuevoHistorial = [...historialPrevio, { role: 'user', content: pregunta }];

    setChatMessages(prev => ({ ...prev, [monthKey]: nuevoHistorial }));
    setChatInput('');
    setChatLoading(true);

    try {
      const texto = await askClaude({
        messages: nuevoHistorial,
        maxTokens: 40000,
        effort: 'medium',
      });
      const respuesta = texto || 'No se pudo generar una respuesta.';

      setChatMessages(prev => ({ ...prev, [monthKey]: [...nuevoHistorial, { role: 'assistant', content: respuesta }] }));
    } catch (err) {
      console.error('Error:', err);
      alert(`⚠️ ${err.message}`);
    } finally {
      setChatLoading(false);
    }
  };

  const initMonthObj = (keyStr) => {
    const [y, m] = keyStr.split('-');
    const mName = MONTHS[parseInt(m, 10) - 1] || m;
    return {
      key: keyStr, label: `${mName} ${y}`, total: 0, paid: 0, count: 0, occupiedNights: 0, trueRevenue: 0,
      bookedNights: 0, bookedRevenue: 0,
      pmTotals: { efectivo: 0, transferencia: 0, debito: 0, credito: 0, vcc: 0, otro: 0 },
      srcTotals: { Booking: 0, 'Directo-Puerta': 0, 'Directo-Celular': 0, Redes: 0 },
      dow: { entre: { revenue: 0, nights: 0 }, finde: { revenue: 0, nights: 0 } },
      rooms: { matrimonial: { revenue: 0, nights: 0 }, king: { revenue: 0, nights: 0 }, compartidas: { revenue: 0, nights: 0 } },
      gastos: 0
    };
  };

  const baseStats = {};
  baseStats[currentMonthKey] = initMonthObj(currentMonthKey);

  const todayKey = fmt(TODAY);
  const nightsByMonth = {}; // 'YYYY-MM' → [{ day, finde, room, rev }] (solo noches hasta hoy)
  const monthlyStats = reservations.reduce((acc, r) => {
    if (r.status === 'cancelada' || !r.checkIn) return acc;
    
    const [y, m] = r.checkIn.split('-');
    const key = `${y}-${m}`;
    if (!acc[key]) acc[key] = initMonthObj(key);

    const tAmt = r.totalAmount || 0;
    acc[key].total += tAmt; 
    acc[key].paid += (r.paid || 0);
    acc[key].count += 1;

    const nights = diffDays(r.checkIn, r.checkOut);
    if (nights > 0) {
      const avgDailyRate = tAmt / nights;

      for (let i = 0; i < nights; i++) {
        const currentNight = addDays(parseD(r.checkIn), i); 
        const nightMonthKey = `${currentNight.getFullYear()}-${String(currentNight.getMonth() + 1).padStart(2, '0')}`;
        
        if (!acc[nightMonthKey]) acc[nightMonthKey] = initMonthObj(nightMonthKey);
        
        // Lo reservado cuenta para todo el mes; las métricas, solo hasta hoy.
        acc[nightMonthKey].bookedNights += 1;
        acc[nightMonthKey].bookedRevenue += avgDailyRate;
        if (fmt(currentNight) > todayKey) continue;

        acc[nightMonthKey].occupiedNights += 1;
        acc[nightMonthKey].trueRevenue += avgDailyRate;

        const dayOfWeek = currentNight.getDay();
        const isWeekend = isFindeDow(dayOfWeek);

        // Índice por noche, para comparar un mes contra el anterior en el mismo tramo de días
        if (!nightsByMonth[nightMonthKey]) nightsByMonth[nightMonthKey] = [];
        nightsByMonth[nightMonthKey].push({ day: currentNight.getDate(), finde: isWeekend, room: r.room, rev: avgDailyRate });

        if (isWeekend) {
           acc[nightMonthKey].dow.finde.revenue += avgDailyRate;
           acc[nightMonthKey].dow.finde.nights += 1;
        } else {
           acc[nightMonthKey].dow.entre.revenue += avgDailyRate;
           acc[nightMonthKey].dow.entre.nights += 1;
        }

        if (r.room === 'P6') {
           acc[nightMonthKey].rooms.matrimonial.revenue += avgDailyRate;
           acc[nightMonthKey].rooms.matrimonial.nights += 1;
        } else if (r.room === 'P4') {
           acc[nightMonthKey].rooms.king.revenue += avgDailyRate;
           acc[nightMonthKey].rooms.king.nights += 1;
        } else if (['P1', 'P2', 'P3', 'P5'].includes(r.room)) {
           acc[nightMonthKey].rooms.compartidas.revenue += avgDailyRate;
           acc[nightMonthKey].rooms.compartidas.nights += 1;
        }
      }
    }

    const pm = r.paymentMethod || 'efectivo';
    if (acc[key].pmTotals[pm] !== undefined) acc[key].pmTotals[pm] += tAmt;
    else acc[key].pmTotals['otro'] += tAmt;

    const src = r.source || 'Directo-Puerta';
    if (acc[key].srcTotals[src] !== undefined) acc[key].srcTotals[src] += tAmt;

    return acc;
  }, baseStats);

  gastos.forEach(g => {
    if (!g.fecha) return; 
    const [y, m] = g.fecha.split('-');
    const key = `${y}-${m}`;
    if (!monthlyStats[key]) monthlyStats[key] = initMonthObj(key);
    monthlyStats[key].gastos += Number(g.monto);
  });

  const monthlyArray = Object.values(monthlyStats).sort((a, b) => b.key.localeCompare(a.key));

  const totalRooms = properties.reduce((s, p) => s + (p.rooms || 1), 0);

  // RevPAR de un mes contando solo las noches del 1 al `upToDay`
  const revparFor = (key, upToDay) => {
    const [y, mo] = key.split('-').map(Number);
    let dEntre = 0, dFinde = 0;
    for (let i = 1; i <= upToDay; i++) {
      if (isFindeDow(new Date(y, mo - 1, i).getDay())) dFinde++; else dEntre++;
    }
    const s = { all: 0, entre: 0, finde: 0, mat: 0, king: 0, comp: 0 };
    (nightsByMonth[key] || []).forEach((n) => {
      if (n.day > upToDay) return;
      s.all += n.rev;
      if (n.finde) s.finde += n.rev; else s.entre += n.rev;
      if (n.room === 'P6') s.mat += n.rev;
      else if (n.room === 'P4') s.king += n.rev;
      else if (['P1', 'P2', 'P3', 'P5'].includes(n.room)) s.comp += n.rev;
    });
    const div = (a, b) => (b > 0 ? Math.round(a / b) : 0);
    return {
      has: s.all > 0,
      revpar: div(s.all, totalRooms * upToDay),
      entre: div(s.entre, totalRooms * dEntre),
      finde: div(s.finde, totalRooms * dFinde),
      mat: div(s.mat, upToDay),
      king: div(s.king, upToDay),
      comp: div(s.comp, 4 * upToDay),
    };
  };

  useEffect(() => {
    setTimeout(() => {
      const el = document.getElementById(`month-${currentMonthKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, [currentMonthKey]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}>Finanzas</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {user?.role === 'admin' && deleted.length > 0 && (
            <button
              onClick={() => setShowTrash((x) => !x)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                background: showTrash ? '#FEF2F2' : '#F3F4F6',
                border: `1.5px solid ${showTrash ? '#FECACA' : '#E5E7EB'}`,
                borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                cursor: 'pointer', color: showTrash ? '#DC2626' : '#6B7280',
              }}
            >
              🗑 Papelera {deleted.length > 0 && ( <span style={{ background: '#DC2626', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{deleted.length}</span> )}
            </button>
          )}
          <button
            onClick={() => exportToExcel(reservations, properties)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: '#ECFDF5', border: '1.5px solid #6EE7B7', borderRadius: 8,
              fontFamily: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#065F46',
            }}
          >
            📥 Exportar Excel
          </button>
        </div>
      </div>

      {/* MÓDULO DE EGRESOS */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #E5E7EB', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,.02)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: '#374151' }}>💸 Módulo de Egresos</h3>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          
          <form onSubmit={handleGuardarGasto} style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 10, background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #F0F0F0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Fecha</label>
                <input type="date" value={formGasto.fecha} onChange={(e) => setFormGasto({ ...formGasto, fecha: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, fontFamily: 'inherit' }} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Monto $</label>
                <input type="number" placeholder="0.00" value={formGasto.monto} onChange={(e) => setFormGasto({ ...formGasto, monto: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, fontFamily: 'inherit' }} required />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Categoría</label>
              <select value={formGasto.categoria} onChange={(e) => setFormGasto({ ...formGasto, categoria: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Sueldos">Sueldos</option>
                <option value="Insumos">Insumos (Limpieza/Desayuno)</option>
                <option value="Servicios">Servicios (Luz/Agua/Internet)</option>
                <option value="Impuestos">Impuestos</option>
                <option value="Comisiones">Comisiones (Booking/OTA)</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Concepto / Notas</label>
              <input type="text" placeholder="Ej. Pintura pasillo..." value={formGasto.notas} onChange={(e) => setFormGasto({ ...formGasto, notas: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, fontFamily: 'inherit' }} required />
            </div>
            <button disabled={guardandoGasto} type="submit" style={{ marginTop: 4, width: '100%', padding: '10px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: guardandoGasto ? 'not-allowed' : 'pointer', opacity: guardandoGasto ? 0.7 : 1 }}>
              {guardandoGasto ? 'Cargando...' : '+ Registrar Gasto'}
            </button>
          </form>

          <div style={{ flex: '2 1 350px', maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
             {gastos.length === 0 ? (
               <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px 0', fontSize: 12 }}>No hay egresos registrados.</div>
             ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                 {gastos.map(g => (
                   <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA', border: '1px solid #F0F0F0', borderRadius: 8, padding: '10px 12px' }}>
                     <div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                         <span style={{ fontSize: 11, fontWeight: 800, color: '#991B1B', background: '#FEE2E2', padding: '2px 6px', borderRadius: 4 }}>{g.categoria}</span>
                         <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{fmtD(g.fecha)}</span>
                       </div>
                       <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{g.notas}</div>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                       <span style={{ fontWeight: 800, color: '#EF4444', fontSize: 14 }}>-{currency(g.monto)}</span>
                       <button onClick={() => eliminarGasto(g.id)} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}>×</button>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#374151' }}>Reporte Mensual (Rendimiento y GOPPAR)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16, marginBottom: 28 }}>
        {monthlyArray.map((m) => {
          const saldo = m.total - m.paid;
          const pct = m.total > 0 ? Math.round((m.paid / m.total) * 100) : 0;
          const isCurrent = m.key === currentMonthKey;

          const [yStr, mStr] = m.key.split('-');
          const daysInMonth = new Date(parseInt(yStr), parseInt(mStr), 0).getDate();
          const isFuture = m.key > currentMonthKey;
          const passedDays = isFuture ? 0 : isCurrent ? TODAY.getDate() : daysInMonth;
          
          const availableNights = totalRooms * passedDays;
          const occPct = availableNights > 0 ? Math.min(100, Math.round((m.occupiedNights / availableNights) * 100)) : 0;
          const bookedPct = Math.min(100, Math.round((m.bookedNights / (totalRooms * daysInMonth)) * 100));
          const adr = m.occupiedNights > 0 ? Math.round(m.trueRevenue / m.occupiedNights) : 0;
          // RevPAR (global, por tipo de día y por tipo de habitación) y el del mes anterior en el mismo tramo
          const rp = revparFor(m.key, passedDays);
          const revpar = rp.revpar;
          const [py, pmo] = parseInt(mStr) === 1 ? [parseInt(yStr) - 1, 12] : [parseInt(yStr), parseInt(mStr) - 1];
          const prevKey = `${py}-${String(pmo).padStart(2, '0')}`;
          const prevDays = new Date(py, pmo, 0).getDate();
          const prevUpTo = isCurrent ? Math.min(passedDays, prevDays) : prevDays;
          const prev = revparFor(prevKey, prevUpTo);
          const showCmp = !isFuture && passedDays > 0 && prev.has;
          const cmpLabel = isCurrent ? `${MONTH_NAMES[pmo - 1]}, del 1 al ${prevUpTo}` : MONTH_NAMES[pmo - 1];

          // Rentabilidad
          const netProfit = m.trueRevenue - m.gastos;
          const goppar = availableNights > 0 ? Math.round(netProfit / availableNights) : 0;

          // Segmentación DoW
          let availEntre = 0, availFinde = 0;
          for (let i = 1; i <= passedDays; i++) {
             const d = new Date(parseInt(yStr), parseInt(mStr) - 1, i).getDay();
             if (isFindeDow(d)) availFinde++; else availEntre++;
          }
          const availNightsEntre = totalRooms * availEntre;
          const availNightsFinde = totalRooms * availFinde;
          const revparEntre = rp.entre;
          const revparFinde = rp.finde;

          // Proyección del mes actual: cada tipo de día sigue a su ritmo hasta hoy.
          const showProjection = isCurrent && passedDays >= PROJECTION_START_DAY;
          let projectedPct = null, projectedRevenue = null;
          if (showProjection) {
            let restEntre = 0, restFinde = 0;
            for (let i = passedDays + 1; i <= daysInMonth; i++) {
              const d = new Date(parseInt(yStr), parseInt(mStr) - 1, i).getDay();
              if (isFindeDow(d)) restFinde++; else restEntre++;
            }
            const extraNights =
              (restEntre * totalRooms * m.dow.entre.nights) / availNightsEntre +
              (restFinde * totalRooms * m.dow.finde.nights) / availNightsFinde;
            const extraRevenue =
              (restEntre * totalRooms * m.dow.entre.revenue) / availNightsEntre +
              (restFinde * totalRooms * m.dow.finde.revenue) / availNightsFinde;

            const projectedNights = Math.max(m.bookedNights, m.occupiedNights + extraNights);
            projectedPct = Math.min(100, Math.round((projectedNights / (totalRooms * daysInMonth)) * 100));
            projectedRevenue = Math.round(Math.max(m.bookedRevenue, m.trueRevenue + extraRevenue));
          }

          // Segmentación Tipos de Habitación
          const aMat = 1 * passedDays, aKing = 1 * passedDays, aComp = 4 * passedDays;
          const rMat = rp.mat, rKing = rp.king, rComp = rp.comp;
          const oMat = aMat > 0 ? Math.min(100, Math.round((m.rooms.matrimonial.nights / aMat)*100)) : 0;
          const oKing = aKing > 0 ? Math.min(100, Math.round((m.rooms.king.nights / aKing)*100)) : 0;
          const oComp = aComp > 0 ? Math.min(100, Math.round((m.rooms.compartidas.nights / aComp)*100)) : 0;

          return (
            <div key={m.key} id={`month-${m.key}`} style={{ background: isCurrent ? '#EFF6FF' : '#fff', borderRadius: 12, padding: '16px', border: isCurrent ? '2px solid #3B82F6' : '1px solid #F0F0F0', boxShadow: isCurrent ? '0 4px 12px rgba(59,130,246,0.15)' : 'none', position: 'relative' }}>
              {isCurrent && <div style={{ position: 'absolute', top: -10, right: 16, background: '#3B82F6', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mes Actual</div>}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: isCurrent ? '#1E40AF' : '#111', textTransform: 'capitalize' }}>{m.label}</div>
                <div style={{ fontSize: 11, color: isCurrent ? '#60A5FA' : '#9CA3AF', fontWeight: 600 }}>{m.count} reservas</div>
              </div>

              {/* ── KPI HOTELEROS: OCUPACIÓN Y ADR ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ textAlign: 'center', background: isCurrent ? '#DBEAFE' : '#F8FAFC', padding: '10px 6px', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: isCurrent ? '#1E40AF' : '#64748B', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>{isCurrent ? 'Ocupación a hoy' : 'Ocupación'}</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: isFuture ? '#9CA3AF' : occPct >= 70 ? '#10B981' : occPct >= 40 ? '#F59E0B' : '#EF4444' }}>{isFuture ? '—' : `${occPct}%`}</div>
                  <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: 600 }}>Física</div>
                </div>
                <div title="Tarifa Promedio Diaria" style={{ textAlign: 'center', background: isCurrent ? '#DBEAFE' : '#F8FAFC', padding: '10px 6px', borderRadius: 8, cursor: 'help' }}>
                  <div style={{ fontSize: 10, color: isCurrent ? '#1E40AF' : '#64748B', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>ADR</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#374151' }}><CountUp value={currency(adr)} /></div>
                  <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: 600 }}>Tarifa Promedio</div>
                </div>
              </div>

              {(isCurrent || isFuture) && (
                <div style={{ fontSize: 12, background: isCurrent ? '#DBEAFE' : '#F8FAFC', padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: isCurrent ? '#1E40AF' : '#4B5563', fontWeight: 700 }}>Reservado del mes:</span>
                    <span style={{ fontWeight: 800, color: '#111' }}>{bookedPct}% · {currency(m.bookedRevenue)}</span>
                  </div>
                  {isCurrent && (
                    <div title="Estimación según el ritmo de Lun-Mié y Jue-Dom hasta hoy" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <span style={{ color: '#1E40AF', fontWeight: 700 }}>Proyectado del mes:</span>
                      {showProjection
                        ? <span style={{ fontWeight: 800, color: '#111' }}>{projectedPct}% · {currency(projectedRevenue)}</span>
                        : <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textAlign: 'right' }}>Disponible desde el día {PROJECTION_START_DAY}</span>}
                    </div>
                  )}
                </div>
              )}

              {/* RENTABILIDAD & GOPPAR */}
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, border: '1px solid #E5E7EB', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#4B5563', fontWeight: 600 }}>{isCurrent ? 'Ingreso a Hoy:' : 'Ingreso Base Real:'}</span>
                  <span style={{ fontWeight: 800, color: '#111' }}><CountUp value={currency(m.trueRevenue)} /></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #E2E8F0' }}>
                  <span style={{ color: '#4B5563', fontWeight: 600 }}>Egresos Operativos:</span>
                  <span style={{ fontWeight: 800, color: '#EF4444' }}>-<CountUp value={currency(m.gastos)} /></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#047857', background: '#D1FAE5', padding: '2px 8px', borderRadius: 6 }}>GANANCIA NETA</span>
                  <span style={{ fontWeight: 900, fontSize: 15, color: '#065F46' }}><CountUp value={currency(netProfit)} /></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Ind. GOPPAR</span>
                  <span style={{ fontWeight: 800, fontSize: 12, color: '#3B82F6' }}><CountUp value={currency(goppar)} /></span>
                </div>
              </div>

              {/* ── RENDIMIENTO: REVPAR SEGMENTADO Y GLOBAL ── */}
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', border: '1px solid #E5E7EB', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>RevPAR Segmentado</span>
                  <span style={{ fontSize: 9, color: '#9CA3AF' }}>Ingreso x Hab.</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <div style={{ background: '#FFFBEB', border: '1px solid #FEF3C7', padding: '8px 4px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#D97706', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>Lun - Mié</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#92400E' }}><CountUp value={currency(revparEntre)} /></div>
                    {showCmp && <div style={{ marginTop: 2 }}><Delta cur={revparEntre} prev={prev.entre} /></div>}
                  </div>
                  <div style={{ background: '#F5F3FF', border: '1px solid #EDE9FE', padding: '8px 4px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#7C3AED', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>Jue - Dom</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#5B21B6' }}><CountUp value={currency(revparFinde)} /></div>
                    {showCmp && <div style={{ marginTop: 2 }}><Delta cur={revparFinde} prev={prev.finde} /></div>}
                  </div>
                  <div title="Ingreso por Habitación Disponible" style={{ background: isCurrent ? '#DBEAFE' : '#fff', border: `1px solid ${isCurrent ? '#BFDBFE' : '#E5E7EB'}`, padding: '8px 4px', borderRadius: 8, textAlign: 'center', cursor: 'help' }}>
                    <div style={{ fontSize: 9, color: isCurrent ? '#1E40AF' : '#4B5563', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>Global</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: isCurrent ? '#1D4ED8' : '#111' }}><CountUp value={currency(revpar)} /></div>
                    {showCmp && <div style={{ marginTop: 2 }}><Delta cur={revpar} prev={prev.revpar} /></div>}
                  </div>
                </div>
                {showCmp && <CmpTitle label={cmpLabel} />}
              </div>

              {/* DESGLOSE DE INVENTARIO */}
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', border: '1px solid #E5E7EB', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Segmentación Física</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, alignItems: 'center' }}>
                  <span style={{ color: '#4B5563', fontWeight: 600 }}>Habitaciones 1, 2, 3 y 5</span>
                  <div style={{ textAlign: 'right' }}><span style={{ color: oComp > 60 ? '#10B981' : '#F59E0B', fontWeight: 800, marginRight: 6 }}><CountUp value={oComp + '%'} /></span><span style={{ fontWeight: 700, color: '#111' }}>{currency(rComp)}</span>{showCmp && <Delta cur={rComp} prev={prev.comp} style={{ display: 'inline-block', minWidth: 40, textAlign: 'right', marginLeft: 6 }} />}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, alignItems: 'center' }}>
                  <span style={{ color: '#4B5563', fontWeight: 600 }}>Habitación 4</span>
                  <div style={{ textAlign: 'right' }}><span style={{ color: oKing > 60 ? '#10B981' : '#F59E0B', fontWeight: 800, marginRight: 6 }}><CountUp value={oKing + '%'} /></span><span style={{ fontWeight: 700, color: '#111' }}>{currency(rKing)}</span>{showCmp && <Delta cur={rKing} prev={prev.king} style={{ display: 'inline-block', minWidth: 40, textAlign: 'right', marginLeft: 6 }} />}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, alignItems: 'center' }}>
                  <span style={{ color: '#4B5563', fontWeight: 600 }}>Habitación 6</span>
                  <div style={{ textAlign: 'right' }}><span style={{ color: oMat > 60 ? '#10B981' : '#F59E0B', fontWeight: 800, marginRight: 6 }}><CountUp value={oMat + '%'} /></span><span style={{ fontWeight: 700, color: '#111' }}>{currency(rMat)}</span>{showCmp && <Delta cur={rMat} prev={prev.mat} style={{ display: 'inline-block', minWidth: 40, textAlign: 'right', marginLeft: 6 }} />}</div>
                </div>
                {showCmp && <CmpTitle label={cmpLabel} />}
              </div>

              {/* FLUJO DE CAJA (FACTURADO) */}
              <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: '#6B7280', fontWeight: 600 }}>Flujo Facturado:</span>
                  <span style={{ fontWeight: 700, color: '#111' }}>{currency(m.total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: '#6B7280', fontWeight: 600 }}>Cobrado:</span>
                  <span style={{ fontWeight: 700, color: '#10B981' }}>{currency(m.paid)}</span>
                </div>
                <div style={{ height: 4, background: '#F3F4F6', borderRadius: 4, marginBottom: 8 }}>
                  <div style={{ height: '100%', background: '#10B981', borderRadius: 4, width: `${pct}%` }} />
                </div>
              </div>

              {/* ── REVENUE INTELLIGENCE (IA) ── */}
              <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: 14, marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ✨ Asesor Estratégico IA
                  </div>
                  {!aiInsights[m.key] ? (
                    <button
                      onClick={() => analizarRevenue(m, { trueRevenue: Math.round(m.trueRevenue), bookedRevenue: Math.round(m.bookedRevenue), bookedPct, projectedPct, projectedRevenue, gastos: m.gastos, occPct, adr, revpar, goppar, revparEntre, revparFinde, oMat, oKing, oComp, prevCmp: showCmp ? { label: cmpLabel, revpar: prev.revpar, entre: prev.entre, finde: prev.finde } : null })}
                      disabled={analyzingMonth === m.key}
                      style={{
                        background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: analyzingMonth === m.key ? 'wait' : 'pointer', opacity: analyzingMonth === m.key ? 0.7 : 1
                      }}
                    >
                      {analyzingMonth === m.key ? 'Analizando...' : 'Generar Diagnóstico'}
                    </button>
                  ) : (
                    <button
                    onClick={() => setInsightModal({ title: `Diagnóstico de ${m.label}`, content: aiInsights[m.key], monthKey: m.key })}
                      style={{
                        background: '#4F46E5', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 4px rgba(79,70,229,.3)'
                      }}
                    >
                      📖 Leer Diagnóstico
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#374151' }}>Totales por Propiedad</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {properties.map((prop) => {
          const pRes = reservations.filter((r) => r.propertyId === prop.id && r.status !== 'cancelada');
          const total = pRes.reduce((s, r) => s + r.totalAmount, 0);
          const paid = pRes.reduce((s, r) => s + r.paid, 0);
          const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
          return (
            <div key={prop.id} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #F0F0F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 22 }}>{prop.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{prop.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{pRes.length} reservas históricas</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#111' }}><CountUp value={currency(total)} /></div>
                  <div style={{ fontSize: 11, color: total - paid > 0 ? '#EF4444' : '#10B981' }}>Pendiente: {currency(total - paid)}</div>
                </div>
              </div>
              <div style={{ height: 6, background: '#F3F4F6', borderRadius: 4 }}>
                <div style={{ height: '100%', background: prop.color, borderRadius: 4, width: pct + '%', transition: 'width .3s' }} />
              </div>
            </div>
          );
        })}
      </div>

      <h3 id="seccion-saldos-pendientes" style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#374151' }}>Huéspedes con saldos pendientes</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pending.map((r, liI) => {
          const prop = properties.find((p) => p.id === r.propertyId);
          return (
            <div className="li-in" key={r.id} onClick={() => onGoTo && onGoTo('abrir_reserva', r)} style={{ '--i': liI, background: '#fff', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #F0F0F0', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{r.guestName}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{prop?.name} · CI: {fmtD(r.checkIn)}</div>
              </div>
              <div style={{ fontWeight: 800, color: '#EF4444', fontSize: 16 }}>{currency(r.totalAmount - r.paid)}</div>
            </div>
          );
        })}
        {pending.length === 0 && <div style={{ textAlign: 'center', color: '#D1D5DB', padding: 30, fontSize: 13 }}>✅ Sin saldos pendientes</div>}
      </div>

      {/* ── POP-UP DEL DIAGNÓSTICO IA ── */}
      <AnimatePresence>{insightModal && (
        <Backdrop key="insight" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <PopCard style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.3)' }}>
            
            {/* ENCABEZADO FIJO */}
            <div style={{ background: '#EEF2FF', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #C7D2FE', flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#312E81', display: 'flex', alignItems: 'center', gap: 8 }}>
                ✨ {insightModal.title}
              </div>
              <button onClick={() => setInsightModal(null)} style={{ background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer', color: '#4F46E5', lineHeight: 1 }}>×</button>
            </div>
            
                        {/* ÁREA DE LECTURA CON SCROLL BLINDADO */}
            <div style={{ padding: '24px 20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', flex: 1 }}>
              {insightModal.content}

              {(chatMessages[insightModal.monthKey] || []).slice(2).map((msg, i) => (
                <div key={i} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #E5E7EB' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: msg.role === 'user' ? '#4F46E5' : '#059669', textTransform: 'uppercase', marginBottom: 4 }}>
                    {msg.role === 'user' ? 'Tu pregunta' : 'Respuesta'}
                  </div>
                  <div>{msg.content}</div>
                </div>
              ))}

              {chatLoading && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #E5E7EB', color: '#9CA3AF', fontStyle: 'italic' }}>
                  Pensando...
                </div>
              )}
            </div>

            {/* PIE DE PÁGINA FIJO */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #F0F0F0', background: '#F8FAFC', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Preguntale algo a Claude sobre este diagnóstico..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !chatLoading) enviarPregunta(); }}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit' }}
                />
                <button
                  onClick={enviarPregunta}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{ background: '#4F46E5', color: '#fff', padding: '10px 16px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: chatLoading ? 'wait' : 'pointer', fontSize: 13, opacity: (chatLoading || !chatInput.trim()) ? 0.6 : 1 }}
                >
                  Preguntar
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setInsightModal(null)} style={{ background: 'transparent', color: '#6B7280', padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  Cerrar
                </button>
              </div>
            </div>

          </PopCard>
        </Backdrop>
      )}</AnimatePresence>
    </div>
  );
}
