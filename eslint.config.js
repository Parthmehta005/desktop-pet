import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'out/**', 'coverage/**', 'test-results/**', 'playwright-report/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // src/core runs unchanged in Node (main process, tests) and in the browser
    // (renderer, preview page), so it gets no environment globals at all and may
    // only import other core modules.
    files: ['src/core/**/*.js'],
    languageOptions: { globals: {} },
    rules: {
      'no-console': 'error',
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '^(?!\\.\\.?/)',
          message: 'src/core must stay pure: import only other src/core modules.',
        }],
      }],
    },
  },
  {
    files: ['test/**/*.js', 'scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // The Electron main process (Node).
    files: ['src/main/**/*.js', 'src/main/**/*.cjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    // Code that runs in a web page: the renderer and the preview page.
    files: ['src/renderer/**/*.js', 'preview/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Browser and Electron tests run in Node but pass callbacks to page.evaluate().
    files: ['test/browser/**/*.js', 'test/electron/**/*.js', 'test/packaged/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
