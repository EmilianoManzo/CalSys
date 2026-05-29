import { useState } from 'react';
import PartialGradesTable from './PartialGradesTable';
import AttendanceTable from './AttendanceTable';

const tabs = [
  { id: 1, label: 'Parcial 1', icon: 'ti-book' },
  { id: 2, label: 'Parcial 2', icon: 'ti-book-2' },
  { id: 3, label: 'Parcial 3', icon: 'ti-books' },
  { id: 4, label: 'Examen Final', icon: 'ti-pencil' },
  { id: 5, label: 'Cal. Final', icon: 'ti-award' },
  { id: 6, label: 'Asistencia', icon: 'ti-calendar-check' },
];

function PartialManager({ semester, subject, group, teacherId }) {
  const [activeTab, setActiveTab] = useState(1);

  return (
    <>
      <style>{`
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');

        .pm-wrapper {
          font-family: 'DM Sans', sans-serif;
        }

        .pm-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 1.5rem;
          border-bottom: 0.5px solid #e5e7eb;
          padding-bottom: 1rem;
        }

        .pm-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          background: #f3f4f6;
          font-size: 13px;
          font-weight: 500;
          color: #4b5563;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.2s;
          border: 0.5px solid #e5e7eb;
        }

        .pm-tab i {
          font-size: 16px;
        }

        .pm-tab:hover {
          background: #e5e7eb;
          color: #111111;
        }

        .pm-tab.pm-tab-active {
          background: #880000;
          color: #ffffff;
          border-color: #880000;
        }

        .pm-content {
          background: #ffffff;
          border-radius: 12px;
          padding: 0;
        }
      `}</style>

      <div className="pm-wrapper">
        <nav className="pm-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pm-tab ${activeTab === tab.id ? 'pm-tab-active' : ''}`}
            >
              <i className={`ti ${tab.icon}`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="pm-content">
          {activeTab === 1 && <PartialGradesTable partialId={1} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={false} />}
          {activeTab === 2 && <PartialGradesTable partialId={2} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={false} />}
          {activeTab === 3 && <PartialGradesTable partialId={3} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={false} />}
          {activeTab === 4 && <PartialGradesTable partialId={4} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={false} />}
          {activeTab === 5 && <PartialGradesTable partialId={5} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={true} />}
          {activeTab === 6 && <AttendanceTable semester={semester} subject={subject} group={group} teacherId={teacherId} />}
        </div>
      </div>
    </>
  );
}

export default PartialManager;