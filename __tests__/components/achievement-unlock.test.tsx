jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@ui-kitten/components', () => {
  const { Text, View } = require('react-native');
  return {
    Text: (props: any) => <Text {...props}>{props.children}</Text>,
    Button: ({ children, onPress }: any) => {
      const { Pressable } = require('react-native');
      return (
        <Pressable onPress={onPress}>
          {typeof children === 'string' ? <Text>{children}</Text> : children}
        </Pressable>
      );
    },
  };
});

jest.mock('@/components/icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} />;
  },
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/components/animated/animated-badge', () => ({
  AchievementBadge: () => null,
  LevelBadge: () => null,
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AchievementUnlock } from '@/components/gamification/achievement-unlock';

const defaultProps = {
  visible: true,
  icon: 'star-outline',
  title: 'First Focus',
  description: 'Complete your first pomodoro',
  xpReward: 50,
  rarity: 'common' as const,
  onClose: jest.fn(),
  autoDismiss: false,
};

describe('AchievementUnlock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible is true', async () => {
    await render(<AchievementUnlock {...defaultProps} />);
    expect(screen.getByText('Achievement Unlocked!')).toBeTruthy();
  });

  it('does not render content when visible is false', async () => {
    await render(<AchievementUnlock {...defaultProps} visible={false} />);
    expect(screen.queryByText('ACHIEVEMENT UNLOCKED')).toBeNull();
  });

  it('displays achievement title', async () => {
    await render(<AchievementUnlock {...defaultProps} />);
    expect(screen.getByText('First Focus')).toBeTruthy();
  });

  it('displays achievement description', async () => {
    await render(<AchievementUnlock {...defaultProps} />);
    expect(screen.getByText('Complete your first pomodoro')).toBeTruthy();
  });

  it('displays XP reward', async () => {
    await render(<AchievementUnlock {...defaultProps} />);
    expect(screen.getByText('+50 XP')).toBeTruthy();
  });

  it('calls onClose when backdrop pressed', async () => {
    const onClose = jest.fn();
    await render(<AchievementUnlock {...defaultProps} onClose={onClose} />);
    // The overlay is a Pressable wrapping the entire component
    await fireEvent.press(screen.getByText('Achievement Unlocked!'));
    expect(onClose).toHaveBeenCalled();
  });
});
