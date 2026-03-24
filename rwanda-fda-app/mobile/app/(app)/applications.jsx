import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import { extractPerformanceApplications, fetchMonitoringPerformance } from '../../lib/monitoringPerformance';
import { getMonitoringStaffId } from '../../lib/staffSession';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { ListSkeleton } from '../../components/SkeletonLoader';
import FriendlyErrorBanner from '../../components/FriendlyErrorBanner';

function statusMeta(app) {
  const timeline = String(app.timeline_status || '').toLowerCase();
  if (app.is_completed) {
    return { label: 'Completed', fg: colors.success, bg: 'completed' };
  }
  if (timeline === 'delayed') return { label: 'Delayed', fg: colors.danger, bg: 'delayed' };
  if (timeline === 'tobedelayed') return { label: 'At risk', fg: colors.warning, bg: 'risk' };
  if (timeline === 'ontime') return { label: 'On time', fg: colors.success, bg: 'ontime' };
  return { label: app.is_active ? 'Active' : 'Assigned', fg: colors.fdaBlue, bg: 'active' };
}

function statusAccent(meta) {
  if (meta.bg === 'delayed') return colors.danger;
  if (meta.bg === 'risk') return colors.warning;
  if (meta.bg === 'ontime' || meta.bg === 'completed') return colors.success;
  return colors.fdaBlue;
}

const FILTER_CHIPS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Done' },
  { key: 'ontime', label: 'On time' },
  { key: 'tobedelayed', label: 'At risk' },
  { key: 'delayed', label: 'Delayed' },
];

function formatShortDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Normalize API timeline strings and derive from SLA when the backend omits or aliases `timeline_status`. */
function canonicalApplicationTimeline(a) {
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

export default function Applications() {
  const { token, user } = useAuth();
  const { isDark } = useThemeMode();
  const getToken = () => token;
  const staffId = getMonitoringStaffId(user);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterKey, setFilterKey] = useState('');
  const [expandedApps, setExpandedApps] = useState({});
  const applicationsQuery = useQuery(
    async () => {
      const { payload } = await fetchMonitoringPerformance({ staffId, token, getToken });
      const list = extractPerformanceApplications(payload);
      const data = payload?.data != null ? payload.data : {};

      return list.map((a, idx) => {
        const is_completed = Boolean(a.is_completed);
        const is_active = Boolean(a.is_active);
        const timeline_status = canonicalApplicationTimeline({
          ...a,
          is_completed,
          is_active,
        });
        return {
        // assignment_id is unique per row; application_id repeats across reassignments — duplicate keys crashed the list
        rowKey: String(a.assignment_id ?? `row-${a.application_id ?? 'x'}-${idx}`),
        application_id: a.application_id,
        assignment_id: a.assignment_id,
        reference_number: a.tracking_no,
        title: a.applicant,
        timeline_status,
        is_active,
        is_completed,
        type: data?.filter?.application_type_label || data?.filter?.application_type || 'Application',
        submitted_at: a.submission_date,
        updated_at: a.assignment_date,
        assigned_stage: a.assigned_stage,
        days_allowed: a.days_allowed,
        days_taken: a.days_taken,
        days_remaining: a.days_remaining,
      };
      });
    },
    [token, staffId]
    // No SecureStore cache: full applications list exceeds typical SecureStore limits; stale empty cache showed as 0 items.
  );

  const { data: applications = [], loading, errorInfo } = applicationsQuery;
  const appList = Array.isArray(applications) ? applications : [];

  const queryText = search.trim().toLowerCase();
  const filteredList = useMemo(() => {
    return appList.filter((a) => {
      const timeline = String(a.timeline_status || '').toLowerCase();

      if (filterKey === 'active') {
        if (!a.is_active || a.is_completed) return false;
      } else if (filterKey === 'completed') {
        if (!a.is_completed) return false;
      } else if (filterKey === 'ontime' || filterKey === 'tobedelayed' || filterKey === 'delayed') {
        // Timeline chips reflect active workload only — completed rows stay under "Done" / "All".
        if (a.is_completed) return false;
        if (!a.is_active) return false;
        if (timeline !== filterKey) return false;
      }

      if (!queryText) return true;
      const haystack = [a.reference_number, a.title, a.type, a.assigned_stage, timeline]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(queryText);
    });
  }, [appList, filterKey, queryText]);

  const listSummary = useMemo(() => {
    let active = 0;
    let done = 0;
    let atRisk = 0;
    let delayed = 0;
    for (const a of appList) {
      if (a.is_completed) done += 1;
      else if (a.is_active) active += 1;
      if (a.is_completed || !a.is_active) continue;
      const tl = String(a.timeline_status || '').toLowerCase();
      if (tl === 'tobedelayed') atRisk += 1;
      if (tl === 'delayed') delayed += 1;
    }
    return { total: appList.length, active, done, atRisk, delayed, issues: atRisk + delayed };
  }, [appList]);

  const pageBg = isDark ? '#0b1220' : colors.background;
  const cardBg = isDark ? '#111827' : colors.card;
  const borderColor = isDark ? 'rgba(148,163,184,0.2)' : colors.border;
  const textMain = isDark ? '#f8fafc' : colors.text;
  const textMuted = isDark ? '#94a3b8' : colors.textMuted;
  const inputBg = isDark ? '#0f172a' : colors.card;
  const chipInactiveBg = isDark ? '#1e293b' : colors.card;
  const chipInactiveBorder = borderColor;

  function pillColors(meta) {
    if (meta.bg === 'delayed') return { bg: isDark ? '#3f1d24' : '#fff1f2', fg: meta.fg };
    if (meta.bg === 'risk') return { bg: isDark ? '#3a2a12' : '#fff7ed', fg: meta.fg };
    if (meta.bg === 'ontime' || meta.bg === 'completed') return { bg: isDark ? '#132a22' : '#ecfdf5', fg: meta.fg };
    return { bg: isDark ? '#1a2744' : '#eff6ff', fg: meta.fg };
  }

  const refetchRef = useRef(applicationsQuery.refetch);
  refetchRef.current = applicationsQuery.refetch;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchRef.current();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const renderItem = useCallback(
    ({ item: app }) => {
      const meta = statusMeta(app);
      const pc = pillColors(meta);
      const accent = statusAccent(meta);
      const remaining =
        app.days_remaining == null || app.days_remaining === '' ? '—' : `${app.days_remaining}d`;
      const progress =
        app.days_allowed != null && app.days_taken != null ? `${app.days_taken} / ${app.days_allowed} d` : '—';
      const borderSubtle = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)';
      const open = Boolean(expandedApps[app.rowKey]);
      const submitted = formatShortDate(app.submitted_at);
      const updated = formatShortDate(app.updated_at);
      const previewLine = `${app.assigned_stage || '—'} · ${remaining} left`;

      return (
        <PressableScale
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor,
            },
          ]}
          onPress={() => setExpandedApps((prev) => ({ ...prev, [app.rowKey]: !prev[app.rowKey] }))}
          hapticType="light"
        >
          <View style={styles.cardMain}>
            <View style={styles.cardTop}>
              <View style={styles.cardTitleBlock}>
                <Text style={[styles.ref, { color: accent }]} numberOfLines={1}>
                  {app.reference_number || `#${app.application_id ?? app.assignment_id}`}
                </Text>
                <Text style={[styles.appTitle, { color: textMain }]} numberOfLines={open ? 3 : 1}>
                  {app.title || 'Application'}
                </Text>
              </View>
              <View style={styles.cardTopRight}>
                <View style={[styles.statusPill, { backgroundColor: pc.bg }]}>
                  <Text style={[styles.statusText, { color: pc.fg }]}>{meta.label}</Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={textMuted} />
              </View>
            </View>

            {!open ? (
              <Text style={[styles.cardPreviewLine, { color: textMuted }]} numberOfLines={1}>
                {previewLine}
              </Text>
            ) : (
              <>
                <Text style={[styles.typeLine, { color: textMuted }]} numberOfLines={2}>
                  {app.type || 'Application'}
                </Text>
                <View style={[styles.metaGrid, { borderTopColor: borderSubtle }]}>
                  <View style={styles.metaCell}>
                    <Text style={[styles.metaLabel, { color: textMuted }]}>Stage</Text>
                    <Text style={[styles.metaValue, { color: textMain }]} numberOfLines={3}>
                      {app.assigned_stage || '—'}
                    </Text>
                  </View>
                  <View style={[styles.metaCell, styles.metaCellBorder, { borderLeftColor: borderSubtle }]}>
                    <Text style={[styles.metaLabel, { color: textMuted }]}>SLA</Text>
                    <Text style={[styles.metaValue, { color: textMain }]}>{remaining} left</Text>
                  </View>
                  <View style={[styles.metaCell, styles.metaCellBorder, { borderLeftColor: borderSubtle }]}>
                    <Text style={[styles.metaLabel, { color: textMuted }]}>Progress</Text>
                    <Text style={[styles.metaValue, { color: textMain }]}>{progress}</Text>
                  </View>
                </View>
                {(submitted || updated) && (
                  <View style={[styles.expandedDates, { borderTopColor: borderSubtle }]}>
                    {submitted ? (
                      <Text style={[styles.expandedDateLine, { color: textMuted }]}>
                        <Text style={styles.expandedDateLabel}>Submitted </Text>
                        {submitted}
                      </Text>
                    ) : null}
                    {updated ? (
                      <Text style={[styles.expandedDateLine, { color: textMuted }]}>
                        <Text style={styles.expandedDateLabel}>Assignment </Text>
                        {updated}
                      </Text>
                    ) : null}
                  </View>
                )}
              </>
            )}
          </View>
        </PressableScale>
      );
    },
    [borderColor, cardBg, expandedApps, isDark, textMain, textMuted]
  );

  const keyExtractor = useCallback((item) => item.rowKey, []);

  const listHeader = useMemo(
    () => (
      <>
        {errorInfo ? (
          <FriendlyErrorBanner info={errorInfo} onRetry={handleRefresh} isDark={isDark} />
        ) : null}

        <FadeInView delay={0} translateY={10}>
          <View style={[styles.headerCard, { borderColor, backgroundColor: cardBg }]}>
            <View style={styles.headerCardInner}>
              <View style={styles.headerTitleRow}>
                <Text style={[styles.title, { color: textMain }]}>Applications</Text>
                <View style={[styles.countPill, { backgroundColor: isDark ? '#1e293b' : '#ecfdf5', borderColor }]}>
                  <Text style={[styles.countPillText, { color: colors.fdaGreen }]}>{listSummary.total}</Text>
                </View>
              </View>
              <Text style={[styles.summaryLine, { color: textMuted }]}>
                {listSummary.active} active · {listSummary.done} done · {listSummary.issues} need attention
              </Text>
              <Text style={[styles.subtitle, { color: textMuted }]}>
                {filteredList.length} shown after search & filters
              </Text>

              <View style={[styles.searchWrap, { backgroundColor: inputBg, borderColor }]}>
                <Ionicons name="search-outline" size={20} color={textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: textMain }]}
                  placeholder="Search reference, applicant, stage…"
                  placeholderTextColor={textMuted}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 ? (
                  <PressableScale onPress={() => setSearch('')} hapticType="light">
                    <Ionicons name="close-circle" size={22} color={textMuted} />
                  </PressableScale>
                ) : null}
              </View>

              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}
              >
                {FILTER_CHIPS.map((chip) => {
                  const active = filterKey === chip.key;
                  return (
                    <PressableScale
                      key={chip.key || 'all'}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? colors.fdaGreen : chipInactiveBg,
                          borderColor: active ? colors.fdaGreen : chipInactiveBorder,
                        },
                      ]}
                      onPress={() => setFilterKey(chip.key)}
                      hapticType="selection"
                    >
                      <Text style={[styles.chipText, { color: active ? '#fff' : textMuted }]}>{chip.label}</Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </FadeInView>

        {appList.length === 0 && !errorInfo ? (
          <FadeInView delay={80} translateY={8}>
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
              <Ionicons name="document-text-outline" size={40} color={textMuted} />
              <Text style={[styles.emptyTitle, { color: textMain }]}>No applications yet</Text>
              <Text style={[styles.emptyBody, { color: textMuted }]}>
                When assignments are linked to your account, they will appear here.
              </Text>
            </View>
          </FadeInView>
        ) : null}
      </>
    ),
    [
      errorInfo,
      isDark,
      handleRefresh,
      cardBg,
      borderColor,
      textMain,
      textMuted,
      inputBg,
      chipInactiveBg,
      chipInactiveBorder,
      appList.length,
      filteredList.length,
      search,
      filterKey,
      listSummary,
    ]
  );

  if (loading && appList.length === 0 && !errorInfo) {
    return <ListSkeleton count={6} />;
  }

  const listEmpty =
    appList.length > 0 && filteredList.length === 0 ? (
      <FadeInView delay={0} translateY={6}>
        <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
          <Ionicons name="funnel-outline" size={36} color={textMuted} />
          <Text style={[styles.emptyTitle, { color: textMain }]}>No matches</Text>
          <Text style={[styles.emptyBody, { color: textMuted }]}>Try another filter or clear the search.</Text>
          <PressableScale style={styles.clearBtn} onPress={() => { setFilterKey(''); setSearch(''); }} hapticType="light">
            <Text style={styles.clearBtnText}>Reset filters</Text>
          </PressableScale>
        </View>
      </FadeInView>
    ) : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]} edges={['top', 'left', 'right']}>
      <FlatList
        data={filteredList}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        style={[styles.container, { backgroundColor: pageBg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.fdaGreen} />}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={8}
        removeClippedSubviews={Platform.OS === 'android'}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 104, flexGrow: 1 },
  content: { padding: spacing.md, paddingBottom: 104, gap: spacing.sm },
  headerCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.sm + 2,
    ...shadow.card,
  },
  headerCardInner: {
    padding: spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4, flex: 1 },
  countPill: {
    minWidth: 40,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
  },
  countPillText: { fontSize: 15, fontWeight: '900' },
  summaryLine: { fontSize: 13, fontWeight: '700', marginTop: spacing.sm, lineHeight: 18 },
  subtitle: { fontSize: 12, marginTop: 6, lineHeight: 17, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: spacing.sm + 4, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 12.5, fontWeight: '800' },
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
  clearBtn: { marginTop: spacing.sm, paddingVertical: 10, paddingHorizontal: 16 },
  clearBtnText: { color: colors.fdaGreen, fontWeight: '800', fontSize: 14 },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow.card,
  },
  cardMain: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, minWidth: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  cardTitleBlock: { flex: 1, minWidth: 0, paddingRight: 4 },
  cardTopRight: { alignItems: 'flex-end', gap: 6 },
  ref: { fontSize: 11.5, fontWeight: '900', letterSpacing: 0.2, marginBottom: 4 },
  appTitle: { fontSize: 16, fontWeight: '800', lineHeight: 22, letterSpacing: -0.2 },
  cardPreviewLine: { fontSize: 12.5, fontWeight: '600', marginTop: 8 },
  typeLine: { fontSize: 12, fontWeight: '600', marginTop: 10 },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, alignSelf: 'flex-end' },
  statusText: { fontSize: 11, fontWeight: '800' },
  metaGrid: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaCell: { flex: 1, minWidth: 0, paddingRight: 6 },
  metaCellBorder: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 10, paddingRight: 0 },
  metaLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  metaValue: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  expandedDates: {
    marginTop: spacing.sm + 4,
    paddingTop: spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  expandedDateLine: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  expandedDateLabel: { fontWeight: '800' },
});
