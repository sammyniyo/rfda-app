import { useState } from 'react';
import { tasksApi } from '../api';
import { useQuery } from '../components/useQuery';
import './Tasks.css';

const statusFilters = ['', 'pending', 'in_progress', 'completed'];

export default function Tasks() {
  const [status, setStatus] = useState('');
  const { data: tasks = [], loading, error } = useQuery(
    () => tasksApi.list(status || undefined),
    [status]
  );

  if (loading) return <div className="page-loading">Loading tasks…</div>;
  if (error) return <div className="page-error">Failed to load tasks. {error}</div>;

  return (
    <div className="tasks-page">
      <div className="tasks-toolbar">
        <span className="filter-label">Status</span>
        <div className="filter-pills">
          {statusFilters.map((s) => (
            <button
              key={s || 'all'}
              type="button"
              className={`pill ${!s ? 'all' : ''} ${status === s ? 'active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="card empty-state">
          <p>No tasks match your selection.</p>
        </div>
      ) : (
        <ul className="tasks-list">
          {tasks.map((t) => (
            <li key={t.id} className="card task-card">
              <div className="task-card-main">
                <h3 className="task-card-title">{t.title}</h3>
                {t.description && (
                  <p className="task-card-desc">{t.description}</p>
                )}
                <div className="task-card-meta">
                  <span className={`status-pill status-${t.status}`}>{t.status}</span>
                  {t.priority && (
                    <span className={`priority-badge priority-${t.priority}`}>{t.priority}</span>
                  )}
                  {t.due_date && (
                    <span className="due-date">Due {new Date(t.due_date).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
