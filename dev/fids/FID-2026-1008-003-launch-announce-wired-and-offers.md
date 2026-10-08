# FID-2026-1008-003 — Launch announce undercounts wired providers and mislabels offers

**Filename:** `FID-2026-1008-003-launch-announce-wired-and-offers.md`
**ID:** FID-2026-1008-003
**Severity:** medium
**Status:** fixed
**Created:** 2026-10-08
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

The every-boot launch summary (FID-2026-1008-002) prints:

```text
Free AI lanes available — catalog fetchedAt 2026-10-08T01:00:39.362Z:
- Wired & free: 2 — OpenRouter, NVIDIA NIM — advertised free models; account quota unverified
- Local & free: 1 — Ollama — no key needed
- Offers: 212 advertised free-token offer(s) ending soon — Viktor …; Valyu …
```

Operator report 2026-10-08: "seems broken and very minimal vs what we provide.
Seeing we only have 2 wired is completely wrong."

## Root cause (RED, from code)

1. **Wired count is not the wired set.** `renderFreeOptionsAnnounce` prints
   `report.wiredFree`. `buildFreeOptionsReport` (`free-options.ts`) fills
   `wiredFree` only from providers that appear in the third-party custats
   catalog AND have credentials. Configured providers that the custats feed does
   not list (KiosAPI, APInex, Bai, and others) are never counted. The machine
   context already holds the full set: `buildRegistryAttribution`
   (`free-options-context.ts`) sets `credentialReady` on every non-local registry
   entry.
2. **"ending soon" is a hard-coded claim.** `readProviderOfferDiscovery`
   (`provider-offers.ts`) returns every parsed feed item with no deadline filter,
   and the announce line hard-codes "ending soon". The 212 figure is the whole
   feed, not offers ending soon.
3. The every-boot cadence (FID-2026-1008-002) makes both defects visible on
   every launch.

## Proposed solution (GREEN)

1. Add `configuredProviders: string[]` to `FreeOptionsReport`
   (`free-options-types.ts`), filled in `buildFreeOptionsReport` from
   `context.registryByProviderId` where `credentialReady` is true, sorted by label.
2. `renderFreeOptionsAnnounce` prints:
   - `- Configured: N provider(s) — <first 5 labels>, …`
   - `- Free catalog overlap: M — <labels>` (the current `wiredFree` set,
     unchanged in meaning, relabelled honestly)
   - Local, offers, discovery lines unchanged.
3. Offers line: drop "ending soon". Print
   `- Offers: N advertised free-token offer(s) in the custats feed; eligibility and deadlines unverified — <first 2>`.
   Deadline filtering is out of scope here: it needs structured offer data, which
   the report does not carry. Recorded as a limitation, not deferred.
4. Update the digest test pins (`free-options-digest.test.ts`) to the new lines.

## Verification Gates

- gate: test cli/src/utils/__tests__/free-options-digest.test.ts
- gate: test cli/src/utils/__tests__/free-options.test.ts
- gate: typecheck cli
- gate: quality

### Verification Receipt

- fingerprint: sha256:adc65d59629ee4265f86a4a2bcca2f38c6571380fb0b4215679b45c4ca3db405
- verified: 2026-10-08T21:49:50.401Z
- test cli/src/utils/__tests__/free-options-digest.test.ts: exit 0
- test cli/src/utils/__tests__/free-options.test.ts: exit 0
- typecheck cli: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the cited code paths above, read 2026-10-08.

### Missed Questions

- Does `FreeOptionsReport` have other consumers that break
  with a new field? It is optional-free: add it as a required field only after
  grepping constructors (the test fixture builds reports directly). Is the
  configured list secret-safe? It carries labels only, never key values.

### Loop 2 — GREEN (applied) and AUDIT

- **GREEN applied:** `FreeOptionsReport.configuredProviders` (types) filled in
  `buildFreeOptionsReport` from `registryByProviderId` where credentials are
  present (`free-options.ts`); announce prints `Configured: N provider(s)` and
  relabels the free-catalog subset `Free catalog overlap`; the offers line drops
  "ending soon" (`free-options-render.ts`).
- **GREEN correction (test-driven):** a first draft counted configured providers
  toward the "nothing to say" guard. The existing pin (no free lanes renders no
  lines) caught it. The guard counts free lanes only, so a configured provider
  with no free lane stays silent under the "Free AI lanes" header.
- **Pins updated:** `free-options.test.ts` now asserts `Configured:` and
  `Free catalog overlap` and forbids `Wired & free`.
- **Real-cache render (this machine, 2026-10-08):** `Configured: 23 provider(s)`,
  `Free catalog overlap: 2 — OpenRouter, NVIDIA NIM`, `Local & free: 1 — Ollama`,
  `Offers: 212 advertised … in the custats feed; eligibility and deadlines unverified`.

### Code Verification Evidence

- `free-options-digest.test.ts`, `free-options.test.ts`,
  `free-options-routing.test.ts`: 24 pass, 0 fail (`bun test`, exit 0).
- `typecheck cli`: exit 0. ESLint `--max-warnings 0` and Prettier: exit 0 on
  changed files.
- Real-cache render: see Loop 2 above.

### Loop 3 — full-perfection pass (2026-10-08, operator-triggered)

- RED re-confirmed in the tree: `FreeOptionsReport.configuredProviders` exists
  (`free-options-types.ts`), the announce prints `Configured: N provider(s)` and
  `Free catalog overlap` (`free-options-render.ts`), and `free-options.test.ts`
  forbids the old `Wired & free` wording. Committed at `a9ae21d0`; receipt
  stamped above.
- Metadata drift repaired: the header read `created` while the Resolution and the
  receipt said `fixed` — header aligned to `fixed` (ground truth: implementation
  exists and the declared gates exited 0).
- The offers line is honest by construction: the count is the feed total and the
  disclaimer is unconditional. The 72h window count landed separately under
  FID-2026-1008-004 (B) and the renderer prints it only when N > 0.
- Open item unchanged (operator ruling): whether `discoveryOffers` should carry
  structured deadlines so this line can be windowed here too.

## Resolution

- **Closed Date:** not closed.
- **Status:** fixed for the wired count and the offer wording.
- **Verification Evidence:** `free-options-digest.test.ts`,
  `free-options.test.ts`, `free-options-routing.test.ts`: 24 pass, 0 fail.
  `typecheck cli`: exit 0. ESLint and Prettier clean on changed files.
- **Open item (blocked, needs operator ruling):** the offer line still counts
  every feed item, with no deadline filter. Filtering to offers ending within 72h
  needs `discoveryOffers` to carry structured deadlines, not strings. That changes
  the report shape. Ruling needed: approve the type change, or keep the count
  labelled as is.
- **Archived:** pending commit authorization.
