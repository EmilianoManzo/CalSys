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
    if (semester && subject && teacherId) {
      loadConfig();
    }
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
        
        let calificacionFinal = 0;
        let pesoTotal = 0;
        
        // Agregar valores de columnas personalizadas
        cols.forEach(col => {
          const valor = parseFloat(g[`col_${col.id}`]) || null;
          row.push(valor);
          
          // Calcular calificación final si es numérica
          if (col.column_type === 'numeric' && valor !== null) {
            const peso = parseFloat(col.weight) || 0;
            const maxValue = parseFloat(col.max_value) || 10;
            
            // Normalizar a escala de 10 y aplicar peso
            const valorNormalizado = (valor / maxValue) * 10;
            calificacionFinal += (valorNormalizado * peso) / 100;
            pesoTotal += peso;
          }
        });
        
        // Agregar calificación final (solo si hay peso configurado)
        row.push(pesoTotal > 0 ? parseFloat(calificacionFinal.toFixed(2)) : null);
        
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
      await api.post('/columns/config', {
        teacherId,
        semester,
        subject,
        group,
        columns: newColumns
      });

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
      
      const values = [];
      const finalGrades = [];
      
      tableData.forEach(row => {
        const matricula = row[0];
        const calificacionFinal = row[columns.length + 2];
        
        // Guardar valores de columnas personalizadas
        columns.forEach((col, index) => {
          const value = row[index + 2];
          if (value !== null && value !== undefined && value !== '') {
            values.push({
              matricula,
              columnId: col.id,
              value: value.toString()
            });
          }
        });
        
        // Guardar calificación final
        if (calificacionFinal !== null && calificacionFinal !== undefined) {
          finalGrades.push({
            matricula,
            finalGrade: calificacionFinal
          });
        }
      });

      await api.post('/columns/save-custom', {
        values,
        finalGrades,
        semester,
        subject,
        group,
        teacherId
      });

      alert('Calificaciones guardadas exitosamente');
      loadConfig();
    } catch (error) {
      console.error('Error guardando:', error);
      alert('Error al guardar calificaciones');
    } finally {
      setSaving(false);
    }
  };

  const buildColumns = () => {
    const cols = [
      { data: 0, title: 'Matricula', readOnly: true, width: 100, className: 'htCenter htMiddle' },
      { data: 1, title: 'Nombre', readOnly: true, width: 200 }
    ];

    // Agregar columnas personalizadas
    columns.forEach((col, index) => {
      cols.push({
        data: index + 2,
        title: `${col.column_name} (${col.weight}%)`,
        type: col.column_type === 'text' ? 'text' : 'numeric',
        numericFormat: col.column_type !== 'text' ? { pattern: '0.00' } : undefined,
        width: 120
      });
    });

    // Agregar columna de Calificación Final (calculada)
    cols.push({
      data: columns.length + 2,
      title: 'CALIFICACION FINAL',
      type: 'numeric',
      numericFormat: { pattern: '0.00' },
      readOnly: true,
      width: 150,
      className: 'htCenter htMiddle'
    });

    return cols;
  };

  const afterChange = (changes, source) => {
    if (!changes || source === 'loadData') return;
    
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    changes.forEach(([row, prop, oldValue, newValue]) => {
      // Si cambió una columna numérica, recalcular final
      if (prop >= 2 && prop < columns.length + 2) {
        const colIndex = prop - 2;
        const column = columns[colIndex];
        
        if (column?.column_type === 'numeric') {
          recalcularFinal(hot, row);
        }
      }
    });
  };

  const recalcularFinal = (hot, rowIndex) => {
    let calificacionFinal = 0;
    let pesoTotal = 0;
    
    columns.forEach((col, index) => {
      if (col.column_type === 'numeric') {
        const valor = parseFloat(hot.getDataAtCell(rowIndex, index + 2)) || 0;
        const peso = parseFloat(col.weight) || 0;
        const maxValue = parseFloat(col.max_value) || 10;
        
        if (valor > 0) {
          const valorNormalizado = (valor / maxValue) * 10;
          calificacionFinal += (valorNormalizado * peso) / 100;
          pesoTotal += peso;
        }
      }
    });
    
    const finalValue = pesoTotal > 0 ? parseFloat(calificacionFinal.toFixed(2)) : null;
    hot.setDataAtCell(rowIndex, columns.length + 2, finalValue, 'thisChange');
  };

  if (showConfig) {
    return (
      <ColumnConfig
        columns={columns}
        onSave={handleSaveConfig}
        onCancel={() => setShowConfig(false)}
      />
    );
  }

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  if (!semester || !subject) {
    return (
      <div className="text-center py-8 text-gray-500">
        Selecciona semestre y materia
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          {data.length} alumnos - {columns.length} columnas configuradas
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfig(true)}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Configurar Columnas
          </button>
          <button
            onClick={handleSaveGrades}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Calificaciones'}
          </button>
        </div>
      </div>

      {columns.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">No hay columnas configuradas</p>
          <button
            onClick={() => setShowConfig(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Configurar Columnas
          </button>
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
              
              // Estilo para columna final
              if (col === columns.length + 2) {
                cellProperties.className = 'htCenter htMiddle';
                cellProperties.renderer = function(instance, td, row, col, prop, value) {
                  td.innerHTML = value !== null ? value.toFixed(2) : '';
                  td.style.backgroundColor = '#EFF6FF';
                  td.style.fontWeight = 'bold';
                  td.style.textAlign = 'center';
                  td.style.fontSize = '14px';
                  
                  if (value !== null) {
                    if (value >= 9) {
                      td.style.color = '#059669';
                      td.style.backgroundColor = '#D1FAE5';
                    } else if (value >= 6) {
                      td.style.color = '#2563EB';
                      td.style.backgroundColor = '#DBEAFE';
                    } else {
                      td.style.color = '#DC2626';
                      td.style.backgroundColor = '#FEE2E2';
                    }
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
          <p className="font-semibold mb-2">Columnas configuradas:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {columns.map(col => (
              <div key={col.id} className="bg-white p-2 rounded border">
                <span className="font-medium">{col.column_name}</span>
                {col.column_type === 'numeric' && (
                  <span className="text-gray-600 ml-2">({col.weight}%)</span>
                )}
                {col.column_type === 'text' && (
                  <span className="text-gray-400 ml-2 text-xs">(texto)</span>
                )}
              </div>
            ))}
            <div className="bg-blue-100 p-2 rounded border border-blue-300">
              <span className="font-bold text-blue-900">CALIFICACION FINAL</span>
              <span className="text-blue-700 ml-2">(calculada)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GradesTable;