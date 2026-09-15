const tseslint = require('@typescript-eslint/eslint-plugin');
const parser = require('@typescript-eslint/parser');

module.exports = [
  { ignores: ['static/export-ui/build/**', 'node_modules/**'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parser, parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } } },
    plugins: { '@typescript-eslint': tseslint },
    rules: { ...tseslint.configs.recommended.rules, '@typescript-eslint/no-explicit-any': 'error', 'no-console': 'warn' }
  }
];
