import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../api/axios';

registerAllModules();

function PartialAveragesTable({ semester, subject, group, teacherId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const hotRef = useRef(null);

  useEffect(() => {
    loadAverages();
  }, [semester, subject, group, teacherId]);

  const loadAverages = async () => {
    setLoading(true);
    try {
      const res = await api.get('/partials/partial-averages', {
        params: { teacherId, semester, subject, group }
      });
      const tableData = res.data.averages.map(a => [
        a.matricula,
        a.nombre,
        a.parcial_1 !== null ? a.parcial_1.toFixed(2) : 'N/A',
        a.parcial_2 !== null ? a.parcial_2.toFixed(2) : 'N/A',
        a.parcial_3 !== null ? a.parcial_3.toFixed(2) : 'N/A',
        a.final_promedio !== null ? a.final_promedio.toFixed(2) : 'N/A'
      ]);
      setData(tableData);
    } catch (error) {
      console.error(error);
      alert('Error al cargar promedios');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { data: 0, title: 'Matrícula', readOnly: true, width: 100 },
    { data: 1, title: 'Alumno', readOnly: true, width: 200 },
    { data: 2, title: 'Parcial 1', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 100 },
    { data: 3, title: 'Parcial 2', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 100 },
    { data: 4, title: 'Parcial 3', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 100 },
    { data: 5, title: '⭐ Promedio Final', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 130 }
  ];

  if (loading) return <div className="text-center py-8">Cargando promedios...</div>;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Promedio de Parciales</h3>
      <HotTable
        ref={hotRef}
        data={data}
        columns={columns}
        colHeaders={true}
        rowHeaders={true}
        width="100%"
        height="500"
        licenseKey="non-commercial-and-evaluation"
        stretchH="all"
        filters={true}
        columnSorting={true}
      />
    </div>
  );
}

export default PartialAveragesTable;