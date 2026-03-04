import { useState } from 'react';

function ColumnConfig({ columns, onSave, onCancel }) {
  const [localColumns, setLocalColumns] = useState(columns || []);

  const addColumn = () => {
    setLocalColumns([...localColumns, { name: '', type: 'numeric', maxValue: 10, weight: 1, required: false }]);
  };

  const updateColumn = (index, field, value) => {
    const updated = [...localColumns];
    
    if (field === 'maxValue' || field === 'weight') {
      const num = value === '' ? '' : parseFloat(value);
      updated[index][field] = num === '' || isNaN(num) ? 10 : num;
    } else {
      updated[index][field] = value;
    }
    
    setLocalColumns(updated);
  };

  const removeColumn = (index) => {
    setLocalColumns(localColumns.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const valid = localColumns.every(col => col.name.trim() !== '');
    if (!valid) {
      alert('Todas las columnas deben tener un nombre');
      return;
    }
    
    // Asegurar que todos los valores numéricos sean válidos
    const validatedColumns = localColumns.map(col => ({
      ...col,
      maxValue: col.maxValue || 10,
      weight: col.weight || 1
    }));
    
    onSave(validatedColumns);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">Configurar Columnas</h2>
        </div>
        <div className="p-6 overflow-y-auto" style={{maxHeight: '60vh'}}>
          {localColumns.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay columnas configuradas</div>
          ) : (
            <div className="space-y-4">
              {localColumns.map((col, index) => (
                <div key={index} className="border rounded p-4 bg-gray-50">
                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-2">
                      <label className="block text-sm mb-1">Nombre</label>
                      <input 
                        type="text" 
                        value={col.name || ''} 
                        onChange={(e) => updateColumn(index, 'name', e.target.value)} 
                        className="w-full border rounded px-3 py-2" 
                        placeholder="Tarea 1" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Tipo</label>
                      <select 
                        value={col.type || 'numeric'} 
                        onChange={(e) => updateColumn(index, 'type', e.target.value)} 
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="numeric">Numero</option>
                        <option value="percentage">Porcentaje</option>
                        <option value="text">Texto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Max</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={col.maxValue || 10} 
                        onChange={(e) => updateColumn(index, 'maxValue', e.target.value)} 
                        className="w-full border rounded px-3 py-2" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Peso %</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={col.weight || 1} 
                        onChange={(e) => updateColumn(index, 'weight', e.target.value)} 
                        className="w-full border rounded px-3 py-2" 
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={() => removeColumn(index)} 
                        className="w-full bg-red-500 text-white px-2 py-2 rounded hover:bg-red-600"
                      >
                        X
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button 
            onClick={addColumn} 
            className="mt-4 w-full border-2 border-dashed border-blue-300 text-blue-600 py-3 rounded font-semibold hover:bg-blue-50"
          >
            + Agregar Columna
          </button>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button 
            onClick={onCancel} 
            className="px-6 py-2 border rounded hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ColumnConfig;