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

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { XPGainToast } from '@/components/gamification/xp-gain-toast';

const defaultProps = {
  amount: 25,
  reason: 'Pomodoro completed',
  visible: true,
  onHide: jest.fn(),
  duration: 999999,
};

describe('XPGainToast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible is true', () => {
    render(<XPGainToast {...defaultProps} />);
    expect(screen.getByText('+25 XP')).toBeTruthy();
  });

  it('does not render when visible is false', () => {
    render(<XPGainToast {...defaultProps} visible={false} />);
    expect(screen.queryByText('+25 XP')).toBeNull();
  });

  it('displays XP amount', () => {
    render(<XPGainToast {...defaultProps} amount={100} />);
    expect(screen.getByText('+100 XP')).toBeTruthy();
  });

  it('displays reason text', () => {
    render(<XPGainToast {...defaultProps} />);
    expect(screen.getByText('Pomodoro completed')).toBeTruthy();
  });

  it('has accessibility label with amount', () => {
    render(<XPGainToast {...defaultProps} />);
    expect(
      screen.getByLabelText('Gained 25 XP, Pomodoro completed')
    ).toBeTruthy();
  });
});
