module.exports = {
  preset: 'jest-expo',
  // Resolves Reanimated/Worklets to their JS (non-native) implementations under Jest
  resolver: 'react-native-reanimated/jest/resolver',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@ui-kitten/.*|@eva-design/.*|@supabase/.*|date-fns|i18next|react-i18next)',
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
