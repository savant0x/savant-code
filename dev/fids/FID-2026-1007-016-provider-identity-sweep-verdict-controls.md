# FID: provider identity sweep cannot emit a verdict without a same-model control

**Filename:** `FID-2026-1007-016-provider-identity-sweep-verdict-controls.md`
**ID:** FID-2026-1007-016
**Severity:** low
**Status:** created
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
200 naming `longcat-2.5-preview-free`. It was **not** captured to an artifact,
and the subsequent sweep shows that route failing (`error`, 0 completed probes),
so it is recorded here as **to re-capture**, not as a measured finding. The
control seam this FID adds is precisely what would let such an observation
become a verdict.

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
bun test scripts/providers/__tests__/identity-matrix.test.ts
bun run typecheck:scripts
```

## Verification Gates

Gates are declared at implementation time per the `converged` contract; a
`created` record declares none.

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

## Resolution

- **Closed Date:** pending
- **Fix Description:** pending
- **Tests Added:** pending
- **Verification Evidence:** pending
- **Archived:** pending

### Code Verification Evidence

Status is `created`. The RED evidence is the measured sweep above and
`dev/provider-identity/identity-matrix.json` (every row
`"verdict": "inconclusive"`). Reference points verified against the tree at
creation: `scripts/providers/identity-gauntlet.ts:57-59` (`controlModel`,
`controlProvider`, `controlBaseUrl`), `:222-245` (controls manifest),
`scripts/providers/lib/identity-matrix.ts:72` (`runIdentityMatrix`), `:111`
(`verdict: report.verdict`), `scripts/providers/lib/identity-runner.ts:264`
(`verdictFor`), `scripts/providers/lib/identity-core.ts:190`
(`classifyServedLabel`).

## Lessons Learned

**A sweep that reports status is not a sweep that reports identity.** Reporting
per-route availability is genuinely useful, but calling the result an "identity
sweep" overstates it: without a control, the verdict column can only ever say
`inconclusive`.
