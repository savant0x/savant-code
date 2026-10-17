# FID: fresh, complete free-options boot panel

**Filename:** `FID-2026-1017-005-fresh-free-options-boot-panel.md`
**ID:** FID-2026-1017-005
**Severity:** medium
**Status:** verified
**Created:** 2026-10-17 12:51
**Automation level:** 3
**YAGNI-Compliance:** Verified — reuses the existing traffic-light panel, the
compaction-summary collapse contract, the existing refresh/single-flight path and
the existing markdown artifact; no new service, store or dependency.

---

## Summary

The boot digest reads the free-options cache synchronously and posts a text
summary before the provider refresh it depends on has run. On a boot with an
expired cache the user sees the **old** catalog while the refresh is in flight,
and never sees the result; the digest also truncates the payload (two offer
titles, no model ids) and points at `free-options.md` by bare filename while the
writer resolves the file through `freeOptionsPaths().markdown`. The complete
answer therefore exists only in a best-effort side artifact that the UI never
locates. This FID replaces the text digest with a first-class transcript panel:
freshness is resolved before the panel posts (cache ≤12 h is shown with its
exact age; older triggers a bounded refresh), the panel renders through
`TrafficLightPanel`, collapsed by default, and expands to every wired model id,
every not-wired lane and every advertised offer. The same derived view feeds
the panel, the markdown export and `/provider free`, so the three surfaces
cannot disagree; the export failure is surfaced instead of swallowed, and the
artifact carries its resolved path, `fetchedAt`, `generatedAt` and a body
generation hash that the reader verifies.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** repository pin per `package.json` / `bun.lock`
- **Commit/State:** `main` @ `a39809a6`; worktree clean except the operator's
  untracked `docs/design/Savant-Code Parallel Architecture Blueprint.md`

## Detailed Description

### Problem

1. **Boot posts before freshness is known.** The digest effect calls
   `runLaunchDigest` with `readReport: readCachedFreeOptionsReport`
   (`cli/src/chat/use-chat-bootstrap.ts:120-121`), a synchronous cache read
   that never fetches (`cli/src/utils/free-options.ts:224-245`). The only
   refresh on boot is started by the separate provider-notification mount,
   and only when the cache is missing or `stale`
   (`cli/src/chat/provider-notification-lifecycle.ts:65`). The digest has
   already rendered by then, so an expired boot shows the expired values.
2. **The digest is a bounded preview, not the feature.** It prints counts,
   the first five provider labels and the first **two** offer titles
   (`cli/src/utils/free-options-render.ts:202`); no model id appears at boot.
   The command shows at most ten attributed offers
   (`cli/src/utils/free-options-offers.ts:11,99-103`). Only the markdown
   artifact retains every row.
3. **The promised artifact is addressed by bare filename.** The writer resolves
   `freeOptionsPaths().markdown` (`cli/src/utils/free-options.ts:167,202`), but
   the user-facing line hardcodes `free-options.md` and claims the agent can
   read it (`cli/src/utils/free-options-render.ts:134`). On a machine with
   `~/.savant-code`, `-dev` and `-test` directories the name alone leads to the
   wrong copy.
4. **The write failure is swallowed on a false premise.** The markdown write is
   inside a `try/catch` whose comment says persistence does not matter because
   “the command output already carries the information”
   (`cli/src/utils/free-options.ts:202-205`). The command output explicitly does
   not carry the model ids; it defers to the file.
5. **The three surfaces derive separately.** The digest reads the cache plus a
   separate offer store; `/provider free` refreshes and rewrites; the markdown
   is rendered from that refresh report. Unifying the filename would not
   unify the data or its vintage.
6. **No in-product complete view exists.** 146 model ids and 223 offers are
   only reachable by opening a generated file, with no path, age or identity in
   the file that a reader can check against the current resolution.

### Expected Behavior

- On boot the free-options panel posts **after** a freshness decision:
  - cache age ≤ 12 h → no fetch; the panel states the exact age
    (`cached 3h ago`);
  - cache older than 12 h or absent → one bounded refresh (single-flight with
    the provider lifecycle, 6 s budget over the existing 5 s fetch timeout),
    then the refreshed report, labelled `refreshed just now`;
  - refresh fails or exceeds the budget → the cached copy, labelled
    `STALE · refresh failed`, or `catalog unavailable` when there is no cache.
    A stale copy is never presented as current.
- The panel renders in `TrafficLightPanel`, collapsed by default, with one
  header line (freshness, counts, absolute artifact path) and one expand
  control. Expanding mounts the full payload: every wired model id, every
  not-wired lane with its model ids and setup command, every local lane, and
  every advertised offer grouped by category with deadline and attribution.
  Collapsed rendering mounts none of those rows.
- Panel, markdown export and `/provider free` render from one derived view, so
  counts, lanes and offers cannot diverge.
- The artifact header carries its resolved path, `generatedAt`, `fetchedAt` and
  a generation hash over the body. The boot reader verifies the path,
  `fetchedAt` and hash and labels a missing, mismatched or corrupt export
  instead of implying it is current.
- A failed export is reported in the panel and in the command, not swallowed;
  the affordance names the resolved absolute path and drops the unsupported
  “ask the agent to read it” claim.

### Root Cause

The boot surface was built as a cheap text announcement over a cache reader
(`FID-2026-1001-002`), then composed into a once-per-day digest
(`FID-2026-1004-007`, `FID-2026-1008-004`) without a freshness join or a UI
data contract. Freshness lives in the refresh path, completeness lives in the
markdown writer, and addressability lives in nobody: each surface owns one
piece, and the boot surface owns none of the complete payload. Rendering that
payload as a transcript block (the existing `compaction-summary` precedent)
was never considered because the digest was modeled as text, not as a view.

### Evidence

```text
cli/src/chat/use-chat-bootstrap.ts:120   runLaunchDigest({
cli/src/chat/use-chat-bootstrap.ts:121     readReport: readCachedFreeOptionsReport,
cli/src/utils/launch-digest.ts:24        const lines = renderFreeOptionsDigest(
cli/src/chat/provider-notification-lifecycle.ts:65
                                          if (!cached || cached.stale) void refresh().catch(() => {})
cli/src/utils/free-options.ts:202        writeFileAtomic(paths.markdown, renderFreeOptionsMarkdown(report))
cli/src/utils/free-options.ts:204        // Persistence is best-effort; the command output already carries the
cli/src/utils/free-options-render.ts:134 'The full reference (with model ids) is saved to free-options.md ... ask the agent ...'
cli/src/utils/free-options-render.ts:202 .slice(0, 2)
cli/src/utils/free-options-offers.ts:11  export const MAX_COMMAND_OFFER_ROWS = 10
cli/src/utils/free-options-offers.ts:103 `- … and ${hidden} more — the full list is in free-options.md`
cli/src/types/chat.ts:132                type: 'compaction-summary'
cli/src/hooks/use-chat-messages.ts:270   if (block.type === 'compaction-summary' && block.id === id)
cli/src/components/blocks/single-block.tsx:141  case 'compaction-summary':
```

The existing panel precedent is complete: `CompactionSummaryBlock` renders
through `TrafficLightPanel`, folds by block id and keeps the full payload in
the block (`cli/src/components/compaction-summary-block.tsx`). The collapse
updater already preserves identity for untouched messages
(`cli/src/hooks/use-chat-messages.ts:184-297`).

## Impact Assessment

### Affected Components

- `cli/src/chat/use-chat-bootstrap.ts` (boot wiring)
- `cli/src/utils/free-options-boot.ts` (new freshness resolver)
- `cli/src/utils/free-options-view.ts` (new shared derived view)
- `cli/src/utils/free-options.ts` (refresh, export status, verification)
- `cli/src/utils/free-options-render.ts` and `free-options-offers.ts` (render from the view; resolved path)
- `cli/src/types/chat.ts` (free-options block type)
- `cli/src/components/free-options-panel.tsx` (new panel)
- `cli/src/components/blocks/single-block.tsx`
- `cli/src/hooks/use-chat-messages.ts`
- `cli/src/utils/launch-digest.ts` (retired; replaced by the panel)
- `scripts/probes/free-options-boot-artifact.ts`

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium — user-visible boot content and a persisted artifact change; the
  no-cache, offline and restore paths are the risk surface.

## Proposed Solution

### Approach

One resolver decides freshness, one view derives the payload, one panel renders
it, and one artifact writer records identity. The existing refresh single-flight
(`refreshFreeOptions`), the existing panel chrome and the existing collapse
contract are reused; no new store, network path or dependency is introduced.

### Contracts

**Boot freshness** (`cli/src/utils/free-options-boot.ts`):

```ts
export const BOOT_CACHE_MAX_AGE_MS = 12 * 3600_000 // operator ruling 2026-10-17
export const BOOT_REFRESH_BUDGET_MS = 6_000

export type FreeOptionsBootSource =
  | 'cache' | 'refresh' | 'stale-cache' | 'unavailable'

export type FreeOptionsBootSnapshot = {
  report: FreeOptionsReport
  source: FreeOptionsBootSource
  /** now − Date.parse(fetchedAt); null when no catalog exists. */
  ageMs: number | null
  /** Present when the refresh failed or exceeded the budget. */
  refreshError?: string
  artifact: FreeOptionsArtifactCheck
}
```

`resolveBootFreeOptions({ now, readCached, refresh, budgetMs, wait })`:

1. Read the cache. If `ageMs <= 12 h`, return it as `cache` with no fetch (the
   operator's 12 h ruling is the threshold, not the report's 24 h `stale` flag).
2. Otherwise `Promise.race` the refresh against `wait(budgetMs)`.
3. A refresh that produced a network catalog (new `report.catalogSource ===
   'network'`) returns `refresh`. A refresh that returned its own cache
   fallback returns `stale-cache` with `refreshError`; a rejected or timed-out
   refresh returns `stale-cache` when a cache exists, else `unavailable`.
4. Verification runs on the resolved snapshot. It never throws; every failure
   becomes a label.

`bootFreshnessLabel(snapshot)` is exported for the panel and tests:
`fresh · cached 3h ago` · `refreshed just now` ·
`STALE · 14h old · refresh failed` · `catalog unavailable`.

**Shared view** (`cli/src/utils/free-options-view.ts`):

```ts
export type FreeOptionsView = {
  header: {
    freshness: string
    fetchedAt: string | null
    generatedAt: string
    generationId: string
    markdownPath: string
    counts: {
      wiredProviders: number; wiredModels: number
      notWiredProviders: number; notWiredModels: number
      local: number; discoveryOnly: number
      offers: number; offersEndingSoon: number
    }
  }
  wired: Array<{ providerId: string; label: string; models: string[] }>
  notWired: Array<{ providerId: string; label: string; models: string[]; setupCommand: string }>
  local: Array<{ id: string; label: string; setupCommand: string }>
  discoveryOnly: Array<{ providerId: string; label: string; models: string[] }>
  offers: Array<{ category: string; rows: FreeOfferRow[] }>
  quotaFootnote: string
}
```

`buildFreeOptionsView(report, { nowMs, markdownPath, generatedAt })` is pure.
`renderFreeOptionsMarkdown(view)` becomes a serializer over the same view, and
`renderCommandOutput(view, options)` reads the same sections (still bounded,
but bounded by an explicit `maxOfferRows` presentation argument, never by a
different data source). Both the panel and the markdown get every model id;
the command keeps its bounded presentation and points at the panel/path.

**Artifact identity** (`cli/src/utils/free-options.ts`):

- `renderFreeOptionsArtifact(view)` returns `{ text, generationId }`, where the
  text starts with a machine-readable HTML comment header:
  `path`, `generatedAt`, `fetchedAt`, `generationId`; `generationId` is
  `sha256` of the body **after** the closing `-->`.
- `verifyFreeOptionsArtifact({ report, path })` reads the file, parses the
  header, recomputes the body hash, and checks `path ===
  freeOptionsPaths().markdown` and `fetchedAt === report.fetchedAt`. Returns
  `{ ok, reason?: 'missing' | 'unreadable' | 'path-mismatch' |
  'fetchedAt-mismatch' | 'generation-mismatch' }`. The hash proves integrity and
  a wrong-path copy is detectable; currency is established by the `fetchedAt`
  equality, stated as such.
- `refreshFreeOptionsOnce` writes the artifact and sets
  `report.exportStatus = { path, ok, generatedAt, generationId, error? }`.
  A write failure sets `ok: false` and the error; it is never swallowed. The
  refresh still returns the in-memory report, because the panel is complete
  without the file — but no surface claims the file exists.
- `catalogSource: 'network' | 'cache' | 'none'` is added to the report by the
  refresher and cache reader, so the boot resolver can distinguish a real
  refresh from a cache fallback.

**Boot block** (`cli/src/types/chat.ts`):

```ts
export type FreeOptionsContentBlock = {
  type: 'free-options'
  id: string
  snapshot: FreeOptionsBootSnapshot
  discovery: { newCount: number; changedCount: number } | null
  /** On-disk path resolved by the same function the writer uses. */
  markdownPath: string
  isCollapsed?: boolean
  userOpened?: boolean
}
```

The block is JSON-safe (no functions, no render callbacks) and lives only in UI
messages, like `compaction-summary`; it is never sent to a model.

### Steps

1. **Freshness resolver** — add `free-options-boot.ts` with the contracts above,
   injected `now`/`readCached`/`refresh`/`wait`, a 6 s budget, a 12 h cache
   threshold, cancellation-safe settling, and `bootFreshnessLabel`.
2. **Refresh provenance and export status** — add `catalogSource` and
   `exportStatus` to `FreeOptionsReport`; make `refreshFreeOptionsOnce` return
   the write outcome and the generation id instead of swallowing it; keep
   `writeFileAtomic` and the single-flight unchanged.
3. **Artifact identity and reader verification** — add the header comment,
   `renderFreeOptionsArtifact`, `verifyFreeOptionsArtifact`, and wire the check
   into the boot snapshot. No surface prints a path without the check's result.
4. **Shared view** — add `free-options-view.ts`; move lane/offer grouping and
   count arithmetic into it; render the markdown, the command and the panel
   from it. Remove the two-title boot preview and the ten-row command cap from
   the data layer (the command keeps a presentation cap with the remainder
   counted).
5. **Panel component** — add `free-options-panel.tsx` using `TrafficLightPanel`:
   collapsed header `Free options — <freshness> · <wiredModels> models on
   <wiredProviders> wired · <offers> offers · <notWired> not wired` plus the
   absolute path and export status; expand mounts every section and offer;
   `CollapseButton` at the end; theme tokens only.
6. **Transcript wiring** — register the block in `single-block.tsx` and in
   `updateBlocksCollapseRecursively` (default collapsed), and replace the
   digest effect in `use-chat-bootstrap.ts` with one async resolve that appends
   exactly one system message. Retire `launch-digest.ts` and its test; the
   equivalent properties (post once per boot, nothing-to-say suppression) move
   to `free-options-boot.test.ts`.
7. **Path and affordance parity** — pass `freeOptionsPaths().markdown` to the
   command and offers renderers; delete the hardcoded `free-options.md` strings
   and the “ask the agent” claim; state the resolved path, and mark a failed
   export as failed.
8. **Acceptance artifacts** — the four test suites below plus
   `scripts/probes/free-options-boot-artifact.ts`; update the existing
   free-options pins; live-smoke the panel in tmux with a seeded 13 h cache.

### Verification

- Freshness matrix: fresh cache (3 h) makes no refresh call; 13 h cache with a
  successful refresh uses the refreshed report; 13 h cache with a failing
  refresh keeps the cache and labels it stale; no cache with a failing refresh
  labels the catalog unavailable; the budget arm returns without waiting for a
  hung refresh; a late refresh settles without a second post.
- Panel: collapsed render contains the header, freshness, counts and absolute
  path, and **not** the model ids; expanded render contains every wired model
  id, every not-wired lane, and every offer (counts asserted against the
  fixture); export failure and artifact mismatch are visible; the command
  output no longer contains “ask the agent”.
- One view: the model/offer counts in the panel data, the markdown body and the
  command output agree; the markdown header's path equals
  `freeOptionsPaths().markdown`; a copy at another path fails verification.
- Exposure: `cli/src/utils/__tests__/free-options-boot.test.ts`,
  `cli/src/utils/__tests__/free-options-view.test.ts`,
  `cli/src/components/__tests__/free-options-panel.test.tsx`,
  `cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts`,
  `cli/src/utils/__tests__/free-options.test.ts`,
  `cli/src/utils/__tests__/free-options-offers.test.ts`, and the probe.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/free-options-boot.test.ts
- gate: test cli/src/utils/__tests__/free-options-view.test.ts
- gate: test cli/src/components/__tests__/free-options-panel.test.tsx
- gate: test cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts
- gate: test cli/src/utils/__tests__/free-options.test.ts
- gate: test cli/src/utils/__tests__/free-options-offers.test.ts
- gate: probe scripts/probes/free-options-boot-artifact.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:e8055376ad751514943801bc45f0a99cb3efc37f7b7f909a3825794bbfa76c25
- verified: 2026-10-17T17:08:44.580Z
- typecheck cli: exit 0
- test cli/src/utils/__tests__/free-options-boot.test.ts: exit 0
- test cli/src/utils/__tests__/free-options-view.test.ts: exit 0
- test cli/src/components/__tests__/free-options-panel.test.tsx: exit 0
- test cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts: exit 0
- test cli/src/utils/__tests__/free-options.test.ts: exit 0
- test cli/src/utils/__tests__/free-options-offers.test.ts: exit 0
- probe scripts/probes/free-options-boot-artifact.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Six defects cataloged, each with the live line: synchronous
  cache-only read at boot (`use-chat-bootstrap.ts:121`), refresh after the
  digest and only when stale (`provider-notification-lifecycle.ts:65`),
  two-title/no-id preview (`free-options-render.ts:202`), hardcoded filename
  plus unsupported agent claim (`free-options-render.ts:134`), swallowed write
  with a false premise (`free-options.ts:202-205`), and no single derived view.
- **GREEN:** A 12 h freshness resolver, a shared view, a traffic-light panel
  block with full expansion, artifact identity and read-back verification,
  surfaced export failure, and path parity from `freeOptionsPaths()`.
- **AUDIT:** Every cited line was read on `a39809a6`; the collapse-updater,
  `CompactionSummaryBlock`, `single-block.tsx` dispatch and the `ChatMessage`
  block union were re-read to confirm the panel is an additive block, not a
  new render pipeline. `refreshFreeOptions` single-flight and the 5 s fetch
  timeout were read to size the 6 s budget.
- **ADVERSARIAL:** A hostile boot can (a) present an expired cache as current —
  the resolver labels every non-network source and never emits `refreshed`
  without `catalogSource === 'network'`; (b) point at another copy — the path
  is resolved by the writer's function and the reader checks it; (c) claim a
  file a failed write never produced — `exportStatus.ok === false` is rendered;
  (d) stall the boot — the budget arm returns, and the single-flight refresh
  continues without blocking the transcript; (e) edit the markdown body — the
  generation hash fails; (f) replay an old file at the right path — `fetchedAt`
  mismatch fails. It cannot prove that the file's prose was read by a human or
  that the feed's claims are true; those stay known limits.
- **CHANGE DELTA:** 100% (initial authoring pass).

### Missed Questions

1. **What is the freshness threshold?** 12 h, set by the operator in this
   session (“fetch older then 12h”). The report's existing 24 h `stale` flag is
   a data-validity flag, not the boot threshold; both are displayed.
2. **Why not refresh on every boot?** The operator chose 12 h. A ≤12 h cache is
   shown with its exact age; a >12 h cache is refreshed before the panel posts.
3. **What happens offline with a >12 h cache?** The panel posts the cache
   labelled `STALE · <age> · refresh failed`, with the fixed generic reason
   (the fetch layer deliberately does not expose internals). It never posts
   `fresh`.
4. **What happens on a first run with no network?** `refreshFreeOptions`
   already returns a local-lane report with `fetchedAt: null`; the panel says
   `catalog unavailable` and still lists local lanes. If there are no local
   lanes and no discovery delta, nothing posts.
5. **Does the 6 s wait block the TUI?** No; it delays one message append. The
   input bar, header and other boot messages are independent, and the existing
   fetch timeout is 5 s, so the budget covers normal failure.
6. **Can two boot paths double-fetch or double-post?** `refreshFreeOptions` is
   single-flight; the boot effect keeps its once-ref and a cancellation flag;
   exactly one block is appended.
7. **Why a transcript block instead of a pinned banner?** It matches the
   `compaction-summary` precedent, scrolls with its content, uses the existing
   collapse toggle and state, and does not permanently shrink the viewport.
8. **Does the full payload bloat model context?** No. Chat-store system messages
   are UI-only; the block never enters the SDK message list. The existing
   digest has the same status.
9. **How are 223 offers rendered without a wall?** They are mounted only on
   explicit expand, grouped by category with counts; collapsed mounts none of
   the rows. The same rule applies to the 146 model ids.
10. **Does the command keep its ten-row cap?** Yes, as a presentation choice,
    but from the same view and with the **resolved path** in the remainder
    line; the panel is the complete in-product surface.
11. **What exactly does the generation hash prove?** Integrity of the bytes
    after the header and detection of a copy at a different path (via the path
    field + reader check). Currency is `fetchedAt` equality, not the hash; the
    FID states this instead of overclaiming.
12. **What if the artifact is stale but the cache is fresh?** Verification
    fails with `fetchedAt-mismatch` (or `missing`) and the panel labels the
    export, while the panel's own data stays the fresh cache. The user sees both
    truths.
13. **Is the markdown still agent-readable?** Yes. The file remains a plain
    markdown reference; it now carries its own path and identity header. The
    unsupported claim that the agent can read outside the project root is
    removed.
14. **What about the old digest tests?** `launch-digest.test.ts` is retired with
    `launch-digest.ts`; its once-per-boot, nothing-to-say and fail-silent
    properties are re-pinned in `free-options-boot.test.ts` and the panel
    suite. This is a replacement of a superseded surface, not a weakened gate.
15. **Does the block survive restore/export?** It is JSON-safe and behaves like
    `compaction-summary`: a UI-only block in memory. Restored history carries no
    boot block, which is correct — a new boot resolves a new snapshot.

### Loop 2 — Independent audit and self-correction

- **RED:** The first draft let the view compute the generation id, which would
  have required hashing a report that did not yet contain the export status and
  would have made the header circular. The first draft also treated the
  report's `stale` flag as the boot threshold, which is 24 h, not the
  operator's 12 h.
- **GREEN:** The generation id now hashes the rendered body only; the header is
  prepended after hashing, and verification re-reads the body. Freshness uses
  `ageMs` from `fetchedAt` against `BOOT_CACHE_MAX_AGE_MS = 12 h`; the 24 h
  `stale` flag remains a displayed data-validity fact.
- **AUDIT:** Re-read `free-options.ts:167-235` to confirm the refresh always
  produces a report (including the cache fallback and the no-cache local-lane
  case), so the resolver never needs a separate builder. Re-read
  `free-options-render.ts:96-140` to confirm every hardcoded filename/agent
  claim and the two-title limit are in the surfaces being replaced.
- **ADVERSARIAL:** A refresh can succeed while the write fails; the panel must
  still show the fresh data and must not claim the file is current.
  `exportStatus.ok` plus read-back verification keeps those claims separate.
  A 12 h cache can still be wrong if the feed changed in the last 12 h; the
  panel shows the age so the user can decide, which is the chosen trade-off.
- **CHANGE DELTA:** ~8% (identity header, threshold, export/artifact split).

### Loop 3 — Final convergence

- **RED:** Remaining risks: `free-options-render.ts` is at the 300-line ceiling;
  adding a view serializer could breach it. The panel mounts hundreds of rows
  when expanded. Changing `renderFreeOptionsMarkdown`'s signature touches all
  existing tests.
- **GREEN:** The view module owns grouping/counts; the renderer keeps only
  string assembly and stays under the ceiling, with `free-options-offers.ts`
  absorbing offer formatting. Expanded rows are conditional on `isCollapsed`,
  so collapsed boot mounts none. Markdown/command tests are updated in the same
  slice; no test is deleted except the superseded `launch-digest` pins.
- **AUDIT:** Gate list re-checked against the allowlist: `typecheck cli`, six
  existing/new `*.test.ts(x)` paths, a durable `scripts/probes/*.ts`, and
  `quality`. No gate points at scratch.
- **ADVERSARIAL:** The strongest counterargument is that 12 h caching still
  permits day-old data. The operator chose it explicitly; the panel never hides
  the age, and any >12 h boot resolves fresh or labels failure. The design does
  not claim the feed is complete or that eligibility is verified.
- **CHANGE DELTA:** ~3% (verify-path wording, collapse default, gate list).

### Implementation audit (2026-10-17)

- **RED:** Two defects appeared while wiring the implementation. (1) The
  timeout sentinel typed as a plain `symbol` let `Promise.race` infer
  `symbol | FreeOptionsReport`, so the resolver did not narrow and the
  typecheck leg failed; a discriminated `{ timeout: true }` object fixed the
  narrowing. (2) The artifact probe wrote its tampered copy to a *different*
  path, so path validation correctly rejected it before the hash check and the
  probe's assertion looked wrong; the probe now tampers in place so each check
  tests one property.
- **GREEN:** The sentinel is a typed literal object with an `in` guard; the
  probe overwrites the verified path, then writes a clean copy elsewhere for
  the path-mismatch case. The artifact writer was also extracted to
  `persistFreeOptionsArtifact` so the write outcome is directly testable
  (ok + generation, and a forced failure that returns rather than throws).
- **AUDIT:** `bun run typecheck` (cli) exit 0; root `bun run typecheck` exit 0;
  the six declared suites 62 pass / 0 fail / 204 assertions; full CLI suite
  4174 pass / 28 skip / 0 fail; probe exit 0; `quality:report` PASS;
  `validate:repository` PASS. The deleted `launch-digest` pins were replaced
  by the boot matrix and panel pins, not weakened.
- **ADVERSARIAL:** A fresh cache still may be 11 h old; the panel says so
  instead of calling it "refreshed". A write can succeed while the next boot
  sees a different `fetchedAt` (concurrent refresh); verification labels the
  mismatch and never upgrades the file to current. The generation hash cannot
  prove semantic truth, only that the bytes after the header are intact.
- **CHANGE DELTA:** implementation-only; the contract sections were not
  rewritten.

## Known Limits

- “Fresh” means within the operator's 12 h threshold, or a successful boot
  refresh. The catalog itself may lag its upstream feed.
- The generation hash proves byte integrity and wrong-path detection; it does
  not prove the file is the newest possible artifact. Currency is the
  `fetchedAt` comparison, and the panel shows both.
- The advertised offers' eligibility is unverified, as before; the panel keeps
  the existing caveat.
- The panel's expanded view is long by design (every id and offer). It is
  mounted only on demand, so boot remains bounded.
- No live network guarantee: the offline path is tested with injected failures
  and a temp config dir.
- No live TUI smoke in this environment: `tmux` is not installed (the repo's
  own tmux suites skip with "Install tmux"). The boot path is verified at the
  resolver/handler boundary and the panel through a static render; a real
  terminal boot/expand remains an operator observation item.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending closure commit (implementation is in the working
      tree at the time of this stamp)
- [x] **File:line ranges:** `cli/src/utils/free-options-boot.ts:19-195`
      (thresholds, resolver, labels); `free-options-view.ts:1-147` (shared
      sections/counts/caveats); `free-options-artifact.ts:29-168` (body,
      header, hash, read-back verification); `free-options.ts:164-282`
      (`persistFreeOptionsArtifact`, `catalogSource`, export status);
      `free-options-render.ts:20-94` (markdown/command from the view);
      `free-options-panel.tsx:24-272` (collapsed/expanded panel);
      `use-chat-bootstrap.ts:119-164` (async resolve + single post);
      `single-block.tsx:151` and `use-chat-messages.ts:267-296` (dispatch and
      collapse); `provider-subcommands-handlers.ts:231-237` (resolved path).
- [x] **Gate output:** typecheck cli exit 0; six suites 62 pass / 0 fail;
      probe `PASS — boot freshness, one view and artifact identity held`;
      `quality: PASS (400-line ceiling, 1490 baselined files)`; root typecheck
      exit 0; full CLI suite 4174 pass / 28 skip / 0 fail;
      `validate:repository` PASS.
- [x] **Reproducibility:** `grep -rn "resolveBootFreeOptions\|persistFreeOptionsArtifact\|renderFreeOptionsArtifact\|verifyFreeOptionsArtifact" cli/src`
      resolves the wiring; the six suites and the probe are repo-relative.
- [x] **Step statuses:** every Proposed Solution step is `implemented`
      (resolver, provenance/export status, identity/verification, shared view,
      panel, transcript wiring, path parity, tests + probe).

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** pending
- **Fix Description:** pending
- **Tests Added:** pending
- **Verification Evidence:** pending
- **Archived:** pending

## Lessons Learned

A boot surface that announces a payload it does not carry is a promise the
system cannot keep. Freshness, completeness and addressability are one feature:
deciding them in three different modules produces a digest that is stale, a
file that is orphaned and a command that points at neither. Derive the view
once, resolve freshness before rendering it, and make the artifact prove its
own path and vintage.
