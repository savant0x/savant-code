# FID: First-Run Provider-Key Onboarding for Fresh npm Installs

**Filename:** `FID-2026-0802-003-first-run-provider-onboarding.md`
**ID:** FID-2026-0802-003
**Severity:** medium
**Status:** closed
**Created:** 2026-08-02 12:30
**Author:** Savant

---

## Summary

A user who installs `savant-code` from npm into a new directory can start the CLI,
submit a prompt, and receive the raw error `OpenCode Go API key not set. Set
OPENCODE_GO_API_KEY environment variable.` The provider implementation and the
built-in provider list are correct. The defect is first-run discoverability and
onboarding: the supported CLI setup command (`/provider`) and the global credential
location are not surfaced before the first request, so a new user does not know
where the key is read from or how to configure it.

This FID is limited to making the existing provider setup flow discoverable,
preventing a keyless first request from reaching the SDK, and documenting the
supported setup paths. It does not add or remove providers, change the default
provider policy, require a project-local `.env` file, or change provider routing.

## Environment

- **OS:** Windows 11 (`win32`); commands run through Bash in this development environment
- **Language/Runtime:** TypeScript monorepo; Bun 1.3.14; strict TypeScript
- **Tool Versions:** OpenTUI/React CLI; npm release wrapper; Bun test
- **Commit/State:** Dirty local worktree containing pre-existing 0.0.12 recovery and provider work; no reset, checkout,
  commit, push, or remote operation performed for this FID
- **Observed distribution:** Published npm installation in a new directory
- **Governing protocol:** FreeBuff ECHO Protocol v0.1.2-freebuff, `freebuff.protocol.strict_mode: true`

## Detailed Description

### Problem

A fresh npm user has no saved provider credential and normally does not have the
repository's development environment or `.env.local`. The CLI nevertheless boots
into direct OpenCode Go mode and allows the user to submit a normal prompt. The
first visible failure is then an SDK exception that names an environment variable,
without explaining that the key can be entered through the CLI and persisted
outside the project directory.

The user-facing setup that already exists is:

```text
/provider
```

or:

```text
/provider opencode-go
```

The command opens the provider setup input, masks the key, and saves it to the
user-level credentials file. That flow is not sufficiently discoverable on a fresh
install.

### Expected Behavior

On a fresh install with no provider key, the user should receive clear, actionable
setup guidance before any model request is attempted:

1. The CLI identifies that the selected direct provider needs configuration.
2. It explains that the user can run `/provider opencode-go` (or use `/provider`)
   and paste the key into the masked CLI prompt.
3. It explains that the key is stored globally in the user configuration directory,
   not in the current project directory.
4. It documents the environment-variable alternative for automation or users who
   prefer shell configuration.
5. If the user submits a normal prompt before configuring a key, the CLI gives the
   same actionable guidance and does not call the provider SDK.
6. Once configured, the existing persisted-key startup path continues to work for
   new projects without requiring repeated setup.

### Root Cause

The startup call graph intentionally enables direct mode without requiring a key:

```text
cli/src/index.tsx:222  initializeApp({ cwd })
cli/src/index.tsx:227  applyPersistedProviderApiKeys()
cli/src/index.tsx:231  applyPersistedDirectProviderSettings()
cli/src/index.tsx:235  detectOllamaAndConfigureDirectProvider()
cli/src/index.tsx:240  configureDefaultDirectProvider()
```

`configureDefaultDirectProvider()` deliberately sets `DIRECT_PROVIDER` and
`INFERENCE_BASE_URL` even when the selected gateway key is absent. This allows the
CLI to boot in direct mode, but there is no corresponding pre-request onboarding
state or startup message. The SDK is therefore the first layer that reports the
missing key.

The `/provider` command and persistence mechanism are present and reachable, but
are discoverable only if the user already knows the command or reads the relevant
README section.

### Evidence

The following evidence was read from the current source tree. It describes the
existing implementation; it does not claim that the published npm artifact has
been independently unpacked in this investigation.

```text
cli/src/index.tsx:224-240
  applyPersistedProviderApiKeys()
  applyPersistedDirectProviderSettings()
  detectOllamaAndConfigureDirectProvider()
  configureDefaultDirectProvider()

cli/src/utils/provider-setup.ts:15-29
  'opencode-go': {
    label: 'OpenCode Go',
    envVar: 'OPENCODE_GO_API_KEY',
    baseUrl: 'https://opencode.ai/zen/go/v1',
  }

cli/src/utils/provider-setup.ts:103-113
  Persisted keys are loaded from credentials.json and copied into process.env
  only when the shell environment does not already provide the value.

cli/src/utils/provider-setup.ts:142-158
  configureDefaultDirectProvider() selects the saved provider preference or the
  default provider and sets direct mode without inventing a key.

cli/src/commands/command-registry.ts:704-760
  /provider opens the provider picker; /provider opencode-go enters masked key
  setup and tells the user the key is stored locally in credentials.json.

cli/src/utils/config-dir.ts:15-30
  Production config directory resolves to the user's home directory plus
  `.savant-code`.

cli/src/utils/auth.ts:41-45
  getCredentialsPath() resolves to <config directory>/credentials.json.

common/src/constants/savant-code-config.ts:7-12
  Production config directory name is `.savant-code`.

README.md:282
  The README mentions OpenCode Go and the provider command, but the fresh-start
  flow and global credentials location are not presented prominently enough for
  a new npm user.

sdk/src/impl/model-provider.ts:203
  Missing-key error: "OpenCode Go API key not set. Set OPENCODE_GO_API_KEY
  environment variable."

User-observed npm behavior
  Agent run error: OpenCode Go API key not set. Set OPENCODE_GO_API_KEY
  environment variable.
```

The current provider setup tests cover saving and restoring keys, precedence of
shell values, and provider metadata. They do not prove that a fresh startup gives
onboarding guidance or that a keyless first prompt is stopped before the SDK is
called.

## Impact Assessment

### Affected Components

- `cli/src/index.tsx` — startup/provider onboarding state is initialized here
- `cli/src/utils/provider-setup.ts` — provider metadata, persisted-key loading,
  and direct-mode selection
- `cli/src/commands/command-registry.ts` — existing `/provider` command and picker
- `cli/src/chat.tsx` — initial empty-chat onboarding guidance in the existing
  chat mount lifecycle
- `cli/src/commands/router.ts` — the single pre-request guard seam in
  `routeUserPrompt`, after known slash-command dispatch and before regular
  message queue/send handling
- `cli/src/utils/__tests__/provider-setup.test.ts` — provider persistence and
  onboarding-state coverage
- `cli/src/commands/__tests__/router-provider-setup.test.ts` — existing command
  setup coverage; extend only if needed
- `cli/release/README.md` — exact production npm README shipped by
  `cli/release/package.json`
- `README.md` — repository-facing documentation kept aligned with the shipped
  install instructions; this root README is not the npm package payload
- npm/release smoke coverage, if an existing release-level fixture can exercise
  the startup path without network access

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Fresh users encounter a confusing first-run failure; CLI workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

### Security Constraints

- Never print or log the provider key.
- Continue masking the interactive provider-key input.
- Preserve shell environment precedence over persisted credentials.
- Keep credentials in the existing user-level `credentials.json` path with the
  current best-effort file permission behavior.
- Do not add real keys, dummy secrets, or credential-shaped values to fixtures,
  documentation, logs, or the repository.

## Proposed Solution

### Approach

Preserve the existing provider architecture and make its setup path explicit at
first run. Add one shared, provider-aware determination of whether the active
direct provider has a usable credential. Use it at two exact CLI boundaries:

1. **Initial guidance:** in `cli/src/chat.tsx`, immediately after the
   `useChatState()` destructuring that provides `messages` and `setMessages`, add
   one `useEffect` with a `useRef`-backed emitted flag. On the first render where
   `messages.length === 0`, call the shared missing-provider helper; if it returns
   setup metadata, append exactly one non-secret `getSystemMessage(...)` guide
   through `setMessages`. The effect depends only on `messages.length` and
   `setMessages`, and the ref prevents rerender duplication. It must not emit when
   the chat history is non-empty, backend auth is active, or Ollama/local mode is
   active.
2. **Pre-request guard:** in `routeUserPrompt` in
   `cli/src/commands/router.ts`, add the sole guard immediately before the final
   regular-message `saveToHistory(trimmed)` call, after provider setup, all other
   input modes, and known-command dispatch. The guard evaluates only when
   `isSlashCommand(trimmed)` is false and the input mode is the ordinary default
   path. If the active direct gateway lacks its key, append the same guide and
   return without invoking `sendMessage`. Unknown slash commands bypass this
   guard because they satisfy `isSlashCommand(trimmed)` and continue through the
   router's existing history/error path.

The guard must bypass every slash command—including unknown slash commands—as
well as bash, plan, interview, review, image, provider-setup, backend-auth, and
Ollama/local paths. The exact UI must reuse existing chat system-message and
provider-setup helpers; it must not create a second provider setup implementation.
The existing `/provider` command remains the canonical way to enter and persist
the key. A shell environment variable remains an alternative and continues to
take precedence.

### Provider Resolution Truth Table

The missing-key helper evaluates the already-resolved startup state; it does not
reimplement startup precedence or infer a provider from the error string.

| Startup state | Active mode/provider | Key source | Onboarding guard |
|---|---|---|---|
| `getAuthTokenDetails().source` is `credentials` or `environment` | Savant backend | Backend auth | Bypass; do not show gateway guidance |
| Explicit `DIRECT_PROVIDER`/`INFERENCE_BASE_URL` selects a configured gateway | That gateway | Explicit env key, otherwise persisted key loaded by startup | Show guidance only when that gateway's configured `envVar` is absent |
| Persisted gateway key is found with no explicit direct/backend mode | Persisted gateway provider | `credentials.json` → process env | Key is present; bypass guidance |
| Persisted direct provider is `ollama` | Ollama/local | No gateway key required | Bypass; local inference is keyless |
| Ollama is auto-detected and configured | Ollama/local | No gateway key required | Bypass; local inference is keyless |
| No backend, direct, persisted, or auto-configured local provider | Default `opencode-go` | None | Show OpenCode Go guidance |

Explicit shell values remain authoritative because `applyPersistedProviderApiKeys()`
does not overwrite a non-empty environment variable. Backend precedence is based
on `getAuthTokenDetails().source` being `credentials` or `environment`; the
`direct-provider-bypass` stub token must not suppress gateway onboarding.

### Steps

1. Add or extend one provider-setup helper that returns setup metadata only for
   the active configured gateway whose `envVar` is missing. Derive the metadata
   from `PROVIDER_SETUP_CONFIG`; do not duplicate provider names or environment
   variables. Determine backend precedence from `getAuthTokenDetails().source`,
   not from the presence of a direct-mode stub token. Treat backend-auth, `ollama`,
   and absent direct-provider state as non-gateway cases according to the truth
   table above.
2. In `cli/src/chat.tsx`, use the helper in the exact post-`useChatState()`
   one-time effect described above. Append one actionable, non-secret system
   message only for an empty initial chat; the message must include the exact
   `/provider <name>` command, explain masked CLI entry and global persistence,
   and mention the environment-variable alternative.
3. In `cli/src/commands/router.ts`, add the sole pre-request guard in
   `routeUserPrompt` immediately before the final ordinary-message
   `saveToHistory(trimmed)` call. Guard only non-slash default prompts; explicit
   `isSlashCommand(trimmed)` bypasses the guard so known and unknown slash
   commands remain reachable. Unknown slash commands continue through their
   existing history/error path. The guard appends the same guidance and returns
   before queueing or `sendMessage`.
4. Reuse the current masked provider input and `saveProviderApiKey()` persistence
   flow; do not add a project-local `.env` file or manual JSON editing requirement.
5. Update the exact production npm README at `cli/release/README.md` with:
   - `npm install -g savant-code` and `savant-code`
   - `/provider opencode-go` or `/provider`
   - masked key entry
   - Windows path: `C:\Users\<username>\.savant-code\credentials.json`
   - macOS/Linux path: `~/.savant-code/credentials.json`
   - PowerShell, Command Prompt, and POSIX environment-variable alternatives
   Keep the repository `README.md` instructions aligned; do not treat the private
   `cli/release-staging/README.md` as the production documentation target.
6. Add isolated tests using a temporary config directory and explicitly controlled
   environment values. Tests must prove:
   - the helper identifies only a missing active gateway key;
   - no key produces actionable startup guidance;
   - a persisted key is restored on startup;
   - a shell key takes precedence;
   - a keyless ordinary prompt appends guidance and does not call the mocked
     `RouterParams.sendMessage` seam;
   - slash-command dispatch, especially `/provider opencode-go`, remains available;
   - Ollama/local mode and backend-auth mode do not produce gateway guidance;
   - no synthetic key appears in messages, history, logs, or test output.
7. Validate the production documentation payload locally with
   `npm pack ./cli/release --dry-run` (or the repository's equivalent release
   dry-run command), without publishing, contacting GitHub, or modifying release
   state. If the release fixture cannot run without generated artifacts, record
   that limitation and rely on the focused CLI tests plus a static package-file
   assertion.

### Scope Constraints

| In scope | Out of scope |
|---|---|
| First-run guidance for missing direct-provider credentials | Changing the built-in provider list |
| Pre-request guard before SDK invocation | Adding/removing provider implementations |
| Documenting `/provider` and credential locations | Changing default provider selection |
| Reusing existing persistence and masking | Requiring a project-local `.env` file |
| Fresh-install/provider onboarding tests | Changing provider API URLs, protocols, or model catalogs |
| npm/release startup fixture where practical | GitHub, remotes, commits, or release publishing |

### Verification

Document-level verification after implementation must include:

1. `cd cli && bun test src/utils/__tests__/provider-setup.test.ts`
2. `cd cli && bun test src/commands/__tests__/router-provider-setup.test.ts`
3. The new fresh-install/onboarding test suite with a temporary config directory
   and no network access.
4. `cd cli && bun run typecheck`
5. Targeted ESLint with `--max-warnings 0` on every changed TypeScript file.
6. `git diff --check` on the declared changed files.
7. Call-graph grep proving the missing-key helper is called from the exact
   post-`useChatState()` `Chat` effect and the exact pre-`saveToHistory` guard in
   `routeUserPrompt`, with zero duplicate provider-key implementations.
8. Manual documentation review confirming `cli/release/README.md` contains the
   shipped npm setup flow and does not imply that a project-local `.env` or
   hand-edited credentials file is required.
9. `npm pack ./cli/release --dry-run` (or documented local equivalent), with no
   publish, GitHub, remote, or release-state operation.

No verification claim may be recorded as passed until tool output exists.

## Perfection Loop

### Loop 1 — RED (2026-08-02, prior document pass)

- **Issues identified:** Fresh npm users can reach the first request without
  knowing how to configure the default OpenCode Go key. The raw SDK exception is
  technically accurate but not an adequate onboarding path.
- **Call graph:** `cli/src/index.tsx` loads persisted keys and configures direct
  mode before rendering; `/provider` is reachable from the command registry; the
  SDK missing-key error is downstream of prompt submission.
- **Existing coverage:** Provider persistence tests cover saved/shell keys and
  provider metadata. Existing command tests cover provider setup. No test proves
  fresh-start guidance or prevents a keyless request from invoking the SDK.
- **Scope decision:** Keep provider implementations and the built-in provider
  list unchanged. No production code was modified while creating this FID.

### GREEN — converged (2026-08-02)

- **Proposed design:** Reuse provider setup metadata and persistence; add one
  active-gateway missing-key helper; show one deduplicated initial-chat guide;
  guard ordinary prompts at `routeUserPrompt`; update the production release
  README and aligned root README; add isolated no-network tests.
- **Design rationale:** This is the smallest complete fix for the observed failure.
  The CLI—not the SDK—knows how to open `/provider` and where credentials persist.
  A guard at the shared routing boundary prevents a keyless SDK call while the
  command dispatcher remains available. Active direct-provider state preserves
  Ollama and backend precedence.
- **Exact implementation owner/seam:** `cli/src/utils/provider-setup.ts` owns
  metadata/helper logic; `cli/src/chat.tsx` owns one `useEffect` immediately after
  `useChatState()` destructuring, guarded by `messages.length === 0` and a ref;
  `cli/src/commands/router.ts::routeUserPrompt` owns the sole pre-request guard
  immediately before ordinary-message `saveToHistory`; `cli/release/README.md`
  is the production npm documentation target.
- **Test seam:** `RouterParams.sendMessage` is injected as a mock in
  `router-provider-setup.test.ts`; the keyless ordinary-prompt test must assert
  it is not called and that `setMessages` receives the setup guide. The provider
  request/SDK is never imported or contacted by this test.
- **Implementation status:** Implemented after user approval. The shared missing-provider
  helper, startup guidance, route guard, tests, and npm documentation now match the
  converged design.

### AUDIT — FID design audit (2026-08-02, final)

- **Guard seam:** Exact and singular: `routeUserPrompt`, immediately before
  ordinary-message `saveToHistory`, after provider setup, all other input modes,
  and known-command dispatch. An explicit `isSlashCommand(trimmed)` bypass keeps
  `/provider` and every other command reachable; unknown slash commands continue
  through the router's existing history/error path after the guard point.
- **Initial guidance seam:** Exact: the first `useEffect` after `useChatState()`
  destructuring checks `messages.length === 0`, calls the shared helper, and uses
  a ref to emit at most one guide per mounted chat.
- **Provider precedence:** The truth table is explicit and uses the startup-resolved
  `DIRECT_PROVIDER` plus `getAuthTokenDetails().source`; no helper reimplements
  startup order or mistakes the direct-mode stub token for backend auth.
- **Documentation target:** Production package metadata proves `cli/release/README.md`
  is shipped. `cli/release-staging/README.md` is private staging content and is
  excluded from the production-doc requirement.
- **Test seam:** Mocked `RouterParams.sendMessage` and controlled temporary config /
  environment provide deterministic, no-network proof; secrets are synthetic and
  must not enter messages or logs.
- **Remaining audit risk:** None at the FID-design level. Implementation must
  preserve the specified effect placement, ref deduplication, auth-source check,
  and slash-command bypass, including the existing downstream unknown-command
  history/error behavior; those are implementation-audit criteria, not open design
  questions.
- **FID audit result:** PASS after SELF-CORRECT — the four prior review findings
  and the two audit ambiguities are resolved; no unresolved design blocker remains.

### CHANGE DELTA

FID Loop 2 document update only; no production-code change. The FreeBuff protocol
metadata correction and RED re-audit preserve the already-converged implementation
seams and resolve the remaining governance inconsistency.

### Missed Questions

1. **Is the provider list stale or incorrect?**
   Answer: No. The built-in provider list is intentional and out of scope. The
   defect is onboarding discoverability.
2. **Should users create a project-local `.env` file?**
   Answer: No. The canonical interactive path is `/provider`; persisted credentials
   belong in the user-level `.savant-code/credentials.json`. A shell environment
   variable is an optional alternative.
3. **Should the CLI automatically open the key prompt?**
   Answer: No automatic modal is required. Emit one actionable initial-chat guide
   and keep `/provider` available; this avoids trapping users who intend to use
   Ollama, another provider, or shell configuration.
4. **Should missing-key detection live in the SDK?**
   Answer: No for this FID. The SDK already reports the provider error correctly;
   onboarding belongs at the CLI boundary, where `/provider` and persisted
   credentials are available.
5. **What happens if Ollama is installed or another provider is selected?**
   Answer: Evaluate the startup-resolved active mode. Backend auth and Ollama/local
   mode bypass gateway guidance; a configured gateway checks only its own metadata
   `envVar`; the default unresolved direct mode maps to OpenCode Go.
6. **Can a pre-request guard accidentally block slash commands?**
   Answer: It must not. Guard normal model prompts at the existing routing/send
   boundary and leave command dispatch, especially `/provider`, reachable.
7. **What does “stored locally” mean on each platform?**
   Answer: Production resolves the home directory plus `.savant-code`, with
   `credentials.json` beneath it. Windows is `C:\Users\<username>\.savant-code\credentials.json`;
   macOS/Linux is `~/.savant-code/credentials.json`.
8. **Can tests use a real key or the developer's environment?**
   Answer: No. Use temporary config directories and synthetic non-secret values;
   explicitly isolate and restore environment variables.
9. **Which documentation is actually shipped to npm users?**
   Answer: `cli/release/package.json` lists `README.md` in its `files` array, so
   `cli/release/README.md` is the production target. The private staging README is
   not substituted for it; the root README is kept aligned separately.
10. **How will we prove no provider request is made before setup?**
    Answer: Pass a mocked `RouterParams.sendMessage` to `routeUserPrompt` and assert
    it is not called for a keyless ordinary prompt, while `setMessages` receives
    the guide. The test does not import the SDK or contact a real API.
11. **Which ECHO protocol governs this session?**
    Answer: FreeBuff ECHO v0.1.2-freebuff from
    `dev/nova/specs/echo-v0.1.2-freebuff.md`, with `freebuff.protocol` in
    `protocol.config.yaml`. The Savant harness `ECHO.md` is explicitly out of
    scope for this FreeBuff loop.

### Loop 2 — FreeBuff protocol correction and RED re-audit (2026-08-02)

- **RED:** The prior FID pass used the Savant harness protocol label
  (`ECHO Protocol v0.2.0`) in its Environment section. `ECHO-freebuff.md`,
  `FREEREADME.md`, and `dev/nova/specs/echo-v0.1.2-freebuff.md` establish that
  FreeBuff sessions are governed by `dev/nova/specs/echo-v0.1.2-freebuff.md`
  and `freebuff.protocol` in `protocol.config.yaml`. The prior FID wording also
  left the Chat lifecycle as conditional; current source evidence shows the
  exact `useChatState()` destructuring at `cli/src/chat.tsx:191-211`, so the
  startup seam is concrete.
- **GREEN:** Corrected the FID Environment metadata to FreeBuff ECHO v0.1.2,
  removed the conditional component wording, and retained the exact post-
  `useChatState()` effect, pre-ordinary-message `saveToHistory` guard,
  `getAuthTokenDetails().source` precedence, production README target, and
  mocked `RouterParams.sendMessage` test seam. No production code was changed.
- **SELF-CORRECT:** The first audit identified that the protocol correction was
  described inside Loop 2 but lacked an explicit FreeBuff FSM phase. Added this
  standalone SELF-CORRECT record and routed the FID back through AUDIT without
  changing the implementation plan or any production file.
- **AUDIT:** Read-only evidence confirms the FID exists, every referenced
  production path exists, the current router contains the ordinary-message
  `saveToHistory` seam, `cli/release/package.json` ships `README.md`, and the
  production files were already dirty before this FID-only pass. The FreeBuff
  protocol correction is now reflected in the FID. No unresolved plan issue
  remains.
- **CHANGE DELTA:** FID document metadata and one affected-component wording
  correction only; no implementation or non-FID file change.

### SELF-CORRECT — FreeBuff FSM documentation correction (2026-08-02)

- **Finding:** The protocol-identity correction was present in Loop 2, but the
  required SELF-CORRECT phase was not explicitly named.
- **Correction:** Added this explicit phase entry and preserved the converged
  GREEN plan. No production code, tests, package files, release files, commits,
  or remote operations were touched.
- **Exit condition:** Return to AUDIT for final independent review.

### Code Verification Evidence

- [x] Canonical FID path is available and does not already exist
- [x] Affected source paths were read from the current worktree
- [x] Startup/provider call-graph evidence recorded
- [x] Existing provider persistence and command coverage identified
- [x] Scope explicitly excludes provider-list and provider-implementation changes
- [x] No production code was modified during FID creation or the FreeBuff loop
- [x] Governing protocol corrected and recorded as FreeBuff ECHO v0.1.2-freebuff
- [x] GREEN phase converged with exact seams, truth table, docs target, and test seam
- [x] FID design and implementation AUDIT passed after SELF-CORRECT; implementation is complete and archived
- [x] Implementation exists and matches this FID
- [x] CLI tests pass: 13 targeted tests, 0 failures
- [x] CLI typecheck passes
- [x] Targeted lint and diff checks pass
- [x] Documentation implementation reviewed against `cli/release/README.md`
- [x] FID status updated to match implementation ground truth

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-02
- **Fix Description:** Added provider-aware first-run guidance, blocked keyless ordinary
  prompts before `sendMessage`, preserved slash-command and Ollama/backend bypasses,
  added isolated tests, and documented global credential/environment setup paths.
- **Tests Added:** Provider missing-key, precedence, bypass, no-send, slash-command,
  and secret-safety coverage in the CLI provider test suites.
- **Verified By:** Independent code review; targeted CLI tests, typecheck, ESLint,
  diff check, and local npm pack dry-run all passed.
- **Commit/PR:** None; no commit or remote operation authorized
- **CHANGELOG:** `CHANGELOG.md` → `v0.0.15`
- **Archived:** 2026-08-02 — moved to `dev/fids/archive/` after the v0.0.15 CHANGELOG entry was added

### Final Closure Audit — 2026-08-02

- **RED:** Re-read the observed npm-install failure, provider setup call graph, and
  current implementation boundaries.
- **GREEN:** Implemented provider-aware guidance, the keyless ordinary-prompt guard,
  preserved slash-command/backend/Ollama bypasses, and added isolated tests/docs.
- **AUDIT:** CLI focused tests, typecheck, lint, diff check, npm pack dry-run, and
  independent review passed; no secret appeared in user-facing output or fixtures.
- **CONVERGENCE:** PASS. The implementation matches the converged FID and is complete.

Archived to `dev/fids/archive/` on 2026-08-02 after the v0.0.15 CHANGELOG entry was added.

## Lessons Learned

- A provider can be correctly implemented while its first-run configuration path
  remains undiscoverable.
- A raw environment-variable error is not sufficient onboarding for an interactive
  CLI that already has a secure key-entry and persistence flow.
- User-level credential storage should be documented at the point of installation;
  users should not have to infer it from source code or error traces.
- Fresh-install behavior must be tested separately from source-tree development,
  because repository dotenv/environment state can mask missing onboarding paths.
