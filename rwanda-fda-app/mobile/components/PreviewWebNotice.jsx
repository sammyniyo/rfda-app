import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeMode } from '../context/ThemeContext';
import { usePreviewWebNoticeDismissal } from '../context/PreviewWebNoticeContext';
import { colors, spacing, radius } from '../constants/theme';
import { MONITORING_WEB_PORTAL_URL } from '../constants/portal';

const AUTO_DISMISS_MS = 10000;

/**
 * Explains that the mobile app is for preview; substantive changes belong on the web tool.
 * Dismisses after {@link AUTO_DISMISS_MS} or when the user taps close; dismissal lasts for the app session.
 * @param {{ compact?: boolean, forceLight?: boolean, style?: import('react-native').ViewStyle }} props
 */
export default function PreviewWebNotice({ compact = false, forceLight = false, style }) {
  const { dismissed, dismiss } = usePreviewWebNoticeDismissal();
  const { isDark: themeDark } = useThemeMode();
  const isDark = forceLight ? false : themeDark;

  useEffect(() => {
    if (dismissed) return undefined;
    const id = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [dismissed, dismiss]);

  const openPortal = () => {
    Linking.openURL(MONITORING_WEB_PORTAL_URL).catch(() => {});
  };

  if (dismissed) return null;

  const bg = isDark ? 'rgba(148,163,184,0.12)' : '#eff6ff';
  const border = isDark ? 'rgba(148,163,184,0.22)' : 'rgba(33, 77, 134, 0.18)';
  const titleC = isDark ? '#f1f5f9' : colors.fdaBlue;
  const bodyC = isDark ? '#94a3b8' : colors.textMuted;
  const linkC = isDark ? '#6ee7b7' : colors.fdaGreen;
  const closeC = isDark ? '#94a3b8' : colors.textSubtle;

  return (
    <View
      style={[
        styles.wrap,
        compact ? styles.wrapCompact : null,
        { backgroundColor: bg, borderColor: border },
        style,
      ]}
    >
      <Ionicons
        name="phone-portrait-outline"
        size={compact ? 20 : 22}
        color={titleC}
        style={styles.icon}
      />
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: titleC }, compact && styles.titleCompact]} allowFontScaling={false}>
          Preview app
        </Text>
        <Text style={[styles.body, { color: bodyC }, compact && styles.bodyCompact]} allowFontScaling={false}>
          {compact
            ? 'View-only on mobile. To add or change data, use the web version.'
            : 'This mobile app is for preview and quick access. To create, edit, or submit changes, please use the full monitoring tool in your web browser.'}
        </Text>
        <Pressable onPress={openPortal} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
          <Text style={[styles.link, { color: linkC }]} allowFontScaling={false}>
            Open web version
            <Text style={styles.linkChevron}> →</Text>
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={dismiss}
        hitSlop={12}
        accessibilityLabel="Dismiss preview notice"
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.65 }]}
      >
        <Ionicons name="close-circle" size={compact ? 26 : 28} color={closeC} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    paddingRight: spacing.sm,
    gap: 10,
  },
  wrapCompact: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingRight: spacing.sm,
  },
  icon: {
    marginTop: 2,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  titleCompact: {
    fontSize: 14,
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    marginBottom: 10,
  },
  bodyCompact: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 8,
  },
  link: {
    fontSize: 14,
    fontWeight: '800',
    ...Platform.select({ android: { marginBottom: 4 } }),
  },
  linkChevron: {
    fontWeight: '800',
  },
  closeBtn: {
    marginTop: -4,
    marginRight: -4,
    padding: 4,
  },
});
