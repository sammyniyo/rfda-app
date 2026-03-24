import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import { getAuthHeaders } from '../../lib/api';
import { api } from '../../constants/api';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { ListSkeleton } from '../../components/SkeletonLoader';
import { useThemeMode } from '../../context/ThemeContext';
import FriendlyErrorBanner from '../../components/FriendlyErrorBanner';
import { hapticTap } from '../../lib/haptics';
import {
  deleteNotificationOnServer,
  fetchNotificationsPage,
  loadDismissedIds,
  mergeNotificationsById,
  persistDismissedIds,
} from '../../lib/notificationsFeed';

const NOTIFICATIONS_AUTO_REFRESH_MS = 45000;
const PAGE_SIZE = 25;

function formatDayLabel(dateInput) {
  if (!dateInput) return 'Updates';
  const d = new Date(dateInput);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((start - target) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(dateInput) {
  if (!dateInput) return '';
  return new Date(dateInput).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(dateInput) {
  if (!dateInput) return '';
  const t = new Date(dateInput).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return '';
}

function groupNotifications(items) {
  const groups = [];
  let label = null;
  let current = null;
  for (const item of items) {
    const day = formatDayLabel(item.created_at);
    if (day !== label) {
      label = day;
      current = { label: day, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }
  return groups;
}

function notificationKind(item) {
  const text = `${String(item?.link || '').toLowerCase()} ${String(item?.type || '').toLowerCase()} ${String(
    item?.title || ''
  ).toLowerCase()} ${String(item?.message || '').toLowerCase()}`;
  if (text.includes('task')) return 'task';
  if (text.includes('application') || text.includes('app')) return 'application';
  if (text.includes('alert') || text.includes('meeting') || text.includes('reminder')) return 'alert';
  if (text.includes('profile')) return 'profile';
  return 'update';
}

function kindLabel(kind) {
  if (kind === 'task') return 'Task';
  if (kind === 'application') return 'Application';
  if (kind === 'alert') return 'Alert';
  if (kind === 'profile') return 'Profile';
  return 'Update';
}

function kindMeta(kind, isDark) {
  if (kind === 'task')
    return { ion: 'checkbox-outline', color: colors.fdaGreen, bg: isDark ? 'rgba(15,94,71,0.35)' : '#dff7ee' };
  if (kind === 'application')
    return { ion: 'document-text-outline', color: colors.fdaBlue, bg: isDark ? 'rgba(33,77,134,0.4)' : '#e7efff' };
  if (kind === 'alert')
    return { ion: 'warning-outline', color: colors.warning, bg: isDark ? 'rgba(217,119,6,0.25)' : '#fff0e8' };
  if (kind === 'profile')
    return { ion: 'person-outline', color: '#94a3b8', bg: isDark ? 'rgba(148,163,184,0.15)' : '#eef2ff' };
  return { ion: 'notifications-outline', color: colors.fdaGreen, bg: isDark ? 'rgba(15,94,71,0.25)' : '#e7faf0' };
}

function resolveTarget(item) {
  const kind = notificationKind(item);
  if (kind === 'task') return '/(app)/tasks';
  if (kind === 'application') return '/(app)/applications';
  if (kind === 'profile') return '/(app)/profile';
  return '/(app)/notifications';
}

const FILTER_CHIPS = [
  { key: 'all', label: 'All', ion: 'apps-outline' },
  { key: 'task', label: 'Tasks', ion: 'checkbox-outline' },
  { key: 'application', label: 'Apps', ion: 'document-text-outline' },
  { key: 'alert', label: 'Alerts', ion: 'alert-circle-outline' },
];

function authHeaderPairs(token) {
  const tokenValue = String(token);
  return {
    bearer: { ...getAuthHeaders(() => token), Authorization: `Bearer ${tokenValue}` },
    raw: { ...getAuthHeaders(() => token), Authorization: tokenValue },
  };
}

async function fetchNotificationsAuthed(token, queryOpts) {
  const { bearer, raw } = authHeaderPairs(token);
  let result = await fetchNotificationsPage({ ...queryOpts, headers: bearer });
  if (result.status === 401 || result.status === 403) {
    result = await fetchNotificationsPage({ ...queryOpts, headers: raw });
  }
  return result;
}

function NotificationRow({ item, styles, isDark, onOpen, onMarkRead, onArchive, onDelete, markingIds }) {
  const swipeRef = useRef(null);
  const kind = notificationKind(item);
  const meta = kindMeta(kind, isDark);
  const unread = !item.read_at;
  const rel = formatRelative(item.created_at);

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      overshootRight={false}
      overshootLeft={false}
      renderRightActions={() => (
        <View style={styles.swipeActionsRight}>
          <TouchableOpacity
            onPress={() => {
              swipeRef.current?.close();
              void hapticTap();
              onArchive(item);
            }}
            style={[styles.swipeActionCol, styles.swipeArchive]}
            accessibilityRole="button"
            accessibilityLabel="Archive notification"
          >
            <Ionicons name="archive-outline" size={22} color="#fff" />
            <Text style={styles.swipeActionText}>Archive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              swipeRef.current?.close();
              void hapticTap();
              onDelete(item);
            }}
            style={[styles.swipeActionCol, styles.swipeDelete]}
            accessibilityRole="button"
            accessibilityLabel="Delete notification"
          >
            <Ionicons name="trash-outline" size={22} color="#fff" />
            <Text style={styles.swipeActionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      renderLeftActions={
        unread
          ? () => (
              <View style={styles.swipeActionsLeft}>
                <TouchableOpacity
                  onPress={() => {
                    swipeRef.current?.close();
                    void hapticTap();
                    onMarkRead(item.id);
                  }}
                  style={[styles.swipeActionCol, styles.swipeRead]}
                  accessibilityRole="button"
                  accessibilityLabel="Mark as read"
                >
                  <Ionicons name="checkmark-done-outline" size={22} color="#fff" />
                  <Text style={styles.swipeActionText}>Read</Text>
                </TouchableOpacity>
              </View>
            )
          : undefined
      }
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => onOpen(item)}
        style={[styles.row, unread && styles.rowUnread]}
      >
        {unread ? <View style={styles.unreadBar} /> : <View style={styles.readBarSpacer} />}
        <View style={[styles.avatarRing, { borderColor: meta.color }]}>
          <View style={[styles.rowAvatar, { backgroundColor: meta.bg }]}>
            <Image source={require('../../assets/RwandaFDA.png')} style={styles.rowAvatarLogo} resizeMode="contain" />
          </View>
          <View style={[styles.kindBadge, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.ion} size={11} color="#fff" />
          </View>
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowMetaRow}>
            <Text style={styles.rowAppLine}>Rwanda FDA</Text>
            <Text style={styles.rowTime}>
              {rel ? `${rel} · ` : ''}
              {formatTime(item.created_at)}
            </Text>
          </View>
          <View style={styles.rowTitleRow}>
            <Text style={styles.rowKind}>{kindLabel(kind)}</Text>
            {unread ? <View style={styles.dotUnread} /> : null}
          </View>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {item.title || 'Update'}
          </Text>
          <Text style={styles.rowMessage} numberOfLines={2}>
            {item.message || 'No additional details.'}
          </Text>
          <View style={styles.rowFooter}>
            {unread ? (
              <View style={styles.pillNew}>
                <Text style={styles.pillNewText}>New</Text>
              </View>
            ) : (
              <View style={styles.pillRead}>
                <Ionicons name="checkmark-done-outline" size={12} color={styles.pillReadIconColor} />
                <Text style={styles.pillReadText}>Read</Text>
              </View>
            )}
            {item.id && unread && !markingIds[String(item.id)] ? (
              <PressableScale style={styles.markReadBtn} onPress={() => onMarkRead(item.id)} hapticType="light">
                <Text style={styles.markReadBtnText}>Mark read</Text>
              </PressableScale>
            ) : null}
            <View style={styles.footerSpacer} />
            <Text style={styles.openHint}>Open</Text>
            <Ionicons name="chevron-forward" size={16} color={styles.chevronColor} />
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

export default function Notifications() {
  const { token, logout } = useAuth();
  const { isDark } = useThemeMode();
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const [allItems, setAllItems] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => new Set());
  const pageRef = useRef(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);

  const [kindFilter, setKindFilter] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [markingIds, setMarkingIds] = useState({});

  const loadMoreGuard = useRef(false);
  const dismissedRef = useRef(new Set());
  const listFilterKey = unreadOnly ? 'unread' : 'all';

  useEffect(() => {
    dismissedRef.current = dismissedIds;
  }, [dismissedIds]);

  const stripDismissed = useCallback((items) => items.filter((i) => i?.id != null && !dismissedRef.current.has(String(i.id))), []);

  const loadPage = useCallback(
    async (pageNum, { append } = { append: false }) => {
      if (!token) return;
      const { items, has_more, error, ok, status } = await fetchNotificationsAuthed(token, {
        page: pageNum,
        limit: PAGE_SIZE,
        filter: listFilterKey,
      });
      if (!ok) {
        const e = new Error(typeof error === 'string' ? error : `Couldn't load notifications (${status})`);
        e.status = status;
        throw e;
      }
      if (error) {
        const e = new Error(error);
        e.status = status;
        throw e;
      }
      const incoming = stripDismissed(items);
      setHasMore(has_more);
      if (!append) pageRef.current = 1;
      setAllItems((prev) => (append ? mergeNotificationsById(prev, incoming) : mergeNotificationsById([], incoming)));
    },
    [token, listFilterKey, stripDismissed]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dismissed = await loadDismissedIds();
      if (!cancelled) setDismissedIds(dismissed);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setAllItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorInfo(null);
    pageRef.current = 1;
    setHasMore(true);
    loadPage(1, { append: false })
      .then(() => {
        if (!cancelled) pageRef.current = 1;
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.status;
        if (status === 401 || status === 403) {
          setErrorInfo({ kind: 'auth', message: err?.message || 'Session expired' });
        } else {
          setErrorInfo({ kind: 'network', message: err?.message || 'Something went wrong' });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, listFilterKey, loadPage]);

  useEffect(() => {
    if (!token) return undefined;
    const id = setInterval(() => {
      fetchNotificationsAuthed(token, { page: 1, limit: PAGE_SIZE, filter: listFilterKey })
        .then(({ items, ok, error }) => {
          if (!ok || error) return;
          const incoming = items.filter((i) => i?.id != null && !dismissedRef.current.has(String(i.id)));
          setAllItems((prev) => mergeNotificationsById(prev, incoming));
        })
        .catch(() => {});
    }, NOTIFICATIONS_AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [token, listFilterKey]);

  const queryText = search.trim().toLowerCase();

  const visibleItems = useMemo(() => {
    let list = allItems.filter((item) => item?.id != null && !dismissedIds.has(String(item.id)));
    if (kindFilter !== 'all') {
      list = list.filter((item) => notificationKind(item) === kindFilter);
    }
    if (unreadOnly) {
      list = list.filter((item) => !item.read_at);
    }
    if (!queryText) return list;
    return list.filter((item) => {
      const hay = [item.title, item.message, item.type, kindLabel(notificationKind(item))]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(queryText);
    });
  }, [allItems, dismissedIds, kindFilter, unreadOnly, queryText]);

  const sections = useMemo(() => {
    const groups = groupNotifications(visibleItems);
    return groups.map((g) => ({ title: g.label, data: g.items }));
  }, [visibleItems]);

  const unreadCount = useMemo(
    () => allItems.filter((n) => n?.id != null && !dismissedIds.has(String(n.id)) && !n.read_at).length,
    [allItems, dismissedIds]
  );

  async function markNotificationRead(id) {
    const sid = String(id);
    if (!id || markingIds[sid]) return;
    const prev = allItems.find((n) => String(n.id) === sid)?.read_at ?? null;
    setMarkingIds((x) => ({ ...x, [sid]: true }));
    setAllItems((x) =>
      x.map((n) => (String(n.id) === sid ? { ...n, read_at: n.read_at || new Date().toISOString() } : n))
    );
    try {
      const base = String(api.notifications || '').replace(/\.php$/i, '');
      const tokenValue = String(token || '');
      const headersBearer = { ...getAuthHeaders(() => token), Authorization: `Bearer ${tokenValue}` };
      const headersRaw = { ...getAuthHeaders(() => token), Authorization: tokenValue };
      const url = `${base}/${encodeURIComponent(sid)}/read`;
      let res = await fetch(url, { method: 'PATCH', headers: headersBearer });
      if (!res.ok && (res.status === 401 || res.status === 403)) {
        res = await fetch(url, { method: 'PATCH', headers: headersRaw });
      }
      if (!res.ok) throw new Error('Failed');
    } catch {
      setAllItems((x) => x.map((n) => (String(n.id) === sid ? { ...n, read_at: prev } : n)));
      Alert.alert('Notifications', "We couldn't mark this item as read.");
    } finally {
      setMarkingIds((x) => {
        const n = { ...x };
        delete n[sid];
        return n;
      });
    }
  }

  /** Tap row: mark read (and wait for API) before navigating so the badge/list update reliably. */
  async function openItem(item) {
    if (!item?.read_at && item?.id != null) {
      await markNotificationRead(item.id);
    }
    router.push(resolveTarget(item));
  }

  /** Hide from this device only; notification stays on server (Telegram-style archive). */
  function archiveItem(item) {
    const id = item?.id;
    if (id == null) return;
    const sid = String(id);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(sid);
      persistDismissedIds(next);
      return next;
    });
    setAllItems((prev) => prev.filter((x) => String(x.id) !== sid));
  }

  async function dismissItem(item) {
    const id = item?.id;
    if (id == null) return;
    const sid = String(id);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(sid);
      persistDismissedIds(next);
      return next;
    });
    setAllItems((prev) => prev.filter((x) => String(x.id) !== sid));
    const { bearer, raw } = authHeaderPairs(token);
    deleteNotificationOnServer(sid, bearer).catch(() => {
      deleteNotificationOnServer(sid, raw).catch(() => {});
    });
  }

  const handleRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    setErrorInfo(null);
    try {
      await loadPage(1, { append: false });
      pageRef.current = 1;
    } catch (err) {
      const status = err?.status;
      if (status === 401 || status === 403) {
        setErrorInfo({ kind: 'auth', message: err?.message || 'Session expired' });
      } else {
        setErrorInfo({ kind: 'network', message: err?.message || 'Something went wrong' });
      }
    } finally {
      setRefreshing(false);
    }
  }, [token, loadPage]);

  const onEndReached = useCallback(async () => {
    if (!token || !hasMore || loading || loadingMore || refreshing || loadMoreGuard.current) return;
    loadMoreGuard.current = true;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    try {
      const { items, has_more, ok, error } = await fetchNotificationsAuthed(token, {
        page: nextPage,
        limit: PAGE_SIZE,
        filter: listFilterKey,
      });
      if (ok && !error) {
        setHasMore(has_more);
        const incoming = items.filter((i) => i?.id != null && !dismissedRef.current.has(String(i.id)));
        setAllItems((prev) => mergeNotificationsById(prev, incoming));
        pageRef.current = nextPage;
      }
    } catch {
      /* ignore load-more errors */
    } finally {
      setLoadingMore(false);
      setTimeout(() => {
        loadMoreGuard.current = false;
      }, 400);
    }
  }, [token, hasMore, loading, loadingMore, refreshing, listFilterKey]);

  const emptyNoData =
    visibleItems.length === 0 && allItems.filter((i) => i?.id != null && !dismissedIds.has(String(i.id))).length === 0 && !errorInfo;
  const emptyFiltered =
    visibleItems.length === 0 &&
    allItems.filter((i) => i?.id != null && !dismissedIds.has(String(i.id))).length > 0;

  const listHeader = useMemo(
    () => (
      <>
        {errorInfo ? (
          <>
            <FriendlyErrorBanner info={errorInfo} onRetry={handleRefresh} isDark={isDark} />
            {errorInfo.kind === 'auth' ? (
              <PressableScale
                style={styles.authOutBtn}
                onPress={async () => {
                  await logout();
                }}
                hapticType="medium"
              >
                <Text style={styles.authOutBtnText}>Sign out and sign in again</Text>
              </PressableScale>
            ) : null}
          </>
        ) : null}

        <FadeInView delay={0} translateY={8}>
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={[styles.headerIconWrap, { backgroundColor: isDark ? 'rgba(15,94,71,0.35)' : colors.fdaGreenSoft }]}>
                <Ionicons name="notifications" size={26} color={colors.fdaGreen} />
              </View>
              <View style={styles.headerTextBlock}>
                <Text style={styles.headerTitle}>Inbox</Text>
                <Text style={styles.headerSub}>
                  {unreadCount > 0
                    ? `${unreadCount} unread · pull for latest, swipe to delete`
                    : allItems.length > 0
                      ? 'You’re all caught up'
                      : 'Updates from Rwanda FDA'}
                </Text>
              </View>
              {unreadCount > 0 ? (
                <View style={styles.unreadPill}>
                  <Text style={styles.unreadPillText}>{unreadCount}</Text>
                </View>
              ) : (
                <View style={styles.headerSpacer} />
              )}
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={20} color={styles.searchIconColor} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search notifications…"
                placeholderTextColor={styles.placeholderColor}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 ? (
                <PressableScale onPress={() => setSearch('')} hapticType="light">
                  <Ionicons name="close-circle" size={22} color={styles.searchIconColor} />
                </PressableScale>
              ) : null}
            </View>
          </View>
        </FadeInView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <PressableScale
            style={[styles.filterChip, unreadOnly && styles.filterChipActive]}
            onPress={() => setUnreadOnly((v) => !v)}
            hapticType="selection"
          >
            <Ionicons
              name="mail-unread-outline"
              size={14}
              color={unreadOnly ? '#fff' : styles.filterChipIconColor}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.filterChipText, unreadOnly && styles.filterChipTextActive]}>Unread</Text>
          </PressableScale>
          {FILTER_CHIPS.map((chip) => (
            <PressableScale
              key={chip.key}
              style={[styles.filterChip, kindFilter === chip.key && styles.filterChipActive]}
              onPress={() => setKindFilter(chip.key)}
              hapticType="selection"
            >
              <Ionicons
                name={chip.ion}
                size={14}
                color={kindFilter === chip.key ? '#fff' : styles.filterChipIconColor}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.filterChipText, kindFilter === chip.key && styles.filterChipTextActive]}>{chip.label}</Text>
            </PressableScale>
          ))}
        </ScrollView>
      </>
    ),
    [errorInfo, isDark, styles, handleRefresh, logout, unreadCount, allItems.length, search, unreadOnly, kindFilter]
  );

  if (loading && !errorInfo) return <ListSkeleton count={5} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => String(item.id ?? `row-${index}`)}
        renderItem={({ item }) => (
          <View style={styles.rowWrap}>
            <NotificationRow
              item={item}
              styles={styles}
              isDark={isDark}
              onOpen={openItem}
              onMarkRead={markNotificationRead}
              onArchive={archiveItem}
              onDelete={dismissItem}
              markingIds={markingIds}
            />
          </View>
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.daySeparatorWrap}>
            <View style={styles.daySeparatorLine} />
            <Text style={styles.daySeparator}>{title}</Text>
            <View style={styles.daySeparatorLine} />
          </View>
        )}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={colors.fdaGreen} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          emptyNoData ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={36} color={styles.emptyIconColor} />
              </View>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyText}>New task and application updates will show up here.</Text>
            </View>
          ) : emptyFiltered ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="funnel-outline" size={34} color={styles.emptyIconColor} />
              </View>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptyText}>Try another filter or clear the search.</Text>
              <PressableScale
                style={styles.resetBtn}
                onPress={() => {
                  setKindFilter('all');
                  setUnreadOnly(false);
                  setSearch('');
                }}
                hapticType="light"
              >
                <Text style={styles.resetBtnText}>Reset filters</Text>
              </PressableScale>
            </View>
          ) : null
        }
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.fdaGreen} />}
      />
    </SafeAreaView>
  );
}

const createStyles = (isDark) => {
  const bg = isDark ? '#0b1220' : colors.background;
  const card = isDark ? '#111827' : '#ffffff';
  const border = isDark ? 'rgba(148,163,184,0.2)' : colors.border;
  const text = isDark ? '#f8fafc' : colors.text;
  const muted = isDark ? '#94a3b8' : colors.textMuted;
  const subtle = isDark ? '#64748b' : colors.textSubtle;

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: bg },
    listContent: { paddingHorizontal: spacing.md, paddingBottom: 112, flexGrow: 1 },
    searchIconColor: muted,
    placeholderColor: subtle,
    filterChipIconColor: muted,
    emptyIconColor: muted,
    pillReadIconColor: subtle,
    chevronColor: subtle,

    authOutBtn: {
      alignSelf: 'center',
      marginBottom: spacing.md,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    authOutBtnText: { color: colors.fdaGreen, fontWeight: '800', fontSize: 14 },

    headerCard: {
      borderRadius: radius.xl,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.card,
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    headerIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextBlock: { flex: 1 },
    headerTitle: { color: text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    headerSub: { color: muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
    unreadPill: {
      minWidth: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.fdaGreen,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    unreadPillText: { color: '#fff', fontSize: 15, fontWeight: '900' },
    headerSpacer: { width: 36 },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: isDark ? '#0f172a' : colors.cardSoft,
      paddingHorizontal: 12,
      minHeight: 46,
    },
    searchInput: { flex: 1, color: text, fontSize: 15, paddingVertical: 10 },

    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: spacing.sm,
      paddingRight: 4,
      marginBottom: spacing.xs,
    },

    daySeparatorWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    daySeparatorLine: { flex: 1, height: 1, backgroundColor: border },
    daySeparator: {
      color: subtle,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },

    rowWrap: { marginBottom: spacing.sm },

    swipeActionsRight: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginBottom: spacing.sm,
    },
    swipeActionsLeft: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginBottom: spacing.sm,
    },
    /** Telegram-style columns: icon + label, full row height */
    swipeActionCol: {
      width: 82,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 12,
    },
    swipeArchive: {
      backgroundColor: isDark ? '#52525b' : '#6b7280',
    },
    swipeDelete: {
      backgroundColor: '#dc2626',
      borderTopRightRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
    },
    swipeRead: {
      backgroundColor: colors.fdaGreen,
      borderTopLeftRadius: radius.lg,
      borderBottomLeftRadius: radius.lg,
    },
    swipeActionText: { color: '#fff', fontSize: 11, fontWeight: '800', marginTop: 5, textAlign: 'center' },

    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingRight: spacing.sm,
      paddingLeft: 0,
      borderRadius: radius.lg,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      overflow: 'hidden',
      ...shadow.soft,
    },
    rowUnread: {
      borderColor: isDark ? 'rgba(15,94,71,0.5)' : 'rgba(15,94,71,0.25)',
      backgroundColor: isDark ? 'rgba(15,94,71,0.08)' : '#fafefd',
    },
    unreadBar: {
      width: 4,
      alignSelf: 'stretch',
      backgroundColor: colors.fdaGreen,
      borderTopLeftRadius: radius.lg,
      borderBottomLeftRadius: radius.lg,
    },
    readBarSpacer: { width: 4 },

    avatarRing: {
      marginTop: 2,
      width: 48,
      height: 48,
      borderRadius: 18,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowAvatar: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowAvatarLogo: { width: 28, height: 22 },
    kindBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: card,
    },

    rowBody: { flex: 1, paddingRight: spacing.xs, paddingTop: 2 },
    rowMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowAppLine: { color: subtle, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
    rowTime: { color: subtle, fontSize: 11, fontWeight: '600' },
    rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    rowKind: { color: colors.fdaGreen, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    dotUnread: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.fdaGreen },
    rowTitle: { color: text, fontSize: 15, fontWeight: '800', marginTop: 4, lineHeight: 20 },
    rowMessage: { color: muted, fontSize: 12.5, lineHeight: 18, marginTop: 4 },

    rowFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 8,
    },
    pillNew: {
      backgroundColor: isDark ? 'rgba(15,94,71,0.35)' : colors.fdaGreenSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    pillNewText: { color: colors.fdaGreen, fontSize: 10, fontWeight: '900' },
    pillRead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : '#f2f4f7',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    pillReadText: { color: subtle, fontSize: 10, fontWeight: '800' },
    markReadBtn: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    markReadBtnText: { color: colors.fdaGreen, fontSize: 11, fontWeight: '800' },
    footerSpacer: { flex: 1 },
    openHint: { color: colors.fdaGreen, fontSize: 12, fontWeight: '800' },

    footerLoading: { paddingVertical: spacing.lg, alignItems: 'center' },

    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : card,
      borderWidth: 1,
      borderColor: border,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginRight: 8,
    },
    filterChipActive: {
      backgroundColor: colors.fdaGreen,
      borderColor: colors.fdaGreen,
    },
    filterChipText: { color: muted, fontSize: 12.5, fontWeight: '800' },
    filterChipTextActive: { color: '#fff' },

    emptyCard: {
      marginTop: spacing.md,
      borderRadius: radius.xl,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      padding: spacing.xl,
      alignItems: 'center',
      ...shadow.soft,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? 'rgba(148,163,184,0.1)' : colors.cardSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyTitle: { color: text, fontSize: 18, fontWeight: '800' },
    emptyText: { color: muted, marginTop: 8, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.md },
    resetBtn: { marginTop: spacing.md, paddingVertical: 10, paddingHorizontal: 16 },
    resetBtnText: { color: colors.fdaGreen, fontWeight: '800', fontSize: 14 },
  });
};
