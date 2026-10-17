jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@ui-kitten/components', () => {
  const { Text, View, TextInput, Pressable } = require('react-native');
  return {
    Text: (props: any) => <Text {...props}>{props.children}</Text>,
    Button: ({ children, onPress, disabled, accessoryLeft, ...props }: any) => (
      <Pressable onPress={disabled ? undefined : onPress} {...props} accessibilityState={{ disabled: !!disabled }}>
        {typeof children === 'string' ? <Text>{children}</Text> : children}
      </Pressable>
    ),
    Input: ({ label, value, onChangeText, placeholder, accessoryLeft, ...props }: any) => (
      <View>
        {label && <Text>{label}</Text>}
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} accessibilityLabel={label} {...props} />
      </View>
    ),
    Card: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Select: ({ label, value, children }: any) => <View>{label && <Text>{label}</Text>}<Text>{value}</Text>{children}</View>,
    SelectItem: ({ title }: any) => <Text>{title}</Text>,
    IndexPath: class { row: number; constructor(row: number) { this.row = row; } },
    NativeDateService: class {},
    Datepicker: ({ label }: any) => <View>{label && <Text>{label}</Text>}</View>,
  };
});

jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'todo-1' }),
}));
jest.mock('@/hooks/use-task-reminders', () => ({ enableTaskReminders: jest.fn() }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import TodoDetailScreen from '@/app/todo/[id]';
import { useTodoStore } from '@/stores/todo-store';

const TODO = {
  id: 'todo-1',
  title: 'Write report',
  description: 'Quarterly numbers',
  dueDate: null,
  dueTime: null,
  status: 'pending' as const,
  categoryId: null,
  priority: 'high' as const,
  subtasks: [],
  pomodoroSessions: 2,
  estimatedPomodoros: 4,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  completedAt: null,
  xpAwardedAt: null,
  order: 0,
};

beforeEach(() => {
  useTodoStore.setState({ todos: [{ ...TODO }] });
});

describe('Todo detail', () => {
  it('shows the stored task and follows changes made elsewhere while viewing', async () => {
    await render(<TodoDetailScreen />);
    expect(screen.getByText('Write report')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
    expect(screen.getByText('2 pomodoros')).toBeTruthy();

    await act(async () => {
      useTodoStore.getState().updateTodo('todo-1', { title: 'Write the report', priority: 'low' });
    });
    expect(screen.getByText('Write the report')).toBeTruthy();
    expect(screen.getByText('Low')).toBeTruthy();
  });

  it('edits a draft and saves it; cancel discards the draft', async () => {
    await render(<TodoDetailScreen />);
    await fireEvent.press(screen.getByText('Edit'));
    const titleInput = screen.getByLabelText('Task Title');
    expect(titleInput.props.value).toBe('Write report');

    await fireEvent.changeText(titleInput, 'Draft title');
    await fireEvent.press(screen.getByText('Cancel'));
    expect(useTodoStore.getState().todos[0].title).toBe('Write report');
    expect(screen.getByText('Write report')).toBeTruthy();

    await fireEvent.press(screen.getByText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Task Title'), '  Final title ');
    await fireEvent.changeText(screen.getByLabelText('Estimated Pomodoros'), '6');
    await fireEvent.press(screen.getByText('Save Changes'));

    expect(useTodoStore.getState().todos[0]).toMatchObject({ title: 'Final title', estimatedPomodoros: 6, priority: 'high' });
    expect(screen.queryByLabelText('Task Title')).toBeNull();
  });
});
