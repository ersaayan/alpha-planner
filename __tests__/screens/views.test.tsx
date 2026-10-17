jest.mock('@ui-kitten/components', () => {
  const { Text, View, Pressable } = require('react-native');
  return {
    Text: (props: any) => <Text {...props}>{props.children}</Text>,
    Button: ({ children, onPress, accessoryLeft, ...props }: any) => <Pressable onPress={onPress} {...props}>{typeof children === 'string' ? <Text>{children}</Text> : children}</Pressable>,
    Card: ({ children, onPress, ...props }: any) => <Pressable onPress={onPress} {...props}>{children}</Pressable>,
  };
});
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import CalendarScreen from '@/app/views/calendar';
import TimelineScreen from '@/app/views/timeline';
import { WeeklyChart } from '@/components/charts/weekly-chart';
import { DistributionChart } from '@/components/charts/distribution-chart';
import { useSettingsStore } from '@/stores/settings-store';
import { migrateSettingsState } from '@/stores/settings-store';
import { useTodoStore } from '@/stores/todo-store';
import type { Todo } from '@/types';
import { addDaysToKey, getDateKey } from '@/utils/date';
import { resolveWeekStart } from '@/utils/locale';

const today = getDateKey();
const todo = (id: string, overrides: Partial<Todo>): Todo => ({
  id, title: id, description: null, dueDate: today, status: 'pending', categoryId: null, priority: 'medium', subtasks: [],
  pomodoroSessions: 0, estimatedPomodoros: null, createdAt: '', updatedAt: '', completedAt: null, order: 0, ...overrides,
});

beforeEach(() => {
  useTodoStore.setState({
    todos: [
      todo('open-overdue', { dueDate: addDaysToKey(today, -2) }),
      todo('archived-overdue', { dueDate: addDaysToKey(today, -2), status: 'archived' }),
      todo('done-overdue', { dueDate: addDaysToKey(today, -1), status: 'completed' }),
      todo('archived-undated', { dueDate: null, status: 'archived' }),
      todo('open-undated', { dueDate: null }),
      todo('today', {}),
    ],
  });
});

describe('timeline', () => {
  it('shows only tasks still to do: archived and completed ones are not "overdue"', async () => {
    await render(<TimelineScreen />);
    expect(screen.getByText('open-overdue')).toBeTruthy();
    expect(screen.getByText('open-undated')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.queryByText('archived-overdue')).toBeNull();
    expect(screen.queryByText('done-overdue')).toBeNull();
    expect(screen.queryByText('archived-undated')).toBeNull();
    expect(screen.getAllByText('Overdue')).toHaveLength(1);
  });
});

describe('calendar', () => {
  it('starts the week on the chosen day', async () => {
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, weekStartsOn: 1 } }));
    const { unmount } = await render(<CalendarScreen />);
    const mondayFirst = screen.getAllByText(/^(Mo|Tu|We|Th|Fr|Sa|Su)$/).map((n) => n.props.children);
    expect(mondayFirst[0]).toBe('Mo');
    await unmount();

    // Automatic follows the language: Sunday in English.
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, weekStartsOn: 'auto' } }));
    await render(<CalendarScreen />);
    expect(screen.getAllByText(/^(Mo|Tu|We|Th|Fr|Sa|Su)$/)[0].props.children).toBe('Su');
  });

  it('does not keep the selected day when the month changes', async () => {
    await render(<CalendarScreen />);
    // The month title selects today.
    const title = screen.getByText(/\d{4}$/);
    await fireEvent.press(title);
    // The task named "today" is listed under the selected day.
    expect(screen.getByText('today')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next month'));
    expect(screen.queryByText('today')).toBeNull();
  });
});

it('week start: Monday for Turkish, Sunday for English, unless chosen', () => {
  expect(resolveWeekStart('auto', 'tr')).toBe(1);
  expect(resolveWeekStart('auto', 'en')).toBe(0);
  expect(resolveWeekStart(0, 'tr')).toBe(0);
  expect(resolveWeekStart(1, 'en')).toBe(1);
});

it('settings v1 → v2: the old Monday default becomes automatic, an explicit Sunday stays', () => {
  expect(migrateSettingsState({ settings: { weekStartsOn: 1 } }, 1).settings.weekStartsOn).toBe('auto');
  expect(migrateSettingsState({ settings: { weekStartsOn: 0 } }, 1).settings.weekStartsOn).toBe(0);
  expect(migrateSettingsState({ settings: { weekStartsOn: 1 } }, 2).settings.weekStartsOn).toBe(1);
});

describe('charts', () => {
  it('the weekly chart is labelled as the last 7 days and handles no data', async () => {
    await render(<WeeklyChart data={[]} title="Focus Sessions" valueLabel="sessions" />);
    expect(screen.getByText('0 sessions in the last 7 days')).toBeTruthy();
  });

  it('the weekly chart handles a single point and adds up entries of one day', async () => {
    const now = new Date();
    await render(<WeeklyChart data={[{ date: now, value: 2 }, { date: now, value: 1 }]} title="T" valueLabel="tasks" />);
    expect(screen.getByText('3 tasks in the last 7 days')).toBeTruthy();
  });

  it('the distribution chart handles all-zero and one-segment data', async () => {
    const { unmount } = await render(<DistributionChart title="Time" data={[{ label: 'Focus', value: 0, color: '#000' }]} />);
    expect(screen.getByText('No data yet')).toBeTruthy();
    await unmount();
    await render(<DistributionChart title="Time" data={[{ label: 'Focus', value: 3600, color: '#000' }, { label: 'Break', value: 0, color: '#111' }]} />);
    expect(screen.getByText('1h 0m (100%)')).toBeTruthy();
  });
});
