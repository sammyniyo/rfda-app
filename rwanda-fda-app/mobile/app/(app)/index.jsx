import { useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '../../hooks/useQuery';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import { api } from '../../constants/api';
import { getAuthHeaders } from '../../lib/api';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { DashboardSkeleton } from '../../components/SkeletonLoader';

const DASHBOARD_AUTO_REFRESH_MS = 60000;

// Dashboard uses live Monitoring Tool APIs (no sample fallbacks).

async function fetchWithAuth(getToken, url) {
  const res = await fetch(url, { headers: getAuthHeaders(getToken) });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

function MetricCard({ label, value, hint, accent, delay = 0 }) {
  return (
    <FadeInView delay={delay} translateY={12} style={{ flex: 1 }}>
      <View style={styles.metricCard}>
        <View style={[styles.metricAccent, { backgroundColor: accent }]} />
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
        {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
      </View>
    </FadeInView>
  );
}

function TeamMiniCard({ member }) {
  return (
    <View style={styles.teamMiniCard}>
      <View style={styles.teamMiniTop}>
        <View style={styles.teamMiniAvatar}>
          <Text style={styles.teamMiniAvatarText}>
            {String(member.name || 'RF')
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0])
              .join('')
              .toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.teamMiniName} numberOfLines={1}>{member.name || 'Staff member'}</Text>
          <Text style={styles.teamMiniMeta} numberOfLines={1}>{member.department || 'Rwanda FDA'}</Text>
        </View>
      </View>
      <View style={styles.teamMiniStats}>
        <View style={styles.teamMiniStatPill}>
          <Text style={styles.teamMiniStatValue}>{member.pending_tasks || 0}</Text>
          <Text style={styles.teamMiniStatLabel}>Open</Text>
        </View>
        <View style={styles.teamMiniStatPill}>
          <Text style={styles.teamMiniStatValue}>{member.total_applications || 0}</Text>
          <Text style={styles.teamMiniStatLabel}>Apps</Text>
        </View>
      </View>
    </View>
  );
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function firstWord(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  return s.split(/\s+/)[0] || s;
}

function QuickTile({ icon, label, onPress, tone = 'green' }) {
  const toneStyle =
    tone === 'blue'
      ? { bg: '#e8f0ff', icon: colors.fdaBlue }
      : tone === 'amber'
        ? { bg: '#fff6ea', icon: colors.warning }
        : { bg: '#e7faf0', icon: colors.fdaGreen };

  return (
    <PressableScale style={styles.quickTile} onPress={onPress}>
      <View style={[styles.quickTileIconWrap, { backgroundColor: toneStyle.bg }]}>
        <Ionicons name={icon} size={18} color={toneStyle.icon} />
      </View>
      <Text style={styles.quickTileLabel} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

export default function Dashboard() {
  const { user, token, perfType } = useAuth();
  const router = useRouter();
  const getToken = () => token;
  const [refreshing, setRefreshing] = useState(false);

  const performanceQuery = useQuery(
    async () => {
      try {
        const staffId = user?.staff_id ?? user?.id;
        if (!staffId) throw new Error('Missing staff id');
        const res = await fetch(api.performance(staffId, perfType, 'all'), { headers: getAuthHeaders(getToken) });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || payload?.success === false) throw new Error(payload?.message || 'Failed to load performance');
        return payload?.data || null;
      } catch {
        return null;
      }
    },
    [token, user?.id, user?.staff_id, perfType],
    { cacheKey: `performance_${token}_${user?.staff_id ?? user?.id ?? 'no_staff'}_${perfType || 'type'}` }
  );

  const notificationsQuery = useQuery(
    async () => {
      try {
        return await fetchWithAuth(getToken, api.notifications);
      } catch {
        return [];
      }
    },
    [token],
    { cacheKey: `notifications_${token}` }
  );
  const { data: performanceData, loading: perfLoading } = performanceQuery;
  const { data: notifications = [] } = notificationsQuery;

  const rawTasks = Array.isArray(performanceData?.tasks) ? performanceData.tasks : [];
  const rawApps = Array.isArray(performanceData?.applications) ? performanceData.applications : [];

  const taskList = rawTasks.map((t, index) => {
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
          completed_at: t.completed_at ?? null,
          timeline_status: t.timeline_status ?? null,
          days_allowed: t.days_allowed ?? null,
          days_taken: t.days_taken ?? null,
          days_remaining: t.days_remaining ?? null,
        };
      });

  const appList = rawApps.map((a) => ({
    id: a.application_id ?? a.assignment_id,
    reference_number: a.tracking_no,
    title: a.applicant,
    status: a.timeline_status || (a.is_completed ? 'approved' : a.is_active ? 'pending' : 'submitted'),
    type: performanceData?.filter?.application_type_label || performanceData?.filter?.application_type || 'Application',
    submitted_at: a.submission_date,
    updated_at: a.assignment_date,
    assigned_stage: a.assigned_stage,
    days_allowed: a.days_allowed,
    days_taken: a.days_taken,
    days_remaining: a.days_remaining,
  }));

  const notifList = Array.isArray(notifications) ? notifications : [];

  const apiFairScore = typeof performanceData?.fair_score === 'number' ? performanceData.fair_score : null;
  const apiScoreLabel = performanceData?.score_label ? String(performanceData.score_label) : null;
  const appsSummary = performanceData?.applications_summary || null;

  const pendingTasks = taskList.filter((t) => t.status !== 'completed').length;
  const inProgressTasks = taskList.filter((t) => t.status === 'in_progress').length;
  const completedTasks = taskList.filter((t) => t.status === 'completed').length;
  const unreadNotifs = notifList.filter((n) => !n.read_at).length;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const overdueTasks = taskList.filter((t) => {
    if (t.status === 'completed') return false;
    const due = toDate(t.due_date);
    return due && due < startToday;
  });
  const dueTodayTasks = taskList.filter((t) => {
    if (t.status === 'completed') return false;
    const due = toDate(t.due_date);
    return due && due >= startToday && due <= endToday;
  });
  const dueSoonTasks = taskList.filter((t) => {
    if (t.status === 'completed') return false;
    const due = toDate(t.due_date);
    return due && due > endToday && due <= next48h;
  });
  const atRiskApplicationsCount =
    typeof appsSummary?.at_risk === 'number'
      ? appsSummary.at_risk
      : rawApps.filter((a) => ['at_risk', 'tobedelayed', 'delayed'].includes(String(a.timeline_status || '').toLowerCase())).length;
  const approvalsWaitingCount =
    typeof appsSummary?.active === 'number'
      ? appsSummary.active
      : rawApps.filter((a) => Boolean(a.is_active) && !Boolean(a.is_completed)).length;
  const highPriorityOpen = taskList.filter((t) => t.status !== 'completed' && String(t.priority || '').toLowerCase() === 'high');

  const briefingScore =
    apiFairScore != null
      ? apiFairScore
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(100 - overdueTasks.length * 14 - dueTodayTasks.length * 6 - atRiskApplicationsCount * 5 + completedTasks * 2)
          )
        );
  const briefingTone =
    briefingScore >= 80 ? { label: 'On track', color: colors.success, bg: '#e7faf0' } :
    briefingScore >= 60 ? { label: 'Watch list', color: colors.warning, bg: '#fff6ea' } :
    { label: 'Needs attention', color: colors.danger, bg: '#fdecec' };

  const priorityActions = [
    ...overdueTasks.slice(0, 2).map((t) => ({
      key: `task-overdue-${t.id}`,
      type: 'Overdue Task',
      title: t.title || 'Untitled task',
      meta: t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : 'No due date',
      tone: '#fdecec',
      dot: colors.danger,
    })),
    ...dueTodayTasks.slice(0, 2).map((t) => ({
      key: `task-today-${t.id}`,
      type: 'Due Today',
      title: t.title || 'Untitled task',
      meta: t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : 'Today',
      tone: '#fff6ea',
      dot: colors.warning,
    })),
    ...appList
      .filter((a) => ['submitted', 'pending'].includes(String(a.status || '').toLowerCase()))
      .slice(0, 2)
      .map((a) => ({
      key: `app-wait-${a.id}`,
      type: 'Application Review',
      title: a.reference_number || a.title || `Application #${a.id}`,
      meta: String(a.status || 'pending').replace('_', ' '),
      tone: '#e8f0ff',
      dot: colors.fdaBlue,
    })),
  ].slice(0, 5);

  const workloadPercent = taskList.length
    ? Math.min(100, Math.round((completedTasks / taskList.length) * 100))
    : 0;

  const rawName = user?.name || user?.email || 'Staff';
  const displayName = String(rawName).split(' ')[0] || rawName;
  const queryMeta = [performanceQuery, notificationsQuery];
  const showingCached = queryMeta.some((q) => q.fromCache);
  const lastSyncedAt = queryMeta
    .map((q) => q.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  const teamMembers = 0;
  const teamAtRiskCount = 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        performanceQuery.refetch(),
        notificationsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!token) return undefined;
    const intervalId = setInterval(() => {
      Promise.allSettled([
        performanceQuery.refetch(),
        notificationsQuery.refetch(),
      ]);
    }, DASHBOARD_AUTO_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [token]);

  if (perfLoading && (!performanceData || appList.length === 0)) return <DashboardSkeleton />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.fdaGreen} />
        }
      >
      <FadeInView delay={0} translateY={14}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeaderRow}>
            <View style={styles.topLeft}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{(user?.name || 'RF').slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.topHello}>Hello, {firstWord(user?.name) || 'Staff'}</Text>
                <Text style={styles.topMeta} numberOfLines={1}>
                  {user?.dutyStation || 'Rwanda FDA'}
                </Text>
              </View>
            </View>
            <PressableScale style={styles.topIconBtn} onPress={() => router.push('/(app)/notifications')}>
              <Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
              {unreadNotifs > 0 ? <View style={styles.topDot} /> : null}
            </PressableScale>
          </View>

          <FadeInView delay={60} translateY={10}>
            <LinearGradient colors={['#1ba57a', '#17a0a0']} style={styles.hero}>
              <View style={styles.heroHeader}>
                <View style={styles.logoRow}>
                  <View style={styles.heroLogoWrapper}>
                    <Image source={require('../../assets/RwandaFDA.png')} style={styles.heroLogo} resizeMode="contain" />
                  </View>
                  <View>
                    <Text style={styles.heroEyebrow}>Rwanda FDA</Text>
                    <Text style={styles.heroSubtitle}>Your activity overview</Text>
                  </View>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeValue}>{briefingScore}</Text>
                  <Text style={styles.heroBadgeLabel}>{apiScoreLabel || 'Score'}</Text>
                </View>
              </View>

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatPill}>
                  <Text style={styles.heroStatValue}>{pendingTasks}</Text>
                  <Text style={styles.heroStatLabel}>Open tasks</Text>
                </View>
                <View style={styles.heroStatPill}>
                  <Text style={styles.heroStatValue}>{typeof appsSummary?.total === 'number' ? appsSummary.total : appList.length}</Text>
                  <Text style={styles.heroStatLabel}>Applications</Text>
                </View>
                <View style={styles.heroStatPill}>
                  <Text style={styles.heroStatValue}>{unreadNotifs}</Text>
                  <Text style={styles.heroStatLabel}>Unread</Text>
                </View>
              </View>
            </LinearGradient>
          </FadeInView>

          <FadeInView delay={100} translateY={10}>
            <View style={styles.quickRow}>
              <QuickTile icon="checkbox-outline" label="My Tasks" tone="green" onPress={() => router.push('/(app)/tasks')} />
              <QuickTile icon="document-text-outline" label="Applications" tone="blue" onPress={() => router.push('/(app)/applications')} />
              <QuickTile icon="notifications-outline" label="Alerts" tone="amber" onPress={() => router.push('/(app)/notifications')} />
              <QuickTile icon="person-outline" label="Profile" tone="green" onPress={() => router.push('/(app)/profile')} />
            </View>
          </FadeInView>

        </View>
      </FadeInView>

      <View style={styles.metricsGrid}>
        <MetricCard
          label="In Progress"
          value={inProgressTasks}
          hint="Requires action"
          accent="#d8f2e8"
          delay={90}
        />
        <MetricCard
          label="Completed"
          value={completedTasks}
          hint={`${workloadPercent}% completion`}
          accent="#dce8ff"
          delay={140}
        />
      </View>

      {(showingCached || lastSyncedAt) && (
        <FadeInView delay={170} translateY={8}>
          <View style={styles.syncBanner}>
            <Text style={styles.syncBannerText}>
              {showingCached ? 'Offline cache shown' : 'Live data'}
              {lastSyncedAt
                ? ` • Synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : ''}
              {` • Auto ${Math.round(DASHBOARD_AUTO_REFRESH_MS / 1000)}s`}
            </Text>
          </View>
        </FadeInView>
      )}

      <FadeInView delay={220} translateY={12}>
        <View style={styles.briefingCard}>
          <LinearGradient colors={['#ffffff', '#f7fbff', '#f4faf7']} style={styles.briefingGradient}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Daily Briefing</Text>
                <Text style={styles.briefingSub}>
                  {now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <View style={[styles.briefingStatusPill, { backgroundColor: briefingTone.bg }]}>
                <Text style={[styles.briefingStatusText, { color: briefingTone.color }]}>{briefingTone.label}</Text>
              </View>
            </View>

            <View style={styles.briefingMainRow}>
              <View style={styles.briefingScoreCompact}>
                <Text style={styles.briefingScoreCompactValue}>{briefingScore}</Text>
                <Text style={styles.briefingScoreCompactLabel}>Score</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.briefingMiniLines}>
                  <View style={styles.briefingMiniLine}>
                    <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                    <Text style={styles.briefingMiniText}>{overdueTasks.length} overdue</Text>
                  </View>
                  <View style={styles.briefingMiniLine}>
                    <Ionicons name="time-outline" size={14} color={colors.warning} />
                    <Text style={styles.briefingMiniText}>{dueTodayTasks.length} due today</Text>
                  </View>
                </View>
                <View style={styles.briefingScoreTrack}>
                  <LinearGradient
                    colors={[colors.fdaGreen, colors.teal]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.briefingScoreFill, { width: `${Math.max(briefingScore, 8)}%` }]}
                  />
                </View>
              </View>
            </View>

            <View style={styles.briefingPillsRow}>
              <View style={[styles.briefingPill, { backgroundColor: '#fdecec', borderColor: 'rgba(220,38,38,0.12)' }]}>
                <Text style={styles.briefingPillValue}>{overdueTasks.length}</Text>
                <Text style={styles.briefingPillLabel}>Overdue</Text>
              </View>
              <View style={[styles.briefingPill, { backgroundColor: '#fff6ea', borderColor: 'rgba(217,119,6,0.14)' }]}>
                <Text style={styles.briefingPillValue}>{dueSoonTasks.length}</Text>
                <Text style={styles.briefingPillLabel}>Due soon</Text>
              </View>
              <View style={[styles.briefingPill, { backgroundColor: '#e8f0ff', borderColor: 'rgba(33,77,134,0.14)' }]}>
                <Text style={styles.briefingPillValue}>{approvalsWaitingCount}</Text>
                <Text style={styles.briefingPillLabel}>To review</Text>
              </View>
              <View style={[styles.briefingPill, { backgroundColor: '#f2fbf6', borderColor: 'rgba(15,94,71,0.12)' }]}>
                <Text style={styles.briefingPillValue}>{atRiskApplicationsCount}</Text>
                <Text style={styles.briefingPillLabel}>Watch</Text>
              </View>
            </View>

            <View style={styles.briefingFooterRow}>
              <View style={styles.briefingHintPill}>
                <Ionicons name="flag-outline" size={14} color={colors.fdaGreen} />
                <Text style={styles.briefingHintText}>{highPriorityOpen.length} high priority open</Text>
              </View>
              <View style={styles.briefingHintPill}>
                <Ionicons name="mail-unread-outline" size={14} color={colors.warning} />
                <Text style={styles.briefingHintText}>{unreadNotifs} unread alerts</Text>
              </View>
            </View>

            <Text style={styles.briefingListTitle}>Top actions</Text>
            {priorityActions.length === 0 ? (
              <Text style={styles.emptyText}>No urgent actions right now.</Text>
            ) : (
              priorityActions.slice(0, 3).map((item) => (
                <View key={item.key} style={[styles.briefingActionRow, { backgroundColor: item.tone }]}>
                  <View style={[styles.briefingActionDot, { backgroundColor: item.dot }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.briefingActionType}>{item.type}</Text>
                    <Text style={styles.briefingActionTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.briefingActionMeta}>{item.meta}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
                </View>
              ))
            )}
          </LinearGradient>
        </View>
      </FadeInView>

      <FadeInView delay={260} translateY={12}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Workload progress</Text>
            <Text style={styles.sectionBadge}>{workloadPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[colors.fdaGreen, colors.teal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${Math.max(workloadPercent, 8)}%` }]}
            />
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.fdaGreen }]} />
              <Text style={styles.legendText}>Completed ({completedTasks})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.legendText}>Open ({pendingTasks})</Text>
            </View>
          </View>
        </View>
      </FadeInView>

      <FadeInView delay={320} translateY={10}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent tasks</Text>
            <Text style={styles.linkText}>View all</Text>
          </View>
          {taskList.slice(0, 4).map((task, index) => (
            <View key={task.id ?? `${task.title}-${index}`} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View
                  style={[
                    styles.timelineDot,
                    task.status === 'completed'
                      ? styles.timelineDotDone
                      : task.status === 'in_progress'
                        ? styles.timelineDotProgress
                        : styles.timelineDotPending,
                  ]}
                />
                {index < Math.min(taskList.length, 4) - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.timelineTop}>
                  <Text style={styles.timelineTitle} numberOfLines={1}>{task.title || 'Untitled task'}</Text>
                  <Text style={styles.timelineStatus}>{String(task.status || 'pending').replace('_', ' ')}</Text>
                </View>
                <Text style={styles.timelineSub} numberOfLines={2}>
                  {task.description || 'No task description available.'}
                </Text>
              </View>
            </View>
          ))}
          {taskList.length === 0 ? <Text style={styles.emptyText}>No tasks available yet.</Text> : null}
        </View>
      </FadeInView>

      {/* Team section: will be re-enabled when a profile hierarchy endpoint exists */}

      <FadeInView delay={440} translateY={10}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notifications preview</Text>
            <View style={styles.unreadPill}><Text style={styles.unreadPillText}>{unreadNotifs} unread</Text></View>
          </View>
          {notifList.slice(0, 3).map((item, index) => (
            <View key={item.id ?? index} style={styles.noticeRow}>
              <View style={[styles.noticeBadge, !item.read_at && styles.noticeBadgeUnread]}>
                <Text style={styles.noticeBadgeText}>{(item.type || 'N').slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle} numberOfLines={1}>{item.title || 'Notification'}</Text>
                <Text style={styles.noticeMessage} numberOfLines={2}>{item.message || 'No details.'}</Text>
              </View>
            </View>
          ))}
          {notifList.length === 0 ? <Text style={styles.emptyText}>No notifications yet.</Text> : null}
        </View>
      </FadeInView>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: 88,
    gap: spacing.sm,
  },
  sheet: {
    borderRadius: radius.xl,
    padding: spacing.md,
    paddingTop: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  sheetHandle: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.backgroundAlt,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetHeaderRow: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e7faf0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(27,165,122,0.18)',
  },
  userAvatarText: { fontWeight: '800', color: colors.fdaGreen, fontSize: 12, letterSpacing: 0.4 },
  topHello: { fontSize: 14, fontWeight: '700', color: colors.text },
  topMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  topIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  topDot: {
    position: 'absolute',
    right: 11,
    top: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.card,
  },
  quickRow: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickTileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTileLabel: { fontSize: 11.5, color: colors.text, fontWeight: '700' },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLogoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b1220',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  heroLogo: {
    width: 30,
    height: 24,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 62,
  },
  heroBadgeValue: { color: '#fff', fontSize: 16, fontWeight: '900', lineHeight: 18 },
  heroBadgeLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10.5, marginTop: 2 },
  heroGreeting: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 0 },
  heroTitleName: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2, marginBottom: 4 },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 16,
    maxWidth: 240,
  },
  avatarBubble: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBubbleText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  heroStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroStatPill: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroStatValue: { color: '#fff', fontWeight: '800', fontSize: 18 },
  heroStatLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  metricsGrid: { flexDirection: 'row', gap: spacing.md },
  metricCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  metricAccent: {
    width: 38,
    height: 6,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  metricValue: { color: colors.text, fontSize: 24, fontWeight: '800' },
  metricLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 2 },
  metricHint: { color: colors.textSubtle, fontSize: 12, marginTop: 6 },
  syncBanner: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncBannerText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  briefingCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.soft,
  },
  briefingGradient: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  briefingSub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  briefingStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  briefingStatusText: { fontSize: 11, fontWeight: '800' },
  briefingMainRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'center' },
  briefingScoreCompact: {
    width: 72,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  briefingScoreCompactValue: { color: colors.text, fontSize: 20, fontWeight: '900', lineHeight: 22 },
  briefingScoreCompactLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  briefingMiniLines: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  briefingMiniLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  briefingMiniText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  briefingScoreTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundAlt,
    overflow: 'hidden',
  },
  briefingScoreFill: { height: '100%', borderRadius: radius.pill },
  briefingPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  briefingPill: {
    width: '47.5%',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  briefingPillValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
  briefingPillLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: '700' },
  briefingFooterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  briefingHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  briefingHintText: { color: colors.textMuted, fontSize: 11.5, fontWeight: '800' },
  briefingListTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 6 },
  briefingActionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  briefingActionDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  briefingActionType: { color: colors.textSubtle, fontSize: 10, fontWeight: '800' },
  briefingActionTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  briefingActionMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  teamSectionCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.soft,
  },
  teamSectionGradient: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  teamManagerPill: {
    color: colors.fdaGreen,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: colors.fdaGreenSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  sectionBadge: {
    color: colors.fdaGreen,
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: colors.fdaGreenSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  progressTrack: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textMuted, fontSize: 12 },
  linkText: { color: colors.fdaGreen, fontWeight: '700', fontSize: 12 },
  teamTopStats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  teamTopStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  teamTopStatValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  teamTopStatLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  teamInsightsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  teamInsightCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  teamInsightLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '700' },
  teamInsightName: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  teamInsightMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  teamListTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 4, marginBottom: 6 },
  teamMiniCard: {
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    marginTop: 8,
  },
  teamMiniTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  teamMiniAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.fdaGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMiniAvatarText: { color: colors.fdaGreen, fontWeight: '800', fontSize: 11 },
  teamMiniName: { color: colors.text, fontWeight: '700', fontSize: 13 },
  teamMiniMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  teamMiniStats: { flexDirection: 'row', gap: spacing.sm, marginTop: 8 },
  teamMiniStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamMiniStatValue: { color: colors.text, fontWeight: '800', fontSize: 12 },
  teamMiniStatLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 10 },
  teamMoreText: { color: colors.textMuted, fontSize: 11, marginTop: 8 },
  timelineRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  timelineRail: { width: 16, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineDotDone: { backgroundColor: colors.success },
  timelineDotProgress: { backgroundColor: colors.fdaBlue },
  timelineDotPending: { backgroundColor: colors.warning },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  timelineContent: {
    flex: 1,
    backgroundColor: colors.cardSoft,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  timelineTitle: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 13 },
  timelineStatus: { color: colors.textMuted, fontSize: 11, textTransform: 'capitalize' },
  timelineSub: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  unreadPill: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  unreadPillText: { color: colors.fdaBlue, fontWeight: '700', fontSize: 12 },
  noticeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  noticeBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBadgeUnread: { backgroundColor: colors.fdaGreenSoft },
  noticeBadgeText: { color: colors.fdaGreen, fontWeight: '800' },
  noticeTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
  noticeMessage: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  emptyText: { color: colors.textMuted, fontSize: 13, paddingVertical: spacing.sm },
  logoutButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#ffd7d7',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadow.soft,
  },
  logoutButtonText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
