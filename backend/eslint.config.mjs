import js from '@eslint/js';

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'stockfish/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}', 'next.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        AbortController: 'readonly',
        Buffer: 'readonly',
        Headers: 'readonly',
        Promise: 'readonly',
        React: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  }
];
