import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../api/axios';
import ColumnConfig from './ColumnConfig';

registerAllModules();

const EXAMEN_FINAL_PARTIAL_ID = 4;
const CALIFICACION_FINAL_PARTIAL_ID = 5;

function PartialGradesTable({ partialId, semester, subject, group, teacherId, showSpecial = false }) {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const hotRef = useRef(null);
  const isUpdating = useRef(false);
  const isCalificacionFinalTab = partialId === CALIFICACION_FINAL_PARTIAL_ID;

  const safeColumns = () => (Array.isArray(columns) ? columns.filter(c => c && typeof c === 'object') : []);

  useEffect(() => {
    loadConfig();
  }, [partialId, semester, subject, group, teacherId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const params = { teacherId, semester, subject, partialId };
      if (group && group !== '') params.group = group;
      const res = await api.get('/partials/config', { params });
      let cols = res.data.columns || [];
      if (!Array.isArray(cols)) cols = [];
      const valid = cols.filter(c => c && typeof c === 'object');
      if (valid.length === 0 && !showConfig) {
        setShowConfig(true);
        setLoading(false);
        return;
      }
      setColumns(valid);
      await loadGrades(valid);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const loadGrades = async (cols) => {
    try {
      const params = { teacherId, semester, subject, partialId };
      if (group && group !== '') params.group = group;
      const res = await api.get('/partials/grades', { params });
      const raw = res.data.grades || [];
      const cfg = res.data.columns || [];
      const validCfg = Array.isArray(cfg) ? cfg.filter(c => c && typeof c === 'object') : [];
      const table = raw.map(g => {
        const row = [g.matricula, g.nombre];
        validCfg.forEach(col => {
          const val = g[`col_${col.column_name}`];
          const num = parseFloat(val);
          row.push(!isNaN(num) && val !== null && val !== '' ? num.toFixed(2) : '');
        });
        return row;
      });
      setData(table);
    } catch (error) {
      console.error(error);
      alert('Error al cargar calificaciones');
    } finally {
      setLoading(false);
    }
  };

  const calcularNotaFinal = (rowData, cols) => {
    let total = 0, peso = 0;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].is_special) continue;
      const val = parseFloat(rowData[2 + i]);
      if (!isNaN(val) && val !== '') {
        const w = parseFloat(cols[i].weight) || 0;
        const max = parseFloat(cols[i].max_value) || 10;
        total += (val / max) * 10 * (w / 100);
        peso += w;
      }
    }
    return peso > 0 ? parseFloat(total.toFixed(2)) : null;
  };

  const afterChange = (changes, source) => {
    if (isCalificacionFinalTab) return;
    if (!changes || source === 'loadData' || source === 'autoFinal') return;
    if (isUpdating.current) return;

    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const safe = safeColumns();
    const affectedRows = new Set(changes.map(c => c[0]));
    isUpdating.current = true;
    for (let row of affectedRows) {
      const currentRow = hot.getDataAtRow(row);
      const finalColIndex = 2 + safe.length;
      const nota = calcularNotaFinal(currentRow, safe);
      const nuevoVal = nota !== null ? nota.toFixed(2) : '';
      const valorActual = hot.getDataAtCell(row, finalColIndex);
      if (valorActual !== nuevoVal) {
        hot.setDataAtCell(row, finalColIndex, nuevoVal, 'autoFinal');
      }
    }
    setTimeout(() => {
      isUpdating.current = false;
    }, 50);
  };

  const handleSaveConfig = async (newColumns) => {
    setSaving(true);
    try {
      await api.post('/partials/config', {
        teacherId, semester, subject, group, partialId, columns: newColumns
      });
      alert('Configuración guardada');
      setShowConfig(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      alert('Error al guardar configuración: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    try {
      const hot = hotRef.current.hotInstance;
      const tableData = hot.getData();
      const values = [];
      const safe = safeColumns();
      for (let rowIdx = 0; rowIdx < tableData.length; rowIdx++) {
        const row = tableData[rowIdx];
        const matricula = row[0];
        for (let colIdx = 0; colIdx < safe.length; colIdx++) {
          const col = safe[colIdx];
          if (isCalificacionFinalTab && col.is_special) continue;
          if (col.is_virtual) continue;
          const val = row[2 + colIdx];
          const valueToStore = (val !== '' && !isNaN(parseFloat(val))) ? val.toString() : null;
          values.push({ matricula, columnName: col.column_name, value: valueToStore });
        }
      }
      await api.post('/partials/save-grades', { teacherId, semester, subject, group, partialId, values });
      alert('Calificaciones guardadas exitosamente');
      await loadConfig();
    } catch (error) {
      console.error(error);
      alert('Error al guardar calificaciones');
    } finally {
      setSaving(false);
    }
  };

  const buildColumns = () => {
    const base = [
      { data: 0, title: 'Matrícula', readOnly: true, width: 100 },
      { data: 1, title: 'Nombre completo', readOnly: true, width: 220 }
    ];
    const safe = safeColumns();
    safe.forEach((col, idx) => {
      const isSpecialReadonly = isCalificacionFinalTab && !!col.is_special;
      base.push({
        data: 2 + idx,
        title: `${col.column_name}${col.is_special ? ' ⭐' : ''}`,
        type: 'numeric',
        numericFormat: { pattern: '0.00' },
        width: 140,
        readOnly: isSpecialReadonly || !!col.is_virtual,
        validator: (value, callback) => {
          if (isSpecialReadonly || col.is_virtual) {
            callback(true);
            return;
          }
          if (value === '' || value === null) {
            callback(true);
            return;
          }
          const num = parseFloat(value);
          const max = parseFloat(col.max_value) || 10;
          if (isNaN(num)) {
            callback(false);
          } else if (num < 0 || num > max) {
            callback(false);
          } else {
            callback(true);
          }
        },
        allowInvalid: false
      });
    });
    if (!isCalificacionFinalTab) {
      base.push({ 
        data: 2 + safe.length, 
        title: 'Promedio', 
        readOnly: true, 
        type: 'numeric', 
        numericFormat: { pattern: '0.00' }, 
        width: 100 
      });
    } else {
      base.push({ 
        data: 2 + safe.length, 
        title: 'FINAL', 
        readOnly: true, 
        type: 'numeric', 
        numericFormat: { pattern: '0.00' }, 
        width: 100 
      });
    }
    return base;
  };

  const hotSettings = {
    licenseKey: 'non-commercial-and-evaluation',
    stretchH: 'all',
    contextMenu: true,
    manualColumnResize: true,
    manualRowResize: true,
    filters: true,
    columnSorting: true,
    search: true,
    autoWrapRow: true,
    persistentState: true,
    rowHeaders: true,
    colHeaders: true,
    height: 500,
    width: '100%',
    className: 'htMiddle'
  };

  if (showConfig) {
    return <ColumnConfig columns={columns} onSave={handleSaveConfig} onCancel={() => setShowConfig(false)} showSpecialColumn={showSpecial} />;
  }

  if (loading) return (
    <div style={{ 
      textAlign: 'center', 
      padding: '3rem', 
      fontFamily: 'DM Sans, sans-serif', 
      color: '#6b7280',
      fontSize: '14px'
    }}>
      <div style={{ marginBottom: '8px' }}>⏳</div>
      Cargando calificaciones...
    </div>
  );

  const partialName = partialId === 1 ? 'Primer Parcial' : partialId === 2 ? 'Segundo Parcial' : partialId === 3 ? 'Tercer Parcial' : partialId === 4 ? 'Examen Final' : 'Calificación Final';

  return (
    <>
      <style>{`
        .handsontable {
          font-family: 'DM Sans', sans-serif !important;
          font-size: 13px !important;
        }

        .handsontable thead th {
          background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f5 100%) !important;
          color: #1f2937 !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          letter-spacing: 0.3px !important;
          text-transform: uppercase !important;
          border-bottom: 2px solid #e5e7eb !important;
          border-right: 1px solid #e5e7eb !important;
          padding: 12px 8px !important;
        }

        .handsontable tbody td {
          border-right: 1px solid #f0f0f0 !important;
          border-bottom: 1px solid #f0f0f0 !important;
          padding: 8px 8px !important;
          color: #374151 !important;
        }

        .handsontable tbody tr:nth-child(even) td {
          background-color: #fafbfc !important;
        }

        .handsontable tbody tr:nth-child(odd) td {
          background-color: #ffffff !important;
        }

        .handsontable tbody td.readOnly {
          background-color: #f9fafb !important;
          color: #6b7280 !important;
          font-style: italic !important;
        }

        .handsontable tbody td:last-child {
          background-color: #fef3c7 !important;
          font-weight: 600 !important;
          color: #92400e !important;
          border-left: 1px solid #fde68a !important;
        }

        .handsontable tbody td:not(.readOnly):not(:empty) {
          font-weight: 500 !important;
        }

        .handsontable input {
          font-family: 'DM Sans', sans-serif !important;
          font-size: 13px !important;
          background-color: #ffffff !important;
          border: 2px solid var(--brand) !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          box-shadow: 0 0 0 2px rgba(136, 0, 0, 0.1) !important;
        }

        .handsontable .wtHolder::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .handsontable .wtHolder::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .handsontable .wtHolder::-webkit-scrollbar-thumb {
          background: var(--brand);
          border-radius: 4px;
        }

        .handsontable .wtHolder::-webkit-scrollbar-thumb:hover {
          background: var(--brand-hover);
        }

        .htContextMenu {
          font-family: 'DM Sans', sans-serif !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          border: 1px solid #e5e7eb !important;
        }

        .htContextMenu .htItem:hover {
          background-color: #fef3c7 !important;
        }

        .handsontable .manualColumnResizer {
          background-color: #d1d5db !important;
          width: 3px !important;
        }

        .handsontable .manualColumnResizer:hover {
          background-color: var(--brand) !important;
        }

        .handsontable .rowHeader {
          background: #f8f9fa !important;
          color: #6b7280 !important;
          font-weight: 500 !important;
          font-size: 11px !important;
          text-align: center !important;
          border-right: 1px solid #e5e7eb !important;
        }
      `}</style>

      <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              background: 'var(--brand)',
              color: '#ffffff',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.5px'
            }}>
              {partialName}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#4b5563',
              fontSize: '13px'
            }}>
              <span style={{ fontWeight: 600, color: '#111111', fontSize: '15px' }}>{data.length}</span>
              <span>alumnos</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => setShowConfig(true)} 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#ffffff',
                color: '#4b5563',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f9fafb';
                e.currentTarget.style.borderColor = '#9ca3af';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
            >
              <span style={{ fontSize: '15px' }}>⚙️</span>
              Configurar
            </button>
            
            <button 
              onClick={handleSaveGrades} 
              disabled={saving} 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: saving ? '#9ca3af' : 'var(--brand)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 24px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'all 0.2s',
                boxShadow: saving ? 'none' : '0 2px 4px rgba(136, 0, 0, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = 'var(--brand-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(136, 0, 0, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = 'var(--brand)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(136, 0, 0, 0.3)';
                }
              }}
            >
              {saving ? (
                <>
                  <span>⏳</span>
                  Guardando...
                </>
              ) : (
                <>
                  <span>💾</span>
                  Guardar
                </>
              )}
            </button>
          </div>
        </div>

        {!isCalificacionFinalTab && (
          <div style={{
            marginBottom: '1.25rem',
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e6f4ff 100%)',
            borderLeft: '4px solid #0284c7',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '20px', lineHeight: 1 }}>
              {partialId === EXAMEN_FINAL_PARTIAL_ID ? '📝' : '📊'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 600,
                color: '#0c4a6e',
                fontSize: '13px',
                marginBottom: '4px',
                letterSpacing: '0.3px'
              }}>
                {partialId === EXAMEN_FINAL_PARTIAL_ID ? 'Cálculo Automático' : 'Cálculo Automático del Parcial'}
              </div>
              <div style={{
                color: '#1e40af',
                fontSize: '12px',
                lineHeight: '1.4'
              }}>
                {partialId === EXAMEN_FINAL_PARTIAL_ID 
                  ? 'La calificación se calcula automáticamente según los pesos configurados.'
                  : 'Edita las notas en las columnas numéricas. La calificación final se actualizará automáticamente.'}
              </div>
            </div>
            <div style={{
              fontSize: '11px',
              color: '#0284c7',
              background: '#dbeafe',
              padding: '4px 10px',
              borderRadius: '20px',
              fontWeight: 500
            }}>
              ⚡ En vivo
            </div>
          </div>
        )}

        {isCalificacionFinalTab && (
          <div style={{
            marginBottom: '1.25rem',
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderLeft: '4px solid #d97706',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '20px', lineHeight: 1 }}>🎯</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 600,
                color: '#92400e',
                fontSize: '13px',
                marginBottom: '4px',
                letterSpacing: '0.3px'
              }}>
                Calificación Final Global
              </div>
              <div style={{
                color: '#78350f',
                fontSize: '12px',
                lineHeight: '1.4'
              }}>
                Combina todos los parciales y actividades según los porcentajes configurados.
              </div>
            </div>
            <div style={{
              fontSize: '11px',
              color: '#92400e',
              background: '#fef3c7',
              padding: '4px 10px',
              borderRadius: '20px',
              fontWeight: 500
            }}>
              📈 Integral
            </div>
          </div>
        )}

        <div style={{ 
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          background: '#ffffff',
          overflow: 'hidden'
        }}>
          <HotTable
            ref={hotRef}
            data={data}
            columns={buildColumns()}
            {...hotSettings}
            afterChange={afterChange}
          />
        </div>

        <div style={{
          marginTop: '1rem',
          padding: '10px 14px',
          background: '#f9fafb',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '11px',
          color: '#6b7280',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>💡 Consejo: Haz doble clic en una celda para editar</span>
            <span>🖱️ Redimensiona columnas arrastrando los bordes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#fef3c7', borderRadius: '2px' }}></span>
              Promedio
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#fafbfc', border: '1px solid #e5e7eb', borderRadius: '2px' }}></span>
              Editable
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#f9fafb', borderRadius: '2px' }}></span>
              Solo lectura
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default PartialGradesTable;