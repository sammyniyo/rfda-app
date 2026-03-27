import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { api } from "../constants/api";
import { getAuthHeaders, isApiSuccess } from "../lib/api";
import { normalizeNotificationRow } from "../lib/notificationsFeed";
import { ensureAndroidAlertChannelAsync } from "../lib/pushNotifications";
import {
  buildMessagingStyleNotificationContent,
  ensureMessagingNotificationCategory,
} from "../lib/messagingStyleNotifications";

// Remote push token is unavailable in Expo Go (SDK 53+); polling still schedules local alerts.
const isExpoGo = Constants.appOwnership === "expo";
const NOTIFICATION_POLL_MS = 20000;

function getNotificationsModule() {
  try {
    // eslint-disable-next-line global-require
    return require("expo-notifications");
  } catch {
    return null;
  }
}

function extractItems(payload) {
  if (payload == null) return [];
  if (Array.isArray(payload)) return payload;
  const data = payload.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.notifications)) return data.notifications;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(payload?.notifications)) return payload.notifications;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function guessLink(item) {
  const text = `${String(item?.type || "").toLowerCase()} ${String(item?.title || "").toLowerCase()} ${String(
    item?.message || "",
  ).toLowerCase()}`;
  if (text.includes("task")) return "/(app)/tasks";
  if (text.includes("application") || text.includes("app"))
    return "/(app)/applications";
  if (text.includes("profile")) return "/(app)/profile";
  return "/(app)/notifications";
}

function routeFromLink(link) {
  const path = String(link || "").trim();
  if (path.startsWith("/")) return path;
  const lower = path.toLowerCase();
  if (lower.includes("task")) return "/(app)/tasks";
  if (lower.includes("application") || lower.includes("app"))
    return "/(app)/applications";
  if (lower.includes("profile")) return "/(app)/profile";
  return "/(app)/notifications";
}

function itemId(item) {
  return String(item?.id ?? item?.notification_id ?? "").trim();
}

export default function PushNotificationsProvider({ children }) {
  const { token } = useAuth();
  const authTokenRef = useRef(token);
  authTokenRef.current = token;

  const hasRegisteredPushRef = useRef(false);
  const lastPushAuthRef = useRef(null);

  const seenAuthIdsRef = useRef(new Set());
  const hydratedAuthRef = useRef(false);

  const seenPublicIdsRef = useRef(new Set());
  const hydratedPublicRef = useRef(false);

  /** Permissions + channel as soon as the app opens (logged in or not). */
  useEffect(() => {
    (async () => {
      const Notifications = getNotificationsModule();
      if (!Notifications) return;
      try {
        await ensureAndroidAlertChannelAsync();
        const perms = await Notifications.getPermissionsAsync();
        if (perms.status !== "granted") {
          await Notifications.requestPermissionsAsync();
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch {
      /* Expo Go / older hosts */
    }
  }, []);

  useEffect(() => {
    if (isExpoGo) return;

    (async () => {
      // eslint-disable-next-line global-require
      const pushLib = require("../lib/pushNotifications");
      const pushToken = await pushLib.registerForPushNotificationsAsync();
      if (!pushToken) return;

      const authKey = token ? String(token) : "";
      if (hasRegisteredPushRef.current && lastPushAuthRef.current === authKey)
        return;

      try {
        let regRes;
        if (token) {
          regRes = await fetch(api.registerDevice, {
            method: "POST",
            headers: getAuthHeaders(() => token),
            body: JSON.stringify({
              token: pushToken,
              platform: Platform.OS,
            }),
          });
        } else {
          regRes = await fetch(api.registerDevice, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: pushToken,
              platform: Platform.OS,
              anonymous: true,
            }),
          });
        }
        if (regRes.ok) {
          hasRegisteredPushRef.current = true;
          lastPushAuthRef.current = authKey;
        }
      } catch {
        hasRegisteredPushRef.current = false;
      }
    })();
  }, [token]);

  useEffect(() => {
    const Notifications = getNotificationsModule();
    if (!Notifications) return undefined;

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const session = authTokenRef.current;
        try {
          if (!session) {
            router.push("/");
            return;
          }
          const data = response?.notification?.request?.content?.data;
          const target = data?.link
            ? routeFromLink(data.link)
            : "/(app)/notifications";
          router.push(target);
        } catch {
          try {
            router.push(authTokenRef.current ? "/(app)/notifications" : "/");
          } catch {
            /* ignore */
          }
        }
      },
    );
    return () => sub.remove();
  }, []);

  const fetchAndNotifyAuthed = useCallback(async () => {
    if (!token) return;

    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    await ensureAndroidAlertChannelAsync().catch(() => {});

    const perms = await Notifications.getPermissionsAsync().catch(() => ({
      status: "undetermined",
    }));
    let status = perms?.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync().catch(
        () => ({ status }),
      );
      status = requested?.status ?? status;
    }
    if (status !== "granted") {
      if (Platform.OS === "ios") {
        await Notifications.setBadgeCountAsync(0).catch(() => {});
      }
      return;
    }

    await ensureMessagingNotificationCategory(Notifications);

    const tokenValue = String(token || "");
    const headersBearer = {
      ...getAuthHeaders(() => token),
      Authorization: `Bearer ${tokenValue}`,
    };
    const headersRaw = {
      ...getAuthHeaders(() => token),
      Authorization: tokenValue,
    };

    const listUrl = api.notificationsQuery({
      page: 1,
      limit: 50,
      filter: "all",
    });
    let res = await fetch(listUrl, { headers: headersBearer });
    let payload = await res.json().catch(() => ({}));
    if (!res.ok && (res.status === 401 || res.status === 403)) {
      res = await fetch(listUrl, { headers: headersRaw });
      payload = await res.json().catch(() => ({}));
    }
    if (!res.ok || !isApiSuccess(payload)) return;

    const items = extractItems(payload).map((row) =>
      normalizeNotificationRow(row),
    );
    const unread = items.filter((n) => !n?.read_at);

    if (Platform.OS === "ios") {
      await Notifications.setBadgeCountAsync(unread.length).catch(() => {});
    }

    if (!hydratedAuthRef.current) {
      const ids = unread.map((n) => itemId(n)).filter(Boolean);
      seenAuthIdsRef.current = new Set(ids);
      hydratedAuthRef.current = true;
      if (unread.length > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Rwanda FDA",
            subtitle: "Updates",
            body:
              unread.length === 1
                ? "You have 1 unread update. Tap to open."
                : `You have ${unread.length} unread updates. Tap to open.`,
            sound: "default",
            data: { link: "/(app)/notifications" },
            categoryIdentifier: undefined,
          },
          trigger: null,
        }).catch(() => {});
      }
      return;
    }

    for (const item of unread) {
      const id = itemId(item);
      if (!id || seenAuthIdsRef.current.has(id)) continue;

      seenAuthIdsRef.current.add(id);

      const link = item?.link || guessLink(item);
      const content = await buildMessagingStyleNotificationContent(
        item,
        link,
        Notifications,
      );

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
      }).catch(() => {});
    }
  }, [token]);

  const fetchAndNotifyPublic = useCallback(async () => {
    const url = api.publicNotifications;
    if (!url) return;

    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    await ensureAndroidAlertChannelAsync().catch(() => {});

    const perms = await Notifications.getPermissionsAsync().catch(() => ({
      status: "undetermined",
    }));
    let status = perms?.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync().catch(
        () => ({ status }),
      );
      status = requested?.status ?? status;
    }
    if (status !== "granted") return;

    await ensureMessagingNotificationCategory(Notifications);

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    }).catch(() => null);
    if (!res || !res.ok) return;
    const payload = await res.json().catch(() => ({}));
    if (!isApiSuccess(payload)) return;

    const items = extractItems(payload).map((row) =>
      normalizeNotificationRow(row),
    );
    const candidates = items.filter((n) => !n?.read_at);

    if (Platform.OS === "ios") {
      await Notifications.setBadgeCountAsync(candidates.length).catch(() => {});
    }

    if (!hydratedPublicRef.current) {
      const ids = candidates.map((n) => itemId(n)).filter(Boolean);
      seenPublicIdsRef.current = new Set(ids);
      hydratedPublicRef.current = true;
      if (candidates.length > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Rwanda FDA",
            subtitle: "Announcements",
            body:
              candidates.length === 1
                ? String(
                    candidates[0]?.title ||
                      candidates[0]?.message ||
                      "New announcement",
                  )
                : `${candidates.length} new announcements. Tap to read.`,
            sound: "default",
            data: { link: "/" },
          },
          trigger: null,
        }).catch(() => {});
      }
      return;
    }

    for (const item of candidates) {
      const id = itemId(item);
      if (!id || seenPublicIdsRef.current.has(id)) continue;

      seenPublicIdsRef.current.add(id);

      const content = await buildMessagingStyleNotificationContent(
        item,
        "/",
        Notifications,
      );

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const Notifications = getNotificationsModule();
    const hasPublic = Boolean(api.publicNotifications);
    const wantPoll = Boolean(token) || hasPublic;

    if (!Notifications || !wantPoll) {
      if (!token && Notifications && Platform.OS === "ios") {
        Notifications.setBadgeCountAsync(0).catch(() => {});
      }
      return undefined;
    }

    if (!token) {
      seenAuthIdsRef.current = new Set();
      hydratedAuthRef.current = false;
    } else {
      seenPublicIdsRef.current = new Set();
      hydratedPublicRef.current = false;
    }

    const tick = () => {
      if (token) {
        fetchAndNotifyAuthed().catch(() => {});
      } else if (hasPublic) {
        fetchAndNotifyPublic().catch(() => {});
      }
    };

    tick();
    const intervalId = setInterval(tick, NOTIFICATION_POLL_MS);

    const appSub = AppState.addEventListener("change", (next) => {
      if (next === "active") tick();
    });

    return () => {
      clearInterval(intervalId);
      appSub.remove();
    };
  }, [token, fetchAndNotifyAuthed, fetchAndNotifyPublic]);

  useEffect(() => {
    if (token) return;
    seenAuthIdsRef.current = new Set();
    hydratedAuthRef.current = false;
    const Notifications = getNotificationsModule();
    if (Notifications && Platform.OS === "ios" && !api.publicNotifications) {
      Notifications.setBadgeCountAsync(0).catch(() => {});
    }
  }, [token]);

  return children;
}
