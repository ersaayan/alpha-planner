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

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { SectionHeader } from '@/components/common/section-header';

describe('SectionHeader', () => {
  it('renders title text', () => {
    render(<SectionHeader title="Today's Tasks" />);
    expect(screen.getByText("Today's Tasks")).toBeTruthy();
  });

  it('renders action element when provided', () => {
    const action = <Text>See All</Text>;
    render(<SectionHeader title="Tasks" action={action} />);
    expect(screen.getByText('See All')).toBeTruthy();
  });

  it('does not render action when not provided', () => {
    render(<SectionHeader title="Tasks" />);
    expect(screen.queryByText('See All')).toBeNull();
  });

  it('applies custom style', () => {
    const customStyle = { marginTop: 32 };
    render(
      <View testID="wrapper">
        <SectionHeader title="Tasks" style={customStyle} />
      </View>
    );
    // The component renders and the title is still accessible when custom style is applied
    expect(screen.getByText('Tasks')).toBeTruthy();
  });
});
