jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@ui-kitten/components', () => {
  const { Text, View, TextInput, Pressable, Switch } = require('react-native');
  return {
    Text: (props: any) => <Text {...props}>{props.children}</Text>,
    Button: ({ children, onPress, ...props }: any) => <Pressable onPress={onPress} {...props}>{typeof children === 'string' ? <Text>{children}</Text> : children}</Pressable>,
    Input: ({ label, value, onChangeText, placeholder, ...props }: any) => <View>{label && <Text>{label}</Text>}<TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} {...props} /></View>,
    Card: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Toggle: ({ checked, onChange, ...props }: any) => <Switch value={checked} onValueChange={onChange} {...props} />,
    Divider: () => <View />,
  };
});

jest.mock('@/components/icon', () => ({ Icon: ({ name }: any) => { const { View } = require('react-native'); return <View testID={`icon-${name}`} />; } }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({}) }));

jest.mock('@/components/animated/animated-badge', () => ({ LevelBadge: () => null, AchievementBadge: () => null }));
jest.mock('@/components/animated/animated-button', () => ({ AnimatedButton: ({ title, onPress }: any) => { const { Pressable, Text } = require('react-native'); return <Pressable onPress={onPress}><Text>{title}</Text></Pressable>; }, FAB: () => null }));
jest.mock('@/components/animated/animated-card', () => ({ AnimatedCard: ({ children }: any) => { const { View } = require('react-native'); return <View>{children}</View>; } }));
jest.mock('@/components/animated/animated-counter', () => ({ AnimatedCounter: ({ value }: any) => { const { Text } = require('react-native'); return <Text>{value}</Text>; }, XPCounter: () => null, StreakCounter: () => null }));
jest.mock('@/components/animated/animated-progress-bar', () => ({ AnimatedProgressBar: () => null }));
jest.mock('@/components/animated/animated-checkbox', () => ({ AnimatedCheckbox: ({ checked, onToggle }: any) => { const { Pressable, Text } = require('react-native'); return <Pressable onPress={() => onToggle?.(!checked)}><Text>{checked ? '☑' : '☐'}</Text></Pressable>; } }));
jest.mock('@/components/common', () => ({ SectionHeader: ({ title }: any) => { const { Text } = require('react-native'); return <Text>{title}</Text>; }, EmptyState: ({ title }: any) => { const { Text } = require('react-native'); return <Text>{title}</Text>; }, SyncStatus: () => null }));
jest.mock('@/components/charts', () => ({ WeeklyChart: () => null, DistributionChart: () => null }));
jest.mock('@/components/dashboard', () => ({ DailySummaryModal: () => null }));
jest.mock('@/services/gamification/daily-summary', () => ({ shouldShowSummary: () => false, getDailySummaryData: jest.fn(), getMotivationalMessage: jest.fn(), markSummaryShown: jest.fn() }));
jest.mock('@/components/pomodoro', () => ({ CircularProgress: ({ children }: any) => { const { View } = require('react-native'); return <View>{children}</View>; } }));
jest.mock('@/utils/date', () => ({ formatDate: () => '05/04/2026' }));

const mockToggleTodoStatus = jest.fn();

jest.mock('@/stores', () => ({
  useTodoStore: (sel: any) => sel({
    todos: [
      { id: '1', title: 'Buy groceries', status: 'pending', priority: 'medium', categoryId: 'cat1', subtasks: [], createdAt: '', updatedAt: '', order: 0 },
      { id: '2', title: 'Finish report', status: 'completed', priority: 'high', categoryId: 'cat1', subtasks: [], createdAt: '', updatedAt: '', order: 1 },
    ],
    toggleTodoStatus: mockToggleTodoStatus,
  }),
  useCategoryStore: (sel: any) => sel({ categories: [{ id: 'cat1', name: 'Work', color: '#FF0000' }], getCategoryColor: () => '#FF0000' }),
  useSettingsStore: (sel: any) => sel({ settings: { defaultView: 'list', dateFormat: 'DD/MM/YYYY' } }),
}));

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import TodosScreen from '@/app/(tabs)/todos';

describe('Todos Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Tasks title', async () => {
    await render(<TodosScreen />);
    expect(screen.getByText('My Tasks')).toBeTruthy();
  });

  it('renders search input', async () => {
    await render(<TodosScreen />);
    expect(screen.getByPlaceholderText('Search tasks...')).toBeTruthy();
  });

  it('renders status filter tabs (All, Pending, In Progress, Done)', async () => {
    await render(<TodosScreen />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('In Progress')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('renders todo items', async () => {
    await render(<TodosScreen />);
    expect(screen.getByText('Buy groceries')).toBeTruthy();
    expect(screen.getByText('Finish report')).toBeTruthy();
  });

  it('renders add button', async () => {
    await render(<TodosScreen />);
    expect(screen.getByText('Add')).toBeTruthy();
  });

  it('renders empty state when no todos match filter', async () => {
    jest.spyOn(require('@/stores'), 'useTodoStore').mockImplementation((sel: any) => sel({
      todos: [],
      toggleTodoStatus: jest.fn(),
    }));
    await render(<TodosScreen />);
    expect(screen.getByText('No tasks found')).toBeTruthy();
  });
});
