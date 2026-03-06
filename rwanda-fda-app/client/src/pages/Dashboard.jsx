import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { profileApi, tasksApi, applicationsApi, notificationsApi } from '../api';
import { useQuery } from '../components/useQuery';
import './Dashboard.css';

const IconTasks = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
);
const IconApplications = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>
);
const IconNotifications = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
);

export default function Dashboard() {
  const [dbStatus, setDbStatus] = useState(null);
  useEffect(() => {
    fetch('/api/db-test')
      .then((r) => r.json())
      .then((d) => setDbStatus(d.ok ? 'connected' : 'error'))
      .catch(() => setDbStatus('error'));
  }, []);

  const { data: profile } = useQuery(profileApi.get);
  const { data: tasks = [], error: tasksError } = useQuery(tasksApi.list);
  const { data: applications = [], error: appsError } = useQuery(applicationsApi.list);
  const { data: notifications = [], error: notifError } = useQuery(notificationsApi.list);

  const pendingTasks = Array.isArray(tasks) ? tasks.filter((t) => t.status !== 'completed').length : 0;
  const recentApplications = Array.isArray(applications) ? applications.slice(0, 5) : [];
  const unreadNotifs = Array.isArray(notifications) ? notifications.filter((n) => !n.read_at).length : 0;
  const tasksList = tasksError ? [] : (tasks || []);
  const appsList = appsError ? [] : (applications || []);

  return (
    <div className="dashboard">
      <div className="welcome-card card">
        <div className="welcome-text">
          <h2>Welcome back{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}</h2>
          <p>
            {profile?.department
              ? `${profile.department} • ${profile.role || 'Staff'}`
              : 'Rwanda FDA Portal'}
          </p>
        </div>
      </div>

      <div className="stats-row">
        <Link to="/tasks" className="stat-card card">
          <span className="stat-card-icon stat-card-icon-tasks"><IconTasks /></span>
          <span className="stat-value">{pendingTasks}</span>
          <span className="stat-label">Pending tasks</span>
        </Link>
        <Link to="/applications" className="stat-card card">
          <span className="stat-card-icon stat-card-icon-apps"><IconApplications /></span>
          <span className="stat-value">{applications.length}</span>
          <span className="stat-label">My applications</span>
        </Link>
        <Link to="/notifications" className="stat-card card">
          <span className="stat-card-icon stat-card-icon-notif"><IconNotifications /></span>
          <span className="stat-value">{unreadNotifs}</span>
          <span className="stat-label">Unread notifications</span>
        </Link>
      </div>

      <div className="dashboard-grid">
        <section className="card section-card">
          <div className="section-head">
            <h3>Recent tasks</h3>
            <Link to="/tasks">View all</Link>
          </div>
          {tasksList.length === 0 ? (
            <p className="empty-msg">{tasksError ? 'Tasks unavailable.' : 'No tasks assigned yet.'}</p>
          ) : (
            <ul className="task-list">
              {tasksList.slice(0, 5).map((t) => (
                <li key={t.id} className="task-row">
                  <span className="task-title">{t.title}</span>
                  <span className={`status-pill status-${t.status}`}>{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card section-card">
          <div className="section-head">
            <h3>My applications</h3>
            <Link to="/applications">View all</Link>
          </div>
          {recentApplications.length === 0 ? (
            <p className="empty-msg">{appsError ? 'Applications unavailable.' : 'No applications yet.'}</p>
          ) : (
            <ul className="app-list">
              {recentApplications.map((a) => (
                <li key={a.id}>
                  <Link to="/applications" className="app-row">
                    <span className="app-ref">{a.reference_number || `#${a.id}`}</span>
                    <span className={`status-pill status-${a.status}`}>{a.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {dbStatus && (
        <p className="dashboard-db-status">
          <span className={`dashboard-db-dot ${dbStatus}`} />
          Database {dbStatus === 'connected' ? 'connected' : 'error'}
        </p>
      )}
    </div>
  );
}
