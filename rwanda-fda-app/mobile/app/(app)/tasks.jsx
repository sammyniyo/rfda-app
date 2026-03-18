import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import { getAuthHeaders } from '../../lib/api';
import { api } from '../../constants/api';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { TasksSkeleton } from '../../components/SkeletonLoader';

// Tasks screen uses live Monitoring Tool APIs (no sample fallbacks).

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Not started' },
  { key: 'in_progress', label: 'Active' },
  { key: 'completed', label: 'Done' },
];

function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function progressBuckets(tasks) {
  const now = new Date();
  const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  const result = { done: 0, active: 0, dueSoon: 0, late: 0, notStarted: 0, total: tasks.length };

  for (const task of tasks) {
    const status = String(task.status || 'pending');
    const due = normalizeDate(task.due_date);

    if (status === 'completed') {
      result.done += 1;
      continue;
    }
    if (status === 'in_progress') result.active += 1;
    if (status === 'pending') result.notStarted += 1;

    if (due) {
      if (due < now) result.late += 1;
      else if (due <= in72h) result.dueSoon += 1;
    }
  }

  return result;
}

function executionScore({ total, done, late, dueSoon, active }) {
  if (!total) return 0;
  const doneScore = (done / total) * 70;
  const activeScore = Math.min(active / total, 0.4) * 15;
  const urgencyPenalty = (late / total) * 25 + (dueSoon / total) * 10;
  return Math.max(0, Math.min(100, Math.round(doneScore + activeScore + 15 - urgencyPenalty)));
}

function ratioPart(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function TrackRow({ label, value, total, color, bg }) {
  const pct = ratioPart(value, total);
  return (
    <View style={styles.trackRow}>
      <View style={styles.trackRowTop}>
        <Text style={styles.trackLabel}>{label}</Text>
        <Text style={styles.trackValue}>{value} <Text style={styles.trackTotal}>({pct}%)</Text></Text>
      </View>
      <View style={[styles.trackBase, { backgroundColor: bg }]}>
        <View style={[styles.trackFill, { width: `${Math.max(pct, value > 0 ? 8 : 0)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function Tasks() {
  const { token, user, perfType } = useAuth();
  const getToken = () => token;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const tasksQuery = useQuery(
    async () => {
      try {
        const staffId = user?.staff_id ?? user?.id;
        if (!staffId) throw new Error('Missing staff id');
        const res = await fetch(api.performance(staffId, perfType, 'all'), { headers: getAuthHeaders(getToken) });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || payload?.success === false) throw new Error(payload?.message || 'Failed to load tasks');
        const rawTasks = payload?.data?.tasks;
        const list = Array.isArray(rawTasks) ? rawTasks : [];
        return list.map((t, index) => {
          const rawStatus = String(t.status ?? t.task_status ?? '').toLowerCase();
          const normalizedStatus = t.is_completed
            ? 'completed'
            : rawStatus === 'pending'
              ? 'pending'
              : rawStatus === 'in_progress'
                ? 'in_progress'
                : rawStatus
                  ? 'in_progress' // e.g. "review"
                  : t.is_active
                    ? 'in_progress'
                    : 'pending';

          const rawPriority = String(t.priority ?? t.task_priority ?? '').toLowerCase();
          const normalizedPriority = rawPriority === 'urgent' ? 'high' : rawPriority || null;

          return {
            id: t.task_id ?? t.id ?? index + 1,
            title: t.title ?? t.task_title ?? t.name ?? 'Task',
            description: t.description ?? t.task_description ?? t.details ?? '',
            status: normalizedStatus,
            priority: normalizedPriority,
            due_date: t.due_date ?? t.deadline ?? t.dueAt ?? null,
            application_id: t.application_id ?? t.tracking_no ?? t.app_id ?? null,
            created_at: t.created_at ?? t.createdAt ?? null,
            assigned_at: t.assigned_at ?? t.assignedAt ?? null,
            updated_at: t.updated_at ?? t.updatedAt ?? null,
            timeline_status: t.timeline_status ?? null,
            days_allowed: t.days_allowed ?? null,
            days_taken: t.days_taken ?? null,
            days_remaining: t.days_remaining ?? null,
          };
        });
      } catch {
        return [];
      }
    },
    [token, user?.id, user?.staff_id],
    { cacheKey: `tasks_${token}_${user?.staff_id ?? user?.id ?? 'no_staff'}` }
  );
  const { data: tasks = [], loading, error } = tasksQuery;

  const taskList = Array.isArray(tasks) ? tasks : [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return taskList.filter((task) => {
      if (statusFilter && task.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(task.title || '').toLowerCase().includes(q) ||
        String(task.description || '').toLowerCase().includes(q)
      );
    });
  }, [taskList, statusFilter, search]);

  const metrics = useMemo(() => progressBuckets(filtered), [filtered]);
  const score = useMemo(() => executionScore(metrics), [metrics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await tasksQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <TasksSkeleton />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.fdaGreen} />}
      >
      <FadeInView delay={0} translateY={12}>
        <LinearGradient colors={['#ffffff', '#f8fbff', '#effaf4']} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroTitle}>My tasks</Text>
              <Text style={styles.heroSub}>See what needs your attention today.</Text>
            </View>
            <View style={styles.scoreBubble}>
              <Text style={styles.scoreValue}>{score}</Text>
              <Text style={styles.scoreLabel}>Score</Text>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.textSubtle} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tasks"
              placeholderTextColor={colors.textSubtle}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <View style={styles.inlineStats}>
            <View style={styles.inlineStat}><Text style={styles.inlineStatValue}>{metrics.total}</Text><Text style={styles.inlineStatLabel}>Visible</Text></View>
            <View style={styles.inlineStat}><Text style={styles.inlineStatValue}>{metrics.active}</Text><Text style={styles.inlineStatLabel}>Active</Text></View>
            <View style={styles.inlineStat}><Text style={styles.inlineStatValue}>{metrics.late}</Text><Text style={styles.inlineStatLabel}>Late</Text></View>
            <View style={styles.inlineStat}><Text style={styles.inlineStatValue}>{metrics.done}</Text><Text style={styles.inlineStatLabel}>Done</Text></View>
          </View>
        </LinearGradient>
      </FadeInView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
        {STATUS_FILTERS.map((filter, index) => (
          <FadeInView key={filter.key || 'all'} delay={70 + index * 40} translateY={8}>
            <PressableScale
              style={[styles.filterPill, statusFilter === filter.key && styles.filterPillActive]}
              onPress={() => setStatusFilter(filter.key)}
            >
              <Text style={[styles.filterPillText, statusFilter === filter.key && styles.filterPillTextActive]}>
                {filter.label}
              </Text>
            </PressableScale>
          </FadeInView>
        ))}
      </ScrollView>

      <FadeInView delay={220} translateY={10}>
        <View style={styles.measureCard}>
          <View style={styles.measureHeader}>
            <Text style={styles.measureTitle}>Execution Measure</Text>
            <Text style={styles.measureSub}>{metrics.total ? 'Calculated from completion + urgency' : 'No tasks selected'}</Text>
          </View>
          <TrackRow label="Completed" value={metrics.done} total={metrics.total} color={colors.success} bg="#eafaf4" />
          <TrackRow label="In progress" value={metrics.active} total={metrics.total} color={colors.fdaBlue} bg="#eaf1ff" />
          <TrackRow label="Due soon (72h)" value={metrics.dueSoon} total={metrics.total} color={colors.warning} bg="#fff6ea" />
          <TrackRow label="Late" value={metrics.late} total={metrics.total} color={colors.danger} bg="#fdeeee" />
        </View>
      </FadeInView>

      <FadeInView delay={300} translateY={10}>
        <View style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Task list</Text>
            <Text style={styles.listCount}>{filtered.length}</Text>
          </View>

          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>No tasks match the current filters.</Text>
          ) : (
            filtered.map((task, i) => {
              const due = normalizeDate(task.due_date);
              const isLate = task.status !== 'completed' && due && due < new Date();
              const isDueSoon = task.status !== 'completed' && due && due >= new Date() && due <= new Date(Date.now() + 72 * 60 * 60 * 1000);

              return (
                <FadeInView key={task.id ?? i} delay={340 + i * 35} translateY={8}>
                  <PressableScale
                    style={styles.taskCard}
                    onPress={() => {
                      if (!task?.id) return;
                      router.push(`/(app)/task/${task.id}`);
                    }}
                  >
                    <View style={styles.taskTop}>
                      <View style={styles.badgesRow}>
                        <Text style={styles.statusBadge}>{String(task.status || 'pending').replace('_', ' ')}</Text>
                        {task.priority ? (
                          <Text style={[styles.priorityBadge, task.priority === 'high' && styles.priorityBadgeHigh]}>
                            {String(task.priority).toUpperCase()}
                          </Text>
                        ) : null}
                        {isLate ? <Text style={styles.lateBadge}>LATE</Text> : null}
                        {!isLate && isDueSoon ? <Text style={styles.soonBadge}>DUE SOON</Text> : null}
                      </View>
                      {due ? (
                        <Text style={styles.dueText}>
                          Due {due.toLocaleDateString([], { day: '2-digit', month: 'short' })}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.taskTitle} numberOfLines={2}>{task.title || 'Untitled task'}</Text>
                    <Text style={styles.taskDesc} numberOfLines={2}>{task.description || 'No description provided.'}</Text>
                    <View style={styles.taskFoot}>
                      <View style={styles.taskFootLeft}>
                        <View style={styles.dot} />
                        <Text style={styles.taskFootText}>Application #{task.application_id || '—'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
                    </View>
                  </PressableScale>
                </FadeInView>
              );
            })
          )}
        </View>
      </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 104, gap: spacing.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  stateText: { color: colors.textMuted },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  heroSub: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4, maxWidth: 230 },
  scoreBubble: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#e7faf0',
    borderWidth: 1,
    borderColor: 'rgba(15,94,71,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: { color: colors.fdaGreen, fontSize: 20, fontWeight: '900' },
  scoreLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  searchWrap: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    minHeight: 46,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 10, marginLeft: 8 },
  inlineStats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  inlineStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  inlineStatValue: { color: colors.text, fontWeight: '800', fontSize: 16 },
  inlineStatLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  filtersRow: { gap: spacing.sm, paddingHorizontal: spacing.xs },
  filterPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterPillActive: { backgroundColor: colors.fdaGreen, borderColor: colors.fdaGreen },
  filterPillText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  filterPillTextActive: { color: '#fff' },
  measureCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.soft,
  },
  measureHeader: { marginBottom: spacing.sm },
  measureTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  measureSub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  trackRow: { marginTop: spacing.sm },
  trackRowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: 6 },
  trackLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  trackValue: { color: colors.text, fontWeight: '800', fontSize: 12 },
  trackTotal: { color: colors.textSubtle, fontWeight: '600' },
  trackBase: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: radius.pill },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.soft,
  },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  listTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  listCount: { color: colors.fdaGreen, fontWeight: '800', fontSize: 14 },
  emptyText: { color: colors.textMuted, paddingVertical: spacing.sm },
  taskCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  statusBadge: {
    backgroundColor: '#eef2ff',
    color: colors.fdaBlue,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  priorityBadge: {
    backgroundColor: '#f2f4f7',
    color: colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  priorityBadgeHigh: { backgroundColor: '#fff0e8', color: '#c2410c' },
  lateBadge: {
    backgroundColor: '#fdecec',
    color: colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  soonBadge: {
    backgroundColor: '#fff6ea',
    color: colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  dueText: { color: colors.textSubtle, fontSize: 11, fontWeight: '600' },
  taskTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 8 },
  taskDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  taskFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  taskFootLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.fdaGreen },
  taskFootText: { color: colors.textSubtle, fontSize: 11 },
});
