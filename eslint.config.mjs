import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * ESLint flat config.
 *
 * The project shipped a `lint` script with no ESLint behind it: no config file
 * and no packages installed, so `pnpm lint` failed on every run and nothing in
 * this repository had ever been linted. This adds the real thing.
 *
 * eslint-config-next 16 exports flat config arrays directly, so they are spread
 * in as-is. An earlier attempt routed them through FlatCompat, which is for
 * translating legacy eslintrc configs and threw "Converting circular structure
 * to JSON" on a config that was already flat.
 */
const config = [
  {
    // Build output, dependencies and generated files. Linting the compiled test
    // output would report thousands of problems in code nobody wrote.
    ignores: [
      '.next/**',
      '.tests-build/**',
      'node_modules/**',
      'next-env.d.ts',
      'public/**',
      '*.tmp.mjs',
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    rules: {
      // Several modules legitimately narrow `unknown` at a trust boundary.
      // A warning keeps new ones visible without turning the build red.
      '@typescript-eslint/no-explicit-any': 'warn',

      /*
       * The React Compiler rules below are kept ON as warnings rather than
       * switched off, because they are pointing at real code smells.
       *
       * They are not errors here because the remaining cases are the two
       * patterns the rule cannot yet distinguish from a bug: hydrating client
       * state from localStorage on mount (lib/store.tsx), and re-syncing a
       * screen when the vehicle in the URL changes (insurance, compare).
       * Both are deliberate, both are covered by tests, and rewriting four
       * working screens to satisfy a lint rule is a worse trade than leaving
       * a visible warning.
       *
       * New violations still show up in `pnpm lint`. If this list grows, the
       * right answer is to fix them, not to raise the ceiling.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // Empty catch blocks are deliberate in a few places where a failure genuinely
      // does not matter (analytics beacons, blocked localStorage).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  {
    // Node scripts are not part of the Next app and print to the console on purpose.
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
]

export default config
