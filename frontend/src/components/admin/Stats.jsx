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

  const formatNumber = (value, decimals = 2) => {
    const num = Number(value);
    return isNaN(num) ? '0.00' : num.toFixed(decimals);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ marginBottom: '8px' }}>⏳</div>
        Cargando estadísticas...
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#dc2626', fontFamily: 'DM Sans, sans-serif' }}>
        ❌ Error al cargar estadísticas
      </div>
    );
  }

  const cards = [
    { 
      title: 'Total Estudiantes', 
      value: Number(stats.totalEstudiantes) || 0, 
      icon: '👨‍🎓',
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    },
    { 
      title: 'Total Maestros', 
      value: Number(stats.totalMaestros) || 0, 
      icon: '👨‍🏫',
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    },
    { 
      title: 'Promedio General', 
      value: formatNumber(stats.promedioGeneral), 
      icon: '📊',
      color: '#8b5cf6',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
    },
    { 
      title: 'Total Materias', 
      value: Number(stats.totalMaterias) || 0, 
      icon: '📚',
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    },
    { 
      title: 'Estudiantes Excelentes', 
      value: Number(stats.estudiantesExcelentes) || 0, 
      icon: '⭐',
      color: '#06b6d4',
      gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      subtitle: 'Calificación ≥ 9'
    },
    { 
      title: 'Estudiantes con Materias Reprobadas', 
      value: Number(stats.estudiantesReprobados) || 0, 
      icon: '⚠️',
      color: '#ef4444',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      subtitle: 'Al menos una materia < 6'
    }
  ];

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111', marginBottom: '1.5rem' }}>
        📈 Estadísticas Generales
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1rem'
      }}>
        {cards.map((card, idx) => (
          <div
            key={idx}
            style={{
              background: card.gradient,
              borderRadius: '16px',
              padding: '1.25rem',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <span style={{ fontSize: '36px' }}>{card.icon}</span>
              {card.subtitle && (
                <span style={{
                  fontSize: '10px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  fontWeight: 500
                }}>
                  {card.subtitle}
                </span>
              )}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '4px' }}>
              {card.value}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              {card.title}
            </div>
          </div>
        ))}
      </div>

      {/* Información adicional */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: '#f9fafb',
        borderRadius: '12px',
        border: '0.5px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
          <span>📅 Última actualización: {new Date().toLocaleDateString()}</span>
          <span>🔄 Los datos se actualizan automáticamente</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#880000',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 16px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.target.style.background = '#6b0000'}
          onMouseLeave={e => e.target.style.background = '#880000'}
        >
          🔄 Actualizar
        </button>
      </div>
    </div>
  );
}

export default Stats;