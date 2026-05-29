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
      alert('Calificaciones guardadas');
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
      { data: 1, title: 'Nombre', readOnly: true, width: 200 }
    ];
    const safe = safeColumns();
    safe.forEach((col, idx) => {
      const isSpecialReadonly = isCalificacionFinalTab && !!col.is_special;
      base.push({
        data: 2 + idx,
        title: `${col.column_name}${col.is_special ? ' ⭐' : ''} (${col.weight}% / ${col.max_value})`,
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
      base.push({ data: 2 + safe.length, title: '📊 Promedio Parcial', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 120 });
    } else {
      base.push({ data: 2 + safe.length, title: '🎯 CALIFICACIÓN FINAL GLOBAL', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 150 });
    }
    return base;
  };

  if (showConfig) {
    return <ColumnConfig columns={columns} onSave={handleSaveConfig} onCancel={() => setShowConfig(false)} showSpecialColumn={showSpecial} />;
  }

  if (loading) return (
    <div style={{ 
      textAlign: 'center', 
      padding: '2rem', 
      fontFamily: 'DM Sans, sans-serif', 
      color: '#6b7280' 
    }}>
      Cargando...
    </div>
  );

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <h3 style={{ 
          fontSize: '1rem', 
          fontWeight: 600, 
          color: '#111111',
          margin: 0
        }}>
          {data.length} alumnos
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setShowConfig(true)} 
            style={{
              background: '#4b5563',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.target.style.background = '#374151'}
            onMouseLeave={e => e.target.style.background = '#4b5563'}
          >
            ⚙️ Configurar Columnas
          </button>
          <button 
            onClick={handleSaveGrades} 
            disabled={saving} 
            style={{
              background: '#880000',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 24px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => !saving && (e.target.style.background = '#6b0000')}
            onMouseLeave={e => !saving && (e.target.style.background = '#880000')}
          >
            {saving ? 'Guardando...' : 'Guardar Calificaciones'}
          </button>
        </div>
      </div>

      <div style={{
        fontSize: '12px',
        marginBottom: '1rem',
        padding: '8px 12px',
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        color: '#92400e'
      }}>
        {!isCalificacionFinalTab
          ? `📊 La calificación final del ${partialId === EXAMEN_FINAL_PARTIAL_ID ? 'examen final' : 'parcial'} se calcula automáticamente al editar las notas.`
          : '⭐ Las columnas especiales (Promedio de Parciales y Calificación Examen Final) se calculan automáticamente.'}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <HotTable
          ref={hotRef}
          data={data}
          columns={buildColumns()}
          colHeaders={true}
          rowHeaders={true}
          width="100%"
          height="500"
          licenseKey="non-commercial-and-evaluation"
          stretchH="all"
          contextMenu={true}
          manualColumnResize={true}
          afterChange={afterChange}
        />
      </div>
    </div>
  );
}

export default PartialGradesTable;