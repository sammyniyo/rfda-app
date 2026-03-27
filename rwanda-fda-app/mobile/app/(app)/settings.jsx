import { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { useThemeMode } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function Settings() {
  const { logout } = useAuth();
  const [taskUpdates, setTaskUpdates] = useState(true);
  const [appUpdates, setAppUpdates] = useState(true);
  const [meetingReminders, setMeetingReminders] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { themeMode, setThemeMode, isDark } = useThemeMode();
  const { language, setLanguage, t } = useLanguage();
  const bg = isDark ? '#0b1220' : colors.background;
  const panelBg = isDark ? 'rgba(17,24,39,0.9)' : colors.card;
  const panelBorder = isDark ? 'rgba(148,163,184,0.2)' : colors.border;
  const titleColor = isDark ? '#fff' : colors.text;
  const muted = isDark ? 'rgba(203,213,225,0.85)' : colors.textMuted;
  const subtle = isDark ? 'rgba(148,163,184,0.9)' : colors.textSubtle;
  const rowBg = isDark ? 'rgba(148,163,184,0.08)' : colors.cardSoft;
  const rowBorder = isDark ? 'rgba(148,163,184,0.2)' : colors.border;
  const cardIconBg = isDark ? 'rgba(15,94,71,0.24)' : '#eef6f4';

  const shareText = useMemo(
    () =>
      'Join Rwanda FDA mobile app to manage applications, tasks and updates.\n\nDownload link: https://rwandafda.gov.rw/',
    []
  );

  async function handleShareInvite() {
    try {
      await Share.share({
        message: shareText,
        title: 'Share Rwanda FDA app',
      });
    } catch {
      // no-op
    }
  }

  function openPolicy() {
    Linking.openURL('https://rwandafda.gov.rw/privacy-policy').catch(() => {});
  }

  function openStoreRating() {
    Linking.openURL('https://apps.apple.com/').catch(() => {});
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={[styles.container, { backgroundColor: bg }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <FadeInView delay={0} translateY={12}>
          <LinearGradient colors={isDark ? ['#0f172a', '#111827', '#0f172a'] : ['#ffffff', '#f8fbff', '#effaf4']} style={[styles.heroCard, { borderColor: panelBorder }]}>
            <View style={styles.heroTopRow}>
              <PressableScale style={[styles.iconBack, { backgroundColor: panelBg, borderColor: panelBorder }]} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={20} color={titleColor} />
              </PressableScale>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroTitle, { color: titleColor }]}>{t('settings')}</Text>
                <Text style={[styles.heroSub, { color: muted }]}>{t('settingsSub')}</Text>
              </View>
            </View>
          </LinearGradient>
        </FadeInView>

        <FadeInView delay={80} translateY={10}>
          <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
            <Text style={[styles.panelTitle, { color: titleColor }]}>{t('appearance')}</Text>
            <Text style={[styles.panelSub, { color: muted }]}>{t('appearanceSub')}</Text>
            <View style={styles.modeRow}>
              {[
                { key: 'light', label: t('light') },
                { key: 'dark', label: t('dark') },
                { key: 'system', label: t('system') },
              ].map((mode) => (
                <PressableScale
                  key={mode.key}
                  style={[
                    styles.modeChip,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardSoft, borderColor: panelBorder },
                    themeMode === mode.key && styles.modeChipActive,
                  ]}
                  onPress={() => setThemeMode(mode.key)}
                >
                  <Text
                    style={[
                      styles.modeChipText,
                      { color: isDark ? '#cbd5e1' : colors.textMuted },
                      themeMode === mode.key && styles.modeChipTextActive,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={100} translateY={10}>
          <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
            <Text style={[styles.panelTitle, { color: titleColor }]}>{t('profileSection')}</Text>
            <Text style={[styles.panelSub, { color: muted }]}>{t('profileSectionSub')}</Text>

            <PressableScale style={[styles.rowButton, { backgroundColor: rowBg, borderColor: rowBorder }]} onPress={() => router.push('/(app)/profile')}>
              <View style={[styles.rowIcon, { backgroundColor: cardIconBg }]}>
                <Ionicons name="person-outline" size={18} color={colors.fdaGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: titleColor }]}>{t('profileInformation')}</Text>
                <Text style={[styles.rowSub, { color: muted }]}>{t('profileInformationSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtle} />
            </PressableScale>

            <PressableScale style={[styles.rowButton, { backgroundColor: rowBg, borderColor: rowBorder }]} onPress={() => router.push('/(app)/security-access')}>
              <View style={[styles.rowIcon, { backgroundColor: cardIconBg }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.fdaGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: titleColor }]}>{t('securityAccess')}</Text>
                <Text style={[styles.rowSub, { color: muted }]}>{t('securityAccessSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtle} />
            </PressableScale>

            <PressableScale style={[styles.rowButton, { backgroundColor: rowBg, borderColor: rowBorder }]} onPress={() => Linking.openURL('mailto:ict.support@rwandafda.gov.rw').catch(() => {})}>
              <View style={[styles.rowIcon, { backgroundColor: cardIconBg }]}>
                <Ionicons name="help-circle-outline" size={18} color={colors.fdaGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: titleColor }]}>{t('helpSupport')}</Text>
                <Text style={[styles.rowSub, { color: muted }]}>ict.support@rwandafda.gov.rw</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtle} />
            </PressableScale>
          </View>
        </FadeInView>

        <FadeInView delay={120} translateY={10}>
          <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
            <Text style={[styles.panelTitle, { color: titleColor }]}>{t('notifications')}</Text>
            <Text style={[styles.panelSub, { color: muted }]}>{t('notificationsSub')}</Text>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={[styles.toggleLabel, { color: titleColor }]}>{t('taskUpdates')}</Text>
                <Text style={[styles.toggleSub, { color: subtle }]}>{t('taskUpdatesSub')}</Text>
              </View>
              <Switch value={taskUpdates} onValueChange={setTaskUpdates} trackColor={{ true: colors.fdaGreenSoft }} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={[styles.toggleLabel, { color: titleColor }]}>{t('applicationUpdates')}</Text>
                <Text style={[styles.toggleSub, { color: subtle }]}>{t('applicationUpdatesSub')}</Text>
              </View>
              <Switch value={appUpdates} onValueChange={setAppUpdates} trackColor={{ true: colors.fdaGreenSoft }} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={[styles.toggleLabel, { color: titleColor }]}>{t('meetingReminders')}</Text>
                <Text style={[styles.toggleSub, { color: subtle }]}>{t('meetingRemindersSub')}</Text>
              </View>
              <Switch value={meetingReminders} onValueChange={setMeetingReminders} trackColor={{ true: colors.fdaGreenSoft }} />
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={140} translateY={10}>
          <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
            <View style={styles.panelHeaderRow}>
              <Text style={[styles.panelTitle, { color: titleColor }]}>{t('appSettings')}</Text>
              <Text style={styles.comingSoonPill}>{t('more')}</Text>
            </View>

            <PressableScale
              style={[styles.rowButton, { backgroundColor: rowBg, borderColor: rowBorder }]}
              onPress={async () => {
                try {
                  await logout();
                  router.replace('/');
                } catch {
                  // no-op
                }
              }}
            >
              <View style={[styles.rowIcon, { backgroundColor: isDark ? 'rgba(220,38,38,0.18)' : '#fef2f2' }]}>
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: titleColor }]}>{t('logout')}</Text>
                <Text style={[styles.rowSub, { color: muted }]}>{t('logoutSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtle} />
            </PressableScale>

            <PressableScale style={[styles.rowButton, { backgroundColor: rowBg, borderColor: rowBorder }]} onPress={openStoreRating}>
              <View style={[styles.rowIcon, { backgroundColor: cardIconBg }]}>
                <Ionicons name="star-outline" size={18} color={colors.fdaGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: titleColor }]}>{t('rateUs')}</Text>
                <Text style={[styles.rowSub, { color: muted }]}>{t('rateUsSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtle} />
            </PressableScale>

            <PressableScale style={[styles.rowButton, { backgroundColor: rowBg, borderColor: rowBorder }]} onPress={() => setShowInviteModal(true)}>
              <View style={[styles.rowIcon, { backgroundColor: cardIconBg }]}>
                <Ionicons name="share-social-outline" size={18} color={colors.fdaGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: titleColor }]}>{t('inviteFriend')}</Text>
                <Text style={[styles.rowSub, { color: muted }]}>{t('inviteFriendSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtle} />
            </PressableScale>

            <PressableScale style={[styles.rowButton, { backgroundColor: rowBg, borderColor: rowBorder }]} onPress={openPolicy}>
              <View style={[styles.rowIcon, { backgroundColor: cardIconBg }]}>
                <Ionicons name="document-text-outline" size={18} color={colors.fdaGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: titleColor }]}>{t('dataPolicy')}</Text>
                <Text style={[styles.rowSub, { color: muted }]}>{t('dataPolicySub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtle} />
            </PressableScale>

            <View style={[styles.rowButton, { backgroundColor: rowBg, borderColor: rowBorder }]}>
              <View style={[styles.rowIcon, { backgroundColor: cardIconBg }]}>
                <Ionicons name="language-outline" size={18} color={colors.fdaGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: titleColor }]}>{t('language')}</Text>
                <Text style={[styles.rowSub, { color: muted }]}>
                  {language === 'fr' ? t('french') : t('english')}
                </Text>
                <View style={styles.modeRow}>
                  <PressableScale
                    style={[
                      styles.modeChip,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardSoft, borderColor: panelBorder },
                      language === 'en' && styles.modeChipActive,
                    ]}
                    onPress={() => setLanguage('en')}
                  >
                    <Text
                      style={[
                        styles.modeChipText,
                        { color: isDark ? '#cbd5e1' : colors.textMuted },
                        language === 'en' && styles.modeChipTextActive,
                      ]}
                    >
                      {t('english')}
                    </Text>
                  </PressableScale>
                  <PressableScale
                    style={[
                      styles.modeChip,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardSoft, borderColor: panelBorder },
                      language === 'fr' && styles.modeChipActive,
                    ]}
                    onPress={() => setLanguage('fr')}
                  >
                    <Text
                      style={[
                        styles.modeChipText,
                        { color: isDark ? '#cbd5e1' : colors.textMuted },
                        language === 'fr' && styles.modeChipTextActive,
                      ]}
                    >
                      {t('french')}
                    </Text>
                  </PressableScale>
                </View>
              </View>
            </View>
          </View>
        </FadeInView>
      </ScrollView>

      <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: panelBg, borderColor: panelBorder }]}>
            <PressableScale style={styles.modalClose} onPress={() => setShowInviteModal(false)}>
              <Ionicons name="close" size={18} color={colors.fdaBlue} />
            </PressableScale>
            <View style={[styles.modalIllustration, { backgroundColor: isDark ? 'rgba(15,94,71,0.24)' : colors.fdaGreenSoft }]}>
              <Ionicons name="people-outline" size={28} color={colors.fdaBlue} />
            </View>
            <Text style={[styles.modalTitle, { color: titleColor }]}>{t('shareWithFriends')}</Text>
            <Text style={[styles.modalSub, { color: muted }]}>
              {t('shareSub')}
            </Text>
            <PressableScale style={styles.modalCta} onPress={handleShareInvite}>
              <Text style={styles.modalCtaText}>{t('shareCta')}</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 104, gap: spacing.md },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  heroTopRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  iconBack: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  heroSub: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.soft,
  },
  panelHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  panelTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  panelSub: { color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: spacing.sm },
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
    borderTopColor: colors.border,
  },
  toggleTextBlock: { flex: 1 },
  toggleLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  toggleSub: { color: colors.textSubtle, fontSize: 11.5, marginTop: 2 },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  modeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.cardSoft,
  },
  modeChipActive: {
    backgroundColor: colors.fdaGreenSoft,
    borderColor: 'rgba(15,94,71,0.18)',
  },
  modeChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  modeChipTextActive: { color: colors.fdaGreen },
  comingSoonPill: {
    color: colors.fdaGreen,
    backgroundColor: colors.fdaGreenSoft,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  modalCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md + 2,
    ...shadow.card,
  },
  modalClose: {
    alignSelf: 'flex-end',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f0f8',
  },
  modalIllustration: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing.xs,
  },
  modalTitle: {
    textAlign: 'center',
    fontSize: 28 / 1.5,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  modalSub: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  modalCta: {
    backgroundColor: colors.fdaBlue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCtaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});

