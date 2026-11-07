import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export function tap() {
  if (enabled) Haptics.selectionAsync().catch(() => {});
}

export function success() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function error() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

