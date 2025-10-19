// ESLint flat config for ESLint v9 (CommonJS export)
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['frontend/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-useless-escape': 'error',
    },
  },
];
