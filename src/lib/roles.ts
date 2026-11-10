/* eslint-disable */
// @ts-nocheck
// Roles y permisos de cada usuario (tabla perfiles, supabase/perfiles.sql).
// - dueno: Gian y Marce (mismo usuario; quién usa el aparato se elige con "¿Quién usa este dispositivo?").
// - equipo: Mary y quien se sume a trabajar en el hostel. Lo que puede hacer lo dicen sus permisos.
// - staff: preparado, sin uso por ahora.

export const ROLES = {
  dueno: 'Dueños',
  equipo: 'Equipo',
  staff: 'Staff',
};

// Permisos sueltos para el rol equipo (los dueños pueden todo).
// Se prenden o apagan en la columna permisos de perfiles, sin tocar código.
export const PERMISOS = {
  limpieza: 'Su vista de habitaciones, tareas e insumos',
  cotizar: 'Usar Cotizar',
  reservar: 'Cargar reservas (por puerta)',
  precio: 'Aplicar descuento o cambiar el precio',
  checkin: 'Hacer check-in y check-out y cobrar el saldo',
};

export const esDueno = (user) => user?.role === 'dueno';

export const puede = (user, permiso) =>
  esDueno(user) || (Array.isArray(user?.permisos) && user.permisos.includes(permiso));

// Lee el perfil del usuario que acaba de entrar.
// Devuelve { perfil } o { error: 'sin_perfil' | 'sin_tabla' | 'red' }.
export async function leerPerfil(supabase, userId) {
  const { data, error } = await supabase
    .from('perfiles')
    .select('nombre, rol, permisos')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    const msg = `${error.message || ''} ${error.code || ''}`;
    if (/perfiles|42P01|PGRST205/i.test(msg)) return { error: 'sin_tabla' };
    return { error: 'red' };
  }
  if (!data || !ROLES[data.rol]) return { error: 'sin_perfil' };
  return { perfil: { nombre: data.nombre, rol: data.rol, permisos: data.permisos || [] } };
}
