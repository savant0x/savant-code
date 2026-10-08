# FID-2026-1008-002 — Free-provider launch notice and auto-wire

**Filename:** `FID-2026-1008-002-free-provider-launch-and-autowire.md`
**ID:** FID-2026-1008-002
**Severity:** medium
**Status:** fixed
**Created:** 2026-10-08
**Automation level:** 2 (phase 1); 2 (phase 2, after design review)
**YAGNI-Compliance:** Verified

---

## Summary

Two operator requests in one record:

1. **Phase 1 — launch notice.** The operator rarely sees a notice about free
   providers and what is available at launch. Operator decision 2026-10-08:
   "Show a launch summary every boot."
2. **Phase 2 — auto-wire.** Selecting a free provider in the UI should update
   the provider list and `/model` list, making it a first-class provider like
   a manually added one. Operator decision 2026-10-08: full support.

## Environment

- Date: 2026-10-08. Branch `main`. Latest commit `4e1ab59b` (KiosAPI catalog).
- Live catalog source: `https://free-llm-models.custats.info/free_models.json`
  (`cli/src/utils/free-options.ts`, `CATALOG_URL`).

## Root cause — phase 1 (why the notice is rare)

Read from code 2026-10-08:

- `cli/src/chat/use-chat-bootstrap.ts` (digest effect, ~lines 111-142):
  `if (loadFreeOptionsDigestShownOn() === today) return` — the launch digest
  posts at most once per calendar day. A second launch the same day shows
  nothing.
- The same effect posts only when `renderFreeOptionsDigest` returns lines.
  `cli/src/utils/free-options-render.ts` returns `[]` when there is no
  report and no discovery delta, so a quiet day is silent.
- Catalog deltas reach the user only through `ProviderNotificationCoordinator`
  (`cli/src/utils/provider-notifications.ts`). Non-selected notices are
  grouped into one `info` toast (`provider-notification-lifecycle.ts`) that
  is accepted once (`acceptedBy`) and never re-shown.

## Root cause — phase 2 (what auto-wire needs)

- Custom providers already exist as a first-class concept:
  `common/src/providers/custom-providers.ts` (`registerCustomProviders`,
  `getEffectiveProviderRegistry`, `toProviderConfig`), persisted in settings
  (`cli/src/utils/settings/io.ts`), and consumed by the picker, key store,
  catalogs and routing. Auto-wire should write the same record shape, not a
  parallel registry.
- The free catalog carries `providerId` and model ids but **no** base URL or
  env var. Built-in providers already have both in the registry; discovery-only
  providers have only the harvester's candidate `url` and `models`
  (`common/src/providers/discovery-state.ts`). Auto-wire can therefore cover
  built-in-attributed providers immediately and discovery candidates only after
  their probe verdict is in hand.

## Proposed solution

### Phase 1 — every-boot launch summary (implement now)

1. In `use-chat-bootstrap.ts`, remove the same-day early return so the digest
   renders on every boot when `renderFreeOptionsDigest` returns lines.
   Keep `markFreeOptionsDigestShown` so the persisted date still records the
   last shown day (no settings-shape change).
2. Keep the empty-lines guard, so a quiet boot still posts nothing.
3. Update the pin in `cli/src/utils/__tests__/free-options-digest.test.ts`
   ("once-per-day digest gate") to match the new every-boot behavior, and
   state in the test header why the pin changed.

### Phase 2 — auto-wire (design review first)

Proposed, not yet approved in detail:

- On selecting a free-lane provider in `/provider free` or the model picker,
  build a `CustomProviderConfig` from the registry attribution (`baseUrl`,
  `apiKeyEnvVar`, catalog) and persist it through the existing custom-provider
  path, then re-register so the picker and `/model` pick it up.
- Built-in-attributed providers only in this phase. Discovery-only candidates
  stay in `/notifications` until their probe verdict exists.
- Keyless providers: wire immediately. Keyed providers: prompt for the key
  using the existing provider-setup flow before wiring.

## Affected components

- `cli/src/chat/use-chat-bootstrap.ts` (phase 1)
- `cli/src/utils/__tests__/free-options-digest.test.ts` (phase 1 pin)
- Phase 2: `cli/src/commands/provider-subcommands-handlers.ts`,
  `common/src/providers/custom-providers.ts`, `cli/src/utils/settings/io.ts`

## Risk

- Phase 1: low. Adds one short message per boot. Empty days stay silent.
- Phase 2: medium. Writes to settings and changes the picker's provider set;
  must not overwrite built-ins (`registerCustomProviders` already rejects
  built-in ids).

## Provider expansion candidates (research 2026-10-08)

Source: third-party list `github.com/mnfst/awesome-free-llm-apis` (secondary;
vendor terms must be verified before any wiring). Gravity Index has no LLM
inference providers in its catalog, so it was not used.

Not in the registry files checked (`common/src/providers/registry*.ts`):

- **Groq** — free tier, no credit card, OpenAI-compatible, base
  `https://api.groq.com/openai/v1` (gpt-oss-120b, gpt-oss-20b, qwen3.8-27b).
- **Google Gemini** — free tier, OpenAI-compatible, base
  `https://generativelanguage.googleapis.com/v1beta`. Free-tier prompts may be
  used by Google to improve products.
- **Mistral** — free mode, no credit card, base `https://api.mistral.ai/v1`.
  Free-mode prompts may be used for training unless opted out.
- **Cohere** — free trial key, no credit card, 1,000 calls/month, non-commercial
  use only. Base `https://api.cohere.com/v2`.
- **Aion Labs** — permanent free tier, no credit card, base
  `https://api.aionlabs.ai/v1`. 15 RPM, 20K tokens/day.
- **Z AI (Zhipu)** — permanent free models, base
  `https://open.bigmodel.cn/api/paas/v4`. Concurrency limit of 1.
- **Hugging Face** — $0.10/month inference credit, base
  `https://router.huggingface.co/v1`.
- **LLM7.io** — gateway with free tier, base `https://api.llm7.io/v1`.
- **Kilo Code** — free models, no key, base `https://api.kilo.ai/api/gateway`.
- **ModelScope** — requires Alibaba Cloud account binding and real-name
  verification. Lower priority.

Already in the registry: Cloudflare Workers AI, NVIDIA NIM, OpenRouter, Ollama.

Decision needed from the operator: which of these to add in phase 2, and whether
to require a verified terms page per provider before wiring.

## Verification Gates

- gate: test cli/src/utils/__tests__/free-options-digest.test.ts
- gate: typecheck cli
- gate: quality

### Verification Receipt

- fingerprint: sha256:d919322195f4548e52cd906e516312a436491e3c884f7ea662e1fb5e0f66e9f4
- verified: 2026-10-08T15:52:31.673Z
- test cli/src/utils/__tests__/free-options-digest.test.ts: exit 0
- typecheck cli: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The once-per-day gate (`use-chat-bootstrap.ts`) suppresses the
  digest on any same-day relaunch. The digest pin in
  `free-options-digest.test.ts` encodes that behavior, so the test must change
  with the code.

### Missed Questions

- Does any other surface depend on
  `loadFreeOptionsDigestShownOn`? Grep shows only `use-chat-bootstrap.ts`
  (writer/reader) and the digest test. Is a boot-time summary spammy? Quiet
  boots post nothing, so spam is bounded by actual catalog content.

### Code Verification Evidence

- `bun test src/utils/__tests__/free-options-digest.test.ts`: 4 pass, 0 fail.
- `bun test src/chat/__tests__` plus the digest test: 36 pass, 0 fail.
- `eslint --max-warnings 0` on `use-chat-bootstrap.ts`: exit 0.
- `prettier --check` on both changed files: exit 0.
- `bun run --cwd=cli typecheck`: exit 0 (before the final import-line fix; re-run below).
- `validate:repository`: FAILED on the two headings above before this pass; re-run below.

### Loop 2 — RED re-check and GREEN revision (2026-10-08)

- **RED re-check, readers:** `loadFreeOptionsDigestShownOn` and
  `markFreeOptionsDigestShown` had one production caller (the boot effect) and
  the digest test. Once the boot effect stopped reading the date, the store had
  no production reader. Under Law 4 that is dead state, so the GREEN revision
  removes it rather than keeping a write-only field.
- **GREEN (applied):** removed the boot-effect write and the store accessors in
  `cli/src/utils/settings/preferences.ts`, the `freeOptionsDigestShownOn` field
  in `settings/types.ts`, its validation branch in `settings/validation.ts`, and
  the store pins in `free-options-digest.test.ts` (the render pins remain).
  Old settings files that still hold the key are harmless: the whitelist drops
  unknown fields on load.
- **Behavior note (RED finding):** a non-empty summary posts on every boot, so
  a busy catalog repeats it each launch. This is the operator's decision
  (2026-10-08, "every boot"); quiet boots still post nothing.
- **GREEN (phase 2, unchanged):** the auto-wire design above still needs the
  operator's approval before implementation.

### Resolution

- **Closed Date:** not closed. Phase 2 is still open.
- **Status:** fixed for phase 1 (every-boot launch summary, T168). Phase 2
  (auto-wire, T169) is blocked on operator design approval.
- **Fix Description:** phase 1 removes the same-day gate in
  `use-chat-bootstrap.ts` and removes the orphaned shown-date store (preferences,
  settings type, validation, tests).
- **Tests Added:** render pins retained; store pins removed with the store.
- **Verification Evidence:** `fid:verify` exits 0 (digest test, `typecheck cli`,
  `quality`), receipt written. Also ran: 49/49 pass across digest, settings, and
  chat tests; eslint and prettier clean; `validate:repository` and `lint:md` pass.
- **Not verified:** the boot effect has no test. Confirm by relaunching twice in
  one day.
- **Archived:** pending commit authorization and phase 2.

## Lessons Learned

A once-per-day gate is the wrong default for a notice whose content changes
with the catalog: a relaunch the same day should still say what is available.
