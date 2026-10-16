jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@ui-kitten/components', () => {
  const { Text, View, TextInput, Pressable, Switch } = require('react-native');
  return {
    Text: (props: any) => <Text {...props}>{props.children}</Text>,
    Button: ({ children, onPress, disabled, ...props }: any) => (
      <Pressable onPress={disabled ? undefined : onPress} {...props} accessibilityState={{ disabled: !!disabled }}>
        {typeof children === 'string' ? <Text>{children}</Text> : children}
      </Pressable>
    ),
    Input: ({ label, value, onChangeText, placeholder, ...props }: any) => (
      <View>
        {label && <Text>{label}</Text>}
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} {...props} />
      </View>
    ),
    Card: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Toggle: ({ checked, onChange, ...props }: any) => <Switch value={checked} onValueChange={onChange} {...props} />,
    Divider: () => <View />,
    Select: ({ label, children, ...props }: any) => <View>{label && <Text>{label}</Text>}{children}</View>,
    SelectItem: ({ title, ...props }: any) => <View><Text>{title}</Text></View>,
    IndexPath: class { row: number; constructor(row: number) { this.row = row; } },
    Datepicker: ({ label, ...props }: any) => <View>{label && <Text>{label}</Text>}</View>,
  };
});

jest.mock('@/components/icon', () => ({ Icon: ({ name }: any) => { const { View } = require('react-native'); return <View testID={`icon-${name}`} />; } }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }), useLocalSearchParams: () => ({}) }));

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

const mockAddTodo = jest.fn().mockReturnValue({ id: 'new-1' });

jest.mock('@/stores', () => ({
  useTodoStore: (sel: any) => sel({ addTodo: mockAddTodo, todos: [] }),
  useCategoryStore: (sel: any) => sel({ categories: [{ id: 'cat1', name: 'Work', color: '#FF0000', icon: 'briefcase' }] }),
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import CreateTodoScreen from '@/app/todo/create';

describe('Todo Create Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title input', async () => {
    await render(<CreateTodoScreen />);
    expect(screen.getByText('Task Title')).toBeTruthy();
    expect(screen.getByPlaceholderText('What do you need to do?')).toBeTruthy();
  });

  it('renders description input', async () => {
    await render(<CreateTodoScreen />);
    expect(screen.getByText('Description (optional)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Add more details...')).toBeTruthy();
  });

  it('renders priority buttons (Low, Medium, High, Urgent)', async () => {
    await render(<CreateTodoScreen />);
    expect(screen.getByText('Low')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
    expect(screen.getByText('Urgent')).toBeTruthy();
  });

  it('renders category selector', async () => {
    await render(<CreateTodoScreen />);
    expect(screen.getByText('Category')).toBeTruthy();
    expect(screen.getByText('Work')).toBeTruthy();
  });

  it('renders create/save button', async () => {
    await render(<CreateTodoScreen />);
    expect(screen.getByText('Create Task')).toBeTruthy();
  });

  it('does not call addTodo for empty title on submit', async () => {
    await render(<CreateTodoScreen />);
    await fireEvent.press(screen.getByText('Create Task'));
    expect(mockAddTodo).not.toHaveBeenCalled();
  });
});
