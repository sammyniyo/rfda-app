import { api } from '../constants/api';

/** Cleared on logout so the next account does not inherit dismissed rows. */
export const NOTIFICATION_DISMISSED_STORAGE_KEY = 'rwanda_fda_dismissed_notification_ids';

const DISMISSED_KEY = NOTIFICATION_DISMISSED_STORAGE_KEY;

export async function loadDismissedIds() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

export async function persistDismissedIds(idsSet) {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...idsSet]));
  } catch {
    /* ignore */
  }
}

/** Map API row to the shape used by notifications.jsx (read_at, created_at, message, …). */
export function normalizeNotificationRow(n) {
  const id = String(n.id ?? n.notification_id ?? '');
  const title = n.title ?? n.subject ?? 'Notification';
  const message = n.message ?? n.body ?? n.content ?? '';
  const created_at = n.created_at ?? n.createdAt ?? n.date ?? n.timestamp ?? null;
  const explicitlyRead =
    n.read === true ||
    n.read === 1 ||
    n.is_read === true ||
    n.is_read === 1 ||
    String(n.status ?? '').toLowerCase() === 'read' ||
    (n.read_at != null && String(n.read_at).length > 0);
  const read_at = explicitlyRead ? (n.read_at ?? n.readAt ?? new Date().toISOString()) : null;
  const type = String(n.type ?? n.category ?? 'general').toLowerCase();
  return {
    ...n,
    id,
    title,
    message,
    type,
    created_at,
    read_at,
    link: n.link ?? n.url ?? n.deep_link,
  };
}

export async function fetchNotificationsPage({ page = 1, limit = 25, filter = 'all', headers } = {}) {
  const res = await fetch(api.notificationsQuery({ page, limit, filter }), headers ? { headers } : {});
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { items: [], has_more: false, error: 'Invalid response', ok: res.ok, status: res.status };
  }
  const payload = json?.data ?? json;
  const rawList = Array.isArray(payload?.notifications)
    ? payload.notifications
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];
  const hasMore =
    payload?.has_more === true ||
    (payload?.has_more !== false && rawList.length >= limit);

  const items = rawList.map((row) => normalizeNotificationRow(row));

  const errMsg =
    json?.success === false && typeof json?.message === 'string' ? json.message : null;
  return {
    items,
    has_more: hasMore,
    error: errMsg,
    ok: res.ok,
    status: res.status,
  };
}

export async function deleteNotificationOnServer(id, headers) {
  if (!id) return false;
  try {
    const url = `${api.notifications}?id=${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'DELETE', headers });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.ok;
    }
    return json?.success !== false && res.ok;
  } catch {
    return false;
  }
}

export function mergeNotificationsById(prev, incoming) {
  const map = new Map();
  const ts = (x) => {
    const t = new Date(x?.created_at || 0).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  for (const i of prev) {
    if (i?.id != null) map.set(String(i.id), i);
  }
  for (const i of incoming) {
    if (i?.id == null) continue;
    const id = String(i.id);
    const old = map.get(id);
    if (!old) {
      map.set(id, i);
      continue;
    }
    map.set(id, ts(i) >= ts(old) ? { ...old, ...i } : { ...i, ...old });
  }
  return [...map.values()].sort((a, b) => ts(b) - ts(a));
}
