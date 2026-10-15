# Free-provider and notification system audit — 2026-10-03

## Requested investigation

Inspect the current free-provider system and determine whether its notification
system exists, how it is wired, and what remains unverified. This is a source
and offline-test investigation of the current working tree. No provider
credentials or paid inference requests are needed.

## Initial state

The working tree contains existing provider and runtime changes from earlier
sessions. The audit inspects those changes in place. The repository's
single-agent ECHO contract is active with strict mode and automation level 3.

Two product paths require separate traces: BYOK providers and free-model
discovery in Savant-Code, and the hosted admission/model-selection path in
Savant-Free. The operator's existing T122 ruling reserves Savant-Free feature
repair or removal to an operator-directed session.

## Investigation plan

- **Implemented:** trace provider registry, model routing, discovery feeds,
  and persisted data; evidence is in the system map and findings below.
- **Implemented:** trace startup notices, candidate announcements, rate-limit hints, quota
  reporting, and hosted free-session feedback to their production consumers.
- **Implemented:** inspect current data freshness without exposing secrets
  or modifying caches; timestamps and populations are recorded below.
- **Implemented:** run relevant existing offline tests from their workspace roots.
- **Implemented:** record verified behavior, concrete notification gaps,
  verification limits, and the active FID for remaining operator decisions.

## Added model-picker investigation and implementation intent

The operator reported unrelated OpenAI rows remaining after `/model` searches.
Native reproduction identifies duplicate React row keys: OpenAI and OpenRouter
can share identical model IDs. Queries for DeepSeek, Qwen, and a zero-match
string retain both direct OpenAI rows while logical match counts are correct.
The converged corrective plan is `FID-2026-1003-005`: include provider identity
in the existing row key and extend the current native-renderer tests with
overlapping IDs. This corrects reconciliation without hiding a provider or
changing model search, catalog ordering, or routing.

## Verified system map

| Surface | Current implementation | Verification boundary |
| --- | --- | --- |
| Provider routing | 23 built-in entries: 22 gateways and Ollama; effective registry also includes custom providers. Credential and wire-protocol resolution happens in the SDK. | Registry and construction tests; no vendor availability claim. |
| Free-model list | `/provider free` fetches a keyless catalog, falls back to the last-good cache, and splits known providers by configured keys. Local Ollama appears separately. | A configured credential is not an account entitlement or inference-health check. |
| Provider discovery | Repository boot can launch the freeairouter harvester when its report is older than 24 hours; candidates are screened and keyless-probed. | Repository-only, boot-triggered; no always-running scheduler. |
| Candidate intelligence | Model-family index, 14-sample history, churn, boundary verdicts, optional tracked-custom health checks, and user-confirmed provider wizard. | Feed rosters and keyless boundary checks do not prove keyed inference or model quality. |
| First-run notice | Pre-TUI stderr notice points to `/provider free` once per settings profile. | Ordinary Savant-Code only; persisted shown flag retires it. |
| Cached startup notices | Chat bootstrap appends discovery and free-lane summaries, with persisted announcement keys. | Empty-chat bootstrap only; completion of background refresh is not observed. |
| Failure feedback | HTTP 429 can append two same-family alternatives once per model per process. Quota refusals can point to `/health`; B.AI declares the only quota endpoint. | Suggestions require repository-local candidate state; account quota reads occur on demand. |
| Hosted Savant-Free | Session polling, admission bell, region/account/session-limit panels, takeover and session-expiration state. | Separate hosted product; backend and deployed behavior were not exercised. |

Production references: `common/src/providers/registry.ts:23`,
`registry-partitioned-2.ts:14`, `sdk/src/impl/model-provider.ts:34`,
`cli/src/commands/provider-subcommands-handlers.ts:230`,
`cli/src/index.tsx:142`, `cli/src/chat/use-chat-controller.ts:93`,
`cli/src/hooks/helpers/send-message/run-results.ts:112`,
`cli/src/commands/health-command.ts:147`, and
`cli/src/hooks/use-savant-free-session/session-api.ts:29`.

The notification surface is real but fragmented: stderr, chat messages, error
banners, and hosted-product panels. Toast infrastructure is mounted at
`cli/src/app.tsx:199`; this production search found no actual toast emitters:

```text
rg -n 'useToast\(|\.addToast\(|getState\(\)\.addToast' cli/src desktop/src
  -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!**/fontawesome.ts'
  -g '!**/use-toast.ts'
NO MATCHES
```

No dedicated provider-alert event or desktop provider-alert consumer was found
in the inspected sources. JSON-RPC event notifications are transport frames,
not evidence of a provider notification feature.

## Current persisted evidence

Observed around 2026-10-03 15:09–15:20 UTC, without refreshing any caches:

- Repository discovery report: generated 2026-10-02T19:47:09.134Z;
  214 feed records, 68 report candidates, 27 boundary-ok report rows,
  0 new / 2 changed / 0 lapsed, and **0 tracked pipeline providers**.
  Persisted state separately declares 71 hosts; state and report populations
  are different and must not be presented as the same count.
- Development-profile free-model cache:
  `C:/Users/spenc/.savant-code-dev/free-options.json`, fetchedAt
  2026-10-03T01:00:39.305Z; 161 models, 1 new-model ID, 33 archived models.
- Catalog attribution: OpenRouter 22, Groq 12, Cerebras 2, Google 44,
  NVIDIA NIM (`nvidia-nim`) 81. Only `openrouter` exactly matches a current
  registry ID. This describes cached feed data, not live provider service.
- The persisted free-options announcement key is
  `[["openrouter"],[],["ollama"]]`. The repository candidate block and
  `.announced-key` share the same two `host:changed` entries.

## Findings and corrective options

### F1 — selected OpenRouter model can route to direct OpenAI

**Confirmed construction defect, high impact.** The SDK resolves registered
prefixes before considering the active provider (`model-provider.ts:75-92`).
OpenRouter retains upstream `openai/...` IDs, which now overlap the direct
OpenAI registry namespace. A fresh child process using placeholder credentials
and no inference call returned:

```json
{"activeProvider":"openrouter","selectedModel":"openai/gpt-5","constructedProvider":"openai.responses","constructedModel":"gpt-5","networkCalls":0}
```

Thus selecting an OpenRouter route can require the wrong credential and
construct the wrong serving endpoint. The picker fix below corrects displayed
row identity; it does not correct SDK routing. Recommended contract: retain
serving-provider identity from selection through persistence and request
construction, while preserving explicit cross-provider subagent routes.
An ID-prefix rewrite alone needs careful treatment of real OpenRouter slugs
such as `openrouter/free` and existing saved IDs. FID-2026-1003-006 records this
and the notification findings for an operator-directed implementation ruling.

### F2 — NVIDIA free models are silently omitted

**Confirmed against cached data and production builder.** The catalog says
`nvidia-nim`; the registry says `nvidia`. `free-options.ts:111` skips every
unattributed row. With injected OpenRouter and NVIDIA configured flags, the
production builder returns only the OpenRouter lane, omitting 81 NVIDIA
entries. Groq, Cerebras, and Google have no built-in registry entries and are
also omitted, rather than shown as unsupported opportunities.

Recommended correction: normalize known catalog aliases at the attribution
boundary; keep unsupported-provider opportunities visible with truthful setup
capability. New integrations require their own verified routing contracts.

### F3 — startup notices can disappear or arrive only on a later launch

**Source-established lifecycle gap; full interactive smoke remains unverified.**
`use-chat-bootstrap.ts:228-239` marks the announcement attempted before a
1.5-second timer executes. Any intervening message-length change cleans up
the timer. The consumed ref prevents another attempt on that mount. The
provider-guidance effect at lines 196–207 can itself cause that change.
Restored nonempty chats never schedule this effect.

The same bootstrap starts refresh/harvest without observing completion, then
reads existing files. A missing free-model cache triggers a refresh and
returns immediately, with no announcement to the current session. The source
explicitly describes warming the **next boot**. This is a launch-time notice,
not a delivery guarantee for new data during active use.

Recommended correction: own delivery independently of chat emptiness; mark a
notice delivered only after emission; observe refresh completion; preserve
nonblocking startup and avoid disturbing model prompts or conversation state.

### F4 — announcement keys ignore meaningful model and health changes

**Confirmed deterministic reproduction.** Free-options announcement keys
contain provider IDs only (`use-chat-bootstrap.ts:147-151`). Adding a free
model to an existing lane leaves the key unchanged. Discovery keys contain
only `host:classification` (`discovery-context.ts:73-80`); changing a roster,
boundary verdict, or suggestion for the same changed host also leaves it
unchanged. The model-catalog lift preserves new/archived IDs, but the report
builder and notification renderers do not consume those deltas.

```text
modelAddedButSameAnnounceKey: true
changedCandidateSameKey: true
```

Recommended correction: key notifications by normalized semantic changes,
including model additions/removals and important health transitions. Retain
deduplication and suppression of feed-prose changes.

### F5 — health and rate-limit hints have limited evidence and reach

**Confirmed source limitations.** Ordinary user projects lack the
`dev/provider-candidates/candidates.json` file that 429 hints require. The
runtime hint reader does not check observation freshness, configured account
access, the denylist, or removed custom providers. Common selection supports
an `eligible` predicate, but the runtime caller does not pass one. It matches
model families rather than exact model/version/capability.

Tracked health rows are rendered in the developer report. Context supports
`removalHintId` (`discovery-context.ts:23,132-136`), but production candidate
construction (`harvest-report-phase.ts:236-246`) never supplies it. Health-only
changes therefore do not reliably generate removal guidance. The local report
has zero tracked providers, so this branch has no local live-account evidence.

Recommended correction: carry dated observations and account capability
separately, exclude ineligible alternatives, deliver health transitions to
the relevant user, and label same-family alternatives precisely. No automatic
provider switch is implemented or recommended by this audit.

### F6 — account balance and promotional-expiry alerts are not general features

Only B.AI declares a quota endpoint; `/health` reads that active account on
demand. There is no general periodic balance warning or reset notification in
the inspected provider path. The separate custats developer harvester renders
offers, expiration dates, new models, and archived models in its report, but
that is not wired into the user-facing provider notices.

Hosted Savant-Free has its own session-limit and region/account feedback;
those panels do not prove BYOK quota notifications. Its model-unavailable path
silently selects a fallback in memory; deployed behavior was not exercised.

## Model-picker correction

`FID-2026-1003-005` corrects the operator-reported search defect in the working
tree. Provider-scoped row keys prevent direct OpenAI and OpenRouter entries
with identical IDs from colliding. Existing row children also have semantic
keys through Button's array normalization, removing the native missing-key
warning. Provider ordering and full IDs remain intact.

New native regressions failed against the old component: expected 2 children,
received 4 for a one-match search; expected 4, received 6 for a shared ID.
After correction, unrelated and empty searches clear stale rows; both provider
entries remain independently selectable. Existing keyboard, wheel, scrollbar,
resize, focus-overlay, and activation tests continue to pass.

## Verification evidence and limits

Actual offline runs from their respective workspace roots:

```text
cli: six provider/free-options/notice/hint/quota/wizard suites
53 pass / 0 fail / 140 expect() calls
scripts: providers/__tests__
137 pass / 0 fail / 488 expect() calls
common: four registry/contract/validation suites
33 pass / 0 fail / 402 expect() calls
sdk: model-provider-free-mode family plus codecraft-xkiro routing
46 pass / 0 fail / 111 expect() calls
cli: native picker, viewport, activation, overlay
19 pass / 0 fail / 195 expect() calls
```

The provider audit has **269 passing tests**; the picker run adds 19. These
counts describe targeted executions, not the entire repository battery.
Root typecheck completed across all workspaces and scripts; zero-warning
ESLint exited 0; quality reported `PASS (1498 baselined files)`.

Final validation also ran the full SDK source suite:

```text
bun test src/ (from sdk/)
577 pass / 1 POSIX-only skip / 0 fail / 1465 expect() calls
Ran 578 tests across 94 files.
fid:verify FID-2026-1003-005 --write
All six declared gates PASS; verification receipt stamped.
Root zero-warning ESLint and Markdown lint: exit 0.
Changed-file Prettier: All matched files use Prettier code style!
Scope register: PASS (0 issues).
```

The full SDK run contains expected error-path log messages and a structured
response-format warning from an existing test; these are not new picker
warnings or failures. Counts from the targeted SDK run overlap this full run
and must not be added as distinct tests.

No live vendor inference, credential entitlement checks, remote backend,
desktop provider-notice smoke, or full interactive TUI session was exercised.
The picker evidence uses the actual native renderer. Notification lifecycle
findings are distinguished above from deterministic reproductions.

## Recommended order

1. Resolve serving-provider identity end to end (F1) before trusting model
   selection as a routing guarantee.
2. Correct NVIDIA attribution and label configured versus verified-usable lanes.
3. Establish reliable notice delivery and semantic deduplication (F3/F4).
4. Connect dated health observations and truthful alternatives; choose whether
   proactive quota/expiry notices belong in the product contract.

The investigation is complete. Notification/routing changes are recorded for
an operator ruling in the active FID and SCOPE register; this audit does not
assert those defects are repaired. The picker implementation is verified in
the working tree; commit and archival remain subject to explicit G2 authority.
