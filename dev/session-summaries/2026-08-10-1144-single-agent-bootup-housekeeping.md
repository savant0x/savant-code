<!-- markdownlint-disable MD013 -->

# Session Summary: 2026-08-10 11:44

**Session ID:** 2026-08-10-1144-single-agent-bootup-housekeeping
**Duration:** 2026-08-10 11:44 EDT — (open)
**Status:** active

**Governing protocol:** Single-agent ECHO v0.1.2 (`dev/echo-v0.1.2-single-agent.md`,
`single_agent.protocol` in `protocol.config.yaml`, `strict_mode: true`).
The harness ECHO.md (v0.2.0) does not govern this session.

---

## Initial State

### Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript strict monorepo; Bun 1.3.14 (project contract)
- **Branch:** `main`
- **HEAD:** `98acc25 docs: record v0.0.22 release + release lessons`
- **Version:** `0.0.23` (pending, unreleased — VERSION + 12 checked manifests aligned)
- **Worktree:** 253 uncommitted entries (111 modified / 124 untracked / 14 deletions /
  2 renames), consistent with the 2026-08-09 release-ready handoff's pending commit

### Active FIDs (dev/fids/)

**Zero.** `dev/fids/` holds only `README.md` + `.gitkeep` + `archive/` (all closed records).

### Known Issues

- **Stale session-summary status (corrected in this record — see below):**
  `2026-08-09-1206-single-agent-init.md` still carries `Status: active` / session open,
  despite two newer end-of-session handoffs (`2026-08-09-0.0.23-pending-housekeeping.md`,
  `2026-08-09-0.0.23-release-ready-handoff.md`) superseding it. Per the session-summaries
  README no-rewrite rule, the historical file is preserved unchanged; the correction is
  recorded here.
- **253 uncommitted entries** — operator controls commits; no auto-commit.
- **Release prerequisites outstanding (operator actions):** clean shell for the `ci` build
  (set aside `.env.local`, unset dev `NEXT_PUBLIC_*` overrides), then
  `bun run ci` → `bun run release:public:preview` → commit/push → publish `0.0.23`.

---

## Bootup & Grounding (2026-08-10 ~11:30)

- Read `dev/echo-v0.1.2-single-agent.md` 0-EOF; confirmed the marker
  (`ECHO-single-agent.md`) and `single_agent.protocol` (version `0.1.2-single-agent`,
  `strict_mode: true`). Session variant: **single-agent**; harness ECHO.md does not govern.
- **Protocol activation:** Core Laws 1–4 confirmed (always active); Extended Laws 5–15
  confirmed (strict mode active).
- **Read gate satisfied:** protocol, marker, config, FID template, FID directory state, and
  the prior session summaries were read before any non-read work. No files were modified
  during bootup.
- No-signature policy active: this record carries no author/attribution fields.

## Housekeeping Pass (2026-08-10 ~11:35–11:50, operator-selected, read-only)

### FID ground-truth — PASS

- Zero active FIDs verified on disk.
- Boot-contract healing (FID-2026-0809-010) verified: `ECHO-single-agent.md` is tracked and
  points to the real `dev/echo-v0.1.2-single-agent.md`; `dev/nova/specs/` holds only
  `goal-loop-feature-spec.md` + `launch-strategy-research-prompt.md` — the absent
  `dev/nova/specs/echo-v0.1.2-single-agent.md` path is gone from active code (archives only).
- Provider-registry implementation (FID-2026-0809-001) present: `common/src/providers/` +
  `sdk/src/impl/model-provider/`.
- 60+ archived FIDs all `closed`; no active-ledger drift.

### Session-summary hygiene — one minor flag (corrected in this record)

- Index + README intact; dated filenames consistent; no rewritten history.
- Flag: `2026-08-09-1206-single-agent-init.md` status metadata is stale (see Known Issues).

### Doc-drift scan — PASS

- Version alignment: `VERSION` + all 12 checked package.json manifests = `0.0.23`
  (root, agents, cli, common, evals, savant-free, sdk, packages/agent-runtime,
  packages/code-map, packages/database, packages/knowledge-graph, packages/llm-providers).
- `FREEREADME.md` and `ECHO-freebuff.md` confirmed absent on disk; zero active references
  (only archives, archived test prompts, and the ephemeral scratchpad mention them).
- Zero active references to `dev/nova/specs/echo-v0.1.2-single-agent.md`.
- README/README.zh-CN badges and blurbs identify `0.0.23` as pending/unreleased.
- Release gate previously re-run green under pinned Bun `1.3.14` (release-ready handoff).

**Verdict:** tree is release-ready and housekeeping-clean; no new FIDs required.

## Full 0.0.23 Validation Gate Run (2026-08-10 ~11:50, operator-directed)

Full release gate re-run under Bun `1.3.14` (pinned contract version — confirmed via
`bun --version`; the earlier 1.3.11 environment note is resolved in this shell).

| Gate | Result |
|---|---|
| Typecheck × 10 (common, agents, sdk, cli, evals, agent-runtime, code-map, database, knowledge-graph, llm-providers) | exit 0 |
| Full test chain (`bun run test` — sdk, cli, common, agents, evals, agent-runtime, code-map, database, knowledge-graph, llm-providers, scripts) | exit 0 — no failures |
| ESLint `--max-warnings 0` | exit 0 |
| Markdownlint (`bun run lint:md`) | exit 0 |
| Prettier check (`bunx prettier --check .`) | exit 0 — all files formatted |

**Verdict: tree is GREEN end-to-end.** No code changes were made this session; the tree
remains the pending 0.0.23 release candidate. Remaining release steps are operator actions
(clean-shell `ci` build, `release:public:preview`, commit/push, publish).

## Release Prerequisites + Clean-Env `ci` Build (2026-08-10 ~11:55, operator-directed)

### Prereq scan (per FID-2026-0805-002 env-integrity gate)

- **Shell:** 10 dev `NEXT_PUBLIC_*` overrides present (values redacted) — the leak class the
  gate blocks.
- **`.env.local`:** repo root `.env.local` present (dev values, leak source);
  `resources/great_cto/tests/fixtures/web-fullstack-node/.env.local` is a test fixture and
  was not touched. `.env.local` is gitignored.
- **Bun:** `1.3.14` (pinned contract version) confirmed.

### First attempt: bare clean env → FAILED (correctly)

Set `.env.local` aside + unset all 10 dev vars, ran `bun run ci` with an empty env.
**Exit 1** — `build:savant-free` aborted at the agent prebuild:
`Invalid environment configuration` zod errors (`NEXT_PUBLIC_SAVANT_CODE_APP_URL`, `SUPPORT_EMAIL`,
`POSTHOG_*`, `STRIPE_*`, `WEB_PORT` received `undefined`; `Agent prebuild aborted: 2 agent
definition(s) failed to load; existing bundle was not replaced`).

**Root cause (contract, not a bug):** `common/src/env-schema.ts` zod-requires the 8 core
`NEXT_PUBLIC_*` vars, and `common/src/env.ts` throws on a failed parse. The release engine
injects `CANONICAL_NEXT_PUBLIC_DEFAULTS` (`scripts/public-release.ts:159`) and CI sets the
canonical block explicitly, so a truly empty shell is not a valid build env. The handoff's
"set aside + clear overrides" guidance is incomplete for a bare local `ci` run — the canonical
prod env must be injected.

### Second attempt: canonical env → PASS

Set aside `.env.local`, unset the 10 dev vars, and injected `CANONICAL_NEXT_PUBLIC_DEFAULTS`
verbatim (from `cli/scripts/build-binary.ts:52-61`) via `env` for `bun run ci`:

| Gate | Result |
|---|---|
| SDK build | exit 0 (ESM/CJS/Types/WASM + ripgrep binaries) |
| SavantFree binary build | exit 0 — `✅ SavantFree v0.0.0-dev built successfully` |
| Env-integrity gate | clean — no block, no override warning |
| Built `cli/bin/env.json` | all 10 canonical `NEXT_PUBLIC_*` keys; dev-leak scan: 0 hits |
| Artifacts | `cli/bin/savant-free.exe` (129.9 MB, fresh), `tree-sitter.wasm`, `elk-worker.min.js`, audio assets |
| `.env.local` | restored to original state (no `.release-aside` residue) |

**Result: `bun run ci` passes in a clean, canonical-env shell.** The correct clean-shell
recipe is: set aside `.env.local` + unset dev `NEXT_PUBLIC_*` overrides + inject the canonical
prod block (exactly what the release engine/CI do). Next operator step:
`bun run release:public:preview`.

### Handoff guidance corrected (operator-directed)

`dev/session-summaries/2026-08-09-0.0.23-release-ready-handoff.md` was updated to correct the
incomplete clean-shell guidance: the "set aside + clear overrides" recipe now documents that a
bare empty shell fails the zod env schema, and that the canonical prod block
(`CANONICAL_NEXT_PUBLIC_DEFAULTS`, `cli/scripts/build-binary.ts:52-61`) must be injected for
`bun run ci` — mirroring `scripts/public-release.ts` `PROFILE_ENV` and CI. Morning checklist
re-numbered (1–7) with the injection as step 2. Marked as corrected 2026-08-10; verified with
the green run above.

### Release preview dry-run (`bun run release:public:preview`) — 2026-08-10 ~12:05

Ran with the same clean-env recipe (set aside `.env.local`, unset dev `NEXT_PUBLIC_*`,
inject canonical prod block). **PREVIEW_EXIT=0** — all green.

| Preview Output | Value |
|---|---|
| Planned version | `v0.0.23` |
| Gates | All passed (build, typecheck, test, lint, format, package) |
| Packages | `@savant-code/sdk` + `savant-code` (note: SDK block known — npm scope missing) |
| Binary assets | 5 standard tarballs per target |
| 10-stage plan | validate → snapshot → profile → gates → tag → push → GitHub release → npm SDK → npm CLI → verify |
| Warnings | None |
| `.env.local` | Restored ✅ |

**Go/No-Go:** GO for the next operator-authorized release. The sole known blocker is the
`@savant-code` npm scope (same as v0.0.22 — requires `npmjs.com/org/create` as `fame0x`).
Set `SAVANT_CODE_RELEASE_PACKAGES=savant-code` to skip SDK if not creating the scope.

### LEARNINGS.md entry added

`dev/LEARNINGS.md` — new entry `Session 2026-08-10: Clean-Shell ci Contract — Canonical Env
Required by Zod Schema` documenting the lesson: a clean shell is not an empty shell;
the zod schema requires the 8 core NEXT_PUBLIC_* vars; the release engine and CI
inject canonical defaults; the env-integrity gate (leak detection) and the zod schema
(absence detection) are two distinct gates. Both markdownlint and prettier pass.
Corrected handoff guidance links to this entry.

### FID created: Dev bootup hard crash (FID-2026-0810-001)

`dev/fids/FID-2026-0810-001-dev-bootup-env-validation-hard-gate.md` — filed after operator
reported `bun dev` crash with zod `Invalid environment configuration`. The FID catalogs
three interacting structural problems:

1. **All-or-nothing module-load env validation** (`common/src/env-schema.ts:6-21`): 8 of 12
   `NEXT_PUBLIC_*` vars are required with zod `.min(1)`/`.url()`/`.email()`/`.coerce.number()`
   — missing any one throws a hard `Error` at module scope (`common/src/env.ts:44-50`).
2. **Prebuild does not load `.env.local`** (`cli/scripts/prebuild-agents.ts`): `load-dev-env.ts`
   exists precisely for this but is not imported by the prebuild script, so agent-file
   imports hit the zod gate before any env loading occurs.
3. **Manual-E2E harnesses scanned by prebuild** (`agents/*/manual-e2e.ts`): renamed from
   `.test.ts` in FID-2026-0809-017, now in the prebuild scan glob (only `.test.ts` and
   `.d.ts` excluded) — with env absent they become the crash trigger.

Proposed phased fix: Phase 1 wires `load-dev-env` into prebuild + excludes manual-e2e
files from scan (minimal, unblocks dev boot). Phase 2 improves error messaging / schema
(operator decision). Phase 3 adds dev-mode defaults. Awaiting operator direction.

FID is `Status: closed`, archived at `dev/fids/archive/`.

### FID implementation — all 3 phases (2026-08-10 ~12:40)

Operator approved the converged FID at automation level 3. Changes:

- **Phase 1** (`cli/scripts/prebuild-agents.ts`):
  - Added `import '../src/pre-init/load-dev-env'` before the scan loop — this
    loads the repo-root `.env.local` via `findUp()` walk, fixing the `--cwd cli`
    Bun auto-loader mismatch.
  - Added `!entry.name.endsWith('manual-e2e.ts')` to the scan filter — the two
    manual-E2E harness files are not agent definitions and should not be imported.
- **Phase 2** (`common/src/env.ts`): Improved error message from raw zod dump to
  actionable guidance: *"Missing required environment variables. Copy .env.example
  to .env.local and replace the dummy values with your own."*
- **Phase 3** (`common/src/env.ts`): Added `DEV_DEFAULTS` map for non-boot-critical
  vars (`SUPPORT_EMAIL`, `POSTHOG_*`, `STRIPE_*`, `GOOGLE_SITE_VERIFICATION_ID`).
  Applied via `process.env[key] ?? DEV_DEFAULTS[key]` before schema validation.
  The schema stays strict (no type changes) — defaults fill in missing values.

**Verification:** `bun run prebuild:agents` with `.env.local` set aside and all
`NEXT_PUBLIC_*` vars unset → exit 0. Common typecheck exit 0, agents typecheck exit 0,
markdownlint exit 0, prettier exit 0. FID closed, archived, CHANGELOG entry appended.

### Full gate re-run after FID changes (2026-08-10 ~13:30)

Full 0.0.23 validation gate re-run after the FID implementation:

| Gate | Result |
|---|---|
| Typecheck × 10 (all workspaces) | exit 0 |
| Full test chain (`bun run test`) | exit 0 — no failures |
| ESLint `--max-warnings 0` (full repo) | exit 0 (first pass flagged 2 `no-console` warnings in the new `env.ts` error path; fixed with per-call eslint-disable comments, re-run clean) |
| Markdownlint | exit 0 |
| Prettier (full repo) | exit 0 |

Tree remains GREEN end-to-end after the FID-2026-0810-001 changes.

### Harness boot-contract correction — CLI now boots with ECHO.md (2026-08-10 ~14:30)

Operator reported that the Savant boot response instructed the agent to read
`dev/echo-v0.1.2-single-agent.md` as the protocol bootstrap file. Root cause:
the CLI product hard-coded `protocolVariant: 'single-agent'` in both run paths,
which resolved the single-agent protocol (`ECHO-single-agent.md` marker →
`dev/echo-v0.1.2-single-agent.md`) into the generated Savant system prompt.

Per operator directive: **the harness product must boot under the harness contract
(`ECHO.md`, v0.2.0)**. `dev/echo-v0.1.2-single-agent.md` is for outside agents
working on the harness (SDK opt-in), never the CLI default.

**Fix (2 lines, operator-approved direct application — no FID):**

- `cli/src/hooks/helpers/send-message-run-config.ts` — `protocolVariant`
  `'single-agent'` → `'harness'` (interactive TUI path).
- `cli/src/headless-run.ts` — `protocolVariant` `'single-agent'` → `'harness'`
  (headless `--print` path).

**Verification:** `resolveBootContract('harness')` → `ECHO.md` v0.2.0 strict;
`resolveBootContract('single-agent')` → `dev/echo-v0.1.2-single-agent.md`
v0.1.2-single-agent (SDK opt-in preserved). CLI typecheck exit 0, common
typecheck exit 0, headless-run suite 13 pass / 0 fail, boot-contract suites 5
pass / 0 fail, ESLint clean on both edited files. The system prompt's
`{SAVANT_CODE_PROTOCOL_FILE}` placeholder is runtime-resolved from
`agentState.protocolFile` (`packages/agent-runtime/src/templates/strings.ts`),
so no agent-bundle regeneration is required.

---

## Correction Record

Per the session-summaries README (do not rewrite older summaries; record corrections in a
new summary or the relevant FID):

- `2026-08-09-1206-single-agent-init.md` is superseded by
  `2026-08-09-0.0.23-pending-housekeeping.md` and
  `2026-08-09-0.0.23-release-ready-handoff.md`. Its `Status: active` metadata is historical
  and should be treated as closed. The file is preserved unchanged.

---

## Open Items (operator actions)

1. Commit + push the 253-entry working tree (release-ready handoff checklist).
2. Clean-shell `bun run ci` (SDK + Savant-Free binaries) under pinned Bun `1.3.14`.
3. `bun run release:public:preview` dry-run, then run the release pipeline to publish `0.0.23`.
4. Session work for the remainder of the session (pending operator direction).

---

## Next Session Notes

- Verify FID status against the codebase before reporting (FID ground-truth rule).
- New session summaries: date-first filename + kebab-case description; mark superseded
  records' status corrections in the new record, never by rewriting history.
- Validation gates: typecheck × 10, `bun test` suites, `bun x eslint . --max-warnings 0`,
  `bun run lint:md`, `bunx prettier --check .`, `validate:repository`.
