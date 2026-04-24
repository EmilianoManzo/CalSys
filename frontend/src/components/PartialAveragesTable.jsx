import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../api/axios';
import ColumnConfig from './ColumnConfig';

registerAllModules();

function PartialGradesTable({ partialId, semester, subject, group, teacherId, showSpecial = false }) {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const hotRef = useRef(null);

  const safeColumns = () => (Array.isArray(columns) ? columns.filter(c => c && typeof c === 'object') : []);

  useEffect(() => { loadConfig(); }, [partialId, semester, subject, group, teacherId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await api.get('/partials/config', { params: { teacherId, semester, subject, group, partialId } });
      let cols = res.data.columns || [];
      if (!Array.isArray(cols)) cols = [];
      const valid = cols.filter(c => c && typeof c === 'object');
      if (valid.length === 0 && !showConfig) { setShowConfig(true); setLoading(false); return; }
      setColumns(valid);
      await loadGrades(valid);
    } catch (error) { console.error(error); setLoading(false); }
  };

  const loadGrades = async (cols) => {
    try {
      const res = await api.get('/partials/grades', { params: { teacherId, semester, subject, group, partialId } });
      const raw = res.data.grades || [];
      const cfg = res.data.columns || [];
      const validCfg = Array.isArray(cfg) ? cfg.filter(c => c && typeof c === 'object') : [];
      
      // Construir filas con las notas
      let tableData = raw.map(g => {
        const row = [g.matricula, g.nombre];
        validCfg.forEach(col => {
          const val = g[`col_${col.column_name}`];
          const num = parseFloat(val);
          row.push(!isNaN(num) && val !== null && val !== '' ? num.toFixed(2) : '');
        });
        return row;
      });

      // Calcular la nota final de cada fila (solo si no es la pestaña final)
      if (partialId !== 4) {
        tableData = tableData.map(row => {
          const finalValue = calcularNotaFinal(row, validCfg);
          row.push(finalValue !== null ? finalValue.toFixed(2) : '');
          return row;
        });
      } else {
        // En la pestaña final, la última columna es la calificación final global (ya la añadirá buildColumns)
        // Aseguramos que la fila tenga la misma longitud (buildColumns espera ese número de columnas)
        tableData = tableData.map(row => row);
      }
      
      setData(tableData);
    } catch (error) { console.error(error); alert('Error al cargar calificaciones'); } finally { setLoading(false); }
  };

  // Cálculo de la nota final (ponderada)
  const calcularNotaFinal = (rowData, cols) => {
    let total = 0, peso = 0;
    for (let i = 0; i < cols.length; i++) {
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

  // Actualización en vivo: solo recalcula la nota final, pero no interfiere con la edición
  const afterChange = (changes, source) => {
    if (!changes || source === 'loadData' || source === 'autoFinal') return; // no reaccionar a cambios automáticos
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    const safe = safeColumns();
    const rows = new Set(changes.map(c => c[0]));
    for (let row of rows) {
      const cur = hot.getDataAtRow(row);
      const finalColIndex = 2 + safe.length; // índice de la última columna
      const nota = calcularNotaFinal(cur, safe);
      // Usamos 'autoFinal' como source para evitar bucles
      hot.setDataAtCell(row, finalColIndex, nota !== null ? nota.toFixed(2) : '', 'autoFinal');
    }
  };

  const handleSaveConfig = async (newCols) => {
    try {
      await api.post('/partials/config', { teacherId, semester, subject, group, partialId, columns: newCols });
      setShowConfig(false);
      loadConfig();
      alert('Configuración guardada');
    } catch (error) { alert('Error al guardar configuración'); }
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    try {
      const hot = hotRef.current.hotInstance;
      const rows = hot.getData();
      const values = [];
      const safe = safeColumns();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const mat = row[0];
        // Guardar columnas normales (excluyendo la columna final)
        for (let j = 0; j < safe.length; j++) {
          const col = safe[j];
          if (partialId === 4 && col.is_special) continue; // la especial no se guarda
          const val = row[2 + j];
          const toStore = (val !== '' && !isNaN(parseFloat(val))) ? val.toString() : null;
          values.push({ matricula: mat, columnName: col.column_name, value: toStore });
        }
        // Guardar la nota final del parcial (si no es la pestaña final)
        if (partialId !== 4) {
          const finalVal = row[2 + safe.length];
          const nota = (finalVal !== '' && !isNaN(parseFloat(finalVal))) ? parseFloat(finalVal) : null;
          values.push({ matricula: mat, columnName: '__promedio', value: nota !== null ? nota.toString() : null });
        }
      }
      await api.post('/partials/save-grades', { teacherId, semester, subject, group, partialId, values });
      alert('Calificaciones guardadas');
      await loadConfig();
    } catch (error) { console.error(error); alert('Error al guardar'); } finally { setSaving(false); }
  };

  const buildColumns = () => {
    const base = [
      { data: 0, title: 'Matrícula', readOnly: true, width: 100 },
      { data: 1, title: 'Nombre', readOnly: true, width: 200 }
    ];
    const safe = safeColumns();
    safe.forEach((col, idx) => {
      base.push({
        data: 2 + idx,
        title: `${col.column_name}${col.is_special ? ' ⭐' : ''} (${col.weight}% / ${col.max_value})`,
        type: 'numeric',
        numericFormat: { pattern: '0.00' },
        width: 140,
        readOnly: (partialId === 4 && col.is_special) ? true : false
      });
    });
    // Columna extra: en parciales es la calificación final del parcial; en final es la calificación global
    if (partialId !== 4) {
      base.push({ data: 2 + safe.length, title: '📊 Calificación Final del Parcial', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 180 });
    } else {
      base.push({ data: 2 + safe.length, title: '🎯 CALIFICACIÓN FINAL GLOBAL', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 200 });
    }
    return base;
  };

  if (showConfig) return <ColumnConfig columns={columns} onSave={handleSaveConfig} onCancel={() => setShowConfig(false)} showSpecialColumn={showSpecial} />;
  if (loading) return <div className="text-center py-8">Cargando...</div>;

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold">{data.length} alumnos</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowConfig(true)} className="bg-gray-600 text-white px-4 py-2 rounded">⚙️ Configurar Columnas</button>
          <button onClick={handleSaveGrades} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar Calificaciones'}
          </button>
        </div>
      </div>
      <div className="text-sm text-gray-500 mb-2">
        {partialId !== 4
          ? '📊 La columna "Calificación Final del Parcial" se calcula automáticamente con los pesos asignados.'
          : '⭐ La columna "Promedio de Parciales" es automática (promedio de los tres parciales) y su peso es configurable. La calificación global suma todas las columnas.'}
      </div>
      <div className="overflow-x-auto">
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