// Fechas fijas de México y Yucatán para el radar de eventos (no hace falta buscarlas en internet).
// Se calculan para los próximos 12 meses y se guardan junto con lo que encuentra la búsqueda.
// Feriados del lunes (Constitución, Benito Juárez, Revolución) → "puente" sábado a lunes.
// Semana Santa y Carnaval dependen de la Pascua (cálculo gregoriano). Las vacaciones de verano son
// aproximadas (el calendario de la SEP cambia cada año): van como "probable".

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const D = (y, m, d) => new Date(y, m - 1, d, 12);
const mas = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);

// Domingo de Pascua (algoritmo anónimo gregoriano)
function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return D(y, mes, dia);
}
// n-ésimo lunes del mes (n = 1, 2, 3…)
function lunes(y, m, n) {
  const d = D(y, m, 1);
  const off = (8 - d.getDay()) % 7; // días hasta el primer lunes
  return mas(d, off + 7 * (n - 1));
}
// Fin de semana largo que toca un día: si cae lunes → sáb a lun; viernes → vie a dom; martes → sáb a mar;
// jueves → jue a dom; otro día → solo ese día
function puente(d) {
  const w = d.getDay();
  if (w === 1) return [mas(d, -2), d];
  if (w === 5) return [d, mas(d, 2)];
  if (w === 2) return [mas(d, -3), d];
  if (w === 4) return [d, mas(d, 3)];
  return [d, d];
}

function delAnio(y) {
  const P = pascua(y);
  const out = [];
  const add = (nombre, tipo, desde, hasta, impacto, descripcion, ideas, confianza = 'confirmado', publico = null) =>
    out.push({ nombre, tipo, fecha_desde: iso(desde), fecha_hasta: iso(hasta), lugar: null, impacto, publico, descripcion, ideas, fuente_url: null, confianza });

  // Temporadas
  add(`Vacaciones de invierno ${y}-${y + 1}`, 'temporada', D(y, 12, 19), D(y + 1, 1, 6), 'alto',
    'Navidad, Año Nuevo y vacaciones escolares: familias y grupos de Mérida y del resto del país buscan playa.',
    ['Fecha especial con precio de temporada para Navidad y Año Nuevo', 'Publicar con tiempo la cena o el brindis de fin de año si lo ofrecen', 'Paquete para familias: habitación grande + desayuno'], 'confirmado', 'Familias y grupos de amigos');
  add(`Semana Santa y Pascua ${y}`, 'temporada', mas(P, -7), mas(P, 7), 'alto',
    'Las dos semanas de vacaciones de Semana Santa: una de las temporadas más llenas de la costa.',
    ['Fecha especial con precio de temporada', 'Abrir la venta con anticipación a los huéspedes que ya vinieron', 'Late check-out pago el domingo de Pascua'], 'confirmado', 'Familias, grupos de amigos y turistas nacionales');
  add(`Vacaciones de verano ${y}`, 'temporada', D(y, 7, 15), D(y, 8, 25), 'alto',
    'Vacaciones escolares de verano (fechas aproximadas: el calendario de la SEP cambia cada año).',
    ['Fecha especial de verano en Tarifas', 'Promo de estadía larga entre semana para familias', 'Publicar fotos de las habitaciones grandes para grupos'], 'probable', 'Familias');
  add(`Carnaval ${y}`, 'festival', mas(P, -51), mas(P, -47), 'alto',
    'Carnaval de Progreso y de Mérida (sábado a martes antes del Miércoles de Ceniza; confirmar el programa).',
    ['Fecha especial de carnaval', 'Info de horarios del desfile y cómo llegar para los huéspedes', 'Publicar en grupos de Mérida que buscan dónde quedarse para el carnaval'], 'probable', 'Grupos de amigos, familias y gente de Mérida');

  // Feriados oficiales y puentes
  const fer = (nombre, d, impacto, descripcion, ideas) => {
    const [a, b] = puente(d);
    const largo = a.getTime() !== b.getTime();
    add(largo ? `Puente del ${nombre}` : nombre, 'feriado', a, b, largo ? impacto : 'bajo', descripcion, ideas);
  };
  fer('Día de la Constitución', lunes(y, 2, 1), 'medio', 'Fin de semana largo de febrero.', ['Promo de escapada de 3 días para Mérida y el centro del país', 'Fecha especial si se llena rápido']);
  fer('Natalicio de Benito Juárez', lunes(y, 3, 3), 'medio', 'Fin de semana largo de marzo.', ['Promo de escapada de 3 días', 'Avisar a huéspedes frecuentes de Mérida']);
  fer('Día del Trabajo', D(y, 5, 1), 'medio', 'Feriado del 1 de mayo.', ['Si cae cerca del fin de semana, promo de puente']);
  fer('Día de la Independencia', D(y, 9, 16), 'medio', 'Fiestas patrias: noche del Grito el 15 y feriado el 16.', ['Publicar la noche del Grito en el malecón', 'Promo de puente si cae cerca del fin de semana']);
  fer('Día de la Revolución', lunes(y, 11, 3), 'medio', 'Fin de semana largo de noviembre.', ['Promo de escapada de 3 días', 'Avisar a huéspedes frecuentes de Mérida']);

  // Yucatán
  add(`Hanal Pixán ${y}`, 'cultural', D(y, 10, 31), D(y, 11, 2), 'medio',
    'Día de Muertos en Yucatán: altares, pib y Paseo de las Ánimas en Mérida.',
    ['Contar a los huéspedes dónde ver altares y el Paseo de las Ánimas', 'Pib o detalle de Hanal Pixán en el desayuno'], 'confirmado', 'Turistas nacionales y extranjeros');
  return out;
}

// Fechas fijas entre hoy y dentro de 12 meses
export function fechasFijas(hoyIso) {
  const hoy = new Date(hoyIso + 'T12:00:00');
  const fin = iso(new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate(), 12));
  const y = hoy.getFullYear();
  return [...delAnio(y - 1), ...delAnio(y), ...delAnio(y + 1)].filter((e) => e.fecha_hasta >= hoyIso && e.fecha_desde <= fin);
}
