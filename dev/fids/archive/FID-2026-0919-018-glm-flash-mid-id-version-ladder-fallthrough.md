# FID-2026-0919-018 — Mid-id-version gateway ids fall through the OpenRouter ladder to the 200k default

- **Filename:** `dev/fids/FID-2026-0919-018-glm-flash-mid-id-version-ladder-fallthrough.md`
- **ID:** FID-2026-0919-018
- **Severity:** medium
- **Status:** closed
- **Created:** 2026-09-19
- **Commit SHA:** a3d37313 (operator-authorized 2026-09-19)
- **Closed Date:** 2026-09-19 (commit a3d37313)
- **Archived:** 2026-09-19 — moved to `dev/fids/archive/`
- **Parent:** FID-2026-0919-016 (same defect class: stripped gateway id fails to
  reach its true OpenRouter twin; different layer — 016 fixed terminal-version
  family matching, this is the mid-id-version crack between branches 3 and 3b)

## Symptom

Operator sidebar (live TUI, 2026-09-19): model `kiosapi/glm-5.3-flash-free`,
Context `74.0k/200.0k (default)` — the provenance badge honestly reports the
conservative default while OpenRouter's `z-ai/glm-5.3-flash` page and catalog
report **1,310,720** (1.3M). The operator's bar (FID-2026-0914-002) is "not
artificially restricted on any model"; a 200k window on a 1.3M model is a
5.5× artificial restriction with no provenance trail beyond `(default)`.

## Loop 1 — RED (live-proven)

Probe `dev/scratchpad/probe-glm-flash-window.ts` (verbatim-faithful port of
`lookup.ts` resolution, run against the live OpenRouter catalog, 2026-09-19):

```text
canonical id: glm-5.3-flash
branch 1 exact glm-5.3-flash: MISS
branch 2 base glm-5.3-flash: MISS
family reduction: "glm-5.3-flash" → familyId "glm-5.3-flash" (fires only when terminal)
branch 3 family prefix: SKIPPED/MISS (version is mid-id)
branch 3b name-family "glm-5.3-flash": SKIPPED (guard familyName !== canonical)
=== what the CLI resolves today ===
tier 1 MISS on all branches (3b guard-skipped: familyName === canonical)
→ kiosapi roster (tier 2) decides; absent context_length there → default 200k "(default)"
```

Confirmed facts:

1. `toCanonicalModelId('kiosapi/glm-5.3-flash-free')` = `glm-5.3-flash`
   (kiosapi is registry-listed → prefix strips; `-free` variant strips).
2. OpenRouter catalog (live, HTTP 200) carries `z-ai/glm-5.3-flash` at
   ctx 1,310,720 — plus `z-ai/glm-5.3-flashx` (1,048,576) and
   `z-ai/glm-5.3-flash:batch` (1,048,576) as near-collisions that a correct
   match MUST NOT bleed into.
3. Branch 3's reduction regex `/-v?\d+(\.\d+)?$/` only strips TERMINAL
   versions. `glm-5.3-flash` has a mid-id version (`glm-5.3` + suffix
   `-flash`), so `familyId === canonical` and the whole branch-3 block
   (including 016's exact-version preference) never executes.
4. Branch 3b is guarded by `familyName && familyName !== canonical`. For a
   single-segment canonical whose family reduction failed, `familyName ===
   canonical` — the guard skips the branch precisely when the canonical IS
   the upstream terminal segment, i.e. when an EXACT terminal-segment match
   exists. The guard was written for genuinely version-less ids ("mimo") but
   fires equally on mid-id-version ids, blocking the best available match.
5. Tier 2 structurally cannot answer for kiosapi: the adapter parses the
   OpenAI-compatible `/v1/models` shape whose standard entries carry no
   `context_length` (parser stores `undefined`).
6. Branch 4 (display-name matching) is dead for kiosapi ids: the roster has
   no `name` metadata, the parser falls back `name = upstreamId`, and
   `"glm-5.3-flash-free"` fuzzy-matches no OpenRouter display name.
7. Fallback table has no `kiosapi/*` rows → tier 4 default 200k,
   source `'default'` — matching the sidebar badge exactly.

The defect generalizes: ANY stripped gateway id whose canonical has a mid-id
version or no version at all (`*-flash`, `*-latest`, bare slugs) misses the
catalog whenever the exact id string isn't also a bare catalog id — the
terminal-segment equality match is never attempted.

## Loop 2 — GREEN plan (proposed)

Single insertion in `findModelFieldFromOpenRouter`
(`cli/src/utils/openrouter-models/lookup.ts`), between branch 2 and branch 3,
shared by both field resolvers (Law 13 — one ladder):

**New branch 2b — exact terminal-segment match:**

```ts
// 2b. Exact terminal-segment match: a stripped gateway canonical whose
// version is mid-id ("glm-5.3-flash") or absent IS its own upstream
// terminal segment, but branch 3 (terminal-version reduction) and 3b's
// `familyName !== canonical` guard both skip exactly this case
// (FID-2026-0919-018). Equality on the terminal segment is strict enough
// to exclude near-collisions ("glm-5.3-flashx", ":batch" variants).
const terminal = canonical.split('/').pop() ?? canonical
const byTerminal = openRouterCatalog.find(
  (m) => (m.id.split('/').pop() ?? '') === terminal,
)
if (field(byTerminal) !== undefined) return field(byTerminal)!
```

Placement after branches 1/2 keeps exact-id matches winning; before branch 3
so the exact terminal match outranks every family fallback. For
`glm-5.3-flash` the unique hit is `z-ai/glm-5.3-flash` (1,310,720); the
near-collisions fail equality (`flashx`, `:batch` suffixes ride along in the
terminal segment). Ordering within the catalog is id-sorted; on a
theoretical multi-vendor terminal collision the first sorted hit wins — the
same accepted semantics as branches 3/3b.

No changes to: prefix stripping (016, correct), branch 3/3b logic (correct
for their cases), tier 2/3 (structural limits, out of scope), sidebar
(provenance badge already honest).

### Verification intent

New suite pins: (a) `kiosapi/glm-5.3-flash-free` → 1,310,720 source
'catalog'; (b) no bleed into `glm-5.3-flashx` / `:batch` windows;
(c) max-output resolver benefits identically (shared ladder);
(d) 016's terminal-version pins still pass (sibling guard); (e) version-less
canonical still lands on the conservative default, never a guess.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/openrouter-models-fid-0919-018.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-fid-0919-016.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-lookup.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:21aaa2c549f399de05dee6aaa1089a9f87102b9d4f24ab687eec527810a87f8e
- verified: 2026-09-19T07:04:29.560Z
- typecheck cli: exit 0
- test cli/src/utils/__tests__/openrouter-models-fid-0919-018.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-fid-0919-016.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-lookup.test.ts: exit 0
- quality: exit 0

## Loop record

- Loop 1 RED: live-proven 2026-09-19 via scratchpad probe (falsified the
  initial "regex can't reduce" hypothesis — the 3b guard is the decisive
  skip; both documented above).
- Loop 2 GREEN: implemented 2026-09-19 on operator approval ("Approve").
  Branch 2b inserted in `findModelFieldFromOpenRouter`; the insertion pushed
  `lookup.ts` to 315 lines over the 300 ceiling — quality gate caught it and
  `findGatewayModel` was extracted move-only to `gateway-lookup.ts`
  (re-exported from `lookup.ts`; import paths stable). Self-caught defects:
  the first probe omitted the 3b guard and wrongly predicted branch 3b would
  answer (corrected to verbatim-faithful before any code moved); the first
  FID draft declared gates in prose (`- [ ] gate:`), rejected by
  `fid:verify` and reformatted to the machine-parseable contract.
- Loop 3 AUDIT: Method 2 re-read of final `lookup.ts` (branch 2b placement
  after exact/base, before family branches; shared by both field resolvers),
  `gateway-lookup.ts` (verbatim move, re-export intact), and the pin suite
  (near-collision exclusion proven negatively — twin removed → default).
  Gates re-run: typecheck cli 0 · fid-0919-018 5/0 · fid-0919-016 (sibling
  regression guard) green · lookup 6/0 · quality PASS (1498 files) ·
  eslint 0 · lint:md 0 · prettier clean · receipt 5/5 via `--write`,
  `--check` PASS (fingerprint `sha256:21aaa2c5…`).
- Loop 4 COMPLETE: termination criteria met — every declared gate green
  from real runs, mechanical re-run produced zero actionable findings.
