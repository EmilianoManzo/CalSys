import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function GradesViewer() {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    semester: '',
    subject: '',
    group: ''
  });
  const hotRef = useRef(null);

  const cargarCalificaciones = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.semester) params.semester = filters.semester;
      if (filters.subject) params.subject = filters.subject;
      if (filters.group) params.group = filters.group;

      const response = await api.get('/admin/all-grades', { params });
      
      const data = response.data.grades.map(g => [
        g.matricula,
        g.alumno,
        g.semester_code,
        g.subject_code,
        g.group_code,
        g.maestro,
        g.final_grade,
        g.status
      ]);
      
      setGrades(data);
    } catch (error) {
      console.error('Error cargando calificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCalificaciones();
  }, []);

  const columns = [
    { data: 0, title: 'Matrícula', readOnly: true, width: 100 },
    { data: 1, title: 'Alumno', readOnly: true, width: 200 },
    { data: 2, title: 'Semestre', readOnly: true, width: 100 },
    { data: 3, title: 'Materia', readOnly: true, width: 120 },
    { data: 4, title: 'Grupo', readOnly: true, width: 80 },
    { data: 5, title: 'Maestro', readOnly: true, width: 180 },
    { 
      data: 6, 
      title: 'Calificación Final', 
      readOnly: true, 
      type: 'numeric',
      numericFormat: { pattern: '0.00' },
      width: 120 
    },
    { data: 7, title: 'Estado', readOnly: true, width: 100 }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Todas las Calificaciones</h2>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Semestre</label>
            <select
              value={filters.semester}
              onChange={e => setFilters({...filters, semester: e.target.value})}
              className="w-full border-2 rounded-lg px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="2025-1">2025-1</option>
              <option value="2024-2">2024-2</option>
              <option value="2024-1">2024-1</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Materia</label>
            <select
              value={filters.subject}
              onChange={e => setFilters({...filters, subject: e.target.value})}
              className="w-full border-2 rounded-lg px-3 py-2"
            >
              <option value="">Todas</option>
              <option value="CALC-101">Cálculo I</option>
              <option value="FIS-101">Física I</option>
              <option value="PROG-101">Programación I</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Grupo</label>
            <select
              value={filters.group}
              onChange={e => setFilters({...filters, group: e.target.value})}
              className="w-full border-2 rounded-lg px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="1A">1A</option>
              <option value="1B">1B</option>
              <option value="2A">2A</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={cargarCalificaciones}
              className="w-full bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-semibold"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {loading ? (
          <div className="text-center py-12">Cargando calificaciones...</div>
        ) : grades.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay calificaciones registradas</div>
        ) : (
          <HotTable
            ref={hotRef}
            data={grades}
            columns={columns}
            colHeaders={true}
            rowHeaders={true}
            width="100%"
            height="600"
            licenseKey="non-commercial-and-evaluation"
            stretchH="all"
            filters={true}
            dropdownMenu={['filter_by_value', 'filter_action_bar']}
            columnSorting={true}
            cells={(row, col) => {
              const cellProperties = {};
              
              // Colorear calificación final
              if (col === 6) {
                cellProperties.renderer = function(instance, td, row, col, prop, value) {
                  td.innerHTML = value !== null && value !== undefined ? parseFloat(value).toFixed(2) : 'N/A';
                  td.style.fontWeight = 'bold';
                  td.style.textAlign = 'center';
                  
                  if (value !== null && value !== undefined) {
                    const val = parseFloat(value);
                    if (val >= 9) {
                      td.style.backgroundColor = '#D1FAE5';
                      td.style.color = '#059669';
                    } else if (val >= 6) {
                      td.style.backgroundColor = '#DBEAFE';
                      td.style.color = '#2563EB';
                    } else {
                      td.style.backgroundColor = '#FEE2E2';
                      td.style.color = '#DC2626';
                    }
                  }
                  
                  return td;
                };
              }
              
              // Colorear estado
              if (col === 7) {
                cellProperties.renderer = function(instance, td, row, col, prop, value) {
                  td.innerHTML = value || 'N/A';
                  td.style.textAlign = 'center';
                  td.style.fontWeight = 'bold';
                  
                  if (value === 'passed') {
                    td.style.backgroundColor = '#D1FAE5';
                    td.style.color = '#059669';
                    td.innerHTML = 'Aprobado';
                  } else if (value === 'failed') {
                    td.style.backgroundColor = '#FEE2E2';
                    td.style.color = '#DC2626';
                    td.innerHTML = 'Reprobado';
                  } else if (value === 'exempt') {
                    td.style.backgroundColor = '#DBEAFE';
                    td.style.color = '#2563EB';
                    td.innerHTML = 'Exento';
                  } else {
                    td.style.backgroundColor = '#FEF3C7';
                    td.style.color = '#D97706';
                    td.innerHTML = 'En Progreso';
                  }
                  
                  return td;
                };
              }
              
              return cellProperties;
            }}
          />
        )}
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
        <p className="font-semibold text-blue-900 mb-2">💡 Información:</p>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Total de registros: {grades.length}</li>
          <li>• Usa los filtros de columna para búsquedas específicas</li>
          <li>• Click derecho en cualquier celda para más opciones</li>
        </ul>
      </div>
    </div>
  );
}

export default GradesViewer;