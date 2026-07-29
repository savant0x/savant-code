<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->
# Release A-Z Test — Launch Tracks v0.0.9

**Version:** v0.0.9
**Purpose:** Regression and feature verification for the v0.0.9 launch tracks: Trust & Verification (FID-003), Safety Track (FID-004), Friction Reduction (FID-005), Launch Artifacts (FID-006), and Master Launch Strategy Execution (FID-007).

**Ground Rules:**
- Run from agent context (idle phase unless noted)
- Do not require user interaction
- Report pass/fail and any friction for every test
- Write the final report to `dev/scratchpad/release-az-test-fid-2026-0728-launch-tracks-report.md`

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
- Run `bun x eslint cli/src/commands/health-command.ts cli/src/utils/ollama-onboarding.ts cli/src/utils/settings.ts cli/src/utils/openrouter-models.ts packages/llm-providers/src/ollama/detect.ts packages/llm-providers/src/ollama/index.ts --max-warnings 0`
- **Expected:** zero warnings, zero errors

### T1.7 — Version metadata
- Read `VERSION`
- Read root `package.json`
- **Expected:** both report `0.0.9`

---

## Tier 2: Trust & Verification Track (FID-2026-0728-003)

### T2.1 — Telemetry defaults to opt-in (off)
- Read `cli/src/utils/settings.ts`
- Verify the default value of `adsEnabled` / telemetry setting is `false`
- **Expected:** new users start with telemetry/ads disabled

### T2.2 — Secret redaction in logger
- Read `cli/src/utils/logger.ts`
- Verify `sanitizeSecrets` is defined and called before values are logged
- **Expected:** values whose keys look like secrets/tokens are redacted

### T2.3 — Config directory uses `.savant-code`
- Search `common/src`, `cli/src`, `sdk/src`, and `packages/agent-runtime/src` for config directory name references
- Verify `.savant-code` is used (not `.freebuff`)
- **Expected:** all runtime paths use `.savant-code[-env]/`

### T2.4 — Privacy documentation
- Read `docs/privacy.md`
- Verify it documents data boundaries, credential storage, network calls, retention, and user controls
- **Expected:** privacy architecture is documented

---

## Tier 3: Safety Track (FID-2026-0728-004)

### T3.1 — Safety registry exists
- Read `common/src/tools/safety.ts` and `common/src/tools/safety-registry.ts`
- Verify `safety-registry.ts` exports a registry mapping tool names to safety metadata (level: safe | prompt | unsafe)
- **Expected:** all registered tools have safety metadata

### T3.2 — `/permissions` slash command registered
- Read `cli/src/commands/command-registry.ts`
- Verify `handlePermissionsCommand` is registered with `/permissions`, `/sandbox`, and `/safety` aliases
- **Expected:** command is accessible via all three slash-command names

### T3.3 — `/permissions` accepts valid modes
- Read `cli/src/commands/permissions-command.ts`
- Verify it accepts `safe`, `prompt`, and `unsafe` as valid mode arguments
- **Expected:** mode is stored and applied to the current session

### T3.4 — `/permissions` rejects invalid mode
- Read `cli/src/commands/permissions-command.ts`
- Verify it returns an error message for modes other than safe/prompt/unsafe
- **Expected:** clear error message listing valid modes

### T3.5 — Sandbox engine denylist
- Search `packages/agent-runtime/src` for sandbox or safety enforcement logic
- Verify destructive shell commands (rm -rf, git push --force, etc.) are denied in safe mode
- **Expected:** denylist blocks destructive operations when in safe mode

### T3.6 --permission-mode CLI flag
- Search `cli/src` for `permission-mode` or `permissionMode` flag parsing
- Verify the CLI parses `--permission-mode safe|prompt|unsafe` at startup
- **Expected:** flag sets initial permission mode before any commands run

### T3.7 — Network gating
- Read `packages/agent-runtime/src/tools/sandbox/engine.ts`
- Verify `createDefaultSandboxPolicy` sets `allowNetwork` based on permission mode
- Verify `evaluateToolCall` denies network tools in `safe` mode, returns `prompt` in `prompt` mode, and allows them in `unsafe` mode
- **Expected:** network access respects permission mode settings

---

## Tier 4: Friction Reduction Track (FID-2026-0728-005)

### T4.1 — Ollama detection utility exists
- Read `packages/llm-providers/src/ollama/detect.ts`
- Verify it probes `/api/version` and `/api/tags`, honoring `OLLAMA_HOST`
- **Expected:** detection returns model list and version when Ollama is running

### T4.2 — Ollama detection tests pass
- Run `cd packages/llm-providers && bun test src/ollama/__tests__/detect.test.ts`
- **Expected:** all tests pass

### T4.3 — First-run Ollama onboarding
- Read `cli/src/utils/ollama-onboarding.ts`
- Verify it auto-configures direct-provider mode when Ollama is detected
- Verify it persists the direct-provider choice across sessions
- **Expected:** first-run users with Ollama are not prompted for provider setup

### T4.4 — Onboarding tests pass
- Run `cd cli && bun test src/utils/__tests__/ollama-onboarding.test.ts`
- **Expected:** all tests pass

### T4.5 — `/health` slash command
- Read `cli/src/commands/health-command.ts`
- Verify it reports Ollama status, provider mode, model preference, and permission mode
- Verify it is registered in `cli/src/commands/command-registry.ts`
- **Expected:** `/health` is accessible

---

## Tier 5: Launch Artifacts Track (FID-2026-0728-006)

### T5.1 — docs/launch directory exists
- List `docs/launch/`
- Verify all planned files exist: `hn-post.md`, `hn-first-comment.md`, `twitter-thread.md`, `mastodon-thread.md`, `newsletter-pitch.md`, `incident-response.md`
- **Expected:** all files present

### T5.2 — Landing page static files
- List `docs/launch/landing/`
- Verify `index.html` exists
- **Expected:** static landing page is ready for deployment

### T5.3 — README hero updated
- Read `README.md`
- Verify the hero section has a one-sentence pitch, install command, and Ollama setup instructions
- **Expected:** README is optimized for launch traffic

### T5.4 — Markdown lint on launch docs
- Run `bun x markdownlint-cli2 docs/launch/*.md --config .markdownlint.json`
- **Expected:** zero issues

---

## Tier 6: Master Launch Strategy (FID-2026-0728-007)

### T6.1 — All child FIDs archived
- Read `dev/fids/archive/FID-2026-0728-003-launch-trust-verification.md`
- Read `dev/fids/archive/FID-2026-0728-004-launch-safety-track.md`
- Read `dev/fids/archive/FID-2026-0728-005-launch-friction-reduction.md`
- Read `dev/fids/archive/FID-2026-0728-006-launch-artifacts-track.md`
- Verify all have status `closed` and archived date set
- **Expected:** all child tracks are closed

### T6.2 — Master FID archived
- Read `dev/fids/archive/FID-2026-0728-007-launch-strategy-master.md`
- Verify status is `closed` and Launch Captain is assigned
- **Expected:** master FID is closed

### T6.3 — CHANGELOG entries
- Read `CHANGELOG.md`
- Verify entries for FID-003 through FID-007 are present under v0.0.9
- **Expected:** CHANGELOG documents all launch tracks

---

## Tier 7: Regression Checks

### T7.1 — `/goal` and `/loop` still work
- Read `cli/src/commands/goal.ts` and `cli/src/commands/loop.ts`
- Verify handlers are still registered in `cli/src/commands/command-registry.ts`
- **Expected:** goal/loop commands remain accessible

### T7.2 — `/login` and `/signin` still work
- Read `cli/src/commands/command-registry.ts`
- Verify `/login` and `/signin` aliases are registered
- **Expected:** login command remains accessible

### T7.3 — No stale `.freebuff` references in production
- Search `common/src`, `cli/src`, `sdk/src`, and `packages/agent-runtime/src` for `freebuff` (excluding test files)
- **Expected:** zero matches in production source

---

## Tier 8: CLI Smoke (if tmux available)

### T8.1 — CLI launches
- If possible, launch the CLI with `bun run src/index.tsx --cwd ..` from `cli/`
- Verify it starts without crashing
- **Expected:** prompt appears

### T8.2 — `/health` returns status
- In the CLI, run `/health`
- **Expected:** health report is displayed with provider and Ollama status

### T8.3 — `/permissions safe` sets safe mode
- In the CLI, run `/permissions safe`
- **Expected:** permission mode updates to `safe`

### T8.4 — Ollama auto-detection on first launch
- Clear any saved settings and launch the CLI with Ollama running
- **Expected:** CLI routes to local Ollama without prompting for provider setup

---

## Report Format

After all tiers, write `dev/scratchpad/release-az-test-fid-2026-0728-launch-tracks-report.md` with:

1. **Executive Summary** — 3-5 sentences on v0.0.9 launch readiness
2. **Tier-by-Tier Results** — For each test: Status, Notes, Friction Level (none/low/medium/high)
3. **Blockers** — Any test that must be fixed before release
4. **Pre-existing Issues** — Any failures not caused by this feature
5. **Release Recommendation** — Go / No-Go with justification

---

## Summary

| Tier | Name | Tests | Purpose |
|------|------|-------|---------|
| 1 | Build & Type Safety | 7 | Does the code compile and pass lint? |
| 2 | Trust & Verification | 4 | Is the privacy/BYOK positioning hardened? |
| 3 | Safety Track | 7 | Is the sandbox engine complete and wired? |
| 4 | Friction Reduction | 5 | Is Ollama onboarding frictionless? |
| 5 | Launch Artifacts | 4 | Are launch assets present and lint-clean? |
| 6 | Master Launch Strategy | 3 | Are all launch FIDs closed and documented? |
| 7 | Regression Checks | 3 | Are previous features still intact? |
| 8 | CLI Smoke | 4 | Does the feature hold up in the real CLI? |
| **Total** | | **37** | |
