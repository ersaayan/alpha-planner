/**
 * The data layer must not load UI animation code. constants/theme used to re-export
 * constants/animations, which imports react-native-reanimated; because category-store
 * imports the theme palette and gamification-store requires category-store lazily, the
 * first Pomodoro credit paid for loading Reanimated (300 ms+ in Jest, enough to time
 * out the lifecycle test under load).
 */
jest.mock('react-native-reanimated', () => {
  throw new Error('react-native-reanimated was loaded by a data-layer module');
});

/* eslint-disable @typescript-eslint/no-require-imports -- the point is to require these modules here */
describe('data-layer imports', () => {
  it('stores, start-up and sync modules do not load react-native-reanimated', () => {
    expect(() => {
      require('@/stores');
      require('@/stores/hydration');
      require('@/stores/reset-all-data');
      require('@/services/app/startup-tasks');
      require('@/services/sync');
      require('@/constants/theme');
    }).not.toThrow();
  });
});
