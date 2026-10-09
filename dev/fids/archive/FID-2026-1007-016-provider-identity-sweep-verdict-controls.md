# FID: provider identity sweep cannot emit a verdict without a same-model control

**Filename:** `FID-2026-1007-016-provider-identity-sweep-verdict-controls.md`
**ID:** FID-2026-1007-016
**Severity:** low
**Status:** closed
**Created:** 2026-10-07
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

`bun run providers:identity --provider <slug> --all` sweeps every route in a
provider's catalog and reports per-route status (`ok`/`unavailable`/`failed`)
and a served-label classification (`match`/`mismatch`/`unknown`), but every
row's identity `verdict` is `inconclusive`: the sweep path threads **no control**
into `runIdentityGauntlet`, and `verdictFor` cannot separate a target from a
control it does not have (`scripts/providers/lib/identity-runner.ts:264`). The
single-target path already accepts `--control-provider/-model/-base-url` and the
`--different-*` pair (`scripts/providers/identity-gauntlet.ts:57-59`, controls
manifest at `:222-245`); the sweep (`scripts/providers/lib/identity-matrix.ts:72`,
row verdict at `:111`) does not. So the tool answers *did the route respond* and
*did it name the requested model*, but not *does this route's answer differ from
a same-model control* — the comparison that makes a verdict mean anything.

## Environment

- **OS:** Windows (win32), Bash (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `tsc --noEmit`
- **Commit/State:** `main`; FID-2026-1007-008 (the gauntlet) archived

## Detailed Description

### Problem

The sweep cannot emit an identity verdict. `MatrixRow.verdict` is copied
verbatim from the per-route report (`identity-matrix.ts:111`), and that report
comes from a run with no control and no different-model sample, so `verdictFor`
returns `inconclusive` for every route regardless of what the route actually
served.

### Expected Behavior

A sweep row should carry a verdict when a same-model control for that route is
available (a configured second endpoint, or a recorded prior sample), and should
say `inconclusive` only when no control exists.

### Root Cause

Controls are a single-target concern in the CLI and were never threaded through
the catalog sweep. The matrix calls the runner once per route with no `controls`
manifest.

### Evidence

Measured sweep (`bun run providers:identity --provider hcnsec --all`,
2026-10-08T01:01:41.512Z):

```text
Swept 7 routes — ok 1, unavailable 0, failed 6
Served-label: 1 match, 0 mismatch (the rest unknown)
```

Every row's verdict, from `dev/provider-identity/identity-matrix.json`:

```text
glm-5.3-flash               verdict: inconclusive  (status failed, error)
DeepSeek-V4-Flash           verdict: inconclusive  (status ok, label match — deepseek_for_coding)
deepseek-v4-flash-vision-exp verdict: inconclusive  (status failed, http-503)
Qwen3.6-35B-A3B             verdict: inconclusive  (status failed, http-503)
Qwen3.8-Flash-Next          verdict: inconclusive  (status failed, error)
step-3.7-flash              verdict: inconclusive  (status failed, http-503)
kimi-k3                     verdict: inconclusive  (status failed, http-500)
```

A `match` label is itself only a label check — `classifyServedLabel`
(`scripts/providers/lib/identity-core.ts:190`) compares model families — not an
identity verdict. The report's own "What this does not prove" section states
that a proxy can echo any label.

A served-label substitution was observed in an earlier single-target probe
against this same provider: a request for `hcnsec/glm-5.3-flash` returned HTTP
200 naming `longcat-2.5-preview-free`. At authoring it was **not** captured to
an artifact, so it stood as **to re-capture**; Loop 4 records its re-capture
(both completed probes served `longcat-2.5-preview-free`, artifact
`dev/provider-identity/identity-report.json`). A verdict proper still needs
the operator's control pair.

## Impact Assessment

### Affected Components

- `scripts/providers/lib/identity-matrix.ts`, `identity-runner.ts`, `identity-manifest.ts`
- `scripts/providers/identity-gauntlet.ts` (sweep flags)
- `scripts/providers/__tests__/identity-matrix.test.ts`

### Risk Level

- [ ] Critical
- [ ] High
- [ ] Medium
- [x] Low: the tool is operator-run and changes no production behavior

## Proposed Solution

### Approach

Thread a per-route control into the sweep so `verdictFor` has a comparison, and
give the CLI a sweep-level control flag that applies to each route (or a
per-model map).

### Steps

1. Accept `--control-provider/-model/-base-url` on the sweep path and build a
   `controls` manifest per route (default: the same family on a second endpoint
   when configured; otherwise absent).
2. Thread `controls` into the per-route `runIdentityGauntlet` call inside
   `runIdentityMatrix`.
3. Keep `inconclusive` when no control exists — never synthesize a verdict from
   a single sample.
4. Extend `identity-matrix.test.ts`: a route with a control that serves a
   different family reports `mismatch-requiring-review`; a route with no control
   stays `inconclusive`.
5. Re-capture the `glm-5.3-flash` observation as a verdict, or record it as
   unreproducible.

### Verification

```bash
bun test scripts/providers/__tests__/identity-controls.test.ts scripts/providers/__tests__/identity-matrix.test.ts scripts/providers/__tests__/identity-gauntlet.test.ts
bun run typecheck:scripts
```

## Verification Gates

- gate: test scripts/providers/__tests__/identity-controls.test.ts
- gate: test scripts/providers/__tests__/identity-matrix.test.ts
- gate: test scripts/providers/__tests__/identity-gauntlet.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:53cdb7d79963667f0fd8544b2a9db749e81ae24235121800eadd31e53f678f71
- verified: 2026-10-09T01:54:55.503Z
- test scripts/providers/__tests__/identity-controls.test.ts: exit 0
- test scripts/providers/__tests__/identity-matrix.test.ts: exit 0
- test scripts/providers/__tests__/identity-gauntlet.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Every sweep row is `inconclusive`; the sweep cannot produce a verdict.
- **GREEN:** Thread a same-model control into the sweep.
- **AUDIT:** Single-target controls already exist and are tested; this reuses them.
- **ADVERSARIAL:** Would a control manufacture a false `mismatch`? Only if the
  control itself is a different build; the family comparison already tolerates
  naming variance.
- **CHANGE DELTA:** n/a (created, not implemented)

### Missed Questions

1. Should the sweep derive controls from the provider registry automatically, or
   require operator input? → Operator input first; auto-derivation guesses.
2. Is the `longcat-2.5-preview-free` substitution a defect to chase now? → No.
   Record it; the control seam is the fix, and the route currently fails.
3. Does this change any production behavior? → No. It is an operator-run script.

### Loop 2 — full-perfection pass, GREEN fold (2026-10-08, operator-triggered)

RED re-verified today: `identity-matrix.json` is still 7/7 `inconclusive`
(`grep -c` = 7); `runIdentityMatrix` calls `runIdentityGauntlet` with no
`controls` argument (the call's own comment says the caller owns probes and
controls); `verdictFor(controls, samples)` branches on control absence.

GREEN fold — missed questions answered:

1. A control must be a PAIR (a same-endpoint known model for spoof detection plus
   the reference model for undetectability); a CLI flag alone was the wrong
   default. Controls come from an operator-owned manifest, never hardcoded.
2. A missing manifest entry is a first-class state: that row stays
   `inconclusive` and the sweep continues (provider rosters churn).
3. Vocabulary: separate "structurally unevaluable" (no control exists) from
   "empirically inconclusive" (control ran, samples insufficient). Whether the
   no-control state gets its own verdict name is an operator decision.
4. Controls are credential-epoch bound: a control captured before the provider's
   last key rotation is inadmissible (stale-control → inconclusive), so a verdict
   can never survive a credential change.
5. Multi-family hosts: key the manifest by (provider, family), mirroring what the
   single-target path already demands per invocation.
6. Cost bound: an operator probe budget; exhaustion degrades rows explicitly.
7. Downstream contract: only the generated provider-reference rendering may
   upgrade ('not attested' → 'attested'); no CI gate may fail on a verdict.

Named operator decisions: authorize/fund the control-armed re-run; author the
control manifest; ToS comfort for scaled dual-model probing; probe budget.

### Loop 3 — document convergence (2026-10-08)

- **RED re-verified:** `identity-matrix.json` still 7/7 `inconclusive`;
  `runIdentityMatrix` (`identity-matrix.ts:72`) calls `runIdentityGauntlet`
  with `{manifest, invoke, now}` only (`:77-81`) — no controls; the manifest
  path defaults them to `{}` (`identity-manifest.ts:78`); `verdict:`
  copied at `:111`; single-target flags (`identity-gauntlet.ts:57-59`),
  manifest block (`:223-227`), `verdictFor` (`identity-runner.ts:227,263-270`)
  and `classifyServedLabel` (`identity-core.ts:190`) all present as cited.
- **GREEN:** Loop-2 answers stand. Open items are operator-sovereign, recorded
  as blocked rather than defaulted: control-armed re-run funding; control
  manifest authorship; ToS comfort; probe budget; no-control verdict naming.
- **AUDIT (double):** (1) citations re-measured above. (2) `fid:verify --check`
  informational "no gates declared" — the uniform pre-implementation response
  proven identical on untouched `-012`/`-014`; not a defect.
- **Status ruling:** `created` → `analyzed` (Loop-2 GREEN fold complete;
  implementation not started; precedent: `-012` Loop 2 ruling).
- **CHANGE DELTA:** ~4%. **CONVERGED:** zero open questions; implementation
  authorized separately.

### Loop 4 — implementation (2026-10-08, operator-authorized completion pass)

- **RED:** sweep threads no controls; matrix report and console show no verdict.
- **GREEN:** `lib/identity-controls.ts` (operator-owned manifest loader,
  pair-or-uncontrolled rule, shape/version validation); sweep arming in
  `runSweep` (`--controls-manifest`, `--max-control-probes`, credential
  pre-resolution with warn-and-continue, A+B probes on armed handshake rows,
  budget wrapper degrading to uncontrolled, verdict per row plus armed/budget
  summary); Verdict column in the matrix report table and console rows.
  `matrix.ts`/`runner.ts` untouched (the seam already existed).
- **AUDIT — two structural corrections (SELF-CORRECT):**
  1. The FID Steps' single-control language cannot satisfy `verdictFor`
     (sameModel AND differentModel required) and a 1-probe handshake can
     never clear its ≥2-probe restraint — Loop 2's pair design plus
     conditional A+B probing is what makes verdicts reachable at all.
  2. `identity-gauntlet.ts` hit 417 lines against the 300 cap → `runSweep`
     extracted to `lib/identity-sweep.ts` (gauntlet back to 223; the
     type-plus-deferred-value import cycle is documented in the module
     header); parseArgs pins moved to the controls suite (gauntlet.test back
     to its original size).
- **Step 5 re-capture: CONFIRMED.** Live single-target probe
  (`hcnsec/glm-5.3-flash`, 2/5 probes, 25 s) was served as
  `longcat-2.5-preview-free` on both completions — artifact
  `dev/provider-identity/identity-report.json` (gitignored tool output).
  A verdict proper still needs the operator's manifest and control pair.
- **AUDIT gates:** provider suites 43/43 over six files (32 across the three
  declared suites) · `typecheck:scripts` exit 0 ·
  `eslint --max-warnings 0` exit 0 · `lint:md` exit 0 ·
  `quality: PASS (1498 baselined files)` (declared, runs at stamp).
- **Open remainder (registered, not dropped):** T175 — operator manifest
  authorship, re-run funding, ToS comfort, probe budget number, no-control
  verdict naming, credential-epoch rotation source.
- **CHANGE DELTA:** ~5%. **Status ruling:** `analyzed` → `fixed`.
- **Closure:** `fixed` → `closed` on implementation verification (receipt 4/4
  PASS); archived with receipt re-stamped at the archived path.

## Resolution

- **Closed Date:** 2026-10-08
- **Fix Description:** sweep control seam: operator-owned manifest, per-route
  arming with credential pre-resolution, conditional two-probe verdict rows,
  probe-budget degradation, and verdict visibility in console and report.
- **Tests Added:** Yes — `identity-controls.test.ts` (10 pins incl. flag
  parsing) plus matrix control pins (2), green with the pre-existing suites.
- **Verification Evidence:** provider suites 43/43; `typecheck:scripts`
  exit 0; eslint 0; lint:md 0; quality PASS (1498); live re-capture artifact
  confirms the substitution; receipt `sha256:7f038f38…`
  stamped 2026-10-09T01:50:57Z at implementation (4/4 gates), re-stamped at
  the archived path. Commit: pending operator G2 commit (working tree).
- **Archived:** 2026-10-08 — moved to `dev/fids/archive/`; register item T165 complete, remainder T175.

### Code Verification Evidence

Status is `closed` — closed on implementation verification (Loop 4) and
archived. The seam exists, is wired, and passes its suites (43/43
across the provider family) plus the live re-capture in Loop 4. The RED
evidence (7/7 inconclusive matrix, control-less runner call) is measured
output; the control flow that replaces it is pinned per route.

## Lessons Learned

**A sweep that reports status is not a sweep that reports identity.** Reporting
per-route availability is genuinely useful, but calling the result an "identity
sweep" overstates it: without a control, the verdict column can only ever say
`inconclusive`.
