# FID-2026-1001-002: free-provider discovery surfaces never notify users

**Filename:** `FID-2026-1001-002-free-options-notify-surfaces.md`
**ID:** FID-2026-1001-002
**Severity:** medium
**Status:** verified
**Created:** 2026-10-01 18:13
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

The free-compute discovery pipeline (FID-2026-0914-003 + 0928-011/012) is
real and healthy, but the operator — running the shipped CLI for 4 months —
has never seen a single notification, alert, or summary about it. Every
surface is either dev-side-only or strictly on-demand: the MQ4 boot harvest
is repo-gated, the MQ5 announce reads a gitignored dev-side file shipped
users never have, `/provider free` is on-demand with zero proactive
discoverability, and the custats harvest is an operator-run script. This
record wires two proactive user-facing surfaces (operator-approved
2026-10-01): a one-time pre-TUI discoverability notice and a boot system
message announcing the cached free-lane split.

## Environment

- **OS:** Windows (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14 (pinned)
- **Tool Versions:** bun 1.3.14, tsc 5.x
- **Commit/State:** `main` @ 35819c0e, working tree clean

## Detailed Description

### Problem

Users never learn the free-options surface exists. RED evidence
(2026-10-01, call-graph reachability):

1. **MQ4 daily harvest** (`cli/src/chat/use-chat-bootstrap.ts:47-66`) —
   repo-gated: `if (!repoRoot || IS_SAVANT_FREE) return` +
   `if (!isDiscoveryRepo(repoRoot)) return`; the in-source comment states
   "ordinary users (outside this repo) never fetch". Even the operator gets
   only a silent background run.
2. **MQ5 discovery announce** (`cli/src/chat/use-chat-bootstrap.ts:77-112`)
   — reads `dev/provider-candidates/agent-context.txt` (gitignored
   dev-side state); `if (!existsSync(contextPath)) return` — shipped users
   never have the file → permanent silence.
3. **`/provider free`**
   (`cli/src/commands/provider-subcommands-handlers.ts:224-236`) —
   on-demand only. FID-2026-0928-012 records verbatim: "Fetch is on-demand
   only — never at boot" and "Not in scope (ruled out by the operator's
   surface selection): boot banners, error-triggered hints, and any runtime
   network at startup."
4. **custats harvest** (`scripts/providers/harvest-custats.ts`) —
   `bun run providers:custats`, an operator script writing
   `dev/provider-candidates/custats-report.md` (dev-side). Never shipped,
   never announced.
5. **Pre-TUI notices** (`cli/src/cli-boot-steps.ts:31-48`) — the only
   proactive notice is `discloseAnalyticsNoticeOnce`; no free-options
   equivalent exists.

### Expected Behavior

A user launching the CLI learns, at least once, that free AI lanes exist
and how to see them (`/provider free`), and periodically sees the
wired/not-wired split from their local cache.

### Root Cause

Not a defect in the pipeline — a missing surface. The 2026-09-28 operator
ruling (FID-2026-0928-012) selected only the slash command + the
agent-answerable reference and explicitly ruled out every proactive
surface; the MQ5 announce was wired to the dev-side candidates ledger, not
to users. The operator reverses that ruling (2026-10-01): proactive
surfaces are now wanted.

### Evidence

The five-surface catalog above is the evidence; each row cites the exact
file and line, and the gating condition that returns silently for
real users.

## Impact Assessment

### Affected Components

- `cli/src/cli-boot-steps.ts` + `cli/src/index.tsx` (one-time notice)
- `cli/src/chat/use-chat-bootstrap.ts` (boot announce)
- `cli/src/utils/free-options.ts` (+ `-catalog`/`-render`/`-paths`)
  (cached reader + announce renderer)
- `cli/src/utils/settings/{types,validation,preferences}.ts` (notice-shown
  flag)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (the `/provider free`
      command works — nothing tells users it exists)
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Two surfaces, both following exact existing patterns; zero network on the
boot critical path:

1. **One-time discoverability notice** (`discloseFreeOptionsNoticeOnce`,
   beside `discloseAnalyticsNoticeOnce`): stderr + yellow, retires after
   the first show via a persisted settings flag, gated to non-free builds
   (`/provider` is not registered in SavantFree — FID-007 U1; pointing
   free users at it would print "Command not found").
2. **Boot system message announcing the cached split**
   (`announceFreeOptionsSplit` in `use-chat-bootstrap.ts`, beside the MQ5
   announce in the same deferred effect): reads the LOCAL cache via a new
   `readCachedFreeOptionsReport()` (never fetches on the announce path);
   when the cache is absent or stale, kicks a fail-silent fire-and-forget
   `refreshFreeOptions()` so the next boot is fresh; announces once per
   content-set via a sidecar key (the MQ5 `.announced-key` semantics) —
   unchanged counts never re-announce.

### Steps

1. Settings flag: `freeOptionsNoticeShown` in `settings/types.ts` +
   validation leg in `settings/validation.ts` +
   `hasFreeOptionsNoticeBeenShown`/`markFreeOptionsNoticeShown` in
   `settings/preferences.ts` (exact analytics-notice pattern; the
   `settings.ts` barrel re-exports via `export *`).
2. `discloseFreeOptionsNoticeOnce()` in `cli-boot-steps.ts`; wired beside
   `discloseAnalyticsNoticeOnce()` in `index.tsx`.
3. `free-options-paths.ts`: `announced` sidecar path.
4. `free-options-render.ts`: `renderFreeOptionsAnnounce(report)` — bounded
   label lists (first 5 + ellipsis), staleness note, `/provider free`
   pointer (pure; empty when there is nothing to say).
5. `free-options.ts`: extract `buildMachineContext(nowMs)` (shared by the
   refresh and the reader — Law 13); add `readCachedFreeOptionsReport()`
   (local cache only, never fetches, null on no/corrupt cache); re-export
   the renderer. Loop 2 also extracted `liftCatalog` to
   `free-options-catalog.ts` for the 300-line ceiling (re-exported here).
6. `use-chat-bootstrap.ts`: `announceFreeOptionsSplit(setMessages)`
   (fail-silent, IS_SAVANT_FREE-gated, sidecar once-per-set, background
   refresh when absent/stale) wired into the existing deferred discovery
   effect.
7. Pins: notice prints-once + retires + flag round-trip
   (`cli-boot-steps.test.ts`, beside-module precedent
   `pre-init/load-dev-env.test.ts`); cached reader + announce renderer
   (`free-options.test.ts`).

### Verification

> Contract rule (FID-2026-0918-006): every promised test artifact names its
> repo-relative path and appears as a declared gate below.

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/free-options.test.ts
- gate: test cli/src/cli-boot-steps.test.ts
- gate: quality

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/free-options.test.ts
- gate: test cli/src/cli-boot-steps.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:d4c4743125d54248807d53eb64a8a7e7759de1ea62d8e156948f08148b07e8df
- verified: 2026-10-02T01:21:22.157Z
- typecheck cli: exit 0
- test cli/src/utils/__tests__/free-options.test.ts: exit 0
- test cli/src/cli-boot-steps.test.ts: exit 0
- quality: exit 0

## Step Status

- [x] Proposed Solution step 1 — settings flag (`freeOptionsNoticeShown` in types + validation leg + accessors)
- [x] Proposed Solution step 2 — `discloseFreeOptionsNoticeOnce()` + index.tsx wiring
- [x] Proposed Solution step 3 — `announced` sidecar path
- [x] Proposed Solution step 4 — `renderFreeOptionsAnnounce` renderer
- [x] Proposed Solution step 5 — `buildMachineContext` extraction + `readCachedFreeOptionsReport`
- [x] Proposed Solution step 6 — `announceFreeOptionsSplit` + deferred-effect join
- [x] Proposed Solution step 7 — pins (2 boot-notice + 6 cached-reader/renderer
      pins, all green). `announceFreeOptionsSplit`'s own branches are
      code-read verified, not pinned (Loop 3 OPEN)

## Perfection Loop

### Loop 1 — RED

- **RED:** All five surfaces cataloged with file:line evidence (Detailed
  Description); the pipeline notifies nobody by design. The discovery
  FIDs' own surface-selection notes record the no-notification ruling.
- **GREEN:** Two operator-approved surfaces per Proposed Solution; direct
  Orchestrator writes (Hybrid Mode, operator directive 2026-10-01) —
  pattern-copies of the analytics notice and the MQ5/provider-guidance
  effects.
- **AUDIT:** gates green (typecheck cli exit 0; 19/19 pins across the
  free-options + boot-steps suites; eslint exit 0 on all 12 source files).
  Receipt stamped via `fid:verify --write` after this update; independent
  Verifier review follows.
- **ADVERSARIAL:** ran at the operator's request (2026-10-01); see Loop 3.

### Loop 2 — Independent audit and self-correction

- **RED:** (a) the `quality` gate blocked the receipt stamp —
  `cli/src/utils/free-options.ts: 303 lines exceeds absolute maximum 300`
  (my two additions pushed the module over the ceiling);
  (b) Verifier FAIL — `renderFreeOptionsAnnounce` guarded `fetchedAt` with
  `=== null`, which misses an empty-string `fetchedAt` from a hand-corrupted
  cache JSON ("catalog fetchedAt :" would reach the user); the Adversary
  later corrected this reproduction from "runtime-undefined" (see Loop 3,
  finding 1);
  (c) NEEDS-REVIEW — the FID's evidence lines exceeded markdownlint MD013
  (`dev/fids/` is not in `.markdownlintignore`; only `archive/**` is) and
  `docs/features.md` carried no free-options surface (Law 9).
  Law 4 grep passed on the first try: `index.tsx:146` calls
  `discloseFreeOptionsNoticeOnce()`, `use-chat-bootstrap.ts:236` calls
  `announceFreeOptionsSplit()`.
- **GREEN:** (a) `liftCatalog` extracted to `cli/src/utils/free-options-catalog.ts`
  and re-exported from `free-options.ts` (one import surface preserved —
  Law 13), dropping the module under the ceiling;
  (b) the guard became `if (!report.fetchedAt) return []` with the reason
  in-band; (c) the FID's long lines wrapped and `docs/features.md` gained a
  Free AI Options section plus the `/provider free` table row.
- **AUDIT:** re-verified inline (see Verification Evidence).
- **ADVERSARIAL:** Loop 3 (the Loop 2 note claiming the phase was not
  applicable was an unauthorized deferral — see Loop 3, finding 5).
- **CHANGE DELTA:** ~1.5% of the FID text; +1 source module, +1 docs section.

### Loop 3 — Adversary meta-verification (operator-requested)

- **RED (Adversary):** the Verifier's verdict did not stand as written. Its
  four pattern-following PASSes survived independent re-verification
  (`cli-boot-steps.ts:63-72`; `use-chat-bootstrap.ts:131-175`;
  `free-options.ts:171`/`:204`; `preferences.ts:71`/`:105-106`; Law 4 at
  `index.tsx:146` + `use-chat-bootstrap.ts:236`; docs at
  `features.md:224-242`/`:539`) and the implementation itself is sound, but
  five record corrections were required.
- **GREEN (self-correct):**
  1. **Headless blindness (new FAIL, highest severity)** — `index.tsx`
     returned at the headless-dispatch guard BEFORE the notice call, and
     `announceFreeOptionsSplit` lives in the chat bootstrap that never mounts
     headlessly: `--print`/`--auto`/piped/CI users got NEITHER surface while
     `docs/features.md` claimed the notice unconditionally. Fixed by calling
     `discloseFreeOptionsNoticeOnce()` BEFORE the headless dispatch (it is
     stderr-only and flag-retired, so it never corrupts piped stdout), and
     the boot-summary TUI-only limit is now stated in `docs/features.md`.
  2. **Incomplete sweep** — the sibling `renderCommandOutput` still carried
     the old `=== null` guard; swept to the same truthy guard, with the
     reason in-band.
  3. **Contract drift** — `free-options.ts`'s module docstring still declared
     "fetch happens on `/provider free` invocation only (never at boot)",
     contradicted by this FID's boot background refresh. Updated to name both
     fetch paths and to state that the announce path itself never fetches.
  4. **Stale file count** — "11 touched files" was stale after the Loop 2
     split added a 12th source module (`free-options-catalog.ts`); corrected
     to 12 source files (10 modified + 2 new), with the Verifier's
     independent count of 13 reconciled.
  5. **Unauthorized deferral** — this record had disposed of the Adversary
     phase as "n/a for this surface" on the agent's own authority while Loop 1
     still said "pending". Replaced with the actual pass.
- **ADVERSARIAL (severity re-rate):** `medium` CONFIRMED unchanged — the
  original defect is an undiscoverable feature whose command already worked;
  nothing regresses here and residual risk after the fix is nil.
- **OPEN (recorded, not closed):** no behavioral pin exercises
  `announceFreeOptionsSplit` itself — its sidecar once-per-set skip, its
  `IS_SAVANT_FREE` gate, and its background-refresh branch are verified by
  code-read only (the 8 pins cover the notice function, the cached reader,
  and the pure renderer). The `IS_SAVANT_FREE` gate carries the most
  regression risk (a rename or flip would silently point SavantFree users at
  an unregistered command). Pinning it needs module mocking of
  `../utils/constants`; not done in this record.
- **CHANGE DELTA:** ~2% of the FID text; 3 source files, 1 docs paragraph.

### Loop 4 — Verifier pass on the Loop 3 delta

- **RED (Verifier, delta-scoped):** no FAILs. Confirmed the notice move is
  correct (`discloseFreeOptionsNoticeOnce` precedes the dispatch guard while
  `discloseAnalyticsNoticeOnce` stays after it), the stderr-only output keeps
  piped stdout clean, and the `renderCommandOutput` guard change is
  branch-identical for all three handler-producible reports (fresh cache, stale
  cache, offline-no-cache) with 19/19 pins confirming no pinned output moved.
  Four items raised: two MINOR doc-accuracy and two NEEDS-REVIEW ordering
  questions the Verifier could not reach without tools.
- **GREEN (self-correct):**
  1. `docs/features.md` said the notice "reaches every invocation" while
     `discloseFreeOptionsNoticeOnce` returns early on `IS_SAVANT_FREE` — the
     SavantFree carve-out is now stated in both the bullet and the paragraph.
  2. The `free-options.ts` docstring described the background boot refresh
     without naming its owner; it now names `announceFreeOptionsSplit` in
     `cli/src/chat/use-chat-bootstrap.ts` so a reader can locate the call.
  3. Ordering question 1 RESOLVED by read: `cli/src/index.tsx` runs
     `initializeApp({ cwd })` (and every provider-key restore) ABOVE the
     notice's new position, so config-dir resolution is initialized first.
  4. Ordering question 2 RESOLVED by read: `saveSettings`
     (`cli/src/utils/settings/io.ts:78-84`) is read-modify-write
     (`loadSettings()` -> spread -> assign -> `writeFileAtomic`), so the
     notice's earlier write cannot be clobbered by a later dispatch-time
     write; the worst case would be the notice reappearing, never data loss.
- **ADVERSARIAL:** not re-run; Loop 4 changed two comments/docs only, with no
  behavioral delta for the Adversary to re-litigate.
- **CHANGE DELTA:** 2 doc surfaces; 0 behavioral lines.

### Missed Questions

1. **Why not reuse the MQ5 announce as-is?** It reads a dev-side candidates
   file shipped users never have; the free-options surface needs the
   user-level cache (`~/.savant-code/free-options.json`), which only exists
   after a `/provider free` invocation — hence the background refresh.
2. **Why a settings flag rather than the sidecar for the one-time notice?**
   The analytics notice precedent (FID-2026-0806-015) persists
   `analyticsNoticeShown` in settings.json — one truth for notice-retirement
   state; the sidecar stays for the per-set announce key.
3. **Why fire-and-forget refresh instead of a detached process?** The
   harvester is a standalone script (MQ4 spawns a process); the free-options
   refresh is in-process TUI code — a `void`-ed promise with a swallowing
   `.catch` after the 1.5s deferred effect keeps the boot critical path
   network-free and the failure fail-silent (announce failures never break
   the TUI).
4. **What about SavantFree?** Gated out of both surfaces: `/provider` is
   not registered there (FID-007 U1) — pointing free users at
   `/provider free` would print "Command not found".
5. **Does the announce fire when the split is empty?** No — when every lane
   list is empty the renderer returns no lines and the announce skips, so a
   nothing-to-say message never posts.
6. **Why announce once per content-set rather than a 24h TTL?** The MQ5
   `.announced-key` semantics are the closest sibling pattern: the set key
   is derived from the announce-relevant facts (wired/not-wired/local
   provider ids), so unchanged counts never re-announce and a real change
   always does — strictly better than a TTL that re-posts identical text.
7. **Do headless users see any of this?** The one-time notice: yes — it is
   called before the headless-dispatch guard (Loop 3 finding 1), so
   `--print`/`--auto`/piped/CI runs print it once to stderr and then retire
   it. The boot summary: no — it posts into a chat, and a headless run has
   none; `docs/features.md` states this limit explicitly rather than
   implying full coverage.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending (G2 — closure lands with the commit)
- [x] **File:line ranges:**
      `cli/src/cli-boot-steps.ts` (discloseFreeOptionsNoticeOnce + import),
      `cli/src/index.tsx` (import + wiring beside the analytics notice),
      `cli/src/chat/use-chat-bootstrap.ts` (announceFreeOptionsSplit +
      deferred-effect join + import),
      `cli/src/utils/free-options.ts` (buildMachineContext +
      readCachedFreeOptionsReport + re-exports),
      `cli/src/utils/free-options-catalog.ts` (liftCatalog — Loop 2 split),
      `cli/src/utils/free-options-render.ts` (renderFreeOptionsAnnounce +
      boundedLabels),
      `cli/src/utils/free-options-paths.ts` (announced path),
      `cli/src/utils/settings/{types,validation,preferences}.ts`
      (freeOptionsNoticeShown).
- [x] **Gate output:** re-stamped below via `fid:verify --write` after the
      Loop 4 doc fixes (typecheck cli, both test paths, quality); earlier
      Loop 1/3 stamps are superseded by this receipt
- [x] **Reproducibility:** `grep -n "discloseFreeOptionsNoticeOnce" cli/src/index.tsx`
      and `grep -n "announceFreeOptionsSplit" cli/src/chat/use-chat-bootstrap.ts`
      return the import + call sites (Law 4 evidence).
- [x] **Step statuses:** every Proposed Solution step implemented (see Step Status)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output (typecheck cli exit 0; 19/19 pins; eslint exit 0)
- [x] Production call-graph evidence is present for new or repaired wiring
      (`cli/src/index.tsx` calls `discloseFreeOptionsNoticeOnce` ahead of the
      headless dispatch; the deferred discovery effect in
      `cli/src/chat/use-chat-bootstrap.ts` calls `announceFreeOptionsSplit`)
- [ ] Behavioral coverage of `announceFreeOptionsSplit` itself — OPEN per
      Loop 3; code-read evidence only for its gate, sidecar, and refresh
      branch (recorded, not claimed green)
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** pending (closure + archive land with the closure commit, G2)
- **Fix Description:** two proactive user-facing surfaces — the one-time
  free-options boot notice (pre-TUI stderr, settings-flag retirement,
  non-free builds) and the boot system message announcing the cached
  free-lane split (sidecar once-per-set, fail-silent background refresh when
  absent/stale)
- **Tests Added:** yes — 8 pins (cli-boot-steps.test.ts: 2; free-options.test.ts: 6)
- **Verification Evidence:** typecheck cli exit 0; 19/19 pins; eslint exit 0
  on all 12 source files (10 modified + 2 new); quality exit 0 after the
  Loop 2 `liftCatalog` split; prettier --check clean; markdownlint exit 0;
  FID line-length audit 0 lines over MD013; Adversary re-verified every
  citation against the tree (Loop 3)
- **Archived:** pending (with the closure commit)

## Lessons Learned

1. **A proactive surface the pipeline "built" can still reach nobody.** The
   discovery pipeline's announce path was wired to dev-side state
   (`dev/provider-candidates/`) that shipped users never have, and the
   on-demand command had zero discoverability. Reachability evidence must
   cover WHO reaches the surface, not just that the code exists.
2. **Operator rulings age.** The 2026-09-28 surface selection ("no boot
   banners") was correct then; four months later the operator reversed it.
   A ruling's premise must be re-grounded at execution time.
