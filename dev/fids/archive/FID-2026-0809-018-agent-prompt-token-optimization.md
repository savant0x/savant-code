<!-- markdownlint-disable MD013 -->

# FID: Agent Prompt Token Optimization

**Filename:** `FID-2026-0809-018-agent-prompt-token-optimization.md`
**ID:** FID-2026-0809-018
**Severity:** medium
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Implementation status:** Implemented under the operator's automation level 3 grant (FID-2026-0809-012
> program). Independent Nova implementation sign-off is requested separately via the program audit.

---

## Summary

FID-2026-0806-003 delivered protocol-side compression and the `ContextCompactor` runtime; the
**agent prompt payloads themselves** remain the largest per-session token expenditure. The
2026-08-09 audit measured:

| Payload | Size | Notes |
|---|---|---|
| `agents/savant/system-prompt.ts` | 16,772 B | session-init + laws + tool guidance |
| `agents/savant/prompts.ts` | 15,010 B | prompt builders |
| `agents/context-pruner/main.ts` | 29,039 B | serialized `handleSteps` generator |
| `agents/tmux-cli/prompts.ts` | 7,441 B | interaction prompts |

The Savant agent alone ships ≈31 KB of prompt before any user turn. This FID measures and trims
prompt payloads **without changing agent behavior**, using the full suite + differential harness as
the backstop.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript monorepo; Bun; agents shipped via generated bundles
- **Tool Versions:** Bun project contract `1.3.14`; TypeScript 5.5.4
- **Commit/State:** `main`; working tree at pending `0.0.23`
- **Protocol:** Single-agent ECHO adaptation `dev/echo-v0.1.2-single-agent.md`
- **Approval state:** Operator automation level 3 granted; Nova implementation sign-off **PASS** (2026-08-09)

## Detailed Description

### Problem

Agent system prompts and prompt builders are the dominant per-session token cost. FID-2026-0806-003
optimized *runtime* context handling (compaction, compression config, YAGNI ladder) but did not
reduce the *static* prompt payloads shipped with each agent definition.

### Evidence

```text
$ wc -c agents/*/system-prompt.ts agents/*/prompts.ts agents/*/main.ts
  29039 agents/context-pruner/main.ts      (serialized handleSteps generator)
  16772 agents/savant/system-prompt.ts
  15010 agents/savant/prompts.ts
   7441 agents/tmux-cli/prompts.ts
```

- `agents/savant/system-prompt.ts` + `agents/savant/prompts.ts` ≈ 31 KB — the largest single-session
  token payload.
- Prompts are built at definition-build time and embedded into the generated bundle
  (`cli/src/agents/bundled-agents.generated.ts`, regenerable via `scripts/prebuild-agents.ts`), so
  trimming is safe as long as the regenerated bundle and behavior tests stay green.

### Impact Assessment

- [ ] Critical
- [ ] High
- [x] Medium: token cost reduction; behavior must be preserved
- [ ] Low

### Proposed Solution

1. Measure baseline: token count of each shipped prompt (via `gpt-tokenizer` or byte-to-token
   estimate) recorded in the FID.
2. Identify removable boilerplate: duplicated law text, redundant guidance between
   `system-prompt.ts` and `prompts.ts`, repeated tool descriptions, verbose framing.
3. Trim conservatively (target ≥10% reduction) with **no semantic change**: keep every behavioral
   instruction, law, tool contract, and gate.
4. **Sequence with FID-015 (Loop-2 correction):** `agents/context-pruner/main.ts` (29,039 B) is
   ALSO a FID-015 Batch-A decomposition target. Implementation order is FID-015 first: after the
   split, re-measure and trim the *shipped serialized payload* (the regenerated bundle), not the
   decomposed `main.ts` file size. If FID-018 must precede FID-015, declare FID-018 the owner of
   `context-pruner/main.ts` and exclude it from FID-015's batch.
5. Regenerate `bundled-agents.generated.ts` via `scripts/prebuild-agents.ts`.
6. Verify: agents tests (5), prebuild output regenerable, CLI/SDK/agent-runtime suites green,
   differential prompt-snapshot check vs pre-change for semantic equivalence.

### Steps

1. Baseline token measurement per prompt payload.
2. Draft trim (boilerplate only); review diff for semantic equivalence.
3. Regenerate bundle; run full affected suites.
4. Record before/after token counts in the FID.

### Verification

- Measured token reduction (target ≥10%) — **achieved: −1,301 tokens (−10.1%) on the shipped
  payload**; −9.0% on raw source files (the delta is the context-pruner comment tokens that Bun
  strips at transpile and never ships).
- `scripts/prebuild-agents.ts` regenerates `bundled-agents.generated.ts` cleanly — verified
  (616,267 B → 568,348 B).
- Agents suite 44/44; agent-runtime 761 + SDK 461 + common 557 all green; CLI typecheck exit 0.
- ESLint `--max-warnings 0`, Prettier clean on all touched files.
- Differential check: behavioral instructions all present — see Semantic-equivalence section above.

## Perfection Loop

### Loop 1 — RED

- **RED:** Agent prompt payloads total ≈31 KB for the Savant agent (plus 29 KB context-pruner, 7.4 KB
  tmux) with no token-optimization pass ever applied to the static prompt layer.
- **GREEN:** Measure → trim boilerplate only → regenerate bundle → verify suites + semantic
  equivalence. Target ≥10% reduction with zero behavior change.
- **AUDIT:** Sizes measured from the live tree; prompt build path traced
  (`agents/savant/{system-prompt,prompts}.ts` → `scripts/prebuild-agents.ts` →
  `cli/src/agents/bundled-agents.generated.ts`); FID-2026-0806-003 confirmed to cover runtime
  compression, not static payloads. Existing suites + regenerable bundle provide the safety net.
- **AUDIT ADVERSARIAL CHECK:** Challenged for behavioral drift risk — the FID requires a
  semantic-equivalence snapshot and full suite pass, and prohibits trimming any behavioral
  instruction, law, tool contract, or gate.
- **CHANGE DELTA:** Planning only; no prompt edited yet.

### Missed Questions

1. **Why not rewrite prompts aggressively?** → Behavior preservation is the contract; aggressive
   rewrites risk silent capability loss. Conservative boilerplate trim only.
2. **Does the 29 KB context-pruner generator count?** → It is shipped inline; it is also a
   FID-015 Batch A target. Trim only what is behavior-safe.
3. **Is the generated bundle committed?** → Yes, and regenerable — trim then regenerate.
4. **What is the target?** → ≥10% measured reduction; the FID records before/after.

### Loop 2 — Independent AUDIT correction (2026-08-09)

- **RED:** Independent review flagged dual ownership of `agents/context-pruner/main.ts` across
  FID-015 (decompose to ≤400) and this FID (trim the 29 KB prompt payload). Without sequencing,
  the two plans would invalidate each other's baselines.
- **GREEN:** Explicit sequencing added: FID-015 runs first; this FID re-measures and trims the
  shipped serialized payload after the split. Alternative: this FID owns `context-pruner/main.ts`
  and FID-015 excludes it. Either declaration resolves the overlap.
- **AUDIT:** The overlap is real (same file, both targets) and now explicit in both FIDs; the
  master FID dependency table was updated to list 015 as a dependency of 018.
- **CHANGE DELTA (Loop 3 — implementation record):** Prose payloads trimmed
  (system-prompt −632, prompts −528, tmux-cli −141 tokens); bundle regenerated;
  suites green. Context-pruner left untouched (code-only; comments do not ship).

### Code Verification Evidence

- [x] Prompt payload sizes measured (4 files) — baseline 14,491 raw / 12,906 shipped tokens.
- [x] Build path traced (agents → prebuild → generated bundle).
- [x] Operator approval — automation level 3 grant (program FID-2026-0809-012).
- [x] Nova sign-off — **PASS** (2026-08-09, `dev/nova/inbox/2026-08-09-fid-2026-0809-012-018-optimization-program-implementation-audit-response.md`).
- [x] Implementation — complete.

### Implementation Record (2026-08-09)

Conservative boilerplate-only trims applied to `agents/savant/system-prompt.ts`,
`agents/savant/prompts.ts`, and `agents/tmux-cli/prompts.ts`. Every behavioral
instruction, law, tool contract, phase gate, and spawn rule was preserved — only
verbose framing, duplicated guidance between `system-prompt.ts` and `prompts.ts`,
redundant example prose, and repeated wordings were condensed.

**Measured before/after (gpt-tokenizer, source files):**

| Payload | Before (tok) | After (tok) | Δ |
|---|---|---|---|
| `agents/savant/system-prompt.ts` | 3,839 | 3,207 | −632 |
| `agents/savant/prompts.ts` | 3,365 | 2,837 | −528 |
| `agents/context-pruner/main.ts` | 5,484 | 5,484 | 0 |
| `agents/tmux-cli/prompts.ts` | 1,803 | 1,662 | −141 |
| **Total (raw source)** | **14,491** | **13,190** | **−1,301 (−9.0%)** |

**Shipped-payload note:** `context-pruner/main.ts` ships via the transpiled
`handleSteps` generator — Bun strips comments at transpile, so its ~1,585 comment
tokens never reach the model. Honest per-session shipped baseline is **12,906**
tokens; after trims the shipped payload is **11,605** — a **−1,301 token (−10.1%)**
reduction on the metric that actually governs per-session cost, meeting the FID's
≥10% target. All trims are on the prose payloads; the code-only `context-pruner`
payload is unchanged (trimming it would be a behavior change, prohibited by this
FID).

**Bundle:** `cli/src/agents/bundled-agents.generated.ts` regenerated via
`bun run prebuild:agents` — 616,267 B → 568,348 B (−7.8%). Regeneration is clean
and byte-identical on re-run.

**Semantic-equivalence differential check:**

- Every behavioral instruction, law reference, tool contract, phase gate, spawn
  rule, and mode workflow was retained verbatim or reworded without changing its
  meaning. Only framing prose, duplicated guidance between `system-prompt.ts` and
  `prompts.ts`, redundant example narration, and repeated wordings were removed.
- The agents test suite (44 tests, including the strict-mode full-ceremony contract
  assertions and the context-pruner serialized-handleSteps eval tests) passes
  unchanged except for one canonical-wording update: `Spawn the Recorder` →
  `spawn the Recorder` (same instruction, mid-sentence grammar).

**Test gate (FID verification):**

- Agents suite 44/44 pass.
- agent-runtime 761, sdk 461, common 557 — all pass, counts preserved.
- CLI typecheck exit 0; ESLint `--max-warnings 0` and Prettier clean on all touched files.

## Resolution

- **Status:** Closed 2026-08-09 — Nova implementation audit **PASS**, independently signed off.
- **Fixed Date:** 2026-08-09
- **Commit/PR:** uncommitted working tree (pending `0.0.23`)
- **Archived:** `dev/fids/archive/`

## Lessons Learned

Token optimization has two layers: runtime context handling (compaction/compression — done in
FID-0806-003) and static prompt payloads (the per-session baseline). The static layer is measurable
and trimmable with a regenerable bundle + suite gate, but only when behavior preservation is the
explicit contract.
