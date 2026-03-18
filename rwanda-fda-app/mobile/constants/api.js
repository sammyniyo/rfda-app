// Mobile app calls the Monitoring Tool PHP APIs (read-only).
// You can override this with EXPO_PUBLIC_API_URL if needed.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'https://rwandafda.gov.rw/monitoring-tool/api';

const TM_BASE = 'https://rwandafda.gov.rw/monitoring-tool/TM';

export const api = {
  // PHP auth endpoint
  login: `${API_BASE}/auth.php`,
  // TODO: point these to PHP endpoints when available
  refresh: `${API_BASE}/auth/refresh`,
  forgotPassword: `${API_BASE}/auth/forgot-password`,
  profile: `${API_BASE}/profile`,
  tasks: `${API_BASE}/tasks`,
  applications: `${API_BASE}/applications`,
  performance: (staffId, type = 'hmdr-med', month = 'all') =>
    `${TM_BASE}/performance_api.php?staff_id=${encodeURIComponent(String(staffId || ''))}&type=${encodeURIComponent(
      type
    )}&month=${encodeURIComponent(month)}`,
  notifications: `${API_BASE}/notifications`,
  registerDevice: `${API_BASE}/notifications/register-device`,
};
