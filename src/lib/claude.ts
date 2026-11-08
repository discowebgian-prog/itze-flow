/* eslint-disable */
// @ts-nocheck
import { supabase } from './supabase';

// Habla con la función segura /api/claude y devuelve el texto de la respuesta.
export async function askClaude({ messages, maxTokens, effort = undefined }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw Object.assign(new Error('Tu sesión venció.'), { status: 401 });

  let resp;
  try {
    resp = await fetch('/api/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ messages, maxTokens, effort }),
    });
  } catch {
    throw new Error('Error de red al conectar con Claude.');
  }

  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw Object.assign(new Error(data?.error || `Error del servidor (${resp.status}).`), { status: resp.status });
  return data?.text || '';
}
