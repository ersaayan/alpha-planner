jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@ui-kitten/components', () => {
  const { Text, View, TextInput, Pressable, Switch } = require('react-native');
  return {
    Text: (props: any) => <Text {...props}>{props.children}</Text>,
    Button: ({ children, onPress, ...props }: any) => (
      <Pressable onPress={onPress} {...props}>
        {typeof children === 'string' ? <Text>{children}</Text> : children}
      </Pressable>
    ),
    Input: ({ label, value, onChangeText, placeholder, ...props }: any) => (
      <View>
        {label && <Text>{label}</Text>}
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} {...props} />
      </View>
    ),
    Card: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Toggle: ({ checked, onChange, ...props }: any) => <Switch value={checked} onValueChange={onChange} {...props} />,
    Divider: () => <View />,
    ApplicationProvider: ({ children }: any) => <>{children}</>,
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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));

const mockKeepOnlyCategories = jest.fn();
const mockCompleteOnboarding = jest.fn();
const mockAddCategory = jest.fn().mockReturnValue({ id: 'new-1', name: 'Custom' });

jest.mock('@/stores', () => ({
  useCategoryStore: (selector: any) => selector({
    categories: [
      { id: '1', name: 'Work', color: '#FF0000', icon: 'briefcase', isDefault: true, order: 0, createdAt: '' },
      { id: '2', name: 'Personal', color: '#00FF00', icon: 'person', isDefault: true, order: 1, createdAt: '' },
    ],
    keepOnlyCategories: mockKeepOnlyCategories,
    addCategory: mockAddCategory,
  }),
  useSettingsStore: (selector: any) => selector({
    completeOnboarding: mockCompleteOnboarding,
  }),
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CategorySelectionScreen from '@/app/(onboarding)/category-selection';

jest.spyOn(Alert, 'alert');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CategorySelectionScreen', () => {
  it('renders category grid', () => {
    render(<CategorySelectionScreen />);
    expect(screen.getByText('Choose Categories')).toBeTruthy();
    expect(screen.getByText('Work')).toBeTruthy();
    expect(screen.getByText('Personal')).toBeTruthy();
  });

  it('renders at least 2 default categories', () => {
    render(<CategorySelectionScreen />);
    expect(screen.getByText('Work')).toBeTruthy();
    expect(screen.getByText('Personal')).toBeTruthy();
  });

  it('renders Add Custom button', () => {
    render(<CategorySelectionScreen />);
    expect(screen.getByText('Add Custom')).toBeTruthy();
  });

  it('renders Finish button', () => {
    render(<CategorySelectionScreen />);
    expect(screen.getByText("Let's Go!")).toBeTruthy();
  });

  it('shows alert when finishing with no categories selected', () => {
    render(<CategorySelectionScreen />);

    // Deselect both categories by pressing them (they start selected)
    fireEvent.press(screen.getByText('Work'));
    fireEvent.press(screen.getByText('Personal'));

    fireEvent.press(screen.getByText("Let's Go!"));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Select Categories',
      'Please select at least one category to continue.'
    );
  });

  it('calls completeOnboarding on finish with categories selected', () => {
    render(<CategorySelectionScreen />);

    // Categories are selected by default, just press finish
    fireEvent.press(screen.getByText("Let's Go!"));

    expect(mockKeepOnlyCategories).toHaveBeenCalledWith(['1', '2']);
    expect(mockCompleteOnboarding).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
