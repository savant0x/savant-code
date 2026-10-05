# FID: Harness self-diagnosis integrity — false ENOENT, under-registering scope gate, unfalsifiable audit

**Filename:** `FID-2026-1004-006-harness-self-diagnosis-integrity.md`
**ID:** FID-2026-1004-006
**Severity:** high
**Status:** verified
**Created:** 2026-10-04 18:15
**Automation level:** 3
**YAGNI-Compliance:** Resolved 2026-10-04 — the two changes are minimal (a
stat guard; a bounded parser extension), the prose-glob fail-closed property
is retained, and no abstraction was added.

---

## Summary

Three defects in the harness's own self-diagnosis surfaces, found in a single
session, all sharing one shape: **a failure is reported with a confident,
specific cause that is wrong, and nothing in the system can tell the operator
it is wrong.** (A) the `code_search` ripgrep spawn reports ENOENT against the
vendored binary and prescribes re-fetching it, when the binary is present and
working and the cause is the `cwd`, not the executable;
(B) the Law 2 scope gate parses only the first line of each register item, so
indented continuation globs are silently dropped and the register under-covers
its own approved write surfaces; (C) the AUDIT phase of the Perfection Loop has
no mechanical check that an audit actually cited `file:line` evidence, so a
degenerate non-audit is indistinguishable from a real one in the transcript.
(B) and (A) are fail-closed — they block or mislead but cannot permit an
unapproved write or ship unverified code — which is why this is rated `high`
rather than `critical`: the soundness exposure is (C), in the double-audit
contract that Laws 1-4 rest on.

## Reviewer Digest — Every Problem Found and Every Choice Made

> Read this first if you are reviewing this work. It enumerates the complete
> session record: everything discovered, every judgement call, what is
> measured versus inferred, and the specific places a reviewer should push
> hardest. Nothing in the rest of this FID is a surprise if you read this
> section. Written for an adversarial reviewer who has not seen the
> conversation.

### The session in one paragraph

One operator request ("read the docs on how to add a provider", then "make a
new doc… and fix the runbook drift", then "make a fid to address ALL issues
found") turned into documentation authoring, and the documentation work exposed
three defects in the harness that produced the evidence. The agent never
trusted a tool's error message uncritically, which is the only reason any of
them were found: each was caught by doubting a message, not by a gate. Nine
candidate issues were catalogued — three documentation defects (repaired), one
category of four documentation gaps, four harness defects, and one that was
refuted and withdrawn. Two of the eight were caught by the repo's own gates
*after* being written, and one real defect was caught in this FID by the
Verifier. The session is unusual in that the work product under review (the
docs) and the defects discovered while producing it (this FID) are different
things, so this digest covers both.

### Problems found — complete inventory

**Documentation defects (repaired in the same session, scope item T131)**

1. **Stale fixture pointer.** The archived runbook told a contributor to copy
   the `acme` fixture when adding a provider. No such fixture exists in
   `validate-provider-registry.test.ts`; the real one is `fixture` /
   `FIXTURE_API_KEY` defined in that file's `base()` helper. The only `acme`
   record in the repo is in the unrelated custom-provider suite
   `cli/src/utils/__tests__/verify-custom-provider.test.ts`. A contributor
   following the runbook literally would have searched for a template that
   isn't there.
2. **Omitted `quota` field.** `ProviderConfig.quota` (FID-2026-0919-026) is
   live in `types.ts` and absent from the runbook's entry template. A
   contributor adding a provider with a documented balance endpoint would not
   have known the field existed.
3. **Self-contradiction on protocol-map location.** The runbook's header table
   said protocol maps live in `common/src/constants/model-config.ts` while its
   own Step 3 said `provider-protocols.ts`. Only the latter is where
   `PROVIDER_PROTOCOL_MAPS` is actually defined.
4. **Four enforcing gates entirely absent** from the archived runbook: the
   window-coverage register, the exception-kind derivation, the
   `gateway-live-results.ts` positional ladder, and `validateProviderUrlOwnership`.
   These are the substance of defects (B) and (C) below, discovered from the
   documentation side.

**Harness defects (this FID)**

5. **(A) + (C-1) — ripgrep spawn error misattributes cause.** Described above.
6. **(B) — scope-gate parser drops continuation globs.** Described above.
   Two further facts about this one that the main text understates: it bit
   during this session (see "Choices" §11), and it is already silently
   under-registering the pre-existing `T119` and `T130` items.
7. **(C-2) — a degenerate audit is indistinguishable from a real one.** The
   Verifier ran twice this session and returned a non-audit both times.
8. **(D) — `SCOPE.md` open-items header count drifted** on edit.

**Refuted and withdrawn — recorded deliberately, not dropped**

9. **Suspected unhonored `SAVANT_CODE_RG_PATH`.** I initially reported this as
   a possible second half of the same misleading message, on the reasoning that
   `packages/agent-runtime/src` has no reference to the variable. Inspection
   refuted it: `sdk/src/native/ripgrep.ts:69` honors it as candidate 1, and
   `executor.ts` reaches the resolver through `getBundledRgPath`. The absence
   of the reference in agent-runtime was a correct architectural boundary, not a
   defect. Withdrawn and the correction stated in-session rather than quietly
   dropped, because a withdrawn candidate that leaves no trace reads as a
   candidate that was never examined.

### Choices made, and why — the reviewable decisions

1. **Wrote a new doc rather than repairing the archived one in place.** The
   archived file lives under `docs/archive/`, is markdownlint-exempt, and is a
   historical record. Editing it as the primary fix would have made the live
   contract depend on a document the linter does not police. Choice: a new
   authoritative doc plus four surgical corrections plus a supersede banner.
   The archived file is `docs/archive/**`, which `.markdownlintignore` exempts —
   so a future contributor editing it gets no lint signal at all. That is a
   real residual and is **not** in this FID's scope; flagging it for the
   reviewer to judge.
2. **Placed the new doc at `docs/adding-a-provider.md`, not `docs/design/`.**
   `ECHO.md` routes design documents to `docs/design/`, but this is a how-to
   runbook, and the existing precedent for a how-to is
   `docs/gravity-integration-starter.md` at the `docs/` root. If the reviewer
   disagrees, the move is mechanical.
3. **Grounded every claim in live modules rather than the archived runbook.**
   Driven by the `archived-runbook-is-claim-not-contract` lesson. Concretely:
   I read all twelve enforcing modules 0-EOF before writing, then grep-verified
   each of the twelve factual claims in the finished doc. One failed that check
   and was corrected before shipping (below).
4. **Recorded the ENOENT mechanism as an inference, then MEASURED it.** The
   discriminator was measured first — five searches, one shared `projectRoot`,
   three directory `cwd`s succeed and two file `cwd`s fail with ENOENT — but
   "a process cannot `chdir` into a regular file" was a plausible story, not an
   observation, and the FID said so. It has since been measured directly
   (`dev/scratchpad/active/enoent-cwd-probe.ts`, spawning the vendored `rg`
   exactly as `executor.ts` does):
   - directory `cwd` → spawned, exit 0
   - **file** `cwd` (relative and absolute) → `ENOENT :: ... uv_spawn '<rg path>'`
   - **non-existent** `cwd` (control) → **byte-identical** ENOENT

   The mechanism is confirmed: `uv_spawn` rejects a non-directory `cwd` and
   reports it against the executable. The control case adds a finding the RED
   phase did not anticipate: **the message cannot distinguish a file `cwd` from
   a non-existent one** — two distinct user errors collapse into one false
   diagnosis. Step 1's `isDirectory` check catches both, because a
   non-existent path is also not a directory.
5. **Rated severity `high`, not `critical`.** The primary argument is the
   template's own rubric, not fail-closed reasoning: `critical` is defined as
   "System crash, data loss, or security vulnerability", and none of these
   qualify. `high` — "Major feature broken, no workaround" — fits. The
   fail-closed analysis is a secondary observation that supports the rating: A,
   B, and C-1 cannot permit an unapproved write or ship unverified code. C-2 is
   the soundness exposure. If the reviewer disagrees, the honest alternative is
   `medium` with C-2 tracked separately.
6. **Chose "fail with a precise error" over "silently retarget" for a file-path
   `cwd`.** Silently searching the parent directory would change what the
   caller searched without its consent — a worse failure than an error that
   costs one retry.
7. **Withdrew candidate 9 on inspection rather than leaving it in.** See above.
8. **Registered T131 and T132 in `SCOPE.md` before writing.** The Law 2 gate
   blocked the very first `write_file` — correctly. I registered the item, which
   is the protocol's answer, rather than looking for a path around the gate.
9. **Noted that my own repair reintroduces the defect it documents, and the
   operational consequence.** T132's scope-target globs are wrapped across five
   lines to satisfy MD013, and the known-defective parser therefore drops four
   of them. That is not merely cosmetic: `pre-write-gates-law2.ts` — the target
   of step 3, the parser fix itself — sits on a continuation line. **Step 3's
   own edit is blocked by the defect step 3 fixes**, so the implementation order
   is constrained. Workarounds, in preference order: (a) land the parser fix
   through an already-registered path; (b) temporarily single-line T132's
   entry under an MD013-compliant short glob; (c) fix the register data before
   the code. This is the single most actionable constraint in the plan and it
   was recorded only after the Verifier named it.
10. **Wrote no implementation for this FID.** Status `created` (RED) is
    correct for FID-Bound Execution: code is written only after the FID
    converges. A reviewer checking "is the fix implemented" should expect
    **no**, by design.
11. **Routed the FID authoring through the Recorder.** The document exceeded the
    100-line escalation threshold. The content is mine; only the write was
    delegated, per the operator directive.
12. **Recorded the Verifier's degenerate output as evidence for C-2 rather than
    dismissing the run.** The first two Verifier invocations produced no
    `file:line` citations. A third, given the digest's content inline and asked
    for verdicts rather than file reads, returned a substantive audit with four
    FAILs and two WEAKs — all of which were correct and are now fixed. What
    that justifies is narrower than "the role earns its keep": the useful
    signal came from giving it the evidence directly, not from any tool
    behaviour. The earlier invalid-workspace catch would also have been caught
    mechanically by `fid-verify` at close, so it should not be counted as
    evidence for the Verifier's value. The defensible conclusion is narrower:
    fix its evidence contract, and do not treat the role as a substitute for a
    tool-mediated check.

### Gates that fired at this work — evidence the process works

Recorded because a reviewer should know these were real blocks, not ceremony.

| Gate | What it caught |
|---|---|
| Law 2 write-time scope gate | First `write_file` blocked — no registered scope item covered the new doc path |
| Law 2 scope gate (second block) | Blocked a path the agent's own item listed, because the glob sat on a continuation line — i.e. it caught defect (B) in the act |
| Law 1 read-before-touch | Blocked an edit to `docs/adding-a-provider.md` because the file had been written earlier in the session without being read back first |
| `scope-register-check` | The new FID had no `SCOPE.md` line |
| `lint:md` MD013 | Three long lines in the FID, then a 254-column `SCOPE.md` entry |
| Verifier AUDIT | `gate: typecheck agent-runtime` — not a valid `VALIDATION_WORKSPACE_POLICY` identifier (correct: `packages/agent-runtime`) |
| Law 4 reachability probe | Ran and returned **no** edges — every touched file reported "not present in the indexed snapshot", blast radius none, bounded by index freshness. Expected for docs-only work, but recorded so a reviewer knows Law 4 was attempted and empty rather than skipped. |

### Corrections made before completion — for the reviewer to check

Each of these is a place the work was wrong first and fixed second. All are
verifiable in the tree.

1. The new doc initially cited `createOpenAI().responses()` as the
   single-protocol serving path. The factory actually calls `openai.responses()`
   on a client built from the registry `baseUrl`, and `resolveEntryProtocol`
   lives in the SDK factory rather than `common`. Corrected.
2. The FID's first draft declared `gate: typecheck agent-runtime`. The correct
   identifier is `packages/agent-runtime` (`scripts/validation-gates.ts:32`);
   `fid-verify.ts:94` rejects the basename. Corrected, with the rule noted.
3. Three MD013 violations and one 254-column `SCOPE.md` line. Wrapped.
4. The archived runbook's three factual drifts. Corrected with inline notes.

### Open questions a reviewer should resolve first

1. Is the `chdir`-into-a-file mechanism right, or does the ENOENT have another
   cause? Step 1's test answers this empirically; do not implement step 1
   without it.
2. Is `high` the right severity, given three of four defects are fail-closed?
3. Does the `gateway-live-results.ts` positional-ladder warning belong in this
   FID at all, or in its own? It is a documentation gap discovered while
   reading, not a defect observed failing.
4. Is the archived-doc markdownlint exemption a gap worth a separate item?
5. Can step 5 (requiring citations in an AUDIT) be implemented at all, given
   the Verifier holds **zero tools** by contract? Evidence must be injected by
   EHEL into message history; the check would have to run against that history
   before a verdict is consumed. This is the least-designed step in the plan.

## Environment

- **OS:** win32 (Windows), shell: bash (Git Bash / MSYS)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** ripgrep 14.1.1 (rev 4649aa9700), vendored; markdownlint via `bun run lint:md`
- **Commit/State:** `main` at `403ddea9` ("docs(fids): close and archive
  FID-2026-1004-002 after the LIVE roster census"), 34 commits ahead of origin,
  dirty worktree

## Detailed Description

### Problem

Three independent observability defects surfaced in one working session. Each
was discovered by the agent doubting an error message rather than by a gate.

**(A)+(C-1) — the ripgrep spawn error names the wrong cause.**
`sdk/src/tools/code-search/executor.ts` resolves the search directory with
`path.resolve(projectRoot, cwd)`, which happily accepts a path to a *file*,
then passes it to `child_process.spawn` as the working directory. A process
cannot `chdir` into a regular file, so the spawn fails; Node surfaces this as an
ENOENT naming the **executable**. The error handler then reports that the
ripgrep **binary** could not be found at its resolved path and prescribes
`bun run --cwd=sdk fetch-ripgrep`.

Observed live: two of five parallel searches failed. The binary was verified
present (5,407,744 bytes, mode 755) and directly executable
(`ripgrep 14.1.1 (rev 4649aa9700)`). The prescribed repair would have changed
nothing. The agent's initial — and reasonable — conclusion was that ripgrep was
missing, because the message said so with a specific path and a specific fix.

The discriminator measured in-session: of five searches sharing one
`projectRoot`, the three passing a **directory** as `cwd` all succeeded
(81, 7, and 87 matches) and the two passing a **file** as `cwd` both failed.
`projectRoot` was constant across all five, isolating the per-query `cwd` as the
cause.

**(B) — the scope register under-covers its own approved write surfaces.**
`loadScopeArtifact` extracts globs with `/^- ([A-Za-z0-9-]+): (.+)$/gm`, which
anchors to the first line of each `- <item-id>: ...` entry. The register's own
convention wraps long entries onto indented continuation lines, and those lines
do not match the anchor, so their globs never reach the pattern set. Live
proof: the agent registered a four-glob entry for `T131` across three lines,
wrote the two files named on line one, and was blocked on the third —
"no approved scope item covers" — for a target its own approved item listed.

The same defect silently applies to the pre-existing `T119` and `T130`
entries, whose real write surfaces (`dev/scratchpad/active/provider-catalogs-2026-10-03/**`,
`dev/scratchpad/active/provenance-upgrade-*`, and others) sit on continuation
lines and are therefore not registered at all. Those items will hit
unexplained blocks when actioned.

**(C-2) — an audit that is not an audit is undetectable.**
The AUDIT phase requires evidence-cited findings; the Verifier agent holds no
tools and is supposed to receive tool output injected by EHEL. In this session
the Verifier returned a first-person reasoning trace about its own role
confusion with no `file:line` citations and no verdicts. Nothing in the
pipeline flagged it. It was caught only because the agent read the output
specifically hunting for citations — a check no gate performs and no contract
requires. A Verification section that asserts "verified" on the strength of such
an output is unfalsifiable.

**(D) — a documentation register drifted on edit.**
`SCOPE.md`'s "Open items" header read "**Four** items are open" while the
register body held four open items. Adding `T131` made the body five and the
header stale. Cosmetic in isolation; it is listed here because it is the same
class as (B) — a count that is maintained by hand and disagrees with the thing
it counts.

### Expected Behavior

- (A) A spawn failure caused by a non-directory `cwd` reports the `cwd`, not
  the executable, and does not prescribe a repair that cannot help.
- (B) Every glob on an approved item's lines — first or continuation — reaches
  the gate's pattern set, so the register cannot under-cover what it declares.
- (C) An AUDIT output containing no `file:line` evidence is surfaced as a
  failure rather than consumed as a pass.
- (D) The register's own count agrees with its body.

### Root Cause

All four share one root: **a value is asserted at a boundary where it was
never measured.** (A) the handler interpolates a *resolved path* it did not
stat, and attributes a generic spawn error to the first-named operand.
(B) the parser matches a line shape while the writer emits an entry that spans
lines. (C) the audit contract is enforced by the *agent's* diligence rather than
by the harness. (D) a count is asserted by hand beside the thing it counts.

### Evidence

```text
(A) error observed, verbatim:
  Failed to execute ripgrep at "C:\Users\spenc\dev\savant-code\node_modules\
  @savant-code\sdk\dist\vendor\ripgrep\x64-win32\rg.exe": ENOENT: no such file
  or directory, uv_spawn '...rg.exe'. Repair with 'bun run --cwd=sdk
  fetch-ripgrep' or set SAVANT_CODE_RG_PATH.

binary present and working:
  $ ls -la node_modules/@savant-code/sdk/dist/vendor/ripgrep/x64-win32/rg.exe
  -rwxr-xr-x 2 spenc 197611 5407744 Jul 17 15:43 .../rg.exe
  $ node_modules/@savant-code/sdk/dist/vendor/ripgrep/x64-win32/rg.exe --version
  ripgrep 14.1.1 (rev 4649aa9700)

discriminator — same projectRoot, only per-query cwd differs:
  query 1  cwd=common/src/providers                            -> OK (81 matches)
  query 2  cwd=common/src/providers                            -> OK (7 matches)
  query 3  cwd=common/src/providers/provider-exception-manifest.ts   -> ENOENT
  query 4  cwd=cli/src/utils/openrouter-models                -> OK (87 matches)
  query 5  cwd=cli/src/utils/openrouter-models/gateway-live-results.ts -> ENOENT

site — sdk/src/tools/code-search/executor.ts:
   55: const searchCwd = cwd ? path.resolve(projectRoot, cwd) : projectRoot
       (no isDirectory() check; a file path resolves fine)
  100: const childProcess = spawn(rgPath, args, {
  101:   cwd: searchCwd,
  294: errorMessage: `Failed to execute ripgrep at "${rgPath}": ${error.message}.
       Repair with 'bun run --cwd=sdk fetch-ripgrep' or set SAVANT_CODE_RG_PATH.`

(B) site — packages/agent-runtime/src/echo/pre-write-gates-law2.ts, loadScopeArtifact:
  for (const line of text.matchAll(/^- ([A-Za-z0-9-]+): (.+)$/gm)) {
    for (const glob of line[2].matchAll(/`([^`]+)`/g)) patterns.push(glob[1])
  }
  -> anchored to line start; indented continuation lines never match.

live block after a 3-line T131 entry naming a file on its continuation line:
  [ECHO Enforcement] BLOCKED: Law 2: no approved scope item covers
  "C:\Users\spenc\dev\savant-code\docs\index.md"; present it first
  (FID-2026-1001-003 step 5a).

(C-2) Verifier output this session: a first-person trace reasoning about which
  role it was playing, ending mid-word with malformed control characters.
  Zero file:line citations. No gate raised. Caught only by manual inspection.

(D) SCOPE.md header: "**Four** items are open." vs five items in the body
  after T131 was registered.
```

## Impact Assessment

### Affected Components

- `sdk/src/tools/code-search/executor.ts` — spawn cwd resolution and the `'error'` handler
- `packages/agent-runtime/src/echo/pre-write-gates-law2.ts` — `loadScopeArtifact`
- `packages/agent-runtime/src/echo/__tests__/law2-scope-gate.test.ts` —
  existing pin asserts only single-line entries, so it passes while the defect
  is live
- The AUDIT phase contract itself (`ECHO.md` → Perfection Loop FSM; double-audit definition)
- `SCOPE.md` — open-items header count

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Measure each asserted value at the point of assertion rather than interpolating
it. Concretely: stat the resolved `cwd` before spawning and report the actual
offending path; parse register entries across an item's full span rather than
its first line; and require evidence in an audit output as a checkable property
rather than an agent obligation.

### Steps

1. **Stat the search directory.** In `codeSearch`, after resolving `searchCwd`,
   verify it is a directory. On failure, return an error naming `searchCwd` and
   stating that the search directory must be a directory — never the executable
   path and never the `fetch-ripgrep` remedy, which cannot apply to that cause.
   Keep the `fetch-ripgrep` remedy only on the branch where the executable
   itself is genuinely absent (ENOENT with the cwd confirmed good), so the
   message stays truthful on both branches.
2. **Preserve the caller-facing contract.** `cwd` remains a directory-typed
   parameter. Decide explicitly whether a file path should (a) fail with the
   precise message from step 1, or (b) fall back to the containing directory.
   Choose (a): silently retargeting a caller's search scope is worse than a
   clear error, and the caller can recover in one call. Record the choice.
3. **Parse register entries across their full span.** Rewrite `loadScopeArtifact`
   to accumulate an item's backticked globs from its `- <id>:` line *and* every
   following indented continuation line, stopping at the next top-level `- ` item
   or a blank-line-followed non-indented line. Preserve the existing
   negative property the suite pins: prose that merely *mentions* a backticked
   glob outside a target entry must still contribute nothing.
4. **Re-register the affected items.** Once step 3 lands, verify `T119` and
   `T130` in `SCOPE.md` resolve every path their prose authorizes, and correct
   any that do not. This is a data fix riding the parser fix; do it in the same
   pass so the register is truthful the moment the parser stops dropping lines.
5. **Make a non-audit detectable.** Add a mechanical check on AUDIT output that
   requires at least one `file:line` citation (or an explicit `NEEDS-REVIEW`
   naming an out-of-reach screen) before an audit verdict can be consumed as a
   pass. An audit with no citations is a failure of the audit, not a pass.
   Keep the failure message naming the artifact so the operator can see which
   audit was empty. **Status: BLOCKED pending a presented design.** Operator
   ruling 2026-10-04 (verbatim in the Loop-1 AUDIT section) forbids removing
   or routing around the Verifier agent; the check must bind verdict quality
   at the consumption seam with the role intact.
6. **Correct the register count.** Bring `SCOPE.md`'s "Open items" header back
   into agreement with its body.

### Verification

Two promised test artifacts, each declared as a `test` gate below:

- New `sdk/src/tools/code-search/__tests__/cwd-resolution.test.ts` — a file-path
  `cwd` yields an error naming the search directory and NOT containing
  `fetch-ripgrep`; a directory `cwd` still spawns; a genuinely absent executable
  still produces the `fetch-ripgrep` remedy.
- Added pins to `packages/agent-runtime/src/echo/__tests__/law2-scope-gate.test.ts` — a
  multi-line register entry contributes globs from every line; the existing
  "prose mentioning a stray glob contributes nothing" property still holds.

Declared gates: `typecheck agent-runtime`, `typecheck sdk`, both test paths,
the `scope-register-check` probe, and the repo-wide `quality` gate.

> Workspace names are the exact `VALIDATION_WORKSPACE_POLICY` identifiers
> (`scripts/validation-gates.ts`), not directory basenames —
> `fid-verify.ts:94` rejects anything else with "unsafe typecheck workspace".
> Corrected from `agent-runtime` during the Loop 1 AUDIT (the Verifier caught
> this; `packages/agent-runtime` is the declared identifier).
>
> `sdk/src/tools/code-search/__tests__/cwd-resolution.test.ts` was a promised
> artifact of this FID: `safeRepoPath` requires existence, so the gate
> resolved only once GREEN created the file. It now exists and passes; the
> receipt contract (FID-2026-0918-006) binds the promise to the file at
> `fixed`/`verified`.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: typecheck sdk
- gate: test packages/agent-runtime/src/echo/__tests__/law2-scope-gate.test.ts
- gate: test sdk/src/tools/code-search/__tests__/cwd-resolution.test.ts
- gate: probe scripts/scope-register-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:1d2dbdfd21898d7af218620ad73d7b381c866135f551db08d367e68fd5fde2ec
- verified: 2026-10-04T23:52:24.683Z
- typecheck packages/agent-runtime: exit 0
- typecheck sdk: exit 0
- test packages/agent-runtime/src/echo/__tests__/law2-scope-gate.test.ts: exit 0
- test sdk/src/tools/code-search/__tests__/cwd-resolution.test.ts: exit 0
- probe scripts/scope-register-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Nine candidate issues catalogued from one session (three
  documentation defects, one category of four documentation gaps, four harness
  defects, one refuted); F withdrawn after
  inspection refuted it (`ripgrep.ts:69` honors `SAVANT_CODE_RG_PATH` as
  candidate 1, so that half of the repair message is accurate). Five remain:
  the two code defects with reproduced evidence, the audit-soundness gap, the
  register-count drift, and the two existing scope entries already under-
  registering.
- **GREEN:** Proposed fix per step above; each step names the module and the
  symbol it changes.
- **AUDIT:** Passed 2026-10-04. Both required properties hold in the
  implementation: the `cwd` check fails closed (  `executor.ts:73` returns a
  named error before spawn; the `fetch-ripgrep` remedy survives only on the
  `error` branch at `executor.ts:263`, which a bad `cwd` can no longer
  reach), and the parser keeps rejecting stray prose globs (continuation
  stops at blank lines and non-indented text; pinned at
  `law2-scope-gate.test.ts:203`). Double audit: Method 1 = the declared gates
  run live this session, all exit 0 (recorded under Implementation Evidence
  → Gate output). Method 2 = re-read of both changed modules against the
  Proposed Solution, citations `executor.ts:32,80,332` and
  `pre-write-gates-law2.ts:79,85,99`; tests `cwd-resolution.test.ts` 3/3 and
  `law2-scope-gate.test.ts:186,194,203` 16/16. Law 4 reachability:
  `codeSearch` is reached from `sdk/src/run/tool-call.ts:19,197`;
  `loadScopeArtifact` → `runLaw2Gate` (`pre-write-gates-law2.ts:165`) →
  `pre-write-gates.ts:40,130`.
- **ADVERSARIAL:** Operator ruling recorded 2026-10-04, verbatim: "before
  you even waste your time, im not going to approve a removal of my verifier
  agent." Effect on this FID: step 5 may NOT remove, weaken, or route
  around the Verifier role. Any step-5 design binds verdict QUALITY at the
  consumption seam, with the verdict text itself as the audited artifact
  and the role intact.
- **CHANGE DELTA:** n/a (this is the RED document)

### Missed Questions

1. *Should a file-path `cwd` fail or silently retarget?* Answered in step 2:
   fail. Retargeting changes what the caller searched without consent, which is
   a worse failure than a clear error, and an error costs one retry.
2. *Is the ENOENT-on-spawn mechanism actually `chdir`-into-a-file?* This is a
   well-supported inference from the measured discriminator, not a directly
   observed `chdir` failure. Step 1's test makes it observable: if the
   isDirectory check does not eliminate the failure, the mechanism is something
   else and the pin will fail, which is the correct outcome for an unproven
   causal story.
3. *Does the fallback `PATH` probe (candidate 7) also fail on a bad cwd?* Yes —
   `cwd` is a property of the spawn, not of the binary, so no resolver ordering
   change can rescue it. Recorded so a future contributor does not try to fix
   this in the resolver.
4. *Could step 3's parser change let prose inject a glob?* That is the
   fail-open risk, answered in the Loop 1 AUDIT note: continuation accumulation
   must stop at the next top-level item and at non-indented text, and the
   existing stray-prose pin is the regression guard.
5. *Should the AUDIT-evidence check be a gate or a convention?* A gate, because
   the defect exists precisely because it was a convention. The check is small:
   require a citation or an explicit `NEEDS-REVIEW` before consuming a verdict.
   **BLOCKED 2026-10-04** pending a design presented under the operator
   ruling that the Verifier agent itself is not negotiable (recorded verbatim
   in the Loop-1 AUDIT section).

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending — closure is the operator's act (G2); the
      verified tree is uncommitted by standing rule.
- [x] **File:line ranges:** `sdk/src/tools/code-search/executor.ts:25-34`
      (`isExistingDirectory`), `:73-83` (named not-a-directory error before
      spawn), `:263-271` (remedy confined to the executable-absent branch),
      plus the quality-ceiling extraction this pass required:
      `sdk/src/tools/code-search/child-kill.ts` (escalating kill, 54 lines)
      and `sdk/src/tools/code-search/close-payload.ts` (close-event terminal
      payload, 75 lines) — behavior verbatim, full sdk suite 589/0 after;
      `packages/agent-runtime/src/echo/pre-write-gates-law2.ts:79-110`
      (continuation-span parser; `:85` item head, `:99` bounded continuation
      loop); tests `sdk/src/tools/code-search/__tests__/cwd-resolution.test.ts`
      (3 tests) and
      `packages/agent-runtime/src/echo/__tests__/law2-scope-gate.test.ts:186`
      (continuation collection), `:194` (stop conditions), `:203`
      (stray-prose fail-closed).
- [x] **Gate output:** 2026-10-04 session, all exit 0 —
      `bun run --cwd=sdk typecheck`;
      `bun run --cwd=packages/agent-runtime typecheck`;
      `bunx eslint sdk/src/tools/code-search packages/agent-runtime/src/echo
      --max-warnings 0`;
      `bunx prettier --check sdk/src/tools/code-search
      packages/agent-runtime/src/echo SCOPE.md
      dev/fids/FID-2026-1004-006-harness-self-diagnosis-integrity.md`
      ("All matched files use Prettier code style!");
      `cd sdk && bun test
      src/tools/code-search/__tests__/cwd-resolution.test.ts` → 3 pass /
      0 fail / 8 expect();
      `cd packages/agent-runtime && bun test
      src/echo/__tests__/law2-scope-gate.test.ts` → 16 pass / 0 fail / 30
      expect(); `bun run scripts/scope-register-check.ts` → "scope-register
      PASS (0 issues)"; `bun run lint:md` → exit 0; full sdk suite
      `cd sdk && bun test src/` → 589 pass / 0 fail / 1 POSIX-only skip;
      `bun run quality:report` → "PASS (1498 baselined files)". During the
      receipt run, `quality` first FAILED (executor 342 lines > 300) and was
      fixed by the extraction above, not suppressed.
- [x] **Reproducibility:** run the eight commands above on the working tree;
      the ENOENT discriminator is re-derivable via
      `dev/scratchpad/active/enoent-cwd-probe.ts` (directory cwd spawns;
      file and non-existent cwds return the identical `uv_spawn` ENOENT).
- [x] **Step statuses:** step 1 `implemented`; step 2 `implemented` (fail
      with a precise error — `cwd-resolution.test.ts` pins the refusal and
      the absence of the re-fetch remedy); step 3 `implemented` (parser
      re-read 0-EOF plus 3 new pins; stray-prose property preserved); step 4
      `implemented` (probe: 5 continuation globs RECOVERED, retired `T130`
      globs correctly ABSENT — 2026-10-04 handoff evidence;
      `scope-register-check` PASS); step 5 **BLOCKED** pending a presented
      design under the operator ruling recorded in the Loop-1 AUDIT section;
      step 6 `implemented` (the register's open-items count agrees with its
      body, verified in the 0-EOF register read).

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (verified by grep this session)
- [x] Implementation matches the Proposed Solution (re-read 0-EOF
      2026-10-04; steps 1-4 and 6 as proposed; step 5 blocked as recorded)
- [x] Typecheck/tests/lint pass with pasted tool output (Implementation
      Evidence → Gate output)
- [x] Production call-graph evidence present for the new checks
      (`tool-call.ts:19,197`; `pre-write-gates.ts:40,130`)
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** pending
- **Fix Description:** pending
- **Tests Added:** pending
- **Verification Evidence:** pending
- **Archived:** pending

## Lessons Learned

Confirmed against the fix (2026-10-04). Lesson 1: **an error message that
names a specific cause is held to a higher standard than one that says
"something failed."** The ripgrep message named a path, a reason, and a fix,
and all three were wrong; that specificity is what made it believed. The fix
keeps the specificity but makes it truthful: the not-a-directory branch names
the searched path and never suggests `fetch-ripgrep`, which now appears only
where it can apply. The scope gate is the same shape — it reported coverage
confidently while parsing a fraction of the file; the continuation parser now
covers the register's own written shape, with the stray-prose pin as the
fail-closed guard. Lesson 2, recorded for the harness: **a byte the write
tools cannot produce will be reported as the author's formatting failure** —
`write_file` dropped the trailing newline and `str_replace` could not add
one, while prettier's message blamed the file. The one-byte defect cost the
previous session its close; the repair was the repo's own formatter.