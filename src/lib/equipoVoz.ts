/* eslint-disable */
// @ts-nocheck
// La voz de la sección Equipo (ex Itzé Limpieza). A Mary se le habla de "tú", como siempre en Limpieza.
// Los textos son los mismos de Limpieza (app.js), para que Mary vea exactamente lo de hoy.

// Consejos de "Tu momento" (k = palabras de las tareas de hoy que lo hacen aparecer)
export const TIPS = [
  { t: 'Usa guantes cuando limpies con químicos; tus manos te lo agradecen.' },
  { t: 'Una crema de manos al terminar el día ayuda mucho después de tanto lavar.' },
  { t: 'Ventila el cuarto mientras limpias: así el olor de los productos no se acumula.' },
  { t: 'Cambia de mano el trapeador de vez en cuando para no cargar siempre el mismo lado.' },
  { t: 'Estira la espalda un ratito entre una habitación y otra.' },
  { t: 'Ordenar la bolsa de los elementos de limpieza antes de empezar te ahorra muchas vueltas.' },
  { t: 'Limpia de arriba hacia abajo: el polvo cae y no repites trabajo.' },
  { t: 'Un trapo para cada cosa (baño, cocina, muebles) evita pasar gérmenes de un lado a otro.' },
  { t: 'Revisa seguido que el trapo esté limpio: con un trapo sucio, por más que pases, la superficie no queda bien.' },
  { t: 'Los guantes de hule duran más si los enjuagas y secas al terminar.' },
  { t: 'Cuando el día viene acelerado, respirar profundo un par de veces ayuda.' },
  { t: 'Si algo está roto o no funciona, anótalo en la app: así se resuelve más rápido.' },
  { t: 'Un vaso de agua entre habitación y habitación es un buen hábito.' },
  { t: 'Si sientes mareo o dolor de cabeza por el calor, para un ratito en la sombra y toma agua.' },
  { t: 'Cuando hace mucho calor, mojarte la nuca con agua fresca ayuda a refrescarte.' },
  { k: /cloro|desinfect|baño|sarro|limpiador|wc|regadera/, t: 'Nunca mezcles cloro con otros limpiadores: juntos pueden soltar gases peligrosos.' },
  { k: /cloro|desinfect|baño|sarro|limpiador|wc|regadera/, t: 'Con el cloro, menos es más: un chorrito en agua alcanza y huele menos.' },
  { k: /cloro|desinfect|baño|sarro|limpiador|wc|regadera/, t: 'Al limpiar baños con productos fuertes, deja la puerta o la ventana abierta.' },
  { k: /sarro|sarricida|grifo|grifería|griferia|llave|tarja|bacha|baño|cocina/, t: 'El sarricida se enjuaga enseguida: si se deja actuar, mancha la grifería y la tarja.' },
  { k: /puerta|ventana|vidrio|marco|mueble|mesa|espejo|superficie/, t: 'En puertas, ventanas y muebles, a veces una pasada no alcanza: repasa hasta que quede realmente limpio.' },
  { k: /alberca|patio|terraza|tendedero|balc|entrada/, t: 'En la terraza a pleno sol, una gorra o sombrero ayuda mucho.' },
  { k: /alberca|patio|terraza|tendedero|balc|entrada/, t: 'Si se puede, lo de afuera conviene temprano, cuando el sol pega menos.' },
  { k: /colch|cama|mover|cargar|mueble|sábana|sabana|ropa|blanco/, t: 'Para levantar algo pesado, dobla las rodillas y no la espalda.' },
  { k: /colch|cama|sábana|sabana/, t: 'Al tender camas, apoya una rodilla en el piso en vez de agacharte doblada.' },
  { k: /ropa|sábana|sabana|toalla|blanco|lavadero/, t: 'Lleva la ropa en varias vueltas en vez de una sola carga muy pesada.' },
  { k: /ventana|vidrio|marco|techo|ventilador|lámpara|lampara|foco|telaraña/, t: 'Para lo alto, mejor una escalerita firme que pararse en una silla.' },
  { k: /escalera/, t: 'En la escalera, siempre una mano libre para agarrarte.' },
];

// Mensaje de "Tu momento" según las horas desde que empezó (el = horas; start = hora de inicio)
export function careLine(st, el, start, pick) {
  if (!st.total) return pick(['Hoy no hay tareas cargadas por ahora. Si surge algo, te avisamos.', 'Día tranquilo por ahora. Si aparece algo, te llega un aviso.']);
  if (el < 1.5 && start >= 10.5) return pick(['¡Qué bueno que llegaste! Hoy arrancas más tarde: fíjate primero qué habitaciones tienen salida o entrada :)', 'Bienvenida, Mary. Primero una mirada a las habitaciones de hoy: lo de los huéspedes va primero :)', 'Hoy empiezas más tarde: revisa las habitaciones y arranca por lo más urgente :)', 'Si no alcanzaste a comer algo antes de venir, busca un ratito en cuanto resuelvas lo urgente :)']);
  if (el < 1.5) return pick(['Antes del desayuno, una mirada rápida por si hay algo urgente que resolver :)', 'Primero una vueltita por el hostel: si hay algo urgente, eso va antes que el desayuno :)', 'Un recorrido rápido al llegar y, si todo está en orden, a desayunar tranquila :)', 'Lo que los huéspedes puedan ver o necesitar va primero. Después, a desayunar :)', 'Antes de sentarte a desayunar, revisa que todo esté en orden para los huéspedes :)']);
  if (el < 5.5 && st.pct >= 70) return pick(['¡Vas muy bien! Con lo importante hecho, date un respiro.', 'Gran avance. Si no hay nada urgente, aprovecha para descansar un ratito.']);
  if (el < 3) return pick(['Si todavía no tomaste una pausa, es momento. Aprovecha para tomar agua si no tomaste.', 'Si aún no hiciste una pausa, es buen momento. Y de paso, un poco de agua.']);
  if (el < 4.5) return pick(['Cuando encuentres un buen momento, haz tu pausa para comer. Hace falta energía.', 'Si todavía no comiste, busca tu momento para hacerlo.']);
  if (el < 5.5) return pick(['Última parte de la jornada. Gracias por cuidar tanto este lugar 💛', 'Ya entrando en la última parte del día. Qué bien se siente Itzé cuando pasas tú.']);
  return st.all
    ? pick(['¡Todo listo! Repasa y cierra el día.', 'Terminaste todo. Cierra el día cuando quieras.'])
    : pick(['Ya casi terminas. Repasa lo que falta antes de cerrar el día.', 'Recta final. Revisa los pendientes y cierra el día.']);
}
export const WATER_NUDGE = ['Hace calor, ¿un vasito de agua?', 'Buen momento para un poco de agua fresca.', 'Tu cuerpo agradece un vaso de agua ahora.'];
export const waterText = (ag, goal) =>
  ag === 0 ? 'Toca un vasito cada vez que tomes uno. La meta son 6 en tu jornada.'
  : ag >= goal ? '¡Meta cumplida! Tu cuerpo te lo agradece.'
  : ag >= goal / 2 ? '¡Vas muy bien! Sigue así.'
  : 'Buen comienzo. Toca otro vasito cuando tomes más.';

// Ayuda de cada tipo de tarea (solo dueños)
export const HELP = {
  hoy: 'Algo para hacer hoy. Si no se hace, pasa a mañana.',
  rutina: 'Se repite todos los días.',
  mensaje: 'Algo que tiene que saber o atender ahora. Ella toca "Entendido".',
  programada: 'Le aparece sola a Mary en "Tareas de hoy" el día que elijas.',
};

// Errores de guardado (en palabras, sin alert)
export const EQ_FAIL = 'No se pudo guardar. Revisa la conexión e intenta de nuevo.';
