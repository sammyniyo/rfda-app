import { useEffect, useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useThemeMode } from "../../context/ThemeContext";
import { useQuery } from "../../hooks/useQuery";
import { colors, spacing, radius, shadow } from "../../constants/theme";
import { getAuthHeaders } from "../../lib/api";
import { api } from "../../constants/api";
import FadeInView from "../../components/FadeInView";
import PressableScale from "../../components/PressableScale";
import { useLanguage } from "../../context/LanguageContext";
import {
  extractPerformanceApplications,
  extractPerformanceTasks,
  fetchMonitoringPerformance,
  normalizePerformancePayloadData,
} from "../../lib/monitoringPerformance";
import { normalizeTaskFromPerformance } from "../../lib/performanceTaskUi";
import { getMonitoringStaffId } from "../../lib/staffSession";

async function fetchJson(url, token) {
  const res = await fetch(url, { headers: getAuthHeaders(() => token) });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

function initials(name) {
  return String(name || "RF")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/**
 * Direct reports: Under Statute + active when the API sends those fields.
 * If subordinate rows omit `staff_group` / `staff_status` (common), show them so the list is not empty.
 */
function filterDirectReportsForProfile(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((m) => {
    const gRaw = m?.staff_group ?? m?.group;
    const st = m?.staff_status ?? m?.status;

    const hasGroup = gRaw != null && String(gRaw).trim() !== "";
    const hasStatus = st != null && String(st).trim() !== "";

    if (!hasGroup && !hasStatus) return true;

    const gNorm = String(gRaw ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const underStatute =
      gNorm === "under statute" || gNorm.includes("under statute");
    const active = Number(st) === 1;

    if (hasGroup && !underStatute) return false;
    if (hasStatus && !active) return false;
    return true;
  });
}

function DetailRow({ label, value, textSubtle, textMain, borderColor }) {
  return (
    <View style={[styles.detailRow, { borderTopColor: borderColor }]}>
      <Text style={[styles.detailLabel, { color: textSubtle }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: textMain }]}>{value || "—"}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, textSubtle, textMain, borderColor, iconBg, iconBorder }) {
  return (
    <View style={[styles.infoRow, { borderTopColor: borderColor }]}>
      <View style={[styles.infoIcon, { backgroundColor: iconBg, borderColor: iconBorder }]}>
        <Ionicons name={icon} size={16} color={colors.fdaGreen} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: textSubtle }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: textMain }]} numberOfLines={2}>
          {value || "—"}
        </Text>
      </View>
    </View>
  );
}

function PersonHierarchyCard({ title, person, tone = "manager", isDark, textMain, textMuted, textSubtle }) {
  if (!person) return null;
  const isManager = tone === "manager";
  const cardSurface = isManager
    ? isDark
      ? { backgroundColor: "rgba(33,77,134,0.28)", borderColor: "rgba(96,165,250,0.22)" }
      : { backgroundColor: "#f6fbff", borderColor: "#dfeafb" }
    : isDark
      ? { backgroundColor: "rgba(15,94,71,0.22)", borderColor: "rgba(52,211,153,0.2)" }
      : { backgroundColor: "#fbfffd", borderColor: "#d7efe0" };
  const avBg = isManager
    ? isDark
      ? { backgroundColor: "rgba(33,77,134,0.5)" }
      : { backgroundColor: "#e8f0ff" }
    : isDark
      ? { backgroundColor: "rgba(15,94,71,0.45)" }
      : { backgroundColor: "#e7faf0" };
  return (
    <View style={[styles.hPersonCard, cardSurface]}>
      <View style={[styles.hAvatar, avBg]}>
        <Text style={[styles.hAvatarText, { color: textMain }]}>{initials(person.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.hTitle, { color: textSubtle }]}>{title}</Text>
        <Text style={[styles.hName, { color: textMain }]}>{person.name || "Unknown"}</Text>
        <Text style={[styles.hMeta, { color: textMuted }]} numberOfLines={1}>
          {[
            person.department,
            person.staff_group,
            person.role ? `Role ${person.role}` : null,
          ]
            .filter(Boolean)
            .join(" • ") || "Rwanda FDA"}
        </Text>
        {person.email ? (
          <Text style={[styles.hMeta, { color: textMuted }]} numberOfLines={1}>
            {person.email}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function TeamMemberCard({ member, cardBg, cardSoft, borderColor, textMain, textMuted, textSubtle, isDark }) {
  return (
    <View style={[styles.teamCard, { backgroundColor: cardSoft, borderColor }]}>
      <View style={styles.teamCardTop}>
        <View
          style={[
            styles.teamAvatar,
            { backgroundColor: isDark ? "rgba(30,41,59,0.95)" : "#eef6f4" },
          ]}
        >
          <Text style={styles.teamAvatarText}>{initials(member.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.teamName, { color: textMain }]} numberOfLines={1}>
            {member.name}
          </Text>
          <Text style={[styles.teamMeta, { color: textMuted }]} numberOfLines={1}>
            {member.department || "Rwanda FDA"}
          </Text>
        </View>
      </View>
      <View style={styles.teamStatsRow}>
        <View style={[styles.teamStat, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.teamStatValue, { color: textMain }]}>{member.pending_tasks ?? 0}</Text>
          <Text style={[styles.teamStatLabel, { color: textSubtle }]}>Open Tasks</Text>
        </View>
        <View style={[styles.teamStat, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.teamStatValue, { color: textMain }]}>
            {member.total_applications ?? 0}
          </Text>
          <Text style={[styles.teamStatLabel, { color: textSubtle }]}>Apps</Text>
        </View>
      </View>
    </View>
  );
}

export default function Profile() {
  const { token, user, loading: authLoading } = useAuth();
  const { isDark } = useThemeMode();
  const { t } = useLanguage();
  const pageBg = isDark ? "#0b1220" : colors.background;
  const cardBg = isDark ? "#111827" : colors.card;
  const cardSoft = isDark ? "#1e293b" : colors.cardSoft;
  const borderColor = isDark ? "rgba(148,163,184,0.2)" : colors.border;
  const textMain = isDark ? "#f8fafc" : colors.text;
  const textMuted = isDark ? "#94a3b8" : colors.textMuted;
  const textSubtle = isDark ? "#64748b" : colors.textSubtle;
  const iconBg = isDark ? "rgba(15,94,71,0.22)" : "#e7faf0";
  const iconBorder = isDark ? "rgba(52,211,153,0.18)" : "rgba(15,94,71,0.12)";
  const heroBorder = isDark ? borderColor : colors.border;
  const logoWrapBg = isDark ? "rgba(15,23,42,0.92)" : "#fff";
  const pillSurface = isDark ? "rgba(15,94,71,0.28)" : "#e7faf0";
  const pillBorder = isDark ? "rgba(52,211,153,0.22)" : "rgba(15,94,71,0.12)";
  const actionPillBg = isDark ? "#1e293b" : "#fff";
  const statApps = isDark
    ? { backgroundColor: "rgba(33,77,134,0.35)", borderColor: "rgba(96,165,250,0.28)" }
    : { backgroundColor: "#e8f0ff", borderColor: "rgba(33,77,134,0.14)" };
  const statTasks = isDark
    ? { backgroundColor: "rgba(15,94,71,0.3)", borderColor: "rgba(52,211,153,0.25)" }
    : { backgroundColor: "#e7faf0", borderColor: "rgba(15,94,71,0.14)" };
  const statNotif = isDark
    ? { backgroundColor: "rgba(217,119,6,0.22)", borderColor: "rgba(251,191,36,0.3)" }
    : { backgroundColor: "#fff6ea", borderColor: "rgba(217,119,6,0.14)" };
  const [refreshing, setRefreshing] = useState(false);
  const [reportsVisible, setReportsVisible] = useState(8);
  const directReportsFilteredLen = filterDirectReportsForProfile(user?.direct_reports).length;
  useEffect(() => {
    setReportsVisible(8);
  }, [user?.staff_id, directReportsFilteredLen]);

  const performanceQuery = useQuery(
    async () => {
      if (!token) return { applications: null, tasks: null };
      try {
        const { payload } = await fetchMonitoringPerformance({
          staffId: getMonitoringStaffId(user),
          token,
          getToken: () => token,
        });
        const inner = normalizePerformancePayloadData(payload) ?? {};
        const wrapper = { success: true, data: inner };
        const rawApps = extractPerformanceApplications(wrapper);
        const rawTasks = extractPerformanceTasks(wrapper);
        const tasks = rawTasks.map((t, i) => normalizeTaskFromPerformance(t, i));
        return { applications: rawApps, tasks };
      } catch {
        return { applications: null, tasks: null };
      }
    },
    [token, user?.staff_id],
    { cacheKey: token ? `profile_perf_${token}_${user?.staff_id ?? ""}` : undefined },
  );

  const tasksQuery = useQuery(
    () => fetchJson(api.tasks, token).catch(() => []),
    [token],
    { cacheKey: `tasks_${token}` },
  );
  const applicationsQuery = useQuery(
    () => fetchJson(api.applications, token).catch(() => []),
    [token],
    { cacheKey: `applications_${token}` },
  );
  const notificationsQuery = useQuery(
    async () => {
      if (!token) return [];
      const tokenValue = String(token);
      const headersBearer = {
        ...getAuthHeaders(() => tokenValue),
        Authorization: `Bearer ${tokenValue}`,
      };
      const headersRaw = {
        ...getAuthHeaders(() => tokenValue),
        Authorization: tokenValue,
      };

      // Try `Bearer <token>` first, then fall back to raw token.
      const notifUrl = api.notificationsQuery({ limit: 150, page: 1, filter: "all" });
      let res = await fetch(notifUrl, { headers: headersBearer });
      if (res.ok) return await res.json().catch(() => []);
      if (res.status === 401 || res.status === 403) {
        res = await fetch(notifUrl, { headers: headersRaw });
        if (res.ok) return await res.json().catch(() => []);
      }
      return [];
    },
    [token],
    { cacheKey: token ? `notifications_${token}` : undefined },
  );
  const { data: tasks = [] } = tasksQuery;
  const { data: applications = [] } = applicationsQuery;
  const { data: notifications = [] } = notificationsQuery;
  const perfApps = performanceQuery.data?.applications;
  const perfTasks = performanceQuery.data?.tasks;

  const profile = user || null;

  if (authLoading && !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: pageBg }]}>
        <Text style={[styles.stateText, { color: textMuted }]}>Loading profile…</Text>
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={[styles.centered, { backgroundColor: pageBg }]}>
        <Text style={[styles.stateText, { color: textMuted }]}>Profile not available.</Text>
      </View>
    );
  }

  const taskList = Array.isArray(tasks) ? tasks : [];
  const appList = Array.isArray(applications) ? applications : [];
  const appListForStats = Array.isArray(perfApps) ? perfApps : appList;
  const taskListForStats = Array.isArray(perfTasks) ? perfTasks : taskList;
  const notifList = Array.isArray(notifications)
    ? notifications
    : Array.isArray(notifications?.data?.items)
      ? notifications.data.items
      : Array.isArray(notifications?.items)
        ? notifications.items
        : [];
  const allDirectReports = Array.isArray(profile.direct_reports)
    ? profile.direct_reports
    : [];
  const directReports = filterDirectReportsForProfile(allDirectReports);
  const reportCount = directReports.length;

  const pendingTasks = taskListForStats.filter(
    (t) => t.status !== "completed" && t.status !== "review",
  ).length;
  const completedTasks = taskListForStats.filter(
    (t) => t.status === "completed" || t.status === "review",
  ).length;
  const unreadNotifications = notifList.filter((n) => !n.read_at).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        performanceQuery.refetch(),
        tasksQuery.refetch(),
        applicationsQuery.refetch(),
        notificationsQuery.refetch(),
      ]);
    } catch {
      // each query sets its own error state; avoid uncaught refresh rejection
    } finally {
      setRefreshing(false);
    }
  };

  const infoProps = {
    textSubtle,
    textMain,
    borderColor,
    iconBg,
    iconBorder,
  };
  const detailProps = { textSubtle, textMain, borderColor };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]} edges={["top", "left", "right"]}>
      <ScrollView
        style={[styles.container, { backgroundColor: pageBg }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.fdaGreen}
          />
        }
      >
        <FadeInView delay={0} translateY={14}>
          <View style={[styles.heroCard, { borderColor: heroBorder }]}>
            <LinearGradient
              colors={isDark ? ["#111827", "#0b1220", "#0f172a"] : ["#ffffff", "#f8fbff", "#effaf4"]}
              locations={[0, 0.45, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={isDark ? ["transparent", "rgba(15,94,71,0.12)"] : ["transparent", "rgba(15,94,71,0.05)"]}
              start={{ x: 0.4, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.heroCardInner}>
            <View style={styles.heroHeaderRow}>
              <View style={styles.brandRow}>
                <View style={[styles.brandLogoWrap, { backgroundColor: logoWrapBg, borderColor }]}>
                  <Image
                    source={require("../../assets/RwandaFDA.png")}
                    style={styles.brandLogo}
                    resizeMode="contain"
                  />
                </View>
                <View>
                  <Text style={[styles.brandTitle, { color: textMain }]}>Profile</Text>
                  <Text style={[styles.brandSub, { color: textMuted }]} numberOfLines={1}>
                    {profile.dutyStation || profile.department || "Rwanda FDA"}
                  </Text>
                </View>
              </View>
              <View style={styles.heroActionsRow}>
                <PressableScale
                  style={[styles.iconPill, { backgroundColor: actionPillBg, borderColor }]}
                  onPress={() => router.push("/(app)/settings")}
                >
                  <Ionicons
                    name="settings-outline"
                    size={17}
                    color={textMain}
                  />
                </PressableScale>
              </View>
            </View>

            <View style={styles.heroTopRow}>
              <View style={[styles.avatarShell, { backgroundColor: isDark ? "rgba(15,94,71,0.2)" : "#eef6f4" }]}>
                <LinearGradient
                  colors={[colors.fdaGreen, colors.teal]}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>
                    {initials(profile.name)}
                  </Text>
                </LinearGradient>
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={[styles.nameText, { color: textMain }]} numberOfLines={2}>
                  {profile.name || t("rfdaStaff")}
                </Text>
                <Text style={[styles.roleText, { color: textMuted }]} numberOfLines={1}>
                  {profile.position ||
                    profile.staff_position ||
                    profile.role ||
                    t("staffMember")}
                </Text>
                <Text style={[styles.smallSubText, { color: textSubtle }]} numberOfLines={1}>
                  {profile.email || t("noWorkEmail")}
                </Text>
              </View>
            </View>

            <View style={styles.statsCardsRow}>
              <View style={[styles.statCard, statApps]}>
                <Text style={[styles.statValue, { color: textMain }]}>{appListForStats.length}</Text>
                <Text style={[styles.statLabel, { color: textMuted }]}>{t("applications")}</Text>
              </View>
              <View style={[styles.statCard, statTasks]}>
                <Text style={[styles.statValue, { color: textMain }]}>{pendingTasks}</Text>
                <Text style={[styles.statLabel, { color: textMuted }]}>{t("openTasks")}</Text>
              </View>
              <View style={[styles.statCard, statNotif]}>
                <Text style={[styles.statValue, { color: textMain }]}>{unreadNotifications}</Text>
                <Text style={[styles.statLabel, { color: textMuted }]}>{t("unread")}</Text>
              </View>
            </View>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={90} translateY={10}>
          <View style={[styles.panel, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.panelHeaderRow}>
              <Text style={[styles.panelTitle, { color: textMain }]}>{t("myDetails")}</Text>
              <View style={[styles.panelChip, { backgroundColor: pillSurface, borderColor: pillBorder }]}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={14}
                  color={colors.fdaGreen}
                />
                <Text style={styles.panelChipText}>{t("verified")}</Text>
              </View>
            </View>
            <InfoRow icon="mail-outline" label={t("workEmail")} value={profile.email} {...infoProps} />
            <InfoRow icon="call-outline" label={t("phone")} value={profile.phone} {...infoProps} />
            <InfoRow
              icon="location-outline"
              label={t("dutyStation")}
              value={profile.dutyStation || profile.department}
              {...infoProps}
            />
            <InfoRow icon="people-outline" label={t("staffGroup")} value={profile.group} {...infoProps} />
            <InfoRow
              icon="briefcase-outline"
              label={t("position")}
              value={profile.position}
              {...infoProps}
            />
            <InfoRow
              icon="business-outline"
              label={t("organization")}
              value={
                [profile.parentOrgUnitName, profile.orgUnitName].filter(Boolean).join(" · ") ||
                profile.orgUnitName ||
                null
              }
              {...infoProps}
            />
          </View>
        </FadeInView>

        <FadeInView delay={160} translateY={10}>
          <View style={[styles.panel, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.panelTitle, { color: textMain }]}>{t("more")}</Text>
            <DetailRow label={t("degree")} value={profile.degree} {...detailProps} />
            <DetailRow label={t("qualifications")} value={profile.qualifications} {...detailProps} />
            <DetailRow
              label={t("contract")}
              value={profile.contractType}
              {...detailProps}
            />
            <DetailRow
              label={t("hireDate")}
              value={
                profile.hireDate
                  ? new Date(profile.hireDate).toLocaleDateString()
                  : null
              }
              {...detailProps}
            />
          </View>
        </FadeInView>

        <FadeInView delay={220} translateY={10}>
          <View style={[styles.panel, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.panelTitle, { color: textMain }]}>{t("mySnapshot")}</Text>
            <View style={[styles.metricRow, { borderTopColor: borderColor }]}>
              <Text style={[styles.metricLabel, { color: textMuted }]}>{t("completedTasks")}</Text>
              <Text style={[styles.metricValue, { color: textMain }]}>{completedTasks}</Text>
            </View>
            <View style={[styles.metricRow, { borderTopColor: borderColor }]}>
              <Text style={[styles.metricLabel, { color: textMuted }]}>{t("openTasks")}</Text>
              <Text style={[styles.metricValue, { color: textMain }]}>{pendingTasks}</Text>
            </View>
            <View style={[styles.metricRow, { borderTopColor: borderColor }]}>
              <Text style={[styles.metricLabel, { color: textMuted }]}>{t("applicationsQueue")}</Text>
              <Text style={[styles.metricValue, { color: textMain }]}>{appListForStats.length}</Text>
            </View>
            <View style={[styles.metricRow, { borderTopColor: borderColor }]}>
              <Text style={[styles.metricLabel, { color: textMuted }]}>{t("unreadNotifications")}</Text>
              <Text style={[styles.metricValue, { color: textMain }]}>{unreadNotifications}</Text>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={260} translateY={10}>
          <View style={[styles.panel, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.panelHeaderRow}>
              <Text style={[styles.panelTitle, { color: textMain }]}>{t("staffHierarchy")}</Text>
              <Text style={[styles.hintRightText, { color: textMuted }]}>
                {reportCount} {reportCount === 1 ? t("reportOne") : t("reportMany")}
              </Text>
            </View>

            {profile.reports_to ? (
              <PersonHierarchyCard
                title={t("reportsTo")}
                person={profile.reports_to}
                tone="manager"
                isDark={isDark}
                textMain={textMain}
                textMuted={textMuted}
                textSubtle={textSubtle}
              />
            ) : (
              <View style={[styles.hEmptyCard, { backgroundColor: cardSoft, borderColor }]}>
                <Text style={[styles.hEmptyText, { color: textMuted }]}>{t("noManagerFound")}</Text>
              </View>
            )}

            <View style={styles.directReportsHeader}>
              <Text style={[styles.directReportsTitle, { color: textMain }]}>{t("directReports")}</Text>
              <Text
                style={[
                  styles.directReportsCount,
                  {
                    color: colors.fdaGreen,
                    backgroundColor: isDark ? "rgba(15,94,71,0.35)" : colors.fdaGreenSoft,
                  },
                ]}
              >
                {reportCount}
              </Text>
            </View>

            {allDirectReports.length === 0 ? (
              <View style={[styles.hEmptyCard, { backgroundColor: cardSoft, borderColor }]}>
                <Text style={[styles.hEmptyText, { color: textMuted }]}>
                  {t("noDirectReports")}
                </Text>
              </View>
            ) : directReports.length === 0 ? (
              <View style={[styles.hEmptyCard, { backgroundColor: cardSoft, borderColor }]}>
                <Text style={[styles.hEmptyText, { color: textMuted }]}>
                  {t("noDirectReportsFiltered")}
                </Text>
              </View>
            ) : (
              <>
                {directReports.slice(0, reportsVisible).map((member) => (
                  <TeamMemberCard
                    key={member.staff_id || member.user_id || member.email}
                    member={member}
                    cardBg={cardBg}
                    cardSoft={cardSoft}
                    borderColor={borderColor}
                    textMain={textMain}
                    textMuted={textMuted}
                    textSubtle={textSubtle}
                    isDark={isDark}
                  />
                ))}
                {directReports.length > reportsVisible ? (
                  <PressableScale
                    style={[styles.loadMoreReports, { borderColor, backgroundColor: cardSoft }]}
                    onPress={() =>
                      setReportsVisible((n) => Math.min(n + 8, directReports.length))
                    }
                  >
                    <Text style={[styles.loadMoreReportsText, { color: colors.fdaGreen }]}>
                      {t("loadMoreLeft").replace("{left}", String(directReports.length - reportsVisible))}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.fdaGreen} />
                  </PressableScale>
                ) : null}
              </>
            )}
          </View>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 112, gap: spacing.md },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  stateText: { fontSize: 15, fontWeight: "600" },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: "hidden",
    ...shadow.card,
  },
  heroCardInner: { padding: spacing.md, zIndex: 1 },
  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  brandLogoWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.soft,
  },
  brandLogo: { width: 30, height: 24 },
  brandTitle: { fontSize: 14, fontWeight: "900" },
  brandSub: { fontSize: 11.5, marginTop: 2 },
  heroActionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTopRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  avatarShell: {
    borderRadius: radius.lg,
    padding: 3,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  heroTextWrap: { flex: 1 },
  nameText: { fontSize: 18, fontWeight: "900" },
  roleText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "700",
  },
  smallSubText: {
    fontSize: 11.5,
    marginTop: 4,
    fontWeight: "600",
  },
  statsCardsRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: {
    fontSize: 11,
    marginTop: 3,
    textAlign: "center",
  },
  panel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    ...shadow.soft,
  },
  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  panelTitle: { fontSize: 16, fontWeight: "900" },
  panelSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  panelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  panelChipText: { color: colors.fdaGreen, fontWeight: "900", fontSize: 11 },
  hintRightText: { fontSize: 12, fontWeight: "800" },
  infoRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 11, fontWeight: "800" },
  infoValue: {
    fontSize: 13.5,
    fontWeight: "700",
    marginTop: 2,
  },
  hPersonCard: {
    flexDirection: "row",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
    alignItems: "center",
  },
  hAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  hAvatarText: { fontWeight: "800" },
  hTitle: { fontSize: 11, fontWeight: "700" },
  hName: { fontSize: 14, fontWeight: "800", marginTop: 2 },
  hMeta: { fontSize: 11, marginTop: 2 },
  hConnector: { alignItems: "center", paddingVertical: 8 },
  hLine: { width: 2, height: 10, backgroundColor: colors.border },
  hNode: {
    marginVertical: 2,
    backgroundColor: colors.fdaGreen,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hNodeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  directReportsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: 8,
  },
  directReportsTitle: { fontWeight: "800", fontSize: 14 },
  directReportsCount: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
  },
  loadMoreReports: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  loadMoreReportsText: { fontSize: 13, fontWeight: "800" },
  hEmptyCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
  },
  hEmptyText: { fontSize: 12 },
  teamCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
    marginTop: 8,
  },
  teamCardTop: { flexDirection: "row", gap: 10, alignItems: "center" },
  teamAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  teamAvatarText: { color: colors.fdaGreen, fontWeight: "800", fontSize: 12 },
  teamName: { fontWeight: "700", fontSize: 13 },
  teamMeta: { fontSize: 11, marginTop: 2 },
  teamStatsRow: { flexDirection: "row", gap: spacing.sm, marginTop: 8 },
  teamStat: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  teamStatValue: { fontWeight: "800", fontSize: 14 },
  teamStatLabel: { fontSize: 10, marginTop: 2 },
  detailRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  detailValue: { fontSize: 14, fontWeight: "600" },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  metricLabel: { fontSize: 13, flex: 1 },
  metricValue: { fontWeight: "800", fontSize: 14 },
});
