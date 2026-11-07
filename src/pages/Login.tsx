/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
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
      setErr('Usuario o contraseña incorrectos');
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
      setErr('Por favor, escribe tu correo en el campo superior.');
      shake();
      return;
    }
    setErr('');
    
    // Activa el envío de correo real de recuperación
    const { error } = await supabase.auth.resetPasswordForEmail(uid);

    if (error) {
      setErr('Error al enviar el enlace. Revisa tu correo.');
      shake();
    } else {
      setRecoverySent(true);
      setTimeout(() => setRecoverySent(false), 5000);
    }
  };

  const si = {
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(255,255,255,.1)',
    border: '1px solid rgba(255,255,255,.2)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 12,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F172A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter',system-ui,sans-serif",
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
              color: '#fff',
              fontSize: 26,
              fontWeight: 800,
              margin: '0 0 4px',
              letterSpacing: -0.5,
            }}
          >
            Itzé Flow
          </motion.h1>
          <motion.p
            {...enter(0.18)}
            style={{ color: 'rgba(255,255,255,.45)', margin: 0, fontSize: 13 }}
          >
            Sistema de gestión de reservas
          </motion.p>
        </div>
        <motion.div {...enter(0.26)}>
        <motion.div
          animate={card}
          style={{
            background: 'rgba(255,255,255,.06)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 16,
            padding: 28,
          }}
        >
          <label
            style={{
              display: 'block',
              color: 'rgba(255,255,255,.5)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginBottom: 6,
            }}
          >
            Usuario
          </label>
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="Usuario"
            style={si}
          />
          <label
            style={{
              display: 'block',
              color: 'rgba(255,255,255,.5)',
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
                  color: '#FCA5A5',
                  fontSize: 12,
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
              padding: '12px',
              background: ok ? '#10B981' : '#3B82F6',
              border: 'none',
              borderRadius: 10,
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
              minHeight: 44,
            }}
          >
            {ok ? (
              <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING_POP}>
                ✓ ¡Hola!
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
          <div style={{ marginTop: 24, textAlign: 'center', height: 40 }}>
            <AnimatePresence mode="wait" initial={false}>
            {recoverySent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  color: '#34D399',
                  padding: '10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ✓ Los datos fueron enviados a itzehostel@gmail.com
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
                  color: 'rgba(255,255,255,.4)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                }}
              >
                Olvidé mis datos de ingreso
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
