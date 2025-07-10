module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
    jest: true, // Add this line if you use Jest for testing
  },
  extends: [
    'airbnb-base',
  ],
  settings: {
    'import/resolver': {
      jest: {
        jestConfigFile: './jest.config.js',
      },
    },
  },
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    // Add any custom rule overrides here
    // For example, to allow console.log statements (often disallowed by Airbnb):
    'no-console': 'off',
    // Example: Allow unused variables if they are prefixed with an underscore
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Allow _id for MongoDB compatibility if needed, or other specific underscore uses
    'no-underscore-dangle': 'off',
    // If you use a lot of named exports and prefer them
    'import/prefer-default-export': 'off',
    // Allow devDependencies to be imported in test files
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          'tests/**/*.js',
          '**/*.test.js',
          '**/*.spec.js',
          '**/jest.setup.js',
          '**/jest.setup.live.js',
          '**/dotenv.setup.js',
        ],
      },
    ],
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
      },
    ],
    'max-len': ['error', { code: 120, ignoreComments: true }],
  },
  overrides: [
    {
      files: ['src/models/index.js'],
      rules: {
        'global-require': 'off',
      },
    },
  ],
};
