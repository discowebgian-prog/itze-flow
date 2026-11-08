/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { pushSupported, pushGranted, pushBlocked, isIOS, isStandalone, enablePush, pushConfigured } from '../../lib/push';
import { notify, notifyError } from '../../lib/voice';

// "🔔 Activar avisos": que lleguen al celular aunque Flow esté cerrado.
// Desaparece cuando ya están activos en este aparato.
export function PushButton({ deviceName }) {
  const [state, setState] = useState(() => (pushGranted() ? 'on' : pushBlocked() ? 'blocked' : 'off'));
  const [help, setHelp] = useState('');
  if (state === 'on') return null;

  const iosNeedsInstall = !pushSupported() && isIOS() && !isStandalone();
  const click = async () => {
    if (!pushConfigured()) {
      setHelp('Todavía faltan las claves de avisos en Vercel (VITE_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY).');
      return;
    }
    if (iosNeedsInstall) {
      setHelp('En iPhone: abrí Flow en Safari, tocá Compartir › "Agregar a pantalla de inicio" y abrí la app desde ese ícono. Ahí tocá otra vez "Activar avisos".');
      return;
    }
    if (!pushSupported()) {
      setHelp('Este navegador no permite avisos. Probá desde Chrome, Edge o Safari actualizados.');
      return;
    }
    if (state === 'blocked') {
      setHelp('Los avisos están bloqueados para Flow en este aparato. Se activan desde los ajustes del navegador (o de la app) para este sitio.');
      return;
    }
    try {
      const r = await enablePush(deviceName);
      if (r === 'ok') {
        setState('on');
        notify('Listo · los avisos van a llegar a este aparato aunque Flow esté cerrado');
      } else if (r === 'denied') {
        setState(pushBlocked() ? 'blocked' : 'off');
        setHelp('No se dio el permiso. Si te arrepentís, se activa desde los ajustes del navegador para este sitio.');
      }
    } catch (e) {
      notifyError(e, 'activar los avisos');
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        className="tap"
        onClick={click}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 20,
          fontFamily: 'inherit',
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          border: '1px solid #BFDBFE',
          background: '#EFF6FF',
          color: '#1D4ED8',
        }}
      >
        🔔 Activar avisos en este aparato
      </button>
      {help && (
        <div className="pop-in" style={{ marginTop: 6, fontSize: 12, color: '#475569', lineHeight: 1.45, maxWidth: 420 }}>
          {help}
        </div>
      )}
    </div>
  );
}
