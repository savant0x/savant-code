# FID: Install Process Master — End-to-End First-Run Experience

**Severity:** High
**Status:** closed
**Filename:** `FID-2026-0729-010-install-process-master.md`
**ID:** FID-2026-0729-010
**Created:** 2026-07-29
**Closed:** 2026-07-29
**Author:** Savant (Orchestrator)

---

## Summary

This master FID owns the complete install, first-run, upgrade, and uninstall experience for Savant-Code. It consolidates the scattered install-related artifacts (README, launch friction track, package metadata, and smoke-test scripts) into a single, verifiable process. The production install path (`npm install -g savant-code`) has been validated to behave identically to the dev build, removing the last launch-blocking install risk.

---

## Environment

- **OS:** Windows 11 / macOS / Linux
- **Language/Runtime:** TypeScript 5.5 / Bun 1.3.14
- **Package Manager:** npm (production), Bun (development)
- **Package:** `savant-code` on npm
- **Current Version:** v0.0.11

---

## Supported Install Paths

### 1. Production Install (end user)

```bash
npm install -g savant-code
savant-code --help
```

- No build step required.
- Binary is `savant-code` (global).
- Verified on Windows, macOS, and Linux via the release workflow.

### 2. Development Install (contributor)

```bash
git clone <repo>
cd savant-code
bun install
```

- Requires Bun ≥ 1.3.11 (root pins 1.3.14).
- Runs against source workspaces (`cli/`, `sdk/`, `common/`, etc.).

### 3. Direct Binary Install (release artifacts)

- GitHub Releases provide platform-specific compiled binaries.
- Download, make executable, and run.
- See `README.md` → "Install from a release binary" for platform links.

---

## First-Run Setup

After install, the first run may require:

1. **Authentication** — the CLI opens a browser-based login or prompts for an API key depending on the launch mode.
2. **Model Selection (SavantFree)** — landing screen picker defaults to `MiniMax M3` (non-premium, unlimited). User can pick another model; selection persists via `savantFreeModelPreference` in `settings.json`.
3. **Model Selection (paid/direct)** — `/model` opens the live OpenRouter catalog picker; selection persists via `savantCodeModelPreference`.
4. **Local Ollama (optional direct provider)** — detected automatically if running on `http://localhost:11434`; otherwise configured via `/model` or env vars.

---

## Upgrade

### npm

```bash
npm update -g savant-code
```

### Binary

- Download the latest release binary and replace the existing one.

### Dev

```bash
git pull
bun install
```

---

## Uninstall

```bash
npm uninstall -g savant-code
```

- User config (`settings.json`, chat history) is preserved in the platform config directory by default. A separate `--purge` flag is not implemented; users may delete the config directory manually if desired.

---

## Smoke Tests

| Step | Command | Expected Result |
|---|---|---|
| 1 | `savant-code --help` | Help text prints; no crash |
| 2 | `savant-code --version` | Version matches expected |
| 3 | `savant-code` (interactive) | App launches; landing/picker renders |
| 4 | Send a simple prompt | Agent responds without auth/model errors |
| 5 | `/health` | Reports default model and backend status |
| 6 | `/model` (paid) | Live catalog loads; picker opens |
| 7 | `/end-session` (SavantFree) | Returns to model picker |

---

## Rollback Plan

If a release introduces an install regression:

1. Pin the previous working version explicitly:
   ```bash
   npm install -g savant-code@<last-known-good>
   ```
2. For compiled binaries, keep the previous release artifact available in GitHub Releases.
3. Dev rollback: `git checkout <tag>` and `bun install`.

---

## Known Issues & Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `command not found: savant-code` | npm global bin not in PATH | Add npm global bin to PATH or use full path |
| Auth loop on first run | Expired/invalid token | Run `/logout` and log in again |
| Model picker empty | OpenRouter catalog fetch failed | Retry `/model`; check network; fallback to typing exact model id |
| Ollama not detected | Ollama not running on default port | Start Ollama or set `directProviderBaseUrl` |

---

## Impact Assessment

### Affected Components

- `README.md`
- `package.json`
- `cli/package.json`
- `sdk/package.json`
- `savant-free/package.json`
- Release workflow (`.github/workflows/`)
- Smoke-test scripts (`savant-free/smoke-test.test.ts`, `sdk/smoke-test-dist.ts`)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

**Justification:** Install is working. This FID documents and verifies the process rather than fixing a broken path.

---

## Perfection Loop

### Loop 1

- **RED:** Cataloged the install surface:
  - Production npm install.
  - Dev source install.
  - Compiled binary install.
  - First-run auth, model selection, and optional Ollama setup.
  - Upgrade/uninstall paths.
  - No single FID owned the end-to-end install experience; artifacts were scattered across README, launch friction track, and smoke-test scripts.
- **GREEN:** Created this master FID as the single source of truth for the install process. Documented commands, expected behavior, smoke tests, rollback plan, and troubleshooting.
- **AUDIT:**
  - Verified `npm install -g savant-code` works and matches dev behavior (reported by user, 2026-07-29).
  - Verified `README.md` contains the correct public install command.
  - Verified `package.json` and `cli/package.json` expose the correct bin entry (`savant-code`).
  - Verified release workflow builds and publishes the package.
  - Verified smoke-test scripts exist and cover the install path.
- **CHANGE DELTA:** Documentation only (this FID). No source code changes required.

### Missed Questions

> As part of the Perfection Loop, the Thinker must ask: *"What questions should I have asked when this FID was created, but failed to?"*

1. *Which install path is the primary one for end users?* — npm global install is primary; compiled binary is secondary; dev source is for contributors.
2. *What happens when npm global bin is not in PATH?* — Documented in troubleshooting; user must add it or use the full path.
3. *Should we support a one-liner install script (curl | bash)?* — Out of scope for initial launch; can be added later if needed.
4. *How do we verify the binary install path in CI?* — Release workflow smoke-tests the binary before packaging.
5. *What config/data is left behind after uninstall?* — `settings.json` and chat history are preserved in the platform config directory; a purge step is not implemented.
6. *Is the SavantFree landing picker the first UI a new user sees?* — Yes, and it defaults to the non-premium MiniMax M3 model.

### Code Verification Evidence

- [x] `README.md` contains the correct public install command
- [x] `package.json` / `cli/package.json` bin entry is `savant-code`
- [x] Release workflow builds and publishes the npm package
- [x] Smoke-test scripts cover the installed binary/package
- [x] `npm install -g savant-code` verified to match dev behavior

---

## Verification

- `savant-code --help` prints correctly after production install.
- `savant-code --version` prints the expected version.
- Interactive launch reaches the model picker / chat UI.
- Dev build (`cd cli && bun run dev` or equivalent) still works after `bun install`.
- Typecheck passes for all affected workspaces (SDK, common, agent-runtime, CLI).

---

## Resolution

- **Fixed By:** Orchestrator
- **Fixed Date:** 2026-07-29
- **Fix Description:** Created the install-process master FID and verified the production install path matches dev behavior.
- **Tests Added:** No (existing smoke tests and release workflow cover the path)
- **Verified By:** User report + code review + typecheck
- **Commit/PR:** [pending — documentation-only FID]
- **Archived:** [pending]

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

---

## Lessons Learned

1. Install friction should be owned by a single master FID so launch-readiness checks have a single checklist.
2. A production install that behaves identically to dev removes a huge class of "works on my machine" launch risks.
3. Smoke tests should cover `--help`, `--version`, interactive launch, and one real prompt; this catches packaging and runtime regressions early.
4. The rollback plan must be documented before launch, even if it is as simple as `npm install -g savant-code@<version>`.
