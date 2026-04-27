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

  const calcularPromedioParcial = (rowData, cols) => {
    let total = 0, pesoTotal = 0;
    for (let i = 0; i < cols.length; i++) {
      const val = parseFloat(rowData[2 + i]);
      if (!isNaN(val) && val !== '') {
        const weight = parseFloat(cols[i].weight) || 0;
        const maxValue = parseFloat(cols[i].max_value) || 10;
        total += (val / maxValue) * 10 * (weight / 100);
        pesoTotal += weight;
      }
    }
    return pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;
  };

  const calcularCalificacionFinal = (rowData, cols) => {
    let total = 0, pesoTotal = 0;
    for (let i = 0; i < cols.length; i++) {
      const val = parseFloat(rowData[2 + i]);
      if (!isNaN(val) && val !== '') {
        const weight = parseFloat(cols[i].weight) || 0;
        const maxValue = parseFloat(cols[i].max_value) || 10;
        total += (val / maxValue) * 10 * (weight / 100);
        pesoTotal += weight;
      }
    }
    return pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;
  };

  const afterChange = (changes, source) => {
    if (!changes || source === 'loadData') return;
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    const safe = safeColumns();
    const affectedRows = new Set(changes.map(c => c[0]));
    for (let row of affectedRows) {
      const currentRow = hot.getDataAtRow(row);
      if (partialId !== 4) {
        const promedioColIndex = 2 + safe.length;
        const nuevoPromedio = calcularPromedioParcial(currentRow, safe);
        const nuevoVal = nuevoPromedio !== null ? nuevoPromedio.toFixed(2) : '';
        hot.setDataAtCell(row, promedioColIndex, nuevoVal, 'autoAverage');
      } else {
        const finalColIndex = 2 + safe.length;
        const nuevaFinal = calcularCalificacionFinal(currentRow, safe);
        const nuevoVal = nuevaFinal !== null ? nuevaFinal.toFixed(2) : '';
        hot.setDataAtCell(row, finalColIndex, nuevoVal, 'autoFinal');
      }
    }
  };

  const handleSaveConfig = async (newColumns) => {
    setSaving(true);
    try {
      await api.post('/partials/config', {
        teacherId, semester, subject, group, partialId, columns: newColumns
      });
      alert('Configuración guardada');
      setShowConfig(false);
      await loadConfig(); // recarga configuración y calificaciones
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
          if (partialId === 4 && col.is_special) continue;
          const val = row[2 + colIdx];
          const valueToStore = (val !== '' && !isNaN(parseFloat(val))) ? val.toString() : null;
          values.push({ matricula, columnName: col.column_name, value: valueToStore });
        }
        if (partialId !== 4) {
          const promedioVal = row[2 + safe.length];
          const promedio = (promedioVal !== '' && !isNaN(parseFloat(promedioVal))) ? parseFloat(promedioVal) : null;
          values.push({ matricula, columnName: '__promedio', value: promedio !== null ? promedio.toString() : null });
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
      base.push({
        data: 2 + idx,
        title: `${col.column_name}${col.is_special ? ' ⭐' : ''} (${col.weight}% / ${col.max_value})`,
        type: 'numeric',
        numericFormat: { pattern: '0.00' },
        width: 140,
        readOnly: (partialId === 4 && col.is_special) ? true : false
      });
    });
    if (partialId !== 4) {
      base.push({ data: 2 + safe.length, title: '📊 Promedio Parcial', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 120 });
    } else {
      base.push({ data: 2 + safe.length, title: '🎯 CALIFICACIÓN FINAL GLOBAL', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 150 });
    }
    return base;
  };

  if (showConfig) {
    return (
      <ColumnConfig
        columns={columns}
        onSave={handleSaveConfig}
        onCancel={() => setShowConfig(false)}
        showSpecialColumn={showSpecial}
      />
    );
  }
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
          ? '📊 La columna "Promedio Parcial" se calcula automáticamente al editar las notas.'
          : '⭐ La calificación final global se calcula automáticamente.'}
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