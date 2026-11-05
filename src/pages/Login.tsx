/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { supabase } from '../lib/supabase';

// ── LOGIN ─────────────────────────────────────────────────────────────────────
export function Login({ onLogin }) {
  const [uid, setUid] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  const go = async () => {
    setErr(''); // Limpia errores previos
    
    // Se conecta a la base de datos real de Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: uid,
      password: pw,
    });

    if (error) {
      setErr('Usuario o contraseña incorrectos');
    } else if (data.user) {
      // Usa la primera parte del correo como nombre temporal
      const nombreUsuario = data.user.email.split('@')[0];
      onLogin({ id: data.user.id, name: nombreUsuario, role: 'admin' });
    }
  };

  const handleRecovery = async () => {
    if (!uid) {
      setErr('Por favor, escribe tu correo en el campo superior.');
      return;
    }
    setErr('');
    
    // Activa el envío de correo real de recuperación
    const { error } = await supabase.auth.resetPasswordForEmail(uid);

    if (error) {
      setErr('Error al enviar el enlace. Revisa tu correo.');
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <img src="https://i.postimg.cc/3NDCCVdT/gecko2.png" alt="Itzé" style={{ width: 80, height: 80, objectFit: 'contain' }} />
          </div>
          <h1
            style={{
              color: '#fff',
              fontSize: 26,
              fontWeight: 800,
              margin: '0 0 4px',
              letterSpacing: -0.5,
            }}
          >
            Itzé Flow
          </h1>
          <p
            style={{ color: 'rgba(255,255,255,.45)', margin: 0, fontSize: 13 }}
          >
            Sistema de gestión de reservas
          </p>
        </div>
        <div
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
          {err && (
            <p
              style={{
                color: '#FCA5A5',
                fontSize: 12,
                margin: '0 0 10px',
                textAlign: 'center',
              }}
            >
              {err}
            </p>
          )}
          <button
            onClick={go}
            style={{
              width: '100%',
              padding: '12px',
              background: '#3B82F6',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginTop: 4,
            }}
          >
            Ingresar
          </button>
          
          {/* SECCIÓN: RECUPERACIÓN DE DATOS */}
          <div style={{ marginTop: 24, textAlign: 'center', height: 40 }}>
            {recoverySent ? (
              <div
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
              </div>
            ) : (
              <button
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
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
