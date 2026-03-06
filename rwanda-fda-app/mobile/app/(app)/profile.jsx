import { useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '../../hooks/useQuery';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import { getAuthHeaders } from '../../lib/api';
import { api } from '../../constants/api';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';

async function fetchJson(url, token) {
  const res = await fetch(url, { headers: getAuthHeaders(() => token) });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

function initials(name) {
  return String(name || 'RF')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color={colors.fdaGreen} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}

function PersonHierarchyCard({ title, person, tone = 'manager' }) {
  if (!person) return null;
  const isManager = tone === 'manager';
  return (
    <View style={[styles.hPersonCard, isManager ? styles.hPersonCardManager : styles.hPersonCardReport]}>
      <View style={[styles.hAvatar, isManager ? styles.hAvatarManager : styles.hAvatarReport]}>
        <Text style={styles.hAvatarText}>{initials(person.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.hTitle}>{title}</Text>
        <Text style={styles.hName}>{person.name || 'Unknown'}</Text>
        <Text style={styles.hMeta} numberOfLines={1}>
          {[person.department, person.staff_group, person.role ? `Role ${person.role}` : null].filter(Boolean).join(' • ') || 'Rwanda FDA'}
        </Text>
        {person.email ? <Text style={styles.hMeta} numberOfLines={1}>{person.email}</Text> : null}
      </View>
    </View>
  );
}

function TeamMemberCard({ member }) {
  return (
    <View style={styles.teamCard}>
      <View style={styles.teamCardTop}>
        <View style={styles.teamAvatar}><Text style={styles.teamAvatarText}>{initials(member.name)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.teamName} numberOfLines={1}>{member.name}</Text>
          <Text style={styles.teamMeta} numberOfLines={1}>{member.department || 'Rwanda FDA'}</Text>
        </View>
      </View>
      <View style={styles.teamStatsRow}>
        <View style={styles.teamStat}><Text style={styles.teamStatValue}>{member.pending_tasks ?? 0}</Text><Text style={styles.teamStatLabel}>Open Tasks</Text></View>
        <View style={styles.teamStat}><Text style={styles.teamStatValue}>{member.total_applications ?? 0}</Text><Text style={styles.teamStatLabel}>Apps</Text></View>
      </View>
    </View>
  );
}

export default function Profile() {
  const { token, user, loading: authLoading, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const tasksQuery = useQuery(() => fetchJson(api.tasks, token).catch(() => []), [token], { cacheKey: `tasks_${token}` });
  const applicationsQuery = useQuery(() => fetchJson(api.applications, token).catch(() => []), [token], { cacheKey: `applications_${token}` });
  const notificationsQuery = useQuery(() => fetchJson(api.notifications, token).catch(() => []), [token], { cacheKey: `notifications_${token}` });
  const { data: tasks = [] } = tasksQuery;
  const { data: applications = [] } = applicationsQuery;
  const { data: notifications = [] } = notificationsQuery;

  const profile = user || null;

  if (authLoading && !profile) {
    return <View style={styles.centered}><Text style={styles.stateText}>Loading profile…</Text></View>;
  }
  if (!profile) {
    return <View style={styles.centered}><Text style={styles.stateText}>Profile not available.</Text></View>;
  }

  const taskList = Array.isArray(tasks) ? tasks : [];
  const appList = Array.isArray(applications) ? applications : [];
  const notifList = Array.isArray(notifications) ? notifications : [];
  const directReports = Array.isArray(profile.direct_reports) ? profile.direct_reports : [];

  const pendingTasks = taskList.filter((t) => t.status !== 'completed').length;
  const completedTasks = taskList.filter((t) => t.status === 'completed').length;
  const unreadNotifications = notifList.filter((n) => !n.read_at).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        tasksQuery.refetch(),
        applicationsQuery.refetch(),
        notificationsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.fdaGreen} />}
      >
      <FadeInView delay={0} translateY={14}>
        <LinearGradient colors={['#ffffff', '#f8fbff', '#effaf4']} style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogoWrap}>
                <Image source={require('../../assets/RwandaFDA.png')} style={styles.brandLogo} resizeMode="contain" />
              </View>
              <View>
                <Text style={styles.brandTitle}>Profile</Text>
                <Text style={styles.brandSub} numberOfLines={1}>
                  {profile.dutyStation || profile.department || 'Rwanda FDA'}
                </Text>
              </View>
            </View>
            <View style={styles.heroActionsRow}>
              <PressableScale style={styles.iconPill} onPress={() => router.push('/(app)/settings')}>
                <Ionicons name="settings-outline" size={17} color={colors.text} />
              </PressableScale>
              <PressableScale style={styles.signOutIconBtn} onPress={logout}>
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              </PressableScale>
            </View>
          </View>

          <View style={styles.heroTopRow}>
            <View style={styles.avatarShell}>
              <LinearGradient colors={[colors.fdaGreen, colors.teal]} style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(profile.name)}</Text>
              </LinearGradient>
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.nameText} numberOfLines={2}>{profile.name || 'RFDA Staff'}</Text>
              <Text style={styles.roleText} numberOfLines={1}>
                {profile.position || profile.staff_position || profile.role || 'Staff member'}
              </Text>
              <Text style={styles.smallSubText} numberOfLines={1}>{profile.email || 'No work email'}</Text>
            </View>
          </View>

          <View style={styles.statsCardsRow}>
            <View style={[styles.statCard, { backgroundColor: '#e8f0ff', borderColor: 'rgba(33,77,134,0.14)' }]}>
              <Text style={styles.statValue}>{appList.length}</Text>
              <Text style={styles.statLabel}>Applications</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#e7faf0', borderColor: 'rgba(15,94,71,0.14)' }]}>
              <Text style={styles.statValue}>{pendingTasks}</Text>
              <Text style={styles.statLabel}>Open tasks</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#fff6ea', borderColor: 'rgba(217,119,6,0.14)' }]}>
              <Text style={styles.statValue}>{unreadNotifications}</Text>
              <Text style={styles.statLabel}>Unread</Text>
            </View>
          </View>
        </LinearGradient>
      </FadeInView>

      <FadeInView delay={90} translateY={10}>
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>My details</Text>
            <View style={styles.panelChip}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.fdaGreen} />
              <Text style={styles.panelChipText}>Verified</Text>
            </View>
          </View>
          <InfoRow icon="mail-outline" label="Work email" value={profile.email} />
          <InfoRow icon="call-outline" label="Phone" value={profile.phone} />
          <InfoRow icon="business-outline" label="Duty station" value={profile.dutyStation || profile.department} />
          <InfoRow icon="people-outline" label="Staff group" value={profile.group} />
        </View>
      </FadeInView>

      <FadeInView delay={160} translateY={10}>
        <View style={styles.panel}>
          <DetailRow label="Personal email" value={profile.personal_email} />
          <Text style={[styles.panelTitle, { marginTop: spacing.md }]}>More</Text>
          <DetailRow label="Degree" value={profile.degree} />
          <DetailRow label="Hire date" value={profile.hireDate ? new Date(profile.hireDate).toLocaleDateString() : null} />
        </View>
      </FadeInView>

      <FadeInView delay={220} translateY={10}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>My snapshot</Text>
          <View style={styles.metricRow}><Text style={styles.metricLabel}>Completed tasks</Text><Text style={styles.metricValue}>{completedTasks}</Text></View>
          <View style={styles.metricRow}><Text style={styles.metricLabel}>Open tasks</Text><Text style={styles.metricValue}>{pendingTasks}</Text></View>
          <View style={styles.metricRow}><Text style={styles.metricLabel}>Applications in my queue</Text><Text style={styles.metricValue}>{appList.length}</Text></View>
          <View style={styles.metricRow}><Text style={styles.metricLabel}>Unread notifications</Text><Text style={styles.metricValue}>{unreadNotifications}</Text></View>
        </View>
      </FadeInView>
      
      <FadeInView delay={260} translateY={10}>
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>Staff hierarchy</Text>
            <Text style={styles.hintRightText}>{directReports.length} reports</Text>
          </View>

          {profile.reports_to ? (
            <PersonHierarchyCard title="Reports To" person={profile.reports_to} tone="manager" />
          ) : (
            <View style={styles.hEmptyCard}><Text style={styles.hEmptyText}>No manager found.</Text></View>
          )}

          <View style={styles.directReportsHeader}>
            <Text style={styles.directReportsTitle}>Direct reports</Text>
            <Text style={styles.directReportsCount}>{directReports.length}</Text>
          </View>

          {directReports.length === 0 ? (
            <View style={styles.hEmptyCard}><Text style={styles.hEmptyText}>No staff currently reporting to you.</Text></View>
          ) : (
            directReports.slice(0, 6).map((member) => <TeamMemberCard key={member.staff_id || member.user_id || member.email} member={member} />)
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
  content: { padding: spacing.md, paddingBottom: 112, gap: spacing.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  stateText: { color: colors.textMuted },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  heroHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  brandLogoWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  brandLogo: { width: 30, height: 24 },
  brandTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  brandSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  heroActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTopRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  avatarShell: { borderRadius: radius.lg, padding: 3, backgroundColor: '#eef6f4' },
  avatar: { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  heroTextWrap: { flex: 1 },
  nameText: { color: colors.text, fontSize: 18, fontWeight: '900' },
  roleText: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: '700' },
  smallSubText: { color: colors.textSubtle, fontSize: 11.5, marginTop: 4, fontWeight: '600' },
  statsCardsRow: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 3, textAlign: 'center' },
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.soft,
  },
  panelHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm },
  panelTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  panelSub: { color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: spacing.sm },
  panelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e7faf0',
    borderWidth: 1,
    borderColor: 'rgba(15,94,71,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  panelChipText: { color: colors.fdaGreen, fontWeight: '900', fontSize: 11 },
  hintRightText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#e7faf0',
    borderWidth: 1,
    borderColor: 'rgba(15,94,71,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '800' },
  infoValue: { color: colors.text, fontSize: 13.5, fontWeight: '700', marginTop: 2 },
  hPersonCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
    alignItems: 'center',
  },
  hPersonCardManager: { backgroundColor: '#f6fbff', borderColor: '#dfeafb' },
  hPersonCardReport: { backgroundColor: '#fbfffd', borderColor: '#d7efe0' },
  hAvatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hAvatarManager: { backgroundColor: '#e8f0ff' },
  hAvatarReport: { backgroundColor: '#e7faf0' },
  hAvatarText: { color: colors.text, fontWeight: '800' },
  hTitle: { color: colors.textSubtle, fontSize: 11, fontWeight: '700' },
  hName: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 2 },
  hMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  hConnector: { alignItems: 'center', paddingVertical: 8 },
  hLine: { width: 2, height: 10, backgroundColor: colors.border },
  hNode: {
    marginVertical: 2,
    backgroundColor: colors.fdaGreen,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hNodeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  directReportsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: 8 },
  directReportsTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  directReportsCount: {
    color: colors.fdaGreen,
    backgroundColor: colors.fdaGreenSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
  },
  hEmptyCard: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardSoft, padding: spacing.sm + 2 },
  hEmptyText: { color: colors.textMuted, fontSize: 12 },
  teamCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    padding: spacing.sm + 2,
    marginTop: 8,
  },
  teamCardTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  teamAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eef6f4', alignItems: 'center', justifyContent: 'center' },
  teamAvatarText: { color: colors.fdaGreen, fontWeight: '800', fontSize: 12 },
  teamName: { color: colors.text, fontWeight: '700', fontSize: 13 },
  teamMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  teamStatsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 8 },
  teamStat: { flex: 1, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, paddingVertical: 8, alignItems: 'center' },
  teamStatValue: { color: colors.text, fontWeight: '800', fontSize: 14 },
  teamStatLabel: { color: colors.textSubtle, fontSize: 10, marginTop: 2 },
  detailRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  detailLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metricLabel: { color: colors.textMuted, fontSize: 13, flex: 1 },
  metricValue: { color: colors.text, fontWeight: '800', fontSize: 14 },
});
