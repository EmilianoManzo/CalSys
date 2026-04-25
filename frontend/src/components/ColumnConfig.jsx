import { useState, useEffect } from 'react';

function ColumnConfig({ columns, onSave, onCancel, showSpecialColumn = true }) {
  const [localColumns, setLocalColumns] = useState([]);

  useEffect(() => {
    let normals = (columns || []).filter(c => !c.is_special).map(col => ({
      name: col.column_name || col.name || '',
      type: col.column_type || col.type || 'numeric',
      maxValue: col.max_value || col.maxValue || 10,
      weight: col.weight || 0,
      required: col.is_required || col.required || false,
      is_special: false
    }));
    if (showSpecialColumn) {
      const existingSpecial = (columns || []).find(c => c.is_special === true);
      if (existingSpecial) {
        setLocalColumns([
          {
            name: existingSpecial.column_name || 'Promedio de Parciales',
            type: 'numeric',
            maxValue: existingSpecial.max_value || 10,
            weight: existingSpecial.weight || 0,
            required: existingSpecial.is_required || false,
            is_special: true
          },
          ...normals
        ]);
      } else {
        setLocalColumns([
          { name: 'Promedio de Parciales', type: 'numeric', maxValue: 10, weight: 0, required: false, is_special: true },
          ...normals
        ]);
      }
    } else {
      setLocalColumns(normals);
    }
  }, [columns, showSpecialColumn]);

  const addColumn = () => {
    setLocalColumns([...localColumns, { name: '', type: 'numeric', maxValue: 10, weight: 0, required: false, is_special: false }]);
  };

  const updateColumn = (idx, field, val) => {
    const updated = [...localColumns];
    if (updated[idx].is_special && field !== 'weight' && field !== 'required' && field !== 'name') return;
    if (field === 'maxValue' || field === 'weight') {
      const num = val === '' ? '' : parseFloat(val);
      updated[idx][field] = num === '' || isNaN(num) ? 0 : num;
    } else if (field === 'type') {
      updated[idx][field] = val;
      if (val === 'text') updated[idx].weight = 0;
    } else {
      updated[idx][field] = val;
    }
    setLocalColumns(updated);
  };

  const removeColumn = (idx) => {
    if (localColumns[idx].is_special) {
      alert('No se puede eliminar la columna de promedio de parciales');
      return;
    }
    if (localColumns.filter(c => !c.is_special).length === 1) {
      alert('Debe haber al menos una columna adicional');
      return;
    }
    setLocalColumns(localColumns.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const normals = localColumns.filter(c => !c.is_special);
    if (!normals.every(c => c.name && c.name.trim())) {
      alert('Todas las columnas deben tener un nombre');
      return;
    }
    const totalWeight = localColumns
      .filter(c => c.type === 'numeric')
      .reduce((s, c) => s + (parseFloat(c.weight) || 0), 0);
    if (totalWeight > 100) {
      alert(`La suma de pesos es ${totalWeight.toFixed(1)}%. No puede superar 100%`);
      return;
    }
    if (totalWeight < 100 && totalWeight > 0 && !window.confirm(`La suma de pesos es ${totalWeight.toFixed(1)}% (falta ${(100 - totalWeight).toFixed(1)}%). ¿Continuar?`)) return;
    const validatedColumns = localColumns.map(c => ({
      name: c.name.trim(),
      type: c.type || 'numeric',
      maxValue: parseFloat(c.maxValue) || 10,
      weight: c.type === 'text' ? 0 : (parseFloat(c.weight) || 0),
      required: c.required || false,
      is_special: c.is_special || false
    }));
    onSave(validatedColumns);
  };

  const totalWeight = localColumns
    .filter(c => c.type === 'numeric')
    .reduce((s, c) => s + (parseFloat(c.weight) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <h2 className="text-3xl font-bold mb-2">Configurar Columnas de Evaluación</h2>
          <p className="text-blue-100">{showSpecialColumn ? 'La primera fila (Promedio de Parciales) es fija y su peso es configurable.' : 'Define las actividades que componen este parcial.'}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700">Ponderación Total:</span>
              <span className={`text-2xl font-bold ${totalWeight > 100 ? 'text-red-600' : totalWeight === 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                {totalWeight.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div className={`h-full transition-all duration-300 ${totalWeight > 100 ? 'bg-red-500' : totalWeight === 100 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${Math.min(totalWeight, 100)}%` }} />
            </div>
          </div>
          {localColumns.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-lg mb-4">No hay columnas configuradas</p>
              <p className="text-gray-400 text-sm">Haz clic en "Agregar Columna" para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {localColumns.map((col, idx) => (
                <div key={idx} className={`bg-white border-2 rounded-lg p-4 shadow-sm ${col.is_special ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`font-bold rounded-full w-8 h-8 flex items-center justify-center text-sm ${col.is_special ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
                      {idx + 1}
                    </div>
                    <h3 className="font-semibold text-gray-700">
                      {col.name || `Columna ${idx + 1}`}
                      {col.is_special && <span className="ml-2 text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">Fija (Promedio Parciales)</span>}
                    </h3>
                    {col.type === 'text' && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Solo texto</span>}
                    {col.required && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Obligatoria</span>}
                  </div>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 md:col-span-4">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">NOMBRE *</label>
                      <input type="text" value={col.name} onChange={e => updateColumn(idx, 'name', e.target.value)} disabled={col.is_special} className={`w-full border-2 rounded-lg px-3 py-2 focus:border-blue-500 outline-none ${col.is_special ? 'bg-gray-100' : ''}`} placeholder={col.is_special ? 'Promedio de Parciales (fijo)' : 'Ej: Tarea 1, Examen Final'} />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">TIPO</label>
                      <select value={col.type} onChange={e => updateColumn(idx, 'type', e.target.value)} disabled={col.is_special} className="w-full border-2 rounded-lg px-3 py-2 focus:border-blue-500 outline-none">
                        <option value="numeric">Numérico</option>
                        <option value="text">Texto</option>
                      </select>
                    </div>
                    {col.type === 'numeric' ? (
                      <>
                        <div className="col-span-6 md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">VALOR MAX</label>
                          <input type="number" step="0.01" min="0" value={col.maxValue} onChange={e => updateColumn(idx, 'maxValue', e.target.value)} disabled={col.is_special} className="w-full border-2 rounded-lg px-3 py-2" />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">PESO (%)</label>
                          <input type="number" step="0.1" min="0" max="100" value={col.weight} onChange={e => updateColumn(idx, 'weight', e.target.value)} className="w-full border-2 rounded-lg px-3 py-2" />
                        </div>
                      </>
                    ) : (
                      <div className="col-span-12 md:col-span-4">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">SIN PONDERACIÓN</label>
                        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg px-3 py-2 text-gray-500 text-sm italic">Campo de texto (no cuenta para calificación)</div>
                      </div>
                    )}
                    <div className="col-span-6 md:col-span-1 flex items-end">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={col.required} onChange={e => updateColumn(idx, 'required', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-xs font-medium text-gray-700">Req.</span>
                      </label>
                    </div>
                    <div className="col-span-6 md:col-span-1 flex items-end">
                      <button onClick={() => removeColumn(idx)} disabled={col.is_special} className={`w-full px-3 py-2 rounded-lg font-semibold transition-colors ${col.is_special ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={addColumn} className="mt-4 w-full border-3 border-dashed border-blue-400 bg-blue-50 text-blue-700 py-4 rounded-lg font-bold text-lg hover:bg-blue-100 transition-all">
            + Agregar Nueva Columna
          </button>
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-4">
            <p className="font-bold text-blue-900 mb-2">💡 Consejos:</p>
            <ul className="space-y-1 text-sm text-blue-800">
              {showSpecialColumn && <li>• <strong>Promedio de Parciales (fijo):</strong> Se calcula automáticamente como el promedio de los tres parciales. Puedes asignarle un peso.</li>}
              <li>• <strong>Numérico:</strong> Para calificaciones que suman a la nota final.</li>
              <li>• <strong>Texto:</strong> Solo comentarios (no afecta la nota).</li>
              <li>• <strong>Peso:</strong> La suma de los pesos de todas las columnas numéricas debe ser 100%.</li>
            </ul>
          </div>
        </div>
        <div className="border-t-2 bg-gray-50 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-center sm:text-left">
              <div className="text-sm text-gray-600">{localColumns.length} columnas</div>
              <div className={`text-lg font-bold ${totalWeight > 100 ? 'text-red-600' : totalWeight === 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                Total: {totalWeight.toFixed(1)}% / 100%
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-100 font-semibold">Cancelar</button>
              <button onClick={handleSave} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-bold shadow-lg transition-all">
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ColumnConfig;