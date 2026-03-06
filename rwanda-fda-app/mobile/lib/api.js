import { API_BASE } from '../constants/api';

export function getAuthHeaders(getToken) {
  const token = typeof getToken === 'function' ? getToken() : getToken;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
