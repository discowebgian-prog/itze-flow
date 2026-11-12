/* eslint-disable */
// @ts-nocheck
// ── Finanzas › Respaldos (hoja) ───────────────────────────────────────────────
// Lista de respaldos con Descargar, "Hacer respaldo ahora", carpeta de la compu y estado del correo.
import { useEffect, useState } from 'react';
import { Icon, ic } from './ui/Icon';
import { notify, notifyError } from '../lib/voice';
import {
  listarRespaldos, descargarRespaldo, hacerRespaldoAhora, cuandoTexto, pesoTexto,
  carpetaSoportada, carpetaGuardada, elegirCarpeta, olvidarCarpeta, permisoCarpeta, guardarEnCarpeta, ultimoLocal,
} from '../lib/respaldos';

const P = { margin: '0 16px 12px', fontSize: 14, color: 'var(--mut)', lineHeight: 1.45 };
const BTN = { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' };

export function Respaldos({ who }) {
  const [lista, setLista] = useState(null);
  const [faltaSql, setFaltaSql] = useState(false);
  const [haciendo, setHaciendo] = useState(false);
  const [bajando, setBajando] = useState(null);
  const [carpeta, setCarpeta] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const soporta = carpetaSoportada();

  const cargar = async () => {
    const r = await listarRespaldos();
    if (r.error) notifyError(r.error, 'cargar los respaldos');
    setFaltaSql(r.faltaSql);
    setLista(r.lista);
  };
  useEffect(() => {
    cargar();
    carpetaGuardada().then(setCarpeta);
  }, []);

  const ultimo = lista?.[0];
  const ultCorreo = (lista || []).find((r) => r.resumen?.correo === 'enviado');
  const correoMal = (lista || []).find((r) => r.resumen?.correo && r.resumen.correo !== 'no tocaba');
  const correoEstado = correoMal?.resumen?.correo || '';

  const ahora = async () => {
    setHaciendo(true);
    try {
      const r = await hacerRespaldoAhora(who || 'Dueños');
      const c = r?.resumen?.correo;
      notify(
        c === 'enviado' ? 'Listo, respaldo hecho y enviado a tu correo.' : 'Listo, respaldo hecho.',
        'ok',
      );
      await cargar();
      if (carpeta) await guardarAca(true);
    } catch (e) {
      notifyError(e, 'hacer el respaldo');
    } finally {
      setHaciendo(false);
    }
  };

  const bajar = async (r) => {
    setBajando(r.id);
    try { await descargarRespaldo(r.id); } catch (e) { notifyError(e, 'descargar el respaldo'); } finally { setBajando(null); }
  };

  // Guarda el último respaldo en la carpeta (con el toque, así el navegador puede pedir permiso)
  const guardarAca = async (silencioso = false) => {
    const h = carpeta || (await carpetaGuardada());
    const l = (await listarRespaldos()).lista;
    if (!h || !l[0]) return;
    try {
      if ((await permisoCarpeta(h, true)) !== 'granted') {
        if (!silencioso) notify('Sin permiso para escribir en esa carpeta. Tocá "Guardar ahora" y elegí Permitir.', 'error');
        return;
      }
      const nombre = await guardarEnCarpeta(h, l[0]);
      if (!silencioso) notify(`Guardado en "${h.name}": ${nombre}`, 'ok');
      setCarpeta(h);
    } catch (e) {
      notifyError(e, 'guardar en la carpeta');
    }
  };

  const elegir = async () => {
    try {
      const h = await elegirCarpeta();
      setCarpeta(h);
      const l = (await listarRespaldos()).lista;
      if (l[0]) {
        const nombre = await guardarEnCarpeta(h, l[0]);
        notify(`Listo. Desde ahora Flow guarda los respaldos en "${h.name}". Ya dejé el último: ${nombre}`, 'ok');
      } else notify(`Listo. Flow va a guardar los respaldos en "${h.name}".`, 'ok');
    } catch (e) {
      if (e?.name !== 'AbortError') notifyError(e, 'elegir la carpeta');
    }
  };

  if (lista === null) return <p style={{ ...P, margin: 16 }}>Cargando respaldos…</p>;

  if (faltaSql) {
    return (
      <div className="ui-group">
        <h3><Icon name="warning" size={20} color="var(--c-D97706)" />Falta un paso</h3>
        <p style={P}>Para que los respaldos funcionen hay que correr <b>supabase/respaldos.sql</b> en Supabase (SQL Editor).</p>
      </div>
    );
  }

  const visibles = verTodos ? lista : lista.slice(0, 7);

  return (
    <div>
      {/* Estado */}
      <div className="ui-group">
        <h3><Icon name="shield" size={20} color="var(--acc)" strokeWidth={2.2} />
          {ultimo ? `Último respaldo: ${cuandoTexto(ultimo.creado_en)}` : 'Todavía no hay respaldos'}
        </h3>
        <p style={P}>
          {ultimo
            ? <>Con {ultimo.resumen?.reservas ?? '—'} reservas, {ultimo.resumen?.huespedes ?? '—'} huéspedes y {ultimo.resumen?.gastos ?? '—'} gastos. </>
            : <>El primero se hace solo esta noche. </>}
          Todas las noches a las 3:00 Flow arma una planilla con todo. Se guardan las últimas 30 y una por mes del último año.
        </p>
        <div style={{ padding: '0 16px 12px' }}>
          <button className="ui-btn tap" disabled={haciendo} onClick={ahora} style={{ ...BTN, width: '100%', justifyContent: 'center', opacity: haciendo ? 0.7 : 1 }}>
            <Icon name="shield" size={17} />{haciendo ? 'Haciendo el respaldo…' : 'Hacer respaldo ahora'}
          </button>
        </div>
      </div>

      {/* En esta compu */}
      <div className="ui-group">
        <h3><Icon name="folderDown" size={20} color="var(--c-10B981)" strokeWidth={2.2} />En esta compu</h3>
        {!soporta ? (
          <p style={P}>Desde este aparato no se puede guardar solo en una carpeta. Abrí Flow en la compu con Chrome o Edge para activarlo; mientras, podés usar Descargar.</p>
        ) : !carpeta ? (
          <>
            <p style={P}>Elegí una carpeta de la compu (por ejemplo, una que se llame "Respaldos Flow"). Cada vez que abras Flow acá, guarda ahí solo el respaldo nuevo.</p>
            <div style={{ padding: '0 16px 12px' }}>
              <button className="ui-btn g tap" onClick={elegir} style={BTN}><Icon name="folderDown" size={17} />Elegir carpeta</button>
            </div>
          </>
        ) : (
          <>
            <p style={P}>
              Guarda en la carpeta <b style={{ color: 'var(--ink)' }}>"{carpeta.name}"</b>.{' '}
              {ultimo && ultimoLocal() === ultimo.id ? 'Ya tiene el último.' : 'Falta guardar el último.'}{' '}
              Si Chrome pregunta, elegí <b style={{ color: 'var(--ink)' }}>"Permitir en cada visita"</b>.
            </p>
            <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="ui-btn g tap" onClick={() => guardarAca()} style={BTN}><Icon name="download" size={17} />Guardar ahora</button>
              <button className="ui-pill tap" onClick={elegir} style={BTN}>Cambiar carpeta</button>
              <button className="ui-pill tap" onClick={async () => { await olvidarCarpeta(); setCarpeta(null); }} style={{ ...BTN, color: 'var(--mut)' }}>Dejar de guardar</button>
            </div>
          </>
        )}
      </div>

      {/* Por correo */}
      <div className="ui-group">
        <h3><Icon name="send" size={20} color="var(--c-8B5CF6)" strokeWidth={2.2} />Por correo</h3>
        <p style={P}>
          {correoEstado === 'enviado' || ultCorreo
            ? <>Llega a tu correo los lunes, el día 1 de cada mes y cada vez que tocás "Hacer respaldo ahora". Último enviado: {cuandoTexto(ultCorreo?.creado_en)}.</>
            : correoEstado === 'sin configurar' || !correoEstado
              ? <>Todavía no está conectado el envío de correos. Cuando esté, el respaldo llega los lunes y el día 1 de cada mes.</>
              : <>El último envío no salió: {correoEstado}</>}
        </p>
      </div>

      {/* Lista */}
      {lista.length > 0 && (
        <div className="ui-group">
          <h3><Icon name="history" size={20} color="var(--mut)" strokeWidth={2.2} />Respaldos guardados ({lista.length})</h3>
          {visibles.map((r) => (
            <div key={r.id} className="ui-row li-in" style={{ cursor: 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 15 }}>{cuandoTexto(r.creado_en)}</div>
                <div style={{ fontSize: 13, color: 'var(--mut)' }}>
                  {r.origen === 'manual' ? `A mano${r.hecho_por ? `, ${r.hecho_por}` : ''}` : 'Automático'}
                  {r.resumen?.reservas != null ? ` · ${r.resumen.reservas} reservas` : ''}
                  {r.tamano ? ` · ${pesoTexto(r.tamano)}` : ''}
                </div>
              </div>
              <button className="ui-pill tap" disabled={bajando === r.id} onClick={() => bajar(r)} style={{ ...BTN, color: 'var(--acc)' }}>
                <Icon name="download" size={15} />{bajando === r.id ? 'Bajando…' : 'Descargar'}
              </button>
            </div>
          ))}
          {lista.length > 7 && (
            <div className="ui-row" onClick={() => setVerTodos((x) => !x)} style={{ color: 'var(--acc)', fontSize: 14, fontWeight: 600 }}>
              {verTodos ? 'Ver menos' : `Ver los ${lista.length}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
