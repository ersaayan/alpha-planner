jest.mock('@/stores/gamification-store', () => ({
  useGamificationStore: {
    getState: jest.fn(() => ({
      dailyStats: [],
      addXp: jest.fn(),
      recordWeeklyGoalCompleted: jest.fn(),
    })),
  },
}));

jest.mock('@/stores/sync-store', () => ({
  useSyncStore: {
    getState: jest.fn(() => ({ enqueue: jest.fn() })),
  },
}));

import { useWeeklyGoalsStore } from '@/stores/weekly-goals-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { useSyncStore } from '@/stores/sync-store';
import { SYSTEM_WEEKLY_GOAL_COUNT, PERSONAL_GOAL_XP } from '@/constants/weekly-goals';
import { startOfWeek, format } from 'date-fns';

function getWeekKey(date?: Date): string {
  const d = date ?? new Date();
  const weekStart = startOfWeek(d, { weekStartsOn: 1 });
  return format(weekStart, 'yyyy-MM-dd');
}

const INITIAL_STATE = {
  goals: [],
  lastGeneratedWeek: null,
};

beforeEach(() => {
  useWeeklyGoalsStore.setState(INITIAL_STATE);
  jest.clearAllMocks();
});

describe('useWeeklyGoalsStore', () => {
  // ── ensureThisWeekGoals ───────────────────────────────────────────────

  it('ensureThisWeekGoals: generates system goals', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });
    (useGamificationStore.getState as jest.Mock).mockReturnValue({
      dailyStats: [],
      addXp: jest.fn(),
      recordWeeklyGoalCompleted: jest.fn(),
    });

    useWeeklyGoalsStore.getState().ensureThisWeekGoals();

    const { goals, lastGeneratedWeek } = useWeeklyGoalsStore.getState();
    expect(goals).toHaveLength(SYSTEM_WEEKLY_GOAL_COUNT);
    expect(lastGeneratedWeek).toBe(getWeekKey());

    for (const goal of goals) {
      expect(goal.goalType).toBe('system');
      expect(goal.weekStart).toBe(getWeekKey());
      expect(goal.currentValue).toBe(0);
      expect(goal.isCompleted).toBe(false);
    }
  });

  it('ensureThisWeekGoals: idempotent (does not regenerate same week)', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });
    (useGamificationStore.getState as jest.Mock).mockReturnValue({
      dailyStats: [],
      addXp: jest.fn(),
      recordWeeklyGoalCompleted: jest.fn(),
    });

    useWeeklyGoalsStore.getState().ensureThisWeekGoals();
    const firstGoals = useWeeklyGoalsStore.getState().goals;
    const firstIds = firstGoals.map((g) => g.id);

    useWeeklyGoalsStore.getState().ensureThisWeekGoals();
    const secondGoals = useWeeklyGoalsStore.getState().goals;
    const secondIds = secondGoals.map((g) => g.id);

    expect(secondIds).toEqual(firstIds);
  });

  it('ensureThisWeekGoals: syncs each goal', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });
    (useGamificationStore.getState as jest.Mock).mockReturnValue({
      dailyStats: [],
      addXp: jest.fn(),
      recordWeeklyGoalCompleted: jest.fn(),
    });

    useWeeklyGoalsStore.getState().ensureThisWeekGoals();

    expect(mockEnqueue).toHaveBeenCalledTimes(SYSTEM_WEEKLY_GOAL_COUNT);
    for (let i = 0; i < SYSTEM_WEEKLY_GOAL_COUNT; i++) {
      expect(mockEnqueue).toHaveBeenCalledWith('weekly_goals', 'insert', expect.objectContaining({
        goal_type: 'system',
      }));
    }
  });

  // ── setPersonalGoal ───────────────────────────────────────────────────

  it('setPersonalGoal: creates personal goal with correct fields', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });

    useWeeklyGoalsStore.getState().setPersonalGoal('tasks', 10);

    const goals = useWeeklyGoalsStore.getState().goals;
    const personal = goals.find((g) => g.goalType === 'personal');
    expect(personal).toBeDefined();
    expect(personal?.goalParams).toEqual({ metric: 'tasks' });
    expect(personal?.targetValue).toBe(10);
    expect(personal?.currentValue).toBe(0);
    expect(personal?.isCompleted).toBe(false);
    expect(personal?.xpReward).toBe(PERSONAL_GOAL_XP);
    expect(personal?.weekStart).toBe(getWeekKey());
  });

  it('setPersonalGoal: updates existing personal goal', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });

    useWeeklyGoalsStore.getState().setPersonalGoal('tasks', 10);
    const firstGoal = useWeeklyGoalsStore.getState().goals.find((g) => g.goalType === 'personal');

    useWeeklyGoalsStore.getState().setPersonalGoal('pomodoros', 20);

    const goals = useWeeklyGoalsStore.getState().goals;
    const personalGoals = goals.filter((g) => g.goalType === 'personal');
    expect(personalGoals).toHaveLength(1);
    expect(personalGoals[0].goalParams).toEqual({ metric: 'pomodoros' });
    expect(personalGoals[0].targetValue).toBe(20);
    // ID should stay the same (updated, not recreated)
    expect(personalGoals[0].id).toBe(firstGoal?.id);
  });

  // ── updateGoalProgress ────────────────────────────────────────────────

  it('updateGoalProgress: increments currentValue', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });
    const mockAddXp = jest.fn();
    (useGamificationStore.getState as jest.Mock).mockReturnValue({
      dailyStats: [],
      addXp: mockAddXp,
      recordWeeklyGoalCompleted: jest.fn(),
    });

    useWeeklyGoalsStore.getState().setPersonalGoal('tasks', 10);
    useWeeklyGoalsStore.getState().updateGoalProgress('tasks', 3);

    const goal = useWeeklyGoalsStore.getState().goals.find((g) => g.goalType === 'personal');
    expect(goal?.currentValue).toBe(3);
    expect(goal?.isCompleted).toBe(false);
  });

  it('updateGoalProgress: marks completed when target reached', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });
    const mockAddXp = jest.fn();
    (useGamificationStore.getState as jest.Mock).mockReturnValue({
      dailyStats: [],
      addXp: mockAddXp,
      recordWeeklyGoalCompleted: jest.fn(),
    });

    useWeeklyGoalsStore.getState().setPersonalGoal('tasks', 5);
    useWeeklyGoalsStore.getState().updateGoalProgress('tasks', 5);

    const goal = useWeeklyGoalsStore.getState().goals.find((g) => g.goalType === 'personal');
    expect(goal?.isCompleted).toBe(true);
    expect(goal?.currentValue).toBe(5);
    expect(mockAddXp).toHaveBeenCalledWith(PERSONAL_GOAL_XP, expect.any(Date));
  });

  it('updateGoalProgress: does not exceed target value', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });
    const mockAddXp = jest.fn();
    (useGamificationStore.getState as jest.Mock).mockReturnValue({
      dailyStats: [],
      addXp: mockAddXp,
      recordWeeklyGoalCompleted: jest.fn(),
    });

    useWeeklyGoalsStore.getState().setPersonalGoal('tasks', 5);
    useWeeklyGoalsStore.getState().updateGoalProgress('tasks', 100);

    const goal = useWeeklyGoalsStore.getState().goals.find((g) => g.goalType === 'personal');
    expect(goal?.currentValue).toBe(5);
  });

  // ── getThisWeekGoals ──────────────────────────────────────────────────

  it('getThisWeekGoals: returns only current week goals', () => {
    const mockEnqueue = jest.fn();
    (useSyncStore.getState as jest.Mock).mockReturnValue({ enqueue: mockEnqueue });
    (useGamificationStore.getState as jest.Mock).mockReturnValue({
      dailyStats: [],
      addXp: jest.fn(),
      recordWeeklyGoalCompleted: jest.fn(),
    });

    // Manually inject an old goal
    useWeeklyGoalsStore.setState({
      goals: [
        {
          id: 'old-goal',
          weekStart: '2020-01-06',
          goalType: 'system',
          goalParams: { metric: 'tasks' },
          targetValue: 5,
          currentValue: 0,
          isCompleted: false,
          xpReward: 100,
        },
      ],
      lastGeneratedWeek: null,
    });

    // Generate this week's goals
    useWeeklyGoalsStore.getState().ensureThisWeekGoals();

    const thisWeek = useWeeklyGoalsStore.getState().getThisWeekGoals();
    expect(thisWeek.every((g) => g.weekStart === getWeekKey())).toBe(true);
    expect(thisWeek.find((g) => g.id === 'old-goal')).toBeUndefined();
  });

  // ── getCompletedCount ─────────────────────────────────────────────────

  it('getCompletedCount: returns correct count', () => {
    const weekKey = getWeekKey();
    useWeeklyGoalsStore.setState({
      goals: [
        { id: 'g1', weekStart: weekKey, goalType: 'system', goalParams: {}, targetValue: 5, currentValue: 5, isCompleted: true, xpReward: 100 },
        { id: 'g2', weekStart: weekKey, goalType: 'system', goalParams: {}, targetValue: 10, currentValue: 3, isCompleted: false, xpReward: 100 },
        { id: 'g3', weekStart: weekKey, goalType: 'personal', goalParams: {}, targetValue: 5, currentValue: 5, isCompleted: true, xpReward: 150 },
        { id: 'g4', weekStart: '2020-01-06', goalType: 'system', goalParams: {}, targetValue: 5, currentValue: 5, isCompleted: true, xpReward: 100 },
      ],
      lastGeneratedWeek: weekKey,
    });

    const count = useWeeklyGoalsStore.getState().getCompletedCount();
    // g1 and g3 are completed this week, g4 is from a different week
    expect(count).toBe(2);
  });

  it('getCompletedCount: returns 0 when no goals exist', () => {
    expect(useWeeklyGoalsStore.getState().getCompletedCount()).toBe(0);
  });
});
