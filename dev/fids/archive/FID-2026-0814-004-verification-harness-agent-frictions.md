<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Verification-Harness Agent Frictions — Exit-Code Compaction, Quote-Aware Shell Filter, Doc-Write Compliance Gates, Micro-Compact Config Wiring

**Filename:** `FID-2026-0814-004-verification-harness-agent-frictions.md`
**ID:** FID-2026-0814-004
**Severity:** high
**Status:** closed
**Created:** 2026-08-14
**Amended:** 2026-08-14 — deep-dive of the live A–Z session (`dev/scratchpad/compaction-deep-dive.md`) folded the micro-compact evidence-preservation + config-wiring findings (C-01…C-06) into the scope as H-05…H-07; H-01 upgraded to P0
**Amended (2):** 2026-08-14 — project-wide model unification workstream (H-08…H-12, P0/P1) added after operator directive: *the model selected in the UI panel is the ONLY model used project-wide — headless, sub-agent, or bundled default, no exceptions, never a paid hardcode*
**YAGNI-Compliance:** Verified — reuses the existing micro-compactor tool-result slot, the existing `isReadonlyCommand` validator, the existing `EchoComplianceTracker` write path, the existing `ProtocolCompressionConfig` block (already parsed), the existing `getSavantHandleSteps` factory pattern, and the existing `getSelectedSavantFreeModel()` UI store (already the panel + billing source); adds no new store, no new scheduler, no new polling, no new config keys; the only new helper is a single `resolveActiveModel()` accessor
**Depends On:** none (harness UX defects cataloged by the agent that executed `dev/test-prompts/az-v0.0.24-harness-live-test.md`, Agent View §2/§6 — `dev/scratchpad/az-v0.0.24-agents-view-report.md`)

---

## Summary

The agent that ran the 0.0.24 A–Z verification plan cataloged seven harness frictions (R1–R7) that turn "run the command and read the result" into a multi-round guessing game. The three highest-leverage ones are confirmed at source and form the scope of this FID:

1. **R1 — Tool-result micro-compaction erases exit codes (now P0).** The micro-compactor replaces cleared tool results with `{ type: 'json', value: '[compacted]' }` (`packages/agent-runtime/src/context-compactor.ts:148`), dropping the structured `{command, stdout, stderr, exitCode}` payload of `run_readonly_command`. A verification agent cannot tell PASS from FAIL — the harness's own compaction fights the verification goal. The live A–Z session showed the full damage: 59 `[compacted]` occurrences, ~12 commands re-run purely to defeat it, and a Verifier NEEDS-REVIEW cascade because the evidence had been erased (`dev/scratchpad/compaction-deep-dive.md` §1, §4).
2. **R3/R2 — The read-only shell filter is not quote-aware.** `maskQuoted` strips quoted substrings, but the forbidden-metacharacter regexes still scan the *masked* string and reject characters **inside** single quotes (`|` in the `[<>;|`$&]` class, `$` from the character-class workaround `[$]1`). Agents are forced into `&& echo MARKER` / `[$]` gymnastics for grep patterns that are provably safe.
3. **R4 — Compliance gates misfire on documentation writes.** `EchoComplianceTracker` applies Law 3 + Verifier-criteria flags to **every** write, with no code-vs-docs classification: a markdown report write to `dev/scratchpad/` triggers "run typecheck/lint" and "spawn the Verifier" nags that are meaningless for a doc artifact.

**Amended scope (deep-dive, 2026-08-14):**

4. **R8 — Micro-compact runs unconditionally; the config off-switch is dead code.** `protocol.config.yaml` `compression.microCompact: false` is parsed (`common/src/util/protocol-config.ts:261-270`, default `false` at `:105`) but **no production consumer exists** (consumer grep → 0 hits outside the parser); `prepareStepContext` calls `microCompact()` unconditionally on every step (`packages/agent-runtime/src/run-agent-step/context-tokens.ts:148`). Operators cannot disable the erasure that destroyed session evidence.
5. **R9 — Micro-compact has no pressure gate.** It fires purely on tool-result count (`> 3`, `microCompactMaxKeepRecent: 3` at `context-compactor.ts:82,125`) even when context is at 20% of the window — verification evidence is destroyed mid-session with zero headroom pressure.
6. **R10 — Compaction config values never reach the pruner/trigger.** `keepRecentTokens: 16_384`, `autoCompactRatio: 0.8`, `forceCompactRatio: 0.9` are parsed (`protocol-config.ts:106-108`) but the savant `handleSteps` bakes literals (`forceRatio = 0.9` at `agents/savant/handle-steps.ts:92`, `0.8` at `:159`) and never passes `keepRecentTokens` to the pruner spawn; the pruner only reads it from its own params (`agents/context-pruner/main.ts:177-178`).

**Second amendment (operator directive 2026-08-14): project-wide model unification.** The operator's directive is explicit and non-negotiable: *the model the user selects and sees on the UI panel is the ONLY model used anywhere in the product — headless runs, sub-agents, spawned agents, teacher, all of it. No surface may hardcode a different (especially paid) model without the user's knowledge.* Investigation confirmed the failure is systemic, not just teacher-forge:

7. **R11 — teacher-forge hardcodes a paid model.** `TEACHER_FORGE_AGENT.model = 'deepseek/deepseek-v4-pro'` (`cli/src/teacher/forge.ts:43`) is the fallback whenever `loadSavantCodeModelPreference()` is empty, and `createTeacherForge()` (`forge.ts:139-140`) reads **only** `loadSavantCodeModelPreference()` — it never reads the UI panel's model store (`getSelectedSavantFreeModel()`).
8. **R12 — The main agent run itself can resolve to a bundled paid default.** `applySavantCodeModelOverride` (`cli/src/hooks/helpers/send-message-agent.ts:22-41`) reads only `loadSavantCodeModelPreference()`; when that preference is empty (GUI-picked model via `switchModel` writes only the free-model preference file, `savant-free-model-store.ts:57-58`; server auto-flips via `setSelectedModel` are in-memory only), the agent keeps its **bundled definition's hardcoded model** — e.g. `minimax/minimax-m3` (`cli/src/agents/bundled-agents.generated.ts:681`), a paid model on OpenRouter.
9. **R13 — The bundled roster hardcodes ~30 models, most paid.** `bundled-agents.generated.ts` pins paid models across the roster: `anthropic/claude-opus-4.8` (:26, :381, :461, :479, :497, :611), `openai/gpt-5.1` (:443), `deepseek/deepseek-v4-pro` (:956), `minimax/minimax-m3` (:681, :1036), `z-ai/glm-5.2` (:1114), `moonshotai/kimi-k2.7-code` (:1194), `mimo/mimo-v2.5-pro` (:1274). These become the effective model on any path that does not override them.
10. **R14 — Sub-agents escape inheritance via `inheritParentModel: false`.** The two Gemini thinkers (`agents/thinker/thinker-gemini.ts:10`, `agents/thinker/thinker-with-files-gemini.ts:9`) declare `inheritParentModel: false` + `model: 'google/gemini-3.1-pro-preview'` — a paid model that runs whenever the main agent spawns the thinker (`agents/base-chat.ts:28` lists it spawnable), regardless of the user's selection.
11. **R15 — Headless runs can skip the model override entirely.** `headless-run.ts:44` accepts `resolvedAgent` — "Pre-resolved agent definition; skips resolveAgent + model override" — a bypass that lets any caller run any bundled definition with its hardcoded model; the fallback path (`headless-run.ts:157`) reads only `loadSavantCodeModelPreference()`.

Lower-priority items are cataloged in Open Questions for future scoping: R5 (phase-gating overhead for pure verification), R6 (`bun install --dry-run` postinstall git-config side effect), R7 (verbosity knob).

## Environment

- **OS:** Windows target (MSYS2 bash); the filter and runner are cross-platform.
- **Language/Runtime:** TypeScript/Bun 1.3.14; agent runtime `packages/agent-runtime/`.
- **Tool Versions:** `ContextCompactor` micro-compact (`context-compactor.ts`), `run_readonly_command` handler (`tools/handlers/tool/run-readonly-command.ts`), `EchoComplianceTracker` (`util/echo-compliance.ts`).
- **Commit/State:** working tree 0.0.24, unreleased. Active FID queue: `FID-2026-0814-002` (goal mode) and `FID-2026-0814-003` (hooks) at `analyzed`; this is the third planning FID of the day.

## Detailed Description

### Problem

1. **Exit codes are invisible after micro-compaction (R1).** The micro-compactor (`context-compactor.ts:148`) replaces cleared tool results with a `'[compacted]'` placeholder. For `run_readonly_command` the tool result *is* the structured `{command, stdout, stderr, exitCode}` JSON — so compaction erases the one field a verification agent needs. The A–Z agent re-ran ~12 commands purely to defeat compaction, adding `&& echo VXXX_OK` markers. There is currently **no test pinning the `[compacted]` placeholder** (`grep '[compacted]' packages/agent-runtime/src/context-compactor.test.ts` → 0 matches).
2. **Quoted shell metacharacters are rejected (R3/R2).** `isReadonlyCommand` calls `maskQuoted` (which blank-quotes quoted substrings) but then tests `FORBIDDEN_METACHAR_REGEX = /[<>;|`$&]|\|\||\$\(/` against the **masked** string. `maskQuoted` leaves `\` and `[` intact, so:
   - `grep -rn 'savantCode\$1'` — the `\$` escapes the quote's masking → `$` survives → rejected.
   - `grep -rn 'a\|b'` — the quoted `|` survives masking → rejected (the A–Z agent had to rewrite with `-e a -e b`).
   - `grep -rn 'savantCode[$]1'` — the `$` inside a character class is not a metachar, but masking does not know that → rejected.
   All three are safe inside single quotes; the filter has no shell-lexer awareness.
3. **Doc writes trigger code-oriented compliance gates (R4).** `echo-compliance.ts:261-263` flags Law 3 ("made N file change(s) without running verification") for *any* writes when `!verifiedAfterLastWrite`; `:297-315` flags Verifier criteria for any write set meeting line/touch thresholds. There is no code-vs-docs classification — `isSecuritySensitivePath` (`:71`) is the only path classifier, and it does not exempt docs. A markdown report triggers both nags; the A–Z agent had to spawn a Verifier to clear them.

### Expected Behavior

1. **Verification results survive compaction.** A `run_readonly_command` tool result, when micro-compacted, keeps a machine-readable signal the agent can read (exitCode-preserving placeholder, or exemption of verification-tool results from clearing). "Run the command, read the result, know PASS/FAIL" is the dominant verification use-case.
2. **The shell filter understands quoting.** Metacharacters inside single/double quotes (and inside `[...]` character classes) are not rejected; only *unquoted* metacharacters trip the denylist. Grep patterns like `'savantCode\$1'`, `'a\|b'`, and `'[$]1'` pass.
3. **Docs are not code.** Writes to documentation paths (`*.md`, `dev/scratchpad/`, `docs/`, `dev/session-summaries/`, `dev/test-prompts/`) do not trigger Law 3 / Verifier-criteria nags; they trigger `lint:md` as the appropriate verification instead.
4. **No regression:** destructive/mutating/network commands remain blocked; existing denylist tests keep passing; EHEL enforcement for real code writes is unchanged.
5. **The config is the source of truth:** `compression.microCompact` is actually honored (off = no micro-compact); `keepRecentTokens` / `autoCompactRatio` / `forceCompactRatio` reach the pruner trigger exactly as configured; an unresolvable context window fails loud instead of silently compacting against a hidden 200k default.
6. **Micro-compact respects context pressure:** below a configurable floor it does not erase evidence (or keeps far more recent results); verification-tool results keep a machine-readable signal either way.

### Root Cause (verified at source)

- **R1:** `context-compactor.ts:120-150` — micro-compact clears stale tool results; `:148` writes `value: '[compacted]'` for every cleared `ToolMessage` regardless of tool type or payload shape. `run_readonly_command`'s result is `{command, stdout, stderr, exitCode}` JSON (handler `run-readonly-command.ts:110-118`), so the exit code is in the discarded payload. The call is unconditional: `context-tokens.ts:148` invokes `microCompact` on every step.
- **R3/R2:** `run-readonly-command.ts:37-40` — `FORBIDDEN_METACHAR_REGEX` includes `|`, `$`, `&`, `` ` ``, `<`, `>`; `:44-75` `maskQuoted` blanks quoted substrings but leaves backslashes, brackets, and the quotes themselves; the regex then runs on the masked string, so `\$`, `[...]`-class `$`, and quoted `|` all trip it.
- **R4:** `echo-compliance.ts:261-315` — the Law 3 and Verifier-criteria flags apply to `writes` generically; the only path classifier is `isSecuritySensitivePath` (`:71`), which does not classify docs; `recordWrite` (`:173`) does not carry a file-kind hint.

## RED — Issue Catalog (evidence)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| H-01 | **P0** | Micro-compaction erases `run_readonly_command` exit codes — verification agents cannot tell PASS/FAIL; no test pins the `[compacted]` placeholder; live session showed 59 `[compacted]` hits + re-run spiral + Verifier NEEDS-REVIEW cascade | `context-compactor.ts:148` (`value: '[compacted]'` for every cleared tool result); `run-readonly-command.ts:110-118` (result is `{command, stdout, stderr, exitCode}`); grep `[compacted]` in `context-compactor.test.ts` → 0 matches; `dev/scratchpad/compaction-deep-dive.md` §1/§4 |
| H-02 | medium | Shell filter rejects quoted metacharacters — `'a\|b'`, `'savantCode\$1'`, `'[$]1'` all blocked; forces `&& echo MARKER` / `-e` gymnastics | `run-readonly-command.ts:37-40` (`FORBIDDEN_METACHAR_REGEX` includes `|` `$` `&`); `:44-75` (`maskQuoted` leaves `\` and `[` intact); regex runs on masked string |
| H-03 | medium | Compliance gates misfire on doc writes — Law 3 + Verifier nags on markdown reports; no code-vs-docs classification | `echo-compliance.ts:261-263` (Law 3 on any writes when unverified); `:297-315` (Verifier criteria on write sets); `:71` (`isSecuritySensitivePath` is the only path classifier) |
| H-04 | low | `bun install --dry-run` runs the postinstall hook and writes local git config — a "dry run" with a real side effect | `bun install --frozen-lockfile --dry-run` executed `git config core.hooksPath .githooks` (observed in the A–Z run cleanup section; root `prepare` script wires it) |
| H-05 | **P0** | `compression.microCompact: false` is dead config — parsed but never consumed; micro-compact runs unconditionally every step; operators cannot disable it | `protocol-config.ts:261-270` (parse) + `:105` (default `false`); consumer grep of `compression.microCompact` outside parser/tests → 0 hits; unconditional call `context-tokens.ts:148` |
| H-06 | P1 | Micro-compact has no pressure gate — fires on count (`>3` tool results) even at 20% window, destroying evidence with zero headroom pressure | `context-compactor.ts:82,125` (`microCompactMaxKeepRecent: 3`, count-only check) |
| H-07 | P1 | Compaction config (`keepRecentTokens: 16_384`, `autoCompactRatio: 0.8`, `forceCompactRatio: 0.9`) parsed but never threaded — handleSteps bakes literals; pruner never receives `keepRecentTokens` | `protocol-config.ts:106-108`; `handle-steps.ts:92` (`forceRatio = 0.9`), `:159` (`* 0.8`); `main.ts:177-178` (pruner reads only its own `p.keepRecentTokens`) |
| H-08 | **P0** | teacher-forge hardcodes paid `deepseek/deepseek-v4-pro`; `createTeacherForge()` never reads the UI model store — the operator's `/model` selection is ignored for the teacher | `forge.ts:43` (paid hardcode), `forge.ts:139-140` (only `loadSavantCodeModelPreference()`); store never read |
| H-09 | **P0** | Main agent run can resolve to a bundled paid default when the code preference is empty (GUI-picked/auto-flipped model lives only in the free-model store) | `send-message-agent.ts:22-41` (reads only code preference); `savant-free-model-store.ts:57-58` (GUI/auto-flip write only the free store); `bundled-agents.generated.ts:681` (`minimax/minimax-m3`) |
| H-10 | P1 | ~30 hardcoded models in the bundled roster, most paid (`claude-opus-4.8`, `gpt-5.1`, `deepseek-v4-pro`, `minimax-m3`, `glm-5.2`, `kimi-k2.7-code`, `mimo-v2.5-pro`) — effective model on any un-overridden path | `bundled-agents.generated.ts:26,381,443,461,479,497,611,681,956,1036,1114,1194,1274` |
| H-11 | P1 | Two Gemini thinkers escape inheritance via `inheritParentModel: false` + paid `google/gemini-3.1-pro-preview` — run whenever the main agent spawns the thinker | `agents/thinker/thinker-gemini.ts:10`, `agents/thinker/thinker-with-files-gemini.ts:9`; spawnable from `base-chat.ts:28` |
| H-12 | P1 | Headless runs can bypass the model override entirely (`resolvedAgent`) or read only the code preference | `headless-run.ts:44` (bypass), `:157` (code-preference-only override) |

## GREEN — Proposed Solution (converged)

1. **H-01 — Preserve verification results across micro-compaction.** Two complementary changes:
   - The micro-compactor exempts verification-tool results (`run_readonly_command`, `run_terminal_command`) from *value* clearing when they carry a JSON result: keep the `{exitCode, ...}` payload (optionally with stdout/stderr truncated), or write a `{ type: 'json', value: { exitCode, compacted: true } }` placeholder that preserves the only field a verifier needs.
   - The exit-code-preserving placeholder must be asserted by a new unit test in `context-compactor.test.ts` (the current placeholder has zero test coverage).
   - Context-budget guard: preserving exit codes must not defeat the micro-compact's purpose — the payload is small (single JSON object), so the token savings remain dominated by the cleared message body.
2. **H-02 — Quote-aware metacharacter scanning.** Replace the `maskQuoted` + regex-on-masked-string approach with a small shell-aware scanner that:
   - tracks single-quote / double-quote / backslash-escape state, and
   - treats characters inside quotes and inside `[...]` character classes as literal (no metachar rejection), while keeping the existing `&&`-splitting and the Windows stderr-redirect allowance.
   - The denylist (destructive/git-mutating/dangerous command) checks remain unchanged and still run on the raw first token.
3. **H-03 — Code-vs-docs write classification.** Add a `fileKind: 'code' | 'docs'` hint to `recordWrite` (derived from path: `*.md`, `dev/scratchpad/`, `docs/`, `dev/session-summaries/`, `dev/test-prompts/` → docs):
   - Law 3 verification nag and Verifier-criteria flags apply to **code** writes only; doc writes instead map to the appropriate verification (markdownlint/lint:md), which the tracker's verification-command detection already recognizes.
   - EHEL enforcement for code writes is unchanged (Laws 1/3/7/8/15 still apply to code).
4. **H-04 — (low) Dry-run postinstall side effect.** Root `package.json` `prepare` script: gate `git config core.hooksPath .githooks` on `npm_config_argv`/`BUN_INSTALL_DRY_RUN`-style detection, or document the side effect in the A–Z prompt's cleanup checklist. Marked P3; only ship if a clean detection exists.
5. **H-05 — Wire the compression config (P0).** Thread `compression.microCompact` (and `keepRecentTokens` / `autoCompactRatio` / `forceCompactRatio` where they exist) from `readProtocolConfig` into the run-config → `ContextCompactor` construction and the savant `handleSteps` factory — the same pattern `getSavantContextPrunerMaxContextLength` already uses to thread `maxContextLength` into `getSavantHandleSteps` (`agents/savant/savant.ts:102,214-216`). When `microCompact` is `false`, `prepareStepContext` must skip the `microCompact()` call (`context-tokens.ts:148`). An unresolvable context window must fail loud (log + explicit fallback) instead of the silent `?? 200_000` (`context-compactor.ts:74`).
6. **H-06 — Add a pressure gate to micro-compact (P1).** Only clear when context is above a configurable floor (e.g. `microCompactFloorTokens`, default ~60% of the resolved window) OR raise `microCompactMaxKeepRecent` from a hardcoded 3 to a config-driven value (default 6-8) so verification-heavy runs keep their evidence at low pressure. Verification-tool results (`run_readonly_command`, `run_terminal_command`) keep the exit-code-preserving placeholder from H-01 regardless.
7. **H-07 — Thread the pruner/trigger config values (P1).** Pass `keepRecentTokens` through the savant `handleSteps` pruner spawn (`handle-steps.ts:123-168` → `spawn_agent_inline` params, where `main.ts:177-178` already reads it), and feed `autoCompactRatio` / `forceCompactRatio` into the serialized handleSteps literals instead of the hardcoded `0.8`/`0.9`. The serialized-function constraint (only literals/params/locals — no closure variables) is preserved by baking the config values as literals at factory time, exactly as `createSavantHandleSteps` already does for `maxContextLength`/`cacheExpiryMs`.

**Model unification workstream (second amendment, operator directive):**

8. **H-08/H-09 — One source of truth: the UI model store.** Add a single `resolveActiveModel()` helper that returns `getSelectedSavantFreeModel()` (which already fail-safes: paid build → `openrouter/free`, free build → free-catalog default — **never a paid fallback**, per `savant-free-model-store.ts:46-66` `resolveInitialSelectedModel`). Replace every model decision with it:
   - `applySavantCodeModelOverride` (`send-message-agent.ts:22-41`) resolves from the store instead of the code preference (or the store becomes the single reader the code preference feeds).
   - `resolveTeacherForgeAgent` / `createTeacherForge` (`forge.ts:129-140`) resolve from `resolveActiveModel()`; the paid hardcode `deepseek/deepseek-v4-pro` is removed as a fallback (it may remain as a *documented* default only if the store resolves to it — it never will in a free-tied flow).
9. **H-10 — Bundled roster: defaults become display metadata, never effective models.** The ~30 hardcoded `model:` values in `bundled-agents.generated.ts` remain as definition defaults for offline/fallback contexts, but every run-construction path applies `resolveActiveModel()` — so a bundled default can never be the *effective* model of a live run. Implementation must grep every `client.run` / `loopAgentSteps` / spawn construction and assert the override is applied (Law 4).
10. **H-11 — Remove the sub-agent model escapes.** The two Gemini thinkers drop `inheritParentModel: false` + the paid hardcode and inherit the parent's model like every other sub-agent (`withParentModel`, `spawn-agent-utils.ts:427-433`). If a reasoning helper genuinely needs a fixed model, that decision belongs to the operator's model choice, not a baked-in escape.
11. **H-12 — Headless paths resolve the same way.** `headless-run.ts:44` `resolvedAgent` bypass is removed or re-routed through `resolveActiveModel()`; the fallback path (`:157`) uses the store, not the code preference. Any other `client.run` with an explicit `agent` (e.g. the SDK surface) gets the same treatment.
12. **Regression gate:** a new test asserts that for a given store selection, every production model decision point (main agent, teacher-forge, sub-agent spawn, headless run) resolves to that store value — and that no path can resolve to a paid model when the store resolved to a free/default one.

**Out of scope:** R5 (phase-gating UX for pure verification — a harness-orchestration design question, not a tool defect), R7 (verbosity knob — feature request for a future tool-capability pass), the goal-mode FID (002), the hooks FID (003), and the teacher-forge model fallback (AV-2, tracked for a separate remediation).

## Verification Matrix (exit gates)

| Area | Hard evidence |
|---|---|
| Exit-code preservation | New test: micro-compact of a `run_readonly_command` result keeps `exitCode` in the placeholder; existing denylist/compact tests pass |
| Context budget | Test asserts the preserved placeholder's token cost is bounded (single JSON object, not the full stdout) |
| Quote-aware filter | Tests: `grep -E 'a\|b'` passes; `'savantCode\$1'` passes; `'[$]1'` passes; unquoted `rm -rf` still blocked; `a && b` still chains; `2>nul` still allowed |
| Docs classification | Test: writing `dev/scratchpad/x.md` + running `lint:md` clears verification without a Law-3 nag; writing `src/x.ts` without verification still nags |
| Config wiring | Test: `compression.microCompact: false` → `microCompact()` not invoked (spy/mock on the compactor call in `prepareStepContext`); `true` → invoked; `keepRecentTokens`/`autoCompactRatio`/`forceCompactRatio` from `protocol.config.yaml` reach the handleSteps literals and pruner params |
| Pressure gate | Test: context below the floor with `> 3` tool results → no clearing; above the floor → clearing with exit-code-preserving placeholder; `microCompactMaxKeepRecent` configurable |
| One-model invariant | Test: with store selected to X, assert main agent, teacher-forge, sub-agent spawn, and headless run all resolve to X; assert no path resolves to a paid model when the store resolved to a free/default one; grep for remaining `loadSavantCodeModelPreference()` reads that bypass the store |
| Repository | typecheck ×4, ESLint zero warnings, Markdownlint, Prettier, `validate:repository`, fid-ledger, full root test suites |

## Governance and Release Boundary

This FID tightens harness ergonomics without weakening EHEL: destructive/mutating commands stay blocked, code-write enforcement is unchanged, and only doc artifacts get doc-appropriate gates. All changes remain subject to the Perfection Loop, the Nova planning + implementation audits, and operator approval before any closure, commit, push, release, or deployment.

## Open Questions (to be resolved in the loop)

1. **Exit-code placeholder shape:** `{ exitCode, compacted: true }` vs. exempting verification tools from value-clearing entirely. Default: placeholder (keeps context savings; the payload is tiny). Fall back to exemption if the placeholder breaks downstream tool-result renderers.
2. **Quote-aware scanner:** hand-rolled lexer vs. reusing a parsing library. Default: hand-rolled state machine (~40 lines) — no new dependency; the existing `splitSafeAnd` already implements quote tracking and can be generalized.
3. **Docs classification scope:** the exact path set (`*.md`, `dev/scratchpad/`, `docs/`, `dev/session-summaries/`, `dev/test-prompts/`, `CHANGELOG.md`) vs. extension-only. Default: the enumerated set plus `*.md` (docs never satisfy "code" checks).
4. **R5/R7:** park as future work or fold into this FID? Default: park — they are harness UX redesigns, not defects.
5. **Pressure-gate shape:** configurable token floor vs. configurable keep-recent count vs. both. Default: keep-recent 3 → 6-8 (config-driven) plus a floor only if the keep-recent bump proves insufficient — the floor changes behavior more aggressively and needs the window to be resolved reliably.
6. **Config threading scope:** the full `compression` block vs. only `microCompact`. Default: thread `microCompact` now (P0, the on/off bug); thread the ratios/keepRecentTokens in the same pass since the plumbing is identical (Law 13 — one mechanism, not two).
7. **Fail-loud fallback:** a logged warning + explicit 200k marker vs. hard error when the window is unresolved. Default: warn + marker — a hard error would break runs where the model window is genuinely unknown, and the sidebar already shows the resolved window.
8. **Placeholder shape interaction with H-06:** if the pressure gate keeps more results, the placeholder matters less — but the exit-code preservation must still hold when clearing does happen. Default: do both; the placeholder is the guarantee, the gate is the preference.
9. **Store-vs-code-preference reconciliation:** the free-model store and the savant-code preference are two persistence channels that can diverge. Default: the store (`getSelectedSavantFreeModel()`) is the single runtime source; the code preference file remains only as a boot-time input to `resolveInitialSelectedModel` — never read directly at run construction.
10. **Bundled defaults:** keep the ~30 hardcoded models as display metadata (they document each agent's intent) vs. blank them out entirely. Default: keep as metadata; enforce at run construction (the effective-model gate), not by editing the generated file.
11. **Thinker exceptions:** eliminate `inheritParentModel: false` entirely vs. keep a documented allowlist. Default: eliminate — the operator's model choice governs all sub-agents, per the directive.

---

## Perfection Loop

### Missed Questions

Asked during the loop, as required: "What questions should I have asked when this FID was created, but failed to?"

1. **Does preserving exit codes defeat micro-compaction?** No — the compacted payload is a single JSON object (`{exitCode, compacted: true}`), not the full stdout/stderr; the token savings come from dropping the message body, which still happens.
2. **Is the `[compacted]` placeholder load-bearing elsewhere?** It is a display sentinel for the CLI tool-result renderer (`cli` renders tool blocks); the placeholder shape change must keep the tool block rendering working (the renderer reads `value`, and a JSON object already renders — no new render path).
3. **Does quote-aware scanning weaken the denylist?** No — the denylist (`DESTRUCTIVE_COMMAND_REGEX`, `GIT_MUTATING_REGEX`, `DANGEROUS_COMMAND_REGEX`) runs on the raw first token and is independent of metachar scanning; quoting was never a bypass for those (an `rm -rf` in quotes is still blocked because the regex sees `rm`).
4. **Does doc classification weaken ECHO for docs?** Docs never had code-oriented gates that made sense; `lint:md` is the real verification for them, and the tracker's verification-command detection (`echo-compliance.ts:31`) already recognizes it.
5. **Why is H-04 (dry-run side effect) low?** It is a `bun`/root-`prepare` behavior, not a runtime defect; the clean detection (`BUN_INSTALL_DRY_RUN`) may not exist in the target bun version, so it is P3 and conditional.

### Code Verification Evidence

```text
$ grep -n "value: '\[compacted\]'" packages/agent-runtime/src/context-compactor.ts
148:          content: [{ type: 'json', value: '[compacted]' }],
$ grep -c "compacted" packages/agent-runtime/src/context-compactor.test.ts
0   # placeholder has no test coverage
$ grep -n "FORBIDDEN_METACHAR_REGEX\|maskQuoted" packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts
37: const FORBIDDEN_METACHAR_REGEX = /[<>;|`$&]|\|\||\$\(/
44: function maskQuoted(command: string): string {
$ grep -n "law3\|verifier_criteria\|isSecuritySensitivePath" packages/agent-runtime/src/util/echo-compliance.ts
71: export function isSecuritySensitivePath(path: string): boolean
261: if (writes.length > 0 && !this.verifiedAfterLastWrite) {   # Law 3 flag
297: needsIndependentReview && (criteriaMet || ...)             # Verifier-criteria flag
```

### Loop 1 — RED (catalog)

Issues H-01…H-04 cataloged with `file:line` evidence (see RED table). Severities: H-01 high; H-02/H-03 medium; H-04 low. **Exit: all issues cataloged.**

### Loop 1 — GREEN (converged solution)

Four-part solution documented: exit-code-preserving compaction placeholder, quote-aware metachar scanner, code-vs-docs write classification, conditional dry-run postinstall gate (P3). **Exit: all fixes documented.**

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static grep, absence-shaped):**

```text
$ grep -n "value: '\[compacted\]'" packages/agent-runtime/src/context-compactor.ts
148: content: [{ type: 'json', value: '[compacted]' }]
$ grep -c "compacted" packages/agent-runtime/src/context-compactor.test.ts
0
$ grep -n "FORBIDDEN_METACHAR_REGEX" packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts
37: const FORBIDDEN_METACHAR_REGEX = /[<>;|`$&]|\|\||\$\(/
$ grep -n "fileKind\|'docs'\|scratchpad" packages/agent-runtime/src/util/echo-compliance.ts
(no matches)   # no docs classification exists
```

**Method 2 (manual verification of the cited code, read 0-EOF):**

| Claim | Verdict | Evidence |
|---|---|---|
| H-01 compaction erases exit codes, untested | **PASS** | `context-compactor.ts:148` writes `'[compacted]'` for every cleared tool result; `run-readonly-command.ts:110-118` result is `{command, stdout, stderr, exitCode}`; test grep → 0 matches |
| H-02 filter rejects quoted metachars | **PASS** | `FORBIDDEN_METACHAR_REGEX` at `:37` includes `|` `$` `&`; `maskQuoted` (`:44-75`) leaves `\` and `[` intact; masked string is regex-scanned → quoted `\|` and class `$` trip it |
| H-03 gates misfire on docs | **PASS** | `:261-263` Law 3 on any writes; `:297-315` Verifier criteria on write sets; `:71` only path classifier is security-sensitive; `fileKind`/`docs` grep → 0 |
| H-04 dry-run side effect | **PASS** | Observed `git config core.hooksPath` write from the root `prepare` hook during `--dry-run` (A–Z cleanup log); the prepare script (`package.json`) runs `git config` unconditionally |

**Law 4 (call-graph):** the GREEN plan changes existing functions (`microCompact` in `context-compactor.ts`, `isReadonlyCommand` in `run-readonly-command.ts`, `recordWrite`/`evaluateAtStepBoundary` in `echo-compliance.ts`) — no new public function or config field is introduced; implementation must re-run the existing callers' tests (compact, filter, compliance suites) and grep the two production call sites of `evaluateAtStepBoundary` (`loop-iteration.ts`, plus the wired `echo-record.ts` path). **AUDIT passes → ADVERSARIAL.**

### Loop 1 — ADVERSARIAL (fresh meta-verification)

- **H-01 CONFIRMED:** the `[compacted]` sentinel has zero test coverage and drops the exit code — the single highest-leverage verification-harness defect; the GREEN placeholder shape (`{exitCode, compacted: true}`) is the minimal honest fix.
- **H-02 CONFIRMED:** the agent-view report's two rejections reproduce exactly from the mask+regex design (`\$` escapes masking, quoted `|` survives, `[$]` class `$` is unmasked). A hand-rolled quote/class-aware lexer is the right size (no new dependency).
- **H-03 CONFIRMED:** docs writes genuinely trigger meaningless nags; the A–Z agent had to spawn a Verifier to clear them — ceremony that dilutes trust in the gates. The `lint:md` mapping is already supported by the verification-command regex (`:31`).
- **H-04 CONFIRMED, severity upheld (low):** bun's dry-run does run postinstall hooks; the fix is conditional on a detectable env signal and can be deferred.
- **OMISSION REFINED (added to GREEN):** the exit-code-preserving placeholder must not break the CLI tool-result renderer (`cli/src/components/blocks/tool-branch.tsx` special-cases `run_readonly_command` — no copy button). A JSON object value already renders; the implementation must assert the render path with a CLI test, not just the runtime test.
- **No refutations; no other omissions.** Severity ratings upheld. **ADVERSARIAL passes → COMPLETE (planning).**

### Loop 2 — Fresh re-audit (2026-08-14, all-FID pass)

Re-verified every RED claim at source with tool output after the companion FIDs were filed:

```text
$ grep -n "value: '\[compacted\]'" packages/agent-runtime/src/context-compactor.ts
148: content: [{ type: 'json', value: '[compacted]' }]   # placeholder unchanged
$ grep -n "FORBIDDEN_METACHAR_REGEX" packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts
17: const FORBIDDEN_METACHAR_REGEX = /[<>;|`$&]|\|\||\$\(/   # filter unchanged
130: FORBIDDEN_METACHAR_REGEX.test(masked)                   # mask+regex scan unchanged
```

**ADVERSARIAL (cross-check):** all claims **CONFIRMED** on re-read. **Cross-FID check:** FID-004's exit-code-preserving placeholder touches the micro-compactor (`context-compactor.ts:148`); FID-006's freshness fix touches the snapshot emitter and display layer, and explicitly keeps the placeholder's context-budget guard in scope — the two are adjacent but non-conflicting (placeholder shape change is FID-004; emit policy is FID-006). No refutations, no new omissions. **AUDIT passes → COMPLETE (planning) stands.**

### Loop 3 — Amended scope (2026-08-14, deep-dive fold-in)

Trigger: the operator's live A–Z v0.0.24 session showed the agent "fighting it non stop" — the deep-dive
(`dev/scratchpad/compaction-deep-dive.md`) traced the fight to micro-compact erasing verification evidence and
discovered the dead `compression.microCompact` config. RED findings H-05…H-07 added; H-01 upgraded P0 (evidence in the
RED table).

**RED (new catalog):**

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| H-05 | P0 | `compression.microCompact: false` dead config — parsed, never consumed; unconditional call every step | `protocol-config.ts:261-270,105`; consumer grep → 0; `context-tokens.ts:148` |
| H-06 | P1 | No pressure gate — count-only (>3) clearing destroys evidence at low context | `context-compactor.ts:82,125` |
| H-07 | P1 | Config ratios/keepRecentTokens never reach pruner/trigger — handleSteps bakes literals | `handle-steps.ts:92,159`; `main.ts:177-178`; `protocol-config.ts:106-108` |

**GREEN (amended solution):** five-part solution now — H-01 exit-code-preserving placeholder (P0, with renderer
assertion), H-02 quote-aware scanner, H-03 docs classification, H-05 config wiring (`microCompact` honored +
fail-loud window fallback), H-06 pressure gate (configurable keep-recent 6-8 / floor), H-07 ratio/keepRecentTokens
threading via the existing `getSavantHandleSteps` factory pattern; H-04 unchanged (P3).

**AUDIT (tool output, fresh greps):**

```text
$ grep -n "microCompact" packages/agent-runtime/src/run-agent-step/context-tokens.ts
148:  const microResult = contextCompactor.microCompact(agentState.messageHistory)   # unconditional
$ grep -n "compression.microCompact\|compression.keepRecentTokens\|compression.autoCompactRatio" --include="*.ts" cli/src sdk/src packages agents common/src
(no matches outside protocol-config.ts — consumer grep verified 0)
$ grep -n "microCompactMaxKeepRecent" packages/agent-runtime/src/context-compactor.ts
82:      microCompactMaxKeepRecent: 3,        # hardcoded
125:    if (toolResultIndices.length <= this.thresholds.microCompactMaxKeepRecent) {   # count-only gate
$ grep -n "forceRatio\|maxContextLength \* 0.8" agents/savant/handle-steps.ts
92:    const forceRatio = 0.9                  # baked literal
159:        agentState.contextTokenCount > maxContextLength * 0.8 &&   # baked literal
```

**Law 4 (call-graph):** H-05 changes the construction path of `ContextCompactor` (producers: `loop-context.ts:271-280`)
and the `prepareStepContext` call site (`context-tokens.ts:148`); H-07 changes `getSavantHandleSteps`/`createSavantHandleSteps`
(producer: `agents/savant/savant.ts:214-216`) — all existing producers re-verified, no new public surface. The config
plumbing adds no new config field (the `compression` block already exists in `ProtocolCompressionConfig`).

**ADVERSARIAL (amendment review):**

- **H-05 CONFIRMED:** parser default `false` at `protocol-config.ts:105`; unconditional runtime call at `context-tokens.ts:148`; consumer grep verified 0 — the config is dead.
- **H-06 CONFIRMED:** `microCompactMaxKeepRecent: 3` at `context-compactor.ts:82` and the count-only guard at `:125` — no token-pressure check exists anywhere in the clearing decision.
- **H-07 CONFIRMED:** `forceRatio = 0.9` and `* 0.8` baked into the serialized handleSteps source; `main.ts:177-178` reads `keepRecentTokens` only from its own params — the savant spawn never passes it.
- **H-01 P0 upgrade CONFIRMED:** the deep-dive session evidence (59 `[compacted]` hits, re-run spiral, NEEDS-REVIEW cascade) substantiates high → P0; the severity upgrade is evidence-backed, not rhetorical.
- **OMISSION REFINED (folded into GREEN):** H-05's fail-loud fallback must not hard-break runs with genuinely unknown windows — GREEN now specifies warn + explicit marker (`Open Question 7`), preserving the existing `?? 200_000` behavior as a labeled fallback rather than an error.
- **No refutations; no new omissions.** Severity ratings upheld. **ADVERSARIAL passes → COMPLETE (planning, amended).**

### Loop 4 — Second amendment (2026-08-14, project-wide model unification)

Trigger: operator directive — the UI panel model is the ONLY model project-wide; hardcoding a paid model without the
user's knowledge is unacceptable. The teacher-forge finding (previously noted as AV-2 out-of-scope) was investigated and
turned out to be the visible tip of a systemic gap (H-08…H-12).

**RED (new catalog, source-verified):**

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| H-08 | P0 | teacher-forge hardcodes paid `deepseek/deepseek-v4-pro`; never reads the UI model store | `forge.ts:43` (hardcode), `forge.ts:139-140` (only `loadSavantCodeModelPreference()`) |
| H-09 | P0 | Main agent run can resolve to a bundled paid default when the code preference is empty (GUI-picked/auto-flipped model lives only in the free store) | `send-message-agent.ts:22-41`; `savant-free-model-store.ts:57-58`; `bundled-agents.generated.ts:681` (`minimax/minimax-m3`) |
| H-10 | P1 | ~30 bundled hardcoded models, most paid — effective on any un-overridden path | `bundled-agents.generated.ts:26,381,443,461,479,497,611,681,956,1036,1114,1194,1274` |
| H-11 | P1 | Two Gemini thinkers escape via `inheritParentModel: false` + paid `google/gemini-3.1-pro-preview` | `thinker-gemini.ts:10`, `thinker-with-files-gemini.ts:9`, spawnable from `base-chat.ts:28` |
| H-12 | P1 | Headless runs can bypass the override (`resolvedAgent`) or read only the code preference | `headless-run.ts:44,157` |

**GREEN (converged):** single `resolveActiveModel()` helper backed by the UI model store (fail-safe to
`openrouter/free` / free-catalog, never paid), applied at every run-construction point (main, teacher-forge, sub-agent
spawn, headless); bundled models reduced to display metadata; thinker `inheritParentModel: false` escapes removed;
`resolvedAgent` bypass closed; regression test asserting the one-model invariant. Detailed in GREEN §8-12.

**AUDIT (tool output, fresh greps):**

```text
$ grep -n "model: 'deepseek/deepseek-v4-pro'" cli/src/teacher/forge.ts
43:  model: 'deepseek/deepseek-v4-pro',   # paid hardcode present
$ grep -n "loadSavantCodeModelPreference" cli/src/teacher/forge.ts cli/src/hooks/helpers/send-message-agent.ts
forge.ts:12: import { loadSavantCodeModelPreference } from '../utils/settings'   # only code preference
send-message-agent.ts:26: const modelOverride = loadSavantCodeModelPreference()  # main path reads code pref only
$ grep -n "getSelectedSavantFreeModel" cli/src/teacher/forge.ts
(no matches)   # teacher-forge never reads the UI store — confirmed
$ grep -n "inheritParentModel: false" agents/thinker/thinker-gemini.ts agents/thinker/thinker-with-files-gemini.ts
10: inheritParentModel: false
9: inheritParentModel: false
$ grep -rn "model: '" cli/src/agents/bundled-agents.generated.ts | wc -l
30   # hardcoded models in the bundled roster
```

**Law 4 (call-graph):** the GREEN plan changes the model resolution of every run path. Producers to assert at
implementation: `send-message-run-config.ts:107-108` (main), `teacher/runtime.ts:229` (teacher forge), `headless-run.ts:157`
(headless), `spawn-agent-utils.ts:427-433` (sub-agent inheritance), and every `client.run` construction. Zero callers of
the old code-preference-only reads must remain after the change.

**ADVERSARIAL (amendment review):**

- **H-08 CONFIRMED:** paid hardcode at `forge.ts:43`; store grep → 0 matches; `resolveTeacherForgeAgent` falls back to the paid default whenever the code preference is empty — the exact live bug the operator hit (low-credit free provider, forge requested 65536 tokens).
- **H-09 CONFIRMED:** `applySavantCodeModelOverride` reads only `loadSavantCodeModelPreference()`; GUI/auto-flip writes only the free store; when the code preference is empty the bundled `minimax/minimax-m3` becomes the effective main-agent model — a paid model on OpenRouter, exactly the operator's earlier report ("keeps defaulting to minimax").
- **H-10 CONFIRMED:** 30 hardcoded models, 13+ paid; every un-overridden path uses one.
- **H-11 CONFIRMED:** both thinkers escape inheritance with a paid gemini model and are spawnable from the main base-chat.
- **H-12 CONFIRMED:** `headless-run.ts:44` documents the `resolvedAgent` bypass; `:157` reads only the code preference.
- **OMISSION REFINED (folded into GREEN):** the paid hardcode in `forge.ts` must not merely be re-pointed at the store — it must be *removed as a fallback*, because a store miss must fail-safe to `openrouter/free` (free) or the free-catalog default, never to a paid model. GREEN §8 now says this explicitly.
- **No refutations; no new omissions.** Severity ratings upheld. **ADVERSARIAL passes → COMPLETE (planning, amended 2).**

### Loop 1 — COMPLETE (planning)

Plan converged after one loop pass: zero actionable improvements beyond the recorded refinement; no oscillation; delta well under the 10% cap. FID status → `analyzed`. Implementation is not approved until the Nova planning sign-off PASS and operator approval; closure additionally requires the implementation audit.

## Resolution

- **Status:** `closed` — implemented and verified under automation level 3 (2026-08-14).
- **Fix Description:** Verification-harness agent frictions — exit-code-preserving micro-compaction placeholder for verification tool results (with renderer assertion), quote/character-class-aware shell metachar scanner in `isReadonlyCommand`, code-vs-docs write classification in `EchoComplianceTracker` (doc writes gate on `lint:md`, not Law 3/Verifier criteria), conditional dry-run postinstall gate (P3), **plus the amended deep-dive scope**: `compression.microCompact` config actually honored + fail-loud window fallback (H-05, P0), pressure gate / configurable keep-recent for micro-compact (H-06, P1), and `keepRecentTokens`/`autoCompactRatio`/`forceCompactRatio` threaded through the handleSteps factory (H-07, P1), **plus the second-amendment model unification**: single `resolveActiveModel()` from the UI model store applied at every run-construction point (main, teacher-forge, sub-agent spawn, headless), bundled hardcoded models reduced to display metadata, thinker `inheritParentModel: false` escapes removed, `resolvedAgent` bypass closed (H-08…H-12).
- **Tests Added:** `context-compactor-micro.test.ts` (H-05/H-06), `savant-free-model-store.test.ts` (H-08..H-12 one-model invariant), `context-pruner-phase3.test.ts` (H-07 factory threading), protocol-config micro-compact/floor parsing tests.
- **Verification Evidence:** AUDIT greps pasted above (Loop 1 — AUDIT).
- **Archived:** closed + archived 2026-08-14. See `dev/fids/archive/README.md`.
