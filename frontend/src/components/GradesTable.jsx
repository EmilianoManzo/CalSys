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
        cols.forEach(col => {
          row.push(g[`col_${col.id}`] || null);
        });
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
      tableData.forEach(row => {
        const matricula = row[0];
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
      });

      await api.post('/columns/save-custom', {
        values,
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
      { data: 0, title: 'Matricula', readOnly: true, width: 100 },
      { data: 1, title: 'Nombre', readOnly: true, width: 200 }
    ];

    columns.forEach((col, index) => {
      cols.push({
        data: index + 2,
        title: `${col.column_name} (${col.weight}%)`,
        type: col.column_type === 'text' ? 'text' : 'numeric',
        numericFormat: col.column_type !== 'text' ? { pattern: '0.00' } : undefined,
        width: 120
      });
    });

    return cols;
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
            ⚙️ Configurar Columnas
          </button>
          <button
            onClick={handleSaveGrades}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : '💾 Guardar Calificaciones'}
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
          />
        </div>
      )}

      {columns.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded text-sm">
          <p className="font-semibold mb-2">📊 Columnas configuradas:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {columns.map(col => (
              <div key={col.id} className="bg-white p-2 rounded border">
                <span className="font-medium">{col.column_name}</span>
                <span className="text-gray-600 ml-2">({col.weight}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GradesTable;