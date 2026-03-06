import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { useQuery } from '../../../hooks/useQuery';
import { getAuthHeaders } from '../../../lib/api';
import { api } from '../../../constants/api';
import { colors, spacing, radius, shadow } from '../../../constants/theme';
import FadeInView from '../../../components/FadeInView';
import PressableScale from '../../../components/PressableScale';

// Temporary sample tasks as a fallback while the real task API is not yet available.
const FALLBACK_TASKS = [
  {
    id: 1,
    title: 'Review pharmacovigilance report',
    description: 'Screen latest safety reports and flag any serious events that require follow-up.',
    status: 'in_progress',
    priority: 'high',
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    application_id: 'PV-2026-014',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    assigned_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    title: 'Check import permit documents',
    description: 'Verify completeness of import permit application for Griverson Trust.',
    status: 'pending',
    priority: 'medium',
    due_date: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    application_id: 'IP-2026-089',
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    title: 'Sign-off finished product release',
    description: 'Confirm COA and QC results before batch release to market.',
    status: 'completed',
    priority: 'low',
    due_date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    application_id: 'PR-2026-033',
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(v) {
  const d = parseDate(v);
  if (!d) return '—';
  return d.toLocaleString();
}

function statusLabel(status) {
  return String(status || 'pending').replace('_', ' ');
}

function buildTimeline(task) {
  const createdAt = task?.created_at || task?.assigned_at;
  const assignedAt = task?.assigned_at;
  const updatedAt = task?.updated_at;
  const dueAt = task?.due_date;
  const status = String(task?.status || 'pending');

  const steps = [
    {
      key: 'created',
      title: 'Task created',
      subtitle: 'Task record was created in the system.',
      time: createdAt,
      done: !!createdAt,
      tone: '#e8f0ff',
      dot: colors.fdaBlue,
    },
    {
      key: 'assigned',
      title: 'Task assigned to you',
      subtitle: 'Assigned to the current staff account.',
      time: assignedAt || createdAt,
      done: !!(assignedAt || createdAt),
      tone: '#e7faf0',
      dot: colors.fdaGreen,
    },
    {
      key: 'working',
      title: 'Execution in progress',
      subtitle: status === 'in_progress' ? 'Task is actively being worked on.' : 'Waiting to start or already completed.',
      time: status === 'in_progress' ? (updatedAt || assignedAt || createdAt) : null,
      done: status === 'in_progress' || status === 'completed',
      active: status === 'in_progress',
      tone: '#eef2ff',
      dot: colors.fdaBlue,
    },
    {
      key: 'due',
      title: 'Due date checkpoint',
      subtitle: dueAt ? `Due ${new Date(dueAt).toLocaleDateString()}` : 'No due date set.',
      time: dueAt,
      done: !!dueAt,
      tone: '#fff6ea',
      dot: colors.warning,
    },
    {
      key: 'completed',
      title: 'Task completed',
      subtitle: status === 'completed' ? 'Task marked as completed.' : 'Completion not recorded yet.',
      time: status === 'completed' ? (updatedAt || dueAt || assignedAt || createdAt) : null,
      done: status === 'completed',
      tone: '#e7faf0',
      dot: colors.success,
    },
  ];

  return steps;
}

function taskProgress(task) {
  const status = String(task?.status || 'pending');
  if (status === 'completed') return 100;
  if (status === 'in_progress') return 60;
  return 20;
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuth();

  const taskId = String(id || '').trim();
  const taskQuery = useQuery(
    async () => {
      if (!taskId) throw new Error('Missing task id');
      try {
        const res = await fetch(`${api.tasks}/${taskId}`, { headers: getAuthHeaders(() => token) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load task');
        return data;
      } catch {
        // While backend is not ready, fall back to a local sample task so UI can still show progress.
        const numericId = Number(taskId);
        return FALLBACK_TASKS.find((t) => t.id === numericId) || FALLBACK_TASKS[0];
      }
    },
    [token, taskId],
    { cacheKey: taskId ? `task_detail_${taskId}_${token}` : undefined }
  );

  const { data: task, loading, error, fromCache, lastSyncedAt } = taskQuery;

  const timeline = useMemo(() => (task ? buildTimeline(task) : []), [task]);
  const progress = task ? taskProgress(task) : 0;
  const dueDate = parseDate(task?.due_date);
  const isLate = task && task.status !== 'completed' && dueDate && dueDate < new Date();
  const status = statusLabel(task?.status);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.fdaGreen} />
          <Text style={styles.loadingText}>Loading task timeline…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !task) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Task unavailable</Text>
          <Text style={styles.errorText}>{error || "We couldn't load this task. It may have been removed or you don't have access."}</Text>
          <PressableScale style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <FadeInView delay={0} translateY={12}>
        <LinearGradient colors={['#ffffff', '#f6fbff', '#f3f9f6']} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <PressableScale style={styles.iconBack} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </PressableScale>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>Task Timeline</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>{task.title || 'Untitled task'}</Text>
              <Text style={styles.heroSub} numberOfLines={3}>{task.description || 'No task description available.'}</Text>
            </View>
          </View>

          <View style={styles.metaChipsRow}>
            <Text style={[styles.metaChip, styles.statusChip]}>{status}</Text>
            {task.priority ? (
              <Text style={[styles.metaChip, task.priority === 'high' ? styles.priorityHighChip : styles.priorityChip]}>
                {String(task.priority).toUpperCase()}
              </Text>
            ) : null}
            {isLate ? <Text style={[styles.metaChip, styles.lateChip]}>LATE</Text> : null}
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Timeline progress</Text>
              <Text style={styles.progressValue}>{progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={[colors.fdaGreen, colors.teal]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${Math.max(progress, 8)}%` }]}
              />
            </View>
          </View>

          <View style={styles.quickStats}>
            <View style={styles.quickStat}>
              <Ionicons name="person-outline" size={14} color={colors.fdaGreen} />
              <View style={styles.quickStatTextBlock}>
                <Text style={styles.quickStatLabel}>Assigned</Text>
                <Text style={styles.quickStatValue}>{formatDateTime(task.assigned_at)}</Text>
              </View>
            </View>
            <View style={styles.quickStat}>
              <Ionicons name="time-outline" size={14} color={colors.warning} />
              <View style={styles.quickStatTextBlock}>
                <Text style={styles.quickStatLabel}>Due</Text>
                <Text style={styles.quickStatValue}>{formatDateTime(task.due_date)}</Text>
              </View>
            </View>
            <View style={styles.quickStat}>
              <Ionicons name="document-text-outline" size={14} color={colors.fdaBlue} />
              <View style={styles.quickStatTextBlock}>
                <Text style={styles.quickStatLabel}>Application</Text>
                <Text style={styles.quickStatValue}>#{task.application_id || '—'}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </FadeInView>

      {(fromCache || lastSyncedAt) && (
        <FadeInView delay={60} translateY={8}>
          <View style={styles.syncPill}>
            <Text style={styles.syncPillText}>
              {fromCache ? 'Cached detail' : 'Live detail'}
              {lastSyncedAt ? ` • ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </Text>
          </View>
        </FadeInView>
      )}

      <FadeInView delay={120} translateY={10}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {timeline.map((step, index) => (
            <View key={step.key} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: step.done ? step.dot : colors.borderStrong },
                    step.active && styles.timelineDotActive,
                  ]}
                />
                {index < timeline.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={[styles.timelineCard, { backgroundColor: step.tone }]}> 
                <View style={styles.timelineTop}>
                  <Text style={styles.timelineTitle}>{step.title}</Text>
                  <Text style={styles.timelineTime}>{step.time ? formatDateTime(step.time) : 'Pending'}</Text>
                </View>
                <Text style={styles.timelineSubtitle}>{step.subtitle}</Text>
                <Text style={[styles.timelineState, step.done ? styles.timelineStateDone : styles.timelineStatePending]}>
                  {step.active ? 'In Progress' : step.done ? 'Recorded' : 'Waiting'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </FadeInView>

      <FadeInView delay={180} translateY={10}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Task Details</Text>
          {[
            ['Task ID', task.id],
            ['Status', status],
            ['Priority', task.priority || '—'],
            ['Application ID', task.application_id ? `#${task.application_id}` : '—'],
            ['Created At', formatDateTime(task.created_at)],
            ['Updated At', formatDateTime(task.updated_at)],
          ].map(([label, value]) => (
            <View key={label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{String(value)}</Text>
            </View>
          ))}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.lg },
  loadingText: { color: colors.textMuted, marginTop: 10, fontSize: 13 },
  errorTitle: { color: colors.text, fontWeight: '800', fontSize: 18, marginBottom: 6 },
  errorText: { color: colors.textMuted, textAlign: 'center', lineHeight: 18, marginBottom: 12 },
  backButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  backButtonText: { color: colors.fdaGreen, fontWeight: '800' },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  heroTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  iconBack: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: { color: colors.fdaGreen, fontSize: 11.5, fontWeight: '800', marginBottom: 4 },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  heroSub: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  metaChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  metaChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden', fontSize: 11, fontWeight: '800' },
  statusChip: { backgroundColor: '#eef2ff', color: colors.fdaBlue, textTransform: 'capitalize' },
  priorityChip: { backgroundColor: '#f2f4f7', color: colors.textMuted },
  priorityHighChip: { backgroundColor: '#fff0e8', color: '#c2410c' },
  lateChip: { backgroundColor: '#fdecec', color: colors.danger },
  progressWrap: { marginTop: spacing.md },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  progressValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 10, borderRadius: radius.pill, backgroundColor: colors.backgroundAlt, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  quickStats: { marginTop: spacing.md, gap: 8 },
  quickStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  quickStatTextBlock: { flex: 1 },
  quickStatLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '700' },
  quickStatValue: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  syncPill: { alignSelf: 'flex-start', backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  syncPillText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  sectionCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.soft },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  timelineRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  timelineRail: { width: 16, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  timelineDotActive: { borderWidth: 2, borderColor: '#bfdbfe' },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  timelineCard: { flex: 1, borderRadius: radius.md, padding: spacing.sm + 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)', marginBottom: spacing.sm },
  timelineTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  timelineTitle: { flex: 1, color: colors.text, fontWeight: '800', fontSize: 13 },
  timelineTime: { color: colors.textSubtle, fontSize: 10, textAlign: 'right', maxWidth: 110 },
  timelineSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  timelineState: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden', fontSize: 10, fontWeight: '800' },
  timelineStateDone: { backgroundColor: '#e7faf0', color: colors.success },
  timelineStatePending: { backgroundColor: '#f2f4f7', color: colors.textMuted },
  detailRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm },
  detailLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
