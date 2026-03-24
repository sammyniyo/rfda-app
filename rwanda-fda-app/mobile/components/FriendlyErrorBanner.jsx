import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../constants/theme';
import PressableScale from './PressableScale';

const ICONS = {
  network: 'cloud-offline-outline',
  server: 'server-outline',
  auth: 'lock-closed-outline',
  timeout: 'hourglass-outline',
  unknown: 'alert-circle-outline',
};

/**
 * @param {{ info: { title: string, message: string, kind?: string } | null, onRetry?: () => void, isDark?: boolean }}
 */
export default function FriendlyErrorBanner({ info, onRetry, isDark }) {
  if (!info) return null;
  const kind = info.kind || 'unknown';
  const icon = ICONS[kind] || ICONS.unknown;
  const bg = isDark ? '#1e293b' : '#fef2f2';
  const border = isDark ? 'rgba(248,113,113,0.35)' : '#fecaca';
  const titleColor = isDark ? '#f8fafc' : colors.text;
  const msgColor = isDark ? '#94a3b8' : colors.textMuted;

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(248,113,113,0.15)' : '#fee2e2' }]}>
          <Ionicons name={icon} size={22} color={colors.danger} />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: titleColor }]}>{info.title}</Text>
          <Text style={[styles.message, { color: msgColor }]}>{info.message}</Text>
        </View>
      </View>
      {onRetry ? (
        <PressableScale style={styles.retryBtn} onPress={onRetry} hapticType="light">
          <Ionicons name="refresh-outline" size={18} color="#fff" />
          <Text style={styles.retryText}>Try again</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800' },
  message: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  retryBtn: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.fdaGreen,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
