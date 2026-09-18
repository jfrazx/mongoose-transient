import js from '@eslint/js';
import globals from 'globals';
import stylistic from '@stylistic/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  // ESLint ignores only node_modules/ and .git/ by default and does not read
  // .gitignore, so build and coverage output must be named explicitly.
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

  {
    rules: {
      // Not expressible through customize(); this is the only rule here that
      // customize() does not already emit.
      '@stylistic/linebreak-style': ['error', 'unix'],

      // customize() emits these two identically today. They are pinned anyway
      // because both were explicit intent -- object-curly-spacing carries
      // .prettierrc's `bracketSpacing: true`, and lines-between-class-members
      // was the one deliberate rule in the old .eslintrc.js -- and neither
      // should change silently if an upstream default moves.
      '@stylistic/object-curly-spacing': ['error', 'always'],
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
    },
    rules: {
      // js.configs.recommended is written for JavaScript, and several of its
      // rules misread TypeScript syntax -- no-redeclare, for one, reports every
      // function overload signature as a duplicate. D3 dropped the
      // typescript-eslint ruleset, so its `eslint-recommended` compatibility
      // layer is not available to import and is reproduced here instead. The
      // list and the ts() codes are from
      // @typescript-eslint/eslint-plugin@8 dist/configs/eslint-recommended-raw.js;
      // each rule is already enforced by the compiler under `npm run typecheck`.
      'constructor-super': 'off', // ts(2335) & ts(2377)
      'getter-return': 'off', // ts(2378)
      'no-class-assign': 'off', // ts(2629)
      'no-const-assign': 'off', // ts(2588)
      'no-dupe-args': 'off', // ts(2300)
      'no-dupe-class-members': 'off', // ts(2393) & ts(2300)
      'no-dupe-keys': 'off', // ts(1117)
      'no-func-assign': 'off', // ts(2630)
      'no-import-assign': 'off', // ts(2632) & ts(2540)
      'no-new-native-nonconstructor': 'off', // ts(7009)
      'no-obj-calls': 'off', // ts(2349)
      'no-redeclare': 'off', // ts(2451)
      'no-setter-return': 'off', // ts(2408)
      'no-this-before-super': 'off', // ts(2376) & ts(17009)
      'no-undef': 'off', // ts(2304) & ts(2552)
      'no-unreachable': 'off', // ts(7027)
      'no-unsafe-negation': 'off', // ts(2365) & ts(2322) & ts(2358)
      'no-with': 'off', // ts(1101) & ts(2410)

      // The same source enables these four for TypeScript.
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',

      // Not part of eslint-recommended -- that config expects
      // @typescript-eslint/no-unused-vars to take over, which D3 ruled out.
      // The core rule is TS-blind: it reports the parameter names of function
      // type aliases and `this` parameters, neither of which is a variable.
      // tsconfig.json's noUnusedLocals and noUnusedParameters cover src/.
      'no-unused-vars': 'off',
    },
  },

  {
    files: ['test/**/*.ts'],
    languageOptions: {
      // jest for the suite globals, node because testEnvironment is 'node' and
      // specs reach for console/process/setTimeout/Buffer.
      globals: { ...globals.jest, ...globals.node },
    },
    rules: {
      // Deliberately back on, against eslint-recommended's advice. That config
      // switches no-undef off because ts(2304) covers it -- but tsconfig.json
      // includes only src/** and excludes **/*.spec.ts, so tsc checks nothing
      // here and an undefined reference in the suite would go unreported.
      // Revisit when Phase 4 (#52) adds tsconfig.test.json; at that point tsc
      // becomes the authority for test/ too and this can go back off.
      //
      // This does NOT misfire on type-only references. no-undef resolves names
      // through whichever parser is configured, and @typescript-eslint/parser
      // ships @typescript-eslint/scope-manager, which registers interfaces and
      // type aliases as scope variables -- so `this: UserModel` in
      // test/lib/user.model.ts resolves, while a genuinely missing type is
      // still reported. The failure this looks like it should cause belongs to
      // espree, which is not the parser used for .ts here. Before disabling it
      // on that theory, run `npx eslint test/lib/user.model.ts` and check.
      'no-undef': 'error',
    },
  },

  {
    // Not ESM: flat config defaults .js to sourceType "module", which would
    // make `module.exports` an undefined global.
    files: ['jest.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
]);
