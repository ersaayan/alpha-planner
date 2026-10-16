import { router as appRouter, Stack } from 'expo-router';
import { act, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import OnboardingLayout from '@/app/(onboarding)/_layout';
import { RootStack } from '@/components/navigation/root-stack';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { DEFAULT_APP_SETTINGS } from '@/types';
import { setSyncConfigured } from '../helpers/sync';

const page = (label: string) => () => <Text>{label}</Text>;

/** The real root navigator over stub screens. */
const ROUTES = {
  _layout: { default: () => <RootStack />, unstable_settings: { anchor: '(tabs)' } },
  // A stack stands in for the tab bar, which renders no screens in the test renderer.
  '(tabs)/_layout': () => <Stack />,
  '(tabs)/index': page('Dashboard'),
  '(tabs)/settings': page('Settings'),
  '(onboarding)/_layout': OnboardingLayout,
  '(onboarding)/welcome': page('Welcome'),
  '(onboarding)/pomodoro-setup': page('Timer setup'),
  '(onboarding)/category-selection': page('Categories'),
  '(auth)/_layout': () => <Stack />,
  '(auth)/login': page('Login'),
  '(auth)/register': page('Register'),
  'todo/[id]': page('Todo detail'),
  'todo/create': page('New todo'),
  'views/kanban': page('Kanban'),
  'views/calendar': page('Calendar'),
  'views/timeline': page('Timeline'),
  '+not-found': page('Not found'),
};

function setOnboarded(done: boolean) {
  useSettingsStore.setState({ settings: { ...DEFAULT_APP_SETTINGS, hasCompletedOnboarding: done } });
}

beforeEach(() => {
  setSyncConfigured(false);
  useAuthStore.setState(useAuthStore.getInitialState(), true);
});

afterAll(() => {
  setSyncConfigured(false);
});

describe('root navigation guards', () => {
  it('first launch opens onboarding, without an account', async () => {
    setOnboarded(false);
    await renderRouter(ROUTES, { initialUrl: '/' });

    expect(await screen.findByText('Welcome')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.queryByText('Login')).toBeNull();
    // Nothing underneath: Android back / the iOS edge swipe cannot reach the Dashboard
    expect(testRouter.canGoBack()).toBe(false);
  });

  it('onboarding steps stack, so Back returns to the previous step', async () => {
    setOnboarded(false);
    await renderRouter(ROUTES, { initialUrl: '/' });
    expect(await screen.findByText('Welcome')).toBeTruthy();

    await act(async () => {
      appRouter.push('/(onboarding)/pomodoro-setup');
    });
    expect(await screen.findByText('Timer setup')).toBeTruthy();

    await act(async () => {
      appRouter.back();
    });
    expect(await screen.findByText('Welcome')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });

  it('resetting onboarding (or all data) from inside the app returns to onboarding', async () => {
    setOnboarded(true);
    await renderRouter(ROUTES, { initialUrl: '/settings' });
    expect(await screen.findByText('Settings')).toBeTruthy();

    await act(async () => {
      useSettingsStore.getState().updateSettings({ hasCompletedOnboarding: false });
    });

    expect(await screen.findByText('Welcome')).toBeTruthy();
    expect(screen.queryByText('Settings')).toBeNull();
    expect(testRouter.canGoBack()).toBe(false);
  });

  it('deep links cannot skip onboarding', async () => {
    setOnboarded(false);
    await renderRouter(ROUTES, { initialUrl: '/todo/123' });

    expect(await screen.findByText('Welcome')).toBeTruthy();
    expect(screen.queryByText('Todo detail')).toBeNull();
  });

  it('a returning user lands on the tabs, and onboarding is not reachable', async () => {
    setOnboarded(true);
    await renderRouter(ROUTES, { initialUrl: '/' });
    expect(await screen.findByText('Dashboard')).toBeTruthy();

    await act(async () => {
      appRouter.push('/todo/123');
    });
    expect(await screen.findByText('Todo detail')).toBeTruthy();

    // A deep link into onboarding falls back to the app
    await renderRouter(ROUTES, { initialUrl: '/welcome' });
    expect(await screen.findByText('Dashboard')).toBeTruthy();
  });

  it('completing onboarding moves to the tabs and leaves nothing to go back to', async () => {
    setOnboarded(false);
    await renderRouter(ROUTES, { initialUrl: '/' });
    expect(await screen.findByText('Welcome')).toBeTruthy();

    await act(async () => {
      useSettingsStore.getState().completeOnboarding();
    });

    expect(await screen.findByText('Dashboard')).toBeTruthy();
    expect(screen.queryByText('Welcome')).toBeNull();
    expect(testRouter.canGoBack()).toBe(false);
  });

  it('sign-in screens do not exist when sync is not configured', async () => {
    setOnboarded(true);
    await renderRouter(ROUTES, { initialUrl: '/login' });

    expect(await screen.findByText('Dashboard')).toBeTruthy();
    expect(screen.queryByText('Login')).toBeNull();
  });

  it('with sync configured, sign-in is an optional modal over the app', async () => {
    setSyncConfigured(true);
    setOnboarded(true);
    const router = await renderRouter(ROUTES, { initialUrl: '/settings' });
    expect(await screen.findByText('Settings')).toBeTruthy();

    await act(async () => {
      appRouter.push('/login');
    });
    expect(await screen.findByText('Login')).toBeTruthy();

    // What the login screen does after a successful sign-in
    await act(async () => {
      appRouter.back();
    });
    expect(await screen.findByText('Settings')).toBeTruthy();
    expect(screen.queryByText('Login')).toBeNull();
    expect(router.getPathname()).toBe('/settings');
  });

  it('unknown routes show the not-found screen', async () => {
    setOnboarded(true);
    await renderRouter(ROUTES, { initialUrl: '/does-not-exist' });
    expect(await screen.findByText('Not found')).toBeTruthy();
  });
});
