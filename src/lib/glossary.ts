/* eslint-disable */
// @ts-nocheck

// ── GLOSARIO DE INDICADORES (ventanita del "?" en Finanzas) ──────────────────
// Textos para quien recién aprende estos números: qué es, cómo sale, un ejemplo
// con números del hostel (6 habitaciones) y cómo usarlo para decidir.
// Tono: cálido, corto y claro (regla de la app).
export const GLOSSARY = {
  ocupacion: {
    title: 'Ocupación',
    sub: 'Qué parte de las noches vendiste',
    what: 'De todas las noches que podías vender (cada habitación, cada noche), cuántas se vendieron.',
    how: 'Noches vendidas ÷ noches disponibles.',
    example:
      'En 30 días, con 6 habitaciones, hay 180 noches para vender. Si vendiste 108, la ocupación es 60%.',
    use: [
      'Sola no dice si te fue bien: 100% llena a precio regalado puede dejar menos plata que 70% a buen precio.',
      'Mirala junto con el ADR o, mejor, con el RevPAR, que junta las dos cosas.',
    ],
  },
  adr: {
    title: 'ADR',
    sub: 'Tarifa promedio por noche vendida',
    what: 'Lo que cobraste en promedio por cada noche que vendiste. Solo cuenta las noches vendidas, no las vacías.',
    how: 'Ingresos ÷ noches vendidas.',
    example: 'Vendiste 10 noches y cobraste $11,000 en total: el ADR es $1,100.',
    use: [
      'Si sube, estás cobrando mejor cada noche.',
      'Si lo bajás con descuentos, fijate que la ocupación suba lo suficiente para compensar (eso te lo dice el RevPAR).',
    ],
  },
  proyectado: {
    title: 'Reservado y proyectado',
    sub: 'Cómo viene el mes completo',
    what:
      'Reservado: lo que ya está vendido para todo el mes, incluidas noches que todavía no llegaron. Proyectado: una estimación de cómo podría cerrar el mes si sigue el ritmo de lunes a miércoles y de jueves a domingo que viene teniendo.',
    how: 'El proyectado toma el ritmo hasta hoy y lo aplica a los días que faltan. Nunca da menos que lo ya reservado.',
    example:
      'Al día 10 llevás 40% de ocupación y para el resto del mes ya hay reservas que suman 25%. El proyectado estima dónde terminarías si las ventas siguen igual.',
    use: [
      'Es una guía, no una promesa: no sabe de feriados, eventos ni lluvias.',
      'Si el proyectado viene bajo a mitad de mes, todavía estás a tiempo de lanzar una promo para los días flojos.',
    ],
  },
  goppar: {
    title: 'GOPPAR',
    sub: 'Ganancia por habitación disponible',
    what:
      'Cuánto te quedó de ganancia (ingresos menos gastos operativos) por cada habitación, cada noche, estuviera vendida o vacía. Es lo más parecido a "la plata que queda en el bolsillo".',
    how: '(Ingresos − gastos operativos) ÷ noches disponibles.',
    example:
      'En 7 días ingresaron $21,000 y gastaste $6,300 en limpieza, insumos y servicios. Te quedan $14,700. Con 6 habitaciones × 7 noches = 42 noches disponibles: GOPPAR = $14,700 ÷ 42 = $350.',
    use: [
      'El RevPAR mira cuánto entra; el GOPPAR, cuánto queda.',
      'Si llenás con descuentos fuertes, el RevPAR puede subir pero la limpieza y la lavandería extra se comen la ganancia: el GOPPAR lo muestra.',
      'Para que sea fiel, cargá todos los gastos del mes en Egresos.',
    ],
  },
  revpar: {
    title: 'RevPAR',
    sub: 'Ingreso por habitación disponible',
    what:
      'Cuánto te dejó cada habitación, cada noche, contando también las que quedaron vacías. Junta en un solo número el precio y la ocupación.',
    how: 'Ingresos ÷ noches disponibles. También es ocupación × ADR.',
    example:
      'En 7 días hay 6 habitaciones × 7 noches = 42 noches disponibles. Si ingresaron $21,000, el RevPAR es $500: como si cada habitación te hubiera dejado $500 por noche. Es lo mismo que 50% de ocupación × $1,000 de ADR.',
    use: [
      'Es el mejor número para comparar meses o días de la semana, porque no lo engaña ni el precio solo ni la ocupación sola.',
      'Si bajás el precio y se llena más, el RevPAR te dice si valió la pena: si sube, sí.',
      'Si Lun–Mié queda muy por debajo de Jue–Dom, ahí están los días para promos o paquetes.',
    ],
  },
  potencial: {
    title: '% del potencial',
    sub: 'Cuánto aprovechaste de lo máximo posible',
    what:
      'Compara lo que ingresó con lo máximo que podrías haber ganado: todas las habitaciones vendidas cada noche al precio del tarifario que regía esa noche (promo, fecha especial o Normal).',
    how: 'Ingresos ÷ (todas las habitaciones × cada noche × su precio de tarifario). Se separa en dos causas: ocupación y cobrado vs tarifario.',
    example:
      'Del 1 al 7 de noviembre, con la promo, el máximo posible es $41,640. Si ingresaron $20,820, aprovechaste el 50%.',
    use: [
      'Semáforo: 🟢 65% o más, bien encaminado · 🟡 40 a 64%, se puede mejorar · 🔴 menos de 40%, muy por debajo.',
      'Si la ocupación es la que está baja: falta demanda. Promos para los días flojos, más difusión, otros canales.',
      'Si "cobrado vs tarifario" está bajo: se están haciendo muchos descuentos o precios a mano por debajo del tarifario.',
      'Si "cobrado vs tarifario" pasa el 100%: vendiste extras (personas adicionales, late check-out). ¡Bien!',
    ],
  },
  segmentacion: {
    title: 'Segmentación física',
    sub: 'Cómo rinde cada tipo de habitación',
    what:
      'La ocupación (%) y el RevPAR ($) de cada grupo de habitaciones por separado: las Habitaciones 1, 2, 3 y 5, la Habitación 4 y la Habitación 6.',
    how: 'Igual que el RevPAR general, pero solo con las noches y los ingresos de ese tipo de habitación.',
    example:
      'Si la Habitación 6 tiene 80% de ocupación y las 1, 2, 3 y 5 tienen 40%, la 6 se vende sola y las grandes necesitan ayuda.',
    use: [
      'Un tipo con mucha ocupación puede aguantar una suba de precio.',
      'Un tipo con poca ocupación pide promo, mejores fotos o venderlo para grupos.',
    ],
  },
};
