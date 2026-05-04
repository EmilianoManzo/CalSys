import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../api/axios';
import ColumnConfig from './ColumnConfig';

registerAllModules();

function GradesTable({ semester, subject, group, teacherId, teacherName }) {
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
      console.error('Error cargando configuracion:', error);
      setLoading(false);
    }
  };

  const loadGrades = async (cols) => {
    try {
      const params = { teacherId, semester, subject };
      if (group) params.group = group;
      const response = await api.get('/columns/with-custom', { params });
      const tableData = response.data.grades.map(g => {
        const row = [g.matricula, g.nombre];
        let calificacionFinal = 0, pesoTotal = 0;
        cols.forEach(col => {
          if (col.column_type === 'numeric' && !col.is_special) {
            const valor = parseFloat(g[`col_${col.id}`]) || null;
            row.push(valor);
            if (valor !== null && !isNaN(valor)) {
              const peso = parseFloat(col.weight) || 0;
              const maxValue = parseFloat(col.max_value) || 10;
              const valorNormalizado = (valor / maxValue) * 10;
              calificacionFinal += (valorNormalizado * peso) / 100;
              pesoTotal += peso;
            }
          } else {
            row.push(g[`col_${col.id}`] || null);
          }
        });
        const specialCol = cols.find(c => c.is_special === 1);
        const promedioParciales = g.promedio_parciales || 0;
        if (specialCol && specialCol.column_type === 'numeric') {
          const pesoSpecial = parseFloat(specialCol.weight) || 0;
          calificacionFinal += (promedioParciales * pesoSpecial) / 100;
          pesoTotal += pesoSpecial;
        }
        const finalValue = pesoTotal > 0 ? parseFloat(calificacionFinal.toFixed(2)) : null;
        row.push(finalValue);
        // Determinar estado
        let estado = 'En Progreso';
        if (finalValue !== null) {
          if (finalValue >= 6) estado = 'Aprobado';
          else estado = 'Reprobado';
        }
        row.push(estado);
        return row;
      });
      setData(tableData);
    } catch (error) {
      console.error('Error cargando calificaciones:', error);
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
      alert('Configuracion guardada exitosamente');
    } catch (error) {
      console.error('Error guardando configuracion:', error);
      alert('Error al guardar configuracion');
    }
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    try {
      const hot = hotRef.current.hotInstance;
      const tableData = hot.getData();
      const values = [], finalGrades = [];
      const normalColumns = columns.filter(c => !c.is_special);
      tableData.forEach(row => {
        const matricula = row[0];
        const calificacionFinal = row[columns.length + 2];
        normalColumns.forEach((col, index) => {
          const value = row[index + 2];
          if (value !== null && value !== undefined && value !== '' && !isNaN(value)) {
            values.push({ matricula, columnId: col.id, value: value.toString() });
          }
        });
        if (calificacionFinal !== null && calificacionFinal !== undefined && calificacionFinal !== '' && !isNaN(calificacionFinal)) {
          finalGrades.push({ matricula, finalGrade: parseFloat(calificacionFinal) });
        }
      });
      const response = await api.post('/columns/save-custom', { values, finalGrades, semester, subject, group, teacherId });
      if (response.data.success) {
        alert('✅ Calificaciones guardadas exitosamente');
        loadConfig();
      } else alert('Error al guardar calificaciones');
    } catch (error) {
      console.error('Error guardando:', error);
      alert('Error al guardar calificaciones: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const buildColumns = () => {
    const cols = [
      { data: 0, title: 'Matricula', readOnly: true, width: 100, className: 'htCenter htMiddle' },
      { data: 1, title: 'Nombre', readOnly: true, width: 200 }
    ];
    columns.forEach((col, index) => {
      let title = col.column_name;
      if (col.column_type === 'numeric') title += ` (${col.weight}% / ${col.max_value})`;
      cols.push({
        data: index + 2,
        title: title,
        type: col.column_type === 'text' ? 'text' : 'numeric',
        numericFormat: col.column_type !== 'text' ? { pattern: '0.00' } : undefined,
        width: 120,
        readOnly: col.is_special ? true : false
      });
    });
    cols.push({ data: columns.length + 2, title: '🎯 CALIFICACION FINAL', type: 'numeric', numericFormat: { pattern: '0.00' }, readOnly: true, width: 150, className: 'htCenter htMiddle' });
    cols.push({ data: columns.length + 3, title: 'Estado', readOnly: true, width: 110 });
    return cols;
  };

  const afterChange = (changes, source) => {
    if (!changes || source === 'loadData') return;
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (prop >= 2 && prop < columns.length + 2) {
        const colIndex = prop - 2;
        const column = columns[colIndex];
        if (column && column.column_type === 'numeric' && !column.is_special) {
          let calificacionFinal = 0, pesoTotal = 0;
          columns.forEach((col, idx) => {
            if (col.column_type === 'numeric' && !col.is_special) {
              const valor = parseFloat(hot.getDataAtCell(row, idx + 2)) || 0;
              const peso = parseFloat(col.weight) || 0;
              const maxValue = parseFloat(col.max_value) || 10;
              if (valor > 0) {
                calificacionFinal += ((valor / maxValue) * 10) * (peso / 100);
                pesoTotal += peso;
              }
            }
          });
          const specialCol = columns.find(c => c.is_special === 1);
          if (specialCol) {
            const pesoSpecial = parseFloat(specialCol.weight) || 0;
            const promedioValue = parseFloat(hot.getDataAtCell(row, columns.findIndex(c => c.is_special === 1) + 2)) || 0;
            calificacionFinal += (promedioValue * pesoSpecial) / 100;
            pesoTotal += pesoSpecial;
          }
          const finalValue = pesoTotal > 0 ? parseFloat(calificacionFinal.toFixed(2)) : null;
          hot.setDataAtCell(row, columns.length + 2, finalValue, 'thisChange');
          // Actualizar estado
          let estado = 'En Progreso';
          if (finalValue !== null) {
            if (finalValue >= 6) estado = 'Aprobado';
            else estado = 'Reprobado';
          }
          hot.setDataAtCell(row, columns.length + 3, estado, 'thisChange');
        }
      }
    });
  };

  if (showConfig) return <ColumnConfig columns={columns} onSave={handleSaveConfig} onCancel={() => setShowConfig(false)} />;
  if (loading) return <div className="text-center py-8">Cargando...</div>;
  if (!semester || !subject) return <div className="text-center py-8 text-gray-500">Selecciona semestre y materia</div>;

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold">📊 {data.length} alumnos - {columns.length} columnas configuradas</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowConfig(true)} className="bg-gray-600 text-white px-4 py-2 rounded">⚙️ Configurar Columnas</button>
          <button onClick={handleSaveGrades} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50">{saving ? '💾 Guardando...' : '💾 Guardar Calificaciones'}</button>
        </div>
      </div>
      {columns.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">No hay columnas configuradas</p>
          <button onClick={() => setShowConfig(true)} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">Configurar Columnas</button>
        </div>
      ) : (
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
            cells={(row, col) => {
              const cellProperties = {};
              // Colores para la columna de Calificación Final (índice columns.length + 2)
              if (col === columns.length + 2) {
                cellProperties.renderer = function(instance, td, row, col, prop, value) {
                  td.innerHTML = value !== null ? value.toFixed(2) : '';
                  td.style.fontWeight = 'bold';
                  td.style.textAlign = 'center';
                  td.style.borderRadius = '4px';
                  if (value !== null) {
                    if (value >= 9) {
                      td.style.backgroundColor = '#10b981';
                      td.style.color = 'white';
                    } else if (value >= 6) {
                      td.style.backgroundColor = '#3b82f6';
                      td.style.color = 'white';
                    } else {
                      td.style.backgroundColor = '#ef4444';
                      td.style.color = 'white';
                    }
                  } else {
                    td.style.backgroundColor = '#fef3c7';
                    td.style.color = '#92400e';
                  }
                  return td;
                };
              }
              // Colores para la columna Estado (índice columns.length + 3)
              if (col === columns.length + 3) {
                cellProperties.renderer = function(instance, td, row, col, prop, value) {
                  td.style.textAlign = 'center';
                  td.style.fontWeight = 'bold';
                  td.style.borderRadius = '20px';
                  if (value === 'Aprobado') {
                    td.style.backgroundColor = '#d1fae5';
                    td.style.color = '#065f46';
                    td.innerHTML = '✅ Aprobado';
                  } else if (value === 'Reprobado') {
                    td.style.backgroundColor = '#fee2e2';
                    td.style.color = '#991b1b';
                    td.innerHTML = '❌ Reprobado';
                  } else if (value === 'Exento') {
                    td.style.backgroundColor = '#dbeafe';
                    td.style.color = '#1e40af';
                    td.innerHTML = '⭐ Exento';
                  } else {
                    td.style.backgroundColor = '#fef3c7';
                    td.style.color = '#92400e';
                    td.innerHTML = '⏳ En Progreso';
                  }
                  return td;
                };
              }
              return cellProperties;
            }}
          />
        </div>
      )}
      {columns.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded text-sm">
          <p className="font-semibold mb-2">📋 Columnas configuradas:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {columns.map(col => (
              <div key={col.id} className="bg-white p-2 rounded border">
                <span className="font-medium">{col.column_name}</span>
                {col.column_type === 'numeric' && <span className="text-gray-600 ml-2">({col.weight}%)</span>}
                {col.is_special && <span className="text-blue-500 ml-2">⭐ fijo</span>}
              </div>
            ))}
            <div className="bg-blue-100 p-2 rounded border border-blue-300">
              <span className="font-bold text-blue-900">🎯 CALIFICACION FINAL</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GradesTable;