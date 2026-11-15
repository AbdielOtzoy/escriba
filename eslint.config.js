const js = require('@eslint/js');
const globals = require('globals');

// Each source file is a classic script that declares one global; these are the ones a
// file may read from the others (see the load order in manifest.json and the pages).
const extensionGlobals = {
  MSG: 'readonly',
  STATE: 'readonly',
  STORAGE: 'readonly',
  DEFAULT_SETTINGS: 'readonly',
  i18n: 'readonly',
  transcript: 'readonly',
  historyStore: 'readonly',
  meetDom: 'readonly',
  layout: 'readonly',
  watchdog: 'readonly',
};

module.exports = [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        chrome: 'readonly',
        ...extensionGlobals,
      },
    },
    rules: {
      // A file's own top-level declaration is "unused" inside that file by design.
      'no-unused-vars': ['error', { vars: 'local', argsIgnorePattern: '^_' }],
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
  {
    files: ['test/**/*.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
];
