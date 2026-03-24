// Mobile app calls the Monitoring Tool PHP APIs (read-only).
// You can override this with EXPO_PUBLIC_API_URL if needed.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'https://rwandafda.gov.rw/monitoring-tool/api';

const TM_BASE = 'https://rwandafda.gov.rw/monitoring-tool/TM';

/** Base URL for TM scripts (performance API lives here, not under /api/). */
export const TM_MONITORING_BASE = TM_BASE;

export const api = {
  /**
   * Default: Monitoring Tool `auth.php`.
   * Set EXPO_PUBLIC_AUTH_LOGIN_URL to your Node API (e.g. http://192.168.1.5:3001/api/auth/login)
   * if you need plain-text / legacy passcodes handled by the Express route in `server/src/routes/auth.js`.
   */
  login: process.env.EXPO_PUBLIC_AUTH_LOGIN_URL || `${API_BASE}/auth.php`,
  /** Optional second endpoint tried if the first returns failure (e.g. PHP + Node fallback). */
  loginFallback: process.env.EXPO_PUBLIC_AUTH_FALLBACK_LOGIN_URL || '',
  // TODO: point these to PHP endpoints when available
  refresh: `${API_BASE}/auth/refresh`,
  forgotPassword: `${API_BASE}/auth/forgot-password`,
  profile: `${API_BASE}/profile`,
  tasks: `${API_BASE}/tasks`,
  applications: `${API_BASE}/applications`,
  /** Single GET URL (token + common aliases some PHP scripts read). */
  performance: (staffId, month = 'all', apiToken) => {
    const params = new URLSearchParams({
      staff_id: String(staffId ?? ''),
      month: String(month ?? 'all'),
    });
    if (apiToken != null && String(apiToken).length > 0) {
      const t = String(apiToken);
      params.append('token', t);
      params.append('api_token', t);
      params.append('access_token', t);
    }
    return `${TM_BASE}/performance_api.php?${params.toString()}`;
  },
  performancePost: `${TM_BASE}/performance_api.php`,
  /**
   * Try these GET URLs in order — different deployments read different query param names for the API token.
   */
  performanceGetUrlVariants(staffId, month = 'all', apiToken) {
    const b = `${TM_BASE}/performance_api.php`;
    const s = String(staffId ?? '');
    const m = String(month ?? 'all');
    const t = apiToken != null && String(apiToken).length > 0 ? String(apiToken) : '';
    const out = [];
    if (t) {
      const pairs = [
        { staff_id: s, month: m, token: t },
        { staff_id: s, month: m, api_token: t },
        { staff_id: s, month: m, access_token: t },
        { staff_id: s, month: m, auth_token: t },
        { staff_id: s, month: m, user_token: t },
        // Some scripts read a single `key` / `api_key` param
        { staff_id: s, month: m, api_key: t },
      ];
      for (const p of pairs) {
        out.push(`${b}?${new URLSearchParams(p).toString()}`);
      }
    }
    out.push(`${b}?${new URLSearchParams({ staff_id: s, month: m }).toString()}`);
    return [...new Set(out)];
  },
  notifications: `${API_BASE}/notifications.php`,
  /** @param {{ page?: number, limit?: number, filter?: string }} [q] */
  notificationsQuery: (q = {}) => {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const filter = q.filter ?? 'all';
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      filter: String(filter),
    });
    return `${API_BASE}/notifications.php?${params.toString()}`;
  },
  registerDevice: `${API_BASE}/notifications/register-device`,
};
