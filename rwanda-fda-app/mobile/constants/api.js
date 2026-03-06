// Mobile app calls the Monitoring Tool PHP APIs (read-only).
// You can override this with EXPO_PUBLIC_API_URL if needed.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'https://rwandafda.gov.rw/monitoring-tool/api';

export const api = {
  // PHP auth endpoint
  login: `${API_BASE}/auth.php`,
  // TODO: point these to PHP endpoints when available
  refresh: `${API_BASE}/auth/refresh`,
  forgotPassword: `${API_BASE}/auth/forgot-password`,
  profile: `${API_BASE}/profile`,
  tasks: `${API_BASE}/tasks`,
  applications: `${API_BASE}/applications`,
  notifications: `${API_BASE}/notifications`,
  registerDevice: `${API_BASE}/notifications/register-device`,
};
