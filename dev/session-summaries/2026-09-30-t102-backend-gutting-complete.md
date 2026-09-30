# Session Summary — 2026-09-30 — T102 gut-the-backend stage 2 completed + verified

## Session scope

- **T102** (`dev/fids/FID-2026-0929-005-backend-gutting.md`, status
  `verified`): finish the in-progress gut-the-backend stage-2 implementation
  wherever it stood. **Operator directives this session:** *"it is forbidden
  to use python scripts to edit the project because it violates current echo
  standards, resume manuallu"* (all edits made with direct file-edit
  operations; no script touched the tree), *"DO NOT touch echo.md"
  (ECHO.md untouched throughout), then the completed ruling: *"now we need to
  update SINGLE AGENT ECHO, completely forbid editing files via python
  scripts. It needs to be added to this file."* — with the operator's
  diagnosis: an agent that judges the work too large reaches for an edit
  script, skips Read-0-EOF entirely, and one blind transform rewrites N
  unread files; the domino effect (broken imports, drifted conventions) is
  discovered late. Single-agent sessions have no second agent to catch it.

## T103 — the no-scripted-edits standard, codified (completed 2026-09-30)

- **Intake:** blocked item (operator had not named a surface, and had
  forbidden `ECHO.md`); cleared when the operator named
  `dev/echo-v0.1.2-single-agent.md` and ordered the edit. Read that file
  0-EOF (564 lines) before touching (Law 1, practicing what the rule
  preaches).
- **Edit (one file, four placements, in the document's own idiom):**
  1. **Law 1 row** — directive extended: "**Never edit through a script —
     every change is a direct file-edit operation on a file you have
     read.**"; enforcement names the scripted bulk edit as the canonical
     violation.
  2. **Additional Rule — NO SCRIPTED EDITS (Law 1, absolute)** beside the
     sibling scope Additional Rule: forbidden means any executable transform
     (Python, Node, Bash, sed/awk/perl, PowerShell) writing/moving/renaming/
     deleting a project file as the means of a change; records the operator
     ruling verbatim; **Why** section states the domino mechanism;
     **What is allowed** draws the line (read/analyze scripts, gates, the
     project's own tooling, package managers); **The tell** section: "too
     repetitive by hand" is a signal to stop and re-present (Law 2), never
     a licence to skip reading.
  3. **Invariants no level lifts** — "No scripted edits" holds at every
     autonomy level, including 3.
  4. **Anti-Patterns table** — new row: "Editing files via a
     Python/Node/Bash/sed script (any scripted transform)" → Law 1.
- **Verification:** grep confirms all four placements (lines 73, 89, 206,
  481); `bun run lint:md` PASS; SCOPE.md T103 left the register (open count
  11 → 10) per the completed-items rule; scope-register-check re-run below.
- ECHO.md untouched (standing operator directive).

## Receipt-readiness pass (same day, post-close request)

- `fid:verify <fid> --check` failed: the declared gates block (authored with
  parentheticals in the bulk stage, prose placeholders in the receipt) was
  unparseable. Read the parser (fid-verify.ts → fid-verification-gates.ts →
  -locators.ts) rather than guessing: the `## Verification Gates` section
  extends to the next `^## ` heading, admits only physical `- gate:` lines
  in the canonical grammar (typecheck plus a workspace key, test plus a
  test path, probe plus a script path, or bare quality) plus `- ` bullets —
  any prose is malformed.
- Repaired the block to the grammar (6 gates: typecheck sdk/cli/common/
  packages/agent-runtime + test + quality; notes as single-line `- `
  bullets; receipt placeholder moved under the `###` heading).
- Added `sdk/src/__tests__/fid-2026-0929-005-backend-gutting.test.ts` —
  4 receipt-grade pins (env exports absent, `getCiEnv()` drops the retired
  key even when set, client has no connection surface, default inference
  fails fast naming `INFERENCE_BASE_URL`). Path embeds the FID id so no
  vendored `resources/` stale copy can shadow the `bun test` filter (T67
  guard; `resources/freebuff-main/sdk/src/__tests__/{client,env}.test.ts`
  collisions verified live).
- Evidence: pin file 4/4; sdk suite 529/0 (88 files); `fid:verify --check`
  PASS with all 6 gates exit 0 (fingerprint sha256:2860038d…); lint:md
  PASS; eslint clean on the new file (import order auto-fixed).
- The FID remains `verified`, receipt-ready: the stamp (fid:verify --write
  against the FID path) lands at closure, which also needs the operator's
  committed hash (G2).

## What the completion pass found (RED) and fixed (GREEN)

The bulk stages had left the tree short of the FID's own Verification
contract. Residue found by the declared absence-greps + consumer census, and
removed:

- `common/src`: `SAVANT_CODE_API_KEY` read in `env-ci.ts` (`getCiEnv`),
  typed in `types/contracts/env.ts` (`CiEnv`), defaulted in
  `testing-env-ci.ts` and `testing/fixtures/agent-runtime-primitives.ts`;
  `__tests__/env-ci.test.ts` asserted the field.
- `sdk/src/env.ts`: orphaned `isDirectProviderMode()` +
  `getRuntimeAppUrlFromEnv()`, the `SAVANT_CODE_APP_URL` child-shell
  allowlist entry, and retired short-circuit-doctrine comments.
- `sdk/e2e/utils/get-api-key.ts` read, required, and **wrote**
  `SAVANT_CODE_API_KEY`; 14 e2e suites passed `apiKey: getApiKey()` into the
  credential-free client (invisible to the typecheck chain — e2e is outside
  every tsconfig `include`). Replaced with a keyless `setupMockClient()` seam
  (mock mode installs the LLM spies; live mode uses the caller's own
  provider env).
- `sdk/e2e/integration/connection-check.integration.test.ts` deleted — it
  pinned only the deleted `checkConnection()`.
- `sdk/e2e/examples/*` (4 files) de-credentialed;
  `sdk/src/__tests__/client.test.ts` env-manipulation pin replaced with a
  no-credential-surface pin; `sdk/src/__tests__/run-event-dispatch.test.ts`
  dead `/api/v1/me` stub branch deleted;
  `sdk/e2e/utils/e2e-mocks.ts` dead `buildMockAgentTemplate` +
  `E2E_MOCK_API_KEY` deleted; `sdk/src/impl/agent-runtime.ts` dead
  `DatabaseAgentCache` import deleted.
- Bulk-stage lint fallout (29 warnings): dead locals
  `startTime`/`creditsBefore`/`childrenBefore` (`run-programmatic-step.ts`,
  `loop-iteration.ts`), `stepStatus`/`messageId` destructure
  (`loop-iteration.ts`), unused type imports
  (`run-programmatic-step/types.ts`, `spawn-validation.ts`), unused test
  imports (7 files), import-order fixes in FID-touched cli files.
- cli test env-hygiene lists (7 suites) dropped the retired var;
  `savant-code-api-modes.test.ts` stub-token literal neutralized;
  `provider-setup-gateway.test.ts` stale comment corrected.

## Verification evidence (all tool output, this session)

- `bun run typecheck` — 13 legs, 0 errors (twice: after GREEN, after the
  final lint fix).
- `cd sdk && bun test src/` — 524 pass / 0 fail (525 ran).
- `cd cli && bun test src/` — 3746 pass / 0 fail (3764 ran, 18 skip).
- agent-runtime 1551 / 0; common 723 / 0 (4 skip); full root `bun run test`
  chain green.
- `bun x eslint . --max-warnings 0` — PASS (after 29 → 0 warning cleanup).
- `bun run lint:md` — PASS. `bun run quality:report` — PASS (1498 files).
- `bun run scripts/scope-register-check.ts` — PASS (0 issues).
- Law 4 absence-greps: `SAVANT_CODE_API_KEY|API_KEY_ENV_VAR` → doc comments,
  negative test pins, and the sanitize redaction-pattern test only (security
  surface, kept by design); `getWebsiteUrl|checkConnection|healthz` → zero
  production matches; `outOfCredits|OUT_OF_CREDITS|buy-credits` → zero
  production matches; `stub_bypass_dev_local` → zero production matches;
  `/api/v1/` in sdk/src → comments + the out-of-scope OpenRouter-direct
  resolver only. Call-graph reachability of the replacements is proven by the
  14 e2e constructors + 3 passing pins (`client.test.ts`).

## Artifacts

- FID `dev/fids/FID-2026-0929-005-backend-gutting.md`: status → `verified`;
  loop-2 audit recorded with evidence; ceremony (commit + archive +
  CHANGELOG) awaits operator git authorization (G1/G2).
- `SCOPE.md`: T102 entry updated to implemented + verified; T103 registered
  (ECHO no-scripted-edits standard, blocked on an operator-named document
  surface); open count → eleven.
- ECHO.md untouched (operator directive).
