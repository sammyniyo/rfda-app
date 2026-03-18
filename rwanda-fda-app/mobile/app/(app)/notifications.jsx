import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, PanResponder, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import { getAuthHeaders } from '../../lib/api';
import { api } from '../../constants/api';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { ListSkeleton } from '../../components/SkeletonLoader';

const NOTIFICATIONS_AUTO_REFRESH_MS = 45000;
const SWIPE_ACTION_REVEAL = 156;

function SwipeRow({ leftActions, rightActions, children }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0);

  const animateTo = (value) => {
    offsetRef.current = value;
    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        const next = Math.max(-SWIPE_ACTION_REVEAL, Math.min(SWIPE_ACTION_REVEAL, offsetRef.current + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const final = offsetRef.current + gesture.dx;
        if (final <= -60) animateTo(-SWIPE_ACTION_REVEAL);
        else if (final >= 60) animateTo(SWIPE_ACTION_REVEAL);
        else animateTo(0);
      },
      onPanResponderTerminate: () => animateTo(0),
    })
  ).current;

  return (
    <View style={styles.swipeRowWrap}>
      <View pointerEvents="box-none" style={styles.swipeActionsLayer}>
        <View style={styles.swipeActionsLeftLayer}>{leftActions}</View>
        <View style={styles.swipeActionsRightLayer}>{rightActions}</View>
      </View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function formatDayLabel(dateInput) {
  if (!dateInput) return 'Updates';
  const d = new Date(dateInput);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((start - target) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString();
}

function formatTime(dateInput) {
  if (!dateInput) return '—';
  return new Date(dateInput).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function typeTone(type) {
  const key = String(type || '').toLowerCase();
  if (key.includes('task')) return { icon: '✓', color: '#0f766e', bg: '#dbf5ef' };
  if (key.includes('app')) return { icon: '◈', color: '#1d4ed8', bg: '#e6efff' };
  if (key.includes('alert')) return { icon: '!', color: '#c2410c', bg: '#fff0e8' };
  return { icon: '•', color: colors.fdaGreen, bg: '#e7faf0' };
}

function groupNotifications(items) {
  const groups = [];
  let currentLabel = null;
  let current = null;
  for (const item of items) {
    const label = formatDayLabel(item.created_at);
    if (label !== currentLabel) {
      currentLabel = label;
      current = { label, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }
  return groups;
}

function resolveNotificationTarget(item) {
  const link = String(item?.link || '').toLowerCase();
  const type = String(item?.type || '').toLowerCase();
  const text = `${String(item?.title || '').toLowerCase()} ${String(item?.message || '').toLowerCase()}`;

  if (link.includes('task') || type.includes('task') || text.includes('task')) return '/(app)/tasks';
  if (link.includes('application') || link.includes('app') || type.includes('app')) return '/(app)/applications';
  if (link.includes('profile') || type.includes('profile')) return '/(app)/profile';
  return '/(app)';
}

export default function Notifications() {
  const { token } = useAuth();
  const getToken = () => token;
  const [refreshing, setRefreshing] = useState(false);

  const notificationsQuery = useQuery(
    async () => {
      const res = await fetch(api.notifications, { headers: getAuthHeaders(getToken) });
      if (!res.ok) throw new Error('Failed to load notifications');
      return res.json();
    },
    [token],
    { cacheKey: `notifications_${token}` }
  );
  const { data: notifications = [], loading, error } = notificationsQuery;

  const [localItems, setLocalItems] = useState([]);
  const [markingIds, setMarkingIds] = useState({});

  useEffect(() => {
    setLocalItems(Array.isArray(notifications) ? notifications : []);
  }, [notifications]);

  const items = localItems;
  const unreadCount = items.filter((n) => !n.read_at).length;
  const grouped = useMemo(() => groupNotifications(items), [items]);
  const showingCached = notificationsQuery.fromCache;
  const lastSyncedAt = notificationsQuery.lastSyncedAt;

  async function markNotificationRead(id) {
    if (!id || markingIds[id]) return;
    const previousReadAt = localItems.find((n) => n.id === id)?.read_at ?? null;
    setMarkingIds((prev) => ({ ...prev, [id]: true }));
    setLocalItems((current) =>
      current.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n))
    );
    try {
      const res = await fetch(`${api.notifications}/${id}/read`, {
        method: 'PATCH',
        headers: getAuthHeaders(getToken),
      });
      if (!res.ok) throw new Error('Failed to mark notification as read');
    } catch (err) {
      setLocalItems((current) =>
        current.map((n) => (n.id === id ? { ...n, read_at: previousReadAt } : n))
      );
      Alert.alert('Notifications', "We couldn't mark this notification as read. Please try again.", [{ text: 'OK' }]);
    } finally {
      setMarkingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function handleNotificationPress(item) {
    if (!item?.read_at && item?.id) {
      markNotificationRead(item.id);
    }
    router.push(resolveNotificationTarget(item));
  }

  function renderSwipeActions(item, side = 'right') {
    const unread = !item?.read_at;
    const canMarkRead = unread && item?.id;
    return (
      <View style={[styles.swipeActionsWrap, side === 'left' ? styles.swipeActionsLeft : styles.swipeActionsRight]}>
        {canMarkRead ? (
          <PressableScale
            style={[styles.swipeActionBtn, styles.swipeActionRead]}
            onPress={() => markNotificationRead(item.id)}
          >
            <Text style={styles.swipeActionEmoji}>✓</Text>
            <Text style={styles.swipeActionText}>Read</Text>
          </PressableScale>
        ) : (
          <View style={[styles.swipeActionBtn, styles.swipeActionReadDisabled]}>
            <Text style={styles.swipeActionEmoji}>✓✓</Text>
            <Text style={styles.swipeActionTextDisabled}>Read</Text>
          </View>
        )}
        <PressableScale
          style={[styles.swipeActionBtn, styles.swipeActionOpen]}
          onPress={() => handleNotificationPress(item)}
        >
          <Text style={styles.swipeActionEmoji}>↗</Text>
          <Text style={styles.swipeActionText}>Open</Text>
        </PressableScale>
      </View>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await notificationsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!token) return undefined;
    const intervalId = setInterval(() => {
      notificationsQuery.refetch().catch(() => {});
    }, NOTIFICATIONS_AUTO_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [token]);

  if (loading) return <ListSkeleton count={5} />;
  if (error) return <View style={styles.centered}><Text style={[styles.stateText, { color: colors.danger }]}>{error}</Text></View>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <LinearGradient colors={['#e7fff4', '#edf6ff', '#f5f7fb']} style={styles.bg} />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.fdaGreen} />}
        >
        <FadeInView delay={0} translateY={12}>
          <View style={styles.headerCard}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSub}>WhatsApp-style live updates for tasks and applications.</Text>
            </View>
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeValue}>{unreadCount}</Text>
              <Text style={styles.unreadBadgeLabel}>Unread</Text>
            </View>
          </View>
        </FadeInView>

        {(showingCached || lastSyncedAt) && (
          <FadeInView delay={40} translateY={8}>
            <View style={styles.syncPill}>
              <Text style={styles.syncPillText}>
                {showingCached ? 'Cached feed' : 'Live feed'}
                {lastSyncedAt
                  ? ` • ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : ''}
                {` • Auto ${Math.round(NOTIFICATIONS_AUTO_REFRESH_MS / 1000)}s`}
              </Text>
            </View>
          </FadeInView>
        )}

        {items.length === 0 ? (
          <FadeInView delay={100} translateY={10}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>System notifications will appear here like a secure team chat feed.</Text>
            </View>
          </FadeInView>
        ) : (
          grouped.map((group, groupIndex) => (
            <View key={group.label}>
              <FadeInView delay={90 + groupIndex * 40} translateY={8}>
                <View style={styles.daySeparatorWrap}>
                  <Text style={styles.daySeparator}>{group.label}</Text>
                </View>
              </FadeInView>

              {group.items.map((item, itemIndex) => {
                const tone = typeTone(item.type);
                const unread = !item.read_at;
                return (
                  <FadeInView
                    key={item.id ?? `${group.label}-${itemIndex}`}
                    delay={120 + groupIndex * 60 + itemIndex * 35}
                    translateY={10}
                  >
                    <SwipeRow
                      rightActions={renderSwipeActions(item, 'right')}
                      leftActions={renderSwipeActions(item, 'left')}
                    >
                      <PressableScale style={styles.row} onPress={() => handleNotificationPress(item)}>
                        <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
                          <Text style={[styles.avatarText, { color: tone.color }]}>{tone.icon}</Text>
                        </View>

                        <View style={styles.bubbleColumn}>
                          <View style={[styles.bubble, unread ? styles.bubbleUnread : styles.bubbleRead]}>
                            <View style={styles.bubbleTop}>
                              <Text style={styles.bubbleType}>{item.type || 'Notification'}</Text>
                              <Text style={styles.bubbleTime}>{formatTime(item.created_at)}</Text>
                            </View>
                            <Text style={styles.bubbleTitle}>{item.title || 'Update'}</Text>
                            <Text style={styles.bubbleMessage} numberOfLines={4}>
                              {item.message || 'No additional details available.'}
                            </Text>
                            <View style={styles.bubbleMetaRow}>
                              {unread ? <Text style={styles.newPill}>NEW</Text> : <Text style={styles.readPill}>Read</Text>}
                              <Text style={[styles.checks, unread ? styles.checksUnread : styles.checksRead]}>
                                ✓✓
                              </Text>
                              {item.link ? <Text style={styles.linkHint}>Open item</Text> : null}
                            </View>
                          </View>
                        </View>
                      </PressableScale>
                    </SwipeRow>
                  </FadeInView>
                );
              })}
            </View>
          ))
        )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  bg: { ...StyleSheet.absoluteFillObject },
  content: { padding: spacing.md, paddingBottom: 104 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  stateText: { color: colors.textMuted },
  headerCard: {
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    ...shadow.card,
  },
  headerLeft: { flex: 1 },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  headerSub: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  syncPill: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  syncPillText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  unreadBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.fdaGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  unreadBadgeLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },
  emptyCard: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow.soft,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  emptyText: { color: colors.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 6 },
  daySeparatorWrap: { alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  daySeparator: {
    backgroundColor: 'rgba(17,24,39,0.07)',
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  swipeRowWrap: { marginBottom: spacing.sm },
  swipeActionsLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  swipeActionsLeftLayer: { justifyContent: 'center' },
  swipeActionsRightLayer: { justifyContent: 'center' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  avatarText: { fontSize: 14, fontWeight: '800' },
  bubbleColumn: { flex: 1 },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    maxWidth: '100%',
  },
  bubbleUnread: {
    backgroundColor: '#ffffff',
    borderColor: '#d7efe0',
    ...shadow.soft,
  },
  bubbleRead: {
    backgroundColor: '#f9fbff',
    borderColor: colors.border,
  },
  bubbleTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'center' },
  bubbleType: { color: colors.fdaGreen, fontSize: 11, fontWeight: '800', textTransform: 'capitalize', flex: 1 },
  bubbleTime: { color: colors.textSubtle, fontSize: 11 },
  bubbleTitle: { color: colors.text, fontWeight: '800', fontSize: 14, marginTop: 4 },
  bubbleMessage: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  bubbleMetaRow: { marginTop: 8, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  newPill: {
    color: colors.fdaGreen,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: '#e7faf0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  readPill: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#f2f4f7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  linkHint: { color: colors.fdaBlue, fontSize: 11, fontWeight: '700' },
  checks: { fontSize: 11, fontWeight: '800' },
  checksUnread: { color: colors.textSubtle },
  checksRead: { color: colors.teal },
  swipeActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  swipeActionsLeft: { paddingRight: 8 },
  swipeActionsRight: { paddingLeft: 8 },
  swipeActionBtn: {
    minWidth: 66,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  swipeActionRead: {
    backgroundColor: '#e7faf0',
    borderColor: '#c8ebd8',
  },
  swipeActionReadDisabled: {
    backgroundColor: '#f2f4f7',
    borderColor: colors.border,
    opacity: 0.85,
  },
  swipeActionOpen: {
    backgroundColor: '#e8f0ff',
    borderColor: '#d7e3ff',
  },
  swipeActionEmoji: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 2 },
  swipeActionText: { fontSize: 11, fontWeight: '800', color: colors.text },
  swipeActionTextDisabled: { fontSize: 11, fontWeight: '800', color: colors.textSubtle },
});
