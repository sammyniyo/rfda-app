import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import FadeInView from '../../components/FadeInView';
import PressableScale from '../../components/PressableScale';

export default function Settings() {
  const { perfType, setPerfType } = useAuth();
  const [taskUpdates, setTaskUpdates] = useState(true);
  const [appUpdates, setAppUpdates] = useState(true);
  const [meetingReminders, setMeetingReminders] = useState(true);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <FadeInView delay={0} translateY={12}>
          <LinearGradient colors={['#ffffff', '#f8fbff', '#effaf4']} style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <PressableScale style={styles.iconBack} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </PressableScale>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Settings</Text>
                <Text style={styles.heroSub}>Control alerts, meetings and app preferences.</Text>
              </View>
            </View>
          </LinearGradient>
        </FadeInView>

        <FadeInView delay={80} translateY={10}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Performance data</Text>
            <Text style={styles.panelSub}>
              Select the API type used for your unit (example: <Text style={{ fontWeight: '800' }}>hmdr-med</Text>).
            </Text>
            <View style={styles.typeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Application type code</Text>
                <Text style={styles.toggleSub}>Used in `performance_api.php?type=...`</Text>
              </View>
              <TextInput
                value={perfType}
                onChangeText={setPerfType}
                autoCapitalize="none"
                style={styles.typeInput}
                placeholder="e.g. hmdr-med"
                placeholderTextColor={colors.textSubtle}
              />
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={110} translateY={10}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Notifications</Text>
            <Text style={styles.panelSub}>These are local preferences. API integration will come later.</Text>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={styles.toggleLabel}>Task updates</Text>
                <Text style={styles.toggleSub}>Alerts when tasks change status or are close to due.</Text>
              </View>
              <Switch value={taskUpdates} onValueChange={setTaskUpdates} trackColor={{ true: colors.fdaGreenSoft }} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={styles.toggleLabel}>Application updates</Text>
                <Text style={styles.toggleSub}>Notifications for submissions, approvals and holds.</Text>
              </View>
              <Switch value={appUpdates} onValueChange={setAppUpdates} trackColor={{ true: colors.fdaGreenSoft }} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={styles.toggleLabel}>Meeting reminders</Text>
                <Text style={styles.toggleSub}>Prepare for upcoming review and coordination meetings.</Text>
              </View>
              <Switch value={meetingReminders} onValueChange={setMeetingReminders} trackColor={{ true: colors.fdaGreenSoft }} />
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={150} translateY={10}>
          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <Text style={styles.panelTitle}>Meetings</Text>
              <Text style={styles.comingSoonPill}>Coming soon</Text>
            </View>
            <Text style={styles.panelSub}>
              This app will later include a meetings module for scheduling, agendas, and action tracking across teams.
            </Text>
            <View style={styles.meetingCard}>
              <Ionicons name="calendar-outline" size={18} color={colors.fdaGreen} />
              <View style={{ flex: 1 }}>
                <Text style={styles.meetingTitle}>No upcoming meetings</Text>
                <Text style={styles.meetingSub}>Once enabled, your next FDA meetings will appear here.</Text>
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
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  typeInput: {
    minWidth: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
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

