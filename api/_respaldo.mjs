// Arma la planilla de respaldo de Flow (Excel con pestañas) a partir de las filas de la base.
// La usa api/respaldo.js. Trabaja con las columnas tal cual están en Supabase (no importa nada de src/).
//
// Pestañas: Resumen · un mes por pestaña (por fecha de entrada, sin canceladas ni eliminadas) ·
// Canceladas · Eliminadas · Huéspedes · Gastos · Movimientos de Mary · Tarifas · Todas (para restaurar)
import ExcelJS from 'exceljs';

const TZ = 'America/Merida';
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const ESTADOS = { por_llegar: 'Por llegar', hospedado: 'Hospedado', finalizada: 'Finalizada', cancelada: 'Cancelada', eliminada: 'Eliminada' };
const CANALES = { Booking: 'Booking', 'Directo-Puerta': 'Por puerta', 'Directo-Celular': 'Por celular', Redes: 'Redes' };
const PAGOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito', credito: 'Crédito', vcc: 'Tarjeta virtual (VCC)', otro: 'Otro' };
const MOVS = { nueva: 'Cargó una reserva', edicion: 'Editó una reserva', cancelacion: 'Canceló una reserva', checkin: 'Hizo el check-in', checkout: 'Hizo el check-out', cobro: 'Cobró' };
const TIPOS_TARIFA = [['privada', 'Hab. 1, 2, 3 y 5'], ['king', 'Hab. 4'], ['matrimonial', 'Hab. 6']];

// Colores (los de Flow)
const AZUL = 'FF2563EB';
const AZUL_SUAVE = 'FFEFF6FF';
const GRIS_LINEA = 'FFE5E7EB';
const RAYA = 'FFF9FAFB';
const TOTAL_BG = 'FFF3F4F6';
const COLOR_ESTADO = {
  por_llegar: 'FFDBEAFE', hospedado: 'FFD1FAE5', finalizada: 'FFF3F4F6', cancelada: 'FFFEE2E2', eliminada: 'FFFEE2E2',
};
const PESOS = '"$"#,##0;[Red]-"$"#,##0';
const FECHA = 'dd/mm/yyyy';

// ── Ayudas ────────────────────────────────────────────────────────────────────
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const txt = (v) => (v === null || v === undefined ? '' : String(v).trim());
const sinTildes = (s) => txt(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
const esSi = (v) => v === true || v === 'true';
const ymd = (s) => (/^\d{4}-\d{2}-\d{2}/.test(txt(s)) ? txt(s).slice(0, 10) : '');
// Fecha "2026-11-09" → Date que Excel muestra como 09/11/2026 (en UTC para que no se corra un día)
const aFecha = (s) => {
  const d = ymd(s);
  return d ? new Date(`${d}T00:00:00Z`) : null;
};
const noches = (a, b) => {
  const x = aFecha(a), y = aFecha(b);
  return x && y ? Math.max(0, Math.round((y - x) / 86400000)) : 0;
};
// Fecha y hora de Progreso en palabras cortas: "11/11/2026 03:00"
const horaProgreso = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return txt(iso);
  return new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(',', '');
};
export const hoyProgreso = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // 2026-11-11
const mesDe = (s) => ymd(s).slice(0, 7); // 2026-11
const nombreMes = (k) => `${MESES[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const pestanaMes = (k) => `${MES_CORTO[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const acompanantes = (v) => {
  let a = v;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { return a; } }
  return Array.isArray(a) ? a.map((p) => txt(p?.nombre || p?.name || p)).filter(Boolean).join(', ') : '';
};

// ── Estilos ───────────────────────────────────────────────────────────────────
function encabezado(ws, columnas) {
  ws.columns = columnas.map((c) => ({ key: c.key, width: c.w || 14, style: c.fmt ? { numFmt: c.fmt } : {} }));
  const fila = ws.addRow(columnas.map((c) => c.t));
  fila.height = 22;
  fila.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  if (columnas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
}

function filas(ws, columnas, datos, { colorEstado } = {}) {
  datos.forEach((d, i) => {
    const row = ws.addRow(columnas.map((c) => (d[c.key] === undefined ? '' : d[c.key])));
    row.eachCell({ includeEmpty: true }, (cell, n) => {
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RAYA } };
      cell.border = { bottom: { style: 'thin', color: { argb: GRIS_LINEA } } };
      cell.alignment = { vertical: 'top', wrapText: !!columnas[n - 1]?.wrap, horizontal: columnas[n - 1]?.center ? 'center' : undefined };
    });
    if (colorEstado && d._estado && COLOR_ESTADO[d._estado]) {
      const idx = columnas.findIndex((c) => c.key === 'estado');
      if (idx >= 0) row.getCell(idx + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ESTADO[d._estado] } };
    }
  });
}

function filaTotal(ws, columnas, valores, etiqueta = 'Total') {
  const row = ws.addRow(columnas.map((c, i) => (i === 0 ? etiqueta : valores[c.key] ?? '')));
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
    cell.border = { top: { style: 'thin', color: { argb: 'FF9CA3AF' } } };
  });
}

function vacia(ws, mensaje) {
  const r = ws.addRow([mensaje]);
  r.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
}

// ── Reservas ──────────────────────────────────────────────────────────────────
function prepararReservas(reservas) {
  const grupos = {};
  for (const r of reservas) {
    if (!r.grupo_id || r.estado === 'eliminada') continue;
    (grupos[r.grupo_id] ||= []).push(r);
  }
  const grupoTxt = (r) => {
    const g = r.grupo_id ? grupos[r.grupo_id] : null;
    if (!g || g.length < 2) return '';
    const tit = g.find((x) => esSi(x.grupo_titular)) || g[0];
    const quien = txt(tit.grupo_reservante?.huesped || tit.grupo_reservante?.nombre) || txt(tit.huesped);
    return `${quien} (${g.map((x) => x.habitacion).sort().join(', ')})`;
  };
  return reservas.map((r) => {
    const total = num(r.monto), pagado = num(r.monto_pagado);
    const late = txt(r.late_checkout_hora);
    return {
      _raw: r,
      _estado: r.estado,
      _mes: mesDe(r.fecha_ingreso),
      entrada: aFecha(r.fecha_ingreso),
      salida: aFecha(r.fecha_salida),
      noches: noches(r.fecha_ingreso, r.fecha_salida),
      habitacion: txt(r.habitacion),
      huesped: txt(r.huesped),
      personas: num(r.cantidad_huespedes) || 1,
      acompanantes: acompanantes(r.acompanantes),
      estado: ESTADOS[r.estado] || txt(r.estado),
      canal: CANALES[r.canal] || txt(r.canal),
      total,
      pagado,
      saldo: total - pagado,
      forma: PAGOS[txt(r.forma_pago).toLowerCase()] || txt(r.forma_pago),
      telefono: txt(r.telefono),
      email: txt(r.email),
      documento: [txt(r.tipo_doc), txt(r.num_doc)].filter(Boolean).join(' '),
      nacionalidad: txt(r.nacionalidad),
      factura: esSi(r.solicita_factura) ? 'Sí' : '',
      empresa: txt(r.empresa),
      grupo: grupoTxt(r),
      late: late ? `${late}${r.late_checkout_costo != null && r.late_checkout_costo !== '' ? ` · $${num(r.late_checkout_costo)}` : ''}` : '',
      notas: txt(r.notas),
      notaEquipo: txt(r.nota_equipo),
      noGrato: esSi(r.lista_negra) ? 'Sí' : '',
      cargadaPor: txt(r.cargada_por_nombre) || txt(r.usuario_carga),
      cargadaEl: txt(r.fecha_carga) ? horaProgreso(r.fecha_carga) : '',
      eliminadaEl: txt(r.fecha_eliminacion) ? horaProgreso(r.fecha_eliminacion) : '',
      eliminadaPor: txt(r.usuario_eliminacion),
      id: txt(r.id),
    };
  });
}

const COL_RES = [
  { key: 'entrada', t: 'Entrada', w: 12, fmt: FECHA },
  { key: 'salida', t: 'Salida', w: 12, fmt: FECHA },
  { key: 'noches', t: 'Noches', w: 8, center: true },
  { key: 'habitacion', t: 'Hab.', w: 7, center: true },
  { key: 'huesped', t: 'Huésped', w: 26 },
  { key: 'personas', t: 'Personas', w: 9, center: true },
  { key: 'estado', t: 'Estado', w: 12 },
  { key: 'canal', t: 'Canal', w: 12 },
  { key: 'total', t: 'Total', w: 11, fmt: PESOS },
  { key: 'pagado', t: 'Pagado', w: 11, fmt: PESOS },
  { key: 'saldo', t: 'Saldo', w: 11, fmt: PESOS },
  { key: 'forma', t: 'Forma de pago', w: 15 },
  { key: 'telefono', t: 'Teléfono', w: 16 },
  { key: 'email', t: 'Email', w: 24 },
  { key: 'documento', t: 'Documento', w: 20 },
  { key: 'nacionalidad', t: 'País', w: 6, center: true },
  { key: 'acompanantes', t: 'Acompañantes', w: 26, wrap: true },
  { key: 'grupo', t: 'Grupo', w: 22 },
  { key: 'late', t: 'Late check-out', w: 14 },
  { key: 'factura', t: 'Factura', w: 8, center: true },
  { key: 'empresa', t: 'Empresa', w: 18 },
  { key: 'notas', t: 'Notas', w: 30, wrap: true },
  { key: 'notaEquipo', t: 'Nota para el equipo', w: 24, wrap: true },
  { key: 'noGrato', t: 'No grato', w: 9, center: true },
  { key: 'cargadaPor', t: 'Cargada por', w: 14 },
  { key: 'cargadaEl', t: 'Cargada el', w: 16 },
  { key: 'id', t: 'ID', w: 14 },
];

const sumar = (lista, k) => lista.reduce((s, x) => s + num(x[k]), 0);
const porEntrada = (a, b) => (a.entrada?.getTime() || 0) - (b.entrada?.getTime() || 0) || a.habitacion.localeCompare(b.habitacion);

// ── Huéspedes (misma regla de "misma persona" que Flow: por documento; sin documento, por nombre) ──
function huespedes(prep) {
  const mapa = new Map();
  for (const r of prep) {
    if (r._estado === 'cancelada' || r._estado === 'eliminada' || !r.huesped) continue;
    const doc = sinTildes(r._raw.num_doc).replace(/[^a-z0-9]/g, '');
    const clave = doc ? `d:${doc}` : `n:${sinTildes(r.huesped)}`;
    const h = mapa.get(clave) || { visitas: new Set(), noches: 0, total: 0, primera: null, ultima: null, noGrato: false, ult: null };
    h.visitas.add(ymd(r._raw.fecha_ingreso));
    h.noches += r.noches;
    h.total += r.total;
    if (r.entrada && (!h.primera || r.entrada < h.primera)) h.primera = r.entrada;
    if (r.entrada && (!h.ultima || r.entrada >= h.ultima)) { h.ultima = r.entrada; h.ult = r; }
    if (!h.ult) h.ult = r;
    if (r.noGrato) h.noGrato = true;
    mapa.set(clave, h);
  }
  return [...mapa.values()]
    .map((h) => ({
      nombre: h.ult.huesped,
      documento: h.ult.documento,
      nacionalidad: h.ult.nacionalidad,
      telefono: h.ult.telefono,
      email: h.ult.email,
      empresa: h.ult.empresa,
      visitas: h.visitas.size,
      noches: h.noches,
      total: h.total,
      primera: h.primera,
      ultima: h.ultima,
      noGrato: h.noGrato ? 'Sí' : '',
    }))
    .sort((a, b) => (b.ultima?.getTime() || 0) - (a.ultima?.getTime() || 0));
}

// ── La planilla ───────────────────────────────────────────────────────────────
export async function armarPlanilla(datos, { ahora = new Date() } = {}) {
  const reservas = Array.isArray(datos?.reservas) ? datos.reservas : [];
  const gastos = Array.isArray(datos?.gastos) ? datos.gastos : [];
  const tarifas = Array.isArray(datos?.tarifas) ? datos.tarifas : [];
  const movs = Array.isArray(datos?.movimientos) ? datos.movimientos : [];

  const prep = prepararReservas(reservas);
  const activas = prep.filter((r) => r._estado !== 'cancelada' && r._estado !== 'eliminada');
  const canceladas = prep.filter((r) => r._estado === 'cancelada').sort((a, b) => porEntrada(b, a));
  const eliminadas = prep.filter((r) => r._estado === 'eliminada').sort((a, b) => porEntrada(b, a));
  const gente = huespedes(prep);

  const meses = [...new Set([...activas.map((r) => r._mes), ...gastos.map((g) => mesDe(g.fecha))].filter(Boolean))].sort().reverse();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Itzé Flow';
  wb.created = ahora;

  // ── Resumen ──
  const res = wb.addWorksheet('Resumen', { properties: { tabColor: { argb: AZUL } } });
  res.columns = [{ width: 24 }, { width: 11 }, { width: 10 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 11 }];
  const t = res.addRow(['Itzé Flow · Respaldo']);
  t.getCell(1).font = { bold: true, size: 18, color: { argb: AZUL } };
  res.addRow([`Hecho el ${horaProgreso(ahora)} (hora de Progreso)`]).getCell(1).font = { color: { argb: 'FF6B7280' } };
  res.addRow([]);
  const cuenta = [
    ['Reservas activas', activas.length],
    ['Canceladas', canceladas.length],
    ['Eliminadas', eliminadas.length],
    ['Huéspedes distintos', gente.length],
    ['Gastos cargados', gastos.length],
  ];
  for (const [k, v] of cuenta) {
    const r = res.addRow([k, v]);
    r.getCell(1).font = { color: { argb: 'FF374151' } };
    r.getCell(2).font = { bold: true };
  }
  res.addRow([]);
  const tituloMeses = res.addRow(['Mes por mes (por fecha de entrada)']);
  tituloMeses.getCell(1).font = { bold: true, size: 13 };
  const cab = res.addRow(['Mes', 'Reservas', 'Noches', 'Ingresos', 'Cobrado', 'Por cobrar', 'Gastos', 'Resultado', 'Canceladas']);
  cab.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  });
  const tot = { reservas: 0, noches: 0, ingresos: 0, cobrado: 0, saldo: 0, gastos: 0, canc: 0 };
  meses.forEach((m, i) => {
    const rs = activas.filter((r) => r._mes === m);
    const gs = gastos.filter((g) => mesDe(g.fecha) === m);
    const v = {
      reservas: rs.length, noches: sumar(rs, 'noches'), ingresos: sumar(rs, 'total'), cobrado: sumar(rs, 'pagado'),
      saldo: sumar(rs, 'saldo'), gastos: sumar(gs, 'monto'), canc: canceladas.filter((r) => r._mes === m).length,
    };
    Object.keys(tot).forEach((k) => { tot[k] += v[k]; });
    const r = res.addRow([nombreMes(m), v.reservas, v.noches, v.ingresos, v.cobrado, v.saldo, v.gastos, v.ingresos - v.gastos, v.canc]);
    [4, 5, 6, 7, 8].forEach((n) => { r.getCell(n).numFmt = PESOS; });
    if (i % 2 === 1) r.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RAYA } }; });
  });
  if (meses.length) {
    const r = res.addRow(['Total', tot.reservas, tot.noches, tot.ingresos, tot.cobrado, tot.saldo, tot.gastos, tot.ingresos - tot.gastos, tot.canc]);
    r.eachCell({ includeEmpty: true }, (c) => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }; });
    [4, 5, 6, 7, 8].forEach((n) => { r.getCell(n).numFmt = PESOS; });
  }
  res.addRow([]);
  res.addRow(['Cómo leer esta planilla']).getCell(1).font = { bold: true, size: 13 };
  const ayuda = [
    ['Cada mes', 'Las reservas que entran ese mes (sin canceladas ni eliminadas), con una fila de total al final.'],
    ['Canceladas', 'Todas las reservas canceladas, de la más nueva a la más vieja.'],
    ['Eliminadas', 'Las que se borraron (están en la Papelera de Flow), con quién y cuándo.'],
    ['Huéspedes', 'Una fila por persona: visitas, noches, total gastado y contacto.'],
    ['Gastos', 'Todos los egresos, mes a mes (los fijos y los del mes).'],
    ['Gastos fijos', 'La lista de lo que se paga siempre, que Flow suma solo cada mes.'],
    ['Movimientos de Mary', 'Lo que cargó, cobró o hizo Mary en las reservas.'],
    ['Tarifas', 'La tarifa normal y las promos con sus fechas.'],
    ['Todas (para restaurar)', 'Todas las reservas con los datos tal cual están en la base. Sirve para volver a cargar todo si algún día hace falta.'],
  ];
  for (const [k, v] of ayuda) {
    const r = res.addRow([k, v]);
    r.getCell(1).font = { bold: true, color: { argb: 'FF374151' } };
    r.getCell(1).alignment = { vertical: 'top' };
    res.mergeCells(r.number, 2, r.number, 9);
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    r.height = 30;
  }

  // ── Un mes por pestaña ──
  for (const m of meses) {
    const ws = wb.addWorksheet(pestanaMes(m));
    encabezado(ws, COL_RES);
    const rs = activas.filter((r) => r._mes === m).sort(porEntrada);
    if (!rs.length) { vacia(ws, 'Este mes no tiene reservas (solo gastos).'); continue; }
    filas(ws, COL_RES, rs, { colorEstado: true });
    filaTotal(ws, COL_RES, {
      noches: sumar(rs, 'noches'), personas: sumar(rs, 'personas'), total: sumar(rs, 'total'), pagado: sumar(rs, 'pagado'), saldo: sumar(rs, 'saldo'),
      huesped: `${rs.length} reserva${rs.length === 1 ? '' : 's'}`,
    });
  }

  // ── Canceladas ──
  {
    const ws = wb.addWorksheet('Canceladas', { properties: { tabColor: { argb: 'FFEF4444' } } });
    encabezado(ws, COL_RES);
    if (canceladas.length) filas(ws, COL_RES, canceladas, { colorEstado: true });
    else vacia(ws, 'No hay reservas canceladas.');
  }

  // ── Eliminadas ──
  {
    const cols = [
      { key: 'eliminadaEl', t: 'Eliminada el', w: 16 },
      { key: 'eliminadaPor', t: 'Eliminada por', w: 14 },
      ...COL_RES.filter((c) => ['entrada', 'salida', 'noches', 'habitacion', 'huesped', 'canal', 'total', 'pagado', 'telefono', 'notas', 'cargadaPor', 'cargadaEl', 'id'].includes(c.key)),
    ];
    const ws = wb.addWorksheet('Eliminadas', { properties: { tabColor: { argb: 'FF9CA3AF' } } });
    encabezado(ws, cols);
    if (eliminadas.length) filas(ws, cols, eliminadas);
    else vacia(ws, 'No hay reservas eliminadas.');
  }

  // ── Huéspedes ──
  {
    const cols = [
      { key: 'nombre', t: 'Nombre', w: 26 },
      { key: 'visitas', t: 'Visitas', w: 8, center: true },
      { key: 'noches', t: 'Noches', w: 8, center: true },
      { key: 'total', t: 'Total gastado', w: 13, fmt: PESOS },
      { key: 'primera', t: 'Primera visita', w: 13, fmt: FECHA },
      { key: 'ultima', t: 'Última visita', w: 13, fmt: FECHA },
      { key: 'telefono', t: 'Teléfono', w: 16 },
      { key: 'email', t: 'Email', w: 24 },
      { key: 'documento', t: 'Documento', w: 20 },
      { key: 'nacionalidad', t: 'País', w: 6, center: true },
      { key: 'empresa', t: 'Empresa', w: 18 },
      { key: 'noGrato', t: 'No grato', w: 9, center: true },
    ];
    const ws = wb.addWorksheet('Huéspedes', { properties: { tabColor: { argb: 'FF10B981' } } });
    encabezado(ws, cols);
    if (gente.length) filas(ws, cols, gente);
    else vacia(ws, 'Todavía no hay huéspedes.');
  }

  // ── Gastos ──
  {
    const cols = [
      { key: 'fecha', t: 'Fecha', w: 12, fmt: FECHA },
      { key: 'mes', t: 'Mes', w: 15 },
      { key: 'tipo', t: 'Tipo', w: 9 },
      { key: 'categoria', t: 'Categoría', w: 22 },
      { key: 'monto', t: 'Monto', w: 12, fmt: PESOS },
      { key: 'notas', t: 'Concepto', w: 40, wrap: true },
    ];
    const ws = wb.addWorksheet('Gastos', { properties: { tabColor: { argb: 'FFF59E0B' } } });
    encabezado(ws, cols);
    const gs = gastos
      .map((g) => ({ fecha: aFecha(g.fecha), mes: mesDe(g.fecha) ? nombreMes(mesDe(g.fecha)) : '', tipo: g.fijo_id ? 'Fijo' : 'Del mes', categoria: txt(g.categoria), monto: num(g.monto), notas: txt(g.notas) }))
      .sort((a, b) => (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0));
    if (gs.length) {
      filas(ws, cols, gs);
      filaTotal(ws, cols, { monto: sumar(gs, 'monto') });
    } else vacia(ws, 'No hay gastos cargados.');
  }

  // ── Gastos fijos (la lista que se carga una vez) ──
  {
    const fijos = Array.isArray(datos?.gastos_fijos) ? datos.gastos_fijos : [];
    const CADA = { 1: 'Todos los meses', 2: 'Cada 2 meses', 3: 'Cada 3 meses', 6: 'Cada 6 meses', 12: 'Una vez al año' };
    const cols = [
      { key: 'concepto', t: 'Concepto', w: 28 },
      { key: 'categoria', t: 'Categoría', w: 16 },
      { key: 'monto', t: 'Monto', w: 12, fmt: PESOS },
      { key: 'cada', t: 'Se paga', w: 16 },
      { key: 'desde', t: 'Desde', w: 12, fmt: FECHA },
      { key: 'hasta', t: 'Hasta', w: 12, fmt: FECHA },
    ];
    const ws = wb.addWorksheet('Gastos fijos', { properties: { tabColor: { argb: 'FFF59E0B' } } });
    encabezado(ws, cols);
    const fs = fijos
      .map((f) => ({ concepto: txt(f.concepto), categoria: txt(f.categoria), monto: num(f.monto), cada: CADA[f.cada_meses] || '', desde: aFecha(f.desde), hasta: aFecha(f.hasta) || 'Sigue' }))
      .sort((a, b) => a.concepto.localeCompare(b.concepto));
    if (fs.length) filas(ws, cols, fs);
    else vacia(ws, 'No hay gastos fijos cargados.');
  }

  // ── Movimientos de Mary ──
  {
    const cols = [
      { key: 'cuando', t: 'Cuándo', w: 16 },
      { key: 'quien', t: 'Quién', w: 10 },
      { key: 'que', t: 'Qué hizo', w: 20 },
      { key: 'huesped', t: 'Huésped', w: 24 },
      { key: 'habitacion', t: 'Hab.', w: 7, center: true },
      { key: 'entrada', t: 'Entrada', w: 12, fmt: FECHA },
      { key: 'salida', t: 'Salida', w: 12, fmt: FECHA },
      { key: 'canal', t: 'Canal', w: 12 },
      { key: 'monto', t: 'Monto', w: 11, fmt: PESOS },
      { key: 'forma', t: 'Forma de pago', w: 15 },
      { key: 'visto', t: 'Visto por', w: 12 },
    ];
    const ws = wb.addWorksheet('Movimientos de Mary', { properties: { tabColor: { argb: 'FFF97316' } } });
    encabezado(ws, cols);
    const ms = [...movs]
      .sort((a, b) => txt(b.creado_en).localeCompare(txt(a.creado_en)))
      .map((m) => ({
        cuando: horaProgreso(m.creado_en),
        quien: txt(m.por_nombre),
        que: MOVS[m.tipo] || txt(m.tipo),
        huesped: txt(m.huesped),
        habitacion: txt(m.habitacion),
        entrada: aFecha(m.fecha_ingreso),
        salida: aFecha(m.fecha_salida),
        canal: CANALES[m.canal] || txt(m.canal),
        monto: m.monto === null || m.monto === undefined ? '' : num(m.monto),
        forma: PAGOS[txt(m.forma_pago).toLowerCase()] || txt(m.forma_pago),
        visto: m.visto ? txt(m.visto_por_nombre) || 'Sí' : '',
      }));
    if (ms.length) filas(ws, cols, ms);
    else vacia(ws, 'Todavía no hay movimientos del equipo.');
  }

  // ── Tarifas ──
  {
    const cols = [
      { key: 'nombre', t: 'Período', w: 22 },
      { key: 'desde', t: 'Desde la noche del', w: 14, fmt: FECHA },
      { key: 'hasta', t: 'Hasta la noche del', w: 14, fmt: FECHA },
      ...TIPOS_TARIFA.flatMap(([k, n]) => [
        { key: `${k}_entre`, t: `${n} · Lun–Mié`, w: 13, fmt: PESOS },
        { key: `${k}_finde`, t: `${n} · Jue–Dom`, w: 13, fmt: PESOS },
        { key: `${k}_extra`, t: `${n} · + persona`, w: 13, fmt: PESOS },
      ]),
    ];
    const ws = wb.addWorksheet('Tarifas', { properties: { tabColor: { argb: 'FF8B5CF6' } } });
    encabezado(ws, cols);
    const ts = [...tarifas]
      .sort((a, b) => (a.desde ? 1 : 0) - (b.desde ? 1 : 0) || txt(b.desde).localeCompare(txt(a.desde)))
      .map((tf) => {
        let p = tf.precios;
        if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = {}; } }
        const o = { nombre: txt(tf.nombre) || (tf.desde ? 'Período' : 'Normal'), desde: aFecha(tf.desde) || 'Siempre', hasta: aFecha(tf.hasta) || '' };
        for (const [k] of TIPOS_TARIFA) {
          const x = p?.[k] || {};
          o[`${k}_entre`] = x.entre ? num(x.entre) : '';
          o[`${k}_finde`] = x.finde ? num(x.finde) : '';
          o[`${k}_extra`] = x.extra ? num(x.extra) : k === 'matrimonial' ? 'No admite' : '';
        }
        return o;
      });
    if (ts.length) filas(ws, cols, ts);
    else vacia(ws, 'No hay tarifas cargadas.');
  }

  // ── Todas (para restaurar): columnas tal cual la base ──
  {
    const ws = wb.addWorksheet('Todas (para restaurar)', { properties: { tabColor: { argb: 'FF374151' } } });
    const claves = [...new Set(reservas.flatMap((r) => Object.keys(r || {})))];
    if (!claves.length) vacia(ws, 'No hay reservas.');
    else {
      encabezado(ws, claves.map((k) => ({ key: k, t: k, w: Math.min(30, Math.max(10, k.length + 2)) })));
      ws.getRow(1).eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } }; });
      for (const r of reservas) {
        ws.addRow(claves.map((k) => {
          const v = r[k];
          if (v === null || v === undefined) return '';
          return typeof v === 'object' ? JSON.stringify(v) : v;
        }));
      }
    }
  }

  // Una sola letra en toda la planilla
  wb.eachSheet((ws) => ws.eachRow({ includeEmpty: true }, (row) => row.eachCell({ includeEmpty: true }, (c) => {
    c.font = { name: 'Arial', size: 10, ...(c.font || {}) };
  })));

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const resumen = {
    reservas: activas.length,
    canceladas: canceladas.length,
    eliminadas: eliminadas.length,
    huespedes: gente.length,
    gastos: gastos.length,
    meses: meses.length,
  };
  return { buffer, resumen, nombre: `Flow respaldo ${hoyProgreso(ahora)}.xlsx` };
}

export const _paraProbar = { prepararReservas, huespedes, horaProgreso, AZUL_SUAVE };
