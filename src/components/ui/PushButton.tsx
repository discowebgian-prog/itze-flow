/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { Icon } from './Icon';
import { pushSupported, pushGranted, pushBlocked, isIOS, isStandalone, enablePush } from '../../lib/push';
import { notify, notifyError } from '../../lib/voice';

// "🔔 Activar avisos": que lleguen al celular aunque Flow esté cerrado.
// Desaparece cuando ya están activos en este aparato.
export function PushButton({ deviceName }) {
  const [state, setState] = useState(() => (pushGranted() ? 'on' : pushBlocked() ? 'blocked' : 'off'));
  const [help, setHelp] = useState('');
  if (state === 'on') return null;

  const iosNeedsInstall = !pushSupported() && isIOS() && !isStandalone();
  const click = async () => {
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
    <div>
      <button
        className="tap"
        onClick={click}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 20,
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          border: 'none',
          background: 'var(--acc-soft)',
          color: 'var(--acc)',
        }}
      >
        <Icon name="bell" size={16} />
        Activar avisos en este aparato
      </button>
      {help && (
        <div className="pop-in" style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.45, maxWidth: 420 }}>
          {help}
        </div>
      )}
    </div>
  );
}
