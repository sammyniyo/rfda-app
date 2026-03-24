/**
 * WhatsApp / iMessage–style local notifications: headline + app subtitle + message body,
 * optional Rwanda FDA thumbnail on iOS, grouped category with actions.
 */
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { ANDROID_ALERT_CHANNEL_ID } from './pushNotifications';

/** Expo: avoid ':' and '-' in category identifiers */
export const MESSAGE_CATEGORY_ID = 'RWANDA_FDA_INBOX';

const TITLE_MAX = 56;
const BODY_MAX = 220;

let logoUriPromise = null;
let categoryRegistered = false;

export function clip(str, max) {
  const s = String(str || '').trim();
  if (s.length <= max) return s || '…';
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Cached file:// URI for bundled logo (iOS notification attachment).
 */
export async function getLogoAttachmentUri() {
  if (Platform.OS !== 'ios') return null;
  if (!logoUriPromise) {
    logoUriPromise = (async () => {
      try {
        const a = Asset.fromModule(require('../assets/RwandaFDA.png'));
        await a.downloadAsync();
        const uri = a.localUri || a.uri;
        return uri && uri.startsWith('file') ? uri : null;
      } catch {
        return null;
      }
    })();
  }
  return logoUriPromise;
}

export function notificationKindLabel(item) {
  const blob = `${String(item?.type || '')} ${String(item?.title || '')} ${String(item?.message || '')}`.toLowerCase();
  if (blob.includes('task')) return 'Task';
  if (blob.includes('application') || blob.includes('app')) return 'Application';
  if (blob.includes('alert') || blob.includes('reminder')) return 'Alert';
  return 'Message';
}

/**
 * Register iOS/Android notification category once (action buttons on expanded banner).
 */
export async function ensureMessagingNotificationCategory(Notifications) {
  if (!Notifications || categoryRegistered) return;
  try {
    await Notifications.setNotificationCategoryAsync(MESSAGE_CATEGORY_ID, [
      {
        identifier: 'OPEN_APP',
        buttonTitle: 'Open',
        options: { opensAppToForeground: true },
      },
    ]);
    categoryRegistered = true;
  } catch {
    categoryRegistered = false;
  }
}

/**
 * Build content for scheduleNotificationAsync — messaging-app style.
 * @param {typeof import('expo-notifications')} NotificationsModule - lazy-loaded module (skip in Expo Go).
 */
export async function buildMessagingStyleNotificationContent(item, link, NotificationsModule) {
  const kind = notificationKindLabel(item);
  const headline = clip(item?.title || `${kind} update`, TITLE_MAX);
  const bodyText = clip(item?.message || 'You have a new update.', BODY_MAX);

  const content = {
    // Like chat apps: bold name / subject line
    title: headline,
    // App name under the headline (iOS subtitle; Android subText in expanded view)
    subtitle: 'Rwanda FDA',
    body: bodyText,
    sound: 'default',
    data: { link },
    categoryIdentifier: MESSAGE_CATEGORY_ID,
    // Stronger banner / sound when allowed (not timeSensitive — avoids extra entitlements)
    interruptionLevel: 'active',
  };

  if (Platform.OS === 'ios') {
    const logoUri = await getLogoAttachmentUri();
    if (logoUri) {
      content.attachments = [
        {
          identifier: 'rwanda-fda-logo',
          url: logoUri,
          type: 'public.png',
          hideThumbnail: false,
        },
      ];
    }
  }

  if (Platform.OS === 'android' && NotificationsModule?.AndroidNotificationPriority) {
    content.color = '#FF0F5E47';
    const maxPri = NotificationsModule.AndroidNotificationPriority.MAX;
    content.priority = maxPri;
    // Some Expo versions read channel + priority from this nested object
    content.android = {
      channelId: ANDROID_ALERT_CHANNEL_ID,
      priority: maxPri,
    };
  }

  return content;
}
