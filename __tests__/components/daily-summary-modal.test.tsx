jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@ui-kitten/components', () => {
  const { Text, View } = require('react-native');
  return {
    Text: (props: any) => <Text {...props}>{props.children}</Text>,
    Button: (props: any) => <View {...props}>{props.children}</View>,
    Input: (props: any) => <View {...props} />,
    Card: (props: any) => <View {...props}>{props.children}</View>,
    ApplicationProvider: (props: any) => <>{props.children}</>,
  };
});

jest.mock('@/components/icon', () => ({
  Icon: ({ name, ...props }: { name: string }) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/components/animated/animated-counter', () => ({
  AnimatedCounter: ({ value }: { value: number }) => {
    const { Text } = require('react-native');
    return <Text>{value}</Text>;
  },
}));

jest.mock('@/components/animated/animated-progress-bar', () => ({
  AnimatedProgressBar: () => null,
}));

jest.mock('@/components/animated/animated-button', () => ({
  AnimatedButton: ({ title, onPress }: { title: string; onPress: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { DailySummaryModal } from '@/components/dashboard/daily-summary-modal';

const mockData = {
  totalFocusTime: 7200, // 2 hours
  pomodorosCompleted: 6,
  tasksCompleted: 4,
  subtasksCompleted: 8,
  topCategory: { name: 'Work', time: 3600 },
  xpEarned: 250,
  streakStatus: { days: 7, isActive: true },
  comboMultiplier: 2,
  dailyQuestsStatus: { completed: 2, total: 3 },
  weeklyGoalProgress: { completed: 1, total: 3, percentage: 45 },
  deltaFromYesterday: { pomodoros: 2, focusTime: 1800, tasks: -1 },
  motivationLevel: 'great' as const,
};

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  data: mockData,
  motivationalMessage: 'Great work today!',
};

describe('DailySummaryModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible is true', async () => {
    await render(<DailySummaryModal {...defaultProps} />);
    expect(screen.getByText('Gunun Ozeti')).toBeTruthy();
  });

  it('does not render content when visible is false', async () => {
    await render(<DailySummaryModal {...defaultProps} visible={false} />);
    expect(screen.queryByText('Gunun Ozeti')).toBeNull();
  });

  it('displays pomodoro count', async () => {
    await render(<DailySummaryModal {...defaultProps} />);
    // AnimatedCounter mock renders the raw value as text
    expect(screen.getByText('6')).toBeTruthy();
    // The label beneath the pomodoro counter
    expect(screen.getByText('Pomodoro')).toBeTruthy();
  });

  it('displays motivational message', async () => {
    await render(<DailySummaryModal {...defaultProps} />);
    expect(screen.getByText('Great work today!')).toBeTruthy();
  });

  it('calls onClose when close button pressed', async () => {
    const onClose = jest.fn();
    await render(<DailySummaryModal {...defaultProps} onClose={onClose} />);
    // The AnimatedButton mock renders a Pressable with title "Kapat"
    await fireEvent.press(screen.getByText('Kapat'));
    // handleClose triggers an animation that calls onClose via runOnJS.
    // In the mock environment, runOnJS executes synchronously or the
    // Pressable in the header can be used. The AnimatedButton mock
    // calls onPress (which is handleClose) directly.
    // Since reanimated is mocked, the withTiming callback fires immediately.
    expect(onClose).toHaveBeenCalled();
  });
});
