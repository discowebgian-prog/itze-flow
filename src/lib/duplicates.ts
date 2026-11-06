/* eslint-disable */
// @ts-nocheck
import { buildGuestDB } from './guests';

// ── POSIBLES HUÉSPEDES DUPLICADOS ─────────────────────────────────────────────
// Busca pares de huéspedes que podrían ser la misma persona, para que un admin decida.
// Se calcula cada vez que cambian las reservas o las decisiones: no hace falta programarlo.

// Distancia entre dos textos (cuántas letras hay que cambiar para pasar de uno al otro)
const distance = (a, b) => {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
};

const overlaps = (a, b) => [...a].some((x) => b.has(x));

// Clave de un par, siempre en el mismo orden
export const pairId = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Qué tan fuerte es cada pista (para mostrar primero las más seguras)
const STRENGTH = { phone: 3, email: 3, name: 2, similar: 1 };
const REASON_TEXT = {
  phone: 'Mismo teléfono',
  email: 'Mismo email',
  name: 'Mismo nombre',
  similar: 'Nombre casi igual y misma nacionalidad',
};

export function findDuplicates(reservations, decisions = []) {
  const db = buildGuestDB(reservations, decisions);
  const guests = Object.values(db);

  // Pares ya marcados como "son distintas": no se vuelven a preguntar
  const distinct = new Set(
    (decisions || []).filter((d) => d.decision === 'distinta').map((d) => pairId(d.clave_a, d.clave_b))
  );
  const decidedDistinct = (g1, g2) => {
    for (const a of g1.keys) for (const b of g2.keys) if (distinct.has(pairId(a, b))) return true;
    return false;
  };

  const pairs = {};
  const add = (g1, g2, reason) => {
    if (g1.key === g2.key) return;
    const id = pairId(g1.key, g2.key);
    if (!pairs[id]) {
      const [a, b] = g1.key < g2.key ? [g1, g2] : [g2, g1];
      pairs[id] = { id, a, b, reasons: new Set() };
    }
    pairs[id].reasons.add(reason);
  };

  // Agrupa por un dato y propone pares dentro de cada grupo
  const byValue = (field, reason, extraCheck = () => true) => {
    const idx = {};
    guests.forEach((g) => g[field].forEach((v) => (idx[v] = idx[v] || []).push(g)));
    Object.values(idx).forEach((list) => {
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++)
          if (extraCheck(list[i], list[j])) add(list[i], list[j], reason);
    });
  };

  byValue('phones', 'phone');
  byValue('emails', 'email');
  // Mismo nombre: si uno no tiene documento, siempre se pregunta (el caso "Juan Pérez").
  // Si los dos tienen documentos distintos, solo si además comparten nacionalidad.
  byValue('names', 'name', (g1, g2) => {
    const bothDocs = g1.key.startsWith('doc:') && g2.key.startsWith('doc:');
    return !bothDocs || overlaps(g1.nats, g2.nats);
  });

  // Nombre casi igual (un error de tipeo) y misma nacionalidad
  const buckets = {};
  guests.forEach((g) =>
    g.names.forEach((n) => {
      if (n.length < 8) return;
      g.nats.forEach((nat) => {
        const b = `${nat}|${n[0]}`;
        (buckets[b] = buckets[b] || []).push({ g, n });
      });
    })
  );
  Object.values(buckets).forEach((list) => {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const x = list[i];
        const y = list[j];
        if (x.g === y.g || x.n === y.n) continue;
        if (Math.abs(x.n.length - y.n.length) > 2) continue;
        if (distance(x.n, y.n) <= 2) add(x.g, y.g, 'similar');
      }
  });

  return Object.values(pairs)
    .filter((p) => !decidedDistinct(p.a, p.b))
    .map((p) => {
      const reasons = [...p.reasons];
      return {
        ...p,
        strength: Math.max(...reasons.map((r) => STRENGTH[r])),
        reasonText: reasons.map((r) => REASON_TEXT[r]).join(' · '),
      };
    })
    .sort((x, y) => y.strength - x.strength || x.a.name.localeCompare(y.a.name));
}
