import { useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import FriendlyErrorBanner from '../../components/FriendlyErrorBanner';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';
import { useQuery } from '../../hooks/useQuery';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import { api } from '../../constants/api';
import { getAuthHeaders, isApiSuccess } from '../../lib/api';
import {
  extractPerformanceApplications,
  extractPerformanceTasks,
  fetchMonitoringPerformance,
  normalizePerformancePayloadData,
} from '../../lib/monitoringPerformance';
import { getMonitoringStaffId } from '../../lib/staffSession';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { DashboardSkeleton } from '../../components/SkeletonLoader';

const DASHBOARD_AUTO_REFRESH_MS = 60000;

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function kpiTone(isDark, tone) {
  if (tone === 'danger') return { bg: isDark ? '#2a1116' : '#fff1f2', fg: colors.danger };
  if (tone === 'warning') return { bg: isDark ? '#2b1f0b' : '#fff7ed', fg: colors.warning };
  if (tone === 'blue') return { bg: isDark ? '#12233f' : '#eff6ff', fg: colors.fdaBlue };
  return { bg: isDark ? '#0f2a22' : '#ecfdf5', fg: colors.fdaGreen };
}

function statusTone(isDark, status) {
  const s = String(status || '').toLowerCase();
  if (s === 'delayed') return { bg: isDark ? '#2a1116' : '#fff1f2', color: colors.danger, label: 'Delayed' };
  if (s === 'tobedelayed') return { bg: isDark ? '#2b1f0b' : '#fff7ed', color: colors.warning, label: 'At risk' };
  return { bg: isDark ? '#0f2a22' : '#ecfdf5', color: colors.success, label: 'On time' };
}

export default function Dashboard() {
  const { user, token, updateUser } = useAuth();
  const { isDark } = useThemeMode();
  const router = useRouter();
  const getToken = () => token;
  const staffId = getMonitoringStaffId(user);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  const performanceQuery = useQuery(
    async () => {
      const { payload } = await fetchMonitoringPerformance({ staffId, token, getToken });
      return normalizePerformancePayloadData(payload);
    },
    [token, staffId]
    // No SecureStore cache — see lib/cache.js. Uses same fetch as Applications/Tasks (?token= + Bearer retries).
  );

  const notificationsQuery = useQuery(
    async () => {
      if (!token) return [];
      const tokenValue = String(token);
      const headersBearer = { ...getAuthHeaders(getToken), Authorization: `Bearer ${tokenValue}` };
      const headersRaw = { ...getAuthHeaders(getToken), Authorization: tokenValue };
      let res = await fetch(api.notifications, { headers: headersBearer });
      let payload = await res.json().catch(() => ({}));
      if (!res.ok && (res.status === 401 || res.status === 403)) {
        res = await fetch(api.notifications, { headers: headersRaw });
        payload = await res.json().catch(() => ({}));
      }
      if (!res.ok || !isApiSuccess(payload)) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data?.items)) return payload.data.items;
      if (Array.isArray(payload?.items)) return payload.items;
      return [];
    },
    [token],
    { cacheKey: token ? `notifications_${token}` : undefined }
  );

  const { data: performanceData, loading: perfLoading, errorInfo: perfErrorInfo } = performanceQuery;
  const { data: notifications = [] } = notificationsQuery;
  const perfWrapper = { success: true, data: performanceData ?? {} };
  const rawTasks = extractPerformanceTasks(perfWrapper);
  const rawApps = extractPerformanceApplications(perfWrapper);

  const tasks = useMemo(
    () =>
      rawTasks.map((t, index) => {
        const rawStatus = String(t.status ?? t.task_status ?? '').toLowerCase();
        const normalizedStatus = t.is_completed
          ? 'completed'
          : rawStatus === 'pending'
            ? 'pending'
            : rawStatus === 'in_progress'
              ? 'in_progress'
              : rawStatus
                ? 'in_progress'
                : t.is_active
                  ? 'in_progress'
                  : 'pending';
        return {
          id: t.task_id ?? t.id ?? index + 1,
          title: t.title ?? t.task_title ?? t.name ?? 'Task',
          status: normalizedStatus,
          due_date: t.due_date ?? t.deadline ?? null,
          priority: String(t.priority ?? t.task_priority ?? '').toLowerCase(),
        };
      }),
    [rawTasks]
  );

  const apps = useMemo(
    () =>
      rawApps.map((a, index) => ({
        id: a.application_id ?? a.assignment_id ?? index + 1,
        trackingNo: a.tracking_no ?? a.reference_number ?? `APP-${index + 1}`,
        applicant: a.applicant ?? a.company_name ?? 'Applicant',
        timelineStatus: String(a.timeline_status || 'ontime').toLowerCase(),
        stage: a.assigned_stage ?? 'Review',
        daysAllowed: Number(a.days_allowed ?? 0),
        daysTaken: Number(a.days_taken ?? 0),
        daysRemaining: Number(a.days_remaining ?? 0),
        assignmentDate: a.assignment_date ?? null,
        submissionDate: a.submission_date ?? null,
      })),
    [rawApps]
  );

  const appSummary = performanceData?.applications_summary;
  const taskSummary = performanceData?.tasks_summary;

  const unreadCount = Array.isArray(notifications) ? notifications.filter((n) => !n?.read_at).length : 0;
  const openTasks = tasks.filter((t) => t.status !== 'completed').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const delayedApps = apps.filter((a) => a.timelineStatus === 'delayed').length;
  const riskApps = apps.filter((a) => a.timelineStatus === 'tobedelayed').length;

  /** Hero + KPIs: prefer live arrays; if empty, use API summaries (same payload the web tool uses). */
  const heroAppCount = Math.max(apps.length, Number(appSummary?.total ?? 0));
  const heroOpenTasks = Math.max(openTasks, Number(taskSummary?.active ?? 0));
  const delayedAppsForKpi = apps.length > 0 ? delayedApps : Number(appSummary?.delayed ?? 0);
  const riskAppsForInsight = apps.length > 0 ? riskApps : Number(appSummary?.at_risk ?? 0);
  const inProgressForKpi = Math.max(inProgressTasks, Number(taskSummary?.active ?? 0));
  const dueSoonTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    const due = toDate(t.due_date);
    if (!due) return false;
    const within72h = new Date(Date.now() + 72 * 60 * 60 * 1000);
    return due <= within72h;
  }).length;
  const completionRate =
    tasks.length > 0
      ? Math.round((completedTasks / tasks.length) * 100)
      : Number(taskSummary?.total) > 0
        ? Math.round((Number(taskSummary?.completed ?? 0) / Number(taskSummary.total)) * 100)
        : 0;
  const displayName = String(user?.name || user?.email || 'Staff').split(' ')[0] || 'Staff';
  const lastSyncedAt = [performanceQuery.lastSyncedAt, notificationsQuery.lastSyncedAt].filter(Boolean).sort().reverse()[0];

  const topApps = apps.slice(0, 8);
  const topTasks = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'completed');
    const sorted = [...open].sort((a, b) => {
      const da = toDate(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const db = toDate(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    });
    return sorted.slice(0, 6);
  }, [tasks]);

  function taskStatusLabel(status) {
    const s = String(status || '');
    if (s === 'completed') return 'Done';
    if (s === 'in_progress') return 'Active';
    return 'To do';
  }

  const toggleRow = (id) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([performanceQuery.refetch(), notificationsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  /** Sync `data.staff` from performance_api into persisted user (staff_id, name, email, group). */
  useEffect(() => {
    if (perfLoading || perfErrorInfo || !performanceData?.staff) return;
    const s = performanceData.staff;
    const nextStaffId = s.staff_id != null ? Number(s.staff_id) : null;
    const nextName = s.name ? String(s.name) : '';
    const nextEmail = s.email ? String(s.email) : '';
    const nextGroup = s.group ? String(s.group) : '';
    const patch = {};
    if (nextStaffId != null && Number(user?.staff_id ?? NaN) !== nextStaffId) {
      patch.staff_id = nextStaffId;
    }
    if (nextName && user?.name !== nextName) patch.name = nextName;
    if (nextEmail && user?.email !== nextEmail) patch.email = nextEmail;
    if (nextGroup && user?.group !== nextGroup && user?.dutyStation !== nextGroup) {
      patch.group = nextGroup;
      patch.dutyStation = nextGroup;
    }
    if (typeof s.is_non_statute === 'boolean' && user?.is_non_statute !== s.is_non_statute) {
      patch.is_non_statute = s.is_non_statute;
    }
    if (Object.keys(patch).length === 0) return;
    updateUser(patch);
  }, [
    perfLoading,
    perfErrorInfo,
    performanceData?.staff,
    user?.staff_id,
    user?.name,
    user?.email,
    user?.group,
    user?.dutyStation,
    user?.is_non_statute,
    updateUser,
  ]);

  useEffect(() => {
    if (!token) return undefined;
    const id = setInterval(() => {
      Promise.allSettled([performanceQuery.refetch(), notificationsQuery.refetch()]);
    }, DASHBOARD_AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [token]);

  if (perfLoading && !performanceData && !perfErrorInfo) return <DashboardSkeleton />;

  const pageBg = isDark ? '#0b1220' : colors.background;
  const cardBg = isDark ? '#111827' : colors.card;
  const borderColor = isDark ? 'rgba(148,163,184,0.2)' : colors.border;
  const textMain = isDark ? '#f8fafc' : colors.text;
  const textMuted = isDark ? '#94a3b8' : colors.textMuted;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={[styles.container, { backgroundColor: pageBg }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.fdaGreen} />}
      >
        {perfErrorInfo ? (
          <FadeInView delay={0} translateY={8}>
            <FriendlyErrorBanner
              info={perfErrorInfo}
              isDark={isDark}
              onRetry={() => handleRefresh()}
            />
          </FadeInView>
        ) : null}

        <FadeInView delay={0} translateY={12}>
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: cardBg,
                borderColor,
              },
            ]}
          >
            <View style={[styles.heroAccent, { backgroundColor: colors.fdaGreen }]} />
            <View style={styles.heroInner}>
              <Text style={[styles.heroEyebrow, { color: textMuted }]}>RWANDA FDA</Text>
              <View style={styles.heroTopRow}>
                <View style={[styles.logoWrap, isDark && styles.logoWrapDark]}>
                  <Image source={require('../../assets/RwandaFDA.png')} style={styles.logo} resizeMode="contain" />
                </View>
                <View style={styles.heroTextCol}>
                  <Text style={[styles.heroTitle, { color: textMain }]}>Welcome back, {displayName}</Text>
                  <Text style={[styles.heroSub, { color: textMuted }]} numberOfLines={2}>
                    {user?.dutyStation || 'Monitoring Tool — tasks, applications & alerts'}
                  </Text>
                </View>
              </View>
              <View style={[styles.heroStatsRow, { borderTopColor: borderColor }]}>
                <View style={styles.heroStatCell}>
                  <Text style={[styles.heroMiniValue, { color: colors.fdaGreen }]}>{heroOpenTasks}</Text>
                  <Text style={[styles.heroMiniLabel, { color: textMuted }]}>Open tasks</Text>
                </View>
                <View style={[styles.heroStatDivider, { backgroundColor: borderColor }]} />
                <View style={styles.heroStatCell}>
                  <Text style={[styles.heroMiniValue, { color: colors.fdaBlue }]}>{heroAppCount}</Text>
                  <Text style={[styles.heroMiniLabel, { color: textMuted }]}>Applications</Text>
                </View>
                <View style={[styles.heroStatDivider, { backgroundColor: borderColor }]} />
                <View style={styles.heroStatCell}>
                  <Text style={[styles.heroMiniValue, { color: unreadCount > 0 ? colors.danger : textMain }]}>{unreadCount}</Text>
                  <Text style={[styles.heroMiniLabel, { color: textMuted }]}>Unread alerts</Text>
                </View>
              </View>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={70} translateY={8}>
          <View style={styles.quickRow}>
            <PressableScale style={[styles.quickBtn, { backgroundColor: cardBg, borderColor }]} onPress={() => router.push('/(app)/tasks')}>
              <Ionicons name="checkbox-outline" size={18} color={colors.fdaGreen} />
              <Text style={[styles.quickText, { color: textMain }]}>Tasks</Text>
            </PressableScale>
            <PressableScale style={[styles.quickBtn, { backgroundColor: cardBg, borderColor }]} onPress={() => router.push('/(app)/applications')}>
              <Ionicons name="document-text-outline" size={18} color={colors.fdaBlue} />
              <Text style={[styles.quickText, { color: textMain }]}>Applications</Text>
            </PressableScale>
            <PressableScale style={[styles.quickBtn, { backgroundColor: cardBg, borderColor }]} onPress={() => router.push('/(app)/notifications')}>
              <Ionicons name="notifications-outline" size={18} color={colors.warning} />
              <Text style={[styles.quickText, { color: textMain }]}>Alerts</Text>
            </PressableScale>
            <PressableScale style={[styles.quickBtn, { backgroundColor: cardBg, borderColor }]} onPress={() => router.push('/(app)/profile')}>
              <Ionicons name="person-outline" size={18} color={colors.fdaGreen} />
              <Text style={[styles.quickText, { color: textMain }]}>Profile</Text>
            </PressableScale>
          </View>
        </FadeInView>

        <FadeInView delay={120} translateY={8}>
          <View style={styles.kpiGrid}>
            {[
              { label: 'Completion', value: `${completionRate}%`, icon: 'analytics-outline', tone: 'green' },
              { label: 'In Progress', value: inProgressForKpi, icon: 'timer-outline', tone: 'blue' },
              { label: 'Due Soon', value: dueSoonTasks, icon: 'alarm-outline', tone: 'warning' },
              { label: 'Delayed Apps', value: delayedAppsForKpi, icon: 'alert-circle-outline', tone: 'danger' },
            ].map((kpi) => {
              const tone = kpiTone(isDark, kpi.tone);
              return (
                <View key={kpi.label} style={[styles.kpiCard, { backgroundColor: cardBg, borderColor }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: tone.bg }]}>
                    <Ionicons name={kpi.icon} size={16} color={tone.fg} />
                  </View>
                  <Text style={[styles.kpiValue, { color: textMain }]}>{kpi.value}</Text>
                  <Text style={[styles.kpiLabel, { color: textMuted }]}>{kpi.label}</Text>
                </View>
              );
            })}
          </View>
        </FadeInView>

        <FadeInView delay={150} translateY={8}>
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.sectionTop}>
              <View>
                <Text style={[styles.sectionTitle, { color: textMain }]}>Your tasks</Text>
                <Text style={[styles.sectionSubtitle, { color: textMuted }]}>Open work assigned to you</Text>
              </View>
              <PressableScale onPress={() => router.push('/(app)/tasks')} hapticType="selection">
                <Text style={styles.sectionLink}>See all</Text>
              </PressableScale>
            </View>
            {topTasks.length === 0 ? (
              <Text style={[styles.emptyText, { color: textMuted, paddingVertical: 8 }]}>
                {tasks.length === 0
                  ? 'No tasks assigned — check back later or open Tasks for the full list.'
                  : 'No open tasks — you’re all caught up.'}
              </Text>
            ) : (
              topTasks.map((t) => {
                const due = toDate(t.due_date);
                return (
                  <PressableScale
                    key={t.id}
                    style={[styles.taskRow, { borderColor }]}
                    onPress={() => router.push(`/(app)/task/${t.id}`)}
                    hapticType="light"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskRowTitle, { color: textMain }]} numberOfLines={2}>
                        {t.title}
                      </Text>
                      <Text style={[styles.taskRowMeta, { color: textMuted }]}>
                        {due ? `Due ${due.toLocaleDateString([], { day: '2-digit', month: 'short' })}` : 'No due date'}
                      </Text>
                    </View>
                    <View style={[styles.taskStatusPill, { backgroundColor: isDark ? '#1e3a2f' : '#ecfdf5' }]}>
                      <Text style={[styles.taskStatusText, { color: colors.fdaGreen }]}>{taskStatusLabel(t.status)}</Text>
                    </View>
                  </PressableScale>
                );
              })
            )}
          </View>
        </FadeInView>

        <FadeInView delay={170} translateY={8}>
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.sectionTop}>
              <View>
                <Text style={[styles.sectionTitle, { color: textMain }]}>Applications</Text>
                <Text style={[styles.sectionSubtitle, { color: textMuted }]}>Tap a row to expand details</Text>
              </View>
              <PressableScale onPress={() => router.push('/(app)/applications')} hapticType="selection">
                <Text style={styles.sectionLink}>Full list</Text>
              </PressableScale>
            </View>
            <View style={[styles.tableHead, { borderColor }]}>
              <Text style={[styles.thRef, { color: textMuted }]}>Ref</Text>
              <Text style={[styles.thStatus, { color: textMuted }]}>Status</Text>
              <Text style={[styles.thDays, { color: textMuted }]}>Days Left</Text>
            </View>
            {topApps.length === 0 ? (
              <Text style={[styles.emptyText, { color: textMuted }]}>No application records available.</Text>
            ) : (
              topApps.map((item) => {
                const expanded = Boolean(expandedRows[item.id]);
                const tone = statusTone(isDark, item.timelineStatus);
                return (
                  <View key={item.id} style={[styles.tableRowWrap, { borderColor }]}>
                    <PressableScale style={styles.tableRow} onPress={() => toggleRow(item.id)}>
                      <View style={styles.refWrap}>
                        <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={15} color={textMuted} />
                        <Text style={[styles.rowRef, { color: textMain }]} numberOfLines={1}>{item.trackingNo}</Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.statusText, { color: tone.color }]}>{tone.label}</Text>
                      </View>
                      <Text style={[styles.rowDays, { color: textMain }]}>{item.daysRemaining}</Text>
                    </PressableScale>
                    {expanded ? (
                      <View style={[styles.expandedBox, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor }]}>
                        <Text style={[styles.expandedTitle, { color: textMain }]} numberOfLines={2}>{item.applicant}</Text>
                        <View style={styles.expandedMetaRow}>
                          <Text style={[styles.metaLabel, { color: textMuted }]}>Stage:</Text>
                          <Text style={[styles.metaValue, { color: textMain }]}>{item.stage}</Text>
                        </View>
                        <View style={styles.expandedMetaRow}>
                          <Text style={[styles.metaLabel, { color: textMuted }]}>Allowed/Taken:</Text>
                          <Text style={[styles.metaValue, { color: textMain }]}>{item.daysAllowed} / {item.daysTaken} days</Text>
                        </View>
                        <View style={styles.expandedMetaRow}>
                          <Text style={[styles.metaLabel, { color: textMuted }]}>Assigned:</Text>
                          <Text style={[styles.metaValue, { color: textMain }]}>{item.assignmentDate ? new Date(item.assignmentDate).toLocaleDateString() : '—'}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </FadeInView>

        <FadeInView delay={220} translateY={8}>
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.sectionTop}>
              <Text style={[styles.sectionTitle, { color: textMain }]}>Insights</Text>
              <Text style={[styles.sectionCount, { color: textMuted }]}>Live</Text>
            </View>
            <View style={styles.insightRow}>
              <View
                style={[styles.insightPill, { backgroundColor: kpiTone(isDark, riskAppsForInsight > 0 ? 'warning' : 'green').bg }]}
              >
                <Ionicons name="pulse-outline" size={14} color={riskAppsForInsight > 0 ? colors.warning : colors.success} />
                <Text style={[styles.insightText, { color: textMain }]}>
                  {riskAppsForInsight} applications are at risk
                </Text>
              </View>
              <View style={[styles.insightPill, { backgroundColor: kpiTone(isDark, unreadCount > 0 ? 'blue' : 'green').bg }]}>
                <Ionicons name="notifications-outline" size={14} color={unreadCount > 0 ? colors.fdaBlue : colors.success} />
                <Text style={[styles.insightText, { color: textMain }]}>{unreadCount} unread alerts waiting</Text>
              </View>
            </View>
            {lastSyncedAt ? (
              <Text style={[styles.syncText, { color: textMuted }]}>
                Last synced {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            ) : null}
          </View>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: 96, gap: spacing.sm + 2 },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadow.card,
  },
  heroAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  heroInner: { paddingLeft: spacing.md + 6, paddingRight: spacing.md, paddingVertical: spacing.md },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: spacing.sm },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroTextCol: { flex: 1 },
  logoWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 94, 71, 0.12)',
    ...shadow.soft,
  },
  logoWrapDark: {
    backgroundColor: '#0f172a',
    borderColor: 'rgba(148,163,184,0.25)',
  },
  logo: { width: 34, height: 28 },
  heroTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  heroSub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  heroStatCell: { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, height: 36 },
  heroMiniValue: { fontSize: 22, fontWeight: '900' },
  heroMiniLabel: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quickBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 5,
  },
  quickText: { fontSize: 11.5, fontWeight: '700' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiCard: {
    width: '48%',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
  },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: { fontSize: 19, fontWeight: '900' },
  kpiLabel: { marginTop: 2, fontSize: 12, fontWeight: '600' },
  sectionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    ...shadow.soft,
  },
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 15.5, fontWeight: '900' },
  sectionSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  sectionLink: { color: colors.fdaGreen, fontSize: 13, fontWeight: '800' },
  sectionCount: { fontSize: 12, fontWeight: '600' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  taskRowTitle: { fontSize: 14, fontWeight: '700' },
  taskRowMeta: { fontSize: 12, marginTop: 3 },
  taskStatusPill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  taskStatusText: { fontSize: 10.5, fontWeight: '800' },
  tableHead: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  thRef: { flex: 1.6, fontSize: 11, fontWeight: '700' },
  thStatus: { flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  thDays: { width: 64, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  tableRowWrap: { borderTopWidth: 1 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  refWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1.6 },
  rowRef: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  statusPill: { flex: 1, borderRadius: radius.pill, paddingVertical: 5, alignItems: 'center' },
  statusText: { fontSize: 10.5, fontWeight: '800' },
  rowDays: { width: 64, textAlign: 'right', fontSize: 12, fontWeight: '800' },
  expandedBox: { borderWidth: 1, borderRadius: radius.md, padding: 10, marginBottom: 10 },
  expandedTitle: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
  expandedMetaRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  metaLabel: { width: 96, fontSize: 11.5, fontWeight: '700' },
  metaValue: { flex: 1, fontSize: 11.5, fontWeight: '600' },
  insightRow: { gap: 8 },
  insightPill: { borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightText: { fontSize: 12, fontWeight: '700' },
  syncText: { marginTop: 10, fontSize: 11.5, fontWeight: '600' },
  emptyText: { fontSize: 12.5, fontWeight: '600', paddingVertical: 12 },
});
