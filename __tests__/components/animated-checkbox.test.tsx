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

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View {...props} />,
    Svg: (props: any) => <View {...props} />,
    Path: (props: any) => <View {...props} />,
    Circle: (props: any) => <View {...props} />,
    G: (props: any) => <View {...props} />,
    Defs: (props: any) => <View {...props} />,
    LinearGradient: (props: any) => <View {...props} />,
    Stop: () => null,
  };
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AnimatedCheckbox } from '@/components/animated/animated-checkbox';

describe('AnimatedCheckbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AnimatedCheckbox checked={false} />);
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('calls onToggle when pressed', () => {
    const onToggle = jest.fn();
    render(<AnimatedCheckbox checked={false} onToggle={onToggle} />);
    fireEvent.press(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('renders checked state', () => {
    render(<AnimatedCheckbox checked={true} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.props.accessibilityState).toMatchObject({ checked: true });
  });

  it('renders unchecked state', () => {
    render(<AnimatedCheckbox checked={false} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.props.accessibilityState).toMatchObject({ checked: false });
  });
});
