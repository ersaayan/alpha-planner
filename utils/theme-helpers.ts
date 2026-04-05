import { Colors } from '@/constants/theme';

type ColorScheme = 'light' | 'dark';

export function getPriorityColor(priority: string, colorScheme: ColorScheme = 'light'): string {
  const colors = Colors[colorScheme];
  switch (priority) {
    case 'urgent': return colors.error;
    case 'high': return colors.warning;
    case 'medium': return colors.info;
    case 'low': return colors.success;
    default: return colors.textSecondary;
  }
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
