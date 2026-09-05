# Session Summary — 2026-09-05: gateway decomposition (FID-2026-0905-004)

## Operator directives

1. "Open the next source-monolith FID (gateway.ts or public-release.ts)"
2. "Run the Perfection Loop to convergence and implement the gateway decomposition"

## What happened

### FID opening (Loop 1 RED)

- Target: `cli/src/server/gateway.ts` — 1,327 lines, largest actionable
  residue monolith. `public-release.ts` was rejected by sequencing: it is the
  landing zone for FID-2026-0903-001 at the next release cut.
- Ground truth: single production caller (`server-command.ts:17`), 9-file
  characterization suite with per-method coverage, one gap —
  `injectTriggerRun` had zero direct pins.
- New FID: `dev/fids/FID-2026-0905-004-gateway-decomposition.md`.

### RED finding 5 — real harness race (fixed)

`fid:verify` exposed a flaky `gateway.test.ts`: `request()` in
`gateway-test-harness.ts` returned `frames[0]` (first frame of ANY kind), and
from the repo root the post-hello FID-snapshot notification can interleave
into a request's collect window — the test then read `undefined` off a
notification. Server always correct; the helper lost the response. Fixed by
returning the id-matched frame (one line). Verified: root runs 5/5 (were
~3/7 flaky), full suite green from both cwds.

### Perfection Loop

- Loop 2 (RED/GREEN/AUDIT/ADVERSARIAL, ~40% delta): GatewayContext state
  contract; approvals moved into the run domain; `Bun.serve` transport STAYS
  in the facade (extraction rejected as facade-hollowing) with a
  pre-authorized websocket-handler contingency; fidStatuses encapsulated in
  the fid bus; types.ts added so no stage imports from the facade.
- Loop 3: <2% delta — converged. Status `analyzed`.

### Implementation (operator-approved, RED-first held)

- RED: `gateway-inject-trigger.test.ts` — 5 pins green on the monolith
  (3× stable), baseline 35/0 / 163 expects across 10 files.
- Wave 1: types (148), commands-registry (47), triggers-rpc (206),
  scoped-threads-rpc (154).
- Wave 2: state (140), fid-events (142), run-lifecycle (249) + ceiling
  contingency `default-run-prompt.ts` (86) when run-lifecycle hit 326.
- Wave 3: handshake-rpc (285, `createDispatch`); facade 1,327 → **236**.
- Audit: cli typecheck 0; server suite 35/0 / 163 both cwds (parity); full
  cli suite 3,478 pass / 1 fail (the fail is the PRE-EXISTING untracked
  provider-drift test `provider-setup-gateway.test.ts` — fails in isolation,
  recorded as R4 [OPEN-OUT-OF-SCOPE]); eslint full repo `--max-warnings 0`;
  prettier; lint:md; quality:report 17 → 16 with gateway.ts UNLISTED, no new
  entries; Law-4 grep: single caller unchanged.
- Receipt: `fid:verify --write` stamped **6/6 PASS**. Status `fixed`.

## State now

- Active queue: -0903-001 (release cut) + -0905-001 (`fixed`, blocked on G2
  hash) + -0905-004 (`fixed`, blocked on G2 hash).
- Residue backlog: public-release (3,065), office-scene (2,127),
  __nt-before-snapshot (895).
- Carried operator decisions: R4 provider-drift baselines (incl. the failing
  untracked provider test), R5 `common/` typecheck red (30 errors,
  bun:test globals).

## Step statuses

All steps `implemented` except FID closure (Step 6, -0905-001 Step 5) —
both `blocked` on the operator's G2 commit hash. No silent deferrals.
