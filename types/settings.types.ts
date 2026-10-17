import type { TodoViewType } from './todo.types';

export interface AppSettings {
  hasCompletedOnboarding: boolean;
  theme: 'light' | 'dark' | 'system';
  defaultView: TodoViewType;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  /** 0 = Sunday, 1 = Monday, 'auto' = the language's convention (Monday in Turkish, Sunday in English). */
  weekStartsOn: 0 | 1 | 'auto';
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  language: 'tr' | 'en' | 'system';
  /** Dashboard cards the user has folded to their header. */
  collapsedDashboardCards: DashboardCardId[];
}

/** The Dashboard's collapsible cards. */
export type DashboardCardId = 'quests' | 'goals' | 'season';
export const DASHBOARD_CARD_IDS: readonly DashboardCardId[] = ['quests', 'goals', 'season'];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  hasCompletedOnboarding: false,
  theme: 'system',
  defaultView: 'list',
  notificationsEnabled: true,
  soundEnabled: true,
  hapticFeedbackEnabled: true,
  weekStartsOn: 'auto',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  language: 'system',
  // The season card starts folded: it is reference information, not today's work.
  collapsedDashboardCards: ['season'],
};
