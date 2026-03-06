import { useMemo, useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import { getAuthHeaders } from '../../lib/api';
import { api } from '../../constants/api';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { ListSkeleton } from '../../components/SkeletonLoader';

// Temporary sample applications so UI looks complete while real API is built.
const FALLBACK_APPS = [
  {
    id: 101,
    reference_number: 'INV-0046',
    title: 'Market authorization renewal – Griverson Trust',
    status: 'submitted',
    type: 'Marketing Authorization',
    amount: 7650,
    submitted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 102,
    reference_number: 'PV-2026-014',
    title: 'Safety variation – new adverse event data',
    status: 'on_hold',
    type: 'Variation',
    fee_amount: 1200,
    submitted_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 103,
    reference_number: 'IP-2026-089',
    title: 'Import permit – cold chain vaccines',
    status: 'approved',
    type: 'Import Permit',
    total_amount: 980,
    submitted_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function statusMeta(status) {
  const value = String(status || 'pending');
  if (value === 'approved') return { label: 'Approved', tone: '#e7faf0', text: colors.success, progress: 100 };
  if (value === 'rejected') return { label: 'Rejected', tone: '#fdecec', text: colors.danger, progress: 100 };
  if (value === 'on_hold') return { label: 'On Hold', tone: '#fff3e5', text: colors.warning, progress: 45 };
  if (value === 'submitted') return { label: 'Submitted', tone: '#e8f0ff', text: colors.fdaBlue, progress: 35 };
  if (value === 'draft') return { label: 'Draft', tone: '#f2f4f7', text: colors.textMuted, progress: 12 };
  return { label: value.replace('_', ' '), tone: '#fff3e5', text: colors.warning, progress: 55 };
}

function formatMoney(amount) {
  const num = Number(amount);
  if (Number.isNaN(num)) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function recommendationForStatus(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'submitted' || key === 'pending') return 'Review and decide next action';
  if (key === 'on_hold') return 'Request update and assign follow-up';
  if (key === 'draft') return 'Validate submission completeness';
  if (key === 'approved') return 'Track post-approval milestones';
  if (key === 'rejected') return 'Document reason and notify applicant';
  return 'Monitor progress and update status';
}

export default function Applications() {
  const { token } = useAuth();
  const getToken = () => token;
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedAction, setSelectedAction] = useState('track');
  const [actionNote, setActionNote] = useState('');
  const [queuedActionsById, setQueuedActionsById] = useState({});

  const applicationsQuery = useQuery(
    async () => {
      try {
        const res = await fetch(api.applications, { headers: getAuthHeaders(getToken) });
        if (!res.ok) throw new Error('Failed to load applications');
        return await res.json();
      } catch {
        // While backend is not ready, fall back to local sample data.
        return FALLBACK_APPS;
      }
    },
    [token],
    { cacheKey: `applications_${token}` }
  );
  const { data: applications = [], loading, error } = applicationsQuery;

  const appList = Array.isArray(applications) ? applications : [];
  const typeOptions = useMemo(() => {
    const values = [...new Set(appList.map((a) => String(a.type || '').trim()).filter(Boolean))];
    return values.slice(0, 8);
  }, [appList]);
  const queryText = search.trim().toLowerCase();
  const filteredList = useMemo(() => {
    return appList.filter((a) => {
      const status = String(a.status || '').toLowerCase();
      const type = String(a.type || '').trim();
      if (statusFilter && status !== statusFilter) return false;
      if (typeFilter && type !== typeFilter) return false;
      if (!queryText) return true;
      const haystack = [
        a.reference_number,
        a.title,
        a.type,
        a.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(queryText);
    });
  }, [appList, statusFilter, typeFilter, queryText]);
  const filteredPendingCount = filteredList.filter((a) => ['draft', 'submitted', 'pending', 'on_hold'].includes(String(a.status))).length;
  const showingCached = applicationsQuery.fromCache;
  const lastSyncedAt = applicationsQuery.lastSyncedAt;
  const statusChips = [
    { key: '', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'approved', label: 'Approved' },
    { key: 'on_hold', label: 'On Hold' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'draft', label: 'Draft' },
  ];

  const openActionSheet = (application, action = 'track') => {
    setSelectedApp(application);
    setSelectedAction(action);
    setActionNote('');
  };

  const closeActionSheet = () => {
    setSelectedApp(null);
    setActionNote('');
  };

  const queueActionDraft = () => {
    if (!selectedApp) return;
    const appId = selectedApp.id;
    const draft = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: selectedAction,
      note: actionNote.trim() || null,
      createdAt: new Date().toISOString(),
    };
    setQueuedActionsById((prev) => ({
      ...prev,
      [appId]: [draft, ...(prev[appId] || [])].slice(0, 5),
    }));
    closeActionSheet();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await applicationsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <ListSkeleton count={6} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.fdaGreen} />}
      >
      <FadeInView delay={0} translateY={12}>
        <LinearGradient colors={['#ffffff', '#f8fbff', '#f7f7fb']} style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroTitle}>Applications</Text>
              <Text style={styles.heroSub}>Monitor staff-submitted files and approval progress.</Text>
            </View>
            <View style={styles.heroCountBubble}>
              <Text style={styles.heroCountValue}>{appList.length}</Text>
              <Text style={styles.heroCountLabel}>Total</Text>
            </View>
          </View>
          <View style={styles.miniStatsRow}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{filteredPendingCount}</Text>
              <Text style={styles.miniStatLabel}>Pending review</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{filteredList.length}</Text>
              <Text style={styles.miniStatLabel}>Visible results</Text>
            </View>
          </View>
          <View style={styles.miniStatsRow}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{Object.values(queuedActionsById).reduce((sum, list) => sum + list.length, 0)}</Text>
              <Text style={styles.miniStatLabel}>Draft actions</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{statusFilter || typeFilter ? 'ON' : 'OFF'}</Text>
              <Text style={styles.miniStatLabel}>Quick filters</Text>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by ref, title, type..."
              placeholderTextColor={colors.textSubtle}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {statusChips.map((chip) => (
              <PressableScale
                key={`status-${chip.key || 'all'}`}
                style={[styles.filterChip, statusFilter === chip.key && styles.filterChipActive]}
                onPress={() => setStatusFilter(chip.key)}
              >
                <Text style={[styles.filterChipText, statusFilter === chip.key && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>

          {typeOptions.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowSecondary}>
              <PressableScale
                style={[styles.filterChipSecondary, !typeFilter && styles.filterChipSecondaryActive]}
                onPress={() => setTypeFilter('')}
              >
                <Text style={[styles.filterChipSecondaryText, !typeFilter && styles.filterChipSecondaryTextActive]}>
                  All types
                </Text>
              </PressableScale>
              {typeOptions.map((type) => (
                <PressableScale
                  key={`type-${type}`}
                  style={[styles.filterChipSecondary, typeFilter === type && styles.filterChipSecondaryActive]}
                  onPress={() => setTypeFilter(type)}
                >
                  <Text style={[styles.filterChipSecondaryText, typeFilter === type && styles.filterChipSecondaryTextActive]}>
                    {type}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          )}
        </LinearGradient>
      </FadeInView>

      {(showingCached || lastSyncedAt) && (
        <FadeInView delay={60} translateY={8}>
          <View style={styles.syncPill}>
            <Text style={styles.syncPillText}>
              {showingCached ? 'Cached list' : 'Live list'}
              {lastSyncedAt
                ? ` • ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </Text>
          </View>
        </FadeInView>
      )}

      {appList.length === 0 ? (
        <FadeInView delay={120} translateY={10}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No applications yet</Text>
            <Text style={styles.emptyText}>Submitted applications will appear here with progress tracking.</Text>
          </View>
        </FadeInView>
      ) : (
        filteredList.length === 0 ? (
          <FadeInView delay={120} translateY={10}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No matching applications</Text>
              <Text style={styles.emptyText}>Try changing the search text or filters.</Text>
            </View>
          </FadeInView>
        ) : (
        filteredList.map((application, index) => {
          const meta = statusMeta(application.status);
          const queuedActions = queuedActionsById[application.id] || [];
          const amountText =
            formatMoney(application.amount) ||
            formatMoney(application.fee_amount) ||
            formatMoney(application.total_amount);

          return (
            <FadeInView key={application.id ?? index} delay={120 + index * 60} translateY={10}>
              <PressableScale style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.referenceText}>{application.reference_number || `#APP${String(application.id || index + 1).padStart(4, '0')}`}</Text>
                    <Text style={styles.appTitle} numberOfLines={1}>{application.title || 'Regulatory application'}</Text>
                    <Text style={styles.nextStepText} numberOfLines={1}>{recommendationForStatus(application.status)}</Text>
                  </View>
                  <Text style={[styles.statusPill, { backgroundColor: meta.tone, color: meta.text }]}>{meta.label}</Text>
                </View>

                <LinearGradient colors={['#f8fafc', '#ffffff']} style={styles.invoicePanel}>
                  <View style={styles.invoiceTop}>
                    <View>
                      <Text style={styles.invoiceLabel}>Progress</Text>
                      <Text style={styles.invoiceValue}>{meta.progress}%</Text>
                    </View>
                    <View style={styles.invoiceDivider} />
                    <View>
                      <Text style={styles.invoiceLabel}>Stage</Text>
                      <Text style={styles.invoiceValueSmall}>{meta.label}</Text>
                    </View>
                    {amountText ? (
                      <>
                        <View style={styles.invoiceDivider} />
                        <View>
                          <Text style={styles.invoiceLabel}>Fees</Text>
                          <Text style={styles.invoiceValueSmall}>{amountText}</Text>
                        </View>
                      </>
                    ) : null}
                  </View>
                  <View style={styles.progressTrack}>
                    <LinearGradient
                      colors={[colors.fdaGreen, colors.teal]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${Math.max(meta.progress, 8)}%` }]}
                    />
                  </View>
                </LinearGradient>

                <View style={styles.metaRows}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Submitted</Text>
                    <Text style={styles.metaValue}>
                      {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : '—'}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Last update</Text>
                    <Text style={styles.metaValue}>
                      {application.updated_at ? new Date(application.updated_at).toLocaleDateString() : '—'}
                    </Text>
                  </View>
                </View>

                {queuedActions.length > 0 ? (
                  <View style={styles.queuedActionBanner}>
                    <Text style={styles.queuedActionBannerText}>
                      {queuedActions.length} draft action{queuedActions.length > 1 ? 's' : ''} • Latest: {queuedActions[0].action.replace('_', ' ')}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actionsRow}>
                  {[
                    { key: 'approve', label: 'Approve' },
                    { key: 'request_update', label: 'Request Update' },
                    { key: 'comment', label: 'Comment' },
                    { key: 'assign', label: 'Assign' },
                    { key: 'track', label: 'Track' },
                  ].map((action) => (
                    <PressableScale
                      key={action.key}
                      style={[
                        styles.actionChip,
                        action.key === 'approve' && styles.actionChipApprove,
                        action.key === 'request_update' && styles.actionChipWarn,
                        action.key === 'comment' && styles.actionChipNeutral,
                      ]}
                      onPress={() => openActionSheet(application, action.key)}
                    >
                      <Text
                        style={[
                          styles.actionChipText,
                          action.key === 'approve' && styles.actionChipTextApprove,
                          action.key === 'request_update' && styles.actionChipTextWarn,
                        ]}
                      >
                        {action.label}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </PressableScale>
            </FadeInView>
          );
        }))
      )}

      <Modal
        visible={!!selectedApp}
        transparent
        animationType="fade"
        onRequestClose={closeActionSheet}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Quick Action</Text>
                <Text style={styles.modalRef}>
                  {selectedApp?.reference_number || (selectedApp ? `#APP${String(selectedApp.id).padStart(4, '0')}` : '')}
                </Text>
              </View>
              <PressableScale style={styles.modalClose} onPress={closeActionSheet}>
                <Text style={styles.modalCloseText}>×</Text>
              </PressableScale>
            </View>

            {selectedApp ? (
              <>
                <Text style={styles.modalAppTitle}>{selectedApp.title || 'Regulatory application'}</Text>
                <Text style={styles.modalHint}>{recommendationForStatus(selectedApp.status)}</Text>

                <View style={styles.modalActionTabs}>
                  {[
                    { key: 'approve', label: 'Approve' },
                    { key: 'request_update', label: 'Update' },
                    { key: 'comment', label: 'Comment' },
                    { key: 'assign', label: 'Assign' },
                    { key: 'track', label: 'Track' },
                  ].map((action) => (
                    <PressableScale
                      key={action.key}
                      style={[styles.modalActionTab, selectedAction === action.key && styles.modalActionTabActive]}
                      onPress={() => setSelectedAction(action.key)}
                    >
                      <Text style={[styles.modalActionTabText, selectedAction === action.key && styles.modalActionTabTextActive]}>
                        {action.label}
                      </Text>
                    </PressableScale>
                  ))}
                </View>

                <View style={styles.modalInfoPanel}>
                  <Text style={styles.modalInfoTitle}>Draft action summary</Text>
                  <Text style={styles.modalInfoText}>
                    {selectedAction === 'approve' && 'Prepare approval decision and finalize status update.'}
                    {selectedAction === 'request_update' && 'Request applicant corrections or missing documents.'}
                    {selectedAction === 'comment' && 'Add an internal note for review tracking.'}
                    {selectedAction === 'assign' && 'Assign or hand off this application to another reviewer.'}
                    {selectedAction === 'track' && 'Track progress and add follow-up notes for the next check-in.'}
                  </Text>
                </View>

                <TextInput
                  style={styles.modalNoteInput}
                  multiline
                  placeholder="Add note / instruction (optional)"
                  placeholderTextColor={colors.textSubtle}
                  value={actionNote}
                  onChangeText={setActionNote}
                />

                <View style={styles.modalButtonsRow}>
                  <PressableScale style={styles.modalSecondaryBtn} onPress={closeActionSheet}>
                    <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
                  </PressableScale>
                  <PressableScale style={styles.modalPrimaryBtn} onPress={queueActionDraft}>
                    <Text style={styles.modalPrimaryBtnText}>Save Draft Action</Text>
                  </PressableScale>
                </View>

                <Text style={styles.modalFooterText}>
                  UI workflow is ready. Connect backend approval endpoints next to persist these actions.
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  heroSub: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4, maxWidth: 240 },
  heroCountBubble: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCountValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  heroCountLabel: { color: colors.textMuted, fontSize: 11 },
  miniStatsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  miniStat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
  },
  miniStatValue: { color: colors.text, fontWeight: '800', fontSize: 17 },
  miniStatLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  searchWrap: {
    marginTop: spacing.md,
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  searchIcon: { width: 20, textAlign: 'center', color: colors.textMuted, fontSize: 16 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 12, marginLeft: 6 },
  filterRow: { gap: spacing.sm, marginTop: spacing.sm },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.fdaGreen, borderColor: colors.fdaGreen },
  filterChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  filterChipTextActive: { color: '#fff' },
  filterRowSecondary: { gap: spacing.sm, marginTop: spacing.sm },
  filterChipSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSecondaryActive: { backgroundColor: '#e8f0ff', borderColor: '#d7e3ff' },
  filterChipSecondaryText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  filterChipSecondaryTextActive: { color: colors.fdaBlue },
  syncPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  syncPillText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  emptyTitle: { color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 4 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.soft,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'flex-start' },
  referenceText: { color: colors.fdaBlue, fontWeight: '800', fontSize: 12, marginBottom: 4 },
  appTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  nextStepText: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  statusPill: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  invoicePanel: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 4,
  },
  invoiceTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  invoiceDivider: { width: 1, height: 28, backgroundColor: colors.border },
  invoiceLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '600' },
  invoiceValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  invoiceValueSmall: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundAlt,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
  metaRows: { marginTop: spacing.md, gap: 8 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 2,
  },
  metaLabel: { color: colors.textMuted, fontSize: 12 },
  metaValue: { color: colors.text, fontWeight: '600', fontSize: 12 },
  queuedActionBanner: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#eef7ff',
    borderWidth: 1,
    borderColor: '#d7e8ff',
  },
  queuedActionBannerText: { color: colors.fdaBlue, fontSize: 11, fontWeight: '700' },
  actionsRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionChipApprove: { backgroundColor: '#e7faf0', borderColor: '#c8ebd8' },
  actionChipWarn: { backgroundColor: '#fff6ea', borderColor: '#f5dec0' },
  actionChipNeutral: { backgroundColor: '#eef2ff', borderColor: '#dfe5ff' },
  actionChipText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  actionChipTextApprove: { color: colors.success },
  actionChipTextWarn: { color: colors.warning },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalTitle: { color: colors.text, fontWeight: '800', fontSize: 18 },
  modalRef: { color: colors.fdaBlue, fontWeight: '700', fontSize: 12, marginTop: 2 },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { color: colors.text, fontSize: 22, marginTop: -2 },
  modalAppTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  modalHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  modalActionTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  modalActionTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  modalActionTabActive: { backgroundColor: colors.fdaGreen, borderColor: colors.fdaGreen },
  modalActionTabText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  modalActionTabTextActive: { color: '#fff' },
  modalInfoPanel: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    padding: spacing.sm + 2,
  },
  modalInfoTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  modalInfoText: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  modalNoteInput: {
    marginTop: spacing.md,
    minHeight: 92,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  modalButtonsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modalSecondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    minHeight: 46,
  },
  modalSecondaryBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  modalPrimaryBtn: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.fdaGreen,
    minHeight: 46,
  },
  modalPrimaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  modalFooterText: { color: colors.textSubtle, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
});
