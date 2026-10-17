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
