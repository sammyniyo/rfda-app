/**
 * UI helpers for `performance_api.php` task rows (see docs/performance-api-response.md).
 * The API exposes: status, timeline_status, days_*, category, type_label, assigned_by, completed_at, etc.
 * Optional keys (followers, reviews) are surfaced when present on the raw object.
 */

/** @param {Record<string, unknown>} raw */
export function pickCollaborationExtras(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const k of Object.keys(raw)) {
    const lk = k.toLowerCase();
    if (
      lk.includes('follow') ||
      lk.includes('review') ||
      lk.includes('comment') ||
      lk.includes('watcher') ||
      lk.includes('subscriber')
    ) {
      const v = raw[k];
      if (v == null || v === '') continue;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      out[k] = v;
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>} t
 * @param {number} index
 */
export function normalizeTaskFromPerformance(t, index) {
  const rawStatus = String(t.status ?? t.task_status ?? '').toLowerCase();
  const completedByFlag = Boolean(t.is_completed);

  let status;
  if (rawStatus === 'review') status = 'review';
  else if (rawStatus === 'completed') status = 'completed';
  else if (completedByFlag) status = 'completed';
  else if (rawStatus === 'pending') status = 'pending';
  else if (rawStatus === 'in_progress') status = 'in_progress';
  else if (rawStatus) status = 'in_progress';
  else if (t.is_active) status = 'in_progress';
  else status = 'pending';

  const rawPriority = String(t.priority ?? t.task_priority ?? '').toLowerCase();
  const priority = rawPriority === 'urgent' ? 'high' : rawPriority || null;

  const extras = pickCollaborationExtras(t);
  const assignedBy = t.assigned_by ?? t.assigned_by_name ?? null;
  const workingOn = inferWorkingOnName(t, assignedBy);

  return {
    id: t.task_id ?? t.id ?? index + 1,
    title: t.title ?? t.task_title ?? t.name ?? 'Task',
    description: t.description ?? t.task_description ?? t.details ?? '',
    status,
    raw_status: rawStatus || String(t.status ?? ''),
    priority,
    due_date: t.due_date ?? t.deadline ?? t.dueAt ?? null,
    application_id: t.application_id ?? t.tracking_no ?? t.app_id ?? null,
    created_at: t.created_at ?? t.createdAt ?? null,
    assigned_at: t.assigned_at ?? t.assignedAt ?? null,
    updated_at: t.updated_at ?? t.updatedAt ?? null,
    completed_at: t.completed_at ?? t.completedAt ?? null,
    timeline_status: t.timeline_status ?? null,
    days_allowed: t.days_allowed ?? null,
    days_taken: t.days_taken ?? null,
    days_remaining: t.days_remaining ?? null,
    category: t.category ?? t.task_category ?? null,
    type_label: t.type_label ?? null,
    application_type: t.application_type ?? null,
    assigned_by: assignedBy,
    working_on: workingOn,
    is_completed: Boolean(t.is_completed),
    is_active: Boolean(t.is_active),
    extras,
  };
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function parseAssignedToFromHistory(history) {
  if (!Array.isArray(history)) return null;
  for (const row of history) {
    const c = String(row?.comments || '');
    const m = c.match(/assigned to\s+([^,\n\r]+)/i);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function firstUpdateAuthor(updates, creatorName) {
  if (!Array.isArray(updates)) return null;
  const creatorNorm = normalizeName(creatorName);
  for (const u of updates) {
    const n = String(u?.staff_name || '').trim();
    if (!n) continue;
    if (normalizeName(n) === creatorNorm) continue;
    return n;
  }
  return null;
}

function inferWorkingOnName(raw, creatorName) {
  const explicit =
    raw.assigned_to_name ??
    raw.assignee_name ??
    raw.assigned_to ??
    raw.assignee ??
    raw.worker_name ??
    raw.owner_name ??
    null;
  if (explicit) return String(explicit).trim();

  const fromHistory = parseAssignedToFromHistory(raw.review_history);
  if (fromHistory) return fromHistory;

  const fromUpdates = firstUpdateAuthor(raw.updates, creatorName);
  if (fromUpdates) return fromUpdates;

  const creatorNorm = normalizeName(creatorName);
  if (Array.isArray(raw.followers)) {
    for (const f of raw.followers) {
      const n = String(f?.follower_name || '').trim();
      if (!n) continue;
      if (normalizeName(n) === creatorNorm) continue;
      return n;
    }
  }
  return null;
}

export function timelineStatusLabel(ts) {
  const s = String(ts || '').toLowerCase();
  const map = {
    ontime: 'On track',
    tobedelayed: 'Due soon',
    delayed: 'Overdue',
    completed_late: 'Finished after deadline',
  };
  return map[s] || (ts ? String(ts).replace(/_/g, ' ') : '—');
}

/** 0–100 from API days + status (matches server-derived workload). */
export function taskProgressPercent(task) {
  if (!task) return 0;
  const st = String(task.status || '');
  if (st === 'completed' || st === 'review') return 100;

  const allowed = Number(task.days_allowed);
  const taken = Number(task.days_taken);
  if (Number.isFinite(allowed) && allowed > 0 && Number.isFinite(taken)) {
    const pct = Math.round((taken / allowed) * 100);
    return Math.min(95, Math.max(8, pct));
  }

  if (st === 'in_progress') return 55;
  if (st === 'pending') return 18;
  return 25;
}

/**
 * @param {ReturnType<typeof normalizeTaskFromPerformance>} task
 * @param {boolean} isDark
 * @param {{ fdaBlue: string, fdaGreen: string, warning: string, success: string, danger: string }} colors
 */
export function buildTaskTimelineFromApi(task, isDark, colors) {
  const tone = (light, dark) => (isDark ? dark : light);

  const typeBits = [task.type_label, task.application_type, task.category].filter(Boolean);
  const typeLine = typeBits.length ? typeBits.map(String).join(' · ') : null;

  const createdAt = task.created_at;
  const dueAt = task.due_date;
  const completedAt = task.completed_at;
  const rawStatusDisplay = String(task.raw_status || task.status || '').replace(/_/g, ' ') || '—';
  const tl = timelineStatusLabel(task.timeline_status);

  const daysLine =
    task.days_allowed != null && task.days_taken != null
      ? `Day ${task.days_taken} of ${task.days_allowed} on this step`
      : null;
  const remainLine =
    task.days_remaining != null && task.days_remaining !== ''
      ? Number(task.days_remaining) >= 0
        ? `${task.days_remaining} days left until due`
        : `${Math.abs(Number(task.days_remaining))} days past due`
      : null;

  const assignedLine = task.assigned_by
    ? `Assigned by ${task.assigned_by}`
    : 'Assigned to you.';

  const isDone = task.status === 'completed';
  const inReview = task.status === 'review';
  const isActiveWork = !isDone && !inReview;

  const steps = [];

  steps.push({
    key: 'created',
    title: 'Recorded',
    subtitle: [typeLine, 'Added to your task list.'].filter(Boolean).join(' · '),
    time: createdAt,
    done: Boolean(createdAt),
    active: false,
    dot: colors.fdaBlue,
    tone: tone('#e8f0ff', 'rgba(33,77,134,0.38)'),
    stateLabel: createdAt ? 'Recorded' : 'Waiting',
  });

  steps.push({
    key: 'assign',
    title: 'Assignment',
    subtitle: assignedLine,
    time: createdAt,
    done: Boolean(createdAt),
    active: false,
    dot: colors.fdaGreen,
    tone: tone('#e7faf0', 'rgba(15,94,71,0.28)'),
    stateLabel: 'Set',
  });

  const rs = String(rawStatusDisplay).trim();
  const statusFriendly =
    rs === '—' || !rs
      ? '—'
      : rs === 'in progress'
        ? 'In progress'
        : rs === 'pending'
          ? 'Not started'
          : rs === 'completed'
            ? 'Completed'
            : rs === 'review'
              ? 'In review'
              : rs.charAt(0).toUpperCase() + rs.slice(1);

  steps.push({
    key: 'progress',
    title: 'Progress',
    subtitle: [
      daysLine,
      tl !== '—' ? `Schedule: ${tl}` : null,
      statusFriendly !== '—' ? `Status: ${statusFriendly}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    time: task.updated_at || createdAt,
    done: isDone,
    active: isActiveWork || inReview,
    dot: colors.fdaBlue,
    tone: tone('#eef2ff', 'rgba(99,102,241,0.28)'),
    stateLabel: inReview ? 'In review' : isActiveWork ? 'In progress' : isDone ? 'Done' : '—',
  });

  steps.push({
    key: 'due',
    title: 'Due date',
    subtitle: [dueAt ? `Due ${new Date(dueAt).toLocaleString()}` : 'No due date set', remainLine].filter(Boolean).join(' · '),
    time: dueAt,
    done: Boolean(dueAt),
    active: false,
    dot: colors.warning,
    tone: tone('#fff6ea', 'rgba(217,119,6,0.28)'),
    stateLabel: dueAt ? 'Scheduled' : '—',
  });

  steps.push({
    key: 'complete',
    title: isDone ? 'Completed' : inReview ? 'Review' : 'Finishing up',
    subtitle: inReview
      ? 'Waiting for final sign-off before it’s fully closed.'
      : completedAt
        ? `Finished ${new Date(completedAt).toLocaleString()}`
        : isDone
          ? 'Marked as done.'
          : 'Not finished yet.',
    time: completedAt || (isDone ? task.updated_at : null),
    done: isDone,
    active: false,
    dot: colors.success,
    tone: tone('#e7faf0', 'rgba(5,150,105,0.28)'),
    stateLabel: isDone ? 'Closed' : inReview ? 'Awaiting closure' : 'Open',
  });

  const extraEntries = Object.entries(task.extras || {});
  if (extraEntries.length) {
    const summary = extraEntries
      .slice(0, 6)
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: ${v.length} item(s)`;
        if (typeof v === 'object') return `${k}: see details`;
        return `${k}: ${String(v)}`;
      })
      .join('\n');
    steps.push({
      key: 'collab',
      title: 'Extra details',
      subtitle: summary || '—',
      time: null,
      done: true,
      active: false,
      dot: colors.fdaBlue,
      tone: tone('#f0f9ff', 'rgba(56,189,248,0.2)'),
      stateLabel: 'More info',
    });
  }

  return steps;
}
