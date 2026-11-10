/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { PS } from '../lib/constants';
import { Icon, ic } from '../components/ui/Icon';

// ── PROPERTIES PAGE (NOTAS Y CHECKLIST DE TAREAS - DISEÑO PREMIUM) ───────────
export function PropertiesPage({
  properties,
  reservations,
  notes,
  setNotes,
  checklists,
  setChecklists,
  propStatus,
  setPropStatus,
  initProp,
  onGoTo, 
}) {
  const [ap, setAp] = useState(initProp || properties[0]?.id);
  const [sub, setSub] = useState('notas'); // Por defecto arranca en Notas
  const [editNote, setEditNote] = useState(false);
  const [newItemText, setNewItemText] = useState(''); 

  const prop = properties.find((p) => p.id === ap);
  
  // Resguardo por si el estado dinámico aún no se cargó
  const currentChecklist = checklists[ap] || { items: [], checked: {} };
  const items = currentChecklist.items || [];
  const checked = currentChecklist.checked || {};
  const done = Object.values(checked).filter(Boolean).length;

  // Agregar una nueva tarea operativa
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    
    setChecklists((prev) => {
      const propData = prev[ap] || { items: [], checked: {} };
      return {
        ...prev,
        [ap]: {
          ...propData,
          items: [...(propData.items || []), newItemText.trim()]
        }
      };
    });
    setNewItemText('');
  };

  // Eliminar una tarea operativa específica
  const handleRemoveItem = (indexToRemove) => {
    setChecklists((prev) => {
      const propData = prev[ap] || { items: [], checked: {} };
      const newItems = (propData.items || []).filter((_, idx) => idx !== indexToRemove);
      
      const newChecked = {};
      Object.keys(propData.checked || {}).forEach((key) => {
        const numericKey = parseInt(key, 10);
        if (numericKey < indexToRemove) {
          newChecked[numericKey] = propData.checked[numericKey];
        } else if (numericKey > indexToRemove) {
          newChecked[numericKey - 1] = propData.checked[numericKey];
        }
      });

      return {
        ...prev,
        [ap]: { items: newItems, checked: newChecked }
      };
    });
  };

  const card = { background: 'var(--card)', borderRadius: 'var(--r-card)', boxShadow: 'var(--shadow)', padding: '16px 16px 14px' };
  const seg = (on) => ({
    flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', fontFamily: 'inherit', fontWeight: on ? 700 : 600,
    fontSize: 14, cursor: 'pointer', background: on ? 'var(--card)' : 'transparent', color: on ? 'var(--ink)' : 'var(--mut)',
    boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    transition: 'background .15s',
  });

  return (
    <div>
      <h2 style={{ margin: '0 0 14px', fontSize: 30, fontWeight: 'var(--w-title)', color: 'var(--ink)', letterSpacing: 'var(--ls-title)' }}>
        Propiedades
      </h2>

      {/* Selector de propiedad (solo si hay más de una) */}
      {properties.length > 1 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 2 }}>
          {properties.map((p, liI) => {
            const on = ap === p.id;
            return (
              <button
                className="li-in ui-pill"
                key={p.id}
                onClick={() => {
                  setAp(p.id);
                  setSub('notas');
                }}
                style={{
                  '--i': liI, flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: on ? 'var(--acc)' : 'var(--fill)', color: on ? '#fff' : 'var(--ink)',
                }}
              >
                <Icon name="building" size={15} />
                {p.name}
              </button>
            );
          })}
        </div>
      )}

      {prop && (
        <>
          {/* Encabezado de la propiedad */}
          <div style={{ ...card, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--acc-soft)', color: 'var(--acc)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="building" size={22} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 'var(--w-title)', fontSize: 18, color: 'var(--ink)' }}>{prop.name}</div>
                <div style={{ fontSize: 13, color: 'var(--mut)', textTransform: 'capitalize' }}>{prop.type}</div>
              </div>
            </div>

            <select
              value={propStatus[ap] || 'libre'}
              onChange={(e) => setPropStatus((s) => ({ ...s, [ap]: e.target.value }))}
              style={{
                fontSize: 13, fontWeight: 700,
                color: PS[propStatus[ap]]?.color || '#10B981',
                background: PS[propStatus[ap]]?.bg || '#D1FAE5',
                border: 'none', borderRadius: 20, padding: '7px 12px', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {Object.entries(PS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notas / Tareas: control segmentado de iPhone */}
          <div style={{ display: 'flex', background: 'var(--fill)', borderRadius: 10, padding: 2, gap: 2, marginBottom: 14 }}>
            <button onClick={() => setSub('notas')} style={seg(sub === 'notas')}>
              <Icon name="edit" size={15} />
              Notas
            </button>
            <button onClick={() => setSub('tareas')} style={seg(sub === 'tareas')}>
              <Icon name="list" size={15} />
              Tareas{items.length > 0 ? ` (${done}/${items.length})` : ''}
            </button>
          </div>

          {/* VISTA: NOTAS */}
          {sub === 'notas' && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 'var(--w-title)', fontSize: 18, color: 'var(--ink)' }}>Notas internas</div>
                <button
                  onClick={() => setEditNote((x) => !x)}
                  style={{
                    background: editNote ? 'var(--fill)' : 'var(--acc-soft)', border: 'none', borderRadius: 20, padding: '7px 14px',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                    color: editNote ? 'var(--ink)' : 'var(--acc)', display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Icon name={editNote ? 'close' : 'edit'} size={14} />
                  {editNote ? 'Cerrar' : 'Editar'}
                </button>
              </div>
              {editNote ? (
                <div>
                  <textarea
                    value={notes[ap] || ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [ap]: e.target.value }))}
                    rows={8}
                    style={{
                      width: '100%', padding: '11px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-field)',
                      background: 'var(--card)', color: 'var(--ink)', fontSize: 15, lineHeight: 1.5, fontFamily: 'inherit',
                      outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                  <button
                    onClick={() => setEditNote(false)}
                    style={{
                      marginTop: 10, width: '100%', minHeight: 46, background: 'var(--acc)', color: '#fff', border: 'none',
                      borderRadius: 'var(--r-field)', fontFamily: 'inherit', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                    }}
                  >
                    Guardar notas
                  </button>
                </div>
              ) : (
                <pre
                  style={{
                    margin: 0, fontFamily: 'inherit', fontSize: 15, color: notes[ap] ? 'var(--ink)' : 'var(--mut)',
                    whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'var(--bg)', borderRadius: 'var(--r-item)', padding: '12px 14px',
                  }}
                >
                  {notes[ap] || 'Todavía no hay notas para esta propiedad.'}
                </pre>
              )}
            </div>
          )}

          {/* VISTA: TAREAS (checklist editable) */}
          {sub === 'tareas' && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 'var(--w-title)', fontSize: 18, color: 'var(--ink)' }}>Tareas</div>
                  <div style={{ fontSize: 13, color: 'var(--mut)' }}>
                    {items.length === 0 ? 'Sin tareas' : done === items.length ? 'Todas hechas' : `${done} de ${items.length} hechas`}
                  </div>
                </div>
                {done > 0 && (
                  <button
                    onClick={() => setChecklists((c) => ({ ...c, [ap]: { items: items, checked: {} } }))}
                    style={{
                      background: 'var(--fill)', color: 'var(--ink)', border: 'none', borderRadius: 20, padding: '7px 14px',
                      fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Icon name="repeat" size={14} />
                    Desmarcar todo
                  </button>
                )}
              </div>

              {items.length > 0 && (
                <div style={{ height: 6, background: 'var(--fill)', borderRadius: 4, marginBottom: 14, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%', background: '#34C759', borderRadius: 4,
                      width: Math.round((done / items.length) * 100) + '%', transition: 'width .3s',
                    }}
                  />
                </div>
              )}

              {/* Agregar tarea */}
              <form onSubmit={handleAddItem} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Ej: Comprar foco para el baño de P1"
                  style={{
                    flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-field)',
                    background: 'var(--card)', color: 'var(--ink)', fontSize: 15, fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  aria-label="Agregar tarea"
                  style={{
                    width: 44, height: 44, flexShrink: 0, background: 'var(--acc)', color: '#fff', border: 'none', borderRadius: '50%',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >
                  <Icon name="plus" size={20} strokeWidth={2.5} />
                </button>
              </form>

              {/* Lista de tareas tipo iPhone */}
              {items.map((item, i) => (
                <div key={i} className="ui-row" style={{ cursor: 'default', gap: 12, padding: '11px 2px' }}>
                  <button
                    type="button"
                    aria-label={checked[i] ? 'Marcar como pendiente' : 'Marcar como hecha'}
                    onClick={() => setChecklists((c) => ({
                          ...c,
                          [ap]: { items: items, checked: { ...checked, [i]: !checked[i] } },
                        }))}
                    style={{
                      width: 24, height: 24, borderRadius: '50%', padding: 0, flexShrink: 0, cursor: 'pointer',
                      border: `2px solid ${checked[i] ? '#34C759' : 'var(--handle)'}`,
                      background: checked[i] ? '#34C759' : 'transparent', color: '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {checked[i] && <Icon name="tick" size={14} strokeWidth={3.5} />}
                  </button>

                  <span
                    style={{
                      flex: 1, fontSize: 15, cursor: 'pointer',
                      color: checked[i] ? 'var(--mut)' : 'var(--ink)',
                      textDecoration: checked[i] ? 'line-through' : 'none',
                    }}
                    onClick={() => setChecklists((c) => ({
                          ...c,
                          [ap]: { items: items, checked: { ...checked, [i]: !checked[i] } },
                        }))}
                  >
                    {item}
                  </span>

                  <button
                    type="button"
                    aria-label="Borrar tarea"
                    onClick={() => handleRemoveItem(i)}
                    style={{
                      background: 'var(--fill)', border: 'none', color: 'var(--mut)', cursor: 'pointer',
                      width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0,
                    }}
                  >
                    <Icon name="close" size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ))}

              {items.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--mut)', padding: '18px 0 6px', fontSize: 14 }}>
                  No hay tareas. Escribí una arriba y tocá +.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
