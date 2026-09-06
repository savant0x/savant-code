# LEARNINGS

## Lesson: Environment-dependent guards need live probes — cwd-scoped path matching passed tests and failed production

- **Date:** 2026-08-23
- **Failure:** Relay-guard rev 1 scoped canonicalized-path matches to
  `canonicalizePath('.')` (process.cwd() at module load); the CLI's
  launch-dependent cwd made every legit absolutized write fail the check
  while all repo-root unit tests passed — a successful Recorder CREATE
  write was falsely relayed as a stall.
- **Evidence:**
  packages/agent-runtime/src/tools/handlers/tool/recorder-stall-check.ts →
  symbol:isAllowedWritePath,
  packages/agent-runtime/src/tools/handlers/tool/__tests__/recorder-stall-check.test.ts →
  test:counts an SDK-absolutized FID write (the live false-stall form)
- **Invariant:** A guard matcher must never depend on launch-environment
  state; match path-intrinsic structure, and treat green suites as silent
  about environment-dependence when the tests share the same assumption.
- **Guard:** Path-classification helpers match intrinsic segments or
  suffixes (e.g. includes('/dev/fids/')); any environment-derived anchor
  requires an injected seam or a live-probe verification step before the
  fix is called done.
- **Verification:** typecheck packages/agent-runtime exit 0; focused
  suites 21 pass / 0 fail incl. the arbitrary-NON-cwd-root case; Probe C
  first-hand normal relay under rev 2.
- **Scope:** internal
- **Owning FID:** FID-2026-0823-014
- **Status:** active
- **Canonical rule:** no-environment-dependent-guards

## Lesson: Active-ledger status admission — converged is not an active status

- **Date:** 2026-08-21
- **Failure:** The desktop master FID was authored with `**Status:** converged`
  (a value ECHO.md's status vocabulary lists as allowed), and
  `validate:repository` flagged it as a non-active ledger status — while its
  six unchecked Step Status items cascaded into hard `fid.steps.unresolved`
  failures, because the anti-deferral gate treats `converged`/`closed` as
  closure-claiming statuses.
- **Evidence:** scripts/fid-ledger.ts → symbol:ALLOWED_ACTIVE_STATUSES,
  packages/agent-runtime/src/echo/fid-validator.ts → symbol:validateFidStepStatus
- **Invariant:** Files living in `dev/fids/` may carry only
  `created | analyzed | fixed | verified`. A loop-converged planning FID stays
  `analyzed` until its phase is implemented; `converged` documents loop state,
  not an admissible active-queue status.
- **Guard:** Before setting a planning FID's status, admit only the four
  active statuses; re-run `bun run validate:repository` (or the fid-ledger
  probe) after any FID metadata edit.
- **Verification:** FID-2026-0820-007 → `analyzed`: fid-ledger probe 32 → 0;
  `validate:repository` 200 → 168 (quality-only, intentional).
- **Scope:** internal
- **Owning FID:** FID-2026-0820-007
- **Status:** active
- **Canonical rule:** active-ledger-status-admission

## Lesson: FID metadata carries no attribution fields

- **Date:** 2026-08-21
- **Failure:** Five desktop-suite FIDs carried `**Author:** Savant
  (Orchestrator)` metadata; each was flagged by the ledger's
  forbidden-attribution policy, and the current FID template has no Author
  field at all — it was replaced by `YAGNI-Compliance:` in the
  no-attribution governance sweep.
- **Evidence:** scripts/fid-ledger.ts → symbol:FORBIDDEN_ATTRIBUTION
- **Invariant:** FID documents carry no author/attribution metadata — lines
  matching `**Author:`, `**Fixed By:`, `**Verified By:`, or `**Signed By:`
  are forbidden; documents speak for themselves.
- **Guard:** Author new FIDs from the current `templates/FID-TEMPLATE.md`
  (never from older FIDs' headers); grep new FIDs for the four forbidden
  prefixes before writing. ECHO.md's stale required-Author rule is a known
  doc bug (see session summary 2026-08-21-0314).
- **Verification:** All five Author lines removed across
  FID-2026-0820-007..011; fid-ledger probe reports zero attribution findings.
- **Scope:** internal
- **Owning FID:** FID-2026-0820-007
- **Status:** active
- **Canonical rule:** no-attribution-fid-metadata

## Lesson: Files over the 100k-character tool read limit break string-replace editing

- **Date:** 2026-08-21
- **Failure:** str_replace and read_files silently fail to match content near the tail of `SCOPE.md` once it reached
  102,314 chars (the read path truncates at 100,000), reporting old-string-not-found for content that grep confirms
  exists — and six apply_patch attempts with removal-style hunks also failed to serialize.
- **Evidence:** SCOPE.md → heading:Task 7 — Quality-ratchet manual remediation (2026-08-20)
- **Invariant:** For any file near or above 100,000 chars, tail edits go through apply_patch with exact FULL-LINE
  context (partial context lines are rejected), never str_replace.
- **Guard:** Check `wc -c` before choosing the edit tool; prefer insert-only apply_patch hunks; removal hunks whose
  removed line begins with a dash repeatedly failed to serialize.
- **Verification:** The QR-HH/QR-II/QR-IJ and pause-record edits succeeded via apply_patch after str_replace failures;
  the full record is in FID-2026-0819-005 (Program Paused section); markdownlint and Prettier pass on the edited file.
- **Scope:** internal
- **Owning FID:** FID-2026-0819-005
- **Status:** active
- **Canonical rule:** large-file-edits-via-apply-patch

## Lesson: Static-string decompositions require a byte-identity hash gate

- **Date:** 2026-08-21
- **Failure:** Splitting a static template-literal payload across modules can silently corrupt whitespace or escape
  sequences, and tests may not catch it.
- **Evidence:** cli/src/commands/graph-export/universe-app-script.ts → symbol:UNIVERSE_APP_SCRIPT
- **Invariant:** Capture length + SHA-256 of the original constant BEFORE splitting; after the split,
  the concatenating facade must reproduce both exactly or the loop fails.
- **Guard:** A bun -e probe with node:crypto runs before and after the split; any mismatch aborts the loop.
- **Verification:** Loop 135 (len=7056) and Loop 136 (len=82450) probes byte-identical — the same gate applied to
  EXPORT_CSS_PART_2; recorded in FID-2026-0819-005.
- **Scope:** internal
- **Owning FID:** FID-2026-0819-005
- **Status:** active
- **Canonical rule:** string-split-byte-identity-gate

## Lesson: Brand colors must be traced to provenance, not inherited from code

- **Date:** 2026-08-16
- **Failure:** The dark theme's neutral scale was the Tailwind **slate** family
  (`surface #0f172a`, `border #1e293b`, `muted #94a3b8`, `foreground
  #e2e8f0`) — a navy-blue cast inherited from pre-fork Freebuff branding.
  Every popup, overlay, bubble, and dialog rendered navy, and the operator
  had to point out that Savant's identity is **near-black + cyan only**
  (`#050508` background, `#18faf9` primary). The earlier FID-2026-0812-002
  even *established* the slate values as "native" without questioning their
  provenance.
- **Evidence:** cli/src/utils/theme-system/palette.ts → symbol:chatThemes,
  docs/design/easter-eggs.md → heading:Easter Eggs
- **Invariant:** A color token's hex is a branding claim. The brand
  colorway must come from operator-confirmed provenance (design system,
  brand doc), never from "whatever the pre-fork code shipped with".
- **Guard:** Before touching theme tokens, ask: where did this hex come
  from — operator-stated brand, or inherited code? If the latter, confirm
  with the operator before keeping it. When the operator corrects a
  colorway, purge it from ALL mirrors (palette, design contract, fallbacks,
  export templates, logo colors) and grep-verify zero residue.
- **Verification:** grep for `#0f172a` / `#1e293b` / `#64748b` / `#94a3b8` /
  `#e2e8f0` in `cli/src` + `packages/design-systems/src` → zero matches
  (2026-08-16).
- **Scope:** internal
- **Owning FID:** FID-2026-0816-008
- **Status:** active
- **Canonical rule:** brand-color-provenance-operator-confirmed

## Lesson: Undeclared imports can ride a phantom node_modules outside the repo

- **Date:** 2026-08-16
- **Failure:** The v0.0.24 release shipped live (commit `05f829a`, tag, GitHub release, npm publish) with
  zero platform binaries because `@noble/hashes/sha512` was imported but never declared: every local gate
  passed against a phantom hoist (`C:\Users\spenc\node_modules\@noble\hashes`, outside the repo), and only
  the CI compile could see the missing dependency — `Could not resolve: "@noble/hashes/sha512"` at
  `common/src/crypto/keys.ts:2:24`, failing all 5 platform builds.
- **Evidence:** common/src/crypto/keys.ts → symbol:deriveRoleKeypair@line=48,
  common/package.json → field:version,
  scripts/validation-gates.ts → symbol:repositoryValidationGates
- **Invariant:** Every source import must resolve from the repo's own node_modules after
  `bun install --frozen-lockfile`; a resolution that only works from a node_modules outside the repo is a defect.
- **Guard:** `cli-bundle-resolution` release gate (`bun build cli/src/index.tsx --target=bun`) — the exact
  phase that failed in CI now fails the release gates before shipping, not the post-release binary workflow.
- **Verification:** The gate exits non-zero on an undeclared import; `import.meta.resolve` of every
  dependency points under the repo root, never a parent-directory node_modules.
- **Scope:** release
- **Owning FID:** FID-2026-0816-001
- **Status:** active
- **Canonical rule:** dependency-resolution-repo-bound

## Lesson: workflow_dispatch source_ref must be a branch or tag, not a SHA

- **Date:** 2026-08-16
- **Failure:** Re-dispatching `build-release-binaries.yml` with `source_ref: <commit-sha>` failed on all 5
  platform jobs at the Checkout step — actions/checkout resolved the SHA into `refs/heads/<sha>*` refspecs
  and the fetch failed (run `31927208483`). A second dispatch with `source_ref: main` (the pushed fix)
  succeeded.
- **Evidence:** .github/workflows/build-release-binaries.yml → field:source_ref,
  scripts/public-release/assets.ts → symbol:verifyReleaseAssets
- **Invariant:** The workflow's checkout `ref` input is a branch/tag name; a bare commit SHA is not
  resolvable by actions/checkout.
- **Guard:** Dispatch with a branch/tag (e.g. `main`); the pipeline's asset-verify failure message now says
  `<branch-or-tag-with-the-fix>` instead of `<fixed commit>`.
- **Verification:** Dispatch with a SHA → Checkout failure; dispatch with a branch → builds succeed.
- **Scope:** release
- **Owning FID:** FID-2026-0816-001
- **Status:** active
- **Canonical rule:** dispatch-ref-branch-or-tag

## Lesson: Perfection Loop convergence on a FID document is not FID closure

- **Date:** 2026-08-16
- **Failure:** Six planning FIDs (FID-2026-0816-002..007) for the UI overhaul
  were created, loop-converged, then marked `closed` and moved to
  `dev/fids/archive/` despite zero implementation. The Perfection Loop's
  COMPLETE state converges the *document*; the FID status vocabulary
  (`created | analyzed | fixed | verified | closed`) and the Ground-Truth
  rule describe *implementation* state. A `closed` FID with no code is a
  status claim that contradicts the codebase — and it hid the work queue
  from the operator.
- **Evidence:** ECHO.md → heading:FID Ground-Truth Verification
- **Invariant:** FID closure requires implementation evidence
  (fixed/verified ⇒ code exists and gates pass). A converged planning FID
  stays open as `analyzed` in `dev/fids/` until its phase is implemented.
- **Guard:** Before setting `closed`/archiving, ask: does the codebase
  contain the implementation this FID describes? If not, the status must
  remain `analyzed` regardless of loop convergence.
- **Verification:** The six FIDs report `analyzed` and sit in `dev/fids/`;
  CHANGELOG and archive README record the correction.
- **Scope:** internal
- **Owning FID:** FID-2026-0816-002
- **Status:** active
- **Canonical rule:** fid-closure-requires-implementation-evidence

## Lesson: The test renderer is not a proxy for the production renderer

- **Date:** 2026-08-16
- **Failure:** Phase 3 adopted native `<diff>`/`<code>`/`<line-number>`/
  `<image>` renderables after a spike verified them clean against
  `@opentui/core/testing`'s frame buffer. In the real CLI renderer they
  painted nothing: the diff viewer showed only the `Edit filename` header and
  code blocks lost their line-number gutter. The operator found the regression
  in live terminal testing after the adoption had shipped.
- **Evidence:** cli/src/components/tools/diff-viewer.tsx → symbol:DiffRow
- **Invariant:** A renderable verified only against `@opentui/core/testing`
  must be re-verified against the real CLI renderer before adoption; the test
  harness's frame buffer does not exercise the same tree-sitter/worker/
  highlighting path the production renderer uses.
- **Guard:** Any native-renderable adoption includes a production-smoke step
  (drive the real TUI to render the component) before declaring it "wins".
- **Verification:** Reverted to the custom renderers; diff/code/image render
  again in production.
- **Scope:** internal
- **Owning FID:** FID-2026-0816-006
- **Status:** active
- **Canonical rule:** test-renderer-not-proxy

## Lesson: OpenTUI Timeline defaults halt looping animations after 1 s

- **Date:** 2026-08-16
- **Failure:** `new Timeline({ autoplay: false })` inherits `loop: false` +
  `duration: 1000`, so a looping item (its own `loop: true`) is frozen the
  moment the timeline reaches 1000 ms — every continuous animation stopped
  ~1 s after starting.
- **Evidence:** cli/src/hooks/use-animation-timeline.ts → symbol:useAnimationTimeline
- **Invariant:** A looping timeline must be constructed with `loop: true` and
  an unbounded (or cycle-matching) `duration`; otherwise the timeline
  self-stops and the per-item `loop` never gets to run.
- **Guard:** `useAnimationTimeline({ loop: true, duration: Infinity })` for
  looping components; regression test pins it.
- **Verification:** cli/src/hooks/__tests__/animation-timeline-loop.test.ts
  (2 tests: default options halt at 1 s; loop+Infinity keeps playing).
- **Scope:** internal
- **Owning FID:** FID-2026-0816-005
- **Status:** active
- **Canonical rule:** timeline-loop-duration

## Lesson: Generated artifacts require source-shape validation

- **Date:** 2026-08-11
- **Failure:** A generator can silently accept the wrong source shape and emit incomplete guidance.
- **Evidence:** scripts/protocol-bundle-assertions.ts → symbol:runContentAssertions
- **Invariant:** Generated content is trustworthy only when extraction validates the source's observed structure.
- **Guard:** `bun run generate:protocol-bundle:check`
- **Verification:** Regenerate twice and compare the generated files byte-for-byte.
- **Scope:** internal
- **Owning FID:** FID-2026-0811-022
- **Status:** active
- **Canonical rule:** generated-artifact-drift

## Lesson: Structured lessons need executable evidence

- **Date:** 2026-08-11
- **Failure:** Narrative-only lessons cannot reliably become reusable guardrails.
- **Evidence:** scripts/learnings-validation.ts → symbol:validateLearnings
- **Invariant:** New lessons declare failure, evidence, invariant, guard, verification, scope, and ownership.
- **Guard:** `bun run learnings:check`
- **Verification:** Malformed fixtures fail and legacy prose remains preserved below the boundary.
- **Scope:** internal
- **Owning FID:** FID-2026-0811-024
- **Status:** active
- **Canonical rule:** learning-schema

## Lesson: Legacy clean-shell guidance is superseded by reversible preflight

- **Date:** 2026-08-11
- **Failure:** A historical clean-shell recipe required manual environment and
  settings restoration and could be followed without proving restoration.
- **Evidence:** scripts/public-release/local-state.ts →
  symbol:withLocalStateRestoration,
  scripts/public-release/local-state.ts → symbol:restoreLocalState
- **Invariant:** Release preparation uses the existing reversible preflight contract;
  historical recipes are context only.
- **Guard:** `bun run release:public:diagnose`
- **Verification:** Failure, timeout, signal, receipt, and restoration paths are
  tested without publishing or remote mutation.
- **Scope:** release
- **Owning FID:** FID-2026-0811-025, FID-2026-0811-027
- **Status:** active
- **Canonical rule:** release-preflight-restoration

## Lesson: Manual clean-shell recipe is superseded

- **Date:** 2026-08-11
- **Failure:** An earlier manual environment recipe did not prove restoration.
- **Evidence:** scripts/public-release/local-state.ts →
  symbol:withLocalStateRestoration
- **Invariant:** Historical recipes remain context and must point to the current reversible release contract.
- **Guard:** `bun run release:public:diagnose`
- **Verification:** The replacement contract is exercised by restoration and failure-path tests.
- **Scope:** release
- **Owning FID:** FID-2026-0811-025
- **Status:** superseded
- **Superseded by:** Legacy clean-shell guidance is superseded by reversible preflight
- **Canonical rule:** release-preflight-restoration

## Lesson: Harness grounding keeps protocol variants explicit

- **Date:** 2026-08-11
- **Failure:** Broad boundary wording can confuse a separate governance contract with the harness contract.
- **Evidence:** common/src/util/boot-contract.ts → symbol:resolveBootContract,
  scripts/protocol-bundle-assertions.ts → symbol:runContentAssertions
- **Invariant:** The harness selects and injects only its own contract; explicit
  variant markers remain separate and fail closed.
- **Guard:** `bun run generate:protocol-bundle:check`
- **Verification:** Local-first resolution, embedded fallback, and scoped
  injected-context checks pass without bundling the separate variant.
- **Scope:** internal
- **Owning FID:** FID-2026-0811-026
- **Status:** active
- **Canonical rule:** protocol-variant-boundary

<!-- Legacy entries below this line are preserved historical prose. -->

## Session 2026-08-10: Generated Condensed Protocol Copies (FID-2026-0810-003)

- **Generated content is only trustworthy when the generator fails fast on the source's
  real shape.** Two parsing assumptions were wrong for ECHO.md: (1) a blank line sits
  between the law-table headings and the tables — a `tableRowsAfter` scan that breaks on
  the first non-pipe line finds zero rows; skip leading blanks. (2) The circuit-breaker
  numbered list has continuation lines — a scanner that stops at the first non-`N.` line
  finds 1 of 7 rules; scan until the next heading instead. Every extractor was verified
  against the actual file with a direct probe (`bun /tmp/probe.mjs`) before the first
  clean generator run — never trust the intended shape, verify the real one.
- **Schema asymmetry across tables is the norm, not the exception.** The two ECHO.md law
  tables have different columns: Laws 1–4 have `Directive` + `Enforcement`, Laws 5–15
  have `Why` only. Key-phrase validation must match the union (title + whatever the
  directive column is called), or laws 13–15 fail validation spuriously.
- **Parity and token-budget measurement must operate on decoded runtime values, not raw
  source characters.** `\u2014` escapes count 6 source chars but render as 1; an array
  joined with `\n` has different length than its source lines. Evaluating the old
  git-HEAD array with `Function('return [' + src + ']')()` gives the true baseline
  (8,866 → 9,067 = +2.3% for instructions; 2,026 → 2,075 = +2.4% for refresh), while raw
  `wc -c` on source misleads by hundreds of bytes.
- **A re-export module is the cheapest way to swap hand-written content for generated
  output.** `agents.ts` kept its public `ECHO_PROTOCOL_INSTRUCTIONS` export and simply
  re-exports from `echo-protocol-instructions.generated.ts`; `protocol-summary.ts`
  imports `PROTOCOL_REFRESH_CONTENT`. Consumers, tests, and the injected prompt sites
  never changed — only the provenance of the string did.
- **When a rewrite of an existing script drops a helper, tests catch it, but the error
  message may not name it.** The generator rewrite lost `readFileSafe`; the failure
  surfaced as a generic "Cannot find name" at the first generation attempt. A quick
  `grep -n readFileSafe` before debugging anything else finds the regression in seconds.

## Session 2026-08-10: Universal Session-Init Grounding (FID-2026-0810-002)

**Key Learnings:**

- **A session-init promise in the system prompt is only as good as the harness
  layer that enforces it.** The prompt said "read ECHO.md 0-EOF before any
  non-read tool call — the harness blocks other tools until you do", but the
  gate fired only in STRICT mode (`enforcement.ts` tiered the gate at
  `all_15`), only when the model actually called a tool, and only when the
  files existed in the cwd. A greeting answered with pure text streamed out
  ungrounded in every non-strict mode (the modes users actually run). Text
  completion is a turn-end path that never touched the tool gate — any
  grounding guarantee must cover the text-only end-turn path too.
- **Baked-in content must be generated from the canonical source and
  drift-checked, or it rots.** Only the condensed `ECHO_PROTOCOL_INSTRUCTIONS`
  was embedded; the full protocol shipped nowhere, and the hand-maintained
  condensed copies had already drifted (stale signing instruction in
  `protocol-summary.ts`). The fix generates the full harness grounding set
  (`ECHO.md`, `ARCHITECTURE.md`, `protocol.config.yaml`, `dev/LEARNINGS.md`,
  `templates/FID-TEMPLATE.md`) into a committed bundle with a stale-file
  check wired into `validate:repository` and pre-push — same proven pattern
  as the provider-docs check. Files that "update often and must stay in
  sync" get a mechanical generator, never hand-copied mirrors.
- **Embedded fallback is a read-path feature, not a context injection.** The
  boot flow is local-first; when the local files are absent (npm install in
  an arbitrary project) the SAME `read_files` path serves the embedded
  document (synthetic read keyed on `protocolSource === 'embedded'`), so the
  grounding ritual and the enforcement gate behave identically in every
  environment. No crash (the old boot contract threw on absent files), no
  scaffolding into the user's cwd, no pre-seeded gate.
- **Never seed the gate in embedded mode.** The initial design seeded
  `protocolRead: true` for embedded sessions — that would have disabled the
  gates exactly where npm-install enforcement matters most and recreated the
  observed bug. `protocolPreSeeded` stays subagent-only; the main agent
  always grounds through the real read path.
- **A universal gate needs an arming rule so SDK embedders keep legacy
  behavior.** Making the session-init gate fire in every mode could break
  non-ECHO SDK integrations that never set a protocol variant. Arming follows
  the boot contract (`gateArmed: Boolean(agentState.protocolFile)`): the CLI
  always resolves (product sessions always gate); SDK embedders without a
  contract are unchanged.
- **A retry cap must disarm, not loop forever.** The completion gate injects
  steering for ungrounded text completions; after `COMPLETION_GATE_MAX_RETRIES
  = 3` it disarms for the whole session with a one-time notice (tool gate
  stays armed). Otherwise a model that never reads would re-trigger steering
  rounds on every subsequent user message — and the gate must run BEFORE the
  programmatic end-turn early-return or `handleSteps` main agents skip
  grounding entirely.
- **Test fixtures lie about the loop: `end_turn` as a first chunk is blocked
  by the universal gate.** Loop tests that modeled grounding with an
  `end_turn` tool call spun to the step cap because the non-read tool was
  correctly blocked pre-grounding. The real ungrounded-text scenario is a
  pure-text response (no tool calls), which ends the turn via
  `hasNoToolResults` — model that, not `end_turn`. Also: an override assigned
  to `agentRuntimeImpl` in a `beforeEach`-spread fixture never reaches the
  loop params — assign mocks to the params object directly.
- **The harness must keep its grounding contract separate from the repository's
  explicit alternate governance marker.** The separate marker and configuration
  remain valid outside harness-injected context; the harness bundle and injected
  refresh must select only the harness contract. A scoped sweep over
  harness-injected context must return zero references to the alternate protocol
  document, while repository boundary markers remain allowed.

**Files touched:** `scripts/generate-protocol-bundle.ts` (new),
`common/src/constants/protocol-bundle.generated.ts` (new, generated),
`common/src/util/boot-contract.ts`, `common/src/util/embedded-protocol.ts`
(new), `sdk/src/run-state/initial-state.ts`, `sdk/src/run/execution/session-state.ts`,
`packages/agent-runtime/src/echo/{enforcement,enforcement-state,protocol-summary}.ts`,
`packages/agent-runtime/src/run-agent-step/{loop,loop-iteration}.ts`,
`packages/agent-runtime/src/tools/tool-executor/native.ts`,
`packages/agent-runtime/src/tools/handlers/tool/read-files.ts`,
`agents/savant/system-prompt.ts`, `.githooks/pre-push`, `CHANGELOG.md`,
`dev/fids/archive/FID-2026-0810-002-universal-session-init-grounding.md`.

---

## Session 2026-08-10: Clean-Shell `ci` Contract — Canonical Env Required by Zod Schema

**Key Learnings:**

- **Historical note — superseded clean-shell recipe:** A bare empty env fails
  `build:savant-free` at the agent prebuild with zod `Invalid environment
  configuration`; this incident is retained for context. Use the reversible
  release preflight and its canonical environment contract instead of following
  this historical recipe directly.
- **The release engine and CI already do this — replicate them.** `scripts/public-release.ts`
  builds `PROFILE_ENV = { ...CANONICAL_RELEASE_RUNTIME_DEFAULTS,
  ...CANONICAL_NEXT_PUBLIC_DEFAULTS }` (line 159) and CI sets the canonical block explicitly;
  `cli/scripts/build-binary.ts` starts `binaryEnv` from `CANONICAL_NEXT_PUBLIC_DEFAULTS` (lines
  52–61) and overlays `process.env`. The proven local recipe: (1) `mv .env.local` aside,
  (2) unset dev `NEXT_PUBLIC_*`, (3) inject the 10 canonical values via `env`, (4) `bun run ci`,
  (5) restore `.env.local` (verify the restore — never infer from build output; see the
  2026-08-05 truncated-output lesson).
- **The env-integrity gate and the zod schema are two different gates.** The gate blocks dev
  VALUES (leak class); the schema blocks ABSENT values. Passing one does not satisfy the other
  — `evaluateBinaryEnvIntegrity` sees an empty env as `expected "<unset>"` leaks (block), but
  the zod failure fires earlier, in `prebuild-agents`, before the gate ever runs. A build-step
  env contract (what a script needs) is distinct from a value-integrity contract (what values
  may ship).
- **Verify a clean-env recipe against the real command before documenting it.** The 0.0.23
  release-ready handoff's "set aside + clear overrides, then `bun run ci`" guidance failed on
  the first real run; the corrected recipe (canonical injection) was proven green 2026-08-10
  (`savant-free.exe` + SDK built, `cli/bin/env.json` canonical, leak scan 0 hits, `.env.local`
  restored). Corrected in the handoff + recorded in session summary
  `2026-08-10-1144-single-agent-bootup-housekeeping.md`.

---

## Session 2026-08-09: FID Ledger Drift — Archived Files Still Listed as Active

**Key Learnings:**

- **File location is ground truth; the README table is a claim.** The `dev/fids/`
  ledger listed nine FIDs as "Current active FIDs" while the active directory
  held zero FID files — all nine had already been moved to `dev/fids/archive/`.
  Eight retained non-closed statuses (`implemented`, `fixed`, `analyzed`,
  `verified`) with unresolved review boundaries. A FID inventory must be
  verified against the filesystem (`ls dev/fids/`), never trusted from the
  README alone.
- **Archive placement ≠ closure.** Moving a FID to the archive is a physical
  action that can occur without the metadata-side closure (status → `closed`,
  CHANGELOG entry, review boundaries cleared). The ledger claimed a work queue
  that did not exist.
- **Reconcile by adding a corrective note, not by rewriting history.** The
  archive README's own invariant: add a corrective note or index entry rather
  than rewriting historical evidence. The correction went into
  `dev/fids/README.md` (zero active FIDs + operator-accepted records),
  `dev/fids/archive/README.md` (corrective index table), and a CHANGELOG
  subsection; FID files, session summaries, and audit-channel correspondence
  stayed immutable.
- **An operator decision waives drifted boundaries.** The eight archived-but-
  unclosed records were accepted as historical by explicit operator decision,
  not silently mass-closed.

**Files touched:** `dev/fids/README.md`, `dev/fids/archive/README.md`,
`CHANGELOG.md` (ledger reconciliation); no FID files rewritten.

## Session 2026-08-09: v0.0.22 Public Release (FID closures → release)

**Key Learnings:**

- **A lockfile regeneration can silently resolve a toolchain into a broken
  major.** The overnight `bun.lock` regen (FID-0809-002 work) pulled
  `eslint@10.8.1`, which crashes `typescript-eslint@7.18` at load (`Class
  extends value undefined` — `LegacyESLint` was removed in ESLint 10); the
  v0.0.20/21 lockfiles pinned `eslint@9.39.5`. `eslint` was only a
  transitive/peer dependency, so nothing constrained it. Fix: explicit root
  devDependency `"eslint": "^9.39.5"`. Lesson: peer-constrained toolchains
  need explicit pins, and every lockfile regen must re-run the real gates
  before release.
- **A gate that "passed" on a pipe is not a verified gate.** The A-Z audit
  reported ESLint clean because the command was `cmd | tail; echo $?` — `$?`
  was `tail`'s exit code, not eslint's. The eslint crash went undetected
  until the release engine ran it with a direct exit status. Verify gates
  with the real exit code (no pipe), and treat a timed-out check (the A-Z
  prettier run) as unverified — the 5-file prettier drift in the
  provider-registry work would have failed any release.
- **The release engine's resume is bound to the original gate manifest.**
  `validateResumeReceipt` rebuilds the manifest from
  `configuredReleasePackages()` and refuses a hash mismatch, so you cannot
  change `SAVANT_CODE_RELEASE_PACKAGES` mid-flight (e.g. resume CLI-only after
  an SDK failure). Scope changes require a fresh run — and a fresh run refuses
  when the GitHub release already exists. The SDK-first publish order also
  means a blocked SDK blocks the CLI publish in the engine; plan package
  ordering around known publish blockers.
- **A missing npm scope is a hard publish blocker with no CLI/API fix.** The
  `@savant-code` npm org does not exist (registry org endpoint 404 → `404
  Scope not found` on `npm publish`). Creating an npm org is website-only
  (`npmjs.com/org/create`, as the publishing user). Until the operator
  creates it, `@savant-code/sdk` cannot be published at all; releases are
  CLI-only.
- **npm username ≠ GitHub username — and a GitHub rename does not touch npm.**
  The operator renamed their GitHub account and briefly thought the npm
  identity changed too; `npm whoami` + `npm view savant-code maintainers`
  both still resolve to `fame0x` (see also the 2026-08-05 entry).
- **The definitive install-path test is a fresh-user run.** The launcher
  caches the binary user-level (`~/.config/savant/`), NOT version-keyed, and
  compares package vs registry versions — a stale 0.0.20 cache on the dev
  machine masked the real path. Simulating a clean user
  (`USERPROFILE=/tmp/clean-home`) forced the real download: 52 MB tarball
  from the v0.0.22 release → `--version` printed `0.0.22`. Existing users on
  stale binaries get the consent-gated auto-update on their next interactive
  launch by design.
- **Outcome:** `savant-code@0.0.22` published (npm `latest`), GitHub release
  v0.0.22 with all 5 binary tarballs (workflow + `verify-release-assets` job
  green), annotated tag pushed, fresh installs validated end to end. SDK
  intentionally not published this release (scope prerequisite above).

**Files touched:** package.json (eslint pin), bun.lock (regenerated, 0.0.22),
VERSION + 15 manifests, CHANGELOG.md, README.md, cli/src/utils/settings.ts,
common/src/providers/types.ts, savant-free/package.json, scripts/public-release.ts
and scripts/public-release.test.ts, dev/session-summaries/2026-08-09-1206-single-agent-init.md.

## Session 2026-08-07: Code Universe Offline Audio Closeout (FID-2026-0807-007)

**Key Learnings:**

- **Offline sound must be treated as an artifact budget, not a runtime fetch.** Embedding six verified short cues in the
  inert export registry preserved `file://` behavior, while the 49,310-byte measured growth stayed well below the 600 KiB
  FID ceiling.
- **Generated browser code and test seams need an explicit boundary.** The inline export manager is covered by
  generated-source/static assertions and live E2E; the fake-`AudioContext` manager verifies policy transitions separately.
  The FID records that distinction instead of claiming executable equivalence.
- **FID closure has three required tracking moves:** set status to `closed`, move the FID into `dev/fids/archive/`, and
  add both a changelog entry and session handoff. Skipping any one leaves stale project state.

## Session 2026-08-06: Adversarial Verification + Design Constitution (FID-2026-0805-004, FID-2026-0806-001)

**Key Learnings:**

- **Double-audit verifies twice in the same direction; adversarial verification
  goes the other way.** The ECHO Verifier refutes nothing — it checks the
  change against the FID and build gates. The new Adversary agent (read-only:
  `read_files`/`code_search`/`glob`/`list_directory`/`set_output`) refutes
  every FAIL (CONFIRMED/REFUTED/ADJUSTED), re-audits unevidenced PASSes, and
  resolves citations, with verdicts that override the Verifier's. That is the
  layer where rubber-stamped PASSes actually hide.
- **A zero-tool Verifier must not be told to "resolve" citations.** Evidence
  rules that demand disk resolution are impossible for `toolNames: []` — the
  honest contract is "verify against the code visible in the conversation;
  anything unverifiable is NEEDS-REVIEW", and actual resolution belongs to the
  Adversary (which has read tools).
- **A live roster invariant has more than four copies.** "Exactly 9 canonical
  roles" lived in `system-prompt.ts`, `ECHO.md`, `AGENTS.md`, and
  `ARCHITECTURE.md` — plus `docs/agents.md`, `docs/agents-and-tools.md`,
  `docs/echo-protocol.md`, `cli/README.md`. A roster change must sweep every
  user-facing doc, not just the four the FID cites; a release-readiness audit
  that greps only the FID's cited files misses the drift.
- **Operator scope corrections supersede an FID's phase plan.** The FreeBuff
  spec mirror (Phase 4) was dropped mid-implementation: FreeBuff is the
  upstream fork, not a final source, and `ECHO.md` is the authoritative
  harness-specific protocol. Record the correction in the FID's loop history
  and reconcile every in-FID reference to the dropped phase.
- **Backtick injection into a template-literal prompt is a typecheck-time
  landmine.** Adding `file:line` (with raw backticks) to `verifier.ts`'s
  backtick template literal broke the file at `tsc`; escaped backticks or
  plain text avoid it. Same class of bug as template-literal interpolation
  (``${``) — grep new prompt text for raw backticks before writing.
- **FSM states must be added to every parallel declaration.** `adversarial`
  required updates in `FsmPhase` + `FSM_PHASE_LIST`, the `transition_phase`
  zod enum, `agents/types/tools.ts` `TransitionPhaseParams`, AND
  `VALID_TRANSITIONS` — five places, all covered by one new test file.

## Session 2026-08-06: Release Audit (FID closures, graph export testing, repo consistency)

**Key Learnings:**

- **A "cluster count" stat that counts assignments is worse than no stat.**
  `stats.clusterCount = clusterAssignments.size` reported 1975 "clusters" for
  a 1995-file repo because every file maps to exactly one cluster id — the
  real distinct-community count was ~412. Count `DISTINCT cluster_id` in the
  DB (excluding NULLs) and assert it is strictly less than the file count in
  tests; a 4-file strongly-connected fixture resolving to exactly 2 domains
  locks the semantics in.
- **Scale-sensitive parameters need clamps and boundary tests, not just a
  formula.** The FID required Louvain resolution scaled inversely to node
  count, but the implementation dropped the parameter entirely (default 1.0
  is degenerate only when the stat lies about it). `defaultResolution` = clamp
  `2000/nodeCount` to [0.1, 1] — floor keeps giant repos from fragmenting per
  file, ceiling keeps tiny fixtures from collapsing; test all three boundary
  cases plus the zero-input guard.
- **Workspace imports must be declared, even when hoisting makes them work.**
  `cli` and `packages/agent-runtime` both imported
  `@savant-code/knowledge-graph` in source with no `package.json`
  declaration — resolved only via root-level workspace hoisting, which works
  in the monorepo but silently breaks a published package or a consumer that
  installs the workspace alone. A release audit should grep every package for
  `@savant-code/*` imports and diff against declared deps.
- **Third-party/audit-channel markdown is not exempt from the repo lint gate.**
  Nova inbox/outbox correspondence and new design docs accumulated MD013
  (line-length) / MD022 (heading spacing) / MD032 (list spacing) / MD040
  (bare fence) failures that blocked `lint:md` repo-wide. A word-boundary
  reflow at 120 cols + blank-line insertion around lists/headings + `text` on
  bare fences fixed all of it — but re-run the sweep against *tracked* files
  only to avoid churn on already-clean committed docs.
- **Two prettier binaries in one repo is a trap.** `npx prettier` resolved
  the local 3.8.1 while `bunx prettier` used 3.9.5 — the older binary
  flagged 47 files the gate (and CI hook, which uses `bunx`) accepts. Always
  validate with the same binary the pre-push hook runs (`bunx`).

## Session 2026-08-06: Knowledge Graph ECHO Integration (FID-2026-0806-002)

**Key Learnings:**

- **Platform path separators are an index-freshness bug, not a cosmetic detail.** On Windows the file-tree
  enumerator returns backslash paths (`src\a.ts`) while the resolvers and query API speak forward slashes —
  the symptom was a zero-edge index and zero-symbol queries for every subdirectory file (root-level files
  passed only because their basenames contain no separator). Normalize stored paths to one canonical form at
  the write boundary (indexer), and every consumer (queries, exports, tool params) stays consistent.
- **Check the dependency's real API era before adopting it.** `graphology-communities-louvain` 0.2.0 calls
  `pgraph.undirected(edge)`, an internal API removed in modern graphology — incompatible at runtime despite
  typechecking. The 2.x line (native `resolution` + injectable seeded RNG) both fixes the break and improves
  determinism. For any community package, verify the installed graphology major against the algorithm
  package's real published API (`npm view` versions + README), not just its declared peer range (which was
  absent).
- **Minified third-party JS must be re-escaped for TS template literals.** Cytoscape's minified dist contains
  legacy octal regex escapes (`\1`, `\2`) that TypeScript rejects inside template literals (TS1487). Escape
  backslashes *before* backticks/`${` in generators that inline third-party payloads.
- **Two-word slash commands resolve through the first-word alias.** The router parses only the first word as
  the command (`/graph refresh` → command `graph`, args `refresh`), so a two-word menu entry must map to a
  registry command whose alias is the bare first word. Keep slash-menu ids/aliases byte-identical to the
  registry — a gating test asserts the parity.
- **Heredocs in agent JSON params break on Windows/escaping.** Multi-line `<<'EOF'` payloads repeatedly
  failed JSON escaping in spawn params; writing probe files via `write_file` and running them with simple
  commands was the reliable path.

**Files touched:** packages/knowledge-graph/ (new), packages/agent-runtime/src/tools/handlers/tool/graph/ +
util/graph-injection.ts + spawn handlers, common/src/tools/ (graph params/constants/list/safety-registry),
agents/{detective,scout}/ + bundled-agents.generated.ts, cli/src/commands/{graph-export,graph-refresh}/ +
defs/core.ts + data/slash-commands.ts + constants/cytoscape.ts + scripts/generate-cytoscape.ts,
ARCHITECTURE.md, AGENTS.md, README.md, CHANGELOG.md, docs/{knowledge-graph,features,index}.md,
.gitignore, .savantignore, protocol.config.yaml, package.json, dev/fids/archive/.

## Session 2026-08-04: MCP Feature Integration Closeout (FID-2026-0804-002..006)

**Key Learnings:**

- **"Ideas, not 1:1 ports" is a licensing + architecture discipline, not just a style choice.** The four
  `resources/mcp/` reference repos (deep-research MCP, github-mcp-server, local-deep-research, mcp-toolbox) were
  sources of *ideas*: the deep_research query fan-out, the GitHub remote-HTTP MCP route, the SQL safety adapter,
  the browser-viewport contract. Each was rebuilt on Savant's own harness — no AI SDK (the harness already runs
  the model), no new dependencies, `bun:sqlite` in-tree. The license audit (MIT×3 + Apache-2.0, no GPL) is a
  hard gate before any reference-repo adoption; run it in RED, not after implementation.
- **No-second-LLM is a greppable invariant.** `grep -rn 'generateObject|from .ai.|@ai-sdk'` over new handler
  code must return zero production hits. This caught nothing this round (the one hit was a comment), but the
  grep is the cheap, mechanical proof that a "mechanical tool" stayed mechanical — put it in the master FID's
  gates so every child inherits it.
- **Safety contracts belong in the adapter, not the prompt.** The database tools' read-only default, LIMIT
  injection, redaction, and destructive-DDL block are enforced in `sqlite-adapter.ts` code paths, so a
  misbehaving model cannot bypass them by ignoring instructions. Prompt-level safety is a fallback, never the
  contract. Nova's audit specifically verified this — "adapter-enforced (not prompt-only)".
- **A read-only helper default is a product decision, not an implementation detail.** `github` ships
  read-only (review, comment, scan — never merge/approve/push) and `browser-use` keeps `--isolated` by
  default. Documenting the read-only contract in the agent's systemPrompt makes it testable and auditable.
- **Citation precision is load-bearing when a third-party auditor re-greps.** The A-Z results report
  initially cited line numbers that exceeded the target file's actual length (1118 lines) and pointed at
  unrelated content; a post-run re-grep corrected six citations (slash-command lines, free-agents line 167,
  bundled-agents line 616, `research_depth` enum). Cross-Agent Claim Rule: every line-number claim must be
  verified against the working tree before it becomes evidence — Nova will re-grep.
- **Nova signoff closes the loop but does not replace local re-verification.** Nova PASSED the audit with one
  ⚠️ ("verification gates plausible but not independently re-run" — she can't run the dev environment). The
  acknowledgment re-ran the full battery at verdict time (636/0, 523/0, 3/0, typecheck ×5, ESLint 0) and
  logged real tool output into the outbox. Always answer an auditor's ⚠️ with fresh evidence, not argument.

**Files touched:** agents/{github,database,browser-use,researcher,savant}/, common/src/tools/ (deep-research,
database params, constants, list, safety-registry), packages/agent-runtime/src/tools/handlers/tool/ (deep-research,
database/), cli/src/commands/export-conversation.ts + constants/, cli/src/utils/run-state-storage.ts, CHANGELOG.md,
ARCHITECTURE.md, ECHO.md, README.md, dev/test-prompts/, dev/nova/, dev/fids/archive/.

## Session 2026-08-03: Release-Readiness Audit (FID-2026-0803-012)

**Key Learnings:**

- **"Deleted" files that are still tracked in git are restorable, and their loss is
  silent.** The 12 eval fixture JSONs were `D` in `git status` (worktree-deleted,
  unstaged) — the benchmark runner referenced them and failed at startup, but nothing
  flagged the missing fixtures until the eval was actually run. `git ls-files` +
  `git cat-file -e HEAD:<path>` confirm restorability. Lesson: before declaring a
  surface broken, check `git status` for unstaged deletions — the fix may be
  `git restore`, not new code.
- **An eval harness that has never been run end-to-end hides real bugs.** Baseline
  (golden-patch) mode passed 3/3 before this session and looked healthy, but the
  first evaluate run exposed three genuine defects in sequence: (1) no
  `agentDefinitions` passed → empty SDK registry → `Invalid agent ID`; (2) cyclic
  provider error objects crashed `JSON.stringify` in the report writer; (3) a stale
  golden-patch pre-image failed task application. All three were invisible until a
  real (or keyed) run exercised the full path. Lesson: baseline-only validation is
  not validation of the evaluate path.
- **Environmental credential limits are a legitimate eval outcome — record them,
  don't paper over them.** The evaluate run failed 0/4 not from harness bugs (those
  were fixed and proven by tool-call traces) but from free-tier provider rate limits
  (HTTP 429) and BYOK key rejection. The report tracks baseline 4/4 PASS + evaluate
  environmental causes + the exact re-run command, so the next operator with a valid
  Savant backend key can close the gap without re-debugging.
- **CJK text breaks markdownlint MD060 "aligned" table style** — full-width
  parentheses/chars compute different display widths. The repo's own convention
  (Repo Map table) wraps wide tables in `markdownlint-disable MD060`; the zh-CN
  translation uses the same escape. Don't fight the width math by hand.

**Files touched:** evals/benchmark (fixtures restored + 2 entrypoints), evals/v2
(harness wiring + report writer + 2 regression tests), evals/v2/tasks/add-fix
(golden patch), README.zh-CN.md (full regeneration), docs/reports/ (eval run
tracking doc).

## Session 2026-08-03: Build Artifact Hygiene (FID-2026-0803-011)

**Key Learnings:**

- **Filesystem grep is not git state.** The 0803-010 follow-up note claimed
  "committed .exe binaries" because a filesystem grep found them — but grep
  does not respect `.gitignore`. "Is this tracked/committed?" claims must use
  `git ls-files` / `git check-ignore`, not `grep -r`. The RED pass of this FID
  caught and corrected the note before any code changed.
- **Validate build flags against actual outputs.** `build-binary.ts` passes
  `--sourcemap=none`, yet bun 1.3.11 emits a 21 MB `index.js.map` on every
  compile. A flag's intent is not its effect — verify the output dir after a
  real build (which is exactly how the orphan hypothesis was disproven: the
  map is regenerated, timestamped fresh, and unshipped).
- **Gitignored + regenerable = safe to purge.** Deleting ~360 MB of stale
  build artifacts was zero-risk because `git ls-files` confirmed nothing was
  tracked and the existing build commands (`build:binary`, `savant-free/cli/
  build.ts`, root `ci`) regenerate everything. Check both halves before
  deleting: nothing tracked AND a working regeneration path.
- **A follow-up note is still evidence.** The note that spawned this FID was
  written hastily after a sweep; it became the FID's RED premise and had to be
  corrected mid-flight. Notes that will feed FIDs deserve the same evidence
  rigor as FID findings — it is cheaper to verify once than to correct twice.

## Session 2026-08-03: Database + LLM-Providers LOW Fixes (FID-2026-0803-010)

**Key Learnings:**

- **"Zero consumers" evidence is only as good as the search tool you use.** The RED pass for DB-B reported
  `agent_configs` had zero consumers — the check silently used `rg`, which isn't on PATH in this repo's bash,
  so it returned nothing (exit 1) and looked clean. The table actually had one consumer: a test-teardown
  `DELETE FROM agent_configs;`. Lesson: when a "no references" claim matters, use a tool you can see (grep)
  and verify the command exists before trusting its empty output.
- **TransformStream tests must drain concurrently.** A TransformStream's readable side has a high-water mark of
  1. Writing chunks and only then reading stalls on backpressure forever — the real consumer (`pipeThrough`)
  pulls continuously. Test helpers should start the read loop before writing, or writes never resolve.
- **Line-range surgery scripts pay off.** Extracting a 385-line inline transform via a bun script with unique
  anchors (each asserted exactly-once) turned a risky edit into a deterministic one; the single failure mode
  (an orphaned closing brace) was caught by typecheck in seconds. Anchor on syntax boundaries (closing braces),
  not content lines.
- **The stream-transform simulation was real drift.** `stream-transform.test.ts` tested its own copy of the
  transform — it could not catch regressions in the most-FID'd code in the repo (0801-007/008/010/011).
  Extraction into a shared module made the tests exercise the real logic, and the backpressure bug was found
  immediately. A simulation that can't fail on real changes is worse than no test.

## Session 2026-08-03: ECHO Enforcement Layer Audit (FID-2026-0803-009)

**Key Learnings:**

- **Enforcement docs rot faster than the code they describe.** The runtime FSM gating (tool-executor.ts), SoD
  (Forge no bash, Detective no writes, Verifier zero-tool), and all 13 Orchestrator tools were verified correct —
  the only debt was `ECHO.md`'s roster table: the Researcher row predated `researcher-docs` (read_docs), the Forge
  "restricted" cell listed a bash the agent never had, and the "9 specialized agents" intro silently omitted the 4
  infra spawnables. Bootstrap docs drift when the roster changes; audits must diff the docs against the
  *definitions*, not against each other.
- **A "Restricted Tools" column that lists tools the agent never had is worse than an omission** — it teaches a
  reader the wrong model. After the fix, ECHO.md's restricted cells name only tools the agent actually has
  elsewhere or genuinely lacks by design.
- **`commands.build` can be a partial build and still be the right value** — `bun run ci` (SDK + Savant-Free) is
  the release pipeline entrypoint; the 9-workspace compile gate is `type_check`. The defect was the comment, not
  the command. Verify whether config fields are read by code before "fixing" them (grep first — this one was a
  pure doc surface).
- **markdownlint catches table column drift** (MD055/MD056) — a fast, reliable check that doc-table edits keep
  their pipe counts; used it as the runtime half of the double audit.

**Files:** ECHO.md (roster rows + footnote), protocol.config.yaml (build comment), CHANGELOG.md.

## Session 2026-08-03: Evals Benchmark Runner Audit (FID-2026-0803-007)

**Key Learnings:**

- **A "fix" that never compiled is worse than the bug it claimed to fix.** Two findings this session were
  themselves botched repairs from a prior audit (FID-0802-006): a cast that referenced a nonexistent property
  (`ReturnType<(typeof pino)['destination']>`) and a "concrete cast instead of any" that still failed tsc
  (`as unknown as { agentFeedback: unknown[] }` against a 4-field declared type). Both had DEBT comments
  claiming they were the fix. Lesson: after any type-surgery, run the package typecheck — and note that
  packages outside the 4-way CI hard gate (sdk/common/agent-runtime/cli) rot silently. The evals package had
  been failing `tsc` since v0.0.15 with nobody noticing.
- **`withTimeout` races; it does not abort.** The evals harness wrapped 20-60 minute LLM runs in
  `withTimeout` — when the timer fired, the promise rejected but the underlying `client.run` kept executing,
  burning API dollars and holding the event loop. The SDK already supports `signal?: AbortSignal`
  (run.ts:181/294/546), so the fix was `signal: AbortSignal.timeout(ms)` — abort, don't race.
- **A zod schema defined but never used is a promise of validation that isn't there.** `JudgingResultSchema`
  was exported in judge.ts while the code did `output.value as JudgingResult` — malformed model output could
  produce NaN averages or a TypeError in the formatter. The schema existed precisely for this; wire it up.
- **Expected-failure probes are not silent-swallow bugs.** `git show <sha>:<path>` failing inside a
  file-existence check is the ANSWER, not an error — logging a warn per missing file would spam. When an
  audit flags a bare `catch {`, distinguish "diagnostic swallowed" from "probe outcome" before adding noise.
- **Median-of-2 with `floor(n/2)` always picks the higher scorer** — a systematic bias in ensemble analysis
  text when judges disagree. `floor((n-1)/2)` is the true lower median.

## Session 2026-08-03: Code-Map Package Audit (FID-2026-0803-006)

**Key Learnings:**

- **Always-false guard expressions are no guard at all.** `call in {}` only caught the inherited
  `__proto__`; `toString`/`valueOf`/`hasOwnProperty` collisions crashed the code map (TypeError on
  `.includes` of an inherited function). When skipping Object.prototype keys, write
  `call in Object.prototype` explicitly — and add a regression test with a real collision token.
- **A module-level singleton that caches a rejected init promise turns a transient failure into
  permanent silent disablement.** A shared in-flight promise with clear-on-rejection plus a one-time
  warn converts it into a retryable, diagnosable condition.
- **Removing a defensive cast isn't always "drop the guard too".** `tree.delete?.()` keeps
  mock/runtime compatibility (structurally-compatible mocks lack `delete`) while dropping the Law-6
  cast. Cast surgery can accidentally delete the call itself — re-read the final block after editing.

## Session 2026-08-03: Quality Scan Hygiene Fixes (FID-2026-0803-005)

**Key Learnings:**

- **Empty catches in safety nets are silent misclassification, not best-effort.** `captureSnapshot`'s
  `catch {}` treated every read failure as "file didn't exist" — a rewind would have DELETED an existing
  file it merely failed to read (EACCES/EISDIR/EMFILE). Distinguish `ENOENT` from everything else even
  when the fallback looks safe; errno narrowing follows the `paths.ts` idiom (`'code' in err && typeof
  err.code === 'string'`).
- **Perf findings deserve a 0-EOF read before severity is assigned.** The same lines that looked like a
  hot-path sync-IO problem held the actual correctness bug: the sync choice was correct by design
  (capture-before-write ordering + per-path dedup bounds cost), while the real defect was in the
  error-handling path.
- **An unsafe `!` can hide a real undefined path.** `generator!` masked an eval'd handleSteps function
  returning undefined at runtime; an explicit definite-assignment guard is more robust than the
  assertion and produces a diagnosable error instead of a misleading generic failure.

## Session 2026-08-03: Quality Sweep + Checkpoint & Rewind (FID-2026-0803-004)

**Key Learnings:**

- **Audit before building: an unwired in-tree primitive beats greenfield.** The checkpoint feature's capture/
  restore primitive already existed as `file-snapshot-store.ts` with **zero callers** — promoting it into a
  persistent store was a fraction of the work of building fresh. Always grep for dead-but-purpose-built code
  before starting a feature.
- **Session restore ≠ rewind.** Restore resumes the same state; rewind returns the workspace (and optionally the
  conversation) to an earlier turn. Keep the distinction explicit — conflating them derails scoping.
- **Sort ties are a test flake source.** Two turns opened back-to-back share a `Date.now()` millisecond, making
  `b.sort((a, b) => b.startedAt - a.startedAt)` order-dependent and only *sometimes* failing. Always add a
  deterministic tiebreaker (e.g. `|| b.turnId.localeCompare(a.turnId)`) when the sort key has ms granularity.
- **Dedup before the expensive op on hot paths.** `captureSnapshot` must check `buffer.files.has(path)` *before*
  `fs.readFileSync`, so repeated writes to one file read it once, not N times.
- **Sanitize host-provided ids used in filenames.** The CLI's aiMessageId becomes a checkpoint filename — a
  `path.basename()` guard is one line and prevents path-like ids from escaping the checkpoint dir.
- **Checkpoint capture belongs in the write-gate, not the handlers.** Capturing in `executeToolCall` before
  `write_file`/`str_replace`/`apply_patch` dispatch covers main-agent and subagent writes uniformly (subagents
  inherit the turn via spawn context) and keeps terminal side effects untracked.
- **Gate discipline under pressure:** run `eslint --fix` and `prettier --write` *after* the last edit, then
  re-run the full suites — a late fix (like a same-ms sort flake) only surfaces in full-suite runs, not in the
  isolated file run.

## Session 2026-07-25-1200: Context Compaction System (FID-085)

**Key Learnings:**

- Context compaction MUST be a runtime service, not a spawned agent. The context-pruner agent inherits the bloated
  context it's trying to compress — a chicken-and-egg problem. A runtime service operates on the message array directly
  without needing its own LLM context.
- Four-layer progressive compaction is the correct architecture: Layer 1 (SNIPE: user-initiated), Layer 2 (MICRO:
  zero-cost tool result clearing), Layer 3 (AUTO: LLM summarization on threshold), Layer 4 (REACTIVE: emergency
  truncation on prompt-too-long).
- Token limits must be wired through the full stack. The UI resolved the correct context window but the runtime never
  received it — 4 disconnected paths all using different hardcoded values (128k, 200k, 250k, 400k). The resolved value
  from OpenRouter must flow: CLI → createRunConfig → SDK → loopAgentSteps → ContextCompactor → handleSteps.
- Allowlist → denylist is almost always the right architectural choice. The `run_readonly_command` allowlist broke on
  valid Windows commands (findstr, 2>nul). A denylist blocks known-dangerous commands while allowing all others — more
  maintainable and doesn't break on new/OS-specific commands.
- Template literals with backticks are dangerous in TypeScript. Rewrote `ECHO_PROTOCOL_INSTRUCTIONS` as array-join to
  avoid template literal escaping issues. This pattern should be used whenever a large string constant contains
  backticks.
- Error messages must include agent context. The "not currently available" error was impossible to debug without knowing
  which agent hit it. Adding `[agent: ${agentTemplate.id}]` prefix made failures traceable.
- Reference repos are invaluable for design patterns. hermes-agent (trajectory_compressor.py), openclaw
  (context-engine), and openclaude (autoCompact/compact/microCompact) provided proven patterns for progressive
  compaction.

**Agent Behavior / Process:**

- Scope expands when you investigate. Starting from "context fills with no compaction" led to discovering 12 bugs across
  10 files — never pass over an issue during testing.
- The Verifier correctly identified 8 issues in the initial design that the Orchestrator overlooked (hostile-attacker
  safeguards, rollback safety, fallback UX). Independent review is essential.
- Design reviews must include security analysis from the start. The Verifier caught the missing hostile-attacker
  safeguard (Q3) that the initial design overlooked.

**Technical Insights:**

- `ContextCompactor` class provides: microCompact (zero cost), shouldAutoCompact (threshold + circuit breaker),
  reactiveCompact (emergency truncation), static isPromptTooLongError (error detection).
- Circuit breaker states: healthy → degraded → open → half-open → healthy. Max 3 failures → 5min cooldown.
- Micro-compact safety: only clear tool results where the paired tool_use has been processed (tool_result exists).
  Prevents orphaned references.
- Reactive compact algorithm: preserve first message + last 20% of messages, discard everything else, retry API call once.
- `maxContextLength` added to `AgentState` type to wire resolved context window from CLI through to handleSteps in savant.ts.

## Session 2026-07-25-1600: Layer 4 Reactive Compact + FID-085 Closure

**Key Learnings:**

- Layer 4 reactive compact catches prompt-too-long errors, aggressively truncates (keep first + last 20%), and retries
  once. This is the last-resort safety net.
- `isPromptTooLongError` must match patterns from multiple providers (Anthropic, OpenRouter, etc.) — "prompt is too
  long", "context_length_exceeded", "maximum context length", "token limit", "too many tokens", "input too long",
  "request too large".
- Type casting syntax errors (`as unknown typeof` vs `as unknown as typeof`) are easy to introduce and hard to spot.
  Always verify with typecheck after edits.
- FID archival requires: (1) status → closed, (2) file moved to dev/fids/archive/, (3) CHANGELOG entry appended. Missing
  any step creates orphaned files.

**Agent Behavior / Process:**

- FID-085 took 4 hours to complete across multiple sessions. Breaking complex FIDs into phases (Layer 2, Layer 3, Layer
  4) made the work manageable.
- The Recorder agent failed to write FID files (3 attempts) — possible context window or tool availability issue. The
  Orchestrator wrote FID files directly, which is a Separation of Duties violation but was necessary to make progress.

**Technical Insights:**

- `ContextCompactor.reactiveCompact()` preserves: first message (system/instructions), last 20% of messages (minimum 2),
  any messages with images (multimodal context).
- `ContextCompactor.isPromptTooLongError()` is a static method — can be called without instantiation.
- The catch block in `loopAgentSteps` intercepts prompt-too-long errors before the standard error handling, giving
  reactive compact a chance to recover.

## Session 2026-07-25-1700: Dev Folder Audit + FID Hygiene

**Key Learnings:**

- Dev folder audit found 32 issues: 1 critical (duplicate FID-085), 17 medium (stale FIDs, naming, docs), 6 low.
- FID archive hygiene is poor — many FIDs were archived without reaching "closed" status. 17 FIDs had statuses like
  "created", "analyzed", "fixed", "deferred" despite being in the archive directory.
- FID naming convention (FID-YYYY-MMDD-NNN-kebab-case) was not consistently followed — 4 FIDs had no date prefix.
- LEARNINGS.md was missing entries for recent sessions — should be updated as part of session closeout.
- Duplicate files in dev/fids/ and dev/fids/archive/ create confusion — FID-085 existed in both directories.

**Agent Behavior / Process:**

- Dev folder audits should be run periodically to maintain hygiene.
- When archiving FIDs, always: (1) set status to "closed", (2) move to archive, (3) append CHANGELOG entry.
- Bulk operations (sed for status updates, mv for renames) are efficient for fixing multiple files at once.

**Technical Insights:**

- `sed -i 's/^\*\*Status:\*\* .*/\*\*Status:\*\* closed/'` is the correct pattern for bulk-updating FID status in
  archived files.
- FID filename format: `FID-YYYY-MMDD-NNN-kebab-case-title.md` — must include date prefix.
- Non-FID files (_sanity_*.txt) should not be in dev/fids/archive/.

## Session 2026-07-25-2000: FID Ground-Truth Verification (FID-086)

**Key Learnings:**

- FID status metadata can drift from reality. When the Orchestrator reviewed open FIDs, it trusted FID-082's `Status:
  analyzed` metadata without verifying against the codebase — the code was fully implemented but the FID was never
  updated. Always verify FID claims against actual code before reporting status.
- Law 1 (Read 0-EOF Before Touch) applies to status reporting, not just code edits. Reading the FID markdown without
  reading the codebase is a Law 1 violation.
- The Cross-Agent Claim Rule covers inter-agent attribution, but FID-vs-codebase verification is a different dimension.
  FID status drift is a document-reality gap, not an agent-claim gap.
- FID close-out is part of implementation. When code is written, the FID status MUST be updated in the same session.
  Leaving FIDs in `analyzed` after implementation creates false negatives for future status reviews.
- The FID template now requires a "Code Verification Evidence" section and a "Missed Questions" section. These
  structural additions prevent the two root causes: unchecked metadata and incomplete analysis.

**Agent Behavior / Process:**

- The "run the perfection loop" trigger requires the Thinker to ask "What questions should I have asked when this FID
  was created, but failed to?" for EVERY open FID. This caught 12 missed questions across 3 FIDs.
- FIDs should note dependencies on other FIDs. FID-082's commands are non-functional without FID-083's runtime
  integration — this dependency was never documented.
- Process fixes (ECHO.md, FID template, LEARNINGS.md) are as important as code fixes. The ground-truth verification gap
  would recur indefinitely without a process rule.

---

## Session 2026-08-04: Harness ECHO Compliance Layer + Diff-Viewer Highlighting (FID-2026-0804-009 + 010)

**Key Learnings:**

- **Soft triggers are not enforcement.** The Verifier-criteria and Hybrid-vs-Full-loop rules lived only in
  `savant.ts` prompt text, so the model — optimized toward the frictionless default — never escalated. The fix
  (FID-009) made Law 1 (read-before-write), Law 3 (verify-after-write), and the Verifier criteria deterministic in
  the harness (`EchoComplianceTracker`): recorded from the tool-executor hot path, evaluated at the step boundary,
  non-blocking `compliance_warning` receipts + corrective steering pushed into message history. Prompt text for the
  model, deterministic tracker for the harness — future rules should follow the same split.
- **Harness layers must be reconciled with the prompt constants they supersede.** After FID-009 warned at 10 lines,
  the prompt's 75-line Full-ECHO-Loop bar was a 7.5× contradiction. FID-010 lowered the ceremony threshold to 20
  lines and kept the two layers bracketed (harness warns at 10, model escalates at 20). Whenever a deterministic
  enforcement layer lands, re-grep the prompt constants it renders stale.
- **Terminals have no alpha.** "50% opacity" for diff line tinting is a 50/50 linear RGB blend of the neon color
  against the theme background (`blendHex`) — deterministic and unit-testable. Renderers claiming per-line styling
  must own the full row: OpenTUI `<text>` has no background option, so each diff row is a box-wrapped text (boxes
  own `backgroundColor`).
- **A code-block renderer that advertises `filetype` support should style every filetype it advertises.** The diff
  renderer regressed because syntax-theme token scopes covered code but never `diff` grammar — zero `diff.added`/
  `diff.removed` styles existed. The line-by-line renderer (FID-010) sidesteps the highlighter entirely for diffs.

---

## Session 2026-08-05: Mode Execution-Scope Relabel + STRICT Mode + Hover Descriptions (FID-2026-0805-001)

**Key Learnings:**

- **Labels are contracts — a mode name should describe what the harness + prompt actually deliver.** The `EDIT` label
  asserted a strict-ECHO-loop contract while the prompt it selected ran Hybrid Mode by default — the same
  documented-intent vs. implemented-behavior gap FID-009 closed at the enforcement layer, here closed at the naming
  layer. After the rename, a ceremony mode (STRICT) is an explicit opt-in rather than a threshold the model may or may
  not escalate past. Re-grep prompt constants whenever a label and a behavior drift apart.
- **A data-driven mode axis makes a rename nearly free.** `AGENT_MODES` cascades to the toggle, `/mode` commands, the
  keyboard cycle, and settings validation — the rename needed only two deliberate touch points (the settings migration
  and the new `savant-strict` prompt variant) plus the alias preservation (`mode:edit` → `mode:hybrid`).
- **A stateful mode (STRICT) needs its own prompt contract, not the default's boilerplate.** The strict variant
  initially inherited the "Hybrid Mode (Default)" section — misleading for a mode whose whole point is no hybrid
  fallback. The ECHO-Phase-Gating section was made mode-aware so STRICT replaces it with the mandatory-loop contract.
- **"OpenTUI has no tooltip" is not "tooltips are impossible."** The pinned 0.2.2 bundle has zero tooltip/hovertip
  matches, but every primitive for the standard floating-tip pattern is present (`position: 'absolute'` via the
  status-bar precedent, `zIndex`, `MouseEvent.x/y`). A ~15-line non-interactive component covers it. Verify the
  claimed primitives against the installed bundle (not upstream docs) before the FID commits to a design.
- **Headless frame-buffer verification of TUI UI is possible — with two non-obvious harness quirks.**
  `@opentui/core/testing`'s `createTestRenderer` + `MockMouse` assert against the real rendered cells. Quirk 1:
  `footerHeight` defaults to 12, so a `height: 12` renderer has a zero-row content area (empty frame) — set
  `footerHeight: 0`. Quirk 2: the paint is async — one `renderOnce()` loop does not land the frame; loop, wait
  (~50 ms), loop, wait again. Both were found empirically, not in the .d.ts.

---

## Session 2026-08-05: 0.0.19 Binary Rebuild — NEXT_PUBLIC Leak (release gate)

**Key Learnings:**

- **Local dev env bleeds into release binaries unless the build shell is clean.** `build-binary.ts` deliberately merges
  any `NEXT_PUBLIC_*` from `process.env` over its canonical prod defaults in the sibling `env.json`. A local rebuild
  therefore ships dev values (`localhost:3000`, a personal support email, placeholder keys) into what looks like a
  release artifact. The leak has two sources that both must be neutralized: (1) the surrounding shell/runtime can
  inject `NEXT_PUBLIC_*` (verified: a bare shell in `/tmp` had all 10), and (2) Bun auto-loads the repo-root
  `.env.local`. Fix used: `unset NEXT_PUBLIC_*` + move `.env.local` aside for the build (gitignored + untracked,
  so safe), restore after, then diff `env.json` against the canonical defaults. Release builds should run from a
  clean env — add an env.json canonical-value check to the release gate.
- **Grep the binary for feature markers as the packaged-artifact smoke.** `grep -c 'savant-strict' savant-code.exe`
  proves the new agent definition is actually embedded (3 hits), alongside `STRICT mode` (5) and the bare `/mode`
  menu description (1) — cheaper than a full interactive session and catches stale-build regressions.

---

## Session 2026-08-05: Release-Binary Env-Integrity Gate + E2E Proof (FID-2026-0805-002)

**Key Learnings:**

- **A build gate that writes a sibling env.json must block, not warn, on dev-value leaks.** `build-binary.ts` merges
  every `NEXT_PUBLIC_*` from `process.env` over canonical prod defaults, so a dirty shell or repo `.env.local`
  silently ships `localhost:3000` + personal emails in what looks like a release artifact. The fix is a pure,
  exported decision function (`evaluateBinaryEnvIntegrity`: block / accepted-with-warning / clean) called from
  `main()` under an `import.meta.main` guard — gate logic is unit-testable (11 tests) without ever running a
  multi-minute compile. Escape hatches are explicit env flags (`SAVANT_CODE_BUILD_ENV` for dev binaries,
  `SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1` for CI with real prod keys), and accepted overrides always print a
  labeled warning (`(dev build)` vs `(explicit override)`) so the escape is never silent.
- **Prove gate behavior against the real build, not just the pure function.** Two e2e runs sealed the wiring:
  (1) a release build from a dirty shell aborted exit 1 with all 7 leaked keys listed (the personal support email
  included) and left the shipped binary + env.json byte-identical — the gate fires before any artifact is written;
  (2) `SAVANT_CODE_BUILD_ENV=dev` completed the build with the `⚠️ 8 override(s) accepted (dev build)` warning and
  the dev binary booted (`Using environment: dev`). One discipline difference: the abort test needs no backup, but
  the success-path test OVERWRITES the artifacts — back up `cli/bin/{savant-code.exe,env.json,tree-sitter.wasm}`
  first, restore byte-identical after, then `diff` to prove it.
- **Deterministic side effects make a failed build safe to run.** The abort test still executed `prebuild-agents`
  + the SDK build before the gate; both regenerate identically, so the tree stayed clean (verified via `git status`
  + byte-diff against the backup).

---

## Session 2026-08-05: v0.0.20 Release Publish (version-collision + credentials)

**Key Learnings:**

- **`dist-tags.latest` is not the full registry story — always diff the version list before publishing.**
  npmjs.com showed `0.0.18` as latest (correct), but the registry already held a stale `0.0.19` published
  *before* the 0.0.18 hotfix — and npm refuses to republish an existing version string. A stale/broken publish
  (launcher pointing at a GitHub release that never existed) silently burned the next version number. The fix:
  check `npm view <pkg> versions --json` AND the raw `https://registry.npmjs.org/<pkg>` metadata (dist-tags +
  per-version publish times) before any publish. Then bump (`0.0.19` → `0.0.20`) rather than unpublish.
- **npm username ≠ GitHub username is normal, not a credential mismatch.** `savant0x` is the GitHub login;
  the `savant-code` npm maintainer is `fame0x <spencerhowell84@gmail.com>` (same person). Verify a publish
  token by `npm whoami` AND `npm view <pkg> maintainers` — the token resolving to a different username than
  GitHub is expected; the token resolving to someone NOT in `maintainers` is the real problem.
- **Treat build-shell env hygiene as two independently-verifiable steps.** The clean-shell binary build worked
  (exit 0, canonical env.json), but the command's `mv` restore never ran after a truncated output — `.env.local`
  was missing afterward. Unset/move-aside must be paired with an explicit restore-verify command; never infer
  the restore happened from the build's own tail output.
- **Windows native curl cannot read Git-bash `/tmp/` paths.** The GitHub release-body JSON was written to
  `/tmp/` and `curl -d @/tmp/...` failed to open the file. Write payload files into the repo working tree
  (`-d @./file.json`) and delete them after — same pattern as any cross-tool artifact handoff on Windows.
- **Releases are a chain, verify each link before the next.** Commit → push (pre-push hook green ×2) → tag →
  release create → workflow `in_progress` → npm publish (`latest` = 0.0.20). Confirming `git ls-remote` for
  main + tag, the release API response, and `npm view` after each step caught nothing, but the discipline
  cost seconds and keeps a 5-surface release honest.

---

## Lesson: A retry that re-emits the same oversized tool call is not recovery

- **Date:** 2026-08-16
- **Failure:** A Forge subagent run died with `Native tool-call recovery
  failed twice consecutively` while implementing FID-2026-0816-011. A
  flash-class model truncated a large `write_file` native call mid-JSON; the
  runtime retried with only "retry with a complete arguments object"; the
  model re-emitted the same giant payload and truncated again; the 2-strike
  cap killed the run with a guidance-free stack trace. The same truncation
  class had already appeared dozens of times as recovered one-off tool-call
  errors — the difference was payload size, not model.
- **Evidence:** `FID-2026-0816-012` (closed, archived);
  `packages/agent-runtime/src/tools/stream-parser.ts:370-413` (steering +
  drift warn), `run-agent-step/constants.ts:1-26` (3-strike cap + guidance),
  `loop-iteration.ts:315-320` (exhausted builder).
- **Invariant:** When a native tool call fails because its arguments are
  truncated, the recovery prompt must change the strategy (split large
  payloads into smaller calls), the strike cap must be large enough for that
  guidance to land, and the exhausted failure must name the tool and give the
  parent a re-spawn path. Re-issuing the same oversized arguments object is
  re-rolling the same die.
- **Guard:** Before raising the strike count for a truncated native tool
  call, ask: is the model being told HOW to avoid the truncation, and will
  the parent get an actionable failure if recovery exhausts?
- **Verification:** typecheck ×4, agent-runtime 973/0, SDK 477/0, eslint 0,
  lint:md 0, prettier clean; 3-strike/steering/drift tests in
  `loop-agent-steps-part-f.test.ts`.
- **Scope:** agent-runtime recovery
- **Owning FID:** FID-2026-0816-012
- **Status:** active
- **Canonical rule:** recovery-steers-not-just-retries

## Lesson: Autonomy is a driver problem, not a governance problem

- **Date:** 2026-08-18
- **Failure:** The Auto Drive blueprint (Every Code-inspired autonomous
  execution) framed the work as building new governance: a new FSM layer, a
  new agent role, and a "Decomposition Engine" on top of the harness. A
  ground-truth pass against the repo showed the opposite: the full ceremony
  already exists as STRICT mode (`agents/savant/savant-strict.ts`,
  `agents/savant/system-prompt.ts:35` — "No direct writes, no phase
  skipping, no self-verification"), the continuation driver already exists
  (`run-agent-step/goal-driver.ts`, FID-2026-0814-002), and the anti-deferral
  gate (FID-2026-0817-005) already turned FID Step Status sections into
  machine-readable progress records. The genuinely new code is a thin
  supervisor: queue selection, phase-completion validation from the FID
  file, legal `transition_phase` invocation, and a failure ladder. An
  estimate that assumed "new governance" triples the real work.
- **Evidence:** `agents/savant/savant-strict.ts` (STRICT agent),
  `packages/agent-runtime/src/run-agent-step/goal-driver.ts` (driver),
  `packages/agent-runtime/src/echo/fid-validator.ts` (step-status parsers),
  `scripts/fid-ledger.ts:18-23` (active status set), program FIDs
  `FID-2026-0818-001..007` (drafted 2026-08-18).
- **Invariant:** Before designing new enforcement machinery for an
  autonomy feature, inventory what the harness already enforces mechanically
  (EHEL gates, FSM transitions, FID ledger, step-status validator) and what
  it already drives (goal driver, STRICT ceremony). The ceremony exists;
  autonomy is the driver between it and the operator's one-time approval.
- **Guard:** When a feature request says "autonomous X", ask: which existing
  enforcement point becomes the progress signal, and which existing agent
  contract becomes the execution unit? If neither is answerable, the design
  is not grounded in the repo yet.
- **Verification:** `bun run validate:repository` PASS with the seven
  program FIDs active; markdownlint PASS; every FID's AUDIT section cites
  file:line evidence verified against the working tree.
- **Scope:** planning/architecture
- **Owning FID:** FID-2026-0818-001
- **Status:** active
- **Canonical rule:** autonomy-is-a-driver-problem

## Lesson: Local commits ≠ publishes — granular history beats the monolithic release commit

- **Date:** 2026-08-27
- **Failure:** The "release-only-commits" convention (one giant release commit
  per version) accumulated 644 changed paths over a multi-day build and left
  the tree uncommitted for a week — destroying per-FID audit trails and
  risking catastrophic WIP loss on a single disk. Post-hoc LLM review of a
  100+ file diff degrades from signal dilution, not raw size.
- **Evidence:** `docs/design/Solo Git Workflow Optimization.md` (research),
  `dev/nova/outbox/2026-08-23-git-workflow-echo-amendment-draft.md` (G1–G9),
  `ECHO.md` → "Version-Control Workflow Laws (G1–G9)".
- **Invariant:** Local commits are safety + audit checkpoints, not publishes.
  Commit atomically at FID/area boundaries; push granularly at release time
  (G6) so public history stays bisectable; back up between releases via git
  bundles (G5).
- **Guard:** No monolithic release commit; no `git add .` while sessions are
  active (G4); every commit message references its FID (G8); the operator
  (never the agent) executes git (G1).
- **Verification:** ECHO.md G-rules section adopted 2026-08-27; tree drained
  into path-scoped atomic commits; `git log --grep="FID-"` aggregatable.
- **Scope:** process/workflow
- **Owning FID:** (build-order BO-2026-08-23-git-workflow-enforcement)
- **Status:** active
- **Canonical rule:** local-commits-are-not-publishes

---

## Lesson: Assume-unchanged files are phantom source invisible to every local gate

- **Date:** 2026-09-06
- **Failure:** Three tracked files sat in assume-unchanged state from the
  OpenCode Zen integration, silently excluding 21 lines of source
  (`PROVIDER_PROTOCOL_MAPS` re-exports, `TOKENROUTER` names, the GLM 5.3
  Free catalog entry) from every commit. Local typecheck, tests, and all
  20+ release gates passed against worktree content; any clean checkout
  failed to compile — first surfaced by CI (desktop-ci failed twice,
  3 platforms each, `No matching export ... PROVIDER_PROTOCOL_MAPS`) and
  the v0.0.29 release binary workflow, hours after the npm publish.
- **Evidence:** commit `4d85b6b` (the fix; its message documents the
  incident and the three files); GH run 34009246538 (desktop-ci, all 3
  platforms, the export error); v0.0.29 receipt
  (`savant-public-release-0.0.29.json`, all gates exit 0 on the
  worktree-shaped tree).
- **Invariant:** A gate that runs against the working tree verifies the
  worktree, not the commit. Published artifacts derive from committed
  content; anything that makes the index diverge from the worktree
  (assume-unchanged, skip-worktree, smudge filters) makes every local
  gate a lie about what ships.
- **Guard:** (proposed, not yet implemented — SCOPE.md Task 16
  [OPEN-OUT-OF-SCOPE]) pipeline PREFLIGHT fails closed on
  `git ls-files -v` lowercase flags; clean-checkout build gate;
  tag/asset/commit binding assert at POST_RELEASE_VERIFY.
- **Verification:** `git ls-files -v | grep '^[a-z]'` → empty on the
  current tree; the 21 lines are committed at `4d85b6b`.
- **Scope:** release/provenance
- **Owning FID:** proposed FID-2026-0906-003 (not yet authored — see
  SCOPE.md Task 16 OPEN-OUT-OF-SCOPE; operator decides)
- **Status:** active
- **Canonical rule:** assume-unchanged-phantom-source

- **What happened:** Six consecutive scratch dispatches of
  `desktop-release.yml` peeled one failure layer per run: corrupted
  signing secret (fixed by *recovery* — the original keypair was on disk,
  gitignored and never committed, and paired with the committed updater
  pubkey) → missing Linux system deps → missing compile-time icon.png →
  linuxdeploy without FUSE → linuxdeploy strip crash → the real root
  cause: the GTK plugin's second linuxdeploy pass core-dumps on `ldd`
  against the patchelf-rewritten static bun single-file sidecar
  (oven-sh/bun#28281; tauri-apps/tauri#14796, fix pending #12491) — and a
  bundling that survived would have shipped the corrupted sidecar anyway.
- **Evidence:** runs 34042941045 / 34044435124 / 34045779966 /
  34047404386 / 34048699120 / 34050762638 (the last all-green);
  FID-2026-0906-001 live-cut table; run-6 verbose log exposing the
  swallowed stderr (`Failed to run ldd: exited with code 1`, exit 134).
- **Invariant:** An unproven platform leg fails one layer at a time, and
  each layer's failure message names the *next* layer, not the root
  cause — only `--verbose` (or equivalent) stderr exposure reveals it.
  A build step that *transforms* an opaque vendor binary (patchelf on a
  static bun exe) can corrupt it silently: bundling success is not
  artifact integrity.
- **Guard:** RED-first workflow pins for every fix
  (`public-release-desktop-workflow.test.ts`); fail-closed generator key
  set as the single platform-contract authority; prefer RECOVERY of an
  existing key over regeneration whenever the pubkey is already in the
  field.
- **Scope:** desktop/release
- **Owning FID:** FID-2026-0906-001 (closed; Linux auto-update deferred
  to tauri#12491)
- **Status:** active
- **Canonical rule:** unproven-leg-layered-failures

<!-- Add new entries above this line -->
