import { useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import FriendlyErrorBanner from '../../components/FriendlyErrorBanner';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';
import { useQuery } from '../../hooks/useQuery';
import { colors, spacing, radius, shadow, header, greenAlpha } from '../../constants/theme';
import { api } from '../../constants/api';
import { getAuthHeaders, isApiSuccess } from '../../lib/api';
import {
  extractPerformanceApplications,
  extractPerformanceTasks,
  fetchMonitoringPerformance,
  normalizePerformancePayloadData,
} from '../../lib/monitoringPerformance';
import { canonicalApplicationTimeline } from '../../lib/applicationTimeline';
import { getMonitoringStaffId } from '../../lib/staffSession';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { formatStat, tabularNumberStyle } from '../../lib/formatStat';
import AuthLoadingScreen from '../../components/AuthLoadingScreen';
import PreviewWebNotice from '../../components/PreviewWebNotice';

const DASHBOARD_AUTO_REFRESH_MS = 60000;

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function statusTone(isDark, status) {
  const s = String(status || '').toLowerCase();
  if (s === 'delayed') return { bg: isDark ? '#2a1116' : '#fff1f2', color: colors.danger, label: 'Delayed' };
  if (s === 'tobedelayed') return { bg: isDark ? '#2b1f0b' : '#fff7ed', color: colors.warning, label: 'At risk' };
  return { bg: isDark ? '#0f2a22' : '#ecfdf5', color: colors.success, label: 'On time' };
}

function ReportStatRow({ icon, label, value, valueColor, textMain, textMuted }) {
  return (
    <View style={styles.reportStatRow}>
      <View style={styles.reportStatLeft}>
        <Ionicons name={icon} size={18} color={textMuted} />
        <Text style={[styles.reportStatLabel, { color: textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.reportStatValue, tabularNumberStyle, { color: valueColor ?? textMain }]}>{value}</Text>
    </View>
  );
}

/** KPI tile with icon + soft tint (dashboard “At a glance”). */
function KpiTile({ label, value, valueColor, textMuted, bg, dense, icon, isDark, onPress }) {
  const bubbleBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15, 23, 42, 0.06)';
  const inner = (
    <View style={styles.kpiTileRow}>
      <View style={[styles.kpiIconBubble, { backgroundColor: bubbleBg }]}>
        <Ionicons name={icon} size={17} color={valueColor} />
      </View>
      <View style={styles.kpiTileTextCol}>
        <Text
          style={[
            dense ? styles.kpiTileValueDense : styles.kpiTileValue,
            tabularNumberStyle,
            { color: valueColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.58}
        >
          {value}
        </Text>
        <Text style={[styles.kpiTileLabel, { color: textMuted }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  );
  if (onPress) {
    return (
      <PressableScale
        style={[styles.kpiTile, { backgroundColor: bg, borderColor: border }]}
        onPress={onPress}
        hapticType="light"
      >
        {inner}
      </PressableScale>
    );
  }
  return <View style={[styles.kpiTile, { backgroundColor: bg, borderColor: border }]}>{inner}</View>;
}

/** Stacked mix of delayed / at risk / active / completed (scaled if API totals exceed assignments). */
function ApplicationsMixBar({ appReport, trackColor, legendColor }) {
  const den = Math.max(1, Number(appReport.assignments) || 1);
  const parts = [
    { key: 'd', n: Number(appReport.delayed) || 0, c: colors.danger, label: 'Delayed' },
    { key: 'r', n: Number(appReport.atRisk) || 0, c: colors.warning, label: 'At risk' },
    { key: 'a', n: Number(appReport.active) || 0, c: colors.fdaBlue, label: 'Active' },
    { key: 'c', n: Number(appReport.completed) || 0, c: colors.success, label: 'Done' },
  ];
  const sum = parts.reduce((s, p) => s + p.n, 0);
  const scale = sum > den ? den / sum : 1;
  const weights = parts.map((p) => Math.max(0, p.n * scale));
  const totalW = weights.reduce((s, w) => s + w, 0);
  return (
    <View style={styles.mixBarWrap}>
      <View style={[styles.mixBarTrack, { backgroundColor: trackColor }]}>
        {totalW < 0.001 ? (
          <View style={{ flex: 1 }} />
        ) : (
          parts.map((p, i) => {
            const w = weights[i];
            if (w <= 0) return null;
            return <View key={p.key} style={[styles.mixBarSeg, { flex: w, backgroundColor: p.c }]} />;
          })
        )}
      </View>
      <View style={styles.mixLegend}>
        {parts
          .filter((p) => p.n > 0)
          .map((p) => (
            <View key={p.key} style={styles.mixLegendItem}>
              <View style={[styles.mixLegendDot, { backgroundColor: p.c }]} />
              <Text style={[styles.mixLegendText, { color: legendColor }]}>{p.label}</Text>
            </View>
          ))}
      </View>
    </View>
  );
}

function QuickLinkCell({ icon, label, textMain, isDark, onPress }) {
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : colors.fdaGreenSoft;
  return (
    <PressableScale style={styles.quickLinkCell} onPress={onPress} hapticType="light">
      <View style={[styles.quickLinkIconWrap, { backgroundColor: chipBg }]}>
        <Ionicons name={icon} size={22} color={colors.fdaGreen} />
      </View>
      <Text style={[styles.quickLinkLabel, { color: textMain }]} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

function TasksCompletionBlock({
  completionRate,
  taskCompletedForReport,
  taskTotalForReport,
  textMain,
  textMuted,
  trackColor,
  ringColor,
  ringFillBg,
}) {
  const total = Math.max(1, Number(taskTotalForReport) || 1);
  const done = Math.min(total, Number(taskCompletedForReport) || 0);
  const barPct = Math.min(100, Math.round((done / total) * 100));
  return (
    <View style={styles.taskCompletionRow}>
      <View style={[styles.taskRing, { borderColor: trackColor, backgroundColor: ringFillBg }]}>
        <Text style={[styles.taskRingPct, tabularNumberStyle, { color: textMain }]}>{completionRate}%</Text>
        <Text style={[styles.taskRingCaption, { color: textMuted }]}>complete</Text>
      </View>
      <View style={styles.taskCompletionRight}>
        <View style={[styles.taskProgressTrack, { backgroundColor: trackColor }]}>
          <View style={[styles.taskProgressFill, { width: `${barPct}%`, backgroundColor: ringColor }]} />
        </View>
        <Text style={[styles.taskProgressCaption, { color: textMuted }]}>
          {formatStat(done)} of {formatStat(total)} tasks finished
        </Text>
      </View>
    </View>
  );
}

export default function Dashboard() {
  const { user, token, updateUser } = useAuth();
  const { isDark } = useThemeMode();
  const router = useRouter();
  const getToken = () => token;
  const staffId = getMonitoringStaffId(user);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [reportAppsExpanded, setReportAppsExpanded] = useState(false);
  const [reportTasksExpanded, setReportTasksExpanded] = useState(false);
  const [nowTick, setNowTick] = useState(() => new Date());

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
      rawApps.map((a, index) => {
        const is_completed = Boolean(a.is_completed);
        const is_active = Boolean(a.is_active);
        const timelineStatus = canonicalApplicationTimeline({ ...a, is_completed, is_active });
        return {
          id: a.assignment_id ?? a.application_id ?? index + 1,
          trackingNo: a.tracking_no ?? a.reference_number ?? `APP-${index + 1}`,
          applicant: a.applicant ?? a.company_name ?? 'Applicant',
          timelineStatus: String(timelineStatus || 'ontime').toLowerCase(),
          stage: a.assigned_stage ?? 'Review',
          daysAllowed: Number(a.days_allowed ?? 0),
          daysTaken: Number(a.days_taken ?? 0),
          daysRemaining: Number(a.days_remaining ?? 0),
          assignmentDate: a.assignment_date ?? null,
          submissionDate: a.submission_date ?? null,
        };
      }),
    [rawApps]
  );

  const appSummary = performanceData?.applications_summary;
  const taskSummary = performanceData?.tasks_summary;
  const totalAppAssignments = performanceData?.total_app_assignments;
  const totalTasksFromApi = performanceData?.total_tasks;

  const openTasks = tasks.filter((t) => t.status !== 'completed').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const delayedApps = apps.filter((a) => a.timelineStatus === 'delayed').length;

  /** Hero + KPIs: prefer live arrays; if empty, use API summaries (same payload the web tool uses). */
  const heroAppCount = Math.max(apps.length, Number(appSummary?.total ?? 0));
  const heroOpenTasks = Math.max(openTasks, Number(taskSummary?.active ?? 0));
  const delayedAppsForKpi = apps.length > 0 ? delayedApps : Number(appSummary?.delayed ?? 0);
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

  const riskAppsLive = apps.filter((a) => a.timelineStatus === 'tobedelayed').length;
  const activeAssignmentsLive =
    rawApps.length > 0
      ? rawApps.filter((a) => Boolean(a.is_active) && !Boolean(a.is_completed)).length
      : 0;
  const appReport = {
    assignments: Math.max(heroAppCount, Number(totalAppAssignments ?? appSummary?.total ?? 0)),
    active: rawApps.length > 0 ? activeAssignmentsLive : Number(appSummary?.active ?? 0),
    completed: Number(appSummary?.completed ?? 0),
    ontime: Number(appSummary?.ontime ?? 0),
    atRisk: apps.length > 0 ? riskAppsLive : Number(appSummary?.at_risk ?? 0),
    delayed: delayedAppsForKpi,
    unique: appSummary?.unique_applications != null ? Number(appSummary.unique_applications) : null,
  };
  const taskTotalForReport =
    Number(totalTasksFromApi ?? taskSummary?.total ?? tasks.length) || tasks.length || 0;
  const taskCompletedForReport =
    taskSummary?.completed != null ? Number(taskSummary.completed) : completedTasks;

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

  const openApplications = (filterKey) => {
    if (filterKey) {
      router.push(`/(app)/applications?filter=${encodeURIComponent(filterKey)}`);
    } else {
      router.push('/(app)/applications');
    }
  };

  const goToTasks = (filterKey) => {
    router.push(`/(app)/tasks?filter=${encodeURIComponent(filterKey)}`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([performanceQuery.refetch(), notificationsQuery.refetch()]);
      setNowTick(new Date());
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

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  if (perfLoading && !performanceData && !perfErrorInfo) {
    return <AuthLoadingScreen message="Loading dashboard…" />;
  }

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
            <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
              <FriendlyErrorBanner
                info={perfErrorInfo}
                isDark={isDark}
                onRetry={() => handleRefresh()}
              />
            </View>
          </FadeInView>
        ) : null}

        <LinearGradient
          colors={isDark ? header.gradientDark : header.gradientLight}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dashboardHeader}
        >
          <View style={[styles.dashboardHeaderInner, { paddingHorizontal: spacing.md }]}>
            <Text style={[styles.dashboardHeaderKicker, { color: header.textSubtle }]}>
              Rwanda FDA · Staff workspace
            </Text>
            <View style={styles.heroTopRow}>
              <View
                style={[
                  styles.logoWrap,
                  { backgroundColor: header.iconChip, borderColor: header.iconChipBorder },
                ]}
              >
                <Image source={require('../../assets/RwandaFDA.png')} style={styles.logo} resizeMode="contain" />
              </View>
              <View style={styles.heroTextCol}>
                <Text style={[styles.heroGreeting, { color: header.text }]}>
                  {greetingForHour()}, {displayName}
                </Text>
                <Text style={[styles.heroTagline, { color: header.textMuted }]} numberOfLines={2}>
                  {user?.dutyStation
                    ? `${user.dutyStation} — applications, tasks, and alerts in one place.`
                    : 'Your monitoring hub for applications, tasks, and team alerts.'}
                </Text>
              </View>
            </View>
            <View style={styles.heroDateTimeColumn}>
              <View
                style={[
                  styles.heroDatePill,
                  {
                    alignSelf: 'stretch',
                    backgroundColor: header.iconChip,
                    borderColor: header.iconChipBorder,
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={16} color={header.textMuted} />
                <Text style={[styles.heroDateText, { color: header.text }]}>
                  {nowTick.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <View style={styles.heroTimeBlock}>
                <Text style={[styles.heroClock, { color: header.text }]}>
                  {nowTick.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={[styles.heroClockCaption, { color: header.textMuted }]}>Local time</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View
          style={[
            styles.dashboardSheet,
            {
              backgroundColor: isDark ? cardBg : colors.card,
              borderColor: isDark ? borderColor : colors.border,
            },
          ]}
        >
        <FadeInView delay={40} translateY={10}>
          <PreviewWebNotice style={{ marginBottom: 12 }} />
        </FadeInView>

        <FadeInView delay={0} translateY={8}>
          <View style={styles.quickLinksBlock}>
            <Text style={[styles.sectionEyebrow, { color: textMuted }]}>Quick links</Text>
            <View style={styles.quickLinksRow}>
              <QuickLinkCell
                icon="checkbox-outline"
                label="Tasks"
                isDark={isDark}
                textMain={textMain}
                onPress={() => goToTasks('open')}
              />
              <QuickLinkCell
                icon="document-text-outline"
                label="Applications"
                isDark={isDark}
                textMain={textMain}
                onPress={() => openApplications('')}
              />
            </View>
            <View style={styles.quickLinksRow}>
              <QuickLinkCell
                icon="notifications-outline"
                label="Alerts"
                isDark={isDark}
                textMain={textMain}
                onPress={() => router.push('/(app)/notifications')}
              />
              <QuickLinkCell
                icon="settings-outline"
                label="Settings"
                isDark={isDark}
                textMain={textMain}
                onPress={() => router.push('/(app)/settings')}
              />
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={48} translateY={10}>
          <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.kpiCardTitle, { color: textMuted }]}>Overview</Text>

            <Text style={[styles.kpiGroupLabel, { color: textMuted }]}>Applications</Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiRow}>
                <KpiTile
                  icon="folder-outline"
                  label="Assignments"
                  value={formatStat(appReport.assignments)}
                  valueColor={colors.fdaBlue}
                  textMuted={textMuted}
                  isDark={isDark}
                  bg={isDark ? 'rgba(59,130,246,0.18)' : '#e0eaff'}
                  onPress={() => openApplications('')}
                />
                <KpiTile
                  icon="pulse-outline"
                  label="In progress"
                  value={formatStat(appReport.active)}
                  valueColor={isDark ? '#c4b5fd' : '#5b21b6'}
                  textMuted={textMuted}
                  isDark={isDark}
                  bg={isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe'}
                  onPress={() => openApplications('active')}
                />
              </View>
              <View style={styles.kpiRow}>
                <KpiTile
                  icon="alert-circle-outline"
                  label="Needs attention"
                  value={formatStat(appReport.atRisk)}
                  valueColor={appReport.atRisk > 0 ? colors.warning : textMuted}
                  textMuted={textMuted}
                  isDark={isDark}
                  bg={
                    appReport.atRisk > 0
                      ? isDark
                        ? 'rgba(245,158,11,0.2)'
                        : '#fff7ed'
                      : isDark
                        ? 'rgba(148,163,184,0.12)'
                        : '#f8fafc'
                  }
                  onPress={() => openApplications('tobedelayed')}
                />
                <KpiTile
                  icon="hourglass-outline"
                  label="Behind schedule"
                  value={formatStat(appReport.delayed)}
                  valueColor={appReport.delayed > 0 ? colors.danger : textMuted}
                  textMuted={textMuted}
                  isDark={isDark}
                  bg={
                    appReport.delayed > 0
                      ? isDark
                        ? 'rgba(248,113,113,0.18)'
                        : '#ffe4e6'
                      : isDark
                        ? 'rgba(148,163,184,0.12)'
                        : '#f8fafc'
                  }
                  onPress={() => openApplications('delayed')}
                />
              </View>
            </View>

            <Text style={[styles.kpiGroupLabel, styles.kpiGroupLabelSpaced, { color: textMuted }]}>Tasks</Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiRow}>
                <KpiTile
                  icon="list-outline"
                  label="Still open"
                  value={formatStat(heroOpenTasks)}
                  valueColor={colors.fdaGreen}
                  textMuted={textMuted}
                  isDark={isDark}
                  bg={isDark ? 'rgba(16,185,129,0.22)' : '#d1fae5'}
                  onPress={() => goToTasks('open')}
                />
                <KpiTile
                  icon="pie-chart-outline"
                  label="All done"
                  value={`${formatStat(completionRate)}%`}
                  valueColor={isDark ? '#2dd4bf' : '#0f766e'}
                  textMuted={textMuted}
                  isDark={isDark}
                  bg={isDark ? 'rgba(45,212,191,0.18)' : '#ccfbf1'}
                  onPress={() => goToTasks('completed')}
                />
              </View>
              <View style={styles.kpiRow}>
                <KpiTile
                  icon="checkmark-done-outline"
                  label="Completed"
                  value={`${formatStat(taskCompletedForReport)} of ${formatStat(taskTotalForReport)}`}
                  valueColor={isDark ? '#a5b4fc' : '#4338ca'}
                  textMuted={textMuted}
                  isDark={isDark}
                  bg={isDark ? 'rgba(99,102,241,0.22)' : '#e0e7ff'}
                  dense
                  onPress={() => goToTasks('completed')}
                />
                <KpiTile
                  icon="time-outline"
                  label="Due soon"
                  value={formatStat(dueSoonTasks)}
                  valueColor={dueSoonTasks > 0 ? colors.warning : textMuted}
                  textMuted={textMuted}
                  isDark={isDark}
                  bg={
                    dueSoonTasks > 0
                      ? isDark
                        ? 'rgba(251,191,36,0.22)'
                        : '#fef3c7'
                      : isDark
                        ? 'rgba(148,163,184,0.12)'
                        : '#f8fafc'
                  }
                  onPress={() => goToTasks('due_soon')}
                />
              </View>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={55} translateY={8}>
          <Text style={[styles.reportsSectionLabel, { color: textMuted }]}>Reports</Text>
          <View style={[styles.reportCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={[styles.reportAccent, { backgroundColor: colors.fdaBlue }]} />
            <View style={styles.reportInner}>
              <PressableScale
                style={styles.reportHeadPress}
                onPress={() => setReportAppsExpanded((v) => !v)}
                hapticType="light"
              >
                <View style={styles.reportHeadRow}>
                  <View style={[styles.reportIconWrap, { backgroundColor: isDark ? 'rgba(33,77,134,0.35)' : '#e7efff' }]}>
                    <Ionicons name="document-text-outline" size={22} color={colors.fdaBlue} />
                  </View>
                  <View style={styles.reportHeadText}>
                    <Text style={[styles.reportTitle, { color: textMain }]}>Applications</Text>
                    <Text style={[styles.reportSubtitle, { color: textMuted }]}>Applications you’re working on</Text>
                  </View>
                  <Ionicons name={reportAppsExpanded ? 'chevron-up' : 'chevron-down'} size={22} color={textMuted} />
                </View>
                {!reportAppsExpanded ? (
                  <Text style={[styles.reportPeek, { color: textMuted }]}>
                    <Text style={[styles.reportPeekStrong, { color: textMain }, tabularNumberStyle]}>
                      {formatStat(appReport.assignments)}
                    </Text>
                    {' assignments · '}
                    <Text style={[styles.reportPeekStrong, { color: textMain }, tabularNumberStyle]}>
                      {formatStat(appReport.active)}
                    </Text>
                    {' active · '}
                    <Text
                      style={[
                        styles.reportPeekStrong,
                        tabularNumberStyle,
                        { color: appReport.delayed > 0 ? colors.danger : textMain },
                      ]}
                    >
                      {formatStat(appReport.delayed)}
                    </Text>
                    {' delayed · '}
                    <Text
                      style={[
                        styles.reportPeekStrong,
                        tabularNumberStyle,
                        { color: appReport.atRisk > 0 ? colors.warning : textMain },
                      ]}
                    >
                      {formatStat(appReport.atRisk)}
                    </Text>
                    {' at risk'}
                  </Text>
                ) : null}
              </PressableScale>
              {reportAppsExpanded ? (
                <>
                  <Text
                    style={[styles.reportHeroValue, tabularNumberStyle, { color: colors.fdaBlue }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatStat(appReport.assignments)}
                  </Text>
                  <Text style={[styles.reportHeroLabel, { color: textMuted }]}>Total assignments</Text>
                  <ApplicationsMixBar
                    appReport={appReport}
                    trackColor={isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0'}
                    legendColor={textMuted}
                  />
                  <View style={[styles.reportStatsList, { borderTopColor: borderColor }]}>
                    <ReportStatRow
                      icon="pulse-outline"
                      label="Active"
                      value={formatStat(appReport.active)}
                      textMain={textMain}
                      textMuted={textMuted}
                    />
                    <ReportStatRow
                      icon="checkmark-done-outline"
                      label="Completed"
                      value={formatStat(appReport.completed)}
                      textMain={textMain}
                      textMuted={textMuted}
                    />
                    <ReportStatRow
                      icon="shield-checkmark-outline"
                      label="On time"
                      value={formatStat(appReport.ontime)}
                      valueColor={colors.fdaGreen}
                      textMain={textMain}
                      textMuted={textMuted}
                    />
                    <ReportStatRow
                      icon="alert-circle-outline"
                      label="At risk"
                      value={formatStat(appReport.atRisk)}
                      valueColor={appReport.atRisk > 0 ? colors.warning : textMain}
                      textMain={textMain}
                      textMuted={textMuted}
                    />
                    <ReportStatRow
                      icon="warning-outline"
                      label="Delayed"
                      value={formatStat(appReport.delayed)}
                      valueColor={appReport.delayed > 0 ? colors.danger : textMain}
                      textMain={textMain}
                      textMuted={textMuted}
                    />
                    {appReport.unique != null && appReport.unique !== appReport.assignments ? (
                      <ReportStatRow
                        icon="document-text-outline"
                        label="Unique filings"
                        value={formatStat(appReport.unique)}
                        textMain={textMain}
                        textMuted={textMuted}
                      />
                    ) : null}
                  </View>
                </>
              ) : null}
              <PressableScale
                style={[styles.reportFooter, { borderTopColor: borderColor }]}
                onPress={() => router.push('/(app)/applications')}
                hapticType="light"
              >
                <Text style={[styles.reportFooterText, { color: colors.fdaBlue }]}>Open full report</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.fdaBlue} />
              </PressableScale>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={75} translateY={8}>
          <View style={[styles.reportCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={[styles.reportAccent, { backgroundColor: colors.fdaGreen }]} />
            <View style={styles.reportInner}>
              <PressableScale
                style={styles.reportHeadPress}
                onPress={() => setReportTasksExpanded((v) => !v)}
                hapticType="light"
              >
                <View style={styles.reportHeadRow}>
                  <View style={[styles.reportIconWrap, { backgroundColor: isDark ? greenAlpha(0.35) : colors.fdaGreenSoft }]}>
                    <Ionicons name="checkbox-outline" size={22} color={colors.fdaGreen} />
                  </View>
                  <View style={styles.reportHeadText}>
                    <Text style={[styles.reportTitle, { color: textMain }]}>Tasks</Text>
                    <Text style={[styles.reportSubtitle, { color: textMuted }]}>Your workload & deadlines</Text>
                  </View>
                  <Ionicons name={reportTasksExpanded ? 'chevron-up' : 'chevron-down'} size={22} color={textMuted} />
                </View>
                {!reportTasksExpanded ? (
                  <Text style={[styles.reportPeek, { color: textMuted }]}>
                    <Text style={[styles.reportPeekStrong, { color: colors.fdaGreen }, tabularNumberStyle]}>
                      {formatStat(heroOpenTasks)}
                    </Text>
                    {' open · '}
                    <Text style={[styles.reportPeekStrong, { color: textMain }, tabularNumberStyle]}>
                      {formatStat(completionRate)}%
                    </Text>
                    {' done · '}
                    <Text style={[styles.reportPeekStrong, { color: textMain }, tabularNumberStyle]}>
                      {formatStat(taskCompletedForReport)}
                    </Text>
                    {' / '}
                    <Text style={[styles.reportPeekStrong, { color: textMain }, tabularNumberStyle]}>
                      {formatStat(taskTotalForReport)}
                    </Text>
                    {' tasks · '}
                    <Text
                      style={[
                        styles.reportPeekStrong,
                        tabularNumberStyle,
                        { color: dueSoonTasks > 0 ? colors.warning : textMain },
                      ]}
                    >
                      {formatStat(dueSoonTasks)}
                    </Text>
                    {' due soon'}
                  </Text>
                ) : null}
              </PressableScale>
              {reportTasksExpanded ? (
                <>
                  <Text
                    style={[styles.reportHeroValue, tabularNumberStyle, { color: colors.fdaGreen }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatStat(heroOpenTasks)}
                  </Text>
                  <Text style={[styles.reportHeroLabel, { color: textMuted }]}>Open tasks</Text>
                  <TasksCompletionBlock
                    completionRate={completionRate}
                    taskCompletedForReport={taskCompletedForReport}
                    taskTotalForReport={taskTotalForReport}
                    textMain={textMain}
                    textMuted={textMuted}
                    trackColor={isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0'}
                    ringColor={colors.fdaGreen}
                    ringFillBg={isDark ? greenAlpha(0.22) : colors.fdaGreenSoft}
                  />
                  <View style={[styles.reportStatsList, { borderTopColor: borderColor }]}>
                    <ReportStatRow
                      icon="trending-up-outline"
                      label="Completion rate"
                      value={`${formatStat(completionRate)}%`}
                      valueColor={colors.fdaGreen}
                      textMain={textMain}
                      textMuted={textMuted}
                    />
                    <ReportStatRow
                      icon="checkmark-circle-outline"
                      label="Completed"
                      value={formatStat(taskCompletedForReport)}
                      textMain={textMain}
                      textMuted={textMuted}
                    />
                    <ReportStatRow
                      icon="list-outline"
                      label="Total tracked"
                      value={formatStat(taskTotalForReport)}
                      textMain={textMain}
                      textMuted={textMuted}
                    />
                    <ReportStatRow
                      icon="time-outline"
                      label="Due soon"
                      value={formatStat(dueSoonTasks)}
                      valueColor={dueSoonTasks > 0 ? colors.warning : textMain}
                      textMain={textMain}
                      textMuted={textMuted}
                    />
                  </View>
                </>
              ) : null}
              <PressableScale
                style={[styles.reportFooter, { borderTopColor: borderColor }]}
                onPress={() => router.push('/(app)/tasks')}
                hapticType="light"
              >
                <Text style={[styles.reportFooterText, { color: colors.fdaGreen }]}>Open full report</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.fdaGreen} />
              </PressableScale>
            </View>
          </View>
        </FadeInView>

        {lastSyncedAt ? (
          <FadeInView delay={85} translateY={4}>
            <Text style={[styles.syncLine, { color: textMuted }]}>
              Updated {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </FadeInView>
        ) : null}

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
                <Text style={[styles.sectionSubtitle, { color: textMuted }]}>Tap a row for more</Text>
              </View>
              <PressableScale onPress={() => router.push('/(app)/applications')} hapticType="selection">
                <Text style={styles.sectionLink}>Full list</Text>
              </PressableScale>
            </View>
            <View style={[styles.tableHead, { borderColor }]}>
              <Text style={[styles.thRef, { color: textMuted }]}>Ref</Text>
              <Text style={[styles.thStatus, { color: textMuted }]}>Status</Text>
              <Text style={[styles.thDays, { color: textMuted }]}>Days left</Text>
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
                      <Text style={[styles.rowDays, tabularNumberStyle, { color: textMain }]}>
                        {item.daysRemaining == null || Number.isNaN(Number(item.daysRemaining))
                          ? '—'
                          : formatStat(item.daysRemaining)}
                      </Text>
                    </PressableScale>
                    {expanded ? (
                      <View style={[styles.expandedBox, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor }]}>
                        <Text style={[styles.expandedTitle, { color: textMain }]} numberOfLines={2}>{item.applicant}</Text>
                        <View style={styles.expandedMetaRow}>
                          <Text style={[styles.metaLabel, { color: textMuted }]}>Stage:</Text>
                          <Text style={[styles.metaValue, { color: textMain }]}>{item.stage}</Text>
                        </View>
                        <View style={styles.expandedMetaRow}>
                          <Text style={[styles.metaLabel, { color: textMuted }]}>Days used:</Text>
                          <Text style={[styles.metaValue, { color: textMain }]}>{item.daysTaken} of {item.daysAllowed}</Text>
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
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 96, gap: 0 },
  dashboardHeader: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + spacing.sm,
  },
  dashboardHeaderInner: {
    zIndex: 1,
  },
  dashboardHeaderKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.sm + 2,
  },
  dashboardSheet: {
    marginTop: -spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md + 4,
    paddingBottom: spacing.sm,
    gap: spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow.soft,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  quickLinksBlock: { marginBottom: spacing.xs },
  quickLinksRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  quickLinkCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  quickLinkIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickLinkLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
  heroDateTimeColumn: {
    marginTop: spacing.md,
    gap: spacing.sm + 2,
  },
  heroTimeBlock: { marginTop: 2 },
  heroClock: { fontSize: 28, fontWeight: '900', letterSpacing: -0.6 },
  heroClockCaption: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, marginBottom: 2 },
  heroTextCol: { flex: 1 },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow.soft,
  },
  logo: { width: 30, height: 24 },
  heroGreeting: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4, lineHeight: 26 },
  heroTagline: { fontSize: 13, marginTop: 6, lineHeight: 19, fontWeight: '600' },
  heroDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroDateText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
  reportsSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  reportCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.sm + 2,
    ...shadow.soft,
  },
  reportAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  reportInner: { paddingLeft: spacing.md + 6, paddingRight: spacing.md, paddingTop: spacing.md, paddingBottom: 0 },
  reportHeadPress: { paddingBottom: spacing.sm },
  reportHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reportPeek: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 8,
    marginLeft: 56,
    marginRight: 8,
    lineHeight: 18,
  },
  reportPeekStrong: { fontWeight: '900', letterSpacing: -0.2 },
  kpiCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 4,
    marginBottom: spacing.sm,
    ...shadow.soft,
  },
  kpiCardTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    marginBottom: spacing.xs + 2,
  },
  kpiGroupLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: 0,
  },
  kpiGroupLabelSpaced: {
    marginTop: spacing.sm + 4,
  },
  kpiGrid: { gap: spacing.sm },
  kpiRow: { flexDirection: 'row', gap: spacing.sm },
  kpiTile: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    minHeight: 76,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  kpiTileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kpiIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTileTextCol: { flex: 1, minWidth: 0 },
  kpiTileValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.65,
    lineHeight: 26,
  },
  kpiTileValueDense: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.45,
    lineHeight: 22,
  },
  kpiTileLabel: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 3,
    lineHeight: 12,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  reportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportHeadText: { flex: 1 },
  reportTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  reportSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  reportHeroValue: { fontSize: 34, fontWeight: '900', letterSpacing: -0.8, marginTop: 14 },
  reportHeroLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  mixBarWrap: { marginTop: 16 },
  mixBarTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  mixBarSeg: { minWidth: 3 },
  mixLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    rowGap: 6,
  },
  mixLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mixLegendDot: { width: 7, height: 7, borderRadius: 3.5 },
  mixLegendText: { fontSize: 10.5, fontWeight: '800' },
  reportStatsList: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reportStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  reportStatLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 },
  reportStatLabel: { fontSize: 14, fontWeight: '700' },
  reportStatValue: { fontSize: 19, fontWeight: '900', letterSpacing: -0.45 },
  taskCompletionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
  },
  taskRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskRingPct: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  taskRingCaption: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  taskCompletionRight: { flex: 1, minWidth: 0 },
  taskProgressTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  taskProgressFill: { height: '100%', borderRadius: 5 },
  taskProgressCaption: { fontSize: 12, fontWeight: '700', marginTop: 10, lineHeight: 17 },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingRight: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reportFooterText: { fontSize: 14, fontWeight: '800' },
  syncLine: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginBottom: spacing.xs },
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
  emptyText: { fontSize: 12.5, fontWeight: '600', paddingVertical: 12 },
});
