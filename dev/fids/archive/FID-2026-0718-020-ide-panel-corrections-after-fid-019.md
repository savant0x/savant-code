# FID-2026-0718-020 — medium — IDE Problems Panel Corrections After FID-019 v5

**Filename:** `FID-2026-0718-020-ide-panel-corrections-after-fid-019.md`
**ID:** FID-2026-0718-021
**Severity:** medium
**Status:** closed
**Created:** 2026-0718 00:00
**Author:** Historical record (metadata backfill)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0718-020-ide-panel-corrections-after-fid-019`. Canonical ID: `FID-2026-0718-021`. Backfilled fields: Filename, ID, Created, Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Honest Acknowledgment — FID-019 v5 was incomplete

FID-019 v5 (closed 2026-07-19) made two self-verify claims that turned out to be **wrong** when the user re-checked their IDE Problems panel after the close-out:

1. **Wrong claim A:** *"baseUrl errors fixed"* — TWO TypeScript `baseUrl` deprecation warnings at sdk/tsconfig.json:18 and agents/tsconfig.json:4 are STILL shown by the IDE after FID-019 v5 FORGE.
   - My implementation: `"ignoreDeprecations": "5.0"` in both tsconfig.json files.
   - Why it failed: `baseUrl` was deprecated IN TS 5.0. The `"5.0"` value only silences deprecations introduced BEFORE TS 5.0. So `"5.0"` does NOT cover `baseUrl`. To silence `baseUrl` you'd need `"6.0"`, but TS 5.5.4 rejects `"6.0"` (TS5103 "Unsupported ignoreDeprecations value" — caught this in earlier FID-019 v4 AUDIT).
   - **The actual ground truth:** `bunx tsc --noEmit` exits 0 (compile-time is clean), but the IDE language service still surfaces the deprecation. My FID-019 v5 verified compile-time only and over-claimed the full IDE panel was clean.

2. **Wrong claim B:** *"line 175 MD033 phantoms"* — the IDE Problems panel NOW shows MD033 at line 184 (NOT line 175) because the CHANGELOG.md got 5+ new lines inserted at the top after my FID-019 close-out entry.
   - The phantom claim was based on the wrong line number; at line 184 there is literal HTML syntax (`<id>` and `target=`) embedded in markdown documentation text — markdownlint flags this as MD033 because it parsers `<...>` literally. Real source content, not phantom.

---

## RED Inventory — Current User-Pasted IDE Problems Panel (post FID-019 v5 FORGE)

| # | File | Line:Col | Severity | Rule | Detail |
|---|------|----------|----------|------|--------|
| 1 | `sdk/tsconfig.json` | 18:5 | 8 (Hint) | TS baseUrl deprecation | "Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0." |
| 2 | `agents/tsconfig.json` | 4:5 | 8 (Hint) | TS baseUrl deprecation | Same |
| 3 | `README.md` | 2:1 | 4 (Info) | markdownlint MD041 | "First line in file should be a top-level heading" (line 1 = `<!-- markdownlint-disable MD033 -->`, line 2 = `<div align="center">`) |
| 4 | `CHANGELOG.md` | 46:1 | 4 (Info) | markdownlint MD022 | "Headings should be surrounded by blank lines [Above]" — `## FID-2026-0718-017` (line 46) immediately follows `**Archived:** 2026-07-19` (line 45) — no blank line above |
| 5 | `CHANGELOG.md` | 184:52 | 4 (Info) | markdownlint MD033 | "Inline HTML [Element: id]" — at column 52, the `<` of `/fid <id>` literal text |
| 6 | `CHANGELOG.md` | 184:109 | 4 (Info) | markdownlint MD033 | "Inline HTML [Element: target]" — at column 109, `target=` literal text in markdown docs |

**Total: 6 errors** (verified from user IDE paste + basher ground-truth read).

### Additional context — scope boundary

- **Pre-existing:** CHANGELOG.md also has 89 MD013 (line-length) warnings — out of FID-020 scope, separate FID-021.
- **Out of scope:** `dev/nova/outbox/2026-07-19-fid-018-closeout-audit-request.md` has 25+ MD022 + MD032 markdownlint warnings — file is owned by user-side outbox provenance, separate scope.
- **NEW! Surface markers:** baseUrl deprecation is ALSO latent in `cli/tsconfig.json:18` and `common/tsconfig.json:6` (not yet IDE-flagged but present in source). FID-020 fixes all 4 for consistency (ECHO Law 13 — utility-first, universal logic).

---

## Missed Questions (Q1-Q12, all source-cited per Perfection Loop)

### Q1. Will dropping `baseUrl` from sdk+agents tsconfig break the `paths` mappings?
**A:** **NO.** TypeScript 5.0+ resolves `paths` mappings **relative to the tsconfig.json file's directory**, regardless of `baseUrl`. All `paths` references are already relative (`../common/src/*`, `../sdk/src/index.ts`, `../packages/agent-runtime/src/*`, etc.), so resolution works the same with or without `baseUrl`. **Source:** `sdk/tsconfig.json:21-26` + `agents/tsconfig.json:7-10`. **Action:** Verify with `(cd sdk && bunx tsc --noEmit -p .)` + `(cd agents && bunx tsc --noEmit -p .)` exit 0.

### Q2. Will dropping `baseUrl` from cli+common tsconfig break anything else?
**A:** **NO.** Both extend `tsconfig.base.json` (which has no baseUrl). `cli/tsconfig.json` has `paths` referencing `../sdk/src/index.ts` and `../common/src/*` — both tsconfig-relative, work without baseUrl. `common/tsconfig.json` has NO `paths` (only `baseUrl: "."`) — drops cleanly. **Source:** `cli/tsconfig.json:14-18`, `common/tsconfig.json:5`. **Action:** Verify with `(cd cli && bunx tsc --noEmit -p .)` + `(cd common && bunx tsc --noEmit -p .)` exit 0.

### Q3. Will dropping `baseUrl` from all 4 tsconfigs require updating any package.json `exports`/`imports`?
**A:** **NO.** `baseUrl` is a TypeScript-internal setting that affects resolution paths. It does NOT affect runtime resolution (which uses Node/Bun resolution algorithm) or the published package.json `exports` map. **Action:** Verify `bun run build:sdk` still exits 0 post-change.

### Q4. Will removing `baseUrl` force removal of `ignoreDeprecations: "5.0"`?
**A:** **YES — cleanup.** If baseUrl is removed, there's nothing for ignoreDeprecations to silence. Better to REMOVE the now-redundant `ignoreDeprecations` field from both tsconfig.json files. **Source:** Per-deprecation audit. **Action:** Remove the `"ignoreDeprecations": "5.0",` line from sdk + agents tsconfig.json.

### Q5. Will ESLint flag the change (e.g., `@typescript-eslint/no-baseurl`)?
**A:** **NO** `@typescript-eslint/no-baseurl` rule is **NOT configured** in `eslint.config.js`. Verified by `grep -n 'no-baseurl\|baseUrl' eslint.config.js` — empty. ESLint won't flag the removal. **Source:** `eslint.config.js:1-105` (read in full).

### Q6. Will README.md MD041 fix (adding H1) break the banner image layout?
**A:** **NO.** Adding `# Savant-Code` as line 1, followed by the existing `<!-- markdownlint-disable MD033 -->` + `<div align="center">` + banner, is the correct structure. The H1 + banner is a standard README pattern. **Alternative:** Add `<!-- markdownlint-disable MD041 -->` directive line 1 to skip the rule (lighter touch, matches existing MD033 style). **Action:** AUDIT to decide between H1 vs disable-directive.

### Q7. Why does CHANGELOG.md line 46 MD022 [Above] flag when current line 45 is `**Archived:** 2026-07-19`?
**A:** **Not a phantom — real source flaw.** Line 45 contains `**Archived:** 2026-07-19` (the close-out field from FID-2026-0718-018 entry). Line 46 immediately follows with `## FID-2026-0718-017 ...` heading. No blank line between them. **Fix:** Insert blank line at line 46 (before the heading).

### Q8. What's at CHANGELOG.md line 184? Is the HTML real or phantom?
**A:** **Real source content, not phantom.** Line 184 column 52 is the `<` character of literal text `/fid <id>` inside a markdown-paragraph describing FID-012 ECHO slash commands. Column 109 area has `target=` in markdown documentation text (similar literal-text collision). **Markdownlint MD033 flags inline HTML — including literal `<...>` characters that the parser interprets as HTML tags.** **Fix:** Refactor the markdown to escape `<id>` as `` `<id>` `` (inline code) and `target=` as `` `target` ``. This is standard markdownlint convention.

### Q9. Will inserting a blank line above `## FID-2026-0718-017` cause cascade-shift of subsequent line numbers?
**A:** **NO.** Only ONE heading at line 46 needs the blank line. Line numbers downstream will shift by +1 only. Internal references by FID-id (not line number) are stable. **Verified via grep:** `git grep CHANGELOG.md:[0-9]+` is empty — no internal cross-refs. **Source:** `git grep -E --include='*.{ts,tsx,md}' 'CHANGELOG\.md:[0-9]+'` returns nothing.

### Q10. Are there OTHER markdownlint flags elsewhere (Cascade check)?
**A:** **Limited.** Current markdownlint sweep on key files:
- README.md: 2 errors covered (MD041 + existing MD033 disable)
- CHANGELOG.md: 3+ errors covered (MD022 line 46 + MD033 line 184) PLUS 89 pre-existing MD013 line-length out of scope (FID-021)
- ECHO.md / ARCHITECTURE.md / AGENTS.md: not in scope (user-pasted errors don't show these)
**Action in AUDIT:** Run `bunx --yes markdownlint-cli2 README.md CHANGELOG.md ECHO.md ARCHITECTURE.md AGENTS.md` for full visibility. Out-of-scope issues surfaced go to FID-021.

### Q11. Will package.json TypeScript version bump be needed for any of these fixes?
**A:** **NO.** All fixes work with TypeScript 5.5.4 (current pinned version). No need to bump.

### Q12. What's the AUDIT verification gate for FID-020?
**A:** **9-item AUDIT** (mirrors FID-019 v5 with updates):
- 5.1: `bunx tsc --noEmit` for sdk + agents + cli + common — all exit 0
- 5.2: `bun run build:sdk` — exit 0; check `sdk/dist/index.{cjs,mjs,d.ts}` still flat
- 5.3: `(cd sdk && bun test src/)` — 488 pass / 0 fail (regression baseline)
- 5.4: `(cd agents && bunx tsc --noEmit -p .)` — no SDK + agents `baseUrl` flag (IDE re-scan)
- 5.5: `grep -n '"baseUrl"' sdk agents cli common tsconfig.json files` — 0 hits
- 5.6: `(cd sdk && bunx markdownlint-cli2 CHANGELOG.md README.md)` — only out-of-scope MD013 (89) remain
- 5.7: User-side IDE Problems panel re-check — 0 of the original 6 errors
- 5.8: Nova outbox audit request at `dev/nova/outbox/2026-0718-fid-020-closeout-request.md`
- 5.9: `git grep CHANGELOG.md:[0-9]+ --include='*'` — empty

---

## GREEN Plan — 5 Steps (~15 min total)

### Step 1 (~3 min) — Drop `baseUrl` + `ignoreDeprecations` from `sdk/tsconfig.json`
Remove the two lines:
- `"ignoreDeprecations": "5.0",`
- `"baseUrl": ".",`
Result: `paths` mappings at lines 21-26 resolve tsconfig-relative (TS 5.0+ native behavior). No other changes.

### Step 2 (~3 min) — Drop `baseUrl` + `ignoreDeprecations` from `agents/tsconfig.json`
Remove the two lines:
- `"ignoreDeprecations": "5.0",`
- `"baseUrl": ".",`
Result: cleaner agents tsconfig; `paths` at lines 7-10 still resolve correctly.

### Step 3 (~3 min) — Drop `baseUrl` from `cli/tsconfig.json` + `common/tsconfig.json` (consistency)
Both files have `"baseUrl": ".",` for IDE/CLI consistency, even though IDE Problems panel might not currently flag them. Eliminates latent deprecation. CLI: drops line 18. Common: drops line 5` (or whichever).

### Step 4 (~3 min) — Fix README.md MD041 (DECISION 1)
Two options:
- **Option A (recommended):** Add `<!-- markdownlint-disable MD041 -->` as the very first line, ABOVE the existing `<!-- markdownlint-disable MD033 -->` directive. Cleaner — matches existing convention for individual-rule disable.
- Option B: Add `# Savant-Code` as line 1, then move existing directive + banner below. Larger blast radius (banner positioning + README renders differently).

Recommend Option A.

### Step 5 (~3 min) — Fix CHANGELOG.md MD022 + MD033
- **5a — MD022 line 46:** Insert blank line between `**Archived:** 2026-07-19` (line 45) and `## FID-2026-0718-017 ...` (line 46). One blank line at insertion.
- **5b — MD033 line 184:** Refactor literal `<id>` to `` `<id>` `` (inline code) and `target=` to `` `target` `` (inline code). Two micro-changes at line 184.

### Step 6 (~5 min) — AUDIT Verification
Run 9 commands per Q12. All must exit 0. Trigger Nova outbox audit request post-pass.

### Step 7 (~5 min) — CHANGELOG close-out + FID archive
Insert FID-020 close-out entry at top of CHANGELOG.md, archive to `dev/fids/archive/`, write Nova outbox request.

---

## 3 Inline Decisions for User Approval

### Decision 1 — README.md MD041 fix style
- **Option A (Recommended):** Add `<!-- markdownlint-disable MD041 -->` as line 1 (lightweight, matches existing MD033 disable convention)
- Option B: Add `# Savant-Code` as line 1 + restructure banner below (heavier)

### Decision 2 — baseUrl scope
- **Option A (Recommended):** Drop baseUrl from ALL 4 tsconfigs (sdk + agents + cli + common) — EC ECHO Law 13 consistency
- Option B: Drop only from sdk + agents (the IDE-flagged ones) — smaller blast radius, but latent cli+common warnings remain

### Decision 3 — CHANGELOG.md line 184 MD033 fix style
- **Option A (Recommended):** Refactor literal `<id>` and `target=` to inline-code (`` `<id>` `` and `` `target` ``) — most semantically correct
- Option B: Add `<!-- markdownlint-disable -->` directive above line 184 — lighter touch, suppresses rather than refactors

---

## 5-Question Compliance

| # | Question | Answer |
|---|----------|--------|
| 1 | Work for ALL cases? | ✅ Yes — drops baseUrl universally (TS 5.0+ native support); markdownlint disable directives are standard; inline-code refactor is canonical. |
| 2 | Scale to 1000 agents? | ✅ Yes — config-only changes; markdown fixes are file-local. |
| 3 | Survive hostile attacker? | ✅ Yes — no security-relevant changes. |
| 4 | 2-year maintainability? | ✅ Yes — removes TS 5.0+ deprecated feature; aligns with TS 7.0 future. Inline-code refactor improves readability. |
| 5 | Industry standard? | ✅ Yes — TS 5.0 `paths`-without-baseUrl is documented; markdownlint disable directives are standard. |

---

## ECHO Compliance Checklist (Laws 1-15)

- Law 1 (Read 0-EOF): ✅ — read [README.md, agents/tsconfig.json, sdk/tsconfig.json, tsconfig.base.json, cli/tsconfig.json, common/tsconfig.json, packages/agent-runtime/tsconfig.json, eslint.config.js, package.json, CHANGELOG.md head-50, CHANGELOG.md lines 175-190]
- Law 2 (Present Before Act): ✅ — this FID IS the present; awaiting approval
- Law 3 (Verify Before Proceed): ✅ — 9-item AUDIT gate
- Law 4 (Verify Call-Graph Reachability): N/A — config + markdown
- Law 5 (no pseudo-code): ✅ — concrete diffs
- Law 6 (no type safety shortcuts): ✅ — TS 5.0+ paths-without-baseUrl IS the type-safe canonical
- Law 7 (search before create): ✅ — verified no `no-baseurl` lint rule
- Law 8 (log intent): Will write session summary after FORGE
- Law 9 (production-grade docs): ✅ — config + markdown
- Law 10 (update tracking): ✅ — this FID IS the tracking artifact
- Law 11 (follow patterns): ✅ — TS 5.0 docs pattern + markdownlint conventions
- Law 12 (no sensitive data): N/A
- Law 13 (utility-first): ✅ — single baseUrl-drop pattern applied uniformly to all 4 tsconfigs
- Law 14 (all error paths handled): ✅ — 9-item AUDIT covers tsconfig × 4 + build + tests + grep + markdownlint + IDE
- Law 15 (build stays clean): ✅ — final typecheck must remain exit 0
- Cross-Agent Claim Rule: ✅ — pre-FORGE self-verify; FID-020 explicitly corrects FID-019 v5's incomplete claims

---

## Scope Boundary

| IN scope | OUT of scope (future FIDs) |
|----------|----------------------------|
| 4 tsconfig files (sdk + agents + cli + common) — drop baseUrl + ignoreDeprecations | Pre-existing 89 MD013 line-length warnings in CHANGELOG.md (FID-021) |
| CHANGELOG.md line 46 blank-line insert (MD022 fix) | The user-authored file `dev/nova/outbox/2026-07-19-fid-018-closeout-audit-request.md` (25+ MD022+MD032) (FID-022 if user requests) |
| CHANGELOG.md line 184 inline-code refactor (MD033 fix) | Other pre-existing tsconfig warnings (rootDir, ignoreDeprecations in different files) — none currently flagged by IDE |
| README.md MD041 disable directive (Option A) | ESLint 619 no-explicit-any errors (FID-023, separate policy decision) |

---

## Implementation Order

1. Step 4 (README.md MD041 disable) — 3 min
2. Steps 1-3 (4 tsconfig baseUrl drops) — 9 min
3. Step 5 (CHANGELOG.md 2 fixes) — 3 min
4. Step 6 (AUDIT 9-item verification) — 10 min
5. Step 7 (CHANGELOG close-out + FID archive + Nova outbox) — 10 min

**Total: ~35 minutes.**

---

## Status

**AWAITING USER APPROVAL** of Decisions 1, 2, 3 (Option A recommended for all). After approval + AUDIT pass + Nova verdict, file closes to COMPLETE.

### Convergence conditions for moving to FORGE

- ✅ RED phase complete (this FID)
- ✅ Missed Questions Q1-Q12 (12 of 12 answered)
- ✅ 5-Question Compliance (5/5 yes)
- ✅ ECHO Compliance Checklist (15/15 laws + Cross-Agent Claim Rule)
- ✅ AUDIT verification gate defined (9-item)
- ⏳ USER APPROVAL of 3 Decisions
- ⏳ POST-AUDIT verification + Nova sign-off

### Note on FID-019 v5 cross-FID correction

FID-020 explicitly supersedes the FID-019 v5 incomplete claims. This is documented honestly per ECHO Cross-Agent Claim Rule ("Self-reporting is prohibited"). The CHANGELOG.md close-out entry for FID-020 will reference "corrects FID-019 v5 incomplete claims" so audit trail is preserved.
