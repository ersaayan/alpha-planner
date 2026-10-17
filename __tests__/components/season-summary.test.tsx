import { fireEvent, render, screen } from '@testing-library/react-native';

import { CelebrationHost } from '@/components/gamification/celebration-host';
import { useGamificationStore } from '@/stores/gamification-store';
import { useSettingsStore } from '@/stores/settings-store';
import { INITIAL_PRESTIGE_STATE } from '@/types';

jest.mock('@/components/icon', () => ({ Icon: () => null }));

const record = { month: '2026-09', finalLevel: 14, totalXp: 7000, rewards: ['loyal_warrior'], rewardXp: 400, pomodoros: 60, tasks: 20, activeDays: 22 };

beforeEach(() => {
  useSettingsStore.setState((state) => ({ settings: { ...state.settings, hasCompletedOnboarding: true } }));
  useGamificationStore.setState({ prestige: { ...INITIAL_PRESTIGE_STATE, count: 1, history: [record], acknowledgedMonth: null } });
});

it('summarizes the finished season once, with its rewards', async () => {
  await render(<CelebrationHost />);
  expect(screen.getByText('September 2026 season complete')).toBeTruthy();
  expect(screen.getByText('September 2026 Loyal Warrior')).toBeTruthy();
  expect(screen.getByText('+400 XP head start for the new season')).toBeTruthy();
  expect(screen.getByText(/14 · /)).toBeTruthy();

  await fireEvent.press(screen.getByText('Start the new season'));
  expect(useGamificationStore.getState().prestige.acknowledgedMonth).toBe('2026-09');
  expect(screen.queryByText('September 2026 season complete')).toBeNull();
});

it('shows nothing when the last season was already seen', async () => {
  useGamificationStore.setState({ prestige: { ...INITIAL_PRESTIGE_STATE, count: 1, history: [record], acknowledgedMonth: '2026-09' } });
  await render(<CelebrationHost />);
  expect(screen.queryByTestId('season-summary')).toBeNull();
});

describe('celebration queue', () => {
  const { getAchievementById } = jest.requireActual('@/constants/gamification');

  it('shows achievements one at a time, translated, then the level up', async () => {
    const { act } = require('@testing-library/react-native');
    useGamificationStore.setState({
      prestige: { ...INITIAL_PRESTIGE_STATE, history: [], acknowledgedMonth: null },
      pendingNotifications: [getAchievementById('first_focus'), getAchievementById('task_starter')],
    });
    await render(<CelebrationHost />);
    expect(screen.getByText('First Focus')).toBeTruthy();
    expect(screen.queryByText('Task Starter')).toBeNull();

    // A level up while achievements are waiting is shown after them.
    await act(async () => {
      useGamificationStore.setState((state) => ({ stats: { ...state.stats, level: state.stats.level + 1 } }));
    });
    await act(async () => useGamificationStore.getState().dismissNotification('first_focus'));
    expect(screen.getByText('Task Starter')).toBeTruthy();
    await act(async () => useGamificationStore.getState().dismissNotification('task_starter'));
    expect(screen.getByText('Level Up!')).toBeTruthy();
  });

  it('nothing is shown during onboarding', async () => {
    useSettingsStore.setState((state) => ({ settings: { ...state.settings, hasCompletedOnboarding: false } }));
    useGamificationStore.setState({ pendingNotifications: [getAchievementById('first_focus')] });
    await render(<CelebrationHost />);
    expect(screen.queryByText('First Focus')).toBeNull();
  });
});

describe('daily summary', () => {
  it("shows yesterday's summary on the first open of the day, once", async () => {
    const { act } = require('@testing-library/react-native');
    const { getDateKey, addDaysToKey } = jest.requireActual('@/utils/date');
    const yesterday = addDaysToKey(getDateKey(), -1);
    useGamificationStore.setState({
      prestige: { ...INITIAL_PRESTIGE_STATE, history: [], acknowledgedMonth: null },
      pendingNotifications: [],
      dailyStats: [{ date: yesterday, pomodorosCompleted: 3, focusTime: 4500, tasksCompleted: 1, xpEarned: 60, dailyQuestsCompleted: 0, summaryShownAt: null }],
    });
    await render(<CelebrationHost />);
    expect(screen.getByText('Daily Summary')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText('Close')));
    expect(useGamificationStore.getState().dailyStats.find((d) => d.date === yesterday)!.summaryShownAt).toBeTruthy();
    expect(screen.queryByText('Daily Summary')).toBeNull();
  });
});
