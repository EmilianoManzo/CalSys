import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../api/axios';

registerAllModules();

function AlumnoDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const hotRef = useRef(null);

  useEffect(() => {
    if (user?.matricula) {
      cargarCalificaciones();
    }
  }, [user]);

  const cargarCalificaciones = async () => {
    try {
      // Query simple y directo
      const response = await api.get(`/grades/student/${user.matricula}/tabla`);
      setData(response.data.calificaciones);
    } catch (error) {
      console.error('Error cargando calificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { data: 'semestre', title: 'Semestre', readOnly: true, width: 100 },
    { data: 'materia', title: 'Materia', readOnly: true, width: 150 },
    { data: 'grupo', title: 'Grupo', readOnly: true, width: 80 },
    { data: 'maestro', title: 'Maestro', readOnly: true, width: 180 },
    { data: 'actividad', title: 'Actividad', readOnly: true, width: 150 },
    { data: 'calificacion', title: 'Calificación', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 100 },
    { data: 'peso', title: 'Peso %', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.0' }, width: 80 },
    { data: 'final', title: 'FINAL', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 100, className: 'htCenter htMiddle' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando calificaciones...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <nav className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">📊 Calsys - Mis Calificaciones</h1>
            <p className="text-blue-100 text-sm">{user?.firstName} {user?.lastName} - {user?.matricula}</p>
          </div>
          <button 
            onClick={logout} 
            className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 font-semibold"
          >
            Cerrar Sesión
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Historial de Calificaciones</h2>

          {data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-xl mb-2">No tienes calificaciones registradas</p>
              <p className="text-sm">Contacta a tu maestro para más información</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <HotTable
                ref={hotRef}
                data={data}
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
                  
                  // Colorear columna FINAL
                  if (col === 7) {
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
                  
                  // Colorear calificación
                  if (col === 5) {
                    cellProperties.renderer = function(instance, td, row, col, prop, value) {
                      td.innerHTML = value !== null && value !== undefined ? parseFloat(value).toFixed(2) : 'N/A';
                      td.style.textAlign = 'center';
                      
                      if (value !== null && value !== undefined) {
                        const val = parseFloat(value);
                        if (val >= 9) {
                          td.style.color = '#059669';
                          td.style.fontWeight = 'bold';
                        } else if (val >= 6) {
                          td.style.color = '#2563EB';
                        } else {
                          td.style.color = '#DC2626';
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

          {data.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 mb-1">Promedio General</p>
                <p className="text-3xl font-bold text-blue-600">
                  {(data.reduce((sum, row) => sum + (parseFloat(row.final) || 0), 0) / 
                    data.filter(row => row.final !== null).length || 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <p className="text-sm text-gray-600 mb-1">Materias Aprobadas</p>
                <p className="text-3xl font-bold text-green-600">
                  {data.filter(row => parseFloat(row.final) >= 6).length}
                </p>
              </div>

              <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                <p className="text-sm text-gray-600 mb-1">Materias Reprobadas</p>
                <p className="text-3xl font-bold text-red-600">
                  {data.filter(row => parseFloat(row.final) < 6 && row.final !== null).length}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-2">💡 Escala de Calificaciones:</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-gray-700">9.0 - 10.0: Excelente</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-gray-700">6.0 - 8.9: Aprobado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-gray-700">0.0 - 5.9: Reprobado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlumnoDashboard;