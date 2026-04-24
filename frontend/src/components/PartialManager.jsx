import { useState } from 'react';
import PartialGradesTable from './PartialGradesTable';

function PartialManager({ semester, subject, group, teacherId }) {
  const [activeTab, setActiveTab] = useState(1);
  const tabs = [
    { id: 1, label: '📘 Parcial 1' },
    { id: 2, label: '📗 Parcial 2' },
    { id: 3, label: '📙 Parcial 3' },
    { id: 4, label: '🎓 Calificación Final' }
  ];
  return (
    <div>
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="p-4 bg-white rounded shadow">
        {activeTab === 1 && <PartialGradesTable partialId={1} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={false} />}
        {activeTab === 2 && <PartialGradesTable partialId={2} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={false} />}
        {activeTab === 3 && <PartialGradesTable partialId={3} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={false} />}
        {activeTab === 4 && <PartialGradesTable partialId={4} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={true} />}
      </div>
    </div>
  );
}

export default PartialManager;