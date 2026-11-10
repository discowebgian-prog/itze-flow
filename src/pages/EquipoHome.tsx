/* eslint-disable */
// @ts-nocheck
// Lo que ve el rol equipo (Mary) al entrar. Por ahora, una pantalla simple:
// su sección (habitaciones de hoy, tareas, insumos, Cotizar…) llega en los pasos 5 a 9
// del plan de estilo y fusión (claude/plan-estilo-y-limpieza.md). No ve nada del resto de Flow.
import { motion } from 'motion/react';
import { Icon } from '../components/ui/Icon';
import { SPRING_SHEET } from '../components/ui/Motion';
import { greeting, nowMerida, EQUIPO_PRONTO } from '../lib/voice';

export function EquipoHome({ user, onLogout }) {
  const now = nowMerida();
  const hello = greeting(user.name, now);
  const f = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const fecha = f.charAt(0).toUpperCase() + f.slice(1);
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)', padding: 'calc(env(safe-area-inset-top) + 28px) 20px 40px', boxSizing: 'border-box' }}>
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SHEET} style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 'var(--w-title)', letterSpacing: 'var(--ls-title)' }}>
          {hello.text} {hello.emoji}
        </h1>
        <div style={{ color: 'var(--mut)', fontSize: 17, fontWeight: 600, marginTop: 4 }}>{fecha}</div>

        <div className="ui-card" style={{ marginTop: 24, padding: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ flex: '0 0 auto', width: 40, height: 40, borderRadius: 20, background: 'var(--acc-limpieza)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkles" size={20} />
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{EQUIPO_PRONTO.title}</div>
            <div style={{ color: 'var(--ink-2)', fontSize: 15, marginTop: 6, lineHeight: 1.45 }}>{EQUIPO_PRONTO.body}</div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="ui-btn"
          style={{ marginTop: 20, width: '100%', padding: '13px 16px', borderRadius: 'var(--r-item)', border: 'none', background: 'var(--card)', color: 'var(--red)', fontWeight: 600, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          {EQUIPO_PRONTO.logout}
        </button>
      </motion.div>
    </div>
  );
}
