# Session summary — 2026-10-11 — install-independent undeclared-import guard (T188)

**FID:** FID-2026-1011-004 (closed, archived)
**Register:** T188 item and its write surface removed on closure
**Operator directive:** "Build the install-independent undeclared-import guard
(T188) so this class can't reach a release again."

## What was delivered

`undeclared-imports` is now part of the fail-closed release gate battery
(`scripts/validation-gates.ts` → `repositoryValidationGates`), declared and
audited in `scripts/gate-declarability-registry.ts`, runnable by hand as
`bun run deps:undeclared`.

Two new modules:

- `scripts/undeclared-imports.ts` (247 lines) — a PURE detector. It extracts
  static import specifiers from one file's text and grades each against a
  supplied context. No filesystem, no git, no `node_modules`.
- `scripts/undeclared-imports-audit.ts` (299 lines) — the collector and probe.
  It supplies the file list (`git ls-files` over `*.ts *.tsx *.js *.mjs *.cjs`)
  and the context: `provided` from the 26 tracked manifests, `installed` from
  `bun.lock`, `linked` from the root `workspaces`.

## The rule

| Tier | Meaning | Verdict |
|---|---|---|
| `workspace` | a root `workspaces` member — bun links all of them | resolves |
| `declared` | some manifest declares it (or its `@types`) | resolves |
| `transitive` | no manifest names it; the lockfile has it only via another package | **fails** |
| `absent` | not in the lockfile either | **fails** |

`transitive` is the v0.0.35 `ajv` case (eslint supplied ajv 6, connectors wanted
the v8 `dist/2020.js`, no manifest described the difference). `absent` is the
v0.0.24 `@noble/hashes` case. Both fail.

## What the audit found (the "every workspace" sweep)

Four packages that no manifest declared, all now declared:

- `picocolors` — four files under `cli/src` that are bundled into the shipped
  binary. Nothing owned it; it arrived only through `pino`. Declared in
  `cli/package.json`, and in `scripts/tmux/package.json` for the viewer.
- `js-yaml` — `scripts/tmux/tmux-viewer/session-loader.ts`. Declared in
  `scripts/tmux/package.json`.
- `globals` — `eslint.config.js`. Declared at the root.
- `playwright` / `playwright-core` — `cli/scripts/hud-preview-browser-check.ts`,
  the desktop browser-smoke fixtures, and the `savant-motion` skill's verify
  script. Declared at the root.

`bun.lock` was regenerated; `bun install --frozen-lockfile` reports no changes.

## Two defects the guard found in itself

Both were caught by evidence rather than review, and both are pinned by tests:

1. **An import-shaped string is not an import.** The first implementation used a
   regex over the source and reported 146 findings, including a minified sigma
   bundle stored in a string literal (`cli/src/constants/sigma-runtime-chunks/`)
   and a regex literal asserting on import text
   (`desktop/src/floor/__tests__/office-lazy.test.tsx`). Replaced with a
   single-pass tokenizer that skips comments and string bodies and only accepts
   a string preceded by an import keyword.
2. **"No manifest declares it" is not "nothing installs it".** `picocolors`,
   `js-yaml`, `globals` and `playwright` are all present in `bun.lock` as
   transitive dependencies. Treating them as absent would have been a false
   statement; treating them as resolvable would have hidden the v0.0.35
   precondition. They are their own tier, and the tier fails.

Also carried in this session, from the same incident:

- `cli/release-core/launcher.js` reports a failed background update instead of
  swallowing it (still non-fatal; the session starts normally), with a pin in
  `cli/src/__tests__/release/wrapper-safety-launcher.test.ts`.

## Verification

Every gate was run with its exit status read directly:

```text
bun run deps:undeclared                                        → exit 0, PASS
cd scripts && bun test __tests__/undeclared-imports.test.ts    → 24 pass / 0 fail
cd scripts && bun test __tests__/gate-declarability.test.ts \
      validation-manifest.test.ts public-release-gates.test.ts → 24 pass / 0 fail
cd cli && bun test src/__tests__/release/wrapper-safety-launcher.test.ts → 7 pass / 0 fail
bun run typecheck:scripts                                      → exit 0
bun run validate:repository                                    → exit 0, validation: PASS
bun run quality:report                                         → exit 0, PASS (1502 baselined)
bun x eslint <changed files> --max-warnings 0                  → exit 0
bun run lint:md                                                → exit 0
bun install --frozen-lockfile                                  → exit 0, no changes
bun run fid:verify <fid> --write                               → 7/7 gates exit 0, receipt stamped
```

## Boundaries, stated honestly

- **The guard is manifest-and-lockfile level, not resolution level.** It proves
  a package is declared or installed; it cannot prove the *subpath* or *version*
  an import needs exists. The v0.0.35 trigger was `ajv/dist/2020.js` against
  ajv 6 — a version/subpath mismatch. This gate reaches that incident through
  the tier that names it (`transitive`: nothing owned ajv), and the bundler gate
  is still the one that would catch a wrong-version subpath — provided it is run
  against a clean install, which is the half `cli-bundle-resolution` gets wrong
  today.
- **A value import of a package that only has `@types` installed passes.** The
  alias is modelled because TypeScript resolves `import type` through
  `@types/<name>` (`mdast` is absent from the install entirely). The leniency is
  documented in `isProvided`.
- **`scripts/__tests__` is not in the root `test` chain.** The new suite is
  proven by its FID gate and by `validate:repository`'s live re-run while a FID
  declares it; a bare `bun test` at the repo root also picks it up. This matches
  the existing convention for that directory and is not specific to this work.
- **No push and no release were performed in this session.** The commit is local.
