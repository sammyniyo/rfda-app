import { API_BASE } from '../constants/api';

/**
 * PHP backends often return success as 1 / "1" instead of boolean true.
 * Using `success === true` alone falsely treats valid responses as failures.
 */
export function isApiSuccess(payload) {
  if (payload == null || typeof payload !== 'object') return false;
  if (!Object.prototype.hasOwnProperty.call(payload, 'success')) return true;
  const s = payload.success;
  if (s === false || s === 0 || s === '0' || s === 'false' || s === null) return false;
  if (s === true || s === 1) return true;
  if (typeof s === 'string') {
    const t = s.trim().toLowerCase();
    if (t === 'false' || t === '0' || t === 'no') return false;
    return t === '1' || t === 'true' || t === 'yes' || t === 'ok';
  }
  return Boolean(s);
}

export function getAuthHeaders(getToken) {
  const token = typeof getToken === 'function' ? getToken() : getToken;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
