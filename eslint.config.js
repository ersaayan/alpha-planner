// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // TypeScript already checks namespace members. eslint-plugin-import misreads
    // compiled modules whose exports follow a doc comment on the same line
    // (e.g. expo-notifications' AndroidImportance) and reports false errors.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'import/namespace': 'off',
    },
  },
]);
