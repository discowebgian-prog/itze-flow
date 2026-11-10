/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { motion, AnimatePresence, useAnimationControls } from 'motion/react';
import { supabase } from '../lib/supabase';
import { SPRING_POP, SPRING_SHEET } from '../components/ui/Motion';

// Entrada por partes: logo, título y tarjeta, uno detrás del otro
const enter = (delay) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { ...SPRING_SHEET, delay },
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
export function Login({ onLogin }) {
  const [uid, setUid] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const [busy, setBusy] = useState(false); // esperando la respuesta
  const [ok, setOk] = useState(false); // ingresó: botón verde con ✓ antes de pasar a la app
  const card = useAnimationControls();
  // Sacudida tipo iPhone cuando algo está mal
  const shake = () => card.start({ x: [0, -12, 11, -8, 7, -4, 3, 0], transition: { duration: 0.45 } });

  const go = async () => {
    if (busy || ok) return;
    setErr(''); // Limpia errores previos
    setBusy(true);

    // Se conecta a la base de datos real de Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: uid,
      password: pw,
    });
    setBusy(false);

    if (error) {
      // Datos mal o sin internet: no es lo mismo, así que se dice distinto
      const net = !navigator.onLine || /fetch|network|load failed/i.test(error.message || '');
      setErr(net ? 'No hay conexión. Revisá el internet y probá de nuevo.' : 'El correo o la contraseña no coinciden. Probá de nuevo.');
      shake();
    } else if (data.user) {
      // Usa la primera parte del correo como nombre temporal
      const nombreUsuario = data.user.email.split('@')[0];
      setOk(true);
      // Un instante para ver el ✓ y pasar a la app (que entra con un fundido)
      setTimeout(() => onLogin({ id: data.user.id, name: nombreUsuario, role: 'admin' }), 380);
    }
  };

  const handleRecovery = async () => {
    if (!uid) {
      setErr('Escribí tu correo arriba y te mando el enlace para cambiar la contraseña.');
      shake();
      return;
    }
    setErr('');
    
    // Activa el envío de correo real de recuperación
    const { error } = await supabase.auth.resetPasswordForEmail(uid);

    if (error) {
      setErr('No se pudo enviar el enlace. Revisá que el correo esté bien escrito y probá de nuevo.');
      shake();
    } else {
      setRecoverySent(true);
      setTimeout(() => setRecoverySent(false), 8000);
    }
  };

  const si = {
    width: '100%',
    padding: '11px 14px',
    background: 'var(--fill)',
    border: '1px solid transparent',
    borderRadius: 'var(--r-field)',
    color: 'var(--ink)',
    fontSize: 16,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 12,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font)',
        padding: 20,
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING_POP, delay: 0.05 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <img src="https://i.postimg.cc/3NDCCVdT/gecko2.png" alt="Itzé" style={{ width: 80, height: 80, objectFit: 'contain' }} />
          </motion.div>
          <motion.h1
            {...enter(0.12)}
            style={{
              color: 'var(--ink)',
              fontSize: 30,
              fontWeight: 'var(--w-title)',
              margin: '0 0 4px',
              letterSpacing: 'var(--ls-title)',
            }}
          >
            Itzé Flow
          </motion.h1>
          <motion.p
            {...enter(0.18)}
            style={{ color: 'var(--mut)', margin: 0, fontSize: 15 }}
          >
            Sistema de gestión de reservas
          </motion.p>
        </div>
        <motion.div {...enter(0.26)}>
        <motion.div
          animate={card}
          style={{
            background: 'var(--card)',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--shadow)',
            padding: '24px 22px 18px',
          }}
        >
          <label
            style={{
              display: 'block',
              color: 'var(--mut)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginBottom: 6,
            }}
          >
            Correo
          </label>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="tu@correo.com"
            style={si}
          />
          <label
            style={{
              display: 'block',
              color: 'var(--mut)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginBottom: 6,
            }}
          >
            Contraseña
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
            placeholder="••••••••"
            style={si}
          />
          <AnimatePresence initial={false}>
            {err && (
              <motion.p
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  color: 'var(--red)',
                  fontSize: 13.5,
                  fontWeight: 600,
                  margin: '0 0 10px',
                  textAlign: 'center',
                  overflow: 'hidden',
                }}
              >
                {err}
              </motion.p>
            )}
          </AnimatePresence>
          <button
            onClick={go}
            disabled={busy}
            style={{
              width: '100%',
              padding: '13px',
              background: ok ? 'var(--c-34C759)' : 'var(--acc)',
              border: 'none',
              borderRadius: 'var(--r-field)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'inherit',
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 48,
              transition: 'background .2s',
            }}
          >
            {ok ? (
              <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING_POP}>
                <Icon name="tick" size={18} strokeWidth={3} style={{ verticalAlign: '-0.2em', marginRight: 4 }} />¡Hola!
              </motion.span>
            ) : busy ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', display: 'inline-block' }}
                />
                Ingresando…
              </>
            ) : (
              'Ingresar'
            )}
          </button>
          
          {/* SECCIÓN: RECUPERACIÓN DE DATOS */}
          <div style={{ marginTop: 18, textAlign: 'center', minHeight: 40 }}>
            <AnimatePresence mode="wait" initial={false}>
            {recoverySent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: 'var(--c-DCFCE7)',
                  color: 'var(--c-15803D)',
                  padding: '10px 12px',
                  borderRadius: 'var(--r-field)',
                  fontSize: 13.5,
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                <Icon name="check" size={15} style={{ verticalAlign: '-0.2em', marginRight: 5 }} />
                Te mandamos el enlace a {uid.trim()}. Revisá el correo (también el spam).
              </motion.div>
            ) : (
              <motion.button
                key="ask"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={handleRecovery}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--acc)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 8,
                  fontFamily: 'inherit',
                }}
              >
                Olvidé mi contraseña
              </motion.button>
            )}
            </AnimatePresence>
          </div>

        </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
