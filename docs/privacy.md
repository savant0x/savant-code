# Savant Code Privacy Architecture

> **Scope:** This document describes what data Savant Code collects, where it
> goes, and how users control it. It covers the CLI, SDK, and agent-runtime.
>
> **Version:** v0.0.26
>
> **Applies to:** `cli`, `sdk`, `packages/agent-runtime`, `common`

## 1. Core Privacy Principles

1. **Local-first by default.** Code, prompts, and file contents stay on the
   user's machine unless the user explicitly chooses a cloud provider.
2. **Bring Your Own Key (BYOK).** The user supplies their own API keys. Savant
   Code does not vend, own, or proxy inference credentials.
3. **Telemetry is user-controlled.** Remote analytics and error reporting
   default to enabled for new users, can be disabled at any time with `/telemetry disable`, and are separate from ad
   consent.
4. **Controlled credential storage in the BYOK flow.** Provider API keys may be read from environment variables or
   secure masked user input. Explicit environment variables take precedence; keys entered through `/provider` are
   stored locally in the user's `credentials.json` with the existing backend credential profile preserved.
5. **Transparent network calls.** Every network request the CLI makes is
   documented below.

## 2. Data Boundaries

### What Stays on the Machine

- Source code and project files
- User prompts and chat history
- Model outputs generated through local or BYOK providers
- Settings (`~/.savant-code[-env]/settings.json`) and locally stored provider credentials (`credentials.json`)
- Sandbox permission mode and safety registry state

### What May Leave the Machine

- **Inference requests** to the user's chosen provider (OpenRouter, Ollama,
  TokenHarbor, Nous Research, another gateway, etc.) when using BYOK mode. Nous
  Research uses the direct OpenAI-compatible API in this integration; Portal OAuth
  credentials are not accepted by the `NOUS_API_KEY` flow.
- **Authentication requests** to Savant Code backend when the user logs in.
- **Telemetry events** while remote analytics is enabled; users can disable them
  with `/telemetry disable`.
- **Ad impression/click events** while ads are enabled; ad consent remains
  separate from telemetry.
- **Update-check requests** to determine whether a newer CLI version is
  available.
- **Error/crash logs** when the user explicitly opts into full telemetry.

## 3. Credential Storage

### BYOK API Keys

- Environment-provided BYOK keys are read at runtime and are never copied to
  disk by Savant Code. Current direct-provider variables include
  `OPENCODE_GO_API_KEY`, `TOKENROUTER_API_KEY`, `TOKENHARBOR_API_KEY`,
  `NVIDIA_API_KEY`, `COMMAND_CODE_API_KEY`, and `NOUS_API_KEY`.
- Keys entered through the masked `/provider` flow are stored in the user's
  local `credentials.json` so npm-installed users can configure a provider
  without editing shell profiles.
- Explicit environment variables take precedence over stored provider keys.
- Provider keys are excluded from chat history and rendered user messages.
- Users can remove stored credentials with `/logout` or by deleting the local
  credentials file.

### Backend Auth Token

- When a user logs in to the Savant Code backend, an `authToken` is received.
- The token is stored in `~/.savant-code[-env]/credentials.json` for session
  continuity (dev: `.savant-code-dev`, test: `.savant-code-test`, prod:
  `.savant-code`).
- This file is created with the user's OS permissions and is not shared or
  transmitted.
- Users can clear this file at any time with the `/logout` command.
  - **Future work (separate FID):** Evaluate migrating the backend auth token to the OS keychain or encrypted local
  storage. For launch, plaintext credential storage is limited to the backend session token and provider keys
  explicitly entered through `/provider`; environment-provided keys are not copied to disk.

## 4. Network Calls

### Update Check

- **Endpoint:** Public registry/GitHub releases API.
- **Data sent:** Current CLI version and user-agent string only.
- **Data NOT sent:** Code, prompts, file names, or identifiers.
- **Trigger:** On CLI startup (when enabled) only. There is no `/version`
  slash command; the launcher performs the check on launch and stages any
  pending update.
- **Apply requires consent (FID-2026-0806-014):** the launcher never stops a
  running session. A newer version is staged with a pending-update marker and
  applied on the **next launch** after an interactive y/N prompt; non-TTY
  launches defer the prompt. `SAVANT_CODE_NO_AUTO_UPDATE=1` opts out entirely.

### Provider Inference (BYOK)

- **Endpoint:** Chosen by the user (OpenRouter, Ollama, etc.).
- **Data sent:** Model prompt and any context required by the model.
- **Data NOT sent:** Savant Code does not add tracking headers or identifiers.
- **One model project-wide:** the model selected in the UI panel is the only
  model used — the main chat agent, teacher-forge, headless runs, and spawned
  subagents all resolve the operator's active model. Savant Code never silently
  falls back to a different (e.g. paid) model than the one you selected.

### Analytics / Telemetry

- **Destination:** PostHog and/or Axiom (when enabled).
- **Data sent:** Aggregated event types, error names, and feature usage
  summaries.
- **Secret redaction:** All payloads are run through `sanitizeSecrets` before
  transmission.
- **Default:** `true` for new users and legacy settings without an explicit
  value; users can disable remote analytics with `/telemetry disable`.

### Ads

- **Destination:** Carbon Ads or Gravity Index network.
- **Data sent:** Minimal impression/click events required for ad serving.
- **Default:** `false`; contextual ads are disabled unless the user opts in.

## 5. Telemetry & Ad Controls

<!-- markdownlint-disable MD013 -->

| Setting            | Location                             | Default                                                  | How to Change                                                     |
| ------------------ | ------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `adsEnabled`       | `~/.savant-code[-env]/settings.json` | `false`                                                  | `/ads enable` / `/ads disable`                                    |
| `analyticsEnabled` | `~/.savant-code[-env]/settings.json` | `true` for new/legacy settings without an explicit value | `/telemetry status`, `/telemetry enable`, `/telemetry disable`    |
| `permissionMode`   | `~/.savant-code[-env]/settings.json` | `prompt`                                                 | `/permissions safe`, `/permissions prompt`, `/permissions unsafe` |

<!-- markdownlint-enable MD013 -->

## 6. Secret Sanitization

All debug logs, analytics payloads, and error reports are processed through a
`sanitizeSecrets` helper. The following keys are redacted to `[REDACTED]`:

- `authToken`
- `apiKey` / `api_key`
- `token`
- `accessToken`
- `refreshToken`
- `secret`
- `password`
- `authorization`

## 7. Retention

- **Local chat logs:** Stored in the per-project `debug/` directory or per-chat
  log file. Cleared when the user runs `/clear` or deletes the files.
- **Settings:** Retained until the user deletes `~/.savant-code[-env]/`.
- **Backend sessions:** Governed by the Savant Code backend terms of service.
- **Telemetry/analytics:** Governed by PostHog/Axiom retention policies once
  enabled.

## 8. User Controls

- `/permissions safe|prompt|unsafe` — control how aggressively the agent can run
  shell/network tools.
- `/ads enable` / `/ads disable` — toggle ad display independently.
- `/telemetry status|enable|disable` — inspect or change remote analytics and
  error-reporting consent.
- `/logout` — remove stored backend credentials.

Remote analytics consent is stored separately from `adsEnabled`; disabling
telemetry does not disable local debug logs or inference-provider network
requests.

### Config directory

The runtime stores local config in `~/.savant-code[-env]/` (e.g.
`.savant-code-dev`, `.savant-code-test`, `.savant-code`). This unifies the CLI
and SDK path and matches the public launch brand. Existing
`~/.config/manicode[-env]/` data is not migrated; users will need to
re-authenticate after updating.

### Contributor / test override

Tests and advanced users can set `SAVANT_CODE_CONFIG_DIR` (non-production only)
to override the config directory. This is used by
`cli/src/utils/__tests__/settings.test.ts` to isolate on-disk state.

### First-run analytics notice

The first launch prints a one-line notice to stderr disclosing that remote
analytics are enabled by default, with the `/telemetry disable` escape hatch;
the notice is shown once and never again (tracked in
`~/.savant-code[-env]/settings.json` `analyticsNoticeShown`).

## 9. Verification

- Verify that environment-provided keys are not persisted, while `/provider`
  storage is limited to the local credentials file and excludes chat history.
- Run the settings and analytics-client tests in `cli/src/utils/__tests__/` to
  confirm the active default, explicit disable behavior, and secret redaction.
- Inspect `~/.savant-code[-env]/settings.json` after a fresh install —
  `analyticsEnabled` is `true` and `adsEnabled` is `false` unless changed by the
  user.

## 10. Open Questions / Future Work

- Evaluate OS-native keychain/keyring integration for the backend `authToken`.
- Add per-provider audit trail for network calls in `unsafe` mode.
- Provide a one-click "purge all local data" command.
