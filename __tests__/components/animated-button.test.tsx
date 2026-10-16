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
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AnimatedButton } from '@/components/animated/animated-button';

describe('AnimatedButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders button with title', async () => {
    await render(<AnimatedButton title="Save" onPress={() => {}} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<AnimatedButton title="Submit" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Submit'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders with icon', async () => {
    await render(
      <AnimatedButton title="Add" icon="plus-outline" onPress={() => {}} />
    );
    expect(screen.getByText('Add')).toBeTruthy();
    expect(screen.getByTestId('icon-plus-outline')).toBeTruthy();
  });

  it('shows loading text when loading', async () => {
    await render(<AnimatedButton title="Save" loading={true} onPress={() => {}} />);
    // When loading, the component renders "..." instead of the title
    expect(screen.getByText('...')).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('is disabled when disabled prop is true', async () => {
    const onPress = jest.fn();
    await render(
      <AnimatedButton title="Delete" disabled={true} onPress={onPress} />
    );
    await fireEvent.press(screen.getByText('Delete'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
