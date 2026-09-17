# LEARNINGS

<!-- Add new entries above this line -->

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

## Lesson: Active-ledger status admission — admissible active-queue statuses

- **Date:** 2026-08-21
- **Failure:** The desktop master FID was authored with `**Status:** converged`
  (a value ECHO.md's status vocabulary lists as allowed), and
  `validate:repository` flagged it as a non-active ledger status — while its
  six unchecked Step Status items cascaded into hard `fid.steps.unresolved`
  failures, because the anti-deferral gate treats `converged`/`closed` as
  closure-claiming statuses.
- **Evidence:** scripts/fid-ledger.ts → symbol:ALLOWED_ACTIVE_STATUSES,
  packages/agent-runtime/src/echo/fid-validator.ts → symbol:validateFidStepStatus
- **Invariant:** Files living in `dev/fids/` may carry
  `created | analyzed | converged | fixed | verified` (FID-2026-0915-004:
  the 2026-09-15 operator vocabulary ruling supersedes this lesson's
  original FID-2026-0820-007 admission rule — `converged` IS an admissible
  active-queue status meaning "the Perfection Loop completed, awaiting
  implementation approval", and `fixed` is deprecated-but-accepted legacy
  language). The anti-deferral step gate is UNCHANGED (converged = planning
  done, not work done — unchecked steps still fail), and the receipt
  contract stays keyed to `fixed | verified`. Pin:
  `scripts/__tests__/fid-ledger-vocab.test.ts`.
- **Guard:** Before setting a planning FID's status, admit only the
  admissible active statuses; re-run `bun run validate:repository` (or the
  fid-ledger probe) after any FID metadata edit.
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
- **Evidence:** dev/fids/archive/FID-2026-0819-005-quality-ratchet-file-remediation.md → heading:Current Evidence
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

<!-- Narrative sessions 2026-07-25..2026-08-10 were retired to
  dev/LEARNINGS-RETIRED.md verbatim (FID-2026-0916-007, move-only). -->

<!-- The lessons below are pre-schema narrative entries
  (Context/Invariant/Guard), preserved verbatim and NOT validated; new entries
  must be added above the marker in governed space. -->

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

## Lesson: A test whose runtime approaches the harness timeout is flaky by construction

- **Context:** `post-terminal-breaker-integration.test.ts` ran 30 full
  agent-loop iterations to prove the Auto Drive carve-out; measured
  3.8–6.5s across loads against Bun's default 5s per-test timeout, and
  died at exactly 5004.91ms under full-suite load — blocking one pre-push
  gate and one release-gate run while the test passed in isolation every
  time it was retried.
- **Invariant:** Timeout flakes are *time-budget races*, not logic bugs —
  the signature is death at exactly the timeout value plus high variance
  across machine load. A loop-exhaustion test's iteration count is a
  time budget: set it to the smallest value that still distinguishes the
  property (here `LIMIT + 2`), never a large round number, and add an
  explicit per-test timeout belt when the harness default is the cliff.
- **Guard:** Backstop reduced 30 → 8 (> breaker `LIMIT` 6, so a falsely
  firing breaker still flips both assertions: `llmCallCount` 6 ≠ 8 and
  the terminator chunk appears) + explicit `{ timeout: 60_000 }` per repo
  precedent (`gateway-server-command.test.ts:126`). Sibling survey: every
  other large-backstop test terminates early (<600ms) — only
  exhaustion-style tests need this scrutiny.
- **Scope:** agent-runtime/testing
- **Owning FID:** none (maintenance fix; 2-recurrence pattern, tracked
  via experience capture — a third strike promotes it to a FID)
- **Status:** active
- **Canonical rule:** test-timeout-budget-race

## Lesson: Generated download URLs must target the asset store, not the encoder's inverse

- **Context:** The updater manifest generator percent-encoded artifact
  names (`Savant%20Code_…`) while GitHub stores release assets with
  spaces normalized to dots and serves no alias — probing the manifest's
  own URL right after uploading v0.0.29 returned HTTP 404, meaning every
  Windows client's first auto-update would have failed.
- **Invariant:** A URL emitted from `encodeURIComponent` (or any encoder)
  describes a *theory* of the target system; only the stored form on the
  receiving system is real. Pin generated URLs against the external
  system's stored representation — and beware tautological tests, where
  the assertion mirrors the implementation instead of the world.
- **Guard:** `storedAssetName()` in `desktop/scripts/generate-latest-json.ts`
  maps spaces to dots with two pins (encoded form rejected, real v0.0.29
  name pinned); the fix was verified live by fetching the artifact
  through the manifest URL and sha256-matching the original bytes.
- **Scope:** desktop/release, release-tooling
- **Owning FID:** FID-2026-0906-004
- **Status:** active
- **Canonical rule:** generated-urls-match-asset-store

## Lesson: A stage that shells out to a CLI inherits that CLI's layout

- **Context:** The pipeline's `DESKTOP_RELEASE` stage pointed the
  fail-closed manifest generator at the `gh run download` root, but the
  CLI creates one subdirectory per artifact name — proven live on the
  v0.0.29 attach; the next real cut would have failed closed with
  "missing artifact" for every platform, on a stage that had never run.
- **Invariant:** When a helper's real output shape is load-bearing,
  stubbing the helper at its function boundary hides the shape; pin the
  real layout as a test fixture. The first live exercise of an unproven
  stage is a layout audit, not a formality.
- **Guard:** `flattenDownloadedArtifacts()` in
  `scripts/public-release/desktop-stages.ts` hoists bundle + `.sig`
  files flat (excluding the CI `latest.json`, which is never trusted —
  the local regeneration exit is the fail-closed assertion) with a
  fixture pin encoding the real `gh` layout.
- **Scope:** release-pipeline
- **Owning FID:** FID-2026-0906-004
- **Status:** active
- **Canonical rule:** cli-output-layout-is-contract

## Lesson: A bootstrap that covers one context imports the failure into all others

- **Context:** FID-2026-0906-007: `env.ts` self-bootstrapped the release
  env.json leg but not `.env.local`; the CLI compensated in its own
  pre-init, so CLI-routed processes worked while the pre-push smoke,
  spawned sidecars, and any sub-package entrypoint threw at import — and
  three pushes needed a hand-rolled env prefix before the class was
  named.
- **Invariant:** A convergence-point module must bootstrap every context
  it can be imported from, or each uncompensated consumer re-imports the
  failure. Compiled artifacts add a second rule: their `import.meta.dir`
  is virtual (cwd fallback required) and a bootstrap fix is only live
  after the artifact is rebuilt.
- **Guard:** `common/src/env-bootstrap.ts` (findUp + existing-env-wins)
  wired into `env.ts` (binary-env XOR two-pass findUp); the spawned-import
  class pin in `env-bootstrap.test.ts` is the regression guard;
  desktop's suite now rides the root test chain so the class can never
  silently leave every standard gate again.
- **Scope:** env, bootstrapping, spawned processes
- **Owning FID:** FID-2026-0906-007
- **Status:** active
- **Canonical rule:** bootstrap-covers-every-import-context

## Lesson: One dynamic-import seam is only as durable as its pin

- **Context:** FID-2026-0906-005 (T17-A): the shell statically imported
  the whole three/R3F graph (~190 kB gz) through a single edge. Converting
  it to a `React.lazy` boundary put the 3D graph in its own chunk
  (540→shell, 1,208 kB lazy) — but nothing structural stops a future
  "cleanup" from re-adding a static import and silently collapsing the
  split back into the eager chunk.
- **Invariant:** A bundler split survives only while its import edges
  stay dynamic; any new static edge to the lazy subtree undoes it
  silently (no test fails, no type error). Structure must be pinned by
  test, and size by build evidence.
- **Guard:** `desktop/src/floor/__tests__/office-lazy.test.tsx` pins the
  boundary (deck-view imports the wrapper, never office-scene statically;
  the wrapper uses `import()`); the vite chunk listing (pasted in the
  FID) is the size evidence.
- **Scope:** desktop, bundling
- **Owning FID:** FID-2026-0906-005
- **Status:** active
- **Canonical rule:** lazy-boundary-pinned-structurally

## Lesson: A ledger ruling inherits the freshness of its evidence

- **Context:** FID-2026-0906-006 (T17-B): the 2026-09-06 ruling authorized
  building the office presentation layer from a 2026-08-31 smoke finding;
  FID-2026-0905-005 had already built and composed the entire layer on
  09-05. Executing the ruling literally would have duplicated working
  code behind an approval.
- **Invariant:** Before executing an approved item, re-ground its premise
  against the current tree; a scope item is only as fresh as the evidence
  it was authored from. Present the ground-truth shift (Law 2) and
  converge the record — never build duplicates, never silently drop.
- **Guard:** the per-element audit table in FID-2026-0906-006 (every
  ruled element → `file:line` of composed, rendered code); acceptance
  stays with the operator visual smoke, the original bar.
- **Scope:** governance, scope-grounding
- **Owning FID:** FID-2026-0906-006
- **Status:** active
- **Canonical rule:** ruling-premise-regrounded-at-execution

## Lesson: Status-based guards inherit git's index-state blindness

- **Context:** The v0.0.29 phantom-source incident: three tracked files
  marked assume-unchanged kept 21 lines of real source out of every
  commit while every gate stayed green — `git status` does not render
  hidden index-state flags, so every guard built on status was blind to
  the exact mechanism of the corruption.
- **Invariant:** Any git state that hides content from `git status`
  hides it from every check built on `git status`. Provenance guards
  must query the index directly (`git ls-files -v`: `S`/lowercase tags =
  hidden) and prove the *committed* tree independently of the worktree.
- **Guard:** `scripts/public-release/provenance.ts` — index-state
  uniformity assertion in `verifyPreflight` (fail in mutation/automation,
  warn in preview) plus a clean-checkout compile gate in the GATES stage
  (detached temp worktree at HEAD, frozen-lockfile install, typecheck
  chain, removed on every path). The two cover disjoint classes: the
  flag, and committed-vs-worktree content drift.
- **Scope:** release-pipeline, provenance
- **Owning FID:** FID-2026-0906-003
- **Status:** active
- **Canonical rule:** index-state-asserted-directly

## Lesson: The release gate is an environment, not a gate list

- **Date:** 2026-09-09
- **Failure:** The v0.0.30 cut failed at three successive gates on code that
  passed every dev-shell run: (1) `build:sdk` — `common/src/env.ts:44` used
  Bun-only `import.meta.dir`, and the SDK's dts-bundle-generator step
  recompiles common under a plain-TS program without Bun types (TS2339);
  (2) `gateway-server-command.test.ts:85/158` spawned children by bare
  `'bun'` — `uv_spawn` ENOENT under the gate's sanitized spawn environment;
  (3) `evals/v2/tests/tempdir-sandbox.test.ts` spread `process.env` into a
  plain object before the allowlist, materializing the launching shell's
  Windows env casing (PowerShell `Path` vs Git Bash `PATH`) so the
  case-sensitive lookup missed `PATH`.
- **Evidence:** release transcripts `build-sdk-1.log` (TS2339) and
  `test-1.log` ×2 (ENOENT ×2, then `env.PATH → undefined`); fixes `2b22103`,
  `87bcc44`, `05e2e1a`; owning FID-2026-0909-002 (instances + structural
  guard proposal).
- **Invariant:** The release GATES stage is a distinct execution environment
  (PowerShell-launched, secret-sanitized, plain-TS declaration pass) — code
  must behave identically across it and every dev shell.
- **Guard:** Prefer `process.execPath` over bare runtime names in spawned
  children; standard `import.meta.url` over runtime-specific properties in
  SDK-reachable common sources; fixture envs (never host-env spreads) in
  tests feeding env-filtering functions. Structural parity guard proposed
  in FID-2026-0909-002.
- **Verification:** Each fix re-ran its exact failing gate green
  (build:sdk exit 0; gateway suite 6/0; evals suite 166/0) plus typecheck
  ×12, eslint 0, prettier clean.
- **Scope:** release/gates, testing
- **Owning FID:** FID-2026-0909-002
- **Status:** active
- **Canonical rule:** gate-environment-parity

## Lesson: "Compiles" is one claim per compiler configuration

- **Date:** 2026-09-09
- **Failure:** `verify:clean` (the committed-tree compile proof) passed on
  the exact commit whose `build:sdk` release gate failed — the typecheck
  chain compiles `common` with Bun types loaded, while the SDK build's
  dts-bundle-generator declaration pass recompiles the same sources under a
  plain-TS program without Bun types. That surface is exercised only inside
  the release pipeline, so a declaration-surface blocker reached the cut
  with every local gate green.
- **Evidence:** release transcript `build-sdk-1.log` (`TS2339` on
  `common/src/env.ts:44`, `durationMs: 7011`) vs `bun run typecheck` exit 0
  on the same commit; owning FID-2026-0909-003.
- **Invariant:** "Compiles" is one claim per compiler configuration; every
  compilation surface a release consumes (workspace tsconfigs, declaration
  programs, bundle targets) needs its own gate in the committed-tree proof.
- **Guard:** Proposed (FID-2026-0909-003 Steps): add `build:sdk` (~7s) to
  `verify:clean`'s chain with transcript capture, plus a RED pin that
  reverts the anchor fix on a scratch worktree and asserts the extended
  gate fails.
- **Verification:** `build:sdk` exit 0 post-fix `2b22103` (the failed gate
  now passes); the RED pin and chain extension are pending per the owning
  FID.
- **Scope:** release/gates, verification
- **Owning FID:** FID-2026-0909-003
- **Status:** active
- **Canonical rule:** compiles-is-per-surface

## Lesson: A policy scrub must sweep the rule text and its generator anchors, not just the artifacts

- **Date:** 2026-09-10
- **Failure:** The 2026-08-09 no-signature scrub (FID-2026-0809-014)
  removed `Author:` attribution from every artifact — but missed the rule
  itself: `ECHO.md`'s FID Authoring Rules still declared `**Author**` a
  required metadata field for 20 days. Because the sentence is a generator
  anchor (`FRAMING.fidAuthoringParagraphs` in
  `scripts/protocol-copies/content.ts`), the drift guard froze the stale
  wording into both generated protocol constants — re-teaching the dead
  rule to every agent — while `fid-ledger.ts` FORBIDDEN_ATTRIBUTION
  mechanically rejected what the rule required. Live consequence: the
  FID-2026-0910-001 Verifier correctly FAILED a compliant FID for the
  missing field. Flagged 2026-08-21 (session summary 0314:53) and never
  fixed until the audit exposed it.
- **Evidence:** commit `7031d6b9` (the 3-site atomic fix);
  `scripts/protocol-copies/content.ts:169`, `dev/echo-v0.1.2-single-agent.md:288-289`
  (which forbids `Author:` at its own :30), `scripts/fid-ledger.ts:32`.
- **Invariant:** The sentence declaring a requirement is itself an
  artifact. When a generator anchors to rule text, the drift guard that
  normally protects consistency freezes the stale wording until ALL
  coupled sites are edited in one commit.
- **Guard:** A policy scrub greps its forbidden patterns across governance
  docs AND generator sources, not just the artifacts the policy governs;
  when an auditor fails a document for violating a rule that contradicts
  policy, the auditor is the signal, not the bug.
- **Verification:** parity suite 15/0 (pre-regen 14/1 = the drift guard
  firing by design); `generate:protocol-bundle:check` exit 0; repo-wide
  grep = 5 fixed sites, zero live residue.
- **Scope:** governance, generated artifacts
- **Owning FID:** FID-2026-0910-002 (closed + archived)
- **Status:** active
- **Canonical rule:** rule-text-outlives-policy

## Lesson: External research citations are hypotheses until grepped against the tree

- **Date:** 2026-09-10
- **Failure:** The Gemini Deep Research report on SkillOpt integration
  correctly identified the presentation-stage gap but built its blueprint
  on fabricated seams: `cli/src/components/SkillList.tsx:65` (component
  does not exist), `prompts.ts:415` (file is 211 lines),
  `session-end-review.ts:140` (file is 117 lines), a quarantine-root
  `VERSIONS.jsonl` (never existed) — and its SkillOpt Issue #247
  "fragile backup" rejection rationale was inverted (current SkillOpt
  main fail-closes; Savant's rollback machinery is ahead). Two claims
  needed adjustment, not rejection (`/skills` already prints counts on
  demand; the Levenshtein cap is already engine-enforced).
- **Evidence:** the adversarial verification pass in session summary
  `2026-09-10-1245`; FID-2026-0910-001's Evidence section (the verified
  seam set).
- **Invariant:** A research report — however well-reasoned its
  architecture — carries file:line citations that are hypotheses, not
  facts. Building on an unverified seam propagates the fabrication into
  the FID record.
- **Guard:** Before folding any external report into a FID, grep every
  file:line citation against the working tree; classify each finding
  CONFIRMED / REFUTED / ADJUSTED, and build only on the verified subset.
- **Verification:** all three fabricated citations refuted by direct
  grep/read; the corrected 6-FID plan derived from the verified seams
  only.
- **Scope:** research workflow, FID authoring
- **Owning FID:** FID-2026-0910-001 (analyzed)
- **Status:** active
- **Canonical rule:** verify-research-citations-before-building

## Lesson: EHEL verification credit is per-agent — subagent runs do not clear the parent's gate

- **Date:** 2026-09-10
- **Failure:** After editing two files, `basher` subagents ran the full
  verification battery (prettier/eslint/markdownlint/typecheck) with all
  green tool output — but EHEL's Law 3 per-file gate still BLOCKED the
  parent's next write: the tracker credits verification from the
  parent's own tool executions, not from a spawned agent's terminal
  output relayed back through conversation context.
- **Evidence:** the Law 3 block sequence in session summary
  `2026-09-10-1245`; the gate cleared only after the parent ran the same
  chains via its own read-only command tool.
- **Invariant:** The Law 3 "unverified file" list is scoped to the
  agent attempting the write; verification evidence must come from that
  agent's own tool calls. A subagent's green run is real verification of
  the code but not credit the parent can spend.
- **Guard:** When EHEL blocks with unverified files after subagent
  verification, re-run the same lint/typecheck chain directly (the
  read-only command tool runs in every phase) — do not re-spawn bashers
  expecting different behavior.
- **Verification:** each direct re-run cleared the gate immediately;
  observed consistently across three block/clear cycles this session.
- **Scope:** harness, EHEL enforcement
- **Owning FID:** none (harness behavior observation — tracked so it
  does not silently recur; promote to a FID if a third session confirms
  an undesired interaction)
- **Status:** active
- **Canonical rule:** eHEL-verification-credit-is-per-agent
