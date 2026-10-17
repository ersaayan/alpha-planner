import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { Colors } from '@/constants/theme';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

// Records the props the vector icon receives.
const rendered: Record<string, unknown>[] = [];
jest.mock('@expo/vector-icons', () => {
  const record = (props: Record<string, unknown>) => {
    rendered.push(props);
    return null;
  };
  return { Feather: record, MaterialCommunityIcons: record };
});

const last = () => rendered[rendered.length - 1];

beforeEach(() => {
  rendered.length = 0;
});

it('uses the tint color and size UI Kitten passes to accessories, and keeps margins', async () => {
  await render(<Icon name="plus-outline" style={{ tintColor: '#FFFFFF', width: 20, height: 20, marginHorizontal: 8 }} />);
  expect(last().color).toBe('#FFFFFF');
  expect(last().size).toBe(20);
  expect(StyleSheet.flatten(last().style as never)).toEqual({ marginHorizontal: 8 });
});

it('prefers an explicit fill and defaults to the theme muted color', async () => {
  await render(<Icon name="star" fill="#123456" style={{ tintColor: '#FFFFFF' }} />);
  expect(last().color).toBe('#123456');
  await render(<Icon name="star" />);
  expect(last().color).toBe(Colors.light.textMuted);
});

it('is hidden from screen readers (the control around it is labelled)', async () => {
  await render(<Icon name="trash-2-outline" size={18} />);
  expect(last()).toMatchObject({ accessible: false, importantForAccessibility: 'no-hide-descendants', size: 18 });
});

it('warns once per unknown name, not on every render', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await render(<Icon name="no-such-icon" />);
  await render(<Icon name="no-such-icon" />);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(last().name).toBe('circle');
  warn.mockRestore();
});
