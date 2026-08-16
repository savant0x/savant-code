<!-- markdownlint-disable MD013 -->

# Nova Planning Sign-off Request — FID-2026-0814-004 (Verification-Harness Agent Frictions)

**Date:** 2026-08-14
**Scope:** Planning review of a harness-UX remediation: exit-code-preserving micro-compaction placeholder, quote/character-class-aware shell metachar scanner, code-vs-docs compliance write classification, a conditional dry-run postinstall gate (P3), **plus amendment 1 (deep-dive fold-in)**: `compression.microCompact` config wiring (P0), micro-compact pressure gate (P1), pruner/trigger config threading (P1), **plus amendment 2 (project-wide model unification, operator directive)**: a single `resolveActiveModel()` from the UI model store applied at every run-construction point (main agent, teacher-forge, sub-agent spawn, headless), bundled hardcoded models reduced to display metadata, thinker `inheritParentModel: false` escapes removed, `resolvedAgent` bypass closed (H-08…H-12). H-01 upgraded high → P0.
**Status:** REQUESTED (amended scope ×2 — re-audit required)
**Priority:** High (P0 micro-compact erasure + dead config + paid-model escapes; the paid fallback is a live user-facing billing defect)

## Request

Please independently audit the **planning** FID below and return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is a **planning sign-off request**. A PASS verifies the plan's ground-truth claims against the repo; it does **not** authorize implementation, closure, commit, push, release, publication, or deployment. Implementation (and a separate implementation-audit request) follows operator approval.

## Record under review

`dev/fids/FID-2026-0814-004-verification-harness-agent-frictions.md` — status `analyzed` (planning-converged via the Perfection Loop with AUDIT + ADVERSARIAL + a fresh Loop-2 re-audit + the Loop-3 amendment record). Source findings originated in the A–Z Agent View (`dev/scratchpad/az-v0.0.24-agents-view-report.md`, R1–R7) and the compaction deep-dive of the live session (`dev/scratchpad/compaction-deep-dive.md`, C-01…C-06 → H-05…H-07).

**Amendment note for the auditor:** the original planning PASS (yours, 2026-08-14) covered H-01…H-04. This request supersedes it — the amended FID adds H-05 (P0), H-06 (P1), H-07 (P1) in amendment 1, then H-08…H-12 (P0/P1) in amendment 2, and upgrades H-01 to P0. Each amendment's Loop record (Loop 3, Loop 4) contains its own AUDIT/ADVERSARIAL pass; please re-verify the added claims and both P0 upgrades at source.

## What the FID claims (verify each at source)

| ID | Claim | Cited source |
|---|---|---|
| H-01 (high) | Micro-compaction replaces every cleared tool result with `'[compacted]'`, erasing the `run_readonly_command` exit code; the placeholder has zero test coverage | `packages/agent-runtime/src/context-compactor.ts:148`; `tools/handlers/tool/run-readonly-command.ts:110-118` (result is `{command, stdout, stderr, exitCode}`); `grep '[compacted]' context-compactor.test.ts` → 0 |
| H-02 (medium) | The read-only shell filter rejects quoted metacharacters (`'a\|b'`, `'savantCode\$1'`, `'[$]1'`) — `maskQuoted` blanks quotes but the regex scans the masked string | `run-readonly-command.ts:17` (`FORBIDDEN_METACHAR_REGEX = /[<>;|`$&]|\|\||\$\(/`); `:44-75` (`maskQuoted`); `:130` (regex on masked string) |
| H-03 (medium) | Compliance gates misfire on doc writes — Law 3 + Verifier-criteria nags apply to every write; no code-vs-docs classification | `util/echo-compliance.ts:261-263` (Law 3 on any writes); `:297-315` (Verifier criteria on write sets); `:71` (`isSecuritySensitivePath` is the only path classifier) |
| H-04 (low) | `bun install --dry-run` runs the postinstall hook and writes local git config | Root `prepare` hook (`git config core.hooksPath .githooks`); observed in the A–Z run cleanup section |
| H-05 (P0, amended) | `compression.microCompact: false` is dead config — parsed but never consumed; `microCompact()` runs unconditionally every step; operators cannot disable it | `common/src/util/protocol-config.ts:261-270` (parse) + `:105` (default `false`); consumer grep of `compression.microCompact` outside parser/tests → 0; unconditional call `packages/agent-runtime/src/run-agent-step/context-tokens.ts:148` |
| H-06 (P1, amended) | Micro-compact has no pressure gate — fires on count (`> 3` tool results, `microCompactMaxKeepRecent: 3`) even at 20% of the window | `context-compactor.ts:82,125` (hardcoded 3; count-only guard) |
| H-07 (P1, amended) | `keepRecentTokens: 16_384`, `autoCompactRatio: 0.8`, `forceCompactRatio: 0.9` parsed but never threaded — handleSteps bakes literals; the pruner never receives `keepRecentTokens` | `protocol-config.ts:106-108`; `agents/savant/handle-steps.ts:92` (`forceRatio = 0.9`), `:159` (`* 0.8`); `agents/context-pruner/main.ts:177-178` (reads only its own `p.keepRecentTokens`) |
| H-08 (P0, amend 2) | teacher-forge hardcodes paid `deepseek/deepseek-v4-pro`; `createTeacherForge()` reads only `loadSavantCodeModelPreference()` — never the UI model store; a store miss falls back to the paid hardcode | `cli/src/teacher/forge.ts:43` (`model: 'deepseek/deepseek-v4-pro'`); `:139-140` (only `loadSavantCodeModelPreference()`); grep `getSelectedSavantFreeModel` in `forge.ts` → 0 |
| H-09 (P0, amend 2) | Main agent run can resolve to a bundled paid default when the code preference is empty — GUI-picked/auto-flipped models live only in the free-model store | `cli/src/hooks/helpers/send-message-agent.ts:22-41` (reads only code preference); `cli/src/state/savant-free-model-store.ts:57-58`; `cli/src/agents/bundled-agents.generated.ts:681` (`minimax/minimax-m3`) |
| H-10 (P1, amend 2) | ~30 hardcoded models in the bundled roster, 13+ paid (`claude-opus-4.8`, `gpt-5.1`, `deepseek-v4-pro`, `minimax-m3`, `glm-5.2`, `kimi-k2.7-code`, `mimo-v2.5-pro`) — the effective model on any un-overridden path | `cli/src/agents/bundled-agents.generated.ts:26,381,443,461,479,497,611,681,956,1036,1114,1194,1274` |
| H-11 (P1, amend 2) | Two Gemini thinkers escape model inheritance via `inheritParentModel: false` + paid `google/gemini-3.1-pro-preview` — run whenever the main agent spawns the thinker | `agents/thinker/thinker-gemini.ts:10`; `agents/thinker/thinker-with-files-gemini.ts:9`; spawnable from `agents/base-chat.ts:28` |
| H-12 (P1, amend 2) | Headless runs can bypass the model override entirely (`resolvedAgent`) or read only the code preference | `cli/src/headless-run.ts:44` (bypass), `:157` (code-preference-only override) |

## Hard questions Nova must verify at source

1. **Exit code is erased.** Confirm `context-compactor.ts:148` writes `value: '[compacted]'` for cleared tool results and `context-compactor.test.ts` contains no `compacted` assertion (`grep -c "compacted"` → 0).
2. **The filter is quote-blind.** Confirm `FORBIDDEN_METACHAR_REGEX` at `run-readonly-command.ts:17` includes `|` and `$`, `maskQuoted` (`:44-75`) leaves backslashes/brackets intact, and the regex runs on the masked string at `:130` — so quoted `\|` and `[$]` trip it.
3. **Doc writes trigger code gates.** Confirm `echo-compliance.ts:261-263` flags Law 3 for any writes when `!verifiedAfterLastWrite`, and `:297-315` flags Verifier criteria for write sets meeting the thresholds, with no `fileKind`/docs classification anywhere (absence grep).
4. **Denylist is unaffected by quoting.** Confirm `DESTRUCTIVE_COMMAND_REGEX`/`GIT_MUTATING_REGEX`/`DANGEROUS_COMMAND_REGEX` run on the raw first token — quoting never bypasses the denylist, so quote-aware scanning cannot weaken it.
5. **Renderer compatibility.** Confirm the GREEN claim that the exit-code-preserving placeholder (a JSON object) renders through the existing tool-result path — `cli/src/components/blocks/tool-branch.tsx:150-151` special-cases `run_readonly_command` (no copy button) and must keep rendering.

## Amended-scope hard questions (H-05…H-07, Loop 3)

6. **The config is dead.** Confirm `common/src/util/protocol-config.ts:105` defaults `microCompact: false`, `:261-270` parses it, and grep for any production consumer of `compression.microCompact` / `compression.keepRecentTokens` / `compression.autoCompactRatio` / `compression.forceCompactRatio` outside `protocol-config.ts` and tests returns 0 hits — while `context-tokens.ts:148` calls `microCompact()` unconditionally.
7. **No pressure gate.** Confirm `context-compactor.ts:82` hardcodes `microCompactMaxKeepRecent: 3` and `:125` gates clearing purely on tool-result count with no token-pressure check.
8. **Ratios/keepRecentTokens never reach the trigger.** Confirm `agents/savant/handle-steps.ts:92` bakes `forceRatio = 0.9` and `:159` bakes `* 0.8` as literals in the serialized source, and `agents/context-pruner/main.ts:177-178` reads `keepRecentTokens` only from its own params (never passed by the savant spawn).
9. **Fail-loud fallback is safe.** Confirm the GREEN amendment (warn + explicit marker instead of hard error when the window is unresolved, preserving `?? 200_000` as a labeled fallback) does not break runs with genuinely unknown windows.
10. **H-01 P0 upgrade is evidence-backed.** Confirm the session evidence cited (`dev/scratchpad/compaction-deep-dive.md` §1/§4 — 59 `[compacted]` hits, re-run spiral, NEEDS-REVIEW cascade) substantiates upgrading H-01 from high to P0.

## Amendment-2 hard questions (H-08…H-12, Loop 4 — model unification)

11. **teacher-forge paid hardcode.** Confirm `cli/src/teacher/forge.ts:43` is `model: 'deepseek/deepseek-v4-pro'` and `:139-140` (`createTeacherForge`) reads only `loadSavantCodeModelPreference()` — and that grep for `getSelectedSavantFreeModel` in `forge.ts` returns 0, so the UI panel's model never reaches the teacher.
12. **Main-agent paid-default path.** Confirm `send-message-agent.ts:22-41` (`applySavantCodeModelOverride`) reads only `loadSavantCodeModelPreference()`; that `savant-free-model-store.ts:57-58` persists GUI/auto-flip selections only to the free store; and that the bundled roster (`bundled-agents.generated.ts:681`) pins `minimax/minimax-m3` — so with an empty code preference the main agent can bill a paid model.
13. **Roster width.** Confirm the count of hardcoded `model:` values in `bundled-agents.generated.ts` is ~30 and the paid set includes the cited ids (opus-4.8, gpt-5.1, v4-pro, minimax-m3, glm-5.2, kimi-k2.7, mimo-v2.5-pro).
14. **Thinker escapes.** Confirm `agents/thinker/thinker-gemini.ts:10` and `agents/thinker/thinker-with-files-gemini.ts:9` declare `inheritParentModel: false` with a paid gemini model, and that `agents/base-chat.ts:28` lists `thinker-gemini` as spawnable.
15. **Headless bypass.** Confirm `headless-run.ts:44` documents `resolvedAgent` as skipping the model override and `:157` applies only the code preference.
16. **Store fail-safe is the fix's foundation.** Confirm the GREEN claim that `getSelectedSavantFreeModel()` resolves via `resolveInitialSelectedModel` (`savant-free-model-store.ts:46-66`) and can never return a paid fallback (`openrouter/free` in the paid build, free-catalog default in the free build) — so making it the single source cannot silently bill a paid model.
17. **H-08/H-09 P0 ratings.** Confirm the operator-reported live failures (teacher forge credit error on a free provider; "keeps defaulting to minimax") substantiate P0 for the paid-model escapes.

## Adversarial checks already run in the FID's Perfection Loop

- Fail-open semantics for the compacted placeholder shape (context-budget guard: single small JSON object, never the full stdout).
- The Law 3/Verifier nags for docs map to `lint:md` — the tracker's verification-command detection (`echo-compliance.ts:31`) already recognizes markdownlint.
- EHEL enforcement for code writes is unchanged (Laws 1/3/7/8/15 still apply to code).
- R5/R7 (phase-gating UX, verbosity knob) are parked — harness redesigns, not defects, out of this FID's scope.

## Authorization boundary

This request authorizes no implementation, closure, commit, push, release, publication, or deployment. A PASS marks the plan converged and code-grounded; operator approval is then required before any code, and a separate implementation-audit request must precede closure.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim.
4. Explicit confirmation this is planning review only and does not authorize production changes or release activity.
