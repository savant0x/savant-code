# FID: Every repository gate must be declarable on a FID — the probe runner and the declarability audit

**Filename:** `FID-2026-1007-003-gate-declarability-and-probe-runner.md`
**ID:** FID-2026-1007-003
**Severity:** medium
**Status:** closed
**Created:** 2026-10-07 14:10
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

The FID gate executor admits four shapes only — `typecheck <workspace>`,
`test <path>`, `probe <path>`, `quality` (FID-2026-0823-009). A repository gate
that is a binary (`eslint`, `prettier`), a package-manager invocation
(`bun install --frozen-lockfile`), a build, or a script that only checks under a
flag therefore has **no declaration in that vocabulary** — and a record whose
subject is that gate cannot declare the check that proves it. T154 was the worked
example: `lint:md` was un-recordable until `scripts/lint-md-check.ts` existed.
This record closes the class rather than the instance. Two mechanisms landed:
**one shared probe body** (`scripts/probe-runner.ts`) that every gate probe
delegates to, and **a wired audit** (`scripts/gate-declarability.ts` +
`scripts/gate-declarability-registry.ts`) that pairs all 29 repository gates with
the allowlisted declaration that proves each one and fails `validate:repository`
in the three directions that actually regress — an unaudited contract gate, a
declaration the **real** allowlist rejects, and an undeclarable gate with no
stated reason. Sixteen repository gates are now expressible as thin probes. The
same pass adds `scripts/audit-test-budget-injection.ts`, the pin-hardening
follow-on from FID-2026-1006-004: no test helper may call a budgeted function
without injecting a budget. The workstream was found **unregistered** in the
working tree at intake of the 2026-10-07 closure pass; this record is its
registration, its evidence, and its closure vehicle.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** git, bun test, eslint (repo-pinned), markdownlint-cli 0.49.1, prettier (repo-pinned)
- **Commit/State:** HEAD `7901568f`; the work landed in this session's working
  tree unregistered, and is committed path-scoped with this record

## Detailed Description

### Problem

Three separate gaps meet in one seam.

**(A) A gate with no declarable form cannot be proven by a FID.** The executor's
allowlist is deliberately narrow (never free-form shell), and the template names
the route out: make the check independently runnable (exit 0 clean / 1 with
issues) and declare it as a `probe`. The repository had never applied that route
systematically, so `eslint`, `prettier`, the frozen lockfile install, the SDK
build, the CLI bundle resolution, the version sync, the provider census, the
design-system token freshness, the release pre-audit, the eval tier rehearsal,
the CI build chain and the governance smoke were all enforced but
**un-recordable**. A FID whose subject was any of them could not declare the gate
that proves it.

**(B) Nothing refused the regression.** The failure mode is not the gates that
existed when this was noticed; it is the NEXT contract gate nobody declares. With
no audit, a new gate added to the root gate contract is silently
undeclarable — indefinitely.

**(C) The same blindness recurs on an unrelated guard.** `validate:repository`
gained a check that no test helper may call a budgeted function without injecting
a budget (the pin-hardening follow-on from the closed FID-2026-1006-004), and
`validate:repository` can never itself be a `fid:verify` gate — it live re-runs
every active FID's declared gates (C3) and would recurse into itself (lesson,
FID-2026-0915-004). So the new guard arrived in exactly the state Task (A)
describes.

### Expected Behavior

Every gate the repository enforces is paired with the allowlisted declaration
that proves it, and the pairing is enforced rather than documented: adding a
contract gate with no audited entry fails the repository. A probe is cheap enough
that "which gate is this?" never blocks a record, and it is spawned in a way that
behaves identically under `fid:verify` and by hand. A gate that genuinely cannot
be declared (C3 recursion; a pushed commit range) is permitted **only** with a
structural reason and only for labels on an explicit permit list.

### Root Cause

- **(A)** The probe route was proven exactly once (T154's `lint-md-check.ts`) and
  treated as a one-off fix for the markdown gate instead of as the general answer
  to an undeclarable gate. Nothing enumerated the undeclarable set, so the answer
  stayed an instance.
- **(B)** The gate contract (`scripts/validation-manifest.ts`) is consumed by the
  validator in one direction only: it runs the gates. Nothing checked that each
  gate is *expressible* in the FID vocabulary the receipt contract consumes.
- **(C)** The same root cause as (A), one layer deeper: a guard added to
  `validate:repository` is, by construction, outside the FID gate contract
  (C3 recursion), so it is only recordable through a probe of its own.

### Evidence

The vocabulary, from the executor itself — four kinds, nothing else:

```text
scripts/fid-verify.ts:41
export type GateKind = 'typecheck' | 'test' | 'probe' | 'quality'
```

The shared probe body's spawn discipline (the argv-array and `process.execPath`
rules, both of which are load-bearing on Windows):

```text
scripts/probe-runner.ts
export function runProbe(spec: ProbeSpec): number {
  const result = Bun.spawnSync([process.execPath, ...spec.argv], {
    cwd: spec.cwd ?? REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    ...
```

The audit's three failure directions, wired into the repository gate:

```text
scripts/validate-repository.ts
  // Every enforced gate must be expressible as an allowlisted `fid:verify`
  // declaration, or a FID whose subject is that gate cannot record the check
  // that proves it (see ./gate-declarability).
  ...collectGateDeclarabilityIssues(root),
```

The declared permit list — two labels, each with a structural reason:

```text
scripts/gate-declarability-registry.ts
export const INTENTIONALLY_NON_DECLARABLE: ReadonlySet<string> = new Set([
  'repository-validation',
  'credential-scan',
])
```

Measured shape of the audited table (29 gates; 16 of them proven by a
`scripts/probe-runner.ts` probe):

```text
$ grep -c 'label:' scripts/gate-declarability-registry.ts
29
$ grep -ln 'runProbe\b' scripts/*-check.ts | wc -l
16
```

The unrelated guard arriving in the same state, and the probe that makes it
recordable:

```text
scripts/validate-repository.ts
  // FID-2026-1006-004 pin-hardening: helpers inject budgets (./audit-test-budget-injection).
  ...collectTestBudgetIssues(root),
```

## Impact Assessment

### Affected Components

- `scripts/probe-runner.ts` (new: the shared probe body and its contract)
- Sixteen new gate probes, each a thin `scripts/probe-runner.ts` delegation:
  `scripts/{ci-build,sdk-build,cli-bundle-resolution,design-systems}-check.ts`,
  `scripts/{eslint,evals-smoke,fid-verify,lockfile}-check.ts`,
  `scripts/{prettier,protocol-bundle,provider-parity,provider-reference}-check.ts`,
  and `scripts/{release-eval-tier,release-preaudit,scripts-typecheck,version}-check.ts`
- `scripts/test-budget-injection-check.ts` (new probe for the injected-budget guard)
- `scripts/gate-declarability.ts` (new: the guard)
- `scripts/gate-declarability-registry.ts` (new: the audited table + permit list)
- `scripts/audit-test-budget-injection.ts`, `scripts/test-budget-registry.ts`,
  `scripts/test-budget-scan.ts` (new: the injected-budget guard and its scan)
- `scripts/__tests__/gate-declarability.test.ts` and
  `scripts/__tests__/audit-test-budget-injection.test.ts` (new pins)
- `scripts/validate-repository.ts` (wires both audits into the repository gate)
- `SCOPE.md` (register item T158)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Stop treating the probe route as a per-gate fix and make it the repository's
answer to every undeclarable gate, in three pieces:

1. **One probe body, many thin probes.** Every gate probe is the same program —
   spawn an allowlisted argv, relay the child's output, exit with its status — so
   the body lives in `scripts/probe-runner.ts` once and each probe declares only
   its label, argv and failure headline. That keeps a probe cheap enough that a
   new gate is never left un-recordable. Two rules are non-negotiable in the
   body: `argv` is an **array**, never shell text, and the child is spawned
   through `process.execPath`, never a bare `bun` (a bare runtime name resolves
   case-sensitively through the Windows PATH and ENOENTs when an explicit env is
   passed — the gate-env-parity class behind the v0.0.30 incident). Env is
   **inherited**, so a probe run by `fid:verify` (which exports
   `NODE_ENV=test`/`BUN_ENV=test` for every gate) behaves exactly like the same
   probe run by hand.
2. **Audit the pairing, not the prose.** `scripts/gate-declarability.ts` reads the
   audited table in `scripts/gate-declarability-registry.ts` and fails when a gate
   has no declarable form and no stated reason, when a declaration is not accepted
   by the REAL allowlist (it resolves each one with `resolveGate`, so
   "expressible" means the executor agrees — the file exists, the kind is allowed,
   the path cannot escape the repo), when a chain claims a member kind that admits
   no member (proven by resolving a real suite, not asserted), and — the direction
   that actually regresses — when a gate in the root gate contract
   (`scripts/validation-manifest.ts`) has no audited entry at all.
3. **Probe the guard that is outside the contract.** `validate:repository` can
   never be a gate (C3 recursion), so the injected-budget guard ships with its own
   probe, `scripts/test-budget-injection-check.ts`, exactly as `lint-md-check.ts`
   does for the markdown gate.

### Steps

1. Extract the shared probe body and its documented contract into
   `scripts/probe-runner.ts` (argv arrays, `process.execPath`, inherited env,
   child output relayed on failure, and the explicit prohibition on re-entering
   FID verification).
2. Express the sixteen undeclarable repository gates as thin probes over that
   body.
3. Add `scripts/audit-test-budget-injection.ts` (+ its registry and scan) and its
   probe, so the injected-budget guard is recordable.
4. Add the audited gate table and the declarability guard, with the two-label
   permit list for the gates that are structurally undeclarable.
5. Wire `collectGateDeclarabilityIssues` and `collectTestBudgetIssues` into
   `scripts/validate-repository.ts`.
6. Pin both with `scripts/__tests__/gate-declarability.test.ts` and
   `scripts/__tests__/audit-test-budget-injection.test.ts`.
7. Register the workstream (`SCOPE.md` item T158) and record it here — it was
   found unregistered in the working tree, and an unregistered workstream is an
   unowned one.

### Verification

Both pins pass against the real modules rather than a mirror: the audit test
resolves every declaration through the actual `resolveGate` allowlist and runs
one declaration through the actual executor. `scripts/scripts-typecheck-check.ts`
proves the whole scripts tree typechecks (it is the chain's 14th leg, since
`scripts` is not a bun workspace and so has no `typecheck <workspace>` form).
`validate:repository` is the integration proof.

## Verification Gates

- gate: test scripts/__tests__/gate-declarability.test.ts
- gate: test scripts/__tests__/audit-test-budget-injection.test.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: typecheck packages/agent-runtime
- gate: quality

### Verification Receipt

- fingerprint: sha256:b2040b7f6301286994513ddfb4ba1269a40bbc4784531d1f456cc28c05037233
- verified: 2026-10-07T17:30:55.008Z
- test scripts/__tests__/gate-declarability.test.ts: exit 0
- test scripts/__tests__/audit-test-budget-injection.test.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- typecheck packages/agent-runtime: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the un-recordable set was enumerated from the gate contract rather than
  guessed: every gate in `scripts/validation-manifest.ts` was paired against the
  four-shape vocabulary, and the ones with no form were listed. That list is
  longer than the two gates anyone notices (`eslint`, `prettier`) — the frozen
  lockfile install, the SDK build, the CLI bundle resolution, the version sync,
  the provider census, the design-system token freshness, the release pre-audit,
  the eval-tier rehearsal, the CI build chain and the governance smoke were all
  enforced and all un-recordable. The second RED came from the same pass's other
  work: the injected-budget guard added to `validate:repository` is, by
  construction, outside the FID gate contract.
- **GREEN:** one probe body + sixteen probes; the audited table + its guard; the
  injected-budget guard's own probe; both wired into the repository gate.
- **AUDIT:** the pins resolve through the REAL allowlist (`resolveGate`) and run a
  declaration through the REAL executor, so "declarable" is not a claim about the
  table — it is the executor's own answer. `scripts/scripts-typecheck-check.ts`
  exit 0; 19 tests pass.
- **ADVERSARIAL:** the strongest challenge is that an audit whose table it also
  owns could be self-satisfying — a gate marked "undeclarable" because nobody
  wrote a probe. Three defences are in the code, not in this prose: the permit
  list is a separate constant, so an undeclarable gate not on it fails; an empty
  reason fails; and the reverse direction (`repositoryValidationGates`) is
  generated from the contract rather than from the table, so a gate missing from
  the table is found by the contract, not by the table's own opinion of itself.
- **CHANGE DELTA:** new record (n/a).

### Missed Questions

1. **Is a probe allowed to re-enter `validate:repository`?** No, and the
   prohibition is structural rather than stylistic:
   `validate:repository` live re-runs every active FID's declared gates (C3), so
   a probe that ran it would recurse into the record that declared the probe
   (lesson, FID-2026-0915-004). The body documents the prohibition and both new
   probes state it in their own headers.
2. **Why spawn through `process.execPath` instead of `bun`?** Because the
   alternative is a gate that passes locally and fails in the release: a bare
   runtime name resolves case-sensitively through the Windows PATH and ENOENTs
   when an explicit env is passed — the gate-env-parity defect class that shipped
   green through every local gate in the v0.0.30 incident
   (`scripts/audit-gate-env-parity.ts` is its guard).
3. **Why does the probe inherit env rather than set it?** `fid:verify` exports
   `NODE_ENV=test`/`BUN_ENV=test` for every gate it runs. A probe that overrode
   env would make "the gate passed under `fid:verify`" and "the same gate passed
   by hand" two different claims, which is exactly the drift the receipts exist to
   prevent.
4. **Why is `quality` mandatory here?** The closure contract requires a `quality`
   gate on a `fixed`/`verified` record (Task 58, FID-2026-0823-009). The scripts
   tree is subject to the repository's 300-line file ceiling like everything else,
   and this work adds files to it — so the ceiling is a real risk for this record,
   not a formality.
5. **Is this a new workstream or part of T154?** Separate, and registered
   separately. T154 is complete and archived; this is the general answer to the
   class T154 was one instance of, and it arrived with a second, unrelated guard
   (the injected-budget check) that has its own upstream record
   (FID-2026-1006-004). Registering it under T154 would have buried the
   generality.
6. **Was this workstream registered before it was written?** No — it was found
   unregistered in the working tree during the 2026-10-07 closure pass. That is
   recorded here rather than quietly corrected: the record is written after the
   implementation, and the honest statement of that is the record itself plus the
   register item.
7. **Does the audit enforce that a gate is only marked undeclarable for a
   structural reason?** Not mechanically — "structural" is a judgment a reader can
   dispute. What is mechanical is narrower and stated as such: the label must be on
   the permit list, and the reason must be non-empty. The permit list is two
   entries and both are argued in the table's doc comment.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `0620e143` (implementation + this record, one path-scoped
      commit)
- [x] **File:line ranges:** `scripts/probe-runner.ts` (the body and its contract),
      `scripts/gate-declarability.ts` (`collectGateDeclarabilityIssues`),
      `scripts/gate-declarability-registry.ts` (`auditedGates`,
      `INTENTIONALLY_NON_DECLARABLE`), `scripts/validate-repository.ts` (the two
      wiring lines), `scripts/audit-test-budget-injection.ts`
      (`collectTestBudgetIssues`)
- [x] **Gate output:** both declared test files pass (19 tests, 0 fail),
      `scripts/scripts-typecheck-check.ts` PASS, `typecheck packages/agent-runtime`
      exit 0, `quality` exit 0 — all at the stamped receipt
- [x] **Reproducibility:** `bun test scripts/__tests__/gate-declarability.test.ts
      scripts/__tests__/audit-test-budget-injection.test.ts` and
      `bun run validate:repository` (clean) both name the behaviour; the audited
      table is `bun scripts/gate-declarability-registry.ts`-readable by grep
- [x] **Step statuses:** all seven steps `implemented`/verified

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output (19 pass / 0 fail across
      the two pin files; `scripts-typecheck-check PASS`; `validate:repository`
      clean with both audits wired)
- [x] Production call-graph evidence is present for new or repaired wiring:
      `collectGateDeclarabilityIssues` is referenced from
      `scripts/validate-repository.ts` and `scripts/__tests__/gate-declarability.test.ts`;
      `runProbe`/`runProbeMain` are referenced from the sixteen probe files;
      `collectTestBudgetIssues` is referenced from `scripts/validate-repository.ts`
- [x] FID status reflects the actual implementation state (`closed`: the
      implementation is in the codebase, the gates pass, and the commit is named
      above)

## Resolution

- **Closed Date:** 2026-10-07 14:40
- **Fix Description:** the probe route became the repository's general answer to
  an undeclarable gate — one shared body (`scripts/probe-runner.ts`) with sixteen
  thin gate probes over it — and the pairing between every enforced gate and the
  declaration that proves it is now audited and wired into
  `validate:repository` (`scripts/gate-declarability.ts` +
  `scripts/gate-declarability-registry.ts`, 29 gates, two structurally
  undeclarable labels on an explicit permit list). The injected-budget guard added
  to the same validator in the same period ships with its own probe
  (`scripts/test-budget-injection-check.ts`), so it is recordable too. The
  workstream was found unregistered in the working tree and is registered as
  `SCOPE.md` item T158.
- **Tests Added:** Yes — `scripts/__tests__/gate-declarability.test.ts` (the
  audited table is complete; every declaration resolves through the real
  allowlist; an undeclarable gate carries a permit-list label and a reason; one
  declaration runs through the real executor; `validate:repository` is never
  declared, and a contract gate missing from the audit is reported) and
  `scripts/__tests__/audit-test-budget-injection.test.ts`.
- **Verification Evidence:** `bun test scripts/__tests__/gate-declarability.test.ts
  scripts/__tests__/audit-test-budget-injection.test.ts` → 19 pass / 0 fail;
  `bun run scripts/scripts-typecheck-check.ts` → PASS; `bun run
  validate:repository` → clean with both audits wired; the declared gates on this
  record all exit 0 at the stamped receipt.
- **Archived:** 2026-10-07 14:40 (moved to `dev/fids/archive/`)

## Lessons Learned

1. A gate that cannot be declared cannot be proven. The executor's vocabulary is
   the real constraint on what a FID can claim, so "is this check expressible as a
   declaration?" is a first-class question about a gate, not an implementation
   detail of a record.
2. An audit must be owned by a list it does not generate. `repositoryValidationGates`
   comes from the gate contract, the audited table comes from the audit — so a new
   gate is found by the contract rather than by the table's opinion of itself, and
   the permit list for undeclarable gates is a separate constant so the table
   cannot silently permit its own gap.
3. A probe is cheap, so "this gate has no declarable form" should never be the
   answer. Making the shared body exist once is what turns the probe route from a
   per-gate fix (T154) into the repository's default.
4. Spawn through `process.execPath` and inherit env. A probe that resolves a bare
   runtime name or overrides the environment reintroduces the exact class of
   defect the release gates exist to catch, and it does it inside the mechanism
   built to catch it.
5. Work found in the tree unfinished is owned work. This workstream was complete
   and green but unregistered; the defect was not in the code but in the record,
   and registering it is the fix.
