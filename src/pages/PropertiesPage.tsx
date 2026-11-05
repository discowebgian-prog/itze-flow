/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { PS } from '../lib/constants';

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

  return (
    <div>
      <h2
        style={{
          margin: '0 0 16px',
          fontSize: 20,
          fontWeight: 800,
          color: '#111',
        }}
      >
        Propiedades
      </h2>
      
      {/* Selector superior de Propiedades */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          marginBottom: 18,
          paddingBottom: 4,
        }}
      >
        {properties.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setAp(p.id);
              setSub('notas'); 
            }}
            style={{
              flexShrink: 0,
              padding: '7px 14px',
              borderRadius: 20,
              border: `1.5px solid ${ap === p.id ? p.color : '#E5E7EB'}`,
              background: ap === p.id ? p.color + '18' : '#fff',
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              color: ap === p.id ? '#111' : '#9CA3AF',
              whiteSpace: 'nowrap',
            }}
          >
            {p.emoji} {p.name}
          </button>
        ))}
      </div>

      {prop && (
        <>
          {/* Encabezado Principal */}
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 14,
              border: '1px solid #F0F0F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 28 }}>{prop.emoji}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>
                  {prop.name}
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'capitalize' }}>
                  {prop.type}
                </div>
              </div>
            </div>
            
            <select
              value={propStatus[ap] || 'libre'}
              onChange={(e) =>
                setPropStatus((s) => ({ ...s, [ap]: e.target.value }))
              }
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: PS[propStatus[ap]]?.color || '#10B981',
                background: PS[propStatus[ap]]?.bg || '#D1FAE5',
                border: 'none',
                borderRadius: 8,
                padding: '6px 10px',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {Object.entries(PS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* ── NUEVO REDISEÑO DE BOTONES: CONTROL SEGMENTADO MODERNO (PULSE/iOS STYLE) ── */}
          <div 
            style={{ 
              display: 'flex', 
              background: '#E2E8F0', 
              borderRadius: 12, 
              padding: 4, 
              gap: 4, 
              marginBottom: 16 
            }}
          >
            <button
              onClick={() => setSub('notas')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 9,
                border: 'none',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                background: sub === 'notas' ? '#fff' : 'transparent',
                color: sub === 'notas' ? '#1E293B' : '#64748B',
                boxShadow: sub === 'notas' ? '0 2px 6px rgba(0,0,0,.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s ease'
              }}
            >
              📝 Notas Internas
            </button>
            <button
              onClick={() => setSub('tareas')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 9,
                border: 'none',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                background: sub === 'tareas' ? '#fff' : 'transparent',
                color: sub === 'tareas' ? '#1E293B' : '#64748B',
                boxShadow: sub === 'tareas' ? '0 2px 6px rgba(0,0,0,.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s ease'
              }}
            >
              📋 Tareas Operativas
            </button>
          </div>

          {/* VISTA: NOTAS */}
          {sub === 'notas' && (
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 20,
                border: '1px solid #F0F0F0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>
                  Notas internas de la propiedad
                </div>
                <button
                  onClick={() => setEditNote((x) => !x)}
                  style={{
                    background: '#F3F4F6',
                    border: 'none',
                    borderRadius: 8,
                    padding: '5px 12px',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    color: '#555',
                  }}
                >
                  {editNote ? 'Cerrar' : '✏️ Editar'}
                </button>
              </div>
              {editNote ? (
                <div>
                  <textarea
                    value={notes[ap] || ''}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [ap]: e.target.value }))
                    }
                    rows={8}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1.5px solid #E5E7EB',
                      borderRadius: 8,
                      fontSize: 13,
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    onClick={() => setEditNote(false)}
                    style={{
                      marginTop: 8,
                      background: '#3B82F6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '9px 18px',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Guardar Notas
                  </button>
                </div>
              ) : (
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    color: '#374151',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.7,
                  }}
                >
                  {notes[ap] || 'Sin notas registradas para esta propiedad.'}
                </pre>
              )}
            </div>
          )}

          {/* VISTA: TAREAS OPERATIVAS (CHECKLIST EDITABLE) */}
          {sub === 'tareas' && (
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 20,
                border: '1px solid #F0F0F0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>
                    Control de Tareas Operativas
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {done}/{items.length} completados
                  </div>
                </div>
                <button
                  onClick={() => setChecklists((c) => ({ ...c, [ap]: { items: items, checked: {} } }))}
                  style={{
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: 'none',
                    borderRadius: 8,
                    padding: '5px 12px',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  ↺ Desmarcar Todo
                </button>
              </div>

              {/* Barra de Progreso */}
              <div
                style={{
                  height: 5,
                  background: '#F3F4F6',
                  borderRadius: 4,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: '#10B981',
                    borderRadius: 4,
                    width: items.length > 0 ? Math.round((done / items.length) * 100) + '%' : '0%',
                    transition: 'width .3s',
                  }}
                />
              </div>

              {/* Formulario para agregar ítems */}
              <form onSubmit={handleAddItem} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                <input 
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Ej: Comprar bombilla para baño P1..."
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: 8,
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '9px 14px',
                    background: '#10B981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  + Ítem
                </button>
              </form>

              {/* Lista de tareas */}
              {items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid #F9FAFB',
                    gap: 12
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      border: `1.5px solid ${checked[i] ? '#10B981' : '#D1D5DB'}`,
                      background: checked[i] ? '#10B981' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      cursor: 'pointer'
                    }}
                    onClick={() =>
                      setChecklists((c) => ({
                        ...c,
                        [ap]: {
                          items: items,
                          checked: { ...checked, [i]: !checked[i] }
                        }
                      }))
                    }
                  >
                    {checked[i] && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
                  </div>
                  
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: checked[i] ? '#D1D5DB' : '#374151',
                      textDecoration: checked[i] ? 'line-through' : 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() =>
                      setChecklists((c) => ({
                        ...c,
                        [ap]: {
                          items: items,
                          checked: { ...checked, [i]: !checked[i] }
                        }
                      }))
                    }
                  >
                    {item}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(i)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#EF4444',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 700,
                      padding: '0 6px',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}

              {items.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '20px 0', fontSize: 12 }}>
                  No hay tareas en el checklist. ¡Agrega una arriba!
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
