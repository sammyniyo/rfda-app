import { notificationsApi } from '../api';
import { useQuery } from '../components/useQuery';
import './Notifications.css';

const typeLabels = {
  assignment: 'New assignment',
  delay: 'Delay',
  status_update: 'Status update',
  general: 'Notification',
};

export default function Notifications() {
  const { data: notifications = [], loading, error } = useQuery(notificationsApi.list);

  if (loading) return <div className="page-loading">Loading notifications…</div>;
  if (error) return <div className="page-error">Failed to load notifications. {error}</div>;

  return (
    <div className="notifications-page">
      {notifications.length === 0 ? (
        <div className="card empty-state">
          <p>No notifications yet.</p>
        </div>
      ) : (
        <ul className="notif-list">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`card notif-card ${!n.read_at ? 'unread' : ''}`}
            >
              <div className="notif-type">
                {typeLabels[n.type] || n.type || 'Notification'}
              </div>
              <h3 className="notif-title">{n.title}</h3>
              {n.message && <p className="notif-message">{n.message}</p>}
              <div className="notif-time">
                {new Date(n.created_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
