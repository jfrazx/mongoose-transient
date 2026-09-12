import js from '@eslint/js';
import globals from 'globals';
import stylistic from '@stylistic/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist/', 'coverage/']),

  js.configs.recommended,

  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: true,
    jsx: false,
    arrowParens: true,
    commaDangle: 'always-multiline',
    blockSpacing: true,
    // customize() defaults to 'stroustrup'; Prettier emitted 1tbs and the
    // existing source uses it. The D5 mapping table omits braceStyle, so the
    // default would have silently rewritten `} catch {` across the codebase.
    braceStyle: '1tbs',
  }),

  // Style rules `customize()` does not express. Global, not `.ts`-scoped: the
  // Prettier settings these replace applied to every file, and `.editorconfig`
  // states `end_of_line = lf` under `[*]`.
  {
    rules: {
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/linebreak-style': ['error', 'unix'],
      '@stylistic/lines-between-class-members': [
        'error',
        'always',
        { exceptAfterSingleLine: true },
      ],
    },
  },

  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',
    },
    rules: {
      // tsc covers both of these, and core ESLint gets them wrong on TypeScript:
      // `no-unused-vars` flags parameters of type aliases and `this` parameters,
      // while `no-undef` cannot see ambient declarations. `noUnusedLocals`,
      // `noUnusedParameters` and type-checking in tsconfig.json are the authority.
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },

  {
    files: ['test/**/*.ts'],
    languageOptions: {
      globals: globals.jest,
    },
  },

  {
    files: ['jest.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
]);
