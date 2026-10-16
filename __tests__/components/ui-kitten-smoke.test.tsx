/**
 * Smoke test for the real (unmocked) UI Kitten v6 components the app relies on,
 * rendered under ApplicationProvider with the app's Eva themes.
 */

import React from 'react';
import { View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as eva from '@ui-kitten/eva';
import {
  ApplicationProvider,
  Button,
  Card,
  Datepicker,
  Divider,
  IndexPath,
  Input,
  Layout,
  Modal,
  Popover,
  Select,
  SelectItem,
  Text,
  Toggle,
} from '@ui-kitten/components';
import { alphaDarkTheme, alphaTheme } from '@/constants/eva-theme';

function renderWithTheme(ui: React.ReactElement, dark = false) {
  const theme = dark ? { ...eva.dark, ...alphaDarkTheme } : { ...eva.light, ...alphaTheme };
  return render(
    <ApplicationProvider {...eva} theme={theme}>
      {ui}
    </ApplicationProvider>,
  );
}

describe('UI Kitten v6 components', () => {
  it.each([false, true])('renders Layout, Card, Text, Divider and Button (dark=%s)', async (dark) => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Layout>
        <Card>
          <Text category="h1">Alpha Planner</Text>
          <Divider />
          <Button onPress={onPress}>Start</Button>
        </Card>
      </Layout>,
      dark,
    );

    expect(screen.getByText('Alpha Planner')).toBeTruthy();
    await fireEvent.press(screen.getByText('Start'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Input forwards text changes', async () => {
    const onChangeText = jest.fn();
    await renderWithTheme(
      <Input label="Title" placeholder="What needs doing?" value="" onChangeText={onChangeText} />,
    );

    expect(screen.getByText('Title')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('What needs doing?'), 'Write tests');
    expect(onChangeText).toHaveBeenCalledWith('Write tests');
  });

  it('Toggle reports its new state', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <Toggle checked={false} onChange={onChange}>
        Notifications
      </Toggle>,
    );

    expect(screen.getByText('Notifications')).toBeTruthy();
    await fireEvent.press(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Select shows the value and lists its options when opened', async () => {
    await renderWithTheme(
      <Select label="Category" placeholder="Select a category" value="Work" selectedIndex={new IndexPath(0)}>
        <SelectItem title="Work" />
        <SelectItem title="Personal" />
      </Select>,
    );

    expect(screen.getByText('Category')).toBeTruthy();
    expect(screen.getByText('Work')).toBeTruthy();

    await fireEvent.press(screen.getByText('Work'));
    expect(screen.getByText('Personal')).toBeTruthy();
  });

  it('Datepicker renders its label and placeholder', async () => {
    await renderWithTheme(
      <Datepicker label="Due Date (optional)" placeholder="Pick a date" onSelect={jest.fn()} />,
    );

    expect(screen.getByText('Due Date (optional)')).toBeTruthy();
    expect(screen.getByText('Pick a date')).toBeTruthy();
  });

  it('Modal renders its content when visible', async () => {
    await renderWithTheme(
      <Modal visible>
        <Text>Modal content</Text>
      </Modal>,
    );

    expect(screen.getByText('Modal content')).toBeTruthy();
  });

  it('Popover renders its content when visible', async () => {
    await renderWithTheme(
      <Popover visible anchor={() => <View testID="popover-anchor" />}>
        <Text>Popover content</Text>
      </Popover>,
    );

    expect(screen.getByTestId('popover-anchor')).toBeTruthy();
    expect(screen.getByText('Popover content')).toBeTruthy();
  });
});
