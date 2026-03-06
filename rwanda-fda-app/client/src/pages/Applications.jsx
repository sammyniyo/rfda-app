import { useState } from 'react';
import { applicationsApi } from '../api';
import { useQuery } from '../components/useQuery';
import './Applications.css';

const statusFilters = ['', 'draft', 'submitted', 'under_review', 'approved', 'rejected', 'on_hold'];

export default function Applications() {
  const [status, setStatus] = useState('');
  const { data: applications = [], loading, error } = useQuery(
    () => applicationsApi.list(status || undefined),
    [status]
  );

  if (loading) return <div className="page-loading">Loading applications…</div>;
  if (error) return <div className="page-error">Failed to load applications. {error}</div>;

  return (
    <div className="applications-page">
      <div className="tasks-toolbar">
        <span className="filter-label">Status</span>
        <div className="filter-pills">
          {statusFilters.map((s) => (
            <button
              key={s || 'all'}
              type="button"
              className={`pill ${status === s ? 'active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="card empty-state">
          <p>No applications match your selection.</p>
        </div>
      ) : (
        <div className="applications-table-wrap card">
          <table className="applications-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Type / Title</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td className="ref-cell">{a.reference_number || `#${a.id}`}</td>
                  <td>
                    <span className="app-type">{a.type || 'Application'}</span>
                    {a.title && <span className="app-title">{a.title}</span>}
                  </td>
                  <td>
                    <span className={`status-pill status-${a.status}`}>
                      {String(a.status).replace('_', ' ')}
                    </span>
                  </td>
                  <td className="date-cell">
                    {a.submitted_at
                      ? new Date(a.submitted_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="date-cell">
                    {a.updated_at
                      ? new Date(a.updated_at).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
