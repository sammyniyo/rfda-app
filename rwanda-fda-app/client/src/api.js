const API = '/api';

function getToken() {
  return localStorage.getItem('rwanda_fda_token');
}

async function fetchApi(path, options = {}) {
  const token = getToken();
  const url = `${API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const profileApi = {
  get: () => fetchApi('/profile'),
};

export const tasksApi = {
  list: (status) => fetchApi(status ? `/tasks?status=${status}` : '/tasks'),
};

export const applicationsApi = {
  list: (status) => fetchApi(status ? `/applications?status=${status}` : '/applications'),
  get: (id) => fetchApi(`/applications/${id}`),
};

export const notificationsApi = {
  list: (unreadOnly) => fetchApi(unreadOnly ? '/notifications?unread=true' : '/notifications'),
  markRead: (id) => fetchApi(`/notifications/${id}/read`, { method: 'PATCH' }),
};
