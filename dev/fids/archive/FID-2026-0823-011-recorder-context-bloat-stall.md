# FID: Recorder child stalls are model-level read-then-stop under inherited mega-context, not harness gating

**Filename:** `FID-2026-0823-011-recorder-context-bloat-stall.md`
**ID:** FID-2026-0823-011
**Severity:** high
**Status:** closed
**Created:** 2026-08-23 23:55
**YAGNI-Compliance:** Pending

---

## Summary

The Recorder's third consecutive read-without-write stall (post-restart,
with the FID-2026-0823-009 path-form fix live and proven by two passing
probes) has been root-caused to **model behavior, not harness gating**: the
child never attempts `write_file` at all. Forensic signature across all
three stalls — exactly +3 messages per child run (read_files tool-call +
tool-result + one final assistant TEXT reply), durations 10–65 s, and ZERO
gate-block traces attributable to the child.

Primary driver: the Recorder definition ships `includeMessageHistory: true`
and `inheritParentSystemPrompt: true`, so every spawn inherits the ENTIRE
parent conversation — the third stall spawned at `contextTokenCount: 653811`
/ `messageCount: 2874`. The model must locate and reproduce a ~15–20 KB FID
rewrite buried in a 650K-token context; it reads the file, then ends its
turn with text instead of calling write_file (classic long-context
instruction-follower collapse).

## Environment

- **OS:** Windows (Git Bash / MSYS); Bun 1.3.14; z-ai/glm-5.3-flash
- **Commit/State:** working tree @ v0.0.27 + unreleased hardening
- **Related records:** FID-2026-0823-008 (relay guard — works, fires
  correctly every time), FID-2026-0823-009 (path-form fix — works, probes
  passed); agents/recorder/recorder.ts; debug/cli.jsonl

## Detailed Description

### Problem

Three Recorder UPDATE stalls this session (2 pre-fix, 1 post-fix with the
Law-1 canonicalization live and probe-proven). Initially attributed to the
Law-1 path-form mismatch (FID-2026-0823-009 ISSUE-02); the post-fix
reproduction DISPROVES that attribution and re-attributes all three:

ISSUE-A (high, primary): **Inherited mega-context drives read-then-stop.**

- agents/recorder/recorder.ts: `includeMessageHistory: true`,
  `inheritParentSystemPrompt: true`.
- Third-stall spawn record (debug/cli.jsonl line 4316202,
  2026-08-23T23:32:42Z): `contextTokenCount: 653811`,
  `messageCount: 2874`. Semantics: contextTokenCount is the run-context
  token count consumed by the compactor
  (packages/agent-runtime/src/context-compactor.ts:150-191); in the
  child's spawn record it reflects the inherited conversation size under
  includeMessageHistory:true.
- Child run window (log lines 4316203–4316870): Start messageCount 2874 →
  End messageCount 2877 (+3), duration ~55 s. Event-flow census over the
  window shows NO write_file/read_files dispatch events — only
  infrastructure noise (`No auth credentials...` x646, token-count
  fallbacks).
- Same +3 signature CONFIRMED on all three stalls (Start→End
  messageCount pairs, debug/cli.jsonl): #1 22:13:59Z 94→97;
  #2 22:32:34Z 2050→2053; #3 23:32:42Z 2874→2877. Corroboration:
  historical SUCCESSFUL Recorder runs show a +6 class (read pair +
  write pair, e.g. 06:42:01Z 724→730) — the +3 vs +6 delta separates
  stall from completion mechanically.
  [Verifier NEEDS-REVIEW discharged 2026-08-23: start records extracted;
  contextTokenCount semantics cited above.]

ISSUE-B (medium): **Zero gate involvement — prior attribution corrected.**

- Post-fix Law-1 blocks would quote absolute paths (pre-fix signature:
  66+4 hits). No new block traces attributable to the child.
- The 5 `before the closed transition` anti-deferral strings in the log are
  test-output/conversation echoes — awk co-occurrence check
  (`index($0,"before the closed transition") AND index($0,"FID gate:")`)
  returns ZERO lines containing both; real blocks always carry the
  `FID gate:` prefix.
- Gate-code audit concurs: receipt tripwire keys on `fixed|verified` only
  (fid-validator.ts VERIFIED_STATUSES); anti-deferral saw all-`[x]` rows.

ISSUE-C (medium, contributing): **Spawn-prompt shape.** All three stalls
used edit-instructions prompts ("apply EXACTLY these edits") instead of
ECHO.md's documented Recorder contract ("write_file with the COMPLETE
updated content below") — asking the model to compose a merged multi-KB
document from instructions inside a 650K-token context. Contributing
factor, not sole cause: the documented pattern is also untested against
mega-context.

ISSUE-D (low, secondary): **Deterministic retry.** The -008 relay guard
correctly relays the stall as retryable, but re-spawning an IDENTICAL
prompt reproduces identical behavior — retries without variation waste
spawns.

### Expected Behavior

A Recorder UPDATE spawn: reads the target, then calls write_file with the
complete updated content, in one short focused context — regardless of
parent conversation size.

### Root Cause

`includeMessageHistory: true` imports the whole parent conversation into a
specialized single-purpose child. Long-context instruction degradation plus
a compose-from-instructions prompt shape yields a final TEXT turn with no
tool call. The -008 guard faithfully reports what the harness then knows:
no write occurred.

## Impact Assessment

### Affected Components

- agents/recorder/recorder.ts (includeMessageHistory /
  inheritParentSystemPrompt)
- Spawn-contract documentation (ECHO.md "Spawning the Recorder")
- Any bundled agent with includeMessageHistory:true spawned late in long
  sessions (audit at GREEN)

### Risk Level

- [ ] Critical
- [x] High: the FID-lifecycle agent is unreliable in long sessions;
      workaround exists (Orchestrator direct writes per operator directive)
      but violates documented SoD convention when used routinely

## Proposed Solution

### Approach (sketch — GREEN must confirm)

A) Kill the bloat driver: flip `includeMessageHistory: false` (+ evaluate
   `inheritParentSystemPrompt`) so each spawn gets system + spawn prompt +
   step prompt only. MUST first trace the scaffold-seal path: the
   handleSteps generator scans agentState.messageHistory for the
   set_scaffold_complete signal — verify that signal reaches the child
   another way (or thread it via spawn params) before flipping.
B) Harden the instructionsPrompt with a terminal-condition contract
   ("ending your turn without a successful write_file is a failed run").
C) Spawn-discipline rule (documentation): UPDATE spawns carry COMPLETE
   merged content, never edit-instructions.
D) Optional: -008-guard-aware retry ladder — one retry with a corrective
   suffix naming the failure, instead of identical re-spawns (ISSUE-D).

### Verification

Live Recorder UPDATE spawn completes a real write in a LONG session
(post-restart, post-fix); offline: recorder-definition unit assertions +
focused suites green; eslint --max-warnings 0.

## Perfection Loop

### Loop 1 — RED (2026-08-23)

- Forensics (all debug/cli.jsonl ground truth):
  - Stall #3 (probe 2): Start record line 4316202 (23:32:42Z,
    contextTokenCount 653811, messageCount 2874); End record line 4316870
    (messageCount 2877); event-window census lines 4316203–4316870: zero
    tool-dispatch events.
  - Stall #1/#2 End records: messageCount 997 / 2053 — same +3 class.
  - Gate-exclusion sweeps: `has not been read` count stable at pre-existing
    volume; zero interpolated `FID gate:` runtime blocks; awk
    co-occurrence test (closed-transition phrase vs `FID gate:`) = 0 rows.
  - Probe controls: Detective optional-key spawn PASSED; Orchestrator
    read->str_replace PASSED (same session, same gates).
- Code citations: agents/recorder/recorder.ts (includeMessageHistory/
  inheritParentSystemPrompt/handleSteps scaffold scan);
  packages/agent-runtime/src/echo/fid-validator.ts (VERIFIED_STATUSES =
  fixed|verified — closed not receipt-gated);
  packages/agent-runtime/src/echo/pre-write-gates.ts:196-210 (tripwire
conditionality).

### Loop 1 — GREEN (2026-08-23)

- **Scaffold-signal trace (safety gate for the flip):** the seal signal is
  the parent run's set_scaffold_complete tool-result, detected by the child's
  handleSteps messageHistory scan — only reachable because of
  includeMessageHistory:true. The CLI HYBRID revert itself is independent
  (cli/src/hooks/use-scaffold-revert-subscriber.ts watches the tool block).
  Replacement channel implemented: Orchestrator threads
  params.scaffoldComplete; handleSteps ORs it with the legacy history scan
  (backward compatible).
- **Fix landed:** agents/recorder/recorder.ts — includeMessageHistory:false;
  instructionsPrompt gains the Turn Contract terminal condition + the
  seal-via-prompt contract on responsibility #5. Bundle regenerated
  (bun run --cwd=cli prebuild:agents).
- **Gates:** bun run --cwd=agents typecheck exit 0; bundle regen + bun run
  --cwd=cli typecheck exit 0; bun x eslint agents/recorder/recorder.ts
  --max-warnings 0 exit 0. Self-correction during GREEN: first str_replace
  batch introduced unescaped backticks (L33), a double comma (L108), and
  indentation loss — caught by typecheck, fixed via clean full-file rewrite.
- **Live probe cycle 1 (~20:15 EDT, honest result):** stalled again —
  PREDICTED, since the running harness predated the fix (see the LIVE PROBE
  loop section below for the definitive post-restart probe result).
  Definitive verification: restart harness, re-run one Recorder UPDATE.

### Loop 1 — LIVE PROBE (2026-08-24 ~01:03 UTC, post-restart)

- **Probe:** one real Recorder UPDATE spawn against this very FID using the
  documented contract shape (COMPLETE updated content supplied in the spawn
  prompt; read_files → write_file; Turn Contract active in the child
  instructions). Harness provenance: bundle module 17-recorder.ts regenerated
  20:58 EDT carrying includeMessageHistory:false + Turn Contract +
  params.scaffoldComplete; harness restarted ~20:59 EDT — the running
  process provably loaded the FIXED definition.
- **Result: STALLED AGAIN — honest negative result.** Forensics
  (debug/cli.jsonl, child runId 68b05b9c, agentId MUrWunl6Cv8, Start/End
  records @ 01:03:03Z/01:03:11Z): `contextTokenCount: 30343` (BOUNDED —
  vs 653811/873090 inherited in stalls #1–#3), messageCount 2→5 (+3),
  duration ~7.8 s, ZERO tool-dispatch events and ZERO gate-block traces in
  the child window. Disk ground truth: this file unchanged by the probe;
  -008 relay guard fired (`Recorder stalled: read without write`).
- **Verdict split:**
  - Fix MECHANISM proven: includeMessageHistory:false yields a bounded,
    parent-size-independent child context. The bloat driver is dead.
  - Behavior NOT fixed: read-then-stop persists in a short focused context
    WITH complete supplied content — ISSUE-A (mega-context) is an
    AMPLIFIER, not the sole root cause. Residual hypotheses: (a) the
    UPDATE-workflow shape (read first, then modify+write) invites a
    narrated plan instead of an immediate write call; (b) model-level
    turn-end behavior after the read completes. Corroborating log record:
    an unrelated stream's probe at 00:22 UTC stalled identically (+3,
    contextTokenCount 873090 — pre-fix definition).
- **Boundary status: REMAINS OPEN** — reclassified from restart-gated
  NEEDS-REVIEW to behavioral; the restart happened and the definitive probe
  ran. Next candidate experiments: CREATE-shape spawn ("do NOT read;
  write immediately" — content fully supplied makes the read unnecessary)
  and/or the -008-guard-aware corrective retry ladder (ISSUE-D).

### Loop 1 — LIVE PROBE 2 (2026-08-24 ~02:04 UTC, CREATE shape)

- **Probe:** real Recorder CREATE spawn ("do NOT read any files first —
  call write_file IMMEDIATELY") targeting an ephemeral probe marker
  (FID-2026-0823-013, deleted same-day). Forensics (child runId 187b129e,
  agentId MYKnwSR7RW0, Start/End @ 02:04:01Z/02:04:32Z):
  contextTokenCount 26178 (bounded), messageCount 2→5, duration ~30 s.
- **Result: THE WRITE SUCCEEDED — and the relay LIED.** Disk ground truth:
  the probe file exists byte-exact as supplied; child-window census shows
  the `write_file` dispatch with an SDK-ABSOLUTIZED path
  (`C:\…\dev\fids\FID-2026-0823-013-…`) and `"processFileBlock: Created
  new file …"`. Yet the -008 relay guard fired a stall.
- **NEW DEFECT surfaced (FID-2026-0823-014):** the guard's raw-prefix check
  (`startsWith('dev/fids/')`) missed the absolutized write → successful run
  falsely relayed as a stall. Same path-form class as -009 ISSUE-01; fixed
  in -014 via canonicalizePath + repo-root scoping.
- **ISSUE-C verdict: SUPPORTED.** Under CREATE shape the model wrote
  immediately in one shot with zero reads — the read-first UPDATE shape is
  a major contributor to the stall behavior. UPDATE spawns should carry
  complete content AND consider instructing immediate write where safe.
- **Ladder observation:** single child-run pair — the -012 corrective
  ladder did not fire because the running harness predates its
  implementation (restart-gated, standard cycle). Note: had it fired here,
  the corrective retry would have been WASTED on an already-successful run
  due to the -014 false positive — the two defects compound.

### Loop 1 — LIVE PROBE 3 (2026-08-24 ~02:19 UTC, post-restart: ladder + guard live)

- **Probe:** UPDATE-shape Recorder spawn against a pre-seeded marker v2
  (FID-2026-0823-013 recreated, deleted same-day), after a harness restart —
  provenance PROVEN behaviorally: the -012 ladder fired.
- **Ladder VERDICT: LIVE AND CORRECT.** Two child runs (debug/cli.jsonl,
  stable pointers: attempt-1 Start/End at lines 4478307→4478592, attempt-2
  Start/End at lines 4478607→4478707): attempt 1 (runId 277accb7 /
  MZBNt4Q_7aE, Start @ 02:18:55Z, contextTokenCount 26248, +3) stalled;
  attempt 2 (runId 6d8eda21 / MZCMWtN7xmA, Start @ 02:19:11Z,
  contextTokenCount 26399, fresh agentId) carried the FULL CORRECTIVE RETRY
  block naming the exact relay reason; exhausted ladder then relayed
  errorMessage honestly. Exactly the designed bounded behavior.
- **Behavioral VERDICT: STALL PERSISTS DESPITE THE CORRECTIVE SUFFIX.**
  Both attempts ended read-then-stop (+3) in bounded ~26K contexts; disk
  ground truth: marker unchanged (v1 content, zero matches for the v2
  marker line). The failure-naming suffix did not change the outcome this
  round — ISSUE-D's premise ("retries without variation waste spawns") is
  only half-right: even WITH variation the model still stops after reading.
  The remaining lever is shape-level: CREATE-shape writes succeed (LIVE
  PROBE 2), so UPDATE-shaped work may need a write-first contract or
  handleSteps-level enforcement rather than prompt-level correction.
- **Evidence pointers (closure-audit follow-up):** both runIds re-grepped
  post-edit — `"runId":"277accb7-…"` and `"runId":"6d8eda21-…"` each match
  exactly one debug/cli.jsonl record; the CORRECTIVE RETRY block is present
  in the attempt-2 End record at line 4478707. The probe marker artifact was
  deleted same-day ~22:20 EDT AFTER the disk ground-truth grep (0 matches
  for the v2 marker line) — the on-disk claim rests on that quoted grep plus
  the log window above; the artifact itself is intentionally ephemeral.
- **-014 guard:** correctly identified both runs as no-write (true
  negatives); its positive path (absolutized successful write counted) was
  exercised in LIVE PROBE 2 pre-fix and is unit-pinned in -014's regression
  net.
- **Boundary status: REMAINS OPEN (behavioral)** — mechanism fixes (-011
  isolation, -012 ladder, -014 guard) all proven live; the model-level
  read-then-stop under UPDATE shape is the sole residual.

### ADVERSARIAL

(pending — see Resolution for current admission state.)

## Resolution

Implemented + gated 2026-08-23; status `fixed`. Open boundary: (1) live
long-session Recorder UPDATE probe after one more harness restart.
DISCHARGED 2026-08-23: ECHO.md spawn-contract doc pass — Context Contract
block, scaffold-seal params channel, and the FID-011 stall-evidence mistake
line added to Spawning-the-Recorder; protocol bundle regenerated, :check
PASS, markdownlint clean. Boundaries carried honestly — never claimed
passed.
LIVE PROBE RESULT 2026-08-24 ~01:03 UTC (post-restart): the definitive
Recorder UPDATE spawn RAN under the provably-loaded fixed definition and
STALLED AGAIN — bounded 30K context confirmed (isolation mechanism proven),
but the child still ended without attempting write_file (zero gate blocks,
zero dispatch events, disk unchanged, -008 relay fired). The restart-gated
NEEDS-REVIEW boundary is reclassified as BEHAVIORAL and remains open; see
the LIVE PROBE loop section for the full evidence split.

CLOSED 2026-08-26 via operator waiver (fixed-with-waiver). The behavioral
boundary is PERMANENTLY ACCEPTED: three controlled probes (UPDATE stalled ×2,
CREATE succeeded ×1) plus real-world recurrences during 08-24/25 work
established that prompt-level levers (Turn Contract, complete-content
contract shape, corrective retry suffix naming the exact failure) cannot
reliably make this model execute an UPDATE-shaped write, while every harness
mechanism around it is proven live and correct. The accepted mitigation is
structural, not a workaround-in-waiting: the Orchestrator direct-write path
(operator directive 2026-08-23, hybrid-mode exception) performs FID writes
deterministically and has carried every Recorder duty since — including all
closures archived on 08-25/26. Gates fresh at closure (this session):
typecheck agents + cli exit 0 · run-programmatic-step suite exit 0 within
the 45/0 agent-runtime battery; receipt re-stamped at the archived path
(3/3 declared gates live PASS); repo-wide `fid:verify --check` sweep PASS;
archived to `dev/fids/archive/`. Honest framing: nothing here claims the
stall was fixed — it was measured, bounded, and consciously accepted.

## Step Status

- [x] Scaffold-signal path traced — signal rides parent's
        set_scaffold_complete tool-result via inherited history; CLI revert
        is independent (use-scaffold-revert-subscriber); replacement channel:
        params.scaffoldComplete threaded through handleSteps (OR'd with the
        legacy history scan)
- [x] Recorder definition fix landed — includeMessageHistory:false;
      bundle regenerated (prebuild:agents); agents+cli typecheck exit 0
- [x] InstructionsPrompt terminal-condition hardened — Turn Contract
      section + seal-via-prompt contract on responsibility #5
- [x] Spawn-contract doc updated (ECHO.md Recorder section) — Context
      Contract block + scaffold-seal params channel + FID-011
      stall-evidence mistake line added to Spawning-the-Recorder;
      bundle regenerated + :check PASS
- [x] Gates green — agents typecheck exit 0; cli typecheck exit 0 (post-
      regen); eslint --max-warnings 0 on recorder.ts
- [x] Live Recorder UPDATE probe — CLOSED VIA OPERATOR WAIVER
      (2026-08-26): the behavioral boundary is PERMANENTLY ACCEPTED. All
      three harness mechanisms were proven live (isolation `-011`, corrective
      ladder `-012`, guard canonicalization `-014`); the residual model-level
      read-then-stop under UPDATE shape is accepted as a known model
      limitation, mitigated by the operator-approved Orchestrator direct-
      write convention that has carried all Recorder duties since 2026-08-23
      (every closure this session included). Candidate future work recorded
      in Lessons Learned, not scheduled.

## Verification Gates

- gate: typecheck agents
- gate: typecheck cli
- gate: test packages/agent-runtime/src/__tests__/run-programmatic-step-undefined-yield.test.ts

### Verification Receipt

- fingerprint: sha256:04e8595c0fd8ddc7aaaa6ba8f692fbab1becdc0cf7cc8a0a578cbe9cd7071de4
- verified: 2026-08-26T04:12:47.781Z
- typecheck agents: exit 0
- typecheck cli: exit 0
- test packages/agent-runtime/src/__tests__/run-programmatic-step-undefined-yield.test.ts: exit 0

## Lessons Learned

- Isolation fixes are not behavior fixes: bounding the child's context from
  654K to 26K tokens proved the mechanism but changed nothing about whether
  the model writes. Measure the amplifier and the cause separately — they
  respond to different levers.
- Prompt-level contracts have a failure ceiling: a terminal-condition Turn
  Contract AND a corrective retry suffix naming the exact failure both
  failed to move the outcome. When two independent prompt-level levers
  fail, stop spending probes on prompting and either change the shape of
  the task or enforce mechanically (handleSteps-level turn-end guards).
- A waiver can be the honest close: three probes, a documented hypothesis
  split, and a structural mitigation that has run in production for days
  justify permanently accepting a model-behavior boundary — provided the
  record says "accepted", never "fixed".
- Candidate future work (unscheduled): shape-isolation experiment (UPDATE
  job spawned with "write immediately, skip the read") to split the shape
  hypothesis from the turn-end hypothesis; handleSteps-level enforcement
  refusing UPDATE turn-end without a write dispatch; cross-model
  generalization check.