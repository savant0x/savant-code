# Savant Code Privacy Architecture

> **Scope:** This document describes what data Savant Code collects, where it goes, and how users control it. It covers the CLI, SDK, and agent-runtime.
> **Version:** v0.0.8
> **Applies to:** `cli`, `sdk`, `packages/agent-runtime`, `common`

## 1. Core Privacy Principles

1. **Local-first by default.** Code, prompts, and file contents stay on the user's machine unless the user explicitly chooses a cloud provider.
2. **Bring Your Own Key (BYOK).** The user supplies their own API keys. Savant Code does not vend, own, or proxy inference credentials.
3. **Telemetry is opt-in.** Analytics, ads, and any non-essential data collection default to `false` and must be explicitly enabled.
4. **No plaintext credential storage in the BYOK flow.** BYOK API keys are read from environment variables or secure user input and are never written to disk by Savant Code.
5. **Transparent network calls.** Every network request the CLI makes is documented below.

## 2. Data Boundaries

### What Stays on the Machine

- Source code and project files
- User prompts and chat history
- Model outputs generated through local or BYOK providers
- Settings (`~/.savant-code[-env]/settings.json`) — excluding credentials
- Sandbox permission mode and safety registry state

### What May Leave the Machine

- **Inference requests** to the user's chosen provider (OpenRouter, Ollama, gateway, etc.) when using BYOK mode.
- **Authentication requests** to Savant Code backend when the user logs in.
- **Telemetry events** when the user explicitly opts into analytics.
- **Ad impression/click events** when the user explicitly opts into ads (SavantFree tier).
- **Update-check requests** to determine whether a newer CLI version is available.
- **Error/crash logs** when the user explicitly opts into full telemetry.

## 3. Credential Storage

### BYOK API Keys

- BYOK API keys are **never persisted** by Savant Code.
- Keys are read from the user's environment (e.g., `SAVANT_CODE_API_KEY`) at runtime.
- Keys are held in memory only for the duration of the request and are cleared afterward.

### Backend Auth Token

- When a user logs in to the Savant Code backend, an `authToken` is received.
- The token is stored in `~/.savant-code[-env]/credentials.json` for session continuity (dev: `.savant-code-dev`, test: `.savant-code-test`, prod: `.savant-code`).
- This file is created with the user's OS permissions and is not shared or transmitted.
- Users can clear this file at any time with the `/logout` command.
- Future work (separate FID) will evaluate migrating the backend auth token to the OS keychain or encrypted local storage. For launch, the plaintext storage scope is limited to the backend session token, not BYOK API keys.

## 4. Network Calls

### Update Check

- **Endpoint:** Public registry/GitHub releases API.
- **Data sent:** Current CLI version and user-agent string only.
- **Data NOT sent:** Code, prompts, file names, or identifiers.
- **Trigger:** On CLI startup (when enabled) or when the user runs `/version --check`.

### Provider Inference (BYOK)

- **Endpoint:** Chosen by the user (OpenRouter, Ollama, etc.).
- **Data sent:** Model prompt and any context required by the model.
- **Data NOT sent:** Savant Code does not add tracking headers or identifiers.

### Analytics / Telemetry

- **Destination:** PostHog and/or Axiom (when enabled).
- **Data sent:** Aggregated event types, error names, and feature usage summaries.
- **Secret redaction:** All payloads are run through `sanitizeSecrets` before transmission.
- **Default:** `false` — analytics only runs if the user opts in.

### Ads (SavantFree Tier)

- **Destination:** Carbon Ads or Gravity Index network.
- **Data sent:** Minimal impression/click events required for ad serving.
- **Default:** `false` for paid tiers; free tier may prompt for opt-in on first use.

## 5. Telemetry & Ad Controls

| Setting | Location | Default | How to Change |
|---------|----------|---------|---------------|
| `adsEnabled` | `~/.savant-code[-env]/settings.json` | `false` | `/ads enable` / `/ads disable` |
| `analyticsEnabled` | `~/.savant-code[-env]/settings.json` | `false` | Planned `/telemetry` command; currently controlled by env opt-in and `adsEnabled`.
| `permissionMode` | `~/.savant-code[-env]/settings.json` | `prompt` | `/permissions safe|prompt|unsafe` |

## 6. Secret Sanitization

All debug logs, analytics payloads, and error reports are processed through a `sanitizeSecrets` helper. The following keys are redacted to `[REDACTED]`:

- `authToken`
- `apiKey` / `api_key`
- `token`
- `accessToken`
- `refreshToken`
- `secret`
- `password`
- `authorization`

## 7. Retention

- **Local chat logs:** Stored in the per-project `debug/` directory or per-chat log file. Cleared when the user runs `/clear` or deletes the files.
- **Settings:** Retained until the user deletes `~/.savant-code[-env]/`.
- **Backend sessions:** Governed by the Savant Code backend terms of service.
- **Telemetry/analytics:** Governed by PostHog/Axiom retention policies once enabled.

## 8. User Controls

- `/permissions safe|prompt|unsafe` — control how aggressively the agent can run shell/network tools.
- `/ads enable` / `/ads disable` — toggle ad display.
- `/logout` — remove stored backend credentials.

> **Note:** Analytics/telemetry beyond the ad network is currently controlled by the same `adsEnabled` flag and by environment-level opt-ins.

### Config directory

The runtime stores local config in `~/.savant-code[-env]/` (e.g. `.savant-code-dev`, `.savant-code-test`, `.savant-code`). This unifies the CLI and SDK path and matches the public launch brand. Existing `~/.config/manicode[-env]/` data is not migrated; users will need to re-authenticate after updating.

### Contributor / test override

Tests and advanced users can set `SAVANT_CODE_CONFIG_DIR` (non-production only) to override the config directory. This is used by `cli/src/utils/__tests__/settings.test.ts` to isolate on-disk state.

## 9. Verification

- Grep the source for `writeFileSync` + secret-like keys — no BYOK keys are persisted.
- Run tests in `cli/src/utils/__tests__/` to confirm telemetry defaults to `false` and secrets are redacted in logs.
- Inspect `~/.savant-code[-env]/settings.json` after a fresh install — `adsEnabled` and analytics should be `false` or absent.

## 10. Open Questions / Future Work

- Evaluate OS-native keychain/keyring integration for the backend `authToken`.
- Add per-provider audit trail for network calls in `unsafe` mode.
- Provide a one-click "purge all local data" command.
