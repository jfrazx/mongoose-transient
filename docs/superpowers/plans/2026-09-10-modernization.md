# mongoose-transient Modernization Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan phase-by-phase. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring a 2021-era TypeScript mongoose plugin back to a working, releasable, currently-supported toolchain — green tests, working lint, live CI/CD, and a correctly-published dual ESM/CJS package.

**Architecture:** The library source is 121 lines in a single file and is architecturally sound; this is a toolchain and packaging modernization, not a rewrite. Exactly one source-level change is forced by Mongoose (the removal of `SchemaTypeOpts`). Everything else is build, test, lint, CI, release, and publish metadata.

**Tech Stack:** TypeScript 6.0.3, Mongoose 8/9, Jest 30 + ts-jest 29, mongodb-memory-server 11, ESLint 10 + `@stylistic/eslint-plugin` (as the formatter; no Prettier), semantic-release 25, GitHub Actions, npm.

**Spec:** This document (assessment + roadmap in one; there is no separate spec).

---

## Locked decisions (2026-09-11)

These were confirmed by the maintainer and supersede the first draft of this roadmap.

| # | Decision | Rejected alternative | Why |
|---|---|---|---|
| D1 | **TypeScript 6.0.3** | 7.0.2 (current `latest`); 5.9.3 (first draft) | `typescript-eslint@8.70` declares `typescript: ">=4.8.4 <6.1.0"` and `ts-jest@29.4.12` declares `">=4.3 <7"`. 6.0.3 is inside both ranges; 7.x is inside neither. The first draft's 5.9.3 was needlessly conservative. |
| D2 | **npm only** | yarn | Two lockfiles were in the tree. `yarn.lock` is deleted and gitignored; `package-lock.json` becomes the tracked lockfile. |
| D3 | **ESLint 10 + `@stylistic/eslint-plugin`, `@typescript-eslint/parser` only** | Full `typescript-eslint` ruleset; dropping typescript-eslint entirely | ESLint 10 core ships no TypeScript parser (the only built-in language object uses espree; the default flat config globs only `.js`/`.mjs`/`.cjs`). A parser is unavoidable if `.ts` is to be linted at all — but the *ruleset* is droppable, since `tsc --noEmit` already covers what most of those rules check. |
| D4 | **Dual ESM + CJS** | CJS-only (first draft left this open) | Consumers on `"type": "module"` need real named-export interop. |
| D5 | **`@stylistic` replaces Prettier outright** | Prettier as formatter with `@stylistic` filling gaps (the first draft's assumption) | Confirmed by the maintainer 2026-09-11. The two overlap by design — `@stylistic` exists to *be* the alternative. Running one tool means one source of truth for style and one `--fix` pass. Cost: line-width reflow is lost (see D5 caveat below). |
| D6 | **Delete `.npmignore`; `files` is the sole allowlist** | Keeping `.npmignore` alongside `files`; keeping it pruned of dead entries | Confirmed by the maintainer 2026-09-11. Two overlapping exclusion mechanisms is one more than anyone checks, and this one is fragile: `dist/index.d.ts` ships only because `!*.d.ts` appears *after* `*.ts`. Reorder those two lines and the package silently publishes without types. `.npmignore` also still lists `yarn.lock`, `tslint.json`, `mocha.opts`, `.nycrc.json`. |
| D7 | **`files: ["dist", "src"]`** | `files: ["dist"]` with `sourceMap` dropped in Phase 2; shipping an orphaned map | Confirmed by the maintainer 2026-09-11. `tsconfig` sets `sourceMap: true`, so `dist/index.js.map` ships; without `src/` it points at sources not in the tarball. `src/` is a single file (~4 kB). Pairs with the `declarationMap: true` Phase 2 already plans — declaration maps are useless unless sources ship. |
| D8 | **Dead-dependency check uses `node -e` over the manifest, folded into Phase 2** | `npm ls <pkg>` as a gate; a separate follow-up issue | `npm ls` prints the desired `(empty)` but **exits 1** when a package is absent — under `set -e` it fails precisely when it passes. Confirmed on this machine at `f2bb21f`. The corrected check belongs in the next unit of work, not three phases away on #53. |
| D9 | **`tsconfig.json` sets `"rootDir": "./src"`** | Accepting `dist/src/` output and repointing `main`/`types`; `ignoreDeprecations` (inapplicable — this is `TS5011`, not `TS5107`) | TypeScript 6 changed implicit `rootDir` inference. Without it `tsc` exits **2** with `TS5011` and emits to `dist/src/`. Isolated to the version bump: the *unmodified* `tsconfig.json` fails identically under 6.0.3 with deprecations silenced, and passes under 4.2.3. Since Phase 1 added `prepack`, an unfixed build breaks `npm publish`, not just CI. |
| D10 | ~~`jest`/`ts-jest` are not bumped in Phase 2~~ **Superseded by D11** | — | The measurement behind it was taken against an already-populated `node_modules`, where npm reports `overriding peer dependency` and exits 0. That is not what a clean resolution does. Kept here, struck through, because it was written into #50, #52 and #48 before it was falsified. |
| D11 | **`jest@^30`, `ts-jest@^29`, `@types/jest@^30` bump forward into Phase 2** | Leaving them in Phase 4 (D10); `--legacy-peer-deps`; an `overrides` entry | Forced, not chosen. `ts-jest@26` caps `typescript` at `<5.0`, so on a clean tree `npm ci` **fails with `ERESOLVE`** — the branch could not be installed from its own lockfile. No `ts-jest` below 28 accepts TypeScript 6, and `ts-jest@29` peers `jest ^29 \|\| ^30`, so the jest stack moves as one unit. `--legacy-peer-deps` and `overrides` would mask the conflict and leave CI (#53) installing an unsupported combination. |

**D12–D14** were locked during Phase 3 and are recorded in full on #51: D12 (`braceStyle: '1tbs'`), D13 (typescript-eslint's `eslint-recommended` reproduced inline for `.ts`), D14 (`no-undef` on for `test/`, `no-unused-vars` off). They are not reproduced here; this table was not updated at the time, and the gap is noted rather than back-filled from memory. **D14 is retired by D15–D18's phase** — see the Phase 4 section.

## Locked decisions (2026-09-18) — Phase 4

| # | Decision | Rejected alternative | Why |
|---|---|---|---|
| D15 | **The MongoDB driver is held at `~7.5` via `overrides`, paired with pinning `mongoose` to `~9.9`** | Pinning `mongoose` alone; pinning the mongod version; waiting for the upstream fix; the `overrides` entry alone with `mongoose@^9`; replacing Jest | `mongodb@7.6.0` fails the mongod handshake **under Jest specifically** (`MongoServerError: Missing required sub-document 'driver' in the client metadata document`); plain `node` is unaffected. Upstream: [mongodb-memory-server#1026](https://github.com/typegoose/mongodb-memory-server/issues/1026), [mongoose#16499](https://github.com/Automattic/mongoose/issues/16499), introduced by [node-mongodb-native#4992](https://github.com/mongodb/node-mongodb-native/pull/4992), tracked as [NODE-7832](https://jira.mongodb.org/browse/NODE-7832). Each rejected option was measured, not assumed: pinning `mongoose` to `~9.9` alone leaves `mongodb-memory-server` on its own nested `7.6.0` and still fails, since the failure is in the memory server's *internal* client; mongod 8.0.15 rejects the handshake identically, so the lever is the driver and not the server. The pairing matters — `mongoose@9.9.x` declares `mongodb: ~7.5`, `mongodb-memory-server` declares `^7.2.0`, so at `~7.5` **nothing in the tree is forced outside a range its own package declares**, and `npm ls` reports no override at all. This reverses D11's reasoning about `overrides` deliberately: D11's conflict was a permanent peer-range incompatibility being papered over, this is a dated upstream regression with an open ticket. **Temporary — removal tracked in #65.** |
| D16 | **The `pre('validate')` test hook drops its `next` parameter and becomes arity-0** | Preserving the callback form by wrapping so arity survives `jest.fn` | #52 predicted `next: Function` would need updating for *typing* reasons. It is a **runtime** break: `jest.fn()` erases the wrapped function's arity, so `kareem@3.4` classifies the hook as promise-style and invokes it with no arguments — `next()` then throws `TypeError: next is not a function` and two tests fail. Mongoose has supported hooks that simply return for many majors, so dropping the parameter is the smaller change, and it independently clears a `pre('validate')` overload type error. |
| D17 | **`collectCoverageFrom` is narrowed to `['src/**/*.ts']`** | Keeping `'**/*.ts'` plus the four-entry denylist | The denylist needs a new entry for every future root-level `.ts` file and fails silently when one is forgotten. The allowlist states the actual intent. |
| D18 | **`peerDependencies` becomes `"^8.0.0 \|\| ^9.0.0"`; the `^8` half stays** | Narrowing to `^9.0.0` on the grounds that 8.x is untested | `src/index.ts` type-checks with zero errors against both `mongoose@8.24.4` and `9.10.1`, and `Schema.prototype.remove(path)` is present at runtime and in the types on both — the library's entire contact surface with mongoose is types plus `Schema.prototype.{remove,path,virtual,eachPath}`. The 8.x *runtime* is not verified and cannot be here: `mongodb-memory-server@11` requires driver `^7.2.0` while `mongoose@8` requires `~6.x`, so D15's pin makes an 8.x suite run impossible. **Accepted on the condition that the release notes say 8.x is supported by inspection, not by CI.** Still a large improvement on `">= 4.4.5"`, which was simply false. |

### D1 re-checked 2026-09-12 — still 6.0.3

TypeScript `latest` has since moved to **7.0.2**, so the ceiling was re-verified rather than assumed.
`typescript-eslint@8.70.0` still declares `>=4.8.4 <6.1.0`; `ts-jest@29.4.12` still declares `>=4.3 <7`.
6.0.3 remains the highest version inside both, and 7.0.2 is inside neither. **No change to D1** — and no new
decision code, since re-minting one would make two entries look authoritative.

### D5 caveat: what is lost by dropping Prettier

`@stylistic` is a rule engine, not a reflowing formatter. Its own documentation is explicit
about the one capability that does not transfer:

> The `max-len` rule identifies lines exceeding a specified length but does not automatically
> wrap them. [...] consider using dedicated formatters like Prettier, dprint, or oxfmt, which
> treat line width as a wrapping preference.
> — [`max-len` README](https://github.com/eslint-stylistic/eslint-stylistic/blob/main/packages/eslint-plugin/rules/max-len/README.md)

So `.prettierrc`'s `printWidth: 85` has **no equivalent**. `@stylistic/max-len` can report a long
line but will never break it; the author breaks it by hand. Everything else in `.prettierrc` maps
onto `stylistic.configs.customize()` options cleanly — see Phase 3.

This is a known, accepted trade, not an oversight. If line-width reflow turns out to matter more
than single-tool simplicity, reversing D5 is a one-commit change.

---

## Baseline: verified current state

Everything in this section was observed on this machine, not inferred.

| Check | Command | Result |
|---|---|---|
| Type-check (TS 4.2) | `npx tsc --noEmit` | **PASSES** — src compiles clean today |
| Type-check (TS 6.0.3) | `tsc -p tsconfig.json --noEmit` | **FAILS** — 2 × `TS5107`, see below |
| Type-check (TS 6.0.3, modernized options) | as above with `target: ES2022` + `moduleResolution: nodenext` | **PASSES**, zero errors |
| Tests | `npx jest` | **FAILS** — every async test times out; `MongoMemoryReplSet` never becomes ready on Node 24, then `users.insertOne() buffering timed out after 10000ms` and the process crashes after teardown |
| Lint | `npx eslint 'src/**/*.ts'` | **FAILS to start** — `ESLint couldn't find the plugin "@typescript-eslint/eslint-plugin"` |
| Package contents | `npm pack --dry-run` | Ships `LICENSE`, `README.md`, `package.json`, `renovate.json` — **no `dist/`, no types** |
| Published | `npm view mongoose-transient` | Last release `1.0.4`, last modified **2022-05-09** |
| Local runtime | `node -v` | v24.14.1 |

The two TypeScript 6 errors, verbatim:

```
tsconfig.json(3,15): error TS5107: Option 'target=ES5' is deprecated and will stop
  functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"'
  to silence this error.
tsconfig.json(20,25): error TS5107: Option 'moduleResolution=node10' is deprecated and
  will stop functioning in TypeScript 7.0. Specify compilerOption
  '"ignoreDeprecations": "6.0"' to silence this error.
```

Both are hard errors, not warnings. Do **not** silence them with `ignoreDeprecations` — that just defers the same work to the TS 7 bump.

Installed vs. current (latest as published to npm, checked 2026-09-10):

| Package | Installed | Latest | Target |
|---|---|---|---|
| typescript | 4.2.3 | 7.0.2 | **6.0.3** (D1) |
| mongoose | 5.12.3 | 9.10.0 | 9 dev / `^8 \|\| ^9` peer |
| jest | 26.6.3 | 30.5.1 | 30 |
| ts-jest | 26.5.4 | 29.4.12 | 29 |
| eslint | 7.23.0 | 10.10.0 | 10 |
| prettier | 2.2.1 | 3.9.6 | **removed** (D5) |
| mongodb-memory-server | 6.9.6 | 11.2.0 | 11 |
| semantic-release | 17.4.2 | 25.0.9 | 25 |
| husky | 6.0.0 | 9.1.7 | 9 |
| @stylistic/eslint-plugin | — | 5.10.0 | 5 (new) |

## Global Constraints

- **TypeScript 6.0.3.** Not 7.x — out of range for both `typescript-eslint` and `ts-jest`.
- **Node floor: `>=20.19.0`.** Forced by `mongoose@9` and `mongodb-memory-server@11`. `semantic-release@25` needs `^22.14.0 || >=24.10.0`, so the *release* job specifically must run Node 24.
- **npm, one lockfile.** Delete `yarn.lock`, gitignore it, track `package-lock.json`.
- **`Schema.prototype.remove(path)` is still supported** in current Mongoose — `src/index.ts:29` does not need changing. (Mongoose 7 removed `Model.remove()`/`doc.remove()`, which this library does not use.)
- Do not change public API shape (`transient`, `TransientOptions`, `TransientCaller`, `Transience`) without a major version bump. Renaming `TransientTypeOpts`'s base type is a type-level breaking change for consumers who extend it — call it out in the release notes.

---

## Findings by area

### A. Release pipeline — dead (highest severity)

1. `.travis.yml` is the only CI. travis-ci.org is shut down; there is no `.github/` directory at all. **Nothing has run on push since 2022.**
2. `.releaserc` contains `{"branch": "master"}`. `branch` (singular) is the pre-v16 key; semantic-release 17+ expects `branches`. Even if CI ran, release-branch matching is misconfigured.
3. `coverage:post` runs `codecov`, the deprecated npm uploader (sunset after the 2021 supply-chain incident). Replace with `codecov/codecov-action` in CI, or drop coverage upload.
4. `travis-deploy-once` is obsolete and only exists to serve Travis.
5. There is no `prepack`/`prepublishOnly`. The tarball contains `dist/` only because `.travis.yml` happened to run `npm run build` before `semantic-release`. That coupling is invisible and fragile.

### B. Publish metadata — incomplete

6. No `"types"` field. TypeScript consumers currently resolve typings only via TS's `main`→`.d.ts` fallback. Make it explicit.
7. No `"files"` allowlist — publishing is governed by `.npmignore`, which is why `renovate.json` ships to npm.
8. No `"engines"` field.
9. CJS-only (`main` only, no `exports`, no ESM build). Addressed by D4.
10. `peerDependencies: { "mongoose": ">= 4.4.5" }` is false advertising: the source imports `mongoose.SchemaTypeOpts`, which Mongoose 6 removed. The honest range after migration is `^8.0.0 || ^9.0.0`.

### C. Source — one forced change

11. `src/index.ts:3` — `mongoose.SchemaTypeOpts` was **removed in Mongoose 6**; the replacement is `SchemaTypeOptions`. This is the only compile-blocking source change.
12. Optional quality items, not blockers: `Schema<any>` could be tightened; `getTypeOpts({ options }: any)` and the two `const self: any = this` casts could be narrowed; the 121-line single file could be split (`src/index.ts`, `src/options.ts`, `src/guards.ts`) for readability. Treat as Phase 6, and only if you want it.

### D. Tests — red, and 3 majors behind

13. `test/transient.spec.ts:7-21` uses `new MongoMemoryReplSet(...)` + `await replSet.waitUntilRunning()`. `waitUntilRunning` was removed in mongodb-memory-server 7; the modern form is `await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })` and `getUri()` is synchronous.
14. Same block passes `useNewUrlParser`, `useUnifiedTopology`, `useFindAndModify`, `useCreateIndex` — **all four removed in Mongoose 6**.
15. `jest.config.js` sets `collectCoverage: true` unconditionally, so `npm test` always pays the coverage cost; `--coverage` in `test:coverage` is then redundant. Also both `preset: 'ts-jest'` and an explicit `transform` are set — pick one.
16. `testRegex: '/test/\\w+.spec.ts$'` — the `.` is unescaped. Harmless in practice, still wrong.
17. 100% coverage thresholds on all four metrics are currently aspirational, since the suite cannot run. Keep them, but only re-enable the gate once green.
18. `tsconfig.json` `include` is `src/**/*` only, so test files are never type-checked by `npm run build`. Add a `tsconfig.test.json`.

### E. Lint & format — non-functional

19. `.eslintrc.js` lists plugins `@typescript-eslint` and `prettier`, but `@typescript-eslint/eslint-plugin`, `eslint-plugin-prettier`, and `eslint-config-prettier` are **not in `devDependencies`**. ESLint cannot start.
20. `extends` includes `prettier/@typescript-eslint`, a config **removed in eslint-config-prettier v8** (everything collapsed into plain `prettier`).
21. `parserOptions.useJSXTextNode` was removed from `@typescript-eslint/parser` — and there is no JSX in this project anyway.
22. There is **no `lint` script and no `format` script** in `package.json`.
23. ESLint 9+ requires flat config (`eslint.config.mjs`). `.eslintrc.js` will not be read.
24. `cspell.json` exists with no `cspell` dependency and no script. Either wire it up or delete it.

### F. Git hooks & conventions

25. `package.json` has a `husky.hooks` block — that is **husky v4 syntax**, but husky 6 is installed and there is no `.husky/` directory. The `prepare-commit-msg` hook does not run.
26. Commit messages are the release input (commit-analyzer). With the hook dead, nothing enforces conventional commits.

### G. Repo hygiene

27. Two lockfiles (resolved by D2).
28. `.gitignore` blanket-ignores `*.js` and `*.d.ts` at every level, with `!` escapes for `.eslintrc.js` and `jest.config.js`. Every new JS config file needs a new escape hatch. Prefer `.mjs` config filenames, or narrow the ignore to build output.
29. No `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, or issue/PR templates.
30. `README.md` has no badges, no `npm install` line, no stated Mongoose/Node compatibility, and no note on TypeScript module augmentation — consumers writing `transient: true` inside a schema definition get a type error unless the plugin augments `SchemaTypeOptions`.

### H. Renovate backlog — 12 open PRs, all superseded by this roadmap

Renovate is configured (`renovate.json`, `config:recommended`) and has been filing against a repo with no CI for four years. Dependency Dashboard is issue #37. Current state:

- **Open PRs #35–#47.** All target intermediate versions this roadmap jumps past — `mongoose` → v6, `semantic-release` → v19, `typescript` → 4.9.5, `eslint` → 7.32.0, `@typescript-eslint/parser` → v4.33/v8, `prettier` → 2.8.8, `ts-jest` → 26.5.6, plus lockfile-only bumps for `codecov` and `commitizen`.
- **Two are labelled `[security]`**: #35 (mongoose v6) and #36 (semantic-release v19). Both are subsumed — Phase 4 goes to mongoose 9, Phase 5 to semantic-release 25 — but they are the reason not to let this sit.
- **Renovate also proposes replacing `codecov` and `travis-deploy-once`** as deprecated, matching findings 3 and 4 independently.
- 8 further major bumps are rate-limited behind the dashboard.

None of these PRs should be merged. They should be closed as superseded once the phase that subsumes each one lands — closing them earlier loses the audit trail.

---

## Phases

Phases are ordered by dependency. Each lands as its own PR and leaves `master` in a working state.

### Phase 1: Foundation (no behavior change)

**Files:** Modify `package.json`, `.gitignore`; Create `.nvmrc`; Delete `yarn.lock`, `.npmignore`

The `yarn.lock` deletion and the `package-lock.json` addition are already staged in the
worktree; only the `.gitignore` rule is missing. Fold them into this phase's single commit.

- [ ] Add `yarn.lock` to `.gitignore` (D2).
- [ ] Add `"engines": { "node": ">=20.19.0" }` — verified against the registry: both
      `mongoose@9.10.0` and `mongodb-memory-server@11.2.0` declare `{"node": ">=20.19.0"}`.
- [ ] Create `.nvmrc` containing `24`.
- [ ] Add `"types": "dist/index.d.ts"` and `"files": ["dist", "src"]` (D7).
- [ ] Add `"prepack": "npm run build"` so the tarball can never ship without `dist/`.
- [ ] Delete `.npmignore` (D6).
- [ ] Remove dead devDependencies `codecov` and `travis-deploy-once`; remove the `coverage:post` script.
- [ ] **Run `npm install`** to prune the two removed packages and regenerate `package-lock.json`.
- [ ] Verify with `npm pack --dry-run`, then `npm ls codecov travis-deploy-once`.
- [ ] Commit.

`npm install` before committing is the step that is easy to skip and matters. Editing
`package.json` alone leaves both packages in `node_modules`, where `npm ls` reports them
**extraneous** rather than absent — failing the criterion for the wrong reason. It also
keeps `package.json` and the lockfile from disagreeing in a committed state.

`npm pack --dry-run` runs `prepack` (verified on npm 11.12.1), so the first criterion is
self-verifying — no separate `npm run build` needs to precede it.

**Acceptance criteria:**
- `npm pack --dry-run` lists **exactly** `LICENSE`, `README.md`, `package.json`,
  `dist/index.js`, `dist/index.d.ts`, `dist/index.js.map`, `src/index.ts` — and nothing else.
  (Amended: naming only `renovate.json` no longer catches the roadmap markdown under `docs/`,
  which is now the file most likely to leak.)
- `yarn.lock` is absent from the worktree and present in `.gitignore`; `package-lock.json` is tracked.
- `.npmignore` is absent from the worktree.
- `node -e "require('./package.json').engines.node"` prints `>=20.19.0`.
- `npm ls codecov travis-deploy-once`, **run after `npm install`**, reports both absent.

### Phase 2: TypeScript 6

**Files:** Modify `tsconfig.json`, `package.json`, `test/transient.spec.ts`, `test/lib/user.model.ts`

Issue: #50 · decisions D1, D7, D8, D9, D11 (D11 supersedes D10)

- [ ] Bump `typescript` to `~6.0.3` (D1) **together with** `jest@^30`, `ts-jest@^29` and
      `@types/jest@^30` (D11). These cannot be separated: `ts-jest@26` caps `typescript` at
      `<5.0`, so bumping TypeScript alone makes `npm ci` fail with `ERESOLVE` on a clean tree.
- [ ] Consequence of `esModuleInterop`: the test files' `import * as mongoose` must become a
      default import. Mongoose 5 exports an *instance*, and `__importStar` copies only own
      enumerable properties, so `connect`/`disconnect`/`plugin`/`model`/`Schema` arrive
      `undefined`. `src/index.ts` is unaffected — its mongoose import is type-only and elided.
- [ ] Consequence of `@types/jest@30`: Jest 30 removed the deprecated matcher aliases, so
      `toBeCalled` / `toBeCalledTimes` / `toThrowError` become `toHaveBeenCalled` /
      `toHaveBeenCalledTimes` / `toThrow`. Behaviour is identical.
- [ ] In `tsconfig.json`: `target: "ES2022"`, `lib: ["ES2022"]`, `module: "nodenext"`,
      `moduleResolution: "nodenext"`, plus `esModuleInterop: true`, `skipLibCheck: true`,
      `declarationMap: true`, `isolatedModules: true`, and **`rootDir: "./src"` (D9)**.
      **Keep `sourceMap: true`** — D7 ships `src/`, so both map kinds resolve for consumers.
      Keep `strict` and the existing `noUnused*` flags. Remove the now-invalid `target: "es5"`
      and `moduleResolution: "node"`.
- [ ] Do **not** add `ignoreDeprecations` — fix the options rather than silencing the error.
- [ ] Do **not** trim `skipLibCheck`: without it this option set produces 16 × `TS2344`
      from `@types/mongodb` under mongoose 5's types. It is load-bearing, not hygiene.
- [ ] Add a `"typecheck": "tsc --noEmit"` script.
- [ ] Run `npm run typecheck`, then `npm run build`, then `npm pack --dry-run`.
- [ ] Commit.

**Acceptance criteria:**
- `npx tsc --noEmit` exits 0 with no `TS5107` diagnostics. (Verified reachable: this exact
  option set compiles clean under 6.0.3 against the current source.)
- `npm run build` exits **0** and emits `dist/index.js`, `dist/index.js.map`, `dist/index.d.ts`,
  and `dist/index.d.ts.map` — flat, with **no `dist/src/` directory**. (D9; without `rootDir`
  this step exits 2 with `TS5011`.)
- `npm pack --dry-run` exits 0. `prepack` runs the build, so this is a real publish gate.
- `grep ignoreDeprecations tsconfig.json` finds nothing.
- The dead-dependency check (D8) prints `both absent` and exits **0**:

  ```bash
  node -e "const p=require('./package.json');
    const d={...p.dependencies,...p.devDependencies};
    const bad=['codecov','travis-deploy-once'].filter(k=>k in d);
    if (bad.length) { console.error('still present:',bad); process.exit(1); }
    console.log('both absent');"
  ```

**Knock-on:** `declarationMap` adds `dist/index.d.ts.map` to the tarball, so Phase 1's
"exactly 7 entries" criterion becomes **8** from here on. Expected, not a regression.

**Not in scope:** `tsconfig.test.json` and test-suite type coverage belong to Phase 4 (#52).
Test files already type-check clean under 6.0.3 (zero errors), so nothing here makes that harder.

### Phase 3: Lint & format

**Files:** Create `eslint.config.mjs`; Delete `.eslintrc.js`, `.prettierrc`; Modify `package.json`

Per D3 + D5: ESLint core rules + `@stylistic/eslint-plugin` as the **sole** style authority,
`@typescript-eslint/parser` for parsing only. No `typescript-eslint` ruleset, no
`@typescript-eslint/eslint-plugin`, no Prettier, no `eslint-plugin-prettier`, no
`eslint-config-prettier` (there is nothing left for it to turn off).

`.prettierrc` maps onto `stylistic.configs.customize()` like this:

| `.prettierrc` | `customize()` | Note |
|---|---|---|
| `singleQuote: true` | `quotes: 'single'` | matches |
| `trailingComma: 'all'` | `commaDangle: 'always-multiline'` | closest equivalent; `'all'` also adds dangles to single-line function params, which `@stylistic` does not do |
| `arrowParens: 'always'` | `arrowParens: true` | matches |
| `bracketSpacing: true` | `blockSpacing: true` + `@stylistic/object-curly-spacing` | `customize()` covers blocks; object literals need the rule set explicitly |
| (implicit) semicolons | `semi: true` | **must be set** — `customize()` defaults to `semi: false`, and the existing source uses semicolons |
| (implicit) 2-space | `indent: 2` | matches the default and `.editorconfig` |
| `endOfLine: 'lf'` | `@stylistic/linebreak-style: ['error', 'unix']` | not a `customize()` option |
| `printWidth: 85` | **no equivalent** | see D5 caveat — `@stylistic/max-len` reports but never wraps |
| (implicit) `jsx` | `jsx: false` | no JSX in this repo; leaving the default `true` loads dead rules |

- [ ] Remove `@typescript-eslint/parser@^4` and `prettier@^2` from devDependencies. Add `eslint@^10`, `@eslint/js@^10`, `@stylistic/eslint-plugin@^5`, `@typescript-eslint/parser@^8`.
- [ ] Write `eslint.config.mjs` in flat-config form: `js.configs.recommended`, then `stylistic.configs.customize({ indent: 2, quotes: 'single', semi: true, jsx: false, arrowParens: true, commaDangle: 'always-multiline', blockSpacing: true })`, then a `files: ['**/*.ts']` block setting `languageOptions.parser` to `@typescript-eslint/parser`.
- [ ] Add the rules `customize()` does not cover: `@stylistic/object-curly-spacing: ['error', 'always']`, `@stylistic/linebreak-style: ['error', 'unix']`, and `@stylistic/lines-between-class-members` (the one genuinely intentional rule in the old `.eslintrc.js`).
- [ ] Decide `@stylistic/max-len`. Either set it to `['warn', { code: 85, ignoreUrls: true, ignoreStrings: true }]` as an advisory echo of the old `printWidth`, or omit it. Do **not** set it to `error` — nothing can auto-fix it, so it would block `npm run lint` on lines no tool will repair.
- [ ] Drop the rest of the old rule block — `no-underscore-dangle`, `no-plusplus`, `func-names`, `prefer-destructuring`, `no-else-return`, etc. were all AirBnB-style overrides for a config this project no longer extends, and turning off a rule that is never turned on is noise.
- [ ] Delete `.eslintrc.js` and `.prettierrc`.
- [ ] Add scripts: `"lint": "eslint ."`, `"lint:fix": "eslint . --fix"`, `"format": "eslint . --fix"`, `"format:check": "eslint ."`. Keep the `format*` aliases so Phase 5's CI job and the Phase 6 husky hook do not need to know which tool is underneath.
- [ ] Run `npm run lint:fix` once and commit the formatting-only diff **separately**, so it does not pollute review of later phases. Expect it to be large — `semi`/`quotes`/`comma-dangle` touch nearly every line.
- [ ] Decide on `cspell.json`: wire it up with a `spell` script, or delete the file.
- [ ] Commit.

**Acceptance criteria:**
- `npm run lint` exits 0 and its output confirms `src/index.ts` was actually linted (verify by introducing a deliberate `no-unused-vars` violation and seeing it caught — a flat config that silently globs zero `.ts` files is the failure mode to guard against here).
- `npm run lint:fix` run twice in a row produces no diff on the second run (proves the rule set is internally consistent and has no fixer fight).
- `npm ls @typescript-eslint/eslint-plugin typescript-eslint eslint-plugin-prettier eslint-config-prettier prettier` reports all five absent.
- `.eslintrc.js` and `.prettierrc` are both deleted.
- `git grep -n 'prettier' -- package.json .github ':!package-lock.json'` returns nothing.
- `.editorconfig` and the `@stylistic` config do not contradict each other on `indent_size`, `end_of_line`, or `insert_final_newline`.

### Phase 4: Mongoose + test stack (these must land together)

The test suite cannot be fixed without moving Mongoose, and Mongoose cannot move without the memory-server bump. One PR.

**Files:** Modify `src/index.ts:3`, `test/transient.spec.ts:7-21`, `test/lib/user.model.ts`, `jest.config.js`, `package.json`; Create `tsconfig.test.json`

- [x] Bump devDependencies: `mongoose@~9.9` (D15, not `^9`), `mongodb-memory-server@^11`, and add
      the `overrides: { "mongodb": "~7.5" }` entry. The jest stack (`jest@^30`, `ts-jest@^29`,
      `@types/jest@^30`) already landed in Phase 2 under D11 — verified, not re-bumped.
- [x] Set `peerDependencies: { "mongoose": "^8.0.0 || ^9.0.0" }` (D18).
- [x] `src/index.ts:3` — change `extends mongoose.SchemaTypeOpts<T>` to `extends mongoose.SchemaTypeOptions<T>`.
      This is the whole of the forced source change: with it, `src/` type-checks with **zero** errors and
      no `Schema<any>` / `Document` fallout materialised.
- [x] `test/transient.spec.ts` — `let replSet: MongoMemoryReplSet`, then
      `replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });`
      and `await mongoose.connect(replSet.getUri());`. All four removed connect options deleted.
      The binding must become `let`: `create()` is async, so the old `const` at `describe` scope cannot stay.
- [x] `test/lib/user.model.ts` — **`HydratedDocument` / `CallbackWithoutResultAndOptionalError` turned out
      not to be needed.** `UserModel extends IUser, mongoose.Document` compiles clean against mongoose 9.
      The real change is D16: drop the `next` parameter, which is a runtime break rather than a typing one.
- [x] `jest.config.js` — drop `collectCoverage: true`, drop the redundant `transform` block, escape both
      dots: `testRegex: '/test/\\w+\\.spec\\.ts$'`, and narrow `collectCoverageFrom` per D17.
- [x] Create `tsconfig.test.json` extending the root config with `include: ["src/**/*", "test/**/*"]`;
      point `typecheck` at it. **Two overrides are load-bearing and neither is optional:** `rootDir: "."`
      (D9 set it to `./src`, which rejects test files with `TS6059`) and `"types": ["jest", "node"]`
      (TypeScript 6 does not auto-include `@types/jest` here — without it every jest global reports as an
      undefined name, 58 errors that look like real failures). `exclude` must also be restated, because
      `extends` replaces it and the root config excludes `**/*.spec.ts`. `@types/node` becomes an explicit
      devDependency rather than a transitive one, since `types` now names it.
- [x] `eslint.config.mjs` — retire D14's `no-undef` exception for `test/**/*.ts`; tsc is now the authority.
- [x] Run `npx jest`.
- [x] Commit.

**Acceptance criteria:**
- `npx jest` exits 0 with all 11 tests passing and no open-handle or post-teardown crash.
- `npx jest --coverage` meets all four 100% thresholds without lowering them.
- `grep -c 'useNewUrlParser\|useUnifiedTopology\|useFindAndModify\|useCreateIndex' test/transient.spec.ts` returns 0.
- `grep -c 'SchemaTypeOpts\b' src/index.ts` returns 0.
- `npm run typecheck` covers `test/` (deleting a needed import from a spec file makes it fail).
- **Known risk to check explicitly:** the "should not save transient properties" test asserts `toHaveLength(5)` on persisted keys — confirm Mongoose 9 has not changed which internal keys are stored, rather than adjusting the number to make it pass.
  **Resolved:** it has not. The assertion passes untouched; Mongoose 9 persists the same five keys.

**Outcome (2026-09-19):** all criteria met — **13/13** passing, 100% on all four coverage metrics, `src/` + `test/`
type-checking clean, `lint` and `build` green. The blocker this phase was written around (mongod 4.0.14 has no
darwin-arm64 build) is genuinely resolved by the memory-server bump, which defaults to mongod 8.2.6; it was
replaced by the upstream driver regression that D15 pins around.

**The count moved from 11 to 13, and the criterion above should be read as "the original 11 still pass".** Code
review found two gaps that warranted tests rather than notes:

- **A Mongoose 9 regression in the library itself.** `Schema.prototype.remove(path)` now deletes a Map path's
  `<path>.$*` entry along with the parent, and `eachPath()` walks a snapshot of path names while reading each
  type lazily — so removing during the walk handed `undefined` to a later callback and threw
  `TypeError: Cannot destructure property 'options' of 'undefined'`. Verified absent on mongoose 5.13.23, which
  leaves `m.$*` in place, so this is a migration regression and not pre-existing. `transient()` now collects
  every transient path before mutating any of them.
- **The `pre('validate')` hook had no behavioural test.** Only call counts were asserted, so an empty hook body
  would have passed — leaving D16's change of calling convention effectively unverified.

Review also found the suite was order-dependent: the module-level `jest.fn` spy was never reset, so
`toHaveBeenCalledTimes(2)` was counting a call that leaked from the preceding test. `npx jest --randomize`
failed on 3 of 5 seeds. With a `beforeEach` clear the correct isolated count is 1, and all 5 seeds pass.

### Phase 5: CI/CD

**Files:** Create `.github/workflows/ci.yml`, `.github/workflows/release.yml`; Delete `.travis.yml`; Modify `.releaserc`

- [ ] `.github/workflows/ci.yml`: trigger on `push` and `pull_request`; matrix `node-version: [20, 22, 24]`; run `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`, `npm test -- --coverage`.
- [ ] Coverage upload via `codecov/codecov-action@v5` (needs `CODECOV_TOKEN`), or drop coverage reporting — do not resurrect the deprecated `codecov` npm package.
- [ ] `.github/workflows/release.yml`: trigger on `push` to `master`; single job on Node 24 (semantic-release 25 requires `^22.14.0 || >=24.10.0`); `npm ci && npm run build && npx semantic-release`.
- [ ] Fix `.releaserc`: `{"branches": ["master"]}` — plural. Optionally add `@semantic-release/changelog` + `@semantic-release/git`.
- [ ] Bump `semantic-release` to `^25` and the two `@semantic-release/*` plugins to current majors.
- [ ] Set repo secret `NPM_TOKEN` (granular automation token). Consider `--provenance` with `id-token: write`.
- [ ] Delete `.travis.yml`.
- [ ] Commit.

**Acceptance criteria:**
- A green CI run appears on the PR across all three Node versions.
- `.travis.yml` is deleted and `.releaserc` contains `branches` (plural).
- Merging to `master` produces a real npm publish with a version above `1.0.4`.
- The published tarball, fetched with `npm pack mongoose-transient@<new>`, contains `dist/` and no `renovate.json`.

### Phase 6: Packaging, docs & Renovate cleanup

**Files:** Modify `package.json`, `README.md`; Delete `.npmignore`; Create `.husky/`, `commitlint.config.mjs`, `CONTRIBUTING.md`, `SECURITY.md`

- [ ] Dual ESM + CJS build (D4): add `tsup` or `tshy`, emit both formats, and add an `exports` map with `types` / `import` / `require` conditions. Keep `main` and `types` for old resolvers.
- [ ] Delete `.npmignore` now that `files` governs the tarball — keeping both invites drift.
- [ ] Migrate husky: `npm i -D husky@9`, `npx husky init`, move the `git cz` hook into `.husky/prepare-commit-msg`, add `"prepare": "husky"`, delete the `husky.hooks` block from `package.json`.
- [ ] Add `@commitlint/cli` + `@commitlint/config-conventional` with a `.husky/commit-msg` hook.
- [ ] README: badges, install line, compatibility matrix (Node ≥20.19, Mongoose 8–9), and a TypeScript section on how consumers type `transient` inside a schema definition.
- [ ] Add `CONTRIBUTING.md` and `SECURITY.md`.
- [ ] Close Renovate PRs #35–#47 as superseded, referencing the phase that subsumed each. Then re-enable the rate-limited majors from dashboard #37 and let Renovate re-baseline against a repo that now has CI.
- [ ] Optional: split `src/index.ts` into `src/index.ts` / `src/options.ts` / `src/guards.ts`. Behavior-neutral; the tests are the safety net.
- [ ] Commit.

**Acceptance criteria:**
- `node -e "import('mongoose-transient').then(m => console.log(typeof m.transient))"` prints `function` from a `"type": "module"` package.
- `node -e "console.log(typeof require('mongoose-transient').transient)"` prints `function` from a CJS package.
- `npx @arethetypeswrong/cli --pack .` reports no resolution errors.
- `.npmignore` is deleted; `files` is the only publish filter.
- A test commit with a non-conventional message is rejected by the `commit-msg` hook.
- Renovate PRs #35–#47 are closed, each with a comment naming its superseding phase.

---

## Sequencing

```
Phase 1 Foundation ──► Phase 2 TypeScript 6 ──► Phase 3 Lint
                                                     │
                                                     ▼
                                      Phase 4 Mongoose + tests  ◄── the unblocking phase
                                                     │
                                                     ▼
                                            Phase 5 CI/CD  ──► Phase 6 Packaging & docs
```

Phases 1–3 are low-risk. Phase 4 carries all the real risk and deserves its own focused session. Phase 5 is where the project becomes maintainable again — until it lands, Renovate keeps filing PRs that nothing verifies.
