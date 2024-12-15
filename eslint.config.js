// eslint.config.js
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      // Error Prevention
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': [
        'warn',
        {
          allow: ['info', 'warn', 'error'],
        },
      ],
      'no-return-await': 'error',
      'require-atomic-updates': 'error',

      // Style & Formatting
      semi: ['error', 'always'],
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],
      indent: ['error', 2],
      'max-len': [
        'warn',
        {
          code: 100,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],

      // Best Practices
      'arrow-body-style': ['error', 'as-needed'],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'prefer-destructuring': [
        'warn',
        {
          array: false,
          object: true,
        },
      ],

      // Async/Await
      'require-await': 'error',
      'no-async-promise-executor': 'error',

      // Node.js Specific
      'no-path-concat': 'error',
      'no-process-exit': 'error',
      'no-sync': [
        'error',
        {
          allowAtRootLevel: true,
        },
      ],

      // Express Best Practices
      'no-buffer-constructor': 'error',
      'no-mixed-requires': [
        'error',
        {
          grouping: true,
          allowCall: true,
        },
      ],

      // Error Handling
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      'handle-callback-err': ['error', '^(err|error)$'],

      // Security
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
  },
];
