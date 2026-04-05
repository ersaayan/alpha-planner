import type { TodoViewType } from './todo.types';

export interface AppSettings {
  hasCompletedOnboarding: boolean;
  theme: 'light' | 'dark' | 'system';
  defaultView: TodoViewType;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  language: 'tr' | 'en' | 'system';
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  hasCompletedOnboarding: false,
  theme: 'system',
  defaultView: 'list',
  notificationsEnabled: true,
  soundEnabled: true,
  hapticFeedbackEnabled: true,
  weekStartsOn: 1,
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  language: 'system',
};
