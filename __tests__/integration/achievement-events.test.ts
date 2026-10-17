/** Achievements unlocked by events, and their XP booked like any other XP. */
import { getAchievementById } from '@/constants/gamification';
import { useCategoryStore } from '@/stores/category-store';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { migrateGamificationState, useGamificationStore } from '@/stores/gamification-store';
import { useTodoStore } from '@/stores/todo-store';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS } from '@/types';
import { getDateKey } from '@/utils/date';

const reset = () => {
  useGamificationStore.setState({
    stats: { ...INITIAL_USER_STATS },
    unlockedAchievements: [],
    dailyStats: [],
    pendingNotifications: [],
    combo: { ...INITIAL_COMBO_STATE },
    prestige: { ...INITIAL_PRESTIGE_STATE },
  });
  useTodoStore.setState({ todos: [], filter: {} });
  useCategoryStore.setState({ categories: [], isInitialized: true });
};
const unlocked = (id: string) => useGamificationStore.getState().isAchievementUnlocked(id);

function finishQuestsAt(when: Date) {
  jest.setSystemTime(when);
  useDailyQuestsStore.setState({
    quests: [
      { id: 'q', date: getDateKey(when), questType: 'create_tasks', questParams: {}, targetValue: 1, currentValue: 0, isCompleted: false, xpReward: 20 },
    ],
  });
  useGamificationStore.getState().recordTaskCreated(when);
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 14, 9) });
  reset();
});
afterEach(() => jest.useRealTimers());

it('speed_runner: every quest done before noon', () => {
  finishQuestsAt(new Date(2026, 9, 14, 9, 30));
  expect(unlocked('speed_runner')).toBe(true);
  expect(unlocked('last_minute')).toBe(false);
});

it('last_minute: the last quest after 23:00', () => {
  finishQuestsAt(new Date(2026, 9, 14, 23, 15));
  expect(unlocked('last_minute')).toBe(true);
  expect(unlocked('speed_runner')).toBe(false);
});

it('a perfect day is counted for life and unlocks quest_beginner', () => {
  finishQuestsAt(new Date(2026, 9, 14, 15));
  expect(useGamificationStore.getState().stats.perfectQuestDays).toBe(1);
  expect(unlocked('quest_beginner')).toBe(true);
});

it('hundred_days unlocks on the 100th active day even with 90 days of history', () => {
  useGamificationStore.setState({ stats: { ...INITIAL_USER_STATS, activeDays: 99 } });
  useGamificationStore.getState().incrementPomodoro(1500, new Date(2026, 9, 14, 9));
  expect(useGamificationStore.getState().stats.activeDays).toBe(100);
  expect(unlocked('hundred_days')).toBe(true);
  // A second session the same day is not another active day.
  useGamificationStore.getState().incrementPomodoro(1500, new Date(2026, 9, 14, 10));
  expect(useGamificationStore.getState().stats.activeDays).toBe(100);
});

it('achievement XP is booked in the daily stats and lifetime XP', () => {
  useGamificationStore.getState().incrementPomodoro(1500, new Date(2026, 9, 14, 9));
  const { stats, dailyStats } = useGamificationStore.getState();
  expect(unlocked('first_focus')).toBe(true);
  expect(dailyStats[0].xpEarned).toBe(stats.totalXp);
  expect(stats.lifetimeXp).toBe(stats.totalXp);
});

it('creating the fifth own category unlocks organizer; the defaults do not', () => {
  useCategoryStore.getState().initializeCategories?.();
  useCategoryStore.setState({ isInitialized: false });
  useCategoryStore.getState().initializeCategories();
  useGamificationStore.getState().checkAchievements();
  expect(unlocked('organizer')).toBe(false);
  for (let i = 0; i < 5; i++) useCategoryStore.getState().addCategory({ name: `c${i}`, color: `#00000${i}`, icon: null, order: i });
  expect(unlocked('organizer')).toBe(true);
  expect(unlocked('color_collector')).toBe(true);
});

it('daily achievements look at the day of the event', () => {
  // Eight sessions credited after midnight for the day before.
  for (let i = 0; i < 8; i++) {
    useGamificationStore.getState().incrementPomodoro(1500, new Date(2026, 9, 13, 14 + i));
  }
  expect(unlocked('marathon_runner')).toBe(true);
});

it('gamification v2 → v3 migration', () => {
  const migrated = migrateGamificationState(
    {
      stats: { totalXp: 500 },
      dailyStats: [
        { date: '2026-10-02', pomodorosCompleted: 0, tasksCompleted: 2, dailyQuestsCompleted: 1 },
        { date: '2026-10-01', pomodorosCompleted: 3, tasksCompleted: 0, dailyQuestsCompleted: 0 },
        { date: '2026-10-03', pomodorosCompleted: 0, tasksCompleted: 0, dailyQuestsCompleted: 0 },
      ],
      prestige: { count: 2, history: [{ month: '2026-08', totalXp: 1000 }, { month: '2026-09', totalXp: 250 }] },
    },
    2
  );
  expect(migrated.dailyStats.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  expect(migrated.dailyStats[1]).toMatchObject({ dailyQuestsCompleted: 3, perfectQuestDay: true });
  expect(migrated.stats).toMatchObject({ activeDays: 2, perfectQuestDays: 1, lifetimeXp: 1750 });
  expect(getAchievementById('quest_beginner')).toBeDefined();
});
