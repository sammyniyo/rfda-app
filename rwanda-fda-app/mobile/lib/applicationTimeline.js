/**
 * Normalize API timeline strings and derive from SLA when the backend omits or aliases `timeline_status`.
 * Shared by dashboard KPIs and Applications list so counts match filtered rows.
 *
 * @param {Record<string, unknown>} a - Raw application row (+ is_completed / is_active when known)
 * @returns {'delayed'|'tobedelayed'|'ontime'|string}
 */
export function canonicalApplicationTimeline(a) {
  const raw = a.timeline_status ?? a.timelineStatus ?? a.TimelineStatus;
  const k = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  if (k === 'delayed' || k === 'overdue' || k === 'late') return 'delayed';
  if (k === 'tobedelayed' || k === 'atrisk') return 'tobedelayed';
  if (k === 'ontime') return 'ontime';

  const completed = Boolean(a.is_completed);
  const allowed = Number(a.days_allowed);
  const taken = Number(a.days_taken);
  const remRaw = a.days_remaining;
  const rem = remRaw === null || remRaw === '' || remRaw === undefined ? NaN : Number(remRaw);

  if (Number.isFinite(allowed) && Number.isFinite(taken) && taken > allowed) return 'delayed';
  if (!completed && Number.isFinite(rem) && rem < 0) return 'delayed';
  if (!completed && Number.isFinite(allowed) && Number.isFinite(taken)) {
    const inferredRem = allowed - taken;
    if (inferredRem <= 5 && inferredRem >= 0 && taken <= allowed) return 'tobedelayed';
  }

  if (k) return k;
  return 'ontime';
}
