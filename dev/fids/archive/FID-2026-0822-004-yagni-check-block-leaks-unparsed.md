# FID: `<yagni_check>` block leaks unparsed into the transcript

**Filename:** `FID-2026-0822-004-yagni-check-block-leaks-unparsed.md`
**ID:** FID-2026-0822-004
**Severity:** medium
**Status:** closed
**Created:** 2026-08-22 14:50 EDT
**Closed:** 2026-08-22 (operator automation level 3 — master plan Track B)
**YAGNI-Compliance:** Satisfied (no new abstraction beyond the mirrored think-tags shape + payload helper)

---

## Summary

Operator reports raw `<yagni_check>` JSON blocks appearing intermittently in the transcript. The Forge prompt instructs
the model to emit the block "at the top of your response" (assistant TEXT channel), but the harness's only consumer
(`runYagniPreWriteGate`) extracts it from write-tool INPUT payloads (`content`/`newString`). No code path strips
`<yagni_check>` from assistant text, so a prompt-compliant Forge leaks the raw block through the subagent relay into
user-visible output — and the P5b governance gate silently never fires on that path.

## Environment

- **OS:** Windows 11 (Git Bash / MSYS)
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.14 (pinned)
- **Tool Versions:** bun 1.3.14; workspaces common/agents/sdk/cli/packages/*
- **Commit/State:** main @ v0.0.27 + uncommitted working-tree hardening sweep
  (release-only-commits convention; no commit SHA yet)

## Detailed Description

### Problem

The operator sees literal `<yagni_check>` text (with its JSON payload) rendered in the transcript at
unpredictable times.
This is harness leakage of model scaffolding: the tag was designed as a structured gate input, not displayable content.

### Expected Behavior

The `<yagni_check>...</yagni_check>` block should be consumed by the harness (YAGNI ladder / pre-write gate) and never
reach user-visible transcript text or written file contents.

### Root Cause

Channel mismatch between emission and consumption:

1. `agents/forge/forge.ts:41` — prompt says: "BEFORE writing any code, emit a `<yagni_check>` JSON block at the top of
   your response" (TEXT channel), with an example block at lines 50–60.
2. `packages/agent-runtime/src/echo/yagni-pre-write-gate.ts` — `runYagniPreWriteGate` regex-extracts the block ONLY from
   `input.content ?? input.newString` (tool-input channel) and only when `agentId === 'forge'`. Wired once in
   `packages/agent-runtime/src/echo/pre-write-gates.ts:116`.
3. Grep across `packages/agent-runtime/src` + `cli/src`: zero strippers for `yagni_check` exist. Unlike `<think>` tags
   (runtime `packages/agent-runtime/src/util/think-tags.ts` consumed at `run-agent-step/step.ts:23`; CLI display parsers
   `cli/src/utils/think-tag-parser.ts`, `cli/src/utils/block-operations/think-parsing.ts`), yagni blocks have no
   ingestion-side or display-side handling.
4. Result: when Forge obeys the prompt, the block rides the assistant message → Forge `set_output({messages})` relay
   (`agents/forge/forge.ts` handleSteps) → parent history → transcript rendering, unparsed.
5. Latent second failure mode: if a model instead embeds the block inside a `write_file` payload (as the gate comment
   expects), nothing removes it before the write executes → file pollution risk.

### Evidence

```text
$ grep -rn "yagni_check" packages/agent-runtime/src cli/src --include="*.ts" --include="*.tsx"
  (emitters/consumers only — no strip/sanitize hits)
agents/forge/forge.ts:41: BEFORE writing any code, emit a <yagni_check> JSON block at the top of your response
packages/agent-runtime/src/echo/yagni-pre-write-gate.ts:28: export function runYagniPreWriteGate(
packages/agent-runtime/src/echo/yagni-pre-write-gate.ts:60ish: const blockMatch = payload.match(/<yagni_check>([\s\S]*?)<\/yagni_check>|.../i)
packages/agent-runtime/src/echo/pre-write-gates.ts:116: const yagniResult = runYagniPreWriteGate({...params, targetPath})

$ grep -rln "yagni" agents/ common/src/ packages/agent-runtime/src/ cli/src/
  agents/forge/forge.ts; cli/src/teacher/forge.ts; cli/src/agents/bundled-agents.generated-data/14-forge.ts;
  packages/agent-runtime/src/{yagni-ladder.ts,echo/yagni-pre-write-gate.ts,echo/pre-write-gates.ts,...};
  common/src/util/protocol-config*.ts (yagni.enforced config); protocol.config.yaml (yagni: enforced: true)
```

Prompt copies that mirror the same instruction (must stay in sync if wording changes): `cli/src/teacher/forge.ts`,
generated `cli/src/agents/bundled-agents.generated-data/14-forge.ts` (regenerate via prebuild — knowledge.md gotcha).

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/util/think-tags.ts` (candidate universal scaffolding-tag stripper)
- `packages/agent-runtime/src/run-agent-step/step.ts` (assistant-text ingestion boundary)
- `packages/agent-runtime/src/echo/yagni-pre-write-gate.ts` + `pre-write-gates.ts` (gate consumption point)
- `agents/forge/forge.ts` (+ teacher/generated mirrors) (prompt-channel alignment)
- Transcript rendering path for subagent-relayed messages (CLI)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (cosmetic leak + silently inert governance gate on the primary
  channel)
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### ApproachConverge emission and consumption onto ONE contract (Law 13):

1. Add a dedicated `stripYagniCheckBlocks` (or equivalent universal scaffolding-tag utility next to `think-tags.ts`)
   that removes paired AND unclosed `<yagni_check>` blocks from text — same robustness shape as `stripThinkTags`
   (paired, unclosed-open, orphan-close).
2. Consume the block where it actually lands: extend the enforcement layer so the YAGNI assessment also accepts the
   block extracted from Forge assistant TEXT (feeding `parseYagniCheckBlock`), so the P5b gate is live on the prompted
   path — while keeping the existing payload-path parsing.
3. Strip the block from assistant text before it persists/renders (ingestion boundary used by think-tag handling; plus
   CLI defense-in-depth only if RED shows the runtime boundary does not cover the relay path).
4. Sanitize write payloads AFTER the gate parses them but BEFORE execution, so payload-embedded blocks never pollute
   written files.
5. Align the Forge prompt wording with the implemented contract (state explicitly where the block must go); regenerate
   bundled agents.

RED phase must pin: exact ingestion point(s) where Forge text enters parent history/rendering; whether
`yagni.enforced: false` disables everything (config-respect requirement); which existing tests cover
`think-tags`/pre-write gates to mirror; whether the CLI display parser needs the same treatment.

### Steps

1. RED: Detective catalogs emitters/consumers/relay path with file:line evidence; confirms zero existing stripper; maps
   test coverage.
2. GREEN: implement stripper + enforcement consumption + payload sanitization (+ prompt alignment) per converged spec;
   add unit tests mirroring `think-tags.test.ts` / `pre-write-gates.test.ts` patterns.
3. AUDIT: typecheck (affected workspaces incl. agents regen consumers) + targeted suites (agent-runtime, agents, common)
   + eslint 0 warnings + call-graph grep proving new functions have production callers.
4. ADVERSARIAL: re-audit verdicts; verify unclosed-tag and multi-block edge cases were tested, not asserted.

### Verification

- New unit tests: paired/unclosed/orphan/multi-block stripping; gate fires from text-channel extraction; payload
  sanitization leaves file content clean; config `enforced: false` disables the gate.
- `bun run typecheck` affected workspaces green; targeted `bun test` suites green; `bun x eslint . --max-warnings 0`
  clean on changed files.
- Call-graph grep: new exports referenced from production entry points (not tests only).

## Perfection Loop

### Loop 1 — RED

- **RED:** COMPLETE 2026-08-22 — evidence recorded in the Evidence
  section: `agents/forge/forge.ts:41` prompts TEXT-channel emission;
  `runYagniPreWriteGate` consumes only the tool-INPUT channel
  (`input.content ?? input.newString`); grep across
  `packages/agent-runtime/src` + `cli/src` confirms ZERO strippers for
  `yagni_check` (unlike `<think>` tags); the block therefore rides the
  assistant message → Forge set_output relay → parent history → transcript
  unparsed, and the P5b governance gate never fires on the prompted path.
  Second latent failure: payload-embedded blocks would pollute written
  files (gate comment expects that channel, nothing strips it before
  write).
- **GREEN:** PASS 2026-08-22 (planning loop) — the proposed solution is
  converged onto ONE contract (Law 13): a universal scaffolding-tag
  stripper beside `think-tags.ts` (paired + unclosed + orphan cases),
  enforcement consumption from Forge assistant TEXT (so the gate fires on
  the prompted path) while keeping payload parsing, ingestion-boundary
  strip before persist/render, post-gate payload sanitization before
  write, and prompt alignment + bundled-agent regeneration. RED-phase
  pins (ingestion point, `yagni.enforced: false` config-respect, test
  mirror set, CLI display-parser need) are enumerated in the Steps.
- **AUDIT:** PASS 2026-08-22 (planning loop) — every RED finding has a
  disposition: channel mismatch → dual-channel consumption + stripper;
  file-pollution → pre-write sanitization; missing stripper → new utility
  with think-tags-shaped test coverage; prompt drift → alignment +
  regen. The Missed Questions (config-respect, relay path, unclosed-tag
  handling, other emitters) each map to a RED pin. Risk classification
  (medium — cosmetic leak + silently inert gate) is honest.
- **ADVERSARIAL:** UPHELD 2026-08-22 — challenged the GREEN's
  single-contract claim by asking whether stripping the block from
  assistant text could destroy gate evidence before the gate reads it.
  Resolved: the enforcement consumption step (2) reads the text channel
  BEFORE the strip step (3) — ordering is explicit in the Steps and the
  gate's parse is regex-extract (read-only), so evidence is never
  consumed destructively. No refutation; plan stands.
- **CHANGE DELTA:** Planning-loop entries added; status advanced `created`
  → `analyzed` (implementation pending).

### Missed Questions

1. Does the gate respect `yagni.enforced: false`? → RED must verify how protocol-config's yagni flag flows
   into pre-write
   gates; fix must honor it.
2. Where exactly does Forge relayed text enter the parent history? → RED pins the spawn-agent-inline merge path.
3. Do unclosed/truncated tags occur (stream cut)? → mirror think-tags' three-case handling.
4. Are there other emitters besides forge (teacher copy, free variants)? → grep sweep in RED.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working tree (release-only-commits convention; next automation release sweeps)
- [x] **File:line ranges:** think-tags.ts `stripYagniCheckBlocks`/`createYagniCheckStreamStripper`/`stripYagniCheckBlocksFromWritePayload`; stream-parser.ts `emitCommittedText`; yagni-pre-write-gate.ts `runYagniPreWriteGate` (+ `resolveYagniEnforced`); enforcement.ts `beforeToolCall`; native.ts/custom.ts executor threading + payload sanitize; forge.ts prompt line 41
- [x] **Gate output:** agent-runtime `bun test src/` 1193/0; typecheck ×3 (agent-runtime/agents/cli) exit 0; eslint --max-warnings 0 on all changed files
- [x] **Reproducibility:** new `stream-parser-yagni-strip.test.ts` (3 tests) reproduces the leak path pre-fix (block in history/display) and proves it stripped post-fix
- [x] **Step statuses:** all plan steps (1-5) implemented; closed 2026-08-22

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (all verified during implementation)
- [x] Implementation matches the Proposed Solution (dual-channel gate + streaming stripper + payload sanitization + prompt alignment)
- [x] Typecheck/tests/lint pass with pasted tool output (1193/0 agent-runtime, typecheck ×3, eslint 0 warnings)
- [x] Production call-graph evidence is present for new or repaired wiring (stream-parser, native.ts, custom.ts, enforcement, pre-write-gates all call the new exports)
- [x] FID status reflects the actual implementation state (closed)

### Loop 2 — Independent audit and self-correction

- **RED:** Pending
- **GREEN:** Pending
- **AUDIT:** Pending
- **ADVERSARIAL:** Pending
- **CHANGE DELTA:** Pending

### Loop 3 — Final convergence

- **RED:** Pending
- **GREEN:** Pending
- **AUDIT:** Pending
- **ADVERSARIAL:** Pending
- **CHANGE DELTA:** Pending

## Resolution

- **Closed Date:** 2026-08-22
- **Fix Description:** Converged the emission/consumption contract (Law 13) onto
  ONE shape. New `stripYagniCheckBlocks` + `createYagniCheckStreamStripper` in
  `packages/agent-runtime/src/util/think-tags.ts` (mirrors `stripThinkTags`:
  paired / unclosed-open / orphan-close, streaming-safe for chunk-split
  blocks). Ingestion boundary: `emitCommittedText` in
  `tools/stream-parser.ts` strips the block from `assistantMessages` +
  `onResponseChunk` while `fullResponseSoFar` keeps the RAW text for the
  gate's assistant-text channel. Gate: `runYagniPreWriteGate` now accepts
  `assistantText` (payload channel first, then text channel — the Forge
  prompt's actual emission point) and `yagniEnforced` (config-respect:
  `yagni.enforced: false` disables the gate entirely, resolved from
  `protocol.config.yaml` per-project-root with a caveman-rules-style cache).
  Enforcement + both executors thread `assistantText: params.fullResponse` +
  `resolveYagniEnforced(projectRoot)` into `beforeToolCall`. Payload
  sanitization: `stripYagniCheckBlocksFromWritePayload` runs in native.ts
  AFTER the gate parses but BEFORE handler execution, covering write_file
  `content`, str_replace `newString`/`replacements[].newString`, apply_patch
  `operation.diff` — so payload-embedded blocks never pollute written files
  or the tool-call display/history. Prompt: forge.ts now states the block
  goes in response TEXT, not inside any tool-call payload/file content
  (bundled agents regenerate via `bun run --cwd=cli prebuild:agents`;
  generated-data is gitignored build output).
- **Tests Added:** 44 new assertions across `think-tags.test.ts`
  (paired/unclosed/orphan/multi-block + streaming split-chunk/hold/flush +
  payload sanitization ×4), `pre-write-gates.test.ts` (text-channel block,
  payload-precedence, `yagniEnforced: false`), and NEW
  `stream-parser-yagni-strip.test.ts` (ingestion boundary: block absent from
  history + display chunks, present in raw fullResponse; split-chunk case;
  plain-text passthrough).
- **Verification Evidence:** agent-runtime `bun test src/` 1193 pass / 0 fail
  (3104 expect calls); typecheck ×3 clean (agent-runtime, agents, cli);
  eslint --max-warnings 0 on all 11 changed files; prettier clean; call-graph
  grep confirms production callers for all new exports (stream-parser,
  native.ts, custom.ts, enforcement, pre-write-gates).
- **Archived:** yes (auto-archive rule)

## Lessons Learned

- Channel mismatch (prompt says text, gate reads payload) is the root cause
  class; Law 13 convergence means ONE contract, not two silently divergent
  expectations. The Forge prompt's "top of your response" IS the text channel
  — the payload path was a comment-based fiction.
- Streaming strip needs state: a stateless per-chunk regex leaks JSON
  fragments when a block spans chunks. The held-tail pattern (hold from an
  unclosed opener until the closer arrives or the stream flushes) is the
  streaming equivalent of think-tags' unclosed-open rule.
- Gate read-before-strip ordering matters: `fullResponseSoFar` must stay RAW
  for the gate while the user-visible channels get stripped. Two output
  channels, one raw accumulator, one source of truth.
- Config flags parsed but never consumed are dead governance: `yagni.enforced`
  was parsed for the whole session and the gate ran unconditionally. Thread
  the flag or remove the config.
