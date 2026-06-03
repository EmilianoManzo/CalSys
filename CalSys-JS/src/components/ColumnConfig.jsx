import { useState, useEffect } from 'react';

function ColumnConfig({ columns, onSave, onCancel, showSpecialColumn = true }) {
  const [localColumns, setLocalColumns] = useState([]);

  useEffect(() => {
    const specials = (columns || []).filter(c => c.is_special).map(col => ({
      name: col.column_name || col.name || '',
      type: 'numeric',
      maxValue: col.max_value || col.maxValue || 10,
      weight: col.weight || 0,
      required: col.is_required || col.required || false,
      is_special: true
    }));
    let normals = (columns || []).filter(c => !c.is_special).map(col => ({
      name: col.column_name || col.name || '',
      type: col.column_type || col.type || 'numeric',
      maxValue: col.max_value || col.maxValue || 10,
      weight: col.weight || 0,
      required: col.is_required || col.required || false,
      is_special: false
    }));
    if (showSpecialColumn) {
      if (specials.length > 0) {
        setLocalColumns([...specials, ...normals]);
      } else {
        setLocalColumns([
          { name: 'Promedio de Parciales', type: 'numeric', maxValue: 10, weight: 0, required: false, is_special: true },
          ...normals
        ]);
      }
    } else {
      setLocalColumns(normals);
    }
  }, [columns, showSpecialColumn]);

  const addColumn = () => {
    setLocalColumns([...localColumns, { name: '', type: 'numeric', maxValue: 10, weight: 0, required: false, is_special: false }]);
  };

  const updateColumn = (idx, field, val) => {
    const updated = [...localColumns];
    if (updated[idx].is_special && field !== 'weight' && field !== 'required' && field !== 'name') return;
    if (field === 'maxValue' || field === 'weight') {
      const num = val === '' ? '' : parseFloat(val);
      updated[idx][field] = num === '' || isNaN(num) ? 0 : num;
    } else if (field === 'type') {
      updated[idx][field] = val;
      if (val === 'text') updated[idx].weight = 0;
    } else {
      updated[idx][field] = val;
    }
    setLocalColumns(updated);
  };

  const removeColumn = (idx) => {
    if (localColumns[idx].is_special) {
      alert('No se puede eliminar una columna especial');
      return;
    }
    if (localColumns.filter(c => !c.is_special).length === 1) {
      alert('Debe haber al menos una columna adicional');
      return;
    }
    setLocalColumns(localColumns.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const normals = localColumns.filter(c => !c.is_special);
    if (!normals.every(c => c.name && c.name.trim())) {
      alert('Todas las columnas deben tener un nombre');
      return;
    }
    const totalWeight = localColumns
      .filter(c => c.type === 'numeric')
      .reduce((s, c) => s + (parseFloat(c.weight) || 0), 0);
    if (totalWeight > 100) {
      alert(`La suma de pesos es ${totalWeight.toFixed(1)}%. No puede superar 100%`);
      return;
    }
    if (totalWeight < 100 && totalWeight > 0 && !window.confirm(`La suma de pesos es ${totalWeight.toFixed(1)}% (falta ${(100 - totalWeight).toFixed(1)}%). ¿Continuar?`)) return;
    const validatedColumns = localColumns.map(c => ({
      name: c.name.trim(),
      type: c.type || 'numeric',
      maxValue: parseFloat(c.maxValue) || 10,
      weight: c.type === 'text' ? 0 : (parseFloat(c.weight) || 0),
      required: c.required || false,
      is_special: c.is_special || false
    }));
    onSave(validatedColumns);
  };

  const totalWeight = localColumns
    .filter(c => c.type === 'numeric')
    .reduce((s, c) => s + (parseFloat(c.weight) || 0), 0);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      fontFamily: 'DM Sans, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        maxWidth: '1000px',
        width: '100%',
        maxHeight: '95vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{
          background: '#880000',
          padding: '1.5rem',
          color: '#ffffff'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>Configurar Columnas de Evaluación</h2>
          <p style={{ color: '#fca5a5' }}>{showSpecialColumn ? 'Las filas especiales son de solo lectura y su peso es configurable.' : 'Define las actividades que componen este parcial.'}</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <div style={{
            marginBottom: '1.5rem',
            backgroundColor: '#f9fafb',
            border: '0.5px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#4b5563' }}>Ponderación Total:</span>
              <span style={{
                fontSize: '24px',
                fontWeight: 700,
                color: totalWeight > 100 ? 'var(--error)' : totalWeight === 100 ? 'var(--success)' : 'var(--warning)'
              }}>
                {totalWeight.toFixed(1)}%
              </span>
            </div>
            <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                transition: 'all 0.3s',
                backgroundColor: totalWeight > 100 ? 'var(--error)' : totalWeight === 100 ? 'var(--success)' : 'var(--warning)',
                width: `${Math.min(totalWeight, 100)}%`
              }} />
            </div>
          </div>

          {localColumns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#f9fafb', borderRadius: '12px', border: '2px dashed #d1d5db' }}>
              <p style={{ color: '#6b7280', marginBottom: '8px' }}>No hay columnas configuradas</p>
              <p style={{ color: '#9ca3af', fontSize: '13px' }}>Haz clic en "Agregar Columna" para comenzar</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {localColumns.map((col, idx) => (
                <div key={idx} style={{
                  backgroundColor: col.is_special ? '#fef3c7' : '#ffffff',
                  border: `1px solid ${col.is_special ? '#fcd34b' : '#e5e7eb'}`,
                  borderRadius: '12px',
                  padding: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '9999px',
                      backgroundColor: col.is_special ? 'var(--warning)' : 'var(--brand)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}>
                      {idx + 1}
                    </div>
                    <h3 style={{ fontWeight: 600, color: '#111111' }}>
                      {col.name || `Columna ${idx + 1}`}
                      {col.is_special && <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '9999px' }}>Especial</span>}
                      {col.type === 'text' && <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: '#e5e7eb', color: '#4b5563', padding: '2px 6px', borderRadius: '9999px' }}>Texto</span>}
                      {col.required && <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: 'var(--error-bg)', color: 'var(--error)', padding: '2px 6px', borderRadius: '9999px' }}>Obligatoria</span>}
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '8px' }}>
                    <div style={{ gridColumn: 'span 4' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Nombre</label>
                      <input
                        type="text"
                        value={col.name}
                        onChange={e => updateColumn(idx, 'name', e.target.value)}
                        disabled={col.is_special}
                        style={{
                          width: '100%',
                          border: `1px solid ${col.is_special ? '#fcd34b' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          backgroundColor: col.is_special ? '#fef3c7' : '#ffffff'
                        }}
                        placeholder={col.is_special ? 'Nombre fijo' : 'Ej: Tarea 1'}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Tipo</label>
                      <select
                        value={col.type}
                        onChange={e => updateColumn(idx, 'type', e.target.value)}
                        disabled={col.is_special}
                        style={{
                          width: '100%',
                          border: `1px solid ${col.is_special ? '#fcd34b' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          backgroundColor: col.is_special ? '#fef3c7' : '#ffffff'
                        }}
                      >
                        <option value="numeric">Numérico</option>
                        <option value="text">Texto</option>
                      </select>
                    </div>
                    {col.type === 'numeric' ? (
                      <>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Valor Max</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={col.maxValue}
                            onChange={e => updateColumn(idx, 'maxValue', e.target.value)}
                            disabled={col.is_special}
                            style={{
                              width: '100%',
                              border: `1px solid ${col.is_special ? '#fcd34b' : '#e5e7eb'}`,
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '13px',
                              backgroundColor: col.is_special ? '#fef3c7' : '#ffffff'
                            }}
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Peso (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={col.weight}
                            onChange={e => updateColumn(idx, 'weight', e.target.value)}
                            style={{
                              width: '100%',
                              border: `1px solid ${col.is_special ? '#fcd34b' : '#e5e7eb'}`,
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div style={{ gridColumn: 'span 4' }}>
                        <label style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Sin Ponderación</label>
                        <div style={{ backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                          Campo de texto
                        </div>
                      </div>
                    )}
                    <div style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'flex-end' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={col.required}
                          onChange={e => updateColumn(idx, 'required', e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: '#880000' }}
                        />
                        <span style={{ fontSize: '11px', fontWeight: 500, color: '#4b5563' }}>Req.</span>
                      </label>
                    </div>
                    <div style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'flex-end' }}>
                      <button
                        onClick={() => removeColumn(idx)}
                        disabled={col.is_special}
                        style={{
                          width: '100%',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: col.is_special ? 'not-allowed' : 'pointer',
                          backgroundColor: col.is_special ? '#e5e7eb' : 'var(--error)',
                          color: col.is_special ? '#9ca3af' : '#ffffff',
                          fontSize: '12px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={addColumn}
            style={{
              marginTop: '1rem',
              width: '100%',
              border: '2px dashed var(--brand)',
              backgroundColor: 'var(--error-bg)',
              color: 'var(--brand)',
              padding: '12px',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            + Agregar Nueva Columna
          </button>

          <div style={{
            marginTop: '1.5rem',
            backgroundColor: '#fef2f2',
            borderLeft: '4px solid var(--brand)',
            borderRadius: '8px',
            padding: '1rem'
          }}>
            <p style={{ fontWeight: 700, color: 'var(--brand)', marginBottom: '8px' }}>💡 Consejos:</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: '#7f1d1d' }}>
              {showSpecialColumn && <li>• <strong>Columnas especiales:</strong> Se calculan automáticamente y solo puedes ajustar su peso.</li>}
              <li>• <strong>Numérico:</strong> Para calificaciones que suman a la nota final.</li>
              <li>• <strong>Texto:</strong> Solo comentarios (no afecta la nota).</li>
              <li>• <strong>Peso:</strong> La suma de los pesos de todas las columnas numéricas debe ser 100%.</li>
            </ul>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>{localColumns.length} columnas</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: totalWeight > 100 ? 'var(--error)' : totalWeight === 100 ? 'var(--success)' : 'var(--warning)' }}>
              Total: {totalWeight.toFixed(1)}% / 100%
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 20px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                color: '#4b5563',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 24px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: 'var(--brand)',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              Guardar Configuración
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ColumnConfig;