# FID-2026-1008-004 — Free-provider follow-ups: boot-path test, offer deadline window, auto-wire

**Filename:** `FID-2026-1008-004-free-provider-followups.md`
**ID:** FID-2026-1008-004
**Severity:** medium
**Status:** fixed
**Created:** 2026-10-08
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

Three items the operator approved for completion on 2026-10-08 ("do all of it
that was offered"), each left open by FID-2026-1008-002 and FID-2026-1008-003:

- **A. Boot-path test.** The every-boot launch summary has no test of its
  decision logic (FID-2026-1008-002 Resolution).
- **B. Offer deadline window.** The offers line counts every feed item and
  cannot say which end soon (FID-2026-1008-003 open item).
- **C. Auto-wire** (phase 2 of FID-2026-1008-002). Selecting a free provider
  should make it first-class in the provider and `/model` lists.

## Root cause and RED evidence

### A — boot-path decision is inside a React effect

`cli/src/chat/use-chat-bootstrap.ts` builds the digest inside a `useEffect`,
so the post-or-skip decision cannot be tested without a React harness. The
existing digest tests cover the renderer (`renderFreeOptionsDigest`) only.

### B — offers carry deadlines the report discards

- `common/src/providers/custats-feed.ts`: `CustatsOffer.expiryTimestamp` is
  parsed from the description when present.
- `cli/src/utils/provider-offers.ts` `readProviderOfferDiscovery` maps every
  parsed offer to a string and discards `expiryTimestamp` before returning.
- `cli/src/utils/free-options-render.ts` announces `N advertised offer(s) …
  eligibility and deadlines unverified` with no window count.

### C — auto-wire needs a decision the code does not yet answer

- A free-catalog provider that is in the registry is already "not wired" and
  already has a setup command (`/provider <id>`, `renderFreeOptionsAnnounce`
  "Not wired" line).
- A discovery-only provider (`discoveryOnly` lanes) has no registry entry, so it
  has no base URL or key variable. Wiring it as a first-class custom provider
  needs both, and the feed does not provide them (`custats-feed.ts` has no URL
  or env-var field). The harvester's candidate `url` is the only base-URL source.

## Proposed solution (GREEN)

### A — extract a pure launch-digest runner and test it

1. New `cli/src/utils/launch-digest.ts`:
   `runLaunchDigest(deps)` where `deps` = `{ readReport, readDiscovery, post }`.
   It renders with `renderFreeOptionsDigest`, calls `post` only when there are
   lines, returns `true` when posted, and returns `false` on any thrown error
   (fail-silent, as today).
2. `use-chat-bootstrap.ts` calls `runLaunchDigest` with the real readers and a
   `post` that appends a system message. The effect keeps its free-build and
   repo gates.
3. `cli/src/utils/__tests__/launch-digest.test.ts` (new): fakes injected for
   `readReport`, `readDiscovery`, and `post`. Pins: posts non-empty digest and
   returns true; empty digest posts nothing; a second call posts again (every
   boot); a throwing reader returns false without throwing.

### B — keep deadlines, count the window

1. `provider-offers.ts`: extract `readFreshFeedOffers(now): CustatsOffer[]`
   (the existing freshness gate, unchanged). `readProviderOfferDiscovery` maps
   it to strings as before. New `countOffersEndingSoon(now): number` counts offers
   with `expiryTimestamp` inside (0, 72h] of `now`.
2. `free-options-types.ts`: optional `discoveryOffersEndingSoon?: number` (absent
   means 0, so existing report constructors still compile).
3. `free-options.ts`: set `discoveryOffersEndingSoon` at both call sites
   (`refreshFreeOptionsOnce` and `readCachedFreeOptionsReport`).
4. `free-options-render.ts`: the offers line adds `N end within 72h;` only when
   N > 0. The "ending soon" wording is never printed without a counted window.

### C — blocked on a design decision (not implemented here)

Blocker: wiring a discovery-only provider needs a base URL and a key variable
that the feed does not supply. Two options need the operator's ruling before
implementation:

1. **Registry-only auto-wire.** On selecting a `Not wired` registry provider in
   the picker or announce, run the existing `/provider <id>` key flow inline and
   set it active on success. Discovery-only providers stay in `/notifications`.
   This needs no new data.
2. **Harvested-candidate auto-wire.** Also wire discovery-only providers from
   the harvester's candidate `url`, after its probe verdict is `up`. This needs a
   verdict-to-wire rule and key handling for unknown providers.

## Verification Gates

- gate: test cli/src/utils/__tests__/launch-digest.test.ts
- gate: test cli/src/utils/__tests__/free-options.test.ts
- gate: test cli/src/utils/__tests__/free-options-digest.test.ts
- gate: typecheck cli
- gate: quality

### Verification Receipt

- fingerprint: sha256:c46d059c70180dd1270f48781eb9d2b173f218f2152a4ae137c6f905c4b64bae
- verified: 2026-10-08T18:22:59.030Z
- test cli/src/utils/__tests__/launch-digest.test.ts: exit 0
- test cli/src/utils/__tests__/free-options.test.ts: exit 0
- test cli/src/utils/__tests__/free-options-digest.test.ts: exit 0
- typecheck cli: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the three root causes above, each read from the file it names.

### Missed Questions

- Does `readProviderOfferDiscovery` have callers other
  than `free-options.ts`? (Grep: `refreshFreeOptionsOnce` and
  `readCachedFreeOptionsReport` only.) Does any `FreeOptionsReport` literal need
  the new optional field? (No: it is optional.) Is the 72h window consistent with
  the existing expiry facts in `provider-offers.ts` (24h / 72h windows)? (Yes.)

### Loop 2 — GREEN check

- **GREEN check:** B and A are implementable with the seams above and no shape
  break. C is not, without the ruling. The FID records C as blocked, with both
  options, rather than choosing one.

### Loop 3 — GREEN applied (A and B)

- **B applied:** `provider-offers.ts` split into `readFreshFeedOffers` plus
  `readProviderOfferDiscovery` (strings, unchanged output) and
  `countOffersEndingSoon` (offers with a parsed deadline in (0, 72h]).
  `free-options-types.ts` gains optional `discoveryOffersEndingSoon`;
  `free-options.ts` sets it at both call sites; the announce offers line prints
  `N end within 72h;` only when N > 0.
- **A applied:** `cli/src/utils/launch-digest.ts` `runLaunchDigest` (injected
  readers and sink, fail-silent). `use-chat-bootstrap.ts` calls it; the effect's
  gates are unchanged.
- **C not applied:** blocked on the operator ruling (registry-only or
  harvested-candidate auto-wire), recorded above.

### Code Verification Evidence

- `bun test` on `launch-digest.test.ts`, `free-options.test.ts`,
  `free-options-digest.test.ts`, `free-options-routing.test.ts`: 30 pass, 0 fail.
  The launch-digest tests pin post-on-lines, skip-on-empty, every-call, the
  discovery-only case, and the fail-silent reader.
- `typecheck cli`: exit 0.
- ESLint `--max-warnings 0` on all changed files: exit 0. Prettier `--write`
  (project formatter, formatting only) then `--check`: exit 0.

### Loop 4 — full-perfection pass, RED re-verification (2026-10-08, operator-triggered)

- **A re-verified:** `cli/src/utils/launch-digest.ts` exists with
  `runLaunchDigest`; `use-chat-bootstrap.ts` imports it (Law 4 caller present);
  `cli/src/utils/__tests__/launch-digest.test.ts` exists and pins the decision.
- **B re-verified:** `provider-offers.ts` exports `readFreshFeedOffers`,
  `readProviderOfferDiscovery`, `countOffersEndingSoon`;
  `free-options-types.ts` carries `discoveryOffersEndingSoon`; `free-options.ts`
  sets it at both call sites; `free-options-render.ts` prints `N end within 72h;`
  only when N > 0; the pin in `free-options.test.ts` covers both branches.
- **State of the code:** A and B are UNCOMMITTED in the working tree
  (`git status`: modified `use-chat-bootstrap.ts`, `free-options*.ts`,
  `provider-offers.ts`; untracked `launch-digest.ts` + its test). The receipt
  above was stamped from the working tree; closure still requires the commit
  (G2) and operator authorization.
- **C remains blocked on the operator ruling.** Code-inspection preference
  recorded: option 1 (registry-only auto-wire) — it adds no new secret surface,
  whereas option 2 would read third-party credential stores.
- **Status:** header aligned `created` → `fixed` (A/B implemented, receipt
  stamped, C blocked).
- **Follow-up-chain note (not executed):** this record is a fourth-generation
  child of still-open ancestors (-002, -003); if the operator prefers, A/B can be
  amended into those records and this one closed. Lifecycle mutation is the
  operator's call, not this pass's.

### Resolution

- **Closed Date:** not closed.
- **Status:** fixed for A and B. C is blocked on the operator ruling.
- **Archived:** pending commit authorization and C.
