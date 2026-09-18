// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  {
    ignores: [
      '**/dist/**',
      '**/.expo/**',
      '**/web-build/**',
      '**/.metro/**',
      '**/.cache/**',
      '**/node_modules/**',
      '**/android/**',
      '**/ios/**',
      '**/scripts/**',
    ],
  },
  ...expoConfig,
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs', 'app.config.js', 'metro.config.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];
