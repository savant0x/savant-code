<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID-2026-0818-009 — Discord Rich Presence: in-process, cross-platform activity broadcast

**Severity:** medium
**Status:** closed
**ID:** FID-2026-0818-009
**Filename:** `FID-2026-0818-009-discord-rich-presence.md`
**Created:** 2026-08-18

## Summary

Discord Rich Presence for Savant-Code: an in-process, cross-platform
subscriber that broadcasts a sanitized snapshot of the harness state — active
agent, Perfection Loop phase, and high-level task — to the operator's local
Discord client. Inspired by Devvy's privacy posture (project basename only,
never code/paths/credentials) but internalized: no daemon, no loopback HTTP,
no admin privileges. Four modules live beside the existing chat store
(`presence-ipc.ts`, `presence-selector.ts`, `presence-privacy.ts`,
`presence-mapper.ts`) plus three `/presence` slash commands. Rich Presence
only — the Embedded App SDK "Activities" surface is out of scope (it needs a
hosted HTTPS app + live egress, conflicting with local-first/zero-cloud;
operator-confirmed 2026-08-18).

## Environment

- `@xhayper/discord-rpc` — the maintained, type-safe fork of `discordjs/RPC`
  (repo `xhayper/discord-rpc` → `Khaomi/discord-rpc`). API: `new Client({ clientId })`,
  `client.on('ready')`, `client.user?.setActivity(...)`, `client.login()`.
  Handles IPC framing, handshake, socket discovery, reconnect, and
  `SET_ACTIVITY`. Library-first (operator 2026-08-18); raw IPC is a documented,
  evidence-gated fallback only if the Bun/Windows named-pipe failure
  reproduces.
- `common/src/types/session-state.ts:110` — `AgentActivity` kinds
  (`idle | thinking | tool | subagent | researching`) — the activity source.
- `cli/src/state/chat-store.ts` — Zustand + Immer store — the subscription
  source (`subscribe`, no React re-render).
- `cli/src/utils/settings/io.ts` — `getSettingsPath()`/`loadSettings()`/
  `saveSettings()` (settings.json) — the `/presence disable` persistence home
  (NOT credentials.json; that file is 0600 secrets-only).
- `cli/src/utils/settings/preferences.ts` — `saveAnalyticsEnabled`/
  `loadAnalyticsEnabled` — the boolean-preference persistence pattern.
- `cli/src/utils/auth.ts:41` — `getConfigDir()` + `credentials.json` path.
- `cli/src/commands/telemetry.ts` — `/telemetry` command (uses
  `saveAnalyticsEnabled`/`loadAnalyticsEnabled`) — the `/presence` pattern.
- `cli/src/commands/defs/chat.ts` — `/permissions` + `/verify` (`:88`) — the
  `defineCommandWithArgs` registration pattern.
- `cli/src/commands/command-registry.ts:67` — `COMMAND_REGISTRY` (registration
  site).
- `cli/src/utils/finish-logic.ts` — `resetUiToIdle('slash-command')` pattern
  used by command handlers.
- `cli/package.json:60` — `zod ^4.2.1` (imported in `cli/src/utils/auth.ts:5`).

## Detailed Description

### Problem

The harness's internal state — which agent is active, which Perfection Loop
phase is running, what task is in flight — is broadcast to the OpenTUI
sidebar but trapped inside the local terminal. There is no social signal that
tells a teammate (looking at Discord, not the terminal) what Savant-Code is
doing. Devvy proves the value, but its daemon + loopback-HTTP architecture is
macOS-only, needs a separate process, and duplicates state plumbing that
Savant-Code already owns in its Zustand store.

### Expected Behavior

When the operator has Discord running, their presence shows the project
basename, active model, active agent (via a large image asset), and the
current Perfection Loop phase. It updates on meaningful transitions only
(rate-limited to 5 updates / 20 s), never leaks paths/code/credentials,
degrades to a dormant polling state when Discord is absent, and can be
enabled/disabled/queried with `/presence enable | disable | status`. The
preference persists across sessions.

### Root Cause

No component consumes the Zustand store as a presence source, and no Discord
IPC client exists. The pieces (state store, activity pipeline, settings
persistence, slash commands) all exist; they were never composed into a
presence publisher.

### Evidence

- `code_search` for `discord|rich-presence|RPC|presence` returns only the
  community link (`WINDOWS.md:230`) and the design doc — no existing client.
- `common/src/types/session-state.ts:110` — activity kinds exist but are
  TUI-only consumers today.
- `cli/src/utils/settings/io.ts` — settings.json persistence exists; the
  blueprint's `credentials.json` home is a correction (credentials.json is
  0600 secrets, `docs/privacy.md:32` names settings.json for preferences).

## Impact Assessment

### Affected Components

- `cli/src/state/presence/` (new) — `presence-ipc.ts`, `presence-selector.ts`,
  `presence-privacy.ts`, `presence-mapper.ts`.
- `cli/src/commands/` — `/presence` command + `command-registry.ts` registration.
- `cli/src/index.tsx` / `init-app.ts` — boot-time `PresenceService`
  instantiation (non-blocking).
- `cli/src/utils/settings/` — `presenceEnabled` preference (types, validation,
  defaults).
- `cli/package.json` — `@xhayper/discord-rpc` dependency.

### Risk Level

- [x] Medium-high: this is the first outbound network surface to a third-party
  client. The exposure is metadata only (basename, model, phase, agent), but a
  redaction bug would leak file paths or credentials to Discord. Mitigated by
  a mechanical redactor + Zod outbound schema with a fail-closed safe payload,
  and by Law 12 (no sensitive data in the payload, ever).

### Out of scope (explicit, recorded)

- **Discord "Activities" / Embedded App SDK** (the interactive embedded-app
  surface, distinct from Rich Presence "Activity") — out of scope; this
  feature is Rich Presence (RPC) only (operator-confirmed 2026-08-18).
- **Discord bot / gateway / webhook integration** (reading or posting to
  channels) — presence is a local write-only IPC to the desktop client.
- **A generic multi-transport presence abstraction** — Discord is the only
  transport; the abstraction is YAGNI until a second transport exists.
- **Reading any Discord data** (guilds, messages, users) — the client is
  write-only; no inbound surface.
- **Asset artwork creation** — the 10 agent icons + phase/mode icons are
  operator-supplied uploads to the Discord Developer Portal (external
  prerequisite below), not code.

## Proposed Solution

### Approach

An in-process `PresenceService` subscribed to the Zustand store:

```text
Zustand store ──subscribe──▶ selector (debounce/rate-limit)
                                │
                                ▼
                        privacy enforcer (redact + Zod)
                                │
                                ▼
                        mapper (state → SET_ACTIVITY + assets)
                                │
                                ▼
                        ipc client (@xhayper/discord-rpc) ──▶ local Discord
```

Unidirectional, fail-closed, dormant-polling when Discord is absent.

1. **IPC transport (`presence-ipc.ts`)** — wraps `@xhayper/discord-rpc` with a
   state machine (`dormant → connecting → ready → dropped → dormant`),
   silent-failure handlers (logger.debug, never the TUI/stream), a 60 s
   dormant poll, and `stop()`/clear for `/presence disable` + process exit.
   Raw-IPC fallback (opcode/length framing + `\\.\pipe\discord-ipc-{n}`) is
   documented and interface-compatible but only built if a real Windows
   environment reproduces the named-pipe failure.
2. **State + privacy (`presence-selector.ts`, `presence-privacy.ts`)** — the
   selector subscribes (no React re-render) and emits at most once per 4 s
   (token bucket; 5 updates / 20 s), only on delta. The privacy module
   redacts mechanically: `path.basename(cwd)` only, tool arguments dropped
   absolutely (never inspected, never forwarded), FID numeric ID only (title
   stripped — it may name a vulnerability), search queries masked. A Zod
   `OutboundPresenceSchema` bounds `details`/`state` to 2–128 chars and
   `.refine`-rejects `/` and `\`; on failure it logs a `compliance_warning`
   and emits a hardcoded safe payload ("Working in Savant-Code"). One entry
   point `sanitizeAndValidate(raw)` means the mapper can never receive
   unsanitized state.
3. **Mapper + assets (`presence-mapper.ts`)** — `details` = `Project:
   <basename> | Model: <model>`; `state` = the phase narrative
   (IDLE/RED/GREEN/AUDIT/ADVERSARIAL/SELF_CORRECT/COMPLETE); `large_image`/
   `large_text` = the active agent's asset; `small_image`/`small_text` =
   mode/activity; `timestamps.start` = service boot. Asset keys are a
   validated constants map (charset `^[a-z0-9_]+$`), never scattered strings.
4. **Commands + lifecycle** — `/presence enable | disable | status` mirror the
   `/telemetry` + `/permissions` pattern; `disable` clears + persists
   `presenceEnabled: false` to settings.json; boot instantiates the service
   unless disabled.

### Steps

1. Add `@xhayper/discord-rpc` to `cli/package.json`; implement
   `presence-ipc.ts` (state machine + dormant poll + silent errors + stop).
2. Implement `presence-selector.ts` (subscribe + token bucket + delta) and
   `presence-privacy.ts` (four redaction transforms + Zod schema +
   safe-payload fallback).
3. Implement `presence-mapper.ts` (payload synthesis + phase/asset tables +
   asset-key validation).
4. Add `/presence enable | disable | status` + `command-registry.ts`
   registration + `presenceEnabled` settings type/validation/default + boot
   hook.

### Verification

- Unit: IPC state-machine transitions + silent-failure; redaction matrix (no
  path/tool-arg/FID-title/query survives) + schema rejection on `/`/`\` +
  token-bucket ceiling + safe-payload fallback; payload field synthesis +
  asset-key validation; command enable/disable/status + preference
  round-trip.
- Live: with Discord closed, boot stays dormant; opening Discord reconnects;
  a run shows correct phase/agent without tripping the rate limit; a
  credential-injection attempt shows only `using tool: <name>` (no args);
  `/presence disable` clears and stays off across restart.
- Gates: typecheck ×4, eslint 0, lint:md 0, prettier, `validate:repository`
  PASS + Law-4 reachability greps (presence modules consumed by
  `init-app`/command registry).

## Step Status

- [x] 1. IPC transport (`presence-ipc.ts` + `@xhayper/discord-rpc@1.3.4` + boot/stop hooks)
- [x] 2. State subscription + mechanical privacy (`presence-wire.ts` pipeline + `subscribeToPresence` + `buildStoreSnapshot`, wired in `bootPresence`; `presence-privacy.ts`/`presence-selector.ts` tested)
- [x] 3. Payload mapper + asset-key resolution (`presence-mapper.ts`) — **2026-08-18 revision:** `details` carries the ACTIVE MODEL (`resolveActiveModel()`); the execution mode is a distinct `small_image` overlay (`mode_hybrid`/`mode_strict`/`mode_scaffold`/`mode_analyze`), activity overriding
- [x] 4. `/presence` commands + settings.json persistence + boot hook (`presence.ts`, `presenceEnabled` setting, `init-app.ts`) — **2026-08-18 revision:** the client id is now hardcoded (`SAVANT_DISCORD_CLIENT_ID = 1478095645662380042`), not operator-mutable; `/presence client <id>` and `presenceClientId` settings are removed (feature-theft guard)
- [x] 5. Live smoke — **operator-confirmed 2026-08-18:** Discord activities verified working in the live client (`/presence enable` → sanitized activity under `1478095645662380042` → `/presence disable`); code-level test matrix + privacy-fail-closed proof done (`presence.test.ts` 19 cases + `client-id-reachability.test.ts` 6 cases)

## Perfection Loop

### Loop 1 — RED

- R1. No Discord IPC client exists (grep verified).
- R2. `AgentActivity` and the FSM phase are TUI-only; no external consumer.
- R3. No outbound-network privacy boundary beyond the existing API paths.
- R4. The blueprint's citations are decorative (`bun.com`, `docs.discord.food`,
  UNPKG `discord-rpc-new`) — protocol facts must be re-sourced.
- R5. The blueprint's "Bun 1.3.14 Windows named-pipe anomaly" is cited to
  unrelated issues (Claude Code, Nuxt) — unverified, must not drive the design
  blind.
- R6. The blueprint persists `/presence disable` to credentials.json — wrong
  home for a non-secret preference.
- R7. Discord rate-limits SET_ACTIVITY; unfiltered state would trip it.

### Loop 1 — GREEN

- G1. **Library-first (operator 2026-08-18):** `@xhayper/discord-rpc` for
  framing/handshake/reconnect (Law 7/13); raw IPC is an evidence-gated
  fallback, not the default.
- G2. **Privacy is mechanical, fail-closed:** absolute argument dropping (no
  heuristics) + a Zod schema that rejects path separators + a safe-payload
  fallback (Law 12).
- G3. **Preference home corrected:** `presenceEnabled` in settings.json via
  `saveSettings`, not credentials.json.
- G4. **No new state model:** the selector reads existing `AgentActivity` +
  phase + active-agent fields — presence is a consumer, like the sidebar.
- G5. **Rate limit by construction:** a 4 s token bucket caps output at
  5 updates / 20 s.
- G6. **External prerequisite is operator-owned:** the Discord Client ID + 10
  agent/phase asset keys are config; the code references keys, never uploads.
- G7. **Single FID (single-agent ECHO):** one feature → one FID; no
  master/children (that is a 10-agent-harness construct, and the ledger
  enforces one active master).
- G8. Status `analyzed`; Step Status `blocked::` markers.

### Loop 1 — AUDIT

AUDIT-1 (citations):

- `cli/package.json:60` — zod dependency verified. ✓
- `common/src/types/session-state.ts:110` — AgentActivity kinds verified. ✓
- `cli/src/utils/settings/io.ts` — getSettingsPath/loadSettings/saveSettings
  verified. ✓
- `cli/src/utils/settings/preferences.ts` — boolean-pref pattern verified. ✓
- `cli/src/commands/telemetry.ts` — /telemetry command (saveAnalyticsEnabled)
  verified. ✓
- `cli/src/commands/defs/chat.ts:88` — /verify + command pattern verified. ✓
- `cli/src/commands/command-registry.ts:67` — registry verified. ✓
- `cli/src/utils/auth.ts:41` — getConfigDir/credentials.json verified. ✓
- `@xhayper/discord-rpc` — maintained type-safe fork (repo xhayper/discord-rpc
  → Khaomi/discord-rpc) verified via web search. ✓
→ 9/9 verified.

AUDIT-2 (adversarial):

- A2.1 Could presence leak a credential via a tool argument? The redactor
  drops arguments absolutely and the schema rejects `/`/`\`; a violation
  falls back to a safe payload. No path reaches the transport.
- A2.2 Could presence be stale/ghost after exit? The client is in-process:
  exit closes the socket; the library clears on disconnect; dormant polling
  prevents a zombie reconnect.
- A2.3 Could a Discord close event crash the CLI? Handlers wrap in try/catch;
  `close` → dormant, never rethrow.
- A2.4 Could a missing asset key crash rendering? Keys are validated against
  the map before dispatch; unknown keys are skipped.
- A2.5 Is library-first a supply-chain risk? It is a small, pinned dependency;
  the raw-IPC fallback preserves a no-new-dep escape if Windows breaks.

### Loop 1 — SELF-CORRECT

- SC1: initial draft accepted the blueprint's raw-IPC default; replaced with
  library-first per operator decision (G1).
- SC2: initial draft persisted the preference to credentials.json; corrected
  to settings.json (G3).
- SC3: initial draft redacted tool args heuristically; replaced with absolute
  dropping (G2).
- SC4: restructured from a master + 3 children program to a single FID after
  the `validate:repository` audit reported `fid.graph.multiple-masters` — the
  single-agent ECHO has no master/children, and the ledger enforces one active
  master (G7).

### Missed Questions

1. Should presence be on by default? Decision: yes — enabled on first boot,
  dormant (silent polling) when Discord is absent; `disable` persists.
2. Which FSM phases map to Discord states? Decision: the full Perfection Loop
  plus IDLE — each is a distinct `state` string, none hidden.
3. Is the FID numeric ID safe to broadcast? Decision: yes — the kebab title is
  stripped (may name vulnerabilities), the `YYYY-MMDD-NNN` ID is inert.
4. Reconnect cadence? Decision: 60 s poll when dormant; one immediate retry
  after a close, then poll.
5. Should `small_image` reflect transient activity or mode? Decision: mode
  primarily, with a `status_tool` overlay only while a tool is active.

### Code Verification Evidence

- All citations verified 2026-08-18 against the working tree (AUDIT-1 9/9);
  the library verified via web search (npm/GitHub).
- `bun run validate:repository` PASS after this file was drafted (see
  Resolution); `markdownlint` PASS.
- **Law-4 reachability (hardcode guard):**
  `cli/src/state/presence/__tests__/client-id-reachability.test.ts` (new,
  6 cases) greps production source to prove `SAVANT_DISCORD_CLIENT_ID` is the
  only client id that can reach the transport — the id literal appears exactly
  once (`preferences.ts:87`), the removed symbols are absent, `bootPresence`
  has one call site passing the constant (`init-app.ts:52`), every external
  `getPresenceService` call passes the constant, and `new PresenceService`/
  `new Client` are constructed only from the service id. 6 pass / 0 fail.

## Resolution

- **Status:** `analyzed` — Perfection Loop converged 2026-08-18; **Nova
  planning sign-off PASS 2026-08-18** (verdict in `dev/nova/outbox/archive/2026-08-18-auto-drive-and-discord-rich-presence-planning-verdict.md`).
  Awaiting operator approval to implement.
- **Operator decisions (2026-08-18):** library-first (`@xhayper/discord-rpc`)
  with raw IPC as documented fallback; Rich Presence only (Embedded App SDK
  out of scope); single FID structure per single-agent ECHO.
- **Operator decision (2026-08-18, revision):** the Savant Discord
  Application Client ID is **hardcoded** (`SAVANT_DISCORD_CLIENT_ID =
  1478095645662380042`), NOT operator-configurable. A mutable id is a
  feature-theft vector — pointing the transport at a third-party application
  would let someone claim the Savant Rich Presence asset as their own. The
  `/presence client <id>` subcommand and the `presenceClientId` settings/
  env override are therefore removed; `loadPresenceClientId`/
  `savePresenceClientId` are deleted.
- **External prerequisite (operator-owned, before live smoke):** the
  hardcoded Discord application's 10 agent icons + phase/mode icons uploaded
  as asset keys. Code references keys; it cannot upload them (the application
  itself already exists under `1478095645662380042`).
- **Status:** `verified` — steps 1-4 implemented 2026-08-18 (IPC wrapper,
  mapper, commands/settings/boot hook, and the full pipeline + Zustand
  subscription wiring). Step 5's code-level test matrix + privacy-fail-closed
  proof are done (`presence.test.ts` 18 cases + `client-id-reachability.test.ts`
  6 cases); only the live smoke remains, which is operator-blocked on a live
  Discord client + asset uploads.
- **Nova implementation PASS (2026-08-18):** the hardcode revision + docs were
  independently audited — verdict in `dev/nova/outbox/archive/2026-08-18-discord-rich-presence-hardcode-and-docs-nova-verdict.md`
  (all 6 claims verified at source: hardcoded id, mutable surface removed,
  enabled by default, guard test, docs, honest FID records).
- **Model-vs-mode correction (2026-08-18, operator-reported):** the presence
  `details` line was rendering `Model: <mode>` (e.g. `Model: HYBRID`), because
  `buildStoreSnapshot` fed `store.agentMode` (the execution MODE) into the
  `model` field. Fixed: `model` now resolves the ACTIVE LLM MODEL via
  `resolveActiveModel()` (the model store, single source of truth), and the
  mode (HYBRID/STRICT/SCAFFOLD/ANALYZE) is surfaced as a distinct
  `small_image` overlay (`mode_hybrid`/`mode_strict`/`mode_scaffold`/
  `mode_analyze`) that a transient tool activity overrides. `PresenceRawState`/
  `SanitizedPresenceState` gained a `mode` field; `presence.test.ts` added
  mode-overlay + "never renders mode in the model slot" assertions (25 pass /
  0 fail). Docs (`features.md`/`faq.md`) now state model and mode are distinct
  axes.
- **Layout + model-label correction (2026-08-18, operator-reported, post-closure):**
  Discord exposes exactly two single-line text fields (`details` + `state`;
  newlines are not supported), so the three items map to the two lines as:
  `details` = project basename + model (line 1, both short), `state` = the
  live phase/activity narrative (line 2, real-time — the action stays visible)
  — and the execution mode moved to the `small_image` hover tooltip. The model
  label is now provider-trimmed and variant-stripped (`deepseek/deepseek-v4-pro`
  → `deepseek-v4-pro`, `nous/meituan/longcat-2.0:free` → `longcat-2.0`), and
  the `openrouter/free` boot default maps to a readable "OpenRouter Free"
  label. `presence.test.ts` now 30 cases (2 new sanitizeModel cases +
  tooltip/layout assertions).
- **Stuck-state correction (2026-08-18, operator-reported, post-closure):**
  the presence `state` line was stuck on "Awaiting Operator Input" — it was
  driven only by `store.fsmPhase`, which stays `idle` during normal HYBRID-mode
  work even while the agent is actively running tools/thinking/delegating.
  Fixed: `presence-mapper.ts` synthesizes the state line from the live
  `AgentActivity` when the phase is `idle` (`resolveStateLine`), and the
  `small_image` overlay always carries the execution mode (no longer swapped
  out for a tool icon). `presence-privacy.ts` gained `activityAgentType` +
  `sanitizeAgentType`; `presence.test.ts` added thinking/subagent + state-line
  + mode-overlay cases (28 pass / 0 fail). Recorded in CHANGELOG 2026-08-18.
- **Client id rotation (2026-08-18, operator-directed, post-closure):** the
  hardcoded `SAVANT_DISCORD_CLIENT_ID` was rotated `1478095645662380042` →
  `1539431002089328710` (operator-owned Discord application change). The
  Law-4 reachability suite + `presence-command.test.ts` pin were updated to
  the new id; all presence suites re-verified green (34 pass / 0 fail).
  **Live-confirmed 2026-08-18 (operator):** presence connects and renders
  correctly under the new application ("Savant Code"); all post-closure
  issues (model-vs-mode, stuck-state, layout, id rotation) resolved and
  operator-verified — nothing further outstanding.
- **Closed 2026-08-18 (operator-confirmed):** live Discord smoke passed —
  the operator verified Discord activities working in the live client. Step 5
  marked `[x]`; all five steps implemented. Closed + archived with evidence
  per FID-2026-0817-005; Nova planning + implementation PASS on record.

## Lessons Learned

- Presence is a consumer of existing state, not a new state model — the same
  bytes that drive the sidebar drive the Discord payload, so the only new
  surface is the redactor + the transport.
- The privacy boundary is the product: a presence feature's entire correctness
  is "what can never leave the process", and that must be mechanical and
  fail-closed, not prompt-driven.
- The single-agent protocol governs FID shape, not the harness: one feature is
  one FID; "master + children" programs are a 10-agent construct that the
  ledger's one-active-master rule will reject.
