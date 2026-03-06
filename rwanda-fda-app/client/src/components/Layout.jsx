import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsApi } from '../api';
import { useQuery } from './useQuery';
import './Layout.css';

const NavDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
);
const NavProfile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
const NavTasks = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
);
const NavApplications = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>
);
const NavNotifications = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
);

const nav = [
  { to: '/', label: 'Dashboard', icon: NavDashboard },
  { to: '/profile', label: 'My Profile', icon: NavProfile },
  { to: '/tasks', label: 'My Tasks', icon: NavTasks },
  { to: '/applications', label: 'My Applications', icon: NavApplications },
  { to: '/notifications', label: 'Notifications', icon: NavNotifications },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { logout } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const { data: notifications = [] } = useQuery(notificationsApi.list);
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">RFDA</span>
          <span className="brand-name">Rwanda FDA</span>
        </div>
        <nav className="sidebar-nav">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`nav-link ${location.pathname === to ? 'active' : ''}`}
              title={label}
            >
              <span className="nav-link-icon"><Icon /></span>
              <span className="nav-link-label">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="brand-tagline">Food & Drug Authority</div>
        </div>
      </aside>
      <main className="main">
        <header className="header">
          <h1 className="page-title">
            {nav.find((n) => n.to === location.pathname)?.label || 'Dashboard'}
          </h1>
          <div className="header-actions">
            <button type="button" className="icon-btn logout-btn" onClick={logout} title="Sign out">
              Sign out
            </button>
            <div className="notif-wrap">
              <button
                type="button"
                className="icon-btn notif-btn"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="Notifications"
              >
                <NotificationIcon />
                {unreadCount > 0 && (
                  <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-head">
                    <span>Notifications</span>
                    <Link to="/notifications" onClick={() => setNotifOpen(false)}>
                      View all
                    </Link>
                  </div>
                  {notifications.slice(0, 5).map((n) => (
                    <Link
                      key={n.id}
                      to="/notifications"
                      onClick={() => setNotifOpen(false)}
                      className={`notif-item ${!n.read_at ? 'unread' : ''}`}
                    >
                      <strong>{n.title}</strong>
                      <span className="notif-preview">{n.message?.slice(0, 60)}…</span>
                    </Link>
                  ))}
                  {notifications.length === 0 && (
                    <div className="notif-empty">No notifications</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}

function NotificationIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
