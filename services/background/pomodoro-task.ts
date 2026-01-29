import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../notifications';

export const POMODORO_BACKGROUND_TASK = 'pomodoro-background-task';

// Define the background task
TaskManager.defineTask(POMODORO_BACKGROUND_TASK, async () => {
  try {
    // This task runs periodically when app is in background
    // We use it mainly to schedule notifications
    // The actual timer state is managed by startedAt timestamp
    console.log('Background task executed');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundTask(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(POMODORO_BACKGROUND_TASK, {
      minimumInterval: 60, // 1 minute minimum
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('Background task registered');
  } catch (error) {
    console.error('Failed to register background task:', error);
  }
}

export async function unregisterBackgroundTask(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(POMODORO_BACKGROUND_TASK);
    console.log('Background task unregistered');
  } catch (error) {
    console.error('Failed to unregister background task:', error);
  }
}

// Schedule a notification for when the timer should complete
export async function scheduleTimerNotification(
  phase: 'focus' | 'short_break' | 'long_break',
  remainingSeconds: number
): Promise<void> {
  if (remainingSeconds <= 0) return;

  const messages = {
    focus: {
      title: 'Focus Complete! 🎯',
      body: 'Great work! Time for a break.',
    },
    short_break: {
      title: 'Break Over! ☕',
      body: 'Ready to focus again?',
    },
    long_break: {
      title: 'Long Break Over! 🌟',
      body: 'Feeling refreshed? Let\'s get back to work!',
    },
  };

  const message = messages[phase];
  const triggerDate = new Date(Date.now() + remainingSeconds * 1000);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: message.title,
      body: message.body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

export async function cancelScheduledTimerNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
