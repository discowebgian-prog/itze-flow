/* eslint-disable */
// @ts-nocheck
// Fila de la tabla reservas → reserva de la app (los mismos nombres que usa App.tsx al cargar).
// La usa Equipo (paso 9): Mary recibe las filas de equipo_reservas_todas (sin montos en las ajenas).
import { COUNTRIES } from './constants';

export function rowToRes(item) {
  const nacionalidad = item.nacionalidad || 'MX';
  const pais = COUNTRIES.find((c) => c.code === nacionalidad);
  const prefijo = pais ? pais.prefix : '+52';
  let telefonoLimpio = item.telefono || '';
  if (telefonoLimpio.startsWith(prefijo)) telefonoLimpio = telefonoLimpio.replace(prefijo, '').trim();
  const r = {
          id: item.id,
          propertyId: item.propiedad || 'hostel',
          guestName: item.huesped || '',
          room: item.habitacion || '',
          checkIn: item.fecha_ingreso || '',
          checkOut: item.fecha_salida || '',
          status: item.estado || 'por_llegar',
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
  // Paso 9: quién la cargó, si es de Mary (propia) y el saldo de las ajenas (sin montos)
  r.cargadaPor = item.cargada_por || null;
  r.cargadaPorNombre = item.cargada_por_nombre || '';
  // Nota para el equipo: undefined si la columna todavía no existe (así no se manda al guardar)
  r.notaEquipo = 'nota_equipo' in item ? item.nota_equipo || '' : undefined;
  r.propia = item.propia === true;
  r.saldo = item.saldo === undefined ? undefined : item.saldo === null ? null : Number(item.saldo);
  r.sinMontos = item.propia === false;
  return r;
}
