# FID-2026-1008-002 — Free-provider launch notice and auto-wire

**Filename:** `FID-2026-1008-002-free-provider-launch-and-autowire.md`
**ID:** FID-2026-1008-002
**Severity:** medium
**Status:** closed
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

## Impact Assessment

### Affected Components

- `cli/src/chat/use-chat-bootstrap.ts` (phase 1)
- `cli/src/utils/__tests__/free-options-digest.test.ts` (phase 1 pin)
- Phase 2: `cli/src/commands/provider-subcommands-handlers.ts`,
  `common/src/providers/custom-providers.ts`, `cli/src/utils/settings/io.ts`

### Risk Level

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

- fingerprint: sha256:e99e3fac52b0eb38c054d27cf68ecde19a3036e4faca072bb76d2e41d694ffa4
- verified: 2026-10-09T00:20:40.263Z
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

## Resolution

- **Closed Date:** 2026-10-08
- **Fix Description:** phase 1 (every-boot launch summary) — the same-day
  early return is removed from the boot effect so a non-empty digest
  renders on every boot (quiet boots still post nothing, the empty-lines
  guard is unchanged), and the orphaned shown-date store it left behind
  (`loadFreeOptionsDigestShownOn` / `markFreeOptionsDigestShownOn`, the
  preferences accessors, the settings type field, the validation branch and
  the store pins) is removed as dead state under Law 4. This record's own
  "the boot effect has no test" gap is closed by FID-2026-1008-004 (A): the
  decision now lives in the pure, injected, fail-silent `runLaunchDigest`
  and is pinned by `launch-digest.test.ts`, with `use-chat-bootstrap.ts`
  as its caller.
- **Open remainder (registered, not dropped):** phase 2's registry-only
  auto-wire branch is implemented under FID-2026-1008-005 item 3; the
  harvested-candidate branch is blocked pending the operator ruling and is
  registered on `SCOPE.md` as T171 (its design is drafted in
  FID-2026-1008-004 Loop 4).
- **Tests Added:** Yes — the render pins are retained in
  `free-options-digest.test.ts` (the store pins left with the store); the
  boot decision is pinned in `launch-digest.test.ts`.
- **Verification Evidence:** implementation commits `d6d544b4` +
  `742d919f`; gates 3/3 exit 0 — receipt `sha256:4449c7ed…`, re-verified
  live 2026-10-08T23:46:53Z and re-stamped at the archived path.
- **Archived:** 2026-10-08 — moved to `dev/fids/archive/` on the operator's
  closure authorization; register items T168 and T169 complete and evicted
  from `SCOPE.md`; the phase-2 remainder lives on as T171.

### Loop 3 — full-perfection pass, RED re-confirmation (2026-10-08, operator-triggered)

- This record's own "Not verified: the boot effect has no test" gap is CLOSED by
  FID-2026-1008-004 (A): the decision logic now lives in
  `cli/src/utils/launch-digest.ts` (`runLaunchDigest`, injected readers + sink)
  and `cli/src/utils/__tests__/launch-digest.test.ts` pins it (post on lines,
  skip on empty, every call, discovery-only, fail-silent reader).
  `use-chat-bootstrap.ts` imports and calls `runLaunchDigest` — Law 4 caller
  present. The test belongs to -004's gate set; cross-referenced here.
- `loadFreeOptionsDigestShownOn` / `freeOptionsDigestShownOn` are absent from
  `cli/src` (grep, 0 matches) — the dead-state removal is complete, and stale
  keys in old settings files are tolerated by the whitelist loader (no
  migration code needed).
- Status unchanged: `fixed` (phase 1, receipt-backed). Phase 2 remains blocked
  on the operator design approval, now carried with both options in
  FID-2026-1008-004 item C.

## Lessons Learned

A once-per-day gate is the wrong default for a notice whose content changes
with the catalog: a relaunch the same day should still say what is available.
