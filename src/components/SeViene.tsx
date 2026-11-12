/* eslint-disable */
// @ts-nocheck
// ── "SE VIENE" (radar de eventos) ─────────────────────────────────────────────
// Se abre desde la píldora "Se viene" de Inicio (hoja desde abajo). Dos pestañas:
//   Ahora: los eventos que ya están en su momento de prepararse (según el tipo: Navidad con meses,
//          un evento deportivo con semanas), con cuánto hay reservado y qué hacer.
//   Todos: los próximos 12 meses, mes por mes (también los ocultos con "No nos interesa").
// "Nuevo para vos" = no lo vio esta persona (flow_vistos); al abrir la hoja queda visto para ella.
// Nada desaparece: lo visto sigue en la lista; "No nos interesa" lo saca de Ahora pero sigue en Todos.
import { useEffect, useRef, useState } from 'react';
import { ic } from './ui/Icon';
import { notify, notifyError } from '../lib/voice';
import {
  cargarEventos, marcarEvento, buscarAhora, esperarBusqueda, enVentana, reservadoPct, urgente, periodoSugerido,
  fechasTexto, cuandoTexto, leadDays,
} from '../lib/eventos';

const IMPACTO = {
  alto: { txt: 'Impacto alto', c: 'var(--c-B91C1C)', bg: 'var(--c-FEE2E2)' },
  medio: { txt: 'Impacto medio', c: 'var(--c-B45309)', bg: 'var(--c-FEF3C7)' },
  bajo: { txt: 'Impacto bajo', c: 'var(--mut)', bg: 'var(--fill)' },
};
const TIPO = {
  feriado: 'Feriado', temporada: 'Temporada', festival: 'Festival', cultural: 'Cultura', deportivo: 'Deporte',
  concierto: 'Concierto', congreso: 'Congreso', crucero: 'Crucero', religioso: 'Fiesta religiosa', otro: 'Evento',
};
const pill = (txt, c, bg) => (
  <span style={{ fontSize: 10.5, fontWeight: 800, color: c, background: bg, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{txt}</span>
);
const ultimaTexto = (u) => {
  if (!u) return 'Todavía no se buscó';
  const d = new Date(u.hecho_en);
  return 'Última búsqueda: ' + d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Merida' }).replace(/\./g, '');
};

// ── Estado del radar (lo usa Inicio para la píldora y la hoja) ──
export function useRadar() {
  const [st, setSt] = useState({ ok: null, eventos: [], ultima: null });
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef({ stop: false });
  const KEY = 'itze-eventos-buscando';

  const load = async () => {
    const r = await cargarEventos().catch(() => ({ ok: false, eventos: [], ultima: null }));
    setSt(r);
    return r;
  };
  // Espera el resultado de una búsqueda en curso (sigue aunque se cambie de pantalla y se vuelva)
  const esperar = async (prevId, desde, cancel) => {
    setBusy(true);
    const u = await esperarBusqueda(prevId, desde, cancel);
    if (cancel.stop) return;
    try { sessionStorage.removeItem(KEY); } catch {}
    setBusy(false);
    await load();
    if (!u) notify('La búsqueda está tardando más de lo normal. Fijate en un rato si aparecieron eventos.', 'info');
    else if (u.error && !u.total) notify('No se pudo completar la búsqueda de eventos. Probá de nuevo más tarde.', 'error');
    else notify(u.nuevos ? `Listo: ${u.nuevos === 1 ? 'apareció 1 evento nuevo' : `aparecieron ${u.nuevos} eventos nuevos`}.` : 'Listo: no hay eventos nuevos.');
  };
  useEffect(() => {
    const cancel = { stop: false };
    cancelRef.current = cancel;
    load().then(() => {
      let saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch {}
      if (saved && Date.now() - saved.desde < 6 * 60000) esperar(saved.prevId, saved.desde, cancel);
    });
    return () => { cancel.stop = true; };
  }, []);

  const buscar = async () => {
    setBusy(true);
    try {
      const prevId = st.ultima ? st.ultima.id : null;
      await buscarAhora();
      const desde = Date.now();
      try { sessionStorage.setItem(KEY, JSON.stringify({ prevId, desde })); } catch {}
      notify('Buscando eventos en internet. Tarda 1 a 4 minutos: podés seguir usando Flow.', 'info');
      esperar(prevId, desde, cancelRef.current);
    } catch (err) {
      setBusy(false);
      notifyError(err, 'buscar eventos');
    }
  };
  const marcar = async (e, estado, msg) => {
    try {
      await marcarEvento(e.id, estado);
      setSt((s) => ({ ...s, eventos: s.eventos.map((x) => (x.id === e.id ? { ...x, estado } : x)) }));
      if (msg) notify(msg, 'info');
    } catch (err) {
      notifyError(err, 'guardar el cambio');
    }
  };
  return { st, busy, buscar, marcar, load };
}

// Eventos en su momento (sin los ocultos): urgentes primero, después lo no visto, después por fecha
export function eventosAhora(radar, reservations, vistos) {
  const nuevo = (e) => vistos && !vistos.has('evento:' + e.id);
  const ahora = radar.st.eventos
    .filter((e) => e.estado !== 'descartado' && enVentana(e))
    .map((e) => ({ e, pct: reservadoPct(reservations, e) }));
  const rank = ({ e, pct }) => (urgente(e, pct) ? 0 : nuevo(e) ? 1 : 2);
  return ahora.sort((a, b) => rank(a) - rank(b) || a.e.fecha_desde.localeCompare(b.e.fecha_desde));
}

// ── La lista (dentro de la hoja) ──
// nuevos = ids que eran nuevos para esta persona al abrir (siguen con puntito mientras la hoja está abierta)
export function SeVieneLista({ radar, reservations, canEdit, onGoTo, nuevos }) {
  const [tab, setTab] = useState('ahora');
  const [open, setOpen] = useState(null);
  const { st, busy, buscar, marcar } = radar;
  const ahora = eventosAhora(radar, reservations, null);
  const todos = st.eventos.map((e) => ({ e, pct: reservadoPct(reservations, e) }));
  const proximos = st.eventos.filter((e) => e.estado !== 'descartado' && !enVentana(e)).length;

  const tarifa = (e) => {
    marcar(e, 'tarifa');
    onGoTo && onGoTo('tarifas', { nuevoPeriodo: periodoSugerido(e) });
  };

  const row = ({ e, pct }, i, full) => {
    const isOpen = open === e.id || (!full && open === null && i === 0);
    const imp = IMPACTO[e.impacto] || IMPACTO.medio;
    const oculto = e.estado === 'descartado';
    const urg = !oculto && urgente(e, pct);
    const pctCol = pct >= 70 ? 'var(--c-047857)' : pct >= 40 ? 'var(--c-B45309)' : 'var(--c-B91C1C)';
    return (
      <div key={e.id} className="li-in ui-row" style={{ '--i': i, display: 'block', opacity: oculto ? 0.55 : 1 }}>
        <div onClick={() => setOpen(isOpen ? -1 : e.id)} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {nuevos && nuevos.has(e.id) && <span title="Nuevo para vos" style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--red)', flexShrink: 0 }} />}
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{e.nombre}</span>
            {pill(imp.txt, imp.c, imp.bg)}
            {e.confianza !== 'confirmado' && pill('Verificar fecha', 'var(--mut)', 'var(--fill)')}
            {urg && pill('¡Prepararse ya!', '#fff', 'var(--c-DC2626)')}
            {oculto && pill('Oculto', 'var(--mut)', 'var(--fill)')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>
            {fechasTexto(e)} · <b>{cuandoTexto(e)}</b>
            {e.lugar ? ` · ${e.lugar}` : ''} · {TIPO[e.tipo] || 'Evento'}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 3, color: pctCol, fontWeight: 700 }}>
            {pct === 0 ? 'Todavía no hay nada reservado esas noches' : `Ya tenés ${pct}% reservado esas noches`}
          </div>
          {full && !oculto && !enVentana(e) && (
            <div style={{ fontSize: 11.5, color: 'var(--mut)', marginTop: 2 }}>Pasa a "Ahora" unos {leadDays(e)} días antes.</div>
          )}
        </div>
        {isOpen && (
          <div className="pop-in" style={{ marginTop: 8 }}>
            {e.descripcion && <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45 }}>{e.descripcion}</div>}
            {e.publico && <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 4 }}>{ic('users', 13)}Quiénes vienen: {e.publico}</div>}
            {Array.isArray(e.ideas) && e.ideas.length > 0 && (
              <div style={{ background: 'var(--inset)', borderRadius: 12, padding: '8px 11px', marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--mut)', textTransform: 'uppercase', marginBottom: 4 }}>{ic('target', 12)}Qué hacer</div>
                {e.ideas.map((t, k) => (
                  <div key={k} style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45, display: 'flex', gap: 6, marginTop: k ? 4 : 0 }}>
                    <span style={{ color: 'var(--acc)' }}>•</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
              {canEdit && !oculto && (
                <button type="button" className="tap" onClick={() => tarifa(e)} style={btn('var(--acc)', '#fff')}>
                  {ic('tag', 13)}Crear fecha especial
                </button>
              )}
              {e.fuente_url && (
                <a href={e.fuente_url} target="_blank" rel="noopener noreferrer" className="tap" style={{ ...btn('var(--acc-soft)', 'var(--acc)'), textDecoration: 'none' }}>
                  {ic('link', 13)}Ver fuente
                </a>
              )}
              {!oculto ? (
                <button type="button" onClick={() => marcar(e, 'descartado', 'Listo: ya no aparece en "Ahora". Sigue en "Todos".')} style={link}>
                  No nos interesa
                </button>
              ) : (
                <button type="button" onClick={() => marcar(e, 'visto', 'Volvió a la lista.')} style={link}>
                  Volver a mostrar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Encabezado de cada mes en "Todos": "Diciembre 2026 · 3 eventos"
  const mesHdr = (lista, i) => {
    const mk = lista[i].e.fecha_desde.slice(0, 7);
    if (i > 0 && lista[i - 1].e.fecha_desde.slice(0, 7) === mk) return null;
    const n = lista.filter((y) => y.e.fecha_desde.slice(0, 7) === mk).length;
    const [yy, mm] = mk.split('-').map(Number);
    const nom = new Date(yy, mm - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
    return (
      <div style={{ padding: '12px 16px 4px', fontSize: 12, fontWeight: 800, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: 0.3, borderTop: i ? '1px solid var(--line)' : 'none' }}>
        {nom} · {n === 1 ? '1 evento' : `${n} eventos`}
      </div>
    );
  };

  const tabBtn = (k, label) => (
    <button
      type="button"
      onClick={() => { setTab(k); setOpen(null); }}
      style={{
        flex: 1, padding: '8px 10px', border: 'none', borderRadius: 10, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
        background: tab === k ? 'var(--card)' : 'transparent', color: tab === k ? 'var(--ink)' : 'var(--mut)', boxShadow: tab === k ? 'var(--shadow)' : 'none',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, background: 'var(--fill)', borderRadius: 12, padding: 3, marginBottom: 12 }}>
        {tabBtn('ahora', `Ahora${ahora.length ? ` (${ahora.length})` : ''}`)}
        {tabBtn('todos', `Todos · 12 meses (${st.eventos.length})`)}
      </div>
      <div className="ui-card" style={{ padding: '2px 0' }}>
        {tab === 'ahora' ? (
          ahora.length === 0 ? (
            <div style={{ fontSize: 13.5, color: 'var(--mut)', padding: '14px 16px' }}>
              {st.eventos.length === 0
                ? 'Todavía no hay eventos. Tocá "Buscar ahora" para la primera búsqueda.'
                : `Nada para preparar por ahora. Hay ${proximos === 1 ? '1 evento' : `${proximos} eventos`} más adelante: pasan acá cuando sea momento.`}
            </div>
          ) : (
            ahora.map((x, i) => row(x, i, false))
          )
        ) : todos.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--mut)', fontSize: 13.5 }}>Todavía no hay eventos.</div>
        ) : (
          todos.map((x, i) => (
            <div key={x.e.id}>
              {mesHdr(todos, i)}
              {row(x, i, true)}
            </div>
          ))
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 4px 4px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, color: 'var(--mut)' }}>{ultimaTexto(st.ultima)} · se busca solo cada lunes</span>
        <button type="button" onClick={buscar} disabled={busy} style={{ ...link, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? 'Buscando… (1 a 4 min)' : 'Buscar ahora'}
        </button>
      </div>
    </div>
  );
}

const btn = (bg, color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 2, padding: '7px 12px', background: bg, color, border: 'none',
  borderRadius: 20, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', minHeight: 34,
});
const link = { background: 'none', border: 'none', padding: 0, color: 'var(--acc)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' };
