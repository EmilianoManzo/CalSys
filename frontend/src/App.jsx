import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [status, setStatus] = useState('🔄 Conectando...');
  const [dbStatus, setDbStatus] = useState('⏳ Verificando...');

  useEffect(() => {
    axios.get('http://localhost:3000')
      .then(res => setStatus('✅ ' + res.data.message))
      .catch(() => setStatus('❌ Backend desconectado'));

    axios.get('http://localhost:3000/api/health')
      .then(res => setDbStatus('✅ BD: ' + res.data.database))
      .catch(() => setDbStatus('❌ BD: error'));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-blue-600 mb-2">📊 Calsys</h1>
          <p className="text-gray-600 text-lg">Sistema de Calificaciones</p>
          <p className="text-gray-400 text-sm mt-1">v1.0.0</p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-lg font-semibold">{status}</p>
          </div>
          
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <p className="text-lg font-semibold">{dbStatus}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-semibold text-gray-700 mb-2">🔧 Backend</p>
            <p className="text-gray-600">http://localhost:3000</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-semibold text-gray-700 mb-2">💻 Frontend</p>
            <p className="text-gray-600">http://localhost:5173</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-semibold text-gray-700 mb-2">🗄️ Base de Datos</p>
            <p className="text-gray-600">calsys_db</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-semibold text-gray-700 mb-2">📦 Stack</p>
            <p className="text-gray-600">React + Express + MySQL</p>
          </div>
        </div>

        {status.includes('✅') && dbStatus.includes('✅') && (
          <div className="mt-8 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <p className="font-bold">🎉 ¡Sistema funcionando correctamente!</p>
            <p className="text-sm mt-1">Todo listo para comenzar el desarrollo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
