<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->
# Release A-Z Test — History Session Capture + FreeBuff Protocol Directive

**Version:** v0.0.9
**Purpose:** Regression and feature verification for FID-2026-0728-008 (/history full-session capture), the FreeBuff protocol directive, and core regressions.

**Ground Rules:**
- Run from agent context (idle phase unless noted)
- Do not require user interaction unless a manual smoke test is explicitly called out
- Report pass/fail and any friction for every test
- Write the final report to `dev/scratchpad/release-az-test-fid-2026-0728-008-report.md`

**Available Tools:** read_files, glob, list_directory, spawn_agents, write_todos, basher, code_searcher

---

## Tier 1: Build & Type Safety

### T1.1 — Common workspace typecheck
- Run `cd common && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.2 — Agent-runtime workspace typecheck
- Run `cd packages/agent-runtime && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.3 — SDK workspace typecheck
- Run `cd sdk && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.4 — CLI workspace typecheck
- Run `cd cli && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.5 — llm-providers workspace typecheck
- Run `cd packages/llm-providers && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.6 — ESLint zero warnings on changed areas
- Run `bun x eslint cli/src/utils/chat-meta.ts cli/src/utils/chat-history.ts cli/src/utils/run-state-storage.ts cli/src/components/chat-history-screen.tsx cli/src/hooks/use-send-message.ts --max-warnings 0`
- **Expected:** zero warnings, zero errors

### T1.7 — Version metadata
- Read `VERSION`
- Read root `package.json`
- **Expected:** both report `0.0.9`

---

## Tier 2: /history Session Capture (FID-2026-0728-008)

### T2.1 — `completed` field added to `ChatMeta`
- Read `cli/src/utils/chat-meta.ts`
- Verify `chatMetaSchema` includes `completed: z.boolean().optional()`
- Verify `writeChatMeta` accepts a `completed` parameter defaulting to `true`
- Verify `readChatMeta` defaults missing `completed` to `true`
- **Expected:** schema, writer, and reader all support the new field with backward compatibility

### T2.2 — Mid-stream checkpoints mark sessions incomplete
- Read `cli/src/utils/run-state-storage.ts`
- Verify `saveChatStateAsync` calls `writeChatMeta(..., false)`
- **Expected:** async checkpoints persist with `completed: false`

### T2.3 — Turn-end saves mark sessions complete
- Read `cli/src/utils/run-state-storage.ts`
- Verify `saveChatState` calls `writeChatMeta(..., true)` by default
- Verify `use-send-message.ts` calls the initial save with `completed: false`
- Verify the final turn-end save in `use-send-message.ts` uses the default `completed: true`
- **Expected:** interrupted sessions stay incomplete; graceful completions are marked complete

### T2.4 — `loadMostRecentChatState` prefers filesystem over DB
- Read `cli/src/utils/run-state-storage.ts`
- Verify `loadMostRecentChatState` reads the filesystem first
- Verify it falls back to the DB only when filesystem state is missing or unreadable
- **Expected:** mid-stream filesystem checkpoints are never silently discarded in favor of stale DB snapshots

### T2.5 — `ChatHistoryEntry` carries `completed`
- Read `cli/src/utils/chat-history.ts`
- Verify `ChatHistoryEntry` has `completed?: boolean`
- Verify `getAllChats` populates `completed` from `readChatMeta`
- Verify legacy sidecars without `completed` are treated as complete
- **Expected:** history listing surfaces session completeness

### T2.6 — Unreadable chats do not conflate corruption with interruption
- Read `cli/src/utils/chat-history.ts`
- Verify unreadable entries leave `completed` unset rather than forcing `false`
- **Expected:** corruption is not falsely flagged as an interrupted session

### T2.7 — UI shows incomplete indicator
- Read `cli/src/components/chat-history-screen.tsx`
- Verify the message count renders a `!` prefix when `chat.completed === false`
- **Expected:** users can visually identify interrupted sessions in `/history`

### T2.8 — Unit tests pass
- Run `cd cli && bun test src/utils/__tests__/chat-meta.test.ts src/utils/__tests__/chat-history.test.ts src/utils/__tests__/run-state-storage.test.ts`
- **Expected:** all tests pass (56 pass / 0 fail)

---

## Tier 3: FreeBuff Protocol Directive

### T3.1 — `FREEREADME.md` exists and is clear
- Read `FREEREADME.md`
- Verify it states FreeBuff agents must NOT use `ECHO.md`
- Verify it points to `dev/nova/specs/echo-v0.1.2-freebuff.md`
- **Expected:** root-level directive is unambiguous

### T3.2 — `ECHO-freebuff.md` is a protocol marker
- Read `ECHO-freebuff.md`
- Verify it points to the canonical FreeBuff protocol at `dev/nova/specs/echo-v0.1.2-freebuff.md`
- **Expected:** a session bootstrapping with `ECHO-freebuff.md` lands at the right protocol

### T3.3 — FreeBuff protocol is distinct from Savant-Code protocol
- Read `dev/nova/specs/echo-v0.1.2-freebuff.md`
- Read `ECHO.md`
- Verify the FreeBuff version is for single-agent operation and does not reference the 9-agent roster
- **Expected:** the two protocols are clearly scoped to their respective contexts

### T3.4 — FreeBuff ECHO version header is accurate
- Verify `dev/nova/specs/echo-v0.1.2-freebuff.md` has a version header of `0.1.2-freebuff`
- **Expected:** version matches the file name

---

## Tier 4: Regression Checks

### T4.1 — `/goal` and `/loop` still work
- Read `cli/src/commands/goal.ts` and `cli/src/commands/loop.ts`
- Verify handlers are still registered in `cli/src/commands/command-registry.ts`
- **Expected:** goal/loop commands remain accessible

### T4.2 — `/login` and `/signin` still work
- Read `cli/src/commands/command-registry.ts`
- Verify `/login` and `/signin` aliases are registered
- **Expected:** login command remains accessible

### T4.3 — `/health` still works
- Read `cli/src/commands/command-registry.ts`
- Verify `/health` (aliases `status`, `check`) is registered
- **Expected:** health command remains accessible

### T4.4 — `/permissions` still works
- Read `cli/src/commands/command-registry.ts`
- Verify `/permissions` (aliases `sandbox`, `safety`) is registered
- **Expected:** permissions command remains accessible

### T4.5 — No stale `.freebuff` references in production
- Search `common/src`, `cli/src`, `sdk/src`, and `packages/agent-runtime/src` for `freebuff` (excluding test files)
- **Expected:** zero matches in production source

---

## Tier 5: Documentation & FID Hygiene

### T5.1 — FID-008 archived
- Read `dev/fids/archive/FID-2026-0728-008-history-session-capture.md`
- Verify status is `closed` and resolution fields are filled
- **Expected:** FID is archived with implementation and verification details

### T5.2 — Nova second audit exists
- Read `dev/nova/inbox/FID-2026-0728-008-nova-second-audit.md`
- Verify it contains the second-audit prompt/report structure
- **Expected:** post-implementation audit is documented

### T5.3 — CHANGELOG entry
- Read `CHANGELOG.md`
- Verify a v0.0.10 entry exists for FID-008
- **Expected:** CHANGELOG documents the history session capture fix

---

## Tier 6: CLI Smoke — /history Incomplete Indicator

### T6.1 — CLI launches
- If possible, launch the CLI with `bun run src/index.tsx --cwd ..` from `cli/`
- Verify it starts without crashing
- **Expected:** prompt appears

### T6.2 — Manual smoke test: kill mid-stream and verify /history
- **Prerequisite:** A backend is configured (local Ollama or backend token).
- Start a chat and send a prompt that triggers a run.
- While the run is in progress, kill the CLI process (`Ctrl-C` or kill -9).
- Restart the CLI.
- Run `/history`.
- **Expected:** the interrupted session appears in the list with the `!` incomplete indicator (e.g., `!2 msgs`), and the transcript includes the user message.

---

## Report Format

After all tiers, write `dev/scratchpad/release-az-test-fid-2026-0728-008-report.md` with:

1. **Executive Summary** — 3-5 sentences on v0.0.9 readiness
2. **Tier-by-Tier Results** — For each test: Status, Notes, Friction Level (none/low/medium/high)
3. **Blockers** — Any test that must be fixed before release
4. **Pre-existing Issues** — Any failures not caused by this feature
5. **Release Recommendation** — Go / No-Go with justification

---

## Summary

| Tier | Name | Tests | Purpose |
|------|------|-------|---------|
| 1 | Build & Type Safety | 7 | Does the code compile and pass lint? |
| 2 | /history Session Capture | 8 | Is FID-008 fully implemented and tested? |
| 3 | FreeBuff Protocol Directive | 4 | Is the FreeBuff protocol correctly wired and discoverable? |
| 4 | Regression Checks | 5 | Are previous features still intact? |
| 5 | Documentation & FID Hygiene | 3 | Is the FID archived and CHANGELOG updated? |
| 6 | CLI Smoke | 2 | Does the feature hold up in the real CLI? |
| **Total** | | **29** | |
