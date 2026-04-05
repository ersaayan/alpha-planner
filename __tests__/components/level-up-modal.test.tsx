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
  LevelBadge: () => null,
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
import { LevelUpModal } from '@/components/gamification/level-up-modal';

const defaultProps = {
  visible: true,
  newLevel: 5,
  levelTitle: 'Young Leaf',
  onClose: jest.fn(),
};

describe('LevelUpModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible is true', () => {
    render(<LevelUpModal {...defaultProps} />);
    expect(screen.getByText('LEVEL UP!')).toBeTruthy();
  });

  it('does not render when visible is false', () => {
    render(<LevelUpModal {...defaultProps} visible={false} />);
    expect(screen.queryByText('LEVEL UP!')).toBeNull();
  });

  it('displays congratulations text', () => {
    render(<LevelUpModal {...defaultProps} />);
    expect(screen.getByText('Congratulations!')).toBeTruthy();
  });

  it('displays new level number or title', () => {
    render(<LevelUpModal {...defaultProps} />);
    expect(screen.getByText('Young Leaf')).toBeTruthy();
    // The description also includes the level number
    expect(
      screen.getByText(
        /Level 5/
      )
    ).toBeTruthy();
  });

  it('calls onClose when continue button pressed', () => {
    const onClose = jest.fn();
    render(<LevelUpModal {...defaultProps} onClose={onClose} />);
    // The AnimatedButton mock renders a Pressable with title text
    fireEvent.press(screen.getByText('Continue'));
    // handleClose triggers animations with runOnJS(onClose).
    // In the mock environment the callback fires synchronously.
    expect(onClose).toHaveBeenCalled();
  });
});
