import { useState, useEffect } from 'react';
import api from '../../api/axios';

function Stats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Cargando estadísticas...</div>;
  }

  if (!stats) {
    return <div className="text-center py-12 text-red-600">Error al cargar estadísticas</div>;
  }

  // Función auxiliar para formatear números de forma segura
  const formatNumber = (value, decimals = 2) => {
    const num = Number(value);
    return isNaN(num) ? '0.00' : num.toFixed(decimals);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Estadísticas Generales</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm mb-2">Total Estudiantes</p>
          <p className="text-4xl font-bold text-blue-600">{Number(stats.totalEstudiantes) || 0}</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm mb-2">Total Maestros</p>
          <p className="text-4xl font-bold text-green-600">{Number(stats.totalMaestros) || 0}</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm mb-2">Promedio General</p>
          <p className="text-4xl font-bold text-purple-600">
            {formatNumber(stats.promedioGeneral)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm mb-2">Total Materias</p>
          <p className="text-4xl font-bold text-yellow-600">{Number(stats.totalMaterias) || 0}</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-emerald-500">
          <p className="text-gray-600 text-sm mb-2">Estudiantes Excelentes (≥9)</p>
          <p className="text-4xl font-bold text-emerald-600">{Number(stats.estudiantesExcelentes) || 0}</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm mb-2">Estudiantes con Materias Reprobadas</p>
          <p className="text-4xl font-bold text-red-600">{Number(stats.estudiantesReprobados) || 0}</p>
        </div>
      </div>
    </div>
  );
}

export default Stats;