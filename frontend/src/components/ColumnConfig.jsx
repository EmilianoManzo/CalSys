import { useState } from 'react';

function ColumnConfig({ columns, onSave, onCancel }) {
  const [localColumns, setLocalColumns] = useState(
    columns && columns.length > 0 
      ? columns.map(col => ({
          name: col.column_name || col.name || '',
          type: col.column_type || col.type || 'numeric',
          maxValue: col.max_value || col.maxValue || 10,
          weight: col.weight || 0,
          required: col.is_required || col.required || false
        }))
      : []
  );

  const addColumn = () => {
    setLocalColumns([...localColumns, { 
      name: '', 
      type: 'numeric', 
      maxValue: 10, 
      weight: 0, 
      required: false 
    }]);
  };

  const updateColumn = (index, field, value) => {
    const updated = [...localColumns];
    
    if (field === 'maxValue' || field === 'weight') {
      const num = value === '' ? '' : parseFloat(value);
      updated[index][field] = num === '' || isNaN(num) ? 0 : num;
    } else if (field === 'type') {
      updated[index][field] = value;
      if (value === 'text') {
        updated[index].weight = 0;
      }
    } else {
      updated[index][field] = value;
    }
    
    setLocalColumns(updated);
  };

  const removeColumn = (index) => {
    if (localColumns.length === 1) {
      alert('Debe haber al menos una columna');
      return;
    }
    setLocalColumns(localColumns.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const valid = localColumns.every(col => col.name && col.name.trim() !== '');
    if (!valid) {
      alert('Todas las columnas deben tener un nombre');
      return;
    }
    
    const totalWeight = localColumns
      .filter(col => col.type === 'numeric')
      .reduce((sum, col) => sum + (parseFloat(col.weight) || 0), 0);
    
    if (totalWeight > 100) {
      alert(`La suma de pesos es ${totalWeight.toFixed(1)}%. No puede superar 100%`);
      return;
    }
    
    if (totalWeight < 100 && totalWeight > 0) {
      const confirm = window.confirm(
        `La suma de pesos es ${totalWeight.toFixed(1)}% (falta ${(100 - totalWeight).toFixed(1)}%).\n¿Deseas continuar de todas formas?`
      );
      if (!confirm) return;
    }
    
    const validatedColumns = localColumns.map(col => ({
      name: col.name.trim(),
      type: col.type || 'numeric',
      maxValue: parseFloat(col.maxValue) || 10,
      weight: col.type === 'text' ? 0 : (parseFloat(col.weight) || 0),
      required: col.required || false
    }));
    
    onSave(validatedColumns);
  };

  const getTotalWeight = () => {
    return localColumns
      .filter(col => col.type === 'numeric')
      .reduce((sum, col) => sum + (parseFloat(col.weight) || 0), 0);
  };

  const totalWeight = getTotalWeight();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <h2 className="text-3xl font-bold mb-2">⚙️ Configurar Columnas de Evaluación</h2>
          <p className="text-blue-100">
            Define las actividades, exámenes y evaluaciones para esta materia
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Indicador de Peso */}
          <div className="mb-6 bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700">Ponderación Total:</span>
              <span className={`text-2xl font-bold ${
                totalWeight > 100 ? 'text-red-600' : 
                totalWeight === 100 ? 'text-green-600' : 
                'text-yellow-600'
              }`}>
                {totalWeight.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  totalWeight > 100 ? 'bg-red-500' :
                  totalWeight === 100 ? 'bg-green-500' :
                  'bg-yellow-500'
                }`}
                style={{ width: `${Math.min(totalWeight, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Lista de Columnas */}
          {localColumns.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-lg mb-4">No hay columnas configuradas</p>
              <p className="text-gray-400 text-sm">Haz clic en "Agregar Columna" para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {localColumns.map((col, index) => (
                <div 
                  key={index} 
                  className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-blue-100 text-blue-700 font-bold rounded-full w-8 h-8 flex items-center justify-center text-sm">
                      {index + 1}
                    </div>
                    <h3 className="font-semibold text-gray-700">
                      {col.name || `Columna ${index + 1}`}
                    </h3>
                    {col.type === 'text' && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                        Solo texto
                      </span>
                    )}
                    {col.required && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                        Obligatoria
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-12 gap-3">
                    {/* Nombre */}
                    <div className="col-span-12 md:col-span-4">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        NOMBRE *
                      </label>
                      <input 
                        type="text" 
                        value={col.name || ''} 
                        onChange={(e) => updateColumn(index, 'name', e.target.value)} 
                        className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none" 
                        placeholder="Ej: Tarea 1, Examen Final"
                      />
                    </div>

                    {/* Tipo */}
                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        TIPO
                      </label>
                      <select 
                        value={col.type || 'numeric'} 
                        onChange={(e) => updateColumn(index, 'type', e.target.value)} 
                        className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 outline-none"
                      >
                        <option value="numeric">📊 Numérico</option>
                        <option value="text">📝 Texto</option>
                      </select>
                    </div>

                    {/* Campos condicionales según tipo */}
                    {col.type === 'numeric' ? (
                      <>
                        {/* Valor Máximo */}
                        <div className="col-span-6 md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            VALOR MAX
                          </label>
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            value={col.maxValue || 10} 
                            onChange={(e) => updateColumn(index, 'maxValue', e.target.value)} 
                            className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 outline-none"
                          />
                        </div>

                        {/* Peso */}
                        <div className="col-span-6 md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            PESO (%)
                          </label>
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0"
                            max="100"
                            value={col.weight || 0} 
                            onChange={(e) => updateColumn(index, 'weight', e.target.value)} 
                            className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="col-span-12 md:col-span-4">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          SIN PONDERACIÓN
                        </label>
                        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg px-3 py-2 text-gray-500 text-sm italic">
                          Campo de texto (no cuenta para calificación)
                        </div>
                      </div>
                    )}

                    {/* Requerida */}
                    <div className="col-span-6 md:col-span-1 flex items-end">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={col.required || false}
                          onChange={(e) => updateColumn(index, 'required', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-gray-700">Req.</span>
                      </label>
                    </div>

                    {/* Eliminar */}
                    <div className="col-span-6 md:col-span-1 flex items-end">
                      <button 
                        onClick={() => removeColumn(index)} 
                        className="w-full bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 font-semibold transition-colors"
                        title="Eliminar columna"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Botón Agregar */}
          <button 
            onClick={addColumn} 
            className="mt-4 w-full border-3 border-dashed border-blue-400 bg-blue-50 text-blue-700 py-4 rounded-lg font-bold text-lg hover:bg-blue-100 hover:border-blue-500 transition-all"
          >
            ➕ Agregar Nueva Columna
          </button>

          {/* Tips */}
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-4">
            <p className="font-bold text-blue-900 mb-2">💡 Consejos:</p>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• <strong>Numérico:</strong> Para calificaciones que suman al promedio final</li>
              <li>• <strong>Texto:</strong> Para observaciones o comentarios (no afecta la calificación)</li>
              <li>• <strong>Peso:</strong> Debe sumar exactamente 100% entre todas las columnas numéricas</li>
              <li>• <strong>Requerida:</strong> Marca si es obligatoria para aprobar la materia</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 bg-gray-50 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-center sm:text-left">
              <div className="text-sm text-gray-600">
                {localColumns.length} columna{localColumns.length !== 1 ? 's' : ''} configurada{localColumns.length !== 1 ? 's' : ''}
              </div>
              <div className={`text-lg font-bold ${
                totalWeight > 100 ? 'text-red-600' :
                totalWeight === 100 ? 'text-green-600' :
                'text-yellow-600'
              }`}>
                Total: {totalWeight.toFixed(1)}% / 100%
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={onCancel} 
                className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-100 font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-bold shadow-lg transition-all"
              >
                💾 Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ColumnConfig;