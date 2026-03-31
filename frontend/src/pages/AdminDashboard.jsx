import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import StudentsManager from '../components/admin/StudentsManager';
import UsersManager from '../components/admin/UsersManager';
import GradesViewer from '../components/admin/GradesViewer';
import Stats from '../components/admin/Stats';

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('stats');

  const tabs = [
    { id: 'stats', name: 'Estadísticas', icon: '📊' },
    { id: 'grades', name: 'Calificaciones', icon: '📝' },
    { id: 'students', name: 'Alumnos', icon: '👨‍🎓' },
    { id: 'users', name: 'Usuarios', icon: '👥' }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <nav className="bg-gradient-to-r from-purple-600 to-purple-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {user?.role === 'admin' ? '⚙️ Panel de Administración' : '👔 Panel de Director'}
            </h1>
            <p className="text-purple-100 text-sm">
              {user?.firstName} {user?.lastName} - {user?.role === 'admin' ? 'Administrador' : 'Director'}
            </p>
          </div>
          <button 
            onClick={logout} 
            className="bg-white text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-50 font-semibold"
          >
            Cerrar Sesión
          </button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="flex border-b">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'stats' && <Stats />}
          {activeTab === 'grades' && <GradesViewer />}
          {activeTab === 'students' && <StudentsManager />}
          {activeTab === 'users' && <UsersManager />}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;