import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import { extractPerformanceTasks, fetchMonitoringPerformance } from '../../lib/monitoringPerformance';
import { normalizeTaskFromPerformance, timelineStatusLabel } from '../../lib/performanceTaskUi';
import { getMonitoringStaffId } from '../../lib/staffSession';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { TasksSkeleton } from '../../components/SkeletonLoader';
import FriendlyErrorBanner from '../../components/FriendlyErrorBanner';

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

    if (status === 'completed' || status === 'review') {
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

export default function Tasks() {
  const { token, user } = useAuth();
  const { isDark } = useThemeMode();
  const getToken = () => token;
  const staffId = getMonitoringStaffId(user);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const tasksQuery = useQuery(
    async () => {
      const { payload } = await fetchMonitoringPerformance({ staffId, token, getToken });
      const list = extractPerformanceTasks(payload);
      return list.map((t, index) => normalizeTaskFromPerformance(t, index));
    },
    [token, staffId]
    // No SecureStore cache: same payload size issue as performance API (see dashboard).
  );
  const { data: tasks = [], loading, errorInfo } = tasksQuery;

  const taskList = Array.isArray(tasks) ? tasks : [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return taskList.filter((task) => {
      if (statusFilter === 'completed') {
        if (task.status !== 'completed' && task.status !== 'review') return false;
      } else if (statusFilter && task.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(task.title || '').toLowerCase().includes(q) ||
        String(task.description || '').toLowerCase().includes(q)
      );
    });
  }, [taskList, statusFilter, search]);

  const metrics = useMemo(() => progressBuckets(filtered), [filtered]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await tasksQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && taskList.length === 0 && !errorInfo) return <TasksSkeleton />;

  const pageBg = isDark ? '#0b1220' : colors.background;
  const cardBg = isDark ? '#111827' : colors.card;
  const cardSoft = isDark ? '#1e293b' : colors.cardSoft;
  const borderColor = isDark ? 'rgba(148,163,184,0.2)' : colors.border;
  const textMain = isDark ? '#f8fafc' : colors.text;
  const textMuted = isDark ? '#94a3b8' : colors.textMuted;
  const textSubtle = isDark ? '#64748b' : colors.textSubtle;
  const inputBg = isDark ? '#0f172a' : colors.card;
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={[styles.container, { backgroundColor: pageBg }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.fdaGreen} />}
      >
      {errorInfo ? (
        <FriendlyErrorBanner info={errorInfo} onRetry={handleRefresh} isDark={isDark} />
      ) : null}
      <FadeInView delay={0} translateY={12}>
        <View style={[styles.heroCard, { borderColor, backgroundColor: cardBg }]}>
          <View style={styles.heroCardInner}>
            <View style={styles.heroTitleRow}>
              <Text style={[styles.heroTitle, { color: textMain }]}>My tasks</Text>
              <View style={[styles.countPill, { backgroundColor: isDark ? '#1e293b' : '#ecfdf5', borderColor }]}>
                <Text style={[styles.countPillText, { color: colors.fdaGreen }]}>{metrics.total}</Text>
              </View>
            </View>
            <Text style={[styles.heroSummary, { color: textMuted }]}>
              {metrics.active} active · {metrics.late} late · {metrics.done} done
            </Text>
            <Text style={[styles.heroSub, { color: textMuted }]}>
              Tap a task to open details and timeline
            </Text>

            <View style={[styles.searchWrap, { backgroundColor: inputBg, borderColor }]}>
              <Ionicons name="search-outline" size={18} color={textSubtle} />
              <TextInput
                style={[styles.searchInput, { color: textMain }]}
                placeholder="Search tasks"
                placeholderTextColor={textSubtle}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              {STATUS_FILTERS.map((filter, index) => (
                <FadeInView key={filter.key || 'all'} delay={40 + index * 30} translateY={6}>
                  <PressableScale
                    style={[
                      styles.filterPill,
                      { backgroundColor: isDark ? '#0f172a' : colors.card, borderColor },
                      statusFilter === filter.key && styles.filterPillActive,
                    ]}
                    onPress={() => setStatusFilter(filter.key)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: textMuted },
                        statusFilter === filter.key && styles.filterPillTextActive,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </PressableScale>
                </FadeInView>
              ))}
            </ScrollView>
          </View>
        </View>
      </FadeInView>

      <FadeInView delay={120} translateY={8}>
        <Text style={[styles.sectionLabel, { color: textMuted }]}>
          {filtered.length} task{filtered.length === 1 ? '' : 's'} in this list
        </Text>
      </FadeInView>

      {filtered.length === 0 ? (
        <FadeInView delay={160} translateY={6}>
          <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
            <Ionicons name="checkmark-done-outline" size={36} color={textMuted} />
            <Text style={[styles.emptyTitle, { color: textMain }]}>No tasks match</Text>
            <Text style={[styles.emptyBody, { color: textMuted }]}>
              Try another status filter or clear the search.
            </Text>
          </View>
        </FadeInView>
      ) : (
        filtered.map((task, i) => {
          const due = normalizeDate(task.due_date);
          const activeForDue = task.status !== 'completed' && task.status !== 'review';
          const isLate = activeForDue && due && due < new Date();
          const isDueSoon =
            activeForDue &&
            due &&
            due >= new Date() &&
            due <= new Date(Date.now() + 72 * 60 * 60 * 1000);
          const daysRem =
            task.days_remaining != null && task.days_remaining !== '' ? `${task.days_remaining}d` : '—';
          const sla = task.timeline_status ? timelineStatusLabel(task.timeline_status) : '—';
          const borderSubtle = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)';

          const statusBadgeStyle = isDark
            ? { backgroundColor: 'rgba(33,77,134,0.45)', color: '#93c5fd' }
            : { backgroundColor: '#eef2ff', color: colors.fdaBlue };
          const priorityBase = isDark
            ? { backgroundColor: 'rgba(148,163,184,0.2)', color: textMuted }
            : { backgroundColor: '#f2f4f7', color: colors.textMuted };
          const priorityHigh = isDark
            ? { backgroundColor: 'rgba(194,65,12,0.35)', color: '#fdba74' }
            : { backgroundColor: '#fff0e8', color: '#c2410c' };
          const lateStyle = isDark
            ? { backgroundColor: 'rgba(220,38,38,0.25)', color: '#fca5a5' }
            : { backgroundColor: '#fdecec', color: colors.danger };
          const soonStyle = isDark
            ? { backgroundColor: 'rgba(217,119,6,0.28)', color: '#fcd34d' }
            : { backgroundColor: '#fff6ea', color: colors.warning };

          return (
            <FadeInView key={task.id ?? i} delay={180 + i * 28} translateY={8}>
              <PressableScale
                style={[styles.taskCard, { borderColor, backgroundColor: cardSoft }]}
                onPress={() => {
                  if (!task?.id) return;
                  router.push(`/(app)/task/${task.id}`);
                }}
                hapticType="light"
              >
                <View style={styles.taskCardInner}>
                  <View style={styles.badgesRow}>
                    <Text style={[styles.badgeText, statusBadgeStyle]}>
                      {String(task.status || 'pending').replace('_', ' ')}
                    </Text>
                    {task.priority ? (
                      <Text
                        style={[styles.badgeText, task.priority === 'high' ? priorityHigh : priorityBase]}
                      >
                        {String(task.priority).toUpperCase()}
                      </Text>
                    ) : null}
                    {isLate ? <Text style={[styles.badgeText, lateStyle]}>LATE</Text> : null}
                    {!isLate && isDueSoon ? <Text style={[styles.badgeText, soonStyle]}>DUE SOON</Text> : null}
                  </View>
                  <Text style={[styles.taskTitle, { color: textMain }]} numberOfLines={2}>
                    {task.title || 'Untitled task'}
                  </Text>
                  <Text style={[styles.taskDesc, { color: textMuted }]} numberOfLines={2}>
                    {task.description?.trim() ? task.description : 'No description'}
                  </Text>
                  <View style={[styles.taskMetaGrid, { borderTopColor: borderSubtle }]}>
                    <View style={styles.taskMetaCell}>
                      <Text style={[styles.taskMetaLabel, { color: textSubtle }]}>Due</Text>
                      <Text style={[styles.taskMetaValue, { color: textMain }]}>
                        {due ? due.toLocaleDateString([], { day: '2-digit', month: 'short' }) : '—'}
                      </Text>
                    </View>
                    <View style={[styles.taskMetaCell, styles.taskMetaCellBorder, { borderLeftColor: borderSubtle }]}>
                      <Text style={[styles.taskMetaLabel, { color: textSubtle }]}>SLA</Text>
                      <Text style={[styles.taskMetaValue, { color: textMain }]} numberOfLines={1}>
                        {daysRem} · {sla}
                      </Text>
                    </View>
                    <View style={[styles.taskMetaCell, styles.taskMetaCellBorder, { borderLeftColor: borderSubtle }]}>
                      <Text style={[styles.taskMetaLabel, { color: textSubtle }]}>Application</Text>
                      <Text style={[styles.taskMetaValue, { color: textMain }]}>#{task.application_id || '—'}</Text>
                    </View>
                  </View>
                  <View style={styles.taskTapHint}>
                    <Text style={[styles.taskTapHintText, { color: colors.fdaGreen }]}>Open details</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.fdaGreen} />
                  </View>
                </View>
              </PressableScale>
            </FadeInView>
          );
        })
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 104, gap: spacing.sm },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    ...shadow.card,
  },
  heroCardInner: { padding: spacing.md },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4, flex: 1 },
  countPill: {
    minWidth: 40,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
  },
  countPillText: { fontSize: 15, fontWeight: '900' },
  heroSummary: { fontSize: 13, fontWeight: '700', marginTop: spacing.sm, lineHeight: 18 },
  heroSub: { fontSize: 12, lineHeight: 17, marginTop: 6, fontWeight: '600' },
  searchWrap: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10, marginLeft: 8 },
  filtersRow: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm + 4, paddingBottom: 2, paddingRight: spacing.xs },
  filterPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1 },
  filterPillActive: { backgroundColor: colors.fdaGreen, borderColor: colors.fdaGreen },
  filterPillText: { fontSize: 13, fontWeight: '700' },
  filterPillTextActive: { color: '#fff' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 8,
    ...shadow.soft,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  taskCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadow.soft,
  },
  taskCardInner: { padding: spacing.md },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badgeText: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  taskTitle: { fontSize: 16, fontWeight: '800', marginTop: 10, lineHeight: 22, letterSpacing: -0.2 },
  taskDesc: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  taskMetaGrid: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  taskMetaCell: { flex: 1, minWidth: 0, paddingRight: 6 },
  taskMetaCellBorder: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 10, paddingRight: 0 },
  taskMetaLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  taskMetaValue: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  taskTapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: spacing.sm + 2,
  },
  taskTapHintText: { fontSize: 12.5, fontWeight: '800' },
});
