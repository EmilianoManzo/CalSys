import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../api/axios';
import ColumnConfig from './ColumnConfig';

registerAllModules();

function GradesTable({ semester, subject, group, teacherId }) {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const hotRef = useRef(null);

  useEffect(() => {
    if (semester && subject && teacherId) loadConfig();
  }, [semester, subject, group, teacherId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const params = { teacherId, semester, subject };
      if (group) params.group = group;
      const response = await api.get('/columns/config', { params });
      if (response.data.columns.length === 0) {
        setShowConfig(true);
        setLoading(false);
        return;
      }
      setColumns(response.data.columns);
      await loadGrades(response.data.columns);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const loadGrades = async (cols) => {
    try {
      const params = { teacherId, semester, subject };
      if (group) params.group = group;
      const response = await api.get('/columns/with-custom', { params });
      const tableData = response.data.grades.map(g => {
        // Columnas fijas: Matrícula, Nombre, Parcial1, Parcial2, Parcial3, Promedio (solo lectura), Ordinario
        const row = [
          g.matricula,
          g.nombre,
          g.parcial_1 !== null ? parseFloat(g.parcial_1).toFixed(2) : '',
          g.parcial_2 !== null ? parseFloat(g.parcial_2).toFixed(2) : '',
          g.parcial_3 !== null ? parseFloat(g.parcial_3).toFixed(2) : '',
          g.promedio_parciales !== null ? parseFloat(g.promedio_parciales).toFixed(2) : '',
          g.ordinario !== null ? parseFloat(g.ordinario).toFixed(2) : ''
        ];
        // Columnas personalizadas (no especiales)
        cols.forEach(col => {
          if (!col.is_special) {
            const val = g[`col_${col.id}`];
            row.push(val !== null ? parseFloat(val).toFixed(2) : '');
          }
        });
        // Calificación final y estado
        row.push(g.final_grade !== null ? parseFloat(g.final_grade).toFixed(2) : '');
        row.push(g.status === 'passed' ? 'Aprobado' : g.status === 'failed' ? 'Reprobado' : 'En Progreso');
        return row;
      });
      setData(tableData);
    } catch (error) {
      console.error(error);
      alert('Error al cargar calificaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (newColumns) => {
    try {
      await api.post('/columns/config', { teacherId, semester, subject, group, columns: newColumns });
      setShowConfig(false);
      loadConfig();
      alert('Configuración guardada');
    } catch (error) {
      alert('Error al guardar configuración');
    }
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    try {
      const hot = hotRef.current.hotInstance;
      const tableData = hot.getData();
      const values = [];
      const parciales = {};
      const ordinarios = {};

      const fixedColsCount = 8; // matricula, nombre, p1, p2, p3, promedio, ordinario, final, estado -> pero la final y estado están al final
      // En realidad las columnas fijas son: 0 mat, 1 nom, 2 p1, 3 p2, 4 p3, 5 prom (readonly), 6 ordinario
      // Luego vienen las personalizables, luego final y estado.
      const normalColumns = columns.filter(c => !c.is_special);
      const personalStartIndex = 7; // después de ordinario

      tableData.forEach(row => {
        const matricula = row[0];
        // Parciales
        const p1 = row[2] !== '' ? parseFloat(row[2]) : null;
        const p2 = row[3] !== '' ? parseFloat(row[3]) : null;
        const p3 = row[4] !== '' ? parseFloat(row[4]) : null;
        const ord = row[6] !== '' ? parseFloat(row[6]) : null;
        if (p1 !== null || p2 !== null || p3 !== null) {
          parciales[matricula] = { parcial_1: p1, parcial_2: p2, parcial_3: p3 };
        }
        if (ord !== null) {
          ordinarios[matricula] = ord;
        }
        // Columnas personalizadas
        normalColumns.forEach((col, idx) => {
          const val = row[personalStartIndex + idx];
          if (val !== '' && !isNaN(val)) {
            values.push({ matricula, columnId: col.id, value: val.toString() });
          }
        });
      });

      await api.post('/columns/save-custom', { values, parciales, ordinarios, semester, subject, group, teacherId });
      alert('✅ Calificaciones guardadas');
      loadConfig(); // recargar para actualizar promedios y finales
    } catch (error) {
      console.error(error);
      alert('Error al guardar calificaciones');
    } finally {
      setSaving(false);
    }
  };

  const buildColumns = () => {
    const cols = [
      { data: 0, title: 'Matrícula', readOnly: true, width: 100 },
      { data: 1, title: 'Nombre', readOnly: true, width: 200 },
      { data: 2, title: 'Parcial 1', type: 'numeric', numericFormat: { pattern: '0.00' }, width: 100 },
      { data: 3, title: 'Parcial 2', type: 'numeric', numericFormat: { pattern: '0.00' }, width: 100 },
      { data: 4, title: 'Parcial 3', type: 'numeric', numericFormat: { pattern: '0.00' }, width: 100 },
      { data: 5, title: '⭐ Promedio Parciales', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 150 },
      { data: 6, title: '📝 Evaluación Final', type: 'numeric', numericFormat: { pattern: '0.00' }, width: 130 }
    ];
    const normalColumns = columns.filter(c => !c.is_special);
    normalColumns.forEach(col => {
      cols.push({
        data: 7 + cols.length,
        title: `${col.column_name} (${col.weight}% / ${col.max_value})`,
        type: 'numeric',
        numericFormat: { pattern: '0.00' },
        width: 130
      });
    });
    cols.push({
      data: 7 + cols.length,
      title: '🎯 CALIFICACION FINAL',
      readOnly: true,
      type: 'numeric',
      numericFormat: { pattern: '0.00' },
      width: 140
    });
    cols.push({
      data: 8 + cols.length,
      title: 'Estado',
      readOnly: true,
      width: 110
    });
    return cols;
  };

  const afterChange = (changes, source) => {
    if (!changes || source === 'loadData') return;
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    changes.forEach(([row, prop, oldValue, newValue]) => {
      // Si cambió Parcial 1,2,3 o Evaluación Final, recalcular promedio y final
      if ([2, 3, 4, 6].includes(prop)) {
        const p1 = parseFloat(hot.getDataAtCell(row, 2)) || 0;
        const p2 = parseFloat(hot.getDataAtCell(row, 3)) || 0;
        const p3 = parseFloat(hot.getDataAtCell(row, 4)) || 0;
        const promedio = (p1 + p2 + p3) / 3;
        hot.setDataAtCell(row, 5, promedio.toFixed(2), 'thisChange');
        recalcularFinal(hot, row);
      }
      // Si cambió columna personalizada, recalcular final
      const normalCount = columns.filter(c => !c.is_special).length;
      const personalStart = 7;
      if (prop >= personalStart && prop < personalStart + normalCount) {
        recalcularFinal(hot, row);
      }
    });
  };

  const recalcularFinal = (hot, rowIndex) => {
    const p1 = parseFloat(hot.getDataAtCell(rowIndex, 2)) || 0;
    const p2 = parseFloat(hot.getDataAtCell(rowIndex, 3)) || 0;
    const p3 = parseFloat(hot.getDataAtCell(rowIndex, 4)) || 0;
    const promedio = (p1 + p2 + p3) / 3;
    const ordinario = parseFloat(hot.getDataAtCell(rowIndex, 6)) || 0;

    let total = 0, pesoTotal = 0;
    const specialCol = columns.find(c => c.is_special === 1);
    if (specialCol) {
      total += (promedio * (specialCol.weight / 100));
      pesoTotal += specialCol.weight;
    }
    const normalColumns = columns.filter(c => !c.is_special);
    const personalStart = 7;
    normalColumns.forEach((col, idx) => {
      const val = parseFloat(hot.getDataAtCell(rowIndex, personalStart + idx)) || 0;
      const w = parseFloat(col.weight) || 0;
      const maxVal = parseFloat(col.max_value) || 10;
      if (val > 0) {
        total += ((val / maxVal) * 10) * (w / 100);
        pesoTotal += w;
      }
    });
    const finalGrade = pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;
    const finalColIndex = personalStart + normalColumns.length;
    hot.setDataAtCell(rowIndex, finalColIndex, finalGrade, 'thisChange');
    const status = finalGrade >= 6 ? 'Aprobado' : finalGrade !== null ? 'Reprobado' : 'En Progreso';
    hot.setDataAtCell(rowIndex, finalColIndex + 1, status, 'thisChange');
  };

  if (showConfig) return <ColumnConfig columns={columns} onSave={handleSaveConfig} onCancel={() => setShowConfig(false)} />;
  if (loading) return <div className="text-center py-8">Cargando...</div>;
  if (!semester || !subject) return <div className="text-center py-8 text-gray-500">Selecciona semestre y materia</div>;

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

export default GradesTable;