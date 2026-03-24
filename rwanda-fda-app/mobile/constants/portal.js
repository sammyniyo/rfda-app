/** Full monitoring tool (web) — use for edits; mobile app is preview/read-focused. */
export const MONITORING_WEB_PORTAL_URL = String(
  process.env.EXPO_PUBLIC_WEB_PORTAL_URL || 'https://rwandafda.gov.rw/monitoring-tool'
).replace(/\/$/, '');
