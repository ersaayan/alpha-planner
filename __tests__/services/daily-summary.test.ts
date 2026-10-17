/** The daily summary reads the local day, in the stores' own terms. */
import { getDailySummaryData } from '@/services/gamification/daily-summary';
import { useCategoryStore } from '@/stores/category-store';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { usePomodoroStore } from '@/stores/pomodoro-store';
import { useTodoStore } from '@/stores/todo-store';
import { INITIAL_COMBO_STATE, INITIAL_PRESTIGE_STATE, INITIAL_USER_STATS, type PomodoroSession } from '@/types';

const DAY = '2026-10-14';

beforeEach(() => {
  useGamificationStore.setState({
    stats: { ...INITIAL_USER_STATS },
    unlockedAchievements: [],
    dailyStats: [
      { date: '2026-10-13', pomodorosCompleted: 1, focusTime: 1500, tasksCompleted: 1, xpEarned: 20, dailyQuestsCompleted: 0, summaryShownAt: null },
      { date: DAY, pomodorosCompleted: 3, focusTime: 4500, tasksCompleted: 2, xpEarned: 80, dailyQuestsCompleted: 3, summaryShownAt: null, subtasksCompleted: 4 },
    ],
    pendingNotifications: [],
    combo: { ...INITIAL_COMBO_STATE },
    prestige: { ...INITIAL_PRESTIGE_STATE },
  });
  useCategoryStore.setState({ categories: [{ id: 'work', name: 'Work', color: '#000', icon: null, isDefault: false, order: 0, createdAt: '' }] });
  useTodoStore.setState({
    todos: [{
      id: 't1', title: 'T', description: null, dueDate: null, status: 'pending', categoryId: 'work', priority: 'medium',
      subtasks: [], pomodoroSessions: 0, estimatedPomodoros: null, createdAt: '', updatedAt: '', completedAt: null, order: 0,
    }],
  });
  useDailyQuestsStore.setState({
    quests: ['a', 'b', 'c'].map((id) => ({ id, date: DAY, questType: 'complete_tasks', questParams: {}, targetValue: 1, currentValue: 1, isCompleted: true, xpReward: 20 })),
  });
});

it('summarizes the requested day, not today', () => {
  const data = getDailySummaryData(DAY);
  expect(data).toMatchObject({
    pomodorosCompleted: 3,
    tasksCompleted: 2,
    subtasksCompleted: 4,
    xpEarned: 80,
    dailyQuestsStatus: { completed: 3, total: 3 },
    deltaFromYesterday: { pomodoros: 2, focusTime: 3000, tasks: 1 },
    motivationLevel: 'great',
  });
});

it('a session that ends late in the evening counts for its local day (it is the next day in UTC)', () => {
  // 21:30 in New York is 01:30 UTC on the 15th.
  const session: PomodoroSession = {
    id: 's', todoId: 't1', phase: 'focus', startedAt: new Date(2026, 9, 14, 21, 5).toISOString(),
    endedAt: new Date(2026, 9, 14, 21, 30).toISOString(), pausedDuration: 0, wasCompleted: true, duration: 1500, targetDuration: 1500,
  };
  expect(session.endedAt!.startsWith('2026-10-15')).toBe(true);
  usePomodoroStore.setState({ sessions: [session] });

  expect(getDailySummaryData(DAY).topCategory).toEqual({ name: 'Work', time: 1500 });
  expect(getDailySummaryData('2026-10-15').topCategory).toBeNull();
});

describe('the summary of yesterday on the first open of the day', () => {
  const { getPendingSummaryDate, markSummaryShown } = jest.requireActual('@/services/gamification/daily-summary');
  const morning = new Date(2026, 9, 15, 8, 0); // the day after DAY

  it('is pending once, and not after it was shown', () => {
    const { dailyStats } = useGamificationStore.getState();
    expect(getPendingSummaryDate(dailyStats, morning)).toBe(DAY);
    markSummaryShown(DAY);
    expect(getPendingSummaryDate(useGamificationStore.getState().dailyStats, morning)).toBeNull();
  });

  it('is not shown for a day without activity, or at any hour of the same day', () => {
    expect(getPendingSummaryDate([], morning)).toBeNull();
    const { dailyStats } = useGamificationStore.getState();
    expect(getPendingSummaryDate(dailyStats, new Date(2026, 9, 14, 23, 30))).toBe('2026-10-13');
  });
});

describe('notification taps', () => {
  const { routeForAppNotification } = jest.requireActual('@/services/notifications/app-notification-routes');
  const { useSummaryRequest } = jest.requireActual('@/services/gamification/summary-request');
  const tap = (data: Record<string, unknown>, date: number, identifier = 'x') =>
    ({ actionIdentifier: 'default', notification: { date, request: { identifier, content: { data } } } }) as never;

  it("the 23:00 notification opens that day's summary, even when tapped after midnight", () => {
    const firedAt = new Date(2026, 9, 14, 23, 0).getTime();
    expect(routeForAppNotification(tap({ kind: 'daily-summary' }, firedAt, 'daily-summary-notification'))).toBe('/');
    expect(useSummaryRequest.getState().dateKey).toBe(DAY);
    // The same response delivered twice (launch + listener) is handled once.
    expect(routeForAppNotification(tap({ kind: 'daily-summary' }, firedAt, 'daily-summary-notification'))).toBeNull();
  });

  it('a task reminder opens the task; other notifications are not routed here', () => {
    expect(routeForAppNotification(tap({ kind: 'task-reminder', todoId: 't1' }, 1))).toBe('/todo/t1');
    expect(routeForAppNotification(tap({ kind: 'pomodoro-phase-end' }, 2))).toBeNull();
  });
});
