// One time zone for every run (CI, contributors' machines), and one with daylight saving
// time, so date code is tested across DST changes (see __tests__/integration/streak-dates.test.ts).
process.env.TZ = 'America/New_York';

module.exports = {
  preset: 'jest-expo',
  // Resolves Reanimated/Worklets to their JS (non-native) implementations under Jest
  resolver: 'react-native-reanimated/jest/resolver',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@ui-kitten/.*|@supabase/.*|date-fns|i18next|react-i18next|standard-navigation)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'stores/**/*.ts',
    'utils/**/*.ts',
    'constants/gamification.ts',
    'constants/combo.ts',
    'constants/daily-quests.ts',
    'constants/weekly-goals.ts',
    '!**/*.d.ts',
    '!**/index.ts',
  ],
};
