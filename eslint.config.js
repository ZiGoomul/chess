import js from '@eslint/js';
import globals from 'globals';

// JavaScript only: TypeScript files are checked by `tsc` (see tsconfig.strict.json).
export default [
  { ignores: ['dist/', 'node_modules/', 'public/', 'extension/', '.github/', '.kilo/', '.claude/', '**/*.ts'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, $: 'readonly', jQuery: 'readonly', Chessboard: 'readonly' }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // The UI code predates ESLint and uses function-scoped `var`; tolerate repeats until it is modernised.
      'no-redeclare': 'warn'
    }
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } }
  }
];
