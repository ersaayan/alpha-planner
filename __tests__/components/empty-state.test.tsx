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

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { EmptyState } from '@/components/common/empty-state';

describe('EmptyState', () => {
  it('renders title text', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(
      <EmptyState title="No items" subtitle="Try adding something new" />
    );
    expect(screen.getByText('Try adding something new')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    render(<EmptyState title="No items" />);
    expect(screen.queryByText('Try adding something new')).toBeNull();
  });

  it('renders action element when provided', () => {
    const action = <Text>Add Item</Text>;
    render(<EmptyState title="No items" action={action} />);
    expect(screen.getByText('Add Item')).toBeTruthy();
  });

  it('renders icon when provided', () => {
    render(<EmptyState title="No items" icon="inbox-outline" />);
    expect(screen.getByTestId('icon-inbox-outline')).toBeTruthy();
  });
});
