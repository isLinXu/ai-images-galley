import globals from 'globals';
import js from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        tf: 'readonly',
        mobilenet: 'readonly',
        cocoSsd: 'readonly'
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      // 潜在问题
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-alert': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // 最佳实践
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'multi-line'],
      'no-var': 'error',
      'prefer-const': 'warn',
      'prefer-template': 'warn',
      'object-shorthand': 'warn',
      'array-callback-return': 'warn',

      // 风格问题
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'indent': ['warn', 4, { SwitchCase: 1 }],
      'comma-dangle': ['warn', 'never'],
      'space-before-function-paren': ['warn', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always'
      }],
      'keyword-spacing': 'warn',
      'space-infix-ops': 'warn',
      'eol-last': 'warn',
      'no-trailing-spaces': 'warn',

      // ES6+
      'arrow-spacing': 'warn',
      'template-curly-spacing': 'warn',
      'rest-spread-spacing': 'warn',

      // 安全性
      'no-inner-declarations': 'error'
    }
  },
  {
    // 忽略文件
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.html',
      'service-worker.js'
    ]
  }
];