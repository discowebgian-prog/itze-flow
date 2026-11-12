/* eslint-disable */
// @ts-nocheck
// Reserva de la app → fila de la tabla reservas (datosLimpios) y cómo queda en pantalla (reservaParaEstado).
// La usan App.tsx (dueños) y Equipo (Mary, paso 9): así las dos guardan exactamente igual.
export function prepRes(newRes) {
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
      // Nota para el equipo (supabase/nota_equipo.sql): solo se manda si la reserva ya la conoce (columna creada)
      if (newRes.notaEquipo !== undefined) datosLimpios.nota_equipo = String(newRes.notaEquipo || '').trim() || null;
      // Extensión de estadía (supabase/mejoras_nov.sql): solo si la reserva ya conoce las columnas
      if (newRes.extendidaNoches !== undefined) {
        datosLimpios.extendida_noches = Number(newRes.extendidaNoches) || 0;
        datosLimpios.checkout_original = newRes.checkoutOriginal || null;
      }
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
}
