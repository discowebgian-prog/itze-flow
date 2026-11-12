/* eslint-disable */
// @ts-nocheck
import { useState, useEffect } from 'react';
import { TODAY, fmt, fmtD, addDays, diffDays, parseD, currency, MONTHS } from '../lib/dates';
import { askClaude } from '../lib/claude';
import { exportToExcel } from '../lib/excel';
import { Modal } from '../components/ui/Modal';
import { Respaldos } from '../components/Respaldos';
import { Egresos } from '../components/Egresos';
import { supabase } from '../lib/supabase';
import { isFindeDow, roomTypeOf, nightPrice } from '../lib/rates';
import { ROOMS } from '../lib/constants';
import { AnimatePresence } from 'motion/react';
import { Backdrop, PopCard, CountUp, Collapse } from '../components/ui/Motion';
import { InfoTip } from '../components/ui/InfoTip';
import { Icon, ic } from '../components/ui/Icon';
import { notify, notifyError, financeReading, paxReading, cobrosReading } from '../lib/voice';
import { esDueno } from '../lib/roles';
import { PAX_TYPES, paxStats, paxAvg, paxPct, paxStrategy } from '../lib/paxStrategy';
import { eventosEntre } from '../lib/eventos';
import { competenciaParaAsesor } from '../components/TarifasExtras';
import { cobrosMes, cobrosParaAsesor, PAGOS } from '../lib/huespedesCobros';

// Títulos de sección (estilo Limpieza: grandes, con ícono)
const H3 = { margin: '0 0 12px', fontSize: 20, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 8 };
// "vie 6 nov"
const shortDay = (d) => (d ? parseD(d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '').replace(' de ', ' ') : '');

const PROJECTION_START_DAY = 8; // Antes hay muy pocos días para estimar


const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Título de las flechas de comparación, al pie de cada recuadro
function CmpTitle({ label }) {
  return (
    <div style={{ marginTop: 8, paddingTop: 7, borderTop: '1px solid var(--line)', fontSize: 10.5, color: 'var(--mut)', fontWeight: 600, textAlign: 'center' }}>
      ▲▼ Comparado con el mes anterior <span style={{ fontWeight: 600, color: 'var(--mut)' }}>({label})</span>
    </div>
  );
}

// Variación contra el mes anterior: ▲ 12% (verde), ▼ 8% (rojo), = 0% (gris), — sin dato previo
function Delta({ cur, prev, style = {} }) {
  if (!prev) return <span title="El mes anterior no tuvo ingresos acá" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--mut)', ...style }}>—</span>;
  const p = Math.round(((cur - prev) / prev) * 100);
  const color = p > 0 ? 'var(--c-059669)' : p < 0 ? 'var(--red)' : 'var(--mut)';
  return (
    <span title={`Mes anterior: ${currency(prev)}`} style={{ fontSize: 10.5, fontWeight: 800, color, whiteSpace: 'nowrap', cursor: 'help', ...style }}>
      {p > 0 ? '▲' : p < 0 ? '▼' : '='} {Math.abs(p)}%
    </span>
  );
}

// ── FINANCE PAGE ──────────────────────────────────────────────────────────────
export function FinancePage({ reservations, allRes, properties, user, restoreRes, onGoTo, tarifas = [], who = '' }) {
  const [showTrash, setShowTrash] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [paxOpen, setPaxOpen] = useState({}); // mes → abierto "Personas por habitación"
  const [paxAsking, setPaxAsking] = useState(null);
  const [cobrosOpen, setCobrosOpen] = useState({}); // mes → abierta "Huéspedes y cobros" // mes al que el Asesor IA le está armando la estrategia
  const [gastos, setGastos] = useState([]);

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
  // ── PAPELERA: reservas eliminadas (la carga general no las trae; se piden al abrir) ──
  const [trash, setTrash] = useState(null); // null = todavía sin pedir
  const [restoring, setRestoring] = useState(null);
  const elimKey = (r) => {
    // fecha_eliminacion se guarda como "11/11/2026, 16:20" (hora de Progreso)
    const m = String(r.fecha_eliminacion || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')} ${m[4].padStart(2, '0')}:${m[5]}` : String(r.fecha_eliminacion || '');
  };
  const loadTrash = async () => {
    const { data, error } = await supabase.from('reservas').select('*').not('fecha_eliminacion', 'is', null).limit(300);
    if (error) { notifyError(error, 'abrir la papelera'); return; }
    setTrash((data || []).sort((a, b) => elimKey(b).localeCompare(elimKey(a))));
  };
  useEffect(() => { if (esDueno(user)) loadTrash(); }, []);
  const deleted = trash || [];
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dCorto = (d) => { const [, m, dd] = String(d || '').slice(0, 10).split('-').map(Number); return m ? `${dd} ${MES[m - 1]}` : '—'; };
  const recuperar = async (row) => {
    if (!restoreRes || restoring) return;
    setRestoring(row.id);
    const ok = await restoreRes(row);
    setRestoring(null);
    if (ok) setTrash((prev) => (prev || []).filter((x) => x.id !== row.id));
  };
  const currentMonthKey = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;

  // Gastos: primero crea los meses que falten de los gastos fijos (si el SQL no está, sigue igual) y después los trae
  const recargarGastos = async () => {
    await supabase.rpc('gastos_fijos_generar').then(() => {}, () => {});
    const { data, error } = await supabase.from('gastos').select('*').order('fecha', { ascending: false });
    if (!error && data) setGastos(data);
  };
  useEffect(() => {
    recargarGastos();
  }, []);

  // ── Datos extra para el Asesor IA, calculados con las reservas del mes ──
  // Noches de `nightsByMonth` (ocupadas hasta hoy). Lo que no se puede calcular queda vacío.
  const datosAsesor = (m) => {
    const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    const enMes = reservations.filter((r) => r.status !== 'cancelada' && r.checkIn && r.checkIn.slice(0, 7) === m.key);

    // Cuántas noches se queda la gente (reservas que entran este mes)
    const largo = { 1: 0, 2: 0, 3: 0, '4+': 0 };
    enMes.forEach((r) => {
      const n = diffDays(r.checkIn, r.checkOut);
      if (n >= 4) largo['4+']++;
      else if (n >= 1) largo[n]++;
    });
    const distribucionEstadia = enMes.length
      ? `${pct(largo[1], enMes.length)}% 1 noche, ${pct(largo[2], enMes.length)}% 2 noches, ${pct(largo[3], enMes.length)}% 3 noches, ${pct(largo['4+'], enMes.length)}% 4 o más (${enMes.length} reservas)`
      : '';

    // Ocupación y ADR por día de la semana (noches hasta hoy)
    const nights = nightsByMonth[m.key] || [];
    const [yy, mo] = m.key.split('-').map(Number);
    const days = new Date(yy, mo, 0).getDate();
    const hasta = m.key === fmt(TODAY).slice(0, 7) ? TODAY.getDate() : m.key < fmt(TODAY).slice(0, 7) ? days : 0;
    const disp = Array(7).fill(0), occ = Array(7).fill(0), rev = Array(7).fill(0);
    for (let d = 1; d <= hasta; d++) disp[new Date(yy, mo - 1, d).getDay()] += ROOMS.length;
    nights.forEach((x) => {
      const w = parseD(x.date).getDay();
      occ[w]++;
      rev[w] += x.rev;
    });
    const orden = [1, 2, 3, 4, 5, 6, 0];
    const ocupacionPorDiaSemana = hasta ? orden.filter((w) => disp[w]).map((w) => `${DOW[w]} ${pct(occ[w], disp[w])}%`).join(', ') : '';
    const adrPorDiaSemana = nights.length ? orden.filter((w) => occ[w]).map((w) => `${DOW[w]} $${Math.round(rev[w] / occ[w])}`).join(', ') : '';

    // Canales (por monto)
    const canales = Object.entries(m.srcTotals || {}).filter(([, v]) => v > 0);
    const totCan = canales.reduce((a, [, v]) => a + v, 0);
    const NOMBRE = { 'Directo-Puerta': 'Por puerta', 'Directo-Celular': 'Por celular' };
    const mixCanales = totCan ? canales.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${NOMBRE[k] || k} ${pct(v, totCan)}%`).join(', ') : '';

    // Anticipación (días entre que se cargó y la entrada); solo si la base guarda la fecha de carga
    const conFecha = enMes.filter((r) => r.createdAt);
    let anticipacionReservas = '';
    if (conFecha.length >= 3) {
      const ant = conFecha.map((r) => Math.max(0, diffDays(String(r.createdAt).slice(0, 10), r.checkIn)));
      const b = { mismo: 0, sem: 0, mes: 0, mas: 0 };
      ant.forEach((a) => (a === 0 ? b.mismo++ : a <= 7 ? b.sem++ : a <= 30 ? b.mes++ : b.mas++));
      const n = ant.length;
      anticipacionReservas = `${pct(b.mismo, n)}% el mismo día, ${pct(b.sem, n)}% 1 a 7 días antes, ${pct(b.mes, n)}% 8 a 30 días antes, ${pct(b.mas, n)}% más de 30 días (según cuándo se cargaron en el sistema; las de Booking se cargan a mano)`;
    }

    // Lo ya reservado para los próximos 30 días
    const hoy = fmt(TODAY), fin = fmt(addDays(TODAY, 30));
    let fut = 0, futE = 0, futF = 0, dispE = 0, dispF = 0;
    for (let i = 0; i < 30; i++) (isFindeDow(addDays(TODAY, i).getDay()) ? (dispF += ROOMS.length) : (dispE += ROOMS.length));
    reservations.forEach((r) => {
      if (r.status === 'cancelada' || !r.checkIn) return;
      const n = diffDays(r.checkIn, r.checkOut);
      for (let i = 0; i < n; i++) {
        const d = addDays(parseD(r.checkIn), i), k = fmt(d);
        if (k < hoy || k >= fin) continue;
        fut++;
        if (isFindeDow(d.getDay())) futF++; else futE++;
      }
    });
    const reservasYaTomadas = `Próximos 30 días: ${pct(fut, dispE + dispF)}% de ocupación ya reservada (Lun-Mié ${pct(futE, dispE)}%, Jue-Dom ${pct(futF, dispF)}%)`;

    return {
      distribucionEstadia,
      ocupacionPorDiaSemana,
      adrPorDiaSemana,
      mixCanales,
      anticipacionReservas,
      reservasYaTomadas,
      costoVariablePorNocheOcupada: m.occupiedNights > 0 && m.gastos > 0 ? Math.round(m.gastos / m.occupiedNights) : 0,
      // Comisión: lo cargado en Egresos como "Comisiones" ÷ lo facturado por Booking ese mes
      comisionPromedioPct: (() => {
        const com = gastos
          .filter((g) => g.fecha && g.fecha.slice(0, 7) === m.key && /comisi/i.test(g.categoria || ''))
          .reduce((a, g) => a + Number(g.monto || 0), 0);
        const bk = (m.srcTotals || {}).Booking || 0;
        return com > 0 && bk > 0 ? Math.round((com / bk) * 100) : 0;
      })(),
    };
  };

  const analizarRevenue = async (m, metrics) => {
    setAnalyzingMonth(m.key);
    try {
      // ============================================================
      // 1) VARIABLES DE REVENUE MANAGEMENT (EDITABLES MES A MES)
      // ============================================================
      const rmMetaOcupacion = 70; // Tu meta de ocupación, en %

      // Completar si hay eventos especiales (ej: [{ fecha: "2026-10-31", nombre: "Kitesurf Fest", tipo: "deportivo" }])
      // Eventos del radar (Inicio › Se viene) desde el 1 del mes hasta 60 días adelante; vacío si no hay
      const rmEventos = await eventosEntre(`${m.key}-01`, fmt(addDays(TODAY, 60)))
        .then((l) => l.map((e) => `${e.fecha_desde}${e.fecha_hasta && e.fecha_hasta !== e.fecha_desde ? ' a ' + e.fecha_hasta : ''}: ${e.nombre} (${e.tipo || 'evento'}, impacto ${e.impacto || 'medio'})`))
        .catch(() => []);
      
      // Completar si tenés relevamiento de la zona (ej: [{ nombre: "Hostal X", tarifaEntreSemana: 500, tarifaFinde: 900 }])
      // Competencia cargada a mano en Tarifas (vacío si no hay o falta el SQL)
      const rmCompetencia = await competenciaParaAsesor(tarifas).catch(() => []);

      // Datos extra. Lo que quede vacío o en 0, Claude lo marcará como dato faltante.
      // Se calculan solos con lo que hay en Flow (antes había que completarlos a mano y llegaban vacíos)
      const rmExtra = datosAsesor(m);

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
- RevPAR (Lun-Mié): $${metrics.revparEntre} vs RevPAR (Jue-Dom): $${metrics.revparFinde}${metrics.pot ? `
- % del potencial (ingreso de las habitaciones ÷ todas vendidas cada noche al precio del tarifario vigente): ${metrics.pot.pct}% ($${metrics.pot.earned} de $${metrics.pot.possible}) | Ocupación: ${metrics.pot.occ}% | Cobrado vs tarifario: ${metrics.pot.rate}% | Lun-Mié: ${metrics.pot.entre}% | Jue-Dom: ${metrics.pot.finde}%` : ''}${metrics.prevCmp ? `
- Mes anterior (${metrics.prevCmp.label}): RevPAR Global $${metrics.prevCmp.revpar} | Lun-Mié $${metrics.prevCmp.entre} | Jue-Dom $${metrics.prevCmp.finde}` : ''}
- Ocup. Habitaciones 1, 2, 3 y 5 (privadas): ${metrics.oComp}% | Habitación 4 (king): ${metrics.oKing}% | Habitación 6 (matrimonial): ${metrics.oMat}%${metrics.pax ? `
- Personas promedio por habitación ocupada por noche: Lun-Mié ${metrics.pax.entre} (solos ${metrics.pax.entreMix}) | Jue-Dom ${metrics.pax.finde} (solos ${metrics.pax.findeMix}) | Global ${metrics.pax.global}` : ''}
${rmBloque("- Distribución de estadía", rmExtra.distribucionEstadia)}
${rmBloque("- Ocupación por día de la semana", rmExtra.ocupacionPorDiaSemana)}
${rmBloque("- ADR por día de la semana", rmExtra.adrPorDiaSemana)}
${rmBloque("- Mix de canales de venta", rmExtra.mixCanales)}
${rmBloque("- Anticipación de reservas", rmExtra.anticipacionReservas)}
${rmBloque("- Reservas tomadas a futuro", rmExtra.reservasYaTomadas)}
${rmBloque("- Costo variable por noche", rmExtra.costoVariablePorNocheOcupada)}
${(() => { const t = cobrosParaAsesor(cobrosMes(reservations, allRes, m.key)); return t ? '\nHUÉSPEDES Y COBROS (reservas que entran en el mes):\n' + t : ''; })()}
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
      notifyError(err, 'armar el diagnóstico');
    } finally {
      setAnalyzingMonth(null);
    }
  };

  // Asesor IA: estrategia solo con los datos de personas por habitación (se puede seguir preguntando)
  const pedirEstrategiaPax = async (m, st, ideas) => {
    const key = `${m.key}-pax`;
    if (chatMessages[key]) {
      setInsightModal({ title: `Estrategia por tipo de grupo: ${m.label}`, content: chatMessages[key][1].content, monthKey: key });
      return;
    }
    setPaxAsking(m.key);
    try {
      const mix = (x) => `${paxAvg(x)} personas promedio · solos ${paxPct(x, 'solo')}%, parejas ${paxPct(x, 'pareja')}%, 3 o más ${paxPct(x, 'grupo')}% (${x.n} noches)`;
      const prompt = `Sos consultor de revenue management de Itzé Hostel Boutique, en Progreso, Yucatán (playa, a 30 min de Mérida). Tiene 6 habitaciones privadas: las 1, 2, 3 y 5 para hasta 5 personas (dos camas queen + sofá cama; la 3, dos matrimoniales + individual), la 4 para 3 (king + sofá cama) y la 6 para 2 (matrimonial). La tarifa incluye 2 personas y cada persona extra paga $200 por noche. Fin de semana = noches de jueves a domingo. Contexto del lugar: estadías cortas (no se piden mínimos de noches, no lo sugieras); ya hay tarifas diferenciadas Lun–Mié y Jue–Dom y la de Lun–Mié ya funciona como promo de pareja; ubicar a las parejas en las habitaciones chicas cuando están libres ya se hace. No sugieras lo obvio: buscá ideas que no estén ya en marcha.

QUIÉNES VINIERON EN ${m.label.toUpperCase()} (noches ocupadas hasta hoy):
- Lun-Mié: ${mix(st.entre)}
- Jue-Dom: ${mix(st.finde)}
- Global: ${mix(st.global)}
${PAX_TYPES.map(([k, label, , cap]) => `- ${label} (capacidad ${cap}): ${st.types[k].n ? paxAvg(st.types[k]) + ' personas promedio' : 'sin noches'}`).join('\n')}
- Habitaciones 1, 2, 3 y 5 vendidas a 1 o 2 personas: ${st.bigLow.n} noches (${st.bigLow.finde} de jueves a domingo), unas ${st.bigLow.beds} camas sin usar.
${ideas && ideas.length ? 'Ideas que ya le sugiere el sistema: ' + ideas.map((i) => i.title).join('; ') : ''}

TU TAREA: en texto plano (sin asteriscos ni markdown; MAYÚSCULAS para títulos y guiones para listas), máximo 450 palabras, sin introducción, en español rioplatense cálido y claro:
LO QUE DICEN ESTOS NÚMEROS: 2 o 3 lecturas sobre qué tipo de huésped viene cada parte de la semana.
ESTRATEGIA: 4 acciones concretas (a quién, qué ofrecer, a qué precio aproximado, qué días, por qué canal) para ganar más según el tipo de grupo, incluyendo cómo asignar habitaciones.
PARA LA PRÓXIMA SEMANA: 1 cosa para hacer ya.`;
      const respuesta = await askClaude({ messages: [{ role: 'user', content: prompt }], maxTokens: 3000 });
      const text = respuesta || 'No se pudo armar la estrategia.';
      setChatMessages((prev) => ({ ...prev, [key]: [{ role: 'user', content: prompt }, { role: 'assistant', content: text }] }));
      setInsightModal({ title: `Estrategia por tipo de grupo: ${m.label}`, content: text, monthKey: key });
    } catch (err) {
      notifyError(err, 'armar la estrategia');
    } finally {
      setPaxAsking(null);
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
      notifyError(err, 'responder la pregunta');
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
        nightsByMonth[nightMonthKey].push({ day: currentNight.getDate(), date: fmt(currentNight), finde: isWeekend, room: r.room, rev: avgDailyRate, pax: Math.max(1, Number(r.totalGuests) || 1) });

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

  // % del potencial (del 1 al `upToDay`): lo que ingresó en las habitaciones del hostel ÷ lo máximo posible,
  // que es todas las habitaciones vendidas cada noche al precio del tarifario que regía esa noche
  // (promo, fecha especial o Normal; precio para 2 personas). Se separa en dos causas:
  //  · ocupación: noches vendidas ÷ noches disponibles
  //  · cobrado vs lista: lo cobrado por las noches vendidas ÷ su precio de tarifario
  //    (< 100% = descuentos o promos a mano; > 100% = personas extra o late check-out)
  const potentialFor = (key, upToDay) => {
    const [y, mo] = key.split('-').map(Number);
    const priceOf = (dateStr, room) => {
      const t = roomTypeOf(room);
      return t ? nightPrice(dateStr, t.id, tarifas).price : 0;
    };
    const pos = { all: 0, entre: 0, finde: 0 };
    let missing = false; // alguna noche sin precio en Tarifas
    for (let i = 1; i <= upToDay; i++) {
      const d = new Date(y, mo - 1, i);
      const ds = fmt(d);
      const fin = isFindeDow(d.getDay());
      ROOMS.forEach((r) => {
        const v = priceOf(ds, r.id);
        if (!v) missing = true;
        pos.all += v;
        if (fin) pos.finde += v; else pos.entre += v;
      });
    }
    const got = { all: 0, entre: 0, finde: 0, list: 0, nights: 0 };
    (nightsByMonth[key] || []).forEach((n) => {
      if (n.day > upToDay || !roomTypeOf(n.room)) return;
      got.all += n.rev;
      if (n.finde) got.finde += n.rev; else got.entre += n.rev;
      got.list += priceOf(n.date, n.room);
      got.nights += 1;
    });
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
    return {
      pct: missing ? null : pct(got.all, pos.all),
      entre: missing ? null : pct(got.entre, pos.entre),
      finde: missing ? null : pct(got.finde, pos.finde),
      occ: pct(got.nights, ROOMS.length * upToDay),
      rate: missing ? null : pct(got.all, got.list),
      earned: Math.round(got.all),
      possible: Math.round(pos.all),
      missing,
    };
  };
  // Semáforo del % del potencial (a ajustar con Gian)
  const potColor = (p) =>
    p >= 65
      ? { c: 'var(--c-15803D)', bg: 'var(--c-DCFCE7)', bar: 'var(--c-22C55E)', txt: 'Bien encaminado' }
      : p >= 40
      ? { c: 'var(--c-B45309)', bg: 'var(--c-FEF3C7)', bar: 'var(--c-F59E0B)', txt: 'Se puede mejorar' }
      : { c: 'var(--c-B91C1C)', bg: 'var(--c-FEE2E2)', bar: 'var(--red)', txt: 'Muy por debajo' };

  useEffect(() => {
    setTimeout(() => {
      const el = document.getElementById(`month-${currentMonthKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, [currentMonthKey]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 30, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: 'var(--ls-title)' }}>Finanzas</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {esDueno(user) && (
            <button
              onClick={() => { if (!showTrash) loadTrash(); setShowTrash((x) => !x); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                background: showTrash ? 'var(--c-FEF2F2)' : 'var(--fill)', border: 'none',
                borderRadius: 20, fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', color: showTrash ? 'var(--red)' : 'var(--ink)',
              }}
            >
              <Icon name="trash" size={16} />
              Papelera {deleted.length > 0 && ( <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{deleted.length}</span> )}
            </button>
          )}
          {esDueno(user) && (
            <button
              onClick={() => setShowBackups(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                background: 'var(--acc-soft)', border: 'none', borderRadius: 20,
                fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--acc)',
              }}
            >
              <Icon name="shield" size={16} />
              Respaldos
            </button>
          )}
          <button
            onClick={() => exportToExcel(reservations, properties)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              background: 'var(--c-DCFCE7)', border: 'none', borderRadius: 20,
              fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--c-15803D)',
            }}
          >
            <Icon name="download" size={16} />
            Exportar Excel
          </button>
        </div>
      </div>

      <AnimatePresence>{showBackups && (
        <Modal key="respaldos" title="Respaldos" icon="shield" onClose={() => setShowBackups(false)} isMobile={typeof window !== 'undefined' && window.innerWidth < 769} tall>
          <Respaldos who={who} />
        </Modal>
      )}</AnimatePresence>

      {/* PAPELERA: reservas eliminadas, con Recuperar */}
      {showTrash && (
        <div className="ui-card pop-in" style={{ padding: '4px 0 8px', marginBottom: 24 }}>
          <h3 style={{ ...H3, margin: '14px 18px 6px' }}>
            <Icon name="trash" size={20} color="var(--red)" />Papelera
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mut)', marginLeft: 6 }}>
              {trash === null ? 'Cargando…' : deleted.length ? `${deleted.length} reserva${deleted.length > 1 ? 's' : ''} eliminada${deleted.length > 1 ? 's' : ''}` : ''}
            </span>
          </h3>
          {trash !== null && !deleted.length && (
            <div style={{ padding: '6px 18px 10px', color: 'var(--mut)', fontSize: 14.5 }}>La papelera está vacía.</div>
          )}
          {deleted.map((r, i) => (
            <div key={r.id} className="li-in" style={{ '--i': Math.min(i, 12), display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderTop: i ? '.5px solid var(--line)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>{r.huesped || 'Sin nombre'}</span>
                  {r.habitacion && <span style={{ background: 'var(--fill)', color: 'var(--ink-2)', padding: '2px 7px', borderRadius: 7, fontSize: 12, fontWeight: 700 }}>{r.habitacion}</span>}
                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{dCorto(r.fecha_ingreso)} → {dCorto(r.fecha_salida)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{currency(Number(r.monto) || 0)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 2 }}>
                  Eliminada{r.usuario_eliminacion ? ' por ' + r.usuario_eliminacion : ''}{r.fecha_eliminacion ? ' · ' + String(r.fecha_eliminacion).replace(',', '') : ''}
                </div>
              </div>
              <button
                className="tap"
                onClick={() => recuperar(r)}
                disabled={restoring === r.id}
                style={{ flexShrink: 0, border: 'none', borderRadius: 18, padding: '8px 14px', minHeight: 36, background: 'var(--acc-soft)', color: 'var(--acc)', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {restoring === r.id ? 'Recuperando…' : 'Recuperar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MÓDULO DE EGRESOS: gastos del mes y gastos fijos (src/components/Egresos.tsx) */}
      <Egresos gastos={gastos} setGastos={setGastos} recargar={recargarGastos} who={who} />

      <h3 style={H3}><Icon name="chart" size={20} color="var(--acc)" />Mes a mes</h3>
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
          const pot = passedDays > 0 ? potentialFor(m.key, passedDays) : null;
          const potPrev = passedDays > 0 ? potentialFor(prevKey, prevUpTo) : null;
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
            <div key={m.key} id={`month-${m.key}`} style={{ background: 'var(--card)', borderRadius: 'var(--r-card)', padding: '16px', boxShadow: isCurrent ? 'inset 0 0 0 2px var(--acc), var(--shadow)' : 'var(--shadow)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{ fontWeight: 'var(--w-title)', fontSize: 20, color: 'var(--ink)', textTransform: 'capitalize', letterSpacing: '-.01em' }}>{m.label}</div>
                  {isCurrent && <span style={{ background: 'var(--acc)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>Mes actual</span>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--mut)', fontWeight: 500, whiteSpace: 'nowrap' }}>{m.count} reservas</div>
              </div>

              {/* El mes en palabras (etapa 4 de la voz de Flow): arriba de los números, sin reemplazarlos */}
              {!isFuture && passedDays > 0 && (
                <div style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)', background: 'var(--acc-soft)', borderRadius: 'var(--r-item)', padding: '11px 13px', marginBottom: 14 }}>
                  <Icon name="chat" size={17} color="var(--acc)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                  {financeReading({
                    name: MONTH_NAMES[parseInt(mStr) - 1],
                    prevName: MONTH_NAMES[pmo - 1],
                    isCurrent,
                    pot,
                    potPrev,
                    occPct,
                    profit: netProfit,
                    projected: showProjection ? projectedRevenue : null,
                  })}
                  </span>
                </div>
              )}

              {/* ── KPI HOTELEROS: OCUPACIÓN Y ADR ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ textAlign: 'center', background: 'var(--inset)', padding: '10px 6px', borderRadius: 'var(--r-item)' }}>
                  <div style={{ fontSize: 10, color: 'var(--mut)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isCurrent ? 'Ocupación a hoy' : 'Ocupación'}<InfoTip k="ocupacion" /></div>
                  <div style={{ fontWeight: 'var(--w-title)', fontSize: 20, color: isFuture ? 'var(--mut)' : occPct >= 70 ? 'var(--c-10B981)' : occPct >= 40 ? 'var(--c-F59E0B)' : 'var(--red)' }}>{isFuture ? '—' : `${occPct}%`}</div>
                  <div style={{ fontSize: 9, color: 'var(--mut)', marginTop: 2, fontWeight: 600 }}>Física</div>
                </div>
                <div title="Tarifa Promedio Diaria" style={{ textAlign: 'center', background: 'var(--inset)', padding: '10px 6px', borderRadius: 'var(--r-item)', cursor: 'help' }}>
                  <div style={{ fontSize: 10, color: 'var(--mut)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ADR<InfoTip k="adr" /></div>
                  <div style={{ fontWeight: 'var(--w-title)', fontSize: 20, color: 'var(--ink)' }}><CountUp value={currency(adr)} /></div>
                  <div style={{ fontSize: 9, color: 'var(--mut)', marginTop: 2, fontWeight: 600 }}>Tarifa Promedio</div>
                </div>
              </div>

              {(isCurrent || isFuture) && (
                <div style={{ fontSize: 12, background: 'var(--inset)', padding: '10px 12px', borderRadius: 'var(--r-item)', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--ink-2)', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>Reservado del mes<InfoTip k="proyectado" />:</span>
                    <span style={{ fontWeight: 800, color: 'var(--ink)' }}>{bookedPct}% · {currency(m.bookedRevenue)}</span>
                  </div>
                  {isCurrent && (
                    <div title="Estimación según el ritmo de Lun-Mié y Jue-Dom hasta hoy" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <span style={{ color: 'var(--acc)', fontWeight: 700 }}>Proyectado del mes:</span>
                      {showProjection
                        ? <span style={{ fontWeight: 800, color: 'var(--ink)' }}>{projectedPct}% · {currency(projectedRevenue)}</span>
                        : <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--mut)', textAlign: 'right' }}>Disponible desde el día {PROJECTION_START_DAY}</span>}
                    </div>
                  )}
                </div>
              )}

              {/* RENTABILIDAD & GOPPAR */}
              <div style={{ background: 'var(--inset)', borderRadius: 'var(--r-item)', padding: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{isCurrent ? 'Ingreso a Hoy:' : 'Ingreso Base Real:'}</span>
                  <span style={{ fontWeight: 800, color: 'var(--ink)' }}><CountUp value={currency(m.trueRevenue)} /></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Egresos Operativos:</span>
                  <span style={{ fontWeight: 800, color: 'var(--red)' }}>-<CountUp value={currency(m.gastos)} /></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}><span style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-047857)', background: 'var(--c-D1FAE5)', padding: '2px 8px', borderRadius: 6 }}>GANANCIA NETA</span><InfoTip k="ganancia" /></span>
                  <span style={{ fontWeight: 'var(--w-title)', fontSize: 18, color: 'var(--c-065F46)' }}><CountUp value={currency(netProfit)} /></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center' }}>GOPPAR<InfoTip k="goppar" /></span>
                  <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--acc)' }}><CountUp value={currency(goppar)} /></span>
                </div>
              </div>

              {/* ── RENDIMIENTO: REVPAR SEGMENTADO Y GLOBAL ── */}
              <div style={{ background: 'var(--inset)', borderRadius: 'var(--r-item)', padding: '11px 12px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>RevPAR<InfoTip k="revpar" /></span>
                  <span style={{ fontSize: 9, color: 'var(--mut)' }}>Ingreso por habitación disponible</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <div style={{ background: 'var(--c-FFFBEB)', padding: '8px 4px', borderRadius: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--c-D97706)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2, minHeight: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Lun - Mié</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-92400E)' }}><CountUp value={currency(revparEntre)} /></div>
                    {showCmp && <div style={{ marginTop: 2 }}><Delta cur={revparEntre} prev={prev.entre} /></div>}
                  </div>
                  <div style={{ background: 'var(--c-F5F3FF)', padding: '8px 4px', borderRadius: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--c-7C3AED)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2, minHeight: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Jue - Dom</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-5B21B6)' }}><CountUp value={currency(revparFinde)} /></div>
                    {showCmp && <div style={{ marginTop: 2 }}><Delta cur={revparFinde} prev={prev.finde} /></div>}
                  </div>
                  <div style={{ background: 'var(--acc-soft)', padding: '8px 4px', borderRadius: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 9.5, color: 'var(--acc)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2, minHeight: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Global<InfoTip k="revpar" /></div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--acc)' }}><CountUp value={currency(revpar)} /></div>
                    {showCmp && <div style={{ marginTop: 2 }}><Delta cur={revpar} prev={prev.revpar} /></div>}
                  </div>
                </div>
                {showCmp && <CmpTitle label={cmpLabel} />}
              </div>

              {/* ── % DEL POTENCIAL ── */}
              {pot && (pot.pct !== null || pot.missing) && (() => {
                if (pot.pct === null)
                  return (
                    <div style={{ background: 'var(--inset)', borderRadius: 'var(--r-item)', padding: '11px 12px', marginBottom: 14, fontSize: 11.5, color: 'var(--mut)' }}>
                      {ic('target', 14)}Para ver el % del potencial falta el precio de alguna noche: revisá que esté cargada la tarifa Normal en Tarifas.
                    </div>
                  );
                const k = potColor(pot.pct);
                const dPts = showCmp && potPrev && potPrev.pct !== null && potPrev.earned > 0 ? pot.pct - potPrev.pct : null;
                const chip = (label, v, title) => (
                  <span title={title} style={{ background: 'var(--card)', borderRadius: 999, padding: '3px 8px', fontSize: 10.5, color: 'var(--ink-2)', fontWeight: 600, whiteSpace: 'nowrap', cursor: title ? 'help' : 'default' }}>
                    {label} <b style={{ color: 'var(--ink)' }}>{v === null ? '—' : <CountUp value={v + '%'} />}</b>
                  </span>
                );
                return (
                  <div style={{ background: 'var(--inset)', borderRadius: 'var(--r-item)', padding: '11px 12px', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{ic('target', 13, { marginRight: 4 })}% del potencial<InfoTip k="potencial" /></span>
                      <span style={{ fontSize: 9, color: 'var(--mut)' }}>{isCurrent ? `del 1 al ${passedDays}` : 'mes completo'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 28, fontWeight: 'var(--w-title)', color: k.c, minWidth: 64, lineHeight: 1 }}>
                        <CountUp value={pot.pct + '%'} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ height: 8, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, pot.pct)}%`, height: '100%', background: k.bar, borderRadius: 99, transition: 'width .8s cubic-bezier(.32,.72,0,1)' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, gap: 6 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: k.c, background: k.bg, borderRadius: 999, padding: '1px 7px' }}>{k.txt}</span>
                          {dPts !== null && (
                            <span title={`Mes anterior (${cmpLabel}): ${potPrev.pct}%`} style={{ fontSize: 9.5, fontWeight: 800, color: dPts > 0 ? 'var(--c-16A34A)' : dPts < 0 ? 'var(--red)' : 'var(--mut)', cursor: 'help' }}>
                              {dPts > 0 ? '▲' : dPts < 0 ? '▼' : '='} {Math.abs(dPts)} pts vs mes anterior
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.45 }}>
                      Ingresaron <b>{currency(pot.earned)}</b> de <b>{currency(pot.possible)}</b> posibles si todas las habitaciones se vendían cada noche al precio del tarifario.
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {chip('Ocupación', pot.occ, 'Qué parte de las noches disponibles se vendieron')}
                      {chip('Cobrado vs tarifario', pot.rate, 'Lo cobrado por las noches vendidas comparado con su precio de tarifario. Menos de 100%: descuentos o promos a mano. Más de 100%: personas extra o late check-out.')}
                      {chip('Lun–Mié', pot.entre, '% del potencial de las noches de lunes a miércoles')}
                      {chip('Jue–Dom', pot.finde, '% del potencial de las noches de jueves a domingo')}
                    </div>
                  </div>
                );
              })()}

              {/* DESGLOSE DE INVENTARIO (tocar: personas por habitación) */}
              <div
                className="tap"
                role="button"
                onClick={() => setPaxOpen((o) => ({ ...o, [m.key]: !o[m.key] }))}
                style={{ background: 'var(--inset)', borderRadius: 'var(--r-item)', padding: '11px 12px', marginBottom: 14, cursor: 'pointer' }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center' }}>Segmentación Física<InfoTip k="segmentacion" /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, alignItems: 'center' }}>
                  <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Habitaciones 1, 2, 3 y 5</span>
                  <div style={{ textAlign: 'right' }}><span style={{ color: oComp > 60 ? 'var(--c-10B981)' : 'var(--c-F59E0B)', fontWeight: 800, marginRight: 6 }}><CountUp value={oComp + '%'} /></span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{currency(rComp)}</span>{showCmp && <Delta cur={rComp} prev={prev.comp} style={{ display: 'inline-block', minWidth: 40, textAlign: 'right', marginLeft: 6 }} />}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, alignItems: 'center' }}>
                  <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Habitación 4</span>
                  <div style={{ textAlign: 'right' }}><span style={{ color: oKing > 60 ? 'var(--c-10B981)' : 'var(--c-F59E0B)', fontWeight: 800, marginRight: 6 }}><CountUp value={oKing + '%'} /></span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{currency(rKing)}</span>{showCmp && <Delta cur={rKing} prev={prev.king} style={{ display: 'inline-block', minWidth: 40, textAlign: 'right', marginLeft: 6 }} />}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, alignItems: 'center' }}>
                  <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Habitación 6</span>
                  <div style={{ textAlign: 'right' }}><span style={{ color: oMat > 60 ? 'var(--c-10B981)' : 'var(--c-F59E0B)', fontWeight: 800, marginRight: 6 }}><CountUp value={oMat + '%'} /></span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{currency(rMat)}</span>{showCmp && <Delta cur={rMat} prev={prev.mat} style={{ display: 'inline-block', minWidth: 40, textAlign: 'right', marginLeft: 6 }} />}</div>
                </div>
                {showCmp && <CmpTitle label={cmpLabel} />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--acc)' }}>
                  {ic('users', 13)}{paxOpen[m.key] ? 'Ocultar personas por habitación' : 'Ver personas por habitación'}
                  <span style={{ display: 'inline-flex', transform: paxOpen[m.key] ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .2s' }}>
                    <Icon name="chev" size={13} strokeWidth={2.5} />
                  </span>
                </div>
                <Collapse open={!!paxOpen[m.key]}>
                  {(() => {
                    const st = paxStats(nightsByMonth[m.key]);
                    if (!st.global.n)
                      return <div style={{ fontSize: 11.5, color: 'var(--mut)', marginTop: 10 }}>Todavía no hay noches ocupadas este mes.</div>;
                    const reading = paxReading(st);
                    // Mes anterior en el mismo tramo de días (como el RevPAR)
                    const stPrev = paxStats((nightsByMonth[prevKey] || []).filter((x) => x.day <= prevUpTo));
                    const hasPrev = stPrev.global.n >= 5;
                    const ideas = paxStrategy(st, { prev: hasPrev ? stPrev : null, prevLabel: cmpLabel });
                    const box = (label, s, sp, bg, c, c2) => (
                      <div style={{ background: bg, padding: '8px 4px', borderRadius: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: c, fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: c2 }}>{paxAvg(s)}</div>
                        <div style={{ fontSize: 9.5, color: c, fontWeight: 600 }}>personas</div>
                        {hasPrev && sp && sp.n > 0 && (
                          <div style={{ fontSize: 9.5, color: 'var(--mut)', fontWeight: 600, marginTop: 2 }}>antes {paxAvg(sp)}</div>
                        )}
                      </div>
                    );
                    const mix = (label, s) =>
                      s.n ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ink-2)', fontWeight: 700, marginBottom: 3 }}>
                            <span>{label}</span>
                            <span style={{ color: 'var(--mut)', fontWeight: 600 }}>{s.n} {s.n === 1 ? 'noche' : 'noches'}</span>
                          </div>
                          <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: 'var(--line)' }}>
                            <div style={{ width: paxPct(s, 'solo') + '%', background: 'var(--c-9CA3AF)' }} />
                            <div style={{ width: paxPct(s, 'pareja') + '%', background: 'var(--c-3B82F6)' }} />
                            <div style={{ width: paxPct(s, 'grupo') + '%', background: 'var(--c-10B981)' }} />
                          </div>
                          <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: 'var(--ink-2)', marginTop: 3, flexWrap: 'wrap' }}>
                            <span><b style={{ color: 'var(--c-9CA3AF)' }}>●</b> Solos {paxPct(s, 'solo')}%</span>
                            <span><b style={{ color: 'var(--c-3B82F6)' }}>●</b> Parejas {paxPct(s, 'pareja')}%</span>
                            <span><b style={{ color: 'var(--c-10B981)' }}>●</b> 3 o más {paxPct(s, 'grupo')}%</span>
                          </div>
                        </div>
                      ) : null;
                    return (
                      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', cursor: 'default' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}>Personas por habitación<InfoTip k="personas" /></span>
                          <span style={{ fontSize: 9 }}>promedio por noche</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                          {box('Lun - Mié', st.entre, stPrev.entre, 'var(--c-FFFBEB)', 'var(--c-D97706)', 'var(--c-92400E)')}
                          {box('Jue - Dom', st.finde, stPrev.finde, 'var(--c-F5F3FF)', 'var(--c-7C3AED)', 'var(--c-5B21B6)')}
                          {box('Global', st.global, stPrev.global, 'var(--acc-soft)', 'var(--acc)', 'var(--acc)')}
                        </div>
                        {mix('Lun – Mié', st.entre)}
                        {mix('Jue – Dom', st.finde)}
                        <div style={{ marginTop: 10 }}>
                          {PAX_TYPES.map(([k, label, , cap]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                              <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{label}</span>
                              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                                {st.types[k].n ? `${paxAvg(st.types[k])} personas` : 'sin noches'}
                                {st.types[k].n && cap ? <span style={{ color: 'var(--mut)', fontWeight: 600 }}> · de {cap}</span> : null}
                              </span>
                            </div>
                          ))}
                        </div>
                        {hasPrev && <div style={{ fontSize: 10, color: 'var(--mut)', marginTop: 4, textAlign: 'center' }}>"antes" = {cmpLabel}</div>}
                        {reading && (
                          <div style={{ fontSize: 12, color: 'var(--ink)', background: 'var(--card)', borderRadius: 10, padding: '8px 10px', marginTop: 8, lineHeight: 1.45 }}>
                            {reading}
                          </div>
                        )}
                        {/* Estrategia sugerida: se recalcula cada día con las noches que van pasando */}
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {ic('target', 13)}Estrategia sugerida
                          </div>
                          {ideas === null ? (
                            <div style={{ fontSize: 11.5, color: 'var(--mut)' }}>Todavía hay pocas noches para sugerir algo. Se actualiza solo cada día.</div>
                          ) : ideas.length === 0 ? (
                            <div style={{ fontSize: 11.5, color: 'var(--mut)' }}>Por ahora no hay nada para cambiar: la mezcla de huéspedes está pareja. Se actualiza solo cada día.</div>
                          ) : (
                            ideas.map((it, i) => (
                              <div key={i} style={{ display: 'flex', gap: 9, background: 'var(--card)', borderRadius: 12, padding: '9px 11px', marginBottom: 6 }}>
                                <span style={{ color: 'var(--acc)', flexShrink: 0, marginTop: 1 }}><Icon name={it.icon} size={16} /></span>
                                <div>
                                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>{it.title}</div>
                                  <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45, marginTop: 2 }}>{it.text}</div>
                                </div>
                              </div>
                            ))
                          )}
                          <button
                            type="button"
                            className="tap"
                            onClick={() => pedirEstrategiaPax(m, st, ideas)}
                            disabled={paxAsking === m.key}
                            style={{ marginTop: 4, width: '100%', background: 'var(--c-EEF2FF)', border: 'none', color: 'var(--c-4F46E5)', padding: '9px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: paxAsking === m.key ? 'wait' : 'pointer', opacity: paxAsking === m.key ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <Icon name="sparkles" size={15} />
                            {paxAsking === m.key ? 'Armando la estrategia…' : chatMessages[`${m.key}-pax`] ? 'Ver la estrategia del Asesor IA' : 'Pedirle una estrategia al Asesor IA'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </Collapse>
              </div>

              {/* HUÉSPEDES Y COBROS (plegable): cómo pagan, facturas, extras, quiénes son, lo que se perdió */}
              {(() => {
                const abierta = !!cobrosOpen[m.key];
                const c = abierta ? cobrosMes(reservations, allRes, m.key) : null;
                const cp = abierta ? cobrosMes(reservations, allRes, prevKey) : null;
                const antes = (v) => (cp && cp.n >= 3 ? <span style={{ color: 'var(--mut)', fontWeight: 600, fontSize: 10.5 }}> · antes {v}%</span> : null);
                const pc = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
                const sec = (titulo, hijos) => (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--mut)', textTransform: 'uppercase', marginBottom: 5 }}>{titulo}</div>
                    {hijos}
                  </div>
                );
                const fila = (label, valor, extra = null) => (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontWeight: 700, color: 'var(--ink)', textAlign: 'right' }}>{valor}{extra}</span>
                  </div>
                );
                return (
                  <div
                    className="tap"
                    role="button"
                    onClick={() => setCobrosOpen((o) => ({ ...o, [m.key]: !o[m.key] }))}
                    style={{ background: 'var(--inset)', borderRadius: 'var(--r-item)', padding: '11px 12px', marginBottom: 14, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center' }}>
                        Huéspedes y cobros<span onClick={(e) => e.stopPropagation()}><InfoTip k="cobros" /></span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--acc)' }}>
                        {abierta ? 'Ocultar' : 'Ver'}
                        <span style={{ display: 'inline-flex', transform: abierta ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .2s' }}>
                          <Icon name="chev" size={13} strokeWidth={2.5} />
                        </span>
                      </span>
                    </div>
                    <Collapse open={abierta}>
                      {c && (
                        <div onClick={(e) => e.stopPropagation()} style={{ cursor: 'default', paddingTop: 4 }}>
                          {!c.n && !c.cancel.n ? (
                            <div style={{ fontSize: 11.5, color: 'var(--mut)', marginTop: 8 }}>Todavía no hay reservas que entren este mes.</div>
                          ) : (
                            <>
                              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 6 }}>
                                {c.n} {c.n === 1 ? 'reserva entra' : 'reservas entran'} este mes{cp && cp.n >= 3 ? ` · "antes" = ${cmpLabel ? cmpLabel.split(',')[0] : 'mes anterior'} completo` : ''}
                              </div>
                              {sec('Cómo pagan (sobre lo cobrado)', c.cobrado > 0 ? (
                                <>
                                  <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: 'var(--line)' }}>
                                    {PAGOS.map(([k, , col]) => (c.pago[k].monto > 0 ? <div key={k} style={{ width: pc(c.pago[k].monto, c.cobrado) + '%', background: col }} /> : null))}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, color: 'var(--ink-2)', marginTop: 5 }}>
                                    {PAGOS.filter(([k]) => c.pago[k].monto > 0).map(([k, l, col]) => (
                                      <span key={k}><b style={{ color: col }}>●</b> {l} {pc(c.pago[k].monto, c.cobrado)}% · {currency(c.pago[k].monto)} ({c.pago[k].n})</span>
                                    ))}
                                  </div>
                                </>
                              ) : <div style={{ fontSize: 11.5, color: 'var(--mut)' }}>Todavía no hay cobros.</div>)}
                              {sec('Facturas y empresas', (
                                <>
                                  {fila('Pidieron factura', `${c.factura.n} · ${c.factura.pct}%`, antes(cp && cp.factura.pct))}
                                  {fila('Peso en los ingresos', `${c.factura.pctIngresos}%`)}
                                  {fila('De empresa', `${c.empresas.n} · ${c.empresas.pct}%`)}
                                  {c.empresas.top.length > 0 && (
                                    <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: -1 }}>{c.empresas.top.map(([k, v]) => `${k} (${v})`).join(' · ')}</div>
                                  )}
                                </>
                              ))}
                              {sec('Extras', (
                                <>
                                  {fila('Late check-out', `${c.late.n} · ${c.late.pct}% · ${currency(c.late.monto)}`, antes(cp && cp.late.pct))}
                                  {fila('Personas extra', `${c.extra.n} ${c.extra.n === 1 ? 'reserva' : 'reservas'} · ${currency(c.extra.monto)}`)}
                                  {fila('Extendieron estadía', c.extension.n ? `${c.extension.n} · ${c.extension.noches} ${c.extension.noches === 1 ? 'noche' : 'noches'} · ~${currency(c.extension.monto)}` : 'ninguna')}
                                </>
                              ))}
                              {sec('Quiénes son', (
                                <>
                                  {fila('Ya habían venido', `${c.repiten.n} · ${c.repiten.pct}%`, antes(cp && cp.repiten.pct))}
                                  {fila('Extranjeros', c.procedencia.conDato ? `${c.procedencia.extranjeros} · ${c.procedencia.pctExtranjeros}%` : 'sin datos', c.procedencia.conDato ? antes(cp && cp.procedencia.pctExtranjeros) : null)}
                                  {c.procedencia.top.length > 0 && (
                                    <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: -1 }}>{c.procedencia.top.map(([k, v]) => `${k} (${v})`).join(' · ')}</div>
                                  )}
                                </>
                              ))}
                              {sec('Lo que se perdió', (
                                <>
                                  {fila('Cancelaciones', `${c.cancel.n} · ${c.cancel.pct}%${c.cancel.monto ? ' · ' + currency(c.cancel.monto) : ''}`, antes(cp && cp.cancel.pct))}
                                  {c.cancel.canales.length > 0 && (
                                    <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: -1 }}>{c.cancel.canales.map(([k, v]) => `${k === 'Directo-Puerta' ? 'Por puerta' : k === 'Directo-Celular' ? 'Por celular' : k} (${v})`).join(' · ')}</div>
                                  )}
                                  {fila('Descuentos', currency(c.perdido.descuentos))}
                                  {fila('Noches gratis', currency(c.perdido.gratis))}
                                </>
                              ))}
                              {(() => {
                                const t = cobrosReading(c, cp);
                                return t ? (
                                  <div style={{ fontSize: 12, color: 'var(--ink)', background: 'var(--card)', borderRadius: 10, padding: '8px 10px', marginTop: 10, lineHeight: 1.45 }}>{t}</div>
                                ) : null;
                              })()}
                            </>
                          )}
                        </div>
                      )}
                    </Collapse>
                  </div>
                );
              })()}

              {/* FLUJO DE CAJA (FACTURADO) */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--mut)', fontWeight: 600 }}>Flujo Facturado:</span>
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{currency(m.total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--mut)', fontWeight: 600 }}>Cobrado:</span>
                  <span style={{ fontWeight: 700, color: 'var(--c-10B981)' }}>{currency(m.paid)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--inset)', borderRadius: 4, marginBottom: 8 }}>
                  <div style={{ height: '100%', background: 'var(--c-10B981)', borderRadius: 4, width: `${pct}%` }} />
                </div>
              </div>

              {/* ── REVENUE INTELLIGENCE (IA) ── */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-4F46E5)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="sparkles" size={15} />Asesor estratégico IA
                  </div>
                  {!aiInsights[m.key] ? (
                    <button
                      onClick={() => analizarRevenue(m, { pot: pot && pot.pct !== null ? pot : null, trueRevenue: Math.round(m.trueRevenue), bookedRevenue: Math.round(m.bookedRevenue), bookedPct, projectedPct, projectedRevenue, gastos: m.gastos, occPct, adr, revpar, goppar, revparEntre, revparFinde, oMat, oKing, oComp, pax: (() => { const st = paxStats(nightsByMonth[m.key]); if (!st.global.n) return null; const mx = (x) => `${paxPct(x, 'solo')}%, parejas ${paxPct(x, 'pareja')}%, 3 o más ${paxPct(x, 'grupo')}%`; return { entre: paxAvg(st.entre), finde: paxAvg(st.finde), global: paxAvg(st.global), entreMix: mx(st.entre), findeMix: mx(st.finde) }; })(), prevCmp: showCmp ? { label: cmpLabel, revpar: prev.revpar, entre: prev.entre, finde: prev.finde } : null })}
                      disabled={analyzingMonth === m.key}
                      style={{
                        background: 'var(--c-EEF2FF)', border: 'none', color: 'var(--c-4F46E5)', padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: analyzingMonth === m.key ? 'wait' : 'pointer', opacity: analyzingMonth === m.key ? 0.7 : 1
                      }}
                    >
                      {analyzingMonth === m.key ? 'Analizando…' : 'Generar diagnóstico'}
                    </button>
                  ) : (
                    <button
                    onClick={() => setInsightModal({ title: `Diagnóstico de ${m.label}`, content: aiInsights[m.key], monthKey: m.key })}
                      style={{
                        background: 'var(--c-4F46E5)', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <Icon name="book" size={15} />Leer diagnóstico
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={H3}><Icon name="building" size={20} color="var(--acc)" />Totales por propiedad</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {properties.map((prop) => {
          const pRes = reservations.filter((r) => r.propertyId === prop.id && r.status !== 'cancelada');
          const total = pRes.reduce((s, r) => s + r.totalAmount, 0);
          const paid = pRes.reduce((s, r) => s + r.paid, 0);
          const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
          return (
            <div key={prop.id} style={{ background: 'var(--card)', borderRadius: 'var(--r-card)', padding: '16px 18px', boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--acc-soft)', color: 'var(--acc)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="building" size={20} /></span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--ink)' }}>{prop.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>{pRes.length} reservas en total</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'var(--w-title)', fontSize: 20, color: 'var(--ink)' }}><CountUp value={currency(total)} /></div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: total - paid > 0 ? 'var(--red)' : 'var(--c-15803D)' }}>Pendiente: {currency(total - paid)}</div>
                </div>
              </div>
              <div style={{ height: 6, background: 'var(--inset)', borderRadius: 4 }}>
                <div style={{ height: '100%', background: prop.color, borderRadius: 4, width: pct + '%', transition: 'width .3s' }} />
              </div>
            </div>
          );
        })}
      </div>

      <h3 id="seccion-saldos-pendientes" style={H3}><Icon name="money" size={20} color="var(--red)" />Saldos pendientes</h3>
      <div className="ui-group">
        {pending.map((r, liI) => {
          const prop = properties.find((p) => p.id === r.propertyId);
          return (
            <div className="li-in ui-row" key={r.id} onClick={() => onGoTo && onGoTo('abrir_reserva', r)} style={{ '--i': liI, justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--ink)' }}>{r.guestName}</div>
                <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>{r.room ? `${r.room} · ` : ''}{shortDay(r.checkIn)} → {shortDay(r.checkOut)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--red)', fontSize: 16 }}>{currency(r.totalAmount - r.paid)}</div>
                <span style={{ color: 'var(--handle)', display: 'inline-flex' }}><Icon name="chev" size={18} strokeWidth={2.5} /></span>
              </div>
            </div>
          );
        })}
        {pending.length === 0 && <div style={{ textAlign: 'center', color: 'var(--c-15803D)', padding: 24, fontSize: 14, fontWeight: 600 }}>{ic('check', 16)}Nadie debe nada</div>}
      </div>

      {/* ── POP-UP DEL DIAGNÓSTICO IA ── */}
      <AnimatePresence>{insightModal && (
        <Backdrop key="insight" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <PopCard style={{ background: 'var(--card)', borderRadius: 22, width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.3)' }}>
            
            {/* ENCABEZADO FIJO */}
            <div style={{ background: 'var(--c-EEF2FF)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 'var(--w-title)', color: 'var(--c-312E81)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="sparkles" size={19} />{insightModal.title}
              </div>
              <button aria-label="Cerrar" onClick={() => setInsightModal(null)} style={{ background: 'rgba(79,70,229,.12)', border: 'none', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', color: 'var(--c-4F46E5)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}><Icon name="close" size={16} strokeWidth={2.5} /></button>
            </div>
            
                        {/* ÁREA DE LECTURA CON SCROLL BLINDADO */}
            <div style={{ padding: '24px 20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', flex: 1 }}>
              {insightModal.content}

              {(chatMessages[insightModal.monthKey] || []).slice(2).map((msg, i) => (
                <div key={i} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: msg.role === 'user' ? 'var(--c-4F46E5)' : 'var(--c-059669)', textTransform: 'uppercase', marginBottom: 4 }}>
                    {msg.role === 'user' ? 'Tu pregunta' : 'Respuesta'}
                  </div>
                  <div>{msg.content}</div>
                </div>
              ))}

              {chatLoading && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)', color: 'var(--mut)', fontStyle: 'italic' }}>
                  Pensando…
                </div>
              )}
            </div>

            {/* PIE DE PÁGINA FIJO */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--line)', background: 'var(--inset)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Preguntale algo a Claude sobre este diagnóstico..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !chatLoading) enviarPregunta(); }}
                  style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 'var(--r-field)', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
                />
                <button
                  onClick={enviarPregunta}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{ background: 'var(--c-4F46E5)', color: '#fff', padding: '10px 16px', borderRadius: 'var(--r-field)', border: 'none', fontWeight: 700, fontFamily: 'inherit', cursor: chatLoading ? 'wait' : 'pointer', fontSize: 14, opacity: (chatLoading || !chatInput.trim()) ? 0.6 : 1 }}
                >
                  Preguntar
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setInsightModal(null)} style={{ background: 'var(--fill)', color: 'var(--ink)', padding: '9px 18px', borderRadius: 'var(--r-field)', border: 'none', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', fontSize: 14 }}>
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
