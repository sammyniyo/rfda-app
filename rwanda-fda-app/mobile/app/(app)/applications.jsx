import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

const FILTER_CHIPS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Done' },
  { key: 'ontime', label: 'On time' },
  { key: 'tobedelayed', label: 'At risk' },
  { key: 'delayed', label: 'Delayed' },
];

export default function Applications() {
  const { token, user } = useAuth();
  const { isDark } = useThemeMode();
  const getToken = () => token;
  const staffId = getMonitoringStaffId(user);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterKey, setFilterKey] = useState('');

  const applicationsQuery = useQuery(
    async () => {
      const { payload } = await fetchMonitoringPerformance({ staffId, token, getToken });
      const list = extractPerformanceApplications(payload);
      const data = payload?.data != null ? payload.data : {};

      return list.map((a) => ({
        id: a.application_id ?? a.assignment_id,
        reference_number: a.tracking_no,
        title: a.applicant,
        timeline_status: a.timeline_status || null,
        is_active: Boolean(a.is_active),
        is_completed: Boolean(a.is_completed),
        type: data?.filter?.application_type_label || data?.filter?.application_type || 'Application',
        submitted_at: a.submission_date,
        updated_at: a.assignment_date,
        assigned_stage: a.assigned_stage,
        days_allowed: a.days_allowed,
        days_taken: a.days_taken,
        days_remaining: a.days_remaining,
      }));
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await applicationsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

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

  if (loading && appList.length === 0 && !errorInfo) {
    return <ListSkeleton count={6} />;
  }

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

        <FadeInView delay={0} translateY={10}>
          <View style={[styles.headerCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.title, { color: textMain }]}>Applications</Text>
                <Text style={[styles.subtitle, { color: textMuted }]}>Assignments linked to your staff ID</Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: isDark ? '#0f766e33' : colors.fdaGreenSoft }]}>
                <Text style={[styles.countValue, { color: colors.fdaGreen }]}>{appList.length}</Text>
              </View>
            </View>

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

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
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

            <Text style={[styles.resultHint, { color: textMuted }]}>
              Showing {filteredList.length} of {appList.length}
            </Text>
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
        ) : filteredList.length === 0 ? (
          <FadeInView delay={80} translateY={8}>
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
              <Ionicons name="funnel-outline" size={36} color={textMuted} />
              <Text style={[styles.emptyTitle, { color: textMain }]}>No matches</Text>
              <Text style={[styles.emptyBody, { color: textMuted }]}>Try another filter or clear the search.</Text>
              <PressableScale style={styles.clearBtn} onPress={() => { setFilterKey(''); setSearch(''); }} hapticType="light">
                <Text style={styles.clearBtnText}>Reset filters</Text>
              </PressableScale>
            </View>
          </FadeInView>
        ) : (
          filteredList.map((app, index) => {
            const meta = statusMeta(app);
            const pc = pillColors(meta);
            const remaining =
              app.days_remaining == null || app.days_remaining === '' ? '—' : `${app.days_remaining}d`;

            return (
              <FadeInView key={app.id ?? index} delay={60 + index * 40} translateY={8}>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.ref, { color: colors.fdaGreen }]} numberOfLines={1}>
                        {app.reference_number || `#${app.id}`}
                      </Text>
                      <Text style={[styles.appTitle, { color: textMain }]} numberOfLines={2}>
                        {app.title || 'Application'}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: pc.bg }]}>
                      <Text style={[styles.statusText, { color: pc.fg }]}>{meta.label}</Text>
                    </View>
                  </View>

                  <View style={[styles.metricsRow, { borderTopColor: borderColor }]}>
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: textMuted }]}>Stage</Text>
                      <Text style={[styles.metricValue, { color: textMain }]} numberOfLines={1}>
                        {app.assigned_stage || '—'}
                      </Text>
                    </View>
                    <View style={[styles.metricDivider, { backgroundColor: borderColor }]} />
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: textMuted }]}>Days left</Text>
                      <Text style={[styles.metricValue, { color: textMain }]}>{remaining}</Text>
                    </View>
                    <View style={[styles.metricDivider, { backgroundColor: borderColor }]} />
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: textMuted }]}>Progress</Text>
                      <Text style={[styles.metricValue, { color: textMain }]}>
                        {app.days_allowed != null && app.days_taken != null
                          ? `${app.days_taken}/${app.days_allowed}d`
                          : '—'}
                      </Text>
                    </View>
                  </View>
                </View>
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
  headerCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    ...shadow.card,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  countBadge: {
    minWidth: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countValue: { fontSize: 20, fontWeight: '900' },
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
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 12.5, fontWeight: '800' },
  resultHint: { fontSize: 12, fontWeight: '600', marginTop: spacing.sm },
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
    borderWidth: 1,
    padding: spacing.md,
    ...shadow.soft,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  ref: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  appTitle: { fontSize: 16, fontWeight: '700', lineHeight: 21 },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '800' },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  metric: { flex: 1, alignItems: 'center' },
  metricDivider: { width: 1, height: 28 },
  metricLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  metricValue: { fontSize: 13, fontWeight: '800', marginTop: 4 },
});
