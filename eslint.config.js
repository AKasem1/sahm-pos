// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Flat ESLint config (§3). Angular + TS recommended rules. Boundary enforcement
 * (no cross-feature internal imports) is documented as future work in the README —
 * a naive import rule false-positives on legitimate UI composition (the orders
 * board composes the AI panel + kitchen gauge), so it is intentionally omitted
 * here in favour of the documented convention.
 */
module.exports = tseslint.config(
  {
    // Global ignores (generated / vendored files).
    ignores: [
      'dist/**',
      'coverage/**',
      '.angular/**',
      'node_modules/**',
      'public/mockServiceWorker.js',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Intent-revealing output names like (close)/(select)/(cancel) read well on
      // our presentational components; the host never re-emits native events.
      '@angular-eslint/no-output-native': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {},
  },
);
