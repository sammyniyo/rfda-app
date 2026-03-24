import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { useThemeMode } from '../../../context/ThemeContext';
import { useQuery } from '../../../hooks/useQuery';
import { extractPerformanceTasks, fetchMonitoringPerformance } from '../../../lib/monitoringPerformance';
import {
  normalizeTaskFromPerformance,
  buildTaskTimelineFromApi,
  taskProgressPercent,
  timelineStatusLabel,
} from '../../../lib/performanceTaskUi';
import { getMonitoringStaffId } from '../../../lib/staffSession';
import { colors, spacing, radius, shadow } from '../../../constants/theme';
import FadeInView from '../../../components/FadeInView';
import PressableScale from '../../../components/PressableScale';

// Task detail uses live Monitoring Tool APIs (no sample fallbacks).

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

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { isDark } = useThemeMode();

  const pageBg = isDark ? '#0b1220' : colors.background;
  const cardBg = isDark ? '#111827' : colors.card;
  const cardSoft = isDark ? '#1e293b' : colors.cardSoft;
  const borderColor = isDark ? 'rgba(148,163,184,0.2)' : colors.border;
  const textMain = isDark ? '#f8fafc' : colors.text;
  const textMuted = isDark ? '#94a3b8' : colors.textMuted;
  const textSubtle = isDark ? '#64748b' : colors.textSubtle;
  const trackBg = isDark ? 'rgba(148,163,184,0.15)' : colors.backgroundAlt;
  const heroBorder = isDark ? borderColor : colors.border;

  const taskId = String(id || '').trim();
  const staffId = getMonitoringStaffId(user);
  const taskQuery = useQuery(
    async () => {
      if (!taskId) throw new Error('Missing task id');
      try {
        if (!staffId) throw new Error('Missing staff id');
        const { payload } = await fetchMonitoringPerformance({
          staffId,
          token,
          getToken: () => token,
        });
        const list = extractPerformanceTasks(payload);
        const normalized = list.map((t, index) => normalizeTaskFromPerformance(t, index));
        const wanted = normalized.find((t) => String(t.id) === String(taskId));
        if (!wanted) throw new Error('Task not found');
        return wanted;
      } catch {
        throw new Error('Failed to load task');
      }
    },
    [token, taskId, staffId]
    // No SecureStore cache: parent performance payload is too large for typical SecureStore limits.
  );

  const { data: task, loading, error, fromCache, lastSyncedAt } = taskQuery;

  const timeline = useMemo(
    () => (task ? buildTaskTimelineFromApi(task, isDark, colors) : []),
    [task, isDark]
  );
  const progress = task ? taskProgressPercent(task) : 0;
  const dueDate = parseDate(task?.due_date);
  const isLate =
    task &&
    task.status !== 'completed' &&
    task.status !== 'review' &&
    dueDate &&
    dueDate < new Date();
  const status = statusLabel(task?.raw_status || task?.status);
  const typeLine = [task?.type_label, task?.application_type, task?.category].filter(Boolean).join(' · ') || '—';

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]} edges={['top', 'left', 'right']}>
        <View style={[styles.centered, { backgroundColor: pageBg }]}>
          <ActivityIndicator color={colors.fdaGreen} />
          <Text style={[styles.loadingText, { color: textMuted }]}>Loading task timeline…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !task) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]} edges={['top', 'left', 'right']}>
        <View style={[styles.centered, { backgroundColor: pageBg }]}>
          <Text style={[styles.errorTitle, { color: textMain }]}>Task unavailable</Text>
          <Text style={[styles.errorText, { color: textMuted }]}>
            {error || "We couldn't load this task. It may have been removed or you don't have access."}
          </Text>
          <PressableScale style={[styles.backButton, { backgroundColor: cardBg, borderColor }]} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    );
  }

  const statusChipStyle = isDark
    ? { backgroundColor: 'rgba(33,77,134,0.45)', color: '#93c5fd' }
    : { backgroundColor: '#eef2ff', color: colors.fdaBlue };
  const priorityChipStyle = isDark
    ? { backgroundColor: 'rgba(148,163,184,0.2)', color: textMuted }
    : { backgroundColor: '#f2f4f7', color: colors.textMuted };
  const priorityHighStyle = isDark
    ? { backgroundColor: 'rgba(194,65,12,0.35)', color: '#fdba74' }
    : { backgroundColor: '#fff0e8', color: '#c2410c' };
  const lateChipStyle = isDark
    ? { backgroundColor: 'rgba(220,38,38,0.25)', color: '#fca5a5' }
    : { backgroundColor: '#fdecec', color: colors.danger };
  const stateDoneStyle = isDark
    ? { backgroundColor: 'rgba(5,150,105,0.3)', color: '#6ee7b7' }
    : { backgroundColor: '#e7faf0', color: colors.success };
  const statePendingStyle = isDark
    ? { backgroundColor: 'rgba(148,163,184,0.2)', color: textMuted }
    : { backgroundColor: '#f2f4f7', color: colors.textMuted };
  const stateActiveStyle = isDark
    ? { backgroundColor: 'rgba(59,130,246,0.22)', color: '#93c5fd' }
    : { backgroundColor: '#dbeafe', color: colors.fdaBlue };
  const timelineCardBorder = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(255,255,255,0.65)';
  const dotInactive = isDark ? '#475569' : colors.borderStrong;
  const lineColor = isDark ? 'rgba(148,163,184,0.25)' : colors.border;
  const activeDotRing = isDark ? '#3b82f6' : '#bfdbfe';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={[styles.container, { backgroundColor: pageBg }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      <FadeInView delay={0} translateY={12}>
        <View style={[styles.heroCard, { borderColor: heroBorder }]}>
          <LinearGradient
            colors={isDark ? ['#111827', '#0b1220', '#0f172a'] : ['#ffffff', '#f6fbff', '#f3f9f6']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={isDark ? ['transparent', 'rgba(15,94,71,0.1)'] : ['transparent', 'rgba(15,94,71,0.04)']}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.heroCardInner}>
          <View style={styles.heroTop}>
            <PressableScale style={[styles.iconBack, { backgroundColor: cardBg, borderColor }]} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color={textMain} />
            </PressableScale>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroEyebrow, { color: colors.fdaGreen }]}>Task Timeline</Text>
              <Text style={[styles.heroTitle, { color: textMain }]} numberOfLines={2}>{task.title || 'Untitled task'}</Text>
              <Text style={[styles.heroSub, { color: textMuted }]} numberOfLines={2}>{task.description || 'No task description available.'}</Text>
            </View>
          </View>

          <View style={styles.metaChipsRow}>
            <Text style={[styles.metaChip, statusChipStyle]}>{status}</Text>
            {task.priority ? (
              <Text
                style={[styles.metaChip, task.priority === 'high' ? priorityHighStyle : priorityChipStyle]}
              >
                {String(task.priority).toUpperCase()}
              </Text>
            ) : null}
            {isLate ? <Text style={[styles.metaChip, lateChipStyle]}>LATE</Text> : null}
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressTop}>
              <Text style={[styles.progressLabel, { color: textMuted }]}>Progress (from SLA days + status)</Text>
              <Text style={[styles.progressValue, { color: textMain }]}>{progress}%</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
              <LinearGradient
                colors={[colors.fdaGreen, colors.teal]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${Math.max(progress, 8)}%` }]}
              />
            </View>
          </View>

          <View style={styles.quickStats}>
            <View style={[styles.quickStat, { backgroundColor: cardBg, borderColor }]}>
              <Ionicons name="person-outline" size={14} color={colors.fdaGreen} />
              <View style={styles.quickStatTextBlock}>
                <Text style={[styles.quickStatLabel, { color: textSubtle }]}>Assigned by</Text>
                <Text style={[styles.quickStatValue, { color: textMain }]} numberOfLines={2}>
                  {task.assigned_by || '—'}
                </Text>
              </View>
            </View>
            <View style={[styles.quickStat, { backgroundColor: cardBg, borderColor }]}>
              <Ionicons name="time-outline" size={14} color={colors.warning} />
              <View style={styles.quickStatTextBlock}>
                <Text style={[styles.quickStatLabel, { color: textSubtle }]}>Due</Text>
                <Text style={[styles.quickStatValue, { color: textMain }]}>{formatDateTime(task.due_date)}</Text>
              </View>
            </View>
            <View style={[styles.quickStat, { backgroundColor: cardBg, borderColor }]}>
              <Ionicons name="pricetags-outline" size={14} color={colors.fdaBlue} />
              <View style={styles.quickStatTextBlock}>
                <Text style={[styles.quickStatLabel, { color: textSubtle }]}>Type / category</Text>
                <Text style={[styles.quickStatValue, { color: textMain }]} numberOfLines={2}>
                  {typeLine}
                </Text>
              </View>
            </View>
          </View>
          </View>
        </View>
      </FadeInView>

      {(fromCache || lastSyncedAt) && (
        <FadeInView delay={60} translateY={8}>
          <View style={[styles.syncPill, { backgroundColor: cardSoft, borderColor }]}>
            <Text style={[styles.syncPillText, { color: textMuted }]}>
              {fromCache ? 'Cached detail' : 'Live detail'}
              {lastSyncedAt ? ` • ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </Text>
          </View>
        </FadeInView>
      )}

      <FadeInView delay={120} translateY={10}>
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: textMain }]}>Timeline</Text>
          {timeline.map((step, index) => (
            <View key={step.key} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: step.done ? step.dot : dotInactive },
                    step.active && { borderWidth: 2, borderColor: activeDotRing },
                  ]}
                />
                {index < timeline.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: lineColor }]} /> : null}
              </View>
              <View style={[styles.timelineCard, { backgroundColor: step.tone, borderColor: timelineCardBorder }]}>
                <View style={styles.timelineTop}>
                  <Text style={[styles.timelineTitle, { color: textMain }]}>{step.title}</Text>
                  <Text style={[styles.timelineTime, { color: textSubtle }]}>{step.time ? formatDateTime(step.time) : 'Pending'}</Text>
                </View>
                <Text style={[styles.timelineSubtitle, { color: textMuted }]}>{step.subtitle}</Text>
                <Text
                  style={[
                    styles.timelineState,
                    step.done ? stateDoneStyle : step.active ? stateActiveStyle : statePendingStyle,
                  ]}
                >
                  {step.stateLabel}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </FadeInView>

      <FadeInView delay={180} translateY={10}>
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: textMain }]}>Task Details</Text>
          {[
            ['Task ID', task.id],
            ['API status', task.raw_status || '—'],
            ['UI status', status],
            ['Timeline (API)', timelineStatusLabel(task.timeline_status)],
            ['Priority', task.priority || '—'],
            ['Category', task.category || '—'],
            ['Type / programme', [task.type_label, task.application_type].filter(Boolean).join(' · ') || '—'],
            ['Application ref', task.application_id ? `#${task.application_id}` : '—'],
            ['Assigned by', task.assigned_by || '—'],
            ['Created', formatDateTime(task.created_at)],
            ['Updated', formatDateTime(task.updated_at)],
            ['Completed', formatDateTime(task.completed_at)],
            [
              'Days (taken / allowed)',
              task.days_allowed != null && task.days_taken != null
                ? `${task.days_taken} / ${task.days_allowed}`
                : '—',
            ],
            [
              'Days remaining',
              task.days_remaining != null && task.days_remaining !== '' ? String(task.days_remaining) : '—',
            ],
            ...Object.entries(task.extras || {}).map(([k, v]) => [
              k.replace(/_/g, ' '),
              Array.isArray(v) ? `${v.length} item(s)` : typeof v === 'object' ? JSON.stringify(v) : String(v),
            ]),
          ].map(([label, value]) => (
            <View key={label} style={[styles.detailRow, { borderTopColor: borderColor }]}>
              <Text style={[styles.detailLabel, { color: textSubtle }]}>{label}</Text>
              <Text style={[styles.detailValue, { color: textMain }]}>{String(value)}</Text>
            </View>
          ))}
        </View>
      </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 104, gap: spacing.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  loadingText: { marginTop: 10, fontSize: 13 },
  errorTitle: { fontWeight: '800', fontSize: 18, marginBottom: 6 },
  errorText: { textAlign: 'center', lineHeight: 18, marginBottom: 12 },
  backButton: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  backButtonText: { color: colors.fdaGreen, fontWeight: '800' },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadow.card,
  },
  heroCardInner: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, zIndex: 1 },
  heroTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  iconBack: {
    width: 36,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: { fontSize: 11.5, fontWeight: '800', marginBottom: 4 },
  heroTitle: { fontSize: 17, fontWeight: '900' },
  heroSub: { fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  metaChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm + 4 },
  metaChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden', fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  progressWrap: { marginTop: spacing.sm + 4 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: '700' },
  progressValue: { fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  quickStats: { marginTop: spacing.sm + 4, gap: 8 },
  quickStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  quickStatTextBlock: { flex: 1 },
  quickStatLabel: { fontSize: 11, fontWeight: '700' },
  quickStatValue: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  syncPill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  syncPillText: { fontSize: 11, fontWeight: '700' },
  sectionCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, ...shadow.soft },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  timelineRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  timelineRail: { width: 16, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  timelineCard: { flex: 1, borderRadius: radius.md, padding: spacing.sm + 2, borderWidth: 1, marginBottom: spacing.sm },
  timelineTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  timelineTitle: { flex: 1, fontWeight: '800', fontSize: 13 },
  timelineTime: { fontSize: 10, textAlign: 'right', maxWidth: 110 },
  timelineSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  timelineState: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden', fontSize: 10, fontWeight: '800' },
  detailRow: { borderTopWidth: 1, paddingVertical: spacing.sm },
  detailLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  detailValue: { fontSize: 13, fontWeight: '700' },
});
