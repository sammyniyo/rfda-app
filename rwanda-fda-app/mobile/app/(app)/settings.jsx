import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';
import { useThemeMode } from '../../context/ThemeContext';

export default function Settings() {
  const [taskUpdates, setTaskUpdates] = useState(true);
  const [appUpdates, setAppUpdates] = useState(true);
  const [meetingReminders, setMeetingReminders] = useState(true);
  const { themeMode, setThemeMode, isDark } = useThemeMode();
  const bg = isDark ? '#0b1220' : colors.background;
  const panelBg = isDark ? 'rgba(17,24,39,0.9)' : colors.card;
  const panelBorder = isDark ? 'rgba(148,163,184,0.2)' : colors.border;
  const titleColor = isDark ? '#fff' : colors.text;
  const muted = isDark ? 'rgba(203,213,225,0.85)' : colors.textMuted;
  const subtle = isDark ? 'rgba(148,163,184,0.9)' : colors.textSubtle;

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
                <Text style={[styles.heroTitle, { color: titleColor }]}>Settings</Text>
                <Text style={[styles.heroSub, { color: muted }]}>Control alerts, meetings and app preferences.</Text>
              </View>
            </View>
          </LinearGradient>
        </FadeInView>

        <FadeInView delay={80} translateY={10}>
          <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
            <Text style={[styles.panelTitle, { color: titleColor }]}>Appearance</Text>
            <Text style={[styles.panelSub, { color: muted }]}>Choose Light, Dark, or follow your device setting.</Text>
            <View style={styles.modeRow}>
              {[
                { key: 'light', label: 'Light' },
                { key: 'dark', label: 'Dark' },
                { key: 'system', label: 'System' },
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
            <Text style={[styles.panelTitle, { color: titleColor }]}>Notifications</Text>
            <Text style={[styles.panelSub, { color: muted }]}>These are local preferences. API integration will come later.</Text>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={[styles.toggleLabel, { color: titleColor }]}>Task updates</Text>
                <Text style={[styles.toggleSub, { color: subtle }]}>Alerts when tasks change status or are close to due.</Text>
              </View>
              <Switch value={taskUpdates} onValueChange={setTaskUpdates} trackColor={{ true: colors.fdaGreenSoft }} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={[styles.toggleLabel, { color: titleColor }]}>Application updates</Text>
                <Text style={[styles.toggleSub, { color: subtle }]}>Notifications for submissions, approvals and holds.</Text>
              </View>
              <Switch value={appUpdates} onValueChange={setAppUpdates} trackColor={{ true: colors.fdaGreenSoft }} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={[styles.toggleLabel, { color: titleColor }]}>Meeting reminders</Text>
                <Text style={[styles.toggleSub, { color: subtle }]}>Prepare for upcoming review and coordination meetings.</Text>
              </View>
              <Switch value={meetingReminders} onValueChange={setMeetingReminders} trackColor={{ true: colors.fdaGreenSoft }} />
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={140} translateY={10}>
          <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
            <View style={styles.panelHeaderRow}>
              <Text style={[styles.panelTitle, { color: titleColor }]}>Meetings</Text>
              <Text style={styles.comingSoonPill}>Coming soon</Text>
            </View>
            <Text style={[styles.panelSub, { color: muted }]}>
              This app will later include a meetings module for scheduling, agendas, and action tracking across teams.
            </Text>
            <View style={[styles.meetingCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardSoft, borderColor: panelBorder }]}>
              <Ionicons name="calendar-outline" size={18} color={colors.fdaGreen} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.meetingTitle, { color: titleColor }]}>No upcoming meetings</Text>
                <Text style={[styles.meetingSub, { color: muted }]}>Once enabled, your next FDA meetings will appear here.</Text>
              </View>
            </View>
          </View>
        </FadeInView>
      </ScrollView>
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
  meetingCard: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meetingTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  meetingSub: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 18 },
});

