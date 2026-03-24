import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

function canHaptic() {
  return Platform.OS !== 'web';
}

export async function hapticTap() {
  if (!canHaptic()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

export async function hapticSuccess() {
  if (!canHaptic()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

export async function hapticError() {
  if (!canHaptic()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
}
