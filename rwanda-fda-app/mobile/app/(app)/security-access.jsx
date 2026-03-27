import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { useThemeMode } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

function Row({ icon, title, subtitle, onPress, titleColor, muted, subtle, rowBg, rowBorder }) {
  return (
    <PressableScale style={[styles.rowButton, { backgroundColor: rowBg, borderColor: rowBorder }]} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: rowBg }]}>
        <Ionicons name={icon} size={18} color={colors.fdaGreen} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: muted }]}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={subtle} />
    </PressableScale>
  );
}

export default function SecurityAccess() {
  const { isDark } = useThemeMode();
  const { t } = useLanguage();
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  const bg = isDark ? '#0b1220' : colors.background;
  const panelBg = isDark ? 'rgba(17,24,39,0.9)' : colors.card;
  const panelBorder = isDark ? 'rgba(148,163,184,0.2)' : colors.border;
  const titleColor = isDark ? '#fff' : colors.text;
  const muted = isDark ? 'rgba(203,213,225,0.85)' : colors.textMuted;
  const subtle = isDark ? 'rgba(148,163,184,0.9)' : colors.textSubtle;
  const rowBg = isDark ? 'rgba(148,163,184,0.08)' : colors.cardSoft;
  const rowBorder = isDark ? 'rgba(148,163,184,0.22)' : colors.border;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FadeInView delay={0} translateY={10}>
          <LinearGradient
            colors={isDark ? ['#0f172a', '#111827', '#0f172a'] : ['#ffffff', '#f8fbff', '#effaf4']}
            style={[styles.heroCard, { borderColor: panelBorder }]}
          >
            <View style={styles.heroTopRow}>
              <PressableScale style={[styles.iconBack, { backgroundColor: panelBg, borderColor: panelBorder }]} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={20} color={titleColor} />
              </PressableScale>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroTitle, { color: titleColor }]}>{t('securityAccess')}</Text>
                <Text style={[styles.heroSub, { color: muted }]}>{t('secSub')}</Text>
              </View>
              <View style={[styles.brandLogoWrap, { backgroundColor: '#fff', borderColor: panelBorder }]}>
                <Ionicons name="shield-checkmark-outline" size={17} color={colors.fdaGreen} />
              </View>
            </View>
          </LinearGradient>
        </FadeInView>

        <FadeInView delay={80} translateY={8}>
          <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
            <Text style={[styles.panelTitle, { color: titleColor }]}>{t('accessDetails')}</Text>
            <Row
              icon="key-outline"
              title={t('changePassword')}
              subtitle={t('changePasswordSub')}
              onPress={() =>
                Linking.openURL('https://rwandafda.gov.rw/monitoring-tool/forgot_password.php').catch(() => {})
              }
              titleColor={titleColor}
              muted={muted}
              subtle={subtle}
              rowBg={rowBg}
              rowBorder={rowBorder}
            />
          </View>
        </FadeInView>

        <FadeInView delay={120} translateY={8}>
          <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
            <Text style={[styles.panelTitle, { color: titleColor }]}>{t('secPreferences')}</Text>

            <View style={[styles.toggleRow, { borderTopColor: rowBorder }]}>
              <View style={styles.toggleTextBlock}>
                <Text style={[styles.toggleLabel, { color: titleColor }]}>{t('useBiometrics')}</Text>
                <Text style={[styles.toggleSub, { color: subtle }]}>{t('useBiometricsSub')}</Text>
              </View>
              <Switch value={useBiometrics} onValueChange={setUseBiometrics} trackColor={{ true: colors.fdaGreenSoft }} />
            </View>

            <View style={[styles.toggleRow, { borderTopColor: rowBorder }]}>
              <View style={styles.toggleTextBlock}>
                <Text style={[styles.toggleLabel, { color: titleColor }]}>{t('rememberDevice')}</Text>
                <Text style={[styles.toggleSub, { color: subtle }]}>{t('rememberDeviceSub')}</Text>
              </View>
              <Switch value={rememberDevice} onValueChange={setRememberDevice} trackColor={{ true: colors.fdaGreenSoft }} />
            </View>
          </View>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 104, gap: spacing.md },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    ...shadow.card,
  },
  heroTopRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  iconBack: {
    width: 36,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 18, fontWeight: '900' },
  heroSub: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  brandLogoWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    ...shadow.soft,
  },
  panelTitle: { fontSize: 16, fontWeight: '900', marginBottom: spacing.sm },
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  rowSub: { fontSize: 12, marginTop: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  toggleTextBlock: { flex: 1 },
  toggleLabel: { fontSize: 13, fontWeight: '700' },
  toggleSub: { fontSize: 11.5, marginTop: 2 },
});
