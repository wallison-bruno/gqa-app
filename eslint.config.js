// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // `import styled from 'styled-components/native'` é o uso oficial da biblioteca.
    rules: { 'import/no-named-as-default': 'off' },
  },
]);
