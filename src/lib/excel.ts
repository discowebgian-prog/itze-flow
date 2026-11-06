/* eslint-disable */
// @ts-nocheck
import { srcLabel, RS } from './constants';
import { fmt, fmtD, fmtDT, diffDays } from './dates';
import { supabase } from './supabase';

// ── EXPORT EXCEL ──────────────────────────────────────────────────────────────
export async function exportToExcel(reservations, properties) {
  // 1. Traemos el historial de eliminadas directo desde Supabase
  const { data: eliminadasDB, error } = await supabase
    .from('reservas')
    .select('*')
    .eq('estado', 'eliminada');

  if (error) {
    console.error('Error al traer eliminadas para Excel:', error);
  }

  const doExport = (XLSX) => {
    const pmLabel = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      debito: 'Débito',
      credito: 'Crédito',
      vcc: 'Tarjeta virtual (VCC)',
      otro: 'Otro',
    };

    // ORDENAMOS CRONOLÓGICAMENTE POR CHECK-IN (Comparación de Strings ISO para evitar bugs UTC)
    const reservasOrdenadas = [...reservations].sort((a, b) => a.checkIn.localeCompare(b.checkIn));

    // --- PESTAÑA 1: ACTIVAS ---
    const rowsActivas = reservasOrdenadas.map((r) => {
      const prop = properties.find((p) => p.id === r.propertyId);
      const nights = diffDays(r.checkIn, r.checkOut);
      return {
        ID: r.id,
        Huésped: r.guestName,
        Documento: r.guestDoc || '—',
        'Tipo doc.': r.guestDocType || '—',
        Teléfono: r.guestPhone || '—',
        Email: r.guestEmail || '—',
        Propiedad: prop?.name || r.propertyId,
        Habitación: r.room || '—',
        'Check-in': fmtD(r.checkIn),
        'Check-out': fmtD(r.checkOut),
        Noches: nights,
        Huéspedes: r.totalGuests || 1,
        Estado: RS[r.status]?.label || r.status,
        Canal: srcLabel(r.source),
        'Total $': r.totalAmount || 0,
        'Pagado $': r.paid || 0,
        'Saldo $': (r.totalAmount || 0) - (r.paid || 0),
        'Forma de pago': pmLabel[r.paymentMethod] || r.paymentMethod || '—',
        Factura: r.requiresInvoice ? 'Sí' : 'No',
        'CI real': r.checkInAt ? fmtDT(r.checkInAt) : '—',
        'CO real': r.checkOutAt ? fmtDT(r.checkOutAt) : '—',
        Notas: r.notes || '',
        'Fecha de Carga': r.fecha_carga || '—',
        'Cargado por': r.usuario_carga || '—',
      };
    });

    // ORDENAMOS TAMBIÉN EL HISTORIAL DE ELIMINADAS (Comparación de Strings ISO para evitar bugs UTC)
    const eliminadasOrdenadas = [...(eliminadasDB || [])].sort((a, b) => (a.fecha_ingreso || '').localeCompare(b.fecha_ingreso || ''));

    // --- PESTAÑA 2: ELIMINADAS ---
    const rowsEliminadas = eliminadasOrdenadas.map((db) => {
      return {
        ID: db.id,
        Huésped: db.Huesped || db.huesped || '—',
        Habitación: db.habitacion || '—',
        'Check-in': db.fecha_ingreso || '—',
        'Check-out': db.fecha_salida || '—',
        'Total $': Number(db.monto) || 0,
        Estado: db.estado || '—',
        'Fecha de Carga': db.fecha_carga || '—',
        'Cargado por': db.usuario_carga || '—',
        'Fecha de Eliminación': db.fecha_eliminacion || '—',
        'Eliminado por': db.usuario_eliminacion || '—',
      };
    });

    const wb = XLSX.utils.book_new();

    const wsActivas = XLSX.utils.json_to_sheet(rowsActivas);
    const colWidthsActivas = Object.keys(rowsActivas[0] || {}).map((k) => ({
      wch: Math.max(k.length, 14),
    }));
    wsActivas['!cols'] = colWidthsActivas;
    XLSX.utils.book_append_sheet(wb, wsActivas, 'Activas');

    const datosEliminadas = rowsEliminadas.length > 0 ? rowsEliminadas : [{ Mensaje: 'No hay reservas eliminadas' }];
    const wsEliminadas = XLSX.utils.json_to_sheet(datosEliminadas);
    const colWidthsElim = Object.keys(datosEliminadas[0] || {}).map((k) => ({
      wch: Math.max(k.length, 14),
    }));
    wsEliminadas['!cols'] = colWidthsElim;
    XLSX.utils.book_append_sheet(wb, wsEliminadas, 'Historial Eliminadas');

    const today = fmt(new Date());
    XLSX.writeFile(wb, `itze_reservas_${today}.xlsx`);
  };

  if (window.XLSX) {
    doExport(window.XLSX);
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  script.onload = () => doExport(window.XLSX);
  document.head.appendChild(script);
}
