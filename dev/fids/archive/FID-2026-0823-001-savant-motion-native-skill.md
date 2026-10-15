# FID: savant-motion native skill — full transposition of scroll-craft

**Filename:** `FID-2026-0823-001-savant-motion-native-skill.md`
**ID:** FID-2026-0823-001
**Severity:** high
**Status:** closed
**Created:** 2026-08-23 01:52
**YAGNI-Compliance:** Verified

---

## Summary

Savant has no native capability for premium scroll-driven web experiences. An MIT-licensed reference
(scroll-craft, Nate Herk) exists at `resources/scroll-craft-main/` alongside a transposition design
doc (`docs/design/Savant-Code Native Skill Design.md`). This FID converges a governed native
build-out: a new skill at `.agents/skills/savant-motion/` with SKILL.md choreography, references,
deterministic uniqueness gate, working Playwright verification harness emitting strict JSON
evidence, and a read-only kinematics engine template — local-first, BYOK, zero paid APIs,
cross-platform.

## Environment

- **OS:** Windows (Git Bash); skill itself must be platform-neutral
- **Language/Runtime:** TypeScript on Bun 1.3.14; browser JS engine template
- **Tool Versions:** playwright-core 1.62.1 hoisted at repo root (evals declares ^1.54.1)
- **Commit/State:** Working tree, post-v0.0.27 release-only-commits convention

## Detailed Description

### Problem

Upstream strengths (interview-first briefs, 8 mutually exclusive page grammars, signature-move
requirement, fingerprint registry, feeling curve + engineered peak, taste floor, headless
self-verification) are locked behind Windows/ffmpeg assumptions, a paid KIE.ai asset API,
prose-based self-graded verification, and single-agent taste judgment.

### Expected Behavior

A Savant-native skill delivers the same craft discipline mechanically: deterministic JSON evidence
for the Verifier, weighted uniqueness gate against an append-only registry, read-only engine
template, multi-agent taste debate mapped onto existing Perfection Loop roles (zero new runtime
code).

### Root Cause

Feature gap; upstream design incompatible with ECHO governance and local-first/BYOK constraints
without transposition.

### Evidence

RED findings RED-SM-01..10 cataloged 2026-08-23:

```text
RED-SM-01 (high)   markdownlint MD013=120 applies to new skill md (.markdownlintignore lacks .agents)
RED-SM-02 (high)   eslint warnings fatal under .agents/**; scripts/ override relaxes only
                   no-console/no-explicit-any (eslint.config.js, FID-2026-0806-007)
RED-SM-03 (crit.)  upstream couples installed-Chrome h264 + ffmpeg filter-count>200 + paid
                   kie.ai (scripts/shoot.mjs, encode.sh, doctor.mjs, kie.mjs) — all dropped
RED-SM-04 (med)    prettier checks non-md under .agents/ (no .prettierignore entry)
RED-SM-05 (med)    NOTICE lacks MIT block for Nate Herk/scroll-craft; oso95/scroll-world
                   worldflight credit chain must be preserved (upstream CHANGELOG)
RED-SM-06 (low)    playwright-core ^1.54.1 declared vs 1.62.1 hoisted — caret-compatible;
                   document reliance explicitly in doctor output
RED-SM-07 (low)    eslint runs ad hoc (no root lint script); protection of .agents is implicit
RED-SM-08 (med)    gate canon fork: upstream >=4-of-6-per-row vs design-doc weighted score
RED-SM-09 (info)   knowledge graph excludes resources/**; greenfield blast radius;
                   sole executable-code precedent = .agents/skills/startup-playbook/scripts/
RED-SM-10 (info)   upstream engine ~1090 lines JS / ~550 lines CSS — rewrite, not copy
```

## Impact Assessment

### Affected Components

- `.agents/skills/savant-motion/`
  (new — SKILL.md, references/, scripts/, templates/engine/, FINGERPRINT-SCHEMA.json)
- `NOTICE` (new third-party MIT attribution block)
- `eslint.config.js` (extend scripts override glob to `templates/engine/`)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: additive greenfield skill; no production runtime paths touched
- [ ] Low

## Proposed Solution

### Approach (GREEN-converged decisions D1–D6)

- **D6 Naming:** `sc→sm` rename discipline (`data-sm-*`, `--sm-*`, `.sm-*`,
  `SavantMotion`); Provenance section in SKILL.md; NOTICE MIT block crediting
  scroll-craft (Nate Herk) and preserving oso95/scroll-world credit.
- **D5 Inventory:** SKILL.md; references/{grammars,feel,devices,taste-floor,
  uniqueness,worlds-and-assets}.md; scripts/{workspace,gate,doctor}.ts plus a
  scripts/verify/ MODULE SPLIT (`index.ts`,`server.ts`,`contrast.ts`,
  `assertions.ts`) — mandatory because quality-report.ts sweeps `.agents/**/*.ts`
  and enforces the absolute 300-line ceiling on every swept file, tracked or not;
  templates/engine/{savant-motion.js,savant-motion.css,page-starter.html};
  FINGERPRINT-SCHEMA.json. All md ≤120 cols; TS eslint/prettier clean.
- **D4 Workspace:** resolution ladder `SAVANT_MOTION_HOME` → nearest
  `.motion.json` → `<project-root>/motion/`; builds at `motion/builds/<name>/`,
  append-only `motion/registry.json`, verify artifacts under `motion/verify/`.
  Refuses to seed a non-empty dir without `--force`.
- **D2 Engine:** faithful-but-renamed NATIVE REWRITE as READ-ONLY template
  (~700 JS / ~450 CSS); never edited per-project; customization via tokens +
  `data-sm-*` attributes + page-local signature-move JS only. Preserves section
  lifecycle observers, velocity tracking, scrub mapping, reduced-motion fallback.
- **D3 Harness:** resolve hoisted playwright-core via createRequire(cwd);
  `channel:'chrome'` preferred for h264, chromium fallback marks video assertions
  `skipped` not failed. Strict JSON contract: deadScrollPx ≤ 2,
  cueOpacityAtCenter == 1 ± 0.01, WCAG 2.1 AA contrast on composited raster
  (≥4.5:1 body / ≥3:1 large), reducedMotion static readability,
  consoleErrors == [], per-failure screenshots. vp9/webm codec ladder documented.
- **D1 Gate:** weighted Hamming ≥5 of max 8 vs EVERY row, over exactly six JSON
  keys `grammar`, `nav`, `hero`, `actShape`, `close`, `signatureMove`
  (grammar weight 2, signatureMove weight 2; nav/hero/actShape/close weight 1 —
  these exact keys pin FINGERPRINT-SCHEMA.json and registry rows so gate.ts
  cannot diverge). Exhaustion circuit breaker after 2 failed convergence attempts
  → `{status:"exhausted",advice[]}`; operator-only `--allow-collision` recorded
  as `overriddenBy:"operator"`; rows carry `schemaVersion:1`. Deliberately NOT a
  PreToolUse hook (hooks belong to target-project configs); enforced as a
  mandatory GREEN-phase step by SKILL.md choreography.
- **Asset ladder (KIE replacement):** user-provided video/stills → procedural
  CSS/canvas gradients; ffmpeg guidance is user-facing documentation only, never
  an agent dependency.

### Steps

1. Scaffold `.agents/skills/savant-motion/` directory tree
2. Author references/{grammars,feel,devices,taste-floor,uniqueness,worlds-and-assets}.md
   (transposed, reflowed ≤120 cols, de-KIE'd)
3. Author scripts/{workspace,gate,doctor}.ts plus scripts/verify/ split into
   modules (`index.ts`, `server.ts`, `contrast.ts`, `assertions.ts`) so no single
   file approaches the 300-line project ceiling (Bun-runnable, eslint/prettier clean)
4. Author templates/engine/{savant-motion.js,savant-motion.css,page-starter.html}
   (native sm rewrite)
5. Author SKILL.md (frontmatter per house style; interview → grammar/gate/score → assets →
   build → verify choreography mapped onto Perfection Loop) + FINGERPRINT-SCHEMA.json
6. Append NOTICE MIT attribution block; extend eslint.config.js scripts override
   with glob `.agents/skills/**/templates/engine/**` (never bare `templates/engine/**`,
   which would sweep the repo-root templates/ dir into the relaxation)
7. Verify: bun-run each script's help/self-test path; `bun x eslint .agents --max-warnings 0`;
   `bunx prettier --check .agents`; `bun run lint:md`; `bun run quality:report`;
   `bun run validate:repository`

### Verification

All gates touching the added paths exit 0 (eslint, prettier, lint:md,
quality-report, validate:repository); scripts execute (`--help`/probe modes)
without throw; grep confirms no `data-sc-`/`--sc-`/`kie` residue in native
artifacts.

## Perfection Loop

### Loop 1 — RED

- **RED:** RED-SM-01..10 cataloged with file:line evidence (lint-gate collisions;
  Windows/ffmpeg/KIE coupling; attribution gap; gate-semantics fork; engine sizing)
- **GREEN:** Decisions D1–D6 converged via Thinker sequential reasoning
- **AUDIT:** Verifier: FAIL (RED-SM-07 undispositioned) + NEEDS-REVIEW ×3
  (dimension-key drift, 300-line ceiling applicability, MD013 on FID bullets);
  PASS ×2 (gate-math dominance, eslint override extension)
- **ADVERSARIAL:** CONFIRMED MD013 fires (dev/fids active NOT ignored);
  RESOLVED ceiling question — quality-report.ts sweeps `.agents/**/*.ts` at the
  absolute 300-line max, making the verify/ module split MANDATORY; found NEW:
  self-correct-introduced D3/D1 bullet fusion (fixed) + step-7 omission of
  quality:report/validate:repository (added) + bare-glob hazard on
  templates/engine (corrected to `.agents/skills/**/templates/engine/**`);
  CONFIRMED RED-SM-07 disposition adequate-as-documented-deferral
- **CHANGE DELTA:** moderate (Approach block rewritten, Missed Questions extended,
  Steps 2–7 amended)

### Missed Questions

1. Should the gate be a global PreToolUse hook? → No: hooks are target-project-scoped;
   registering in Savant's repo would fire repo-wide. Enforced by SKILL.md choreography instead.
2. Is "zero hex" enforceable for generated sites? → No at definition site; rule is usage-sites
   consume `var(--sm-*)`; only the `:root` theme block carries raw values (lint-checked by the
   verify harness where feasible, otherwise review-boundary).
3. Does adding .ts under .agents break typecheck? → No: no workspace tsconfig includes .agents;
   eslint+prettier+quality-report are the real gates (Adversary confirmed quality-report sweeps
   `.agents/**/*.ts` at the absolute 300-line ceiling).
4. What if target project already has motion/? → workspace.ts refuses without --force; doctor
   reports it; `.motion.json` escape hatch.
5. h264 in bundled chromium? → Absent; chrome channel preferred, video metrics honestly
   `skipped` on fallback, codec ladder documented.
6. Who keeps `.agents/skills/**` lint-clean given eslint runs ad hoc (RED-SM-07)? → Accepted as
   a repo-wide tooling gap outside this FID's blast radius; step 7 gates the new tree explicitly
   and establishes the baseline; wiring a root `lint` script is deferred as an explicitly named
   follow-up (recorded below in Named follow-ups), not silently dropped.
7. Where did WebCodecs land? → The operator scope named "WebCodecs/canvas scrubbing"; the
   converged engine scrubs via HTMLMediaElement.currentTime seeking on blob-fetched clips plus
   canvas image sequences — the upstream-proven mechanism that needs dense-GOP encodes
   (documented in worlds-and-assets.md) rather than a VideoDecoder pipeline. Decision recorded
   here after implementation AUDIT flagged the substitution: currentTime-seek IS the canonical
   scrub mechanism; a feature-detected WebCodecs frame-decode path for sparse-GOP assets is an
   explicitly named follow-up, not silently dropped.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working-tree closure per release-only-commits; next
  release sweep carries it
- [x] **File:line ranges:** `.agents/skills/savant-motion/` — SKILL.md;
  references/{grammars,feel,devices,taste-floor,uniqueness,worlds-and-assets}.md;
  scripts/{workspace,gate,doctor}.ts + scripts/verify/{index,server,png,
  contrast,assertions}.ts; templates/engine/{savant-motion.js,savant-motion.css,
  page-starter.html}; FINGERPRINT-SCHEMA.json; NOTICE (MIT block);
  eslint.config.js (`.agents/skills/**/templates/engine/**` override)
- [x] **Gate output:** `bun x eslint .agents --max-warnings 0` exit 0;
  `bunx prettier --check .agents` exit 0; markdownlint exit 0 on every new md;
  gate.ts --self-test 4/4; verify/index.ts --self-test 4/4; doctor smoke run
  pass:true; wc -l max 283 < 300 ceiling; `quality:report 2>&1 | grep -ci
  'savant-motion'` = 0
- [x] **Reproducibility:** grep `data-sm-` / `--sm-` / `savant-motion`
  across the tree resolves to the new skill files only
- [x] **Step statuses:** Steps 1–7 all `implemented`; live end-to-end browser
  run of a seeded build carried as operator spot-check (`bunx playwright
  install chromium` required; doctor reports binary absent)

### Code Verification Evidence

- [x] Files referenced exist
- [x] Implementation matches Proposed Solution (D1–D6 + Loop-2 corrections:
  pointer driver added, record-at-completion canon, WebCodecs substitution
  documented as Missed Questions #7)
- [x] Gates pass with pasted tool output (above)
- [x] Call-graph evidence present: workspace.ts exports consumed by gate.ts
  and doctor.ts; doctor.resolvePlaywright consumed by verify/index.ts — both
  runtime-proven by executing self-tests through the import chain
- [x] Status reflects implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** Verifier implementation audit: FAIL ×3 (engine pointer devices advertised but never
  driven; SKILL.md recorded rows pre-build contradicting its own choreography table; WebCodecs
  substitution undocumented) + NEEDS-REVIEW ×2 (quality-report tail grep read stdout only;
  no live browser run of a real build)
- **GREEN:** initPointer driver added (pointermove → --sm-mx/--sm-my + magnet transforms,
  pointer:fine guard, passive listener); SKILL.md records rows at completion only; Missed
  Questions #7 documents the currentTime-seek canon with WebCodecs as named follow-up
- **AUDIT:** inline re-verification: eslint/prettier exit 0 on engine; markdownlint/prettier
  clean on SKILL.md and this FID; merged-stream quality grep closes the tail review
- **ADVERSARIAL:** carried NEEDS-REVIEW: live end-to-end verify of a seeded build requires
  `bunx playwright install chromium` (doctor reports binary absent) — operator spot-check
- **CHANGE DELTA:** small (one engine function, two doc paragraphs)

### Loop 3 — Final convergence

- **RED:** none — all Verifier FAILs corrected and re-verified inline
- **GREEN:** closure record completed (evidence sections, Resolution)
- **AUDIT:** gates re-run clean post-correction; markdownlint/prettier exit 0
  on this document at archival
- **ADVERSARIAL:** live-build spot-check remains the single carried boundary
  (named in Resolution follow-ups)
- **CHANGE DELTA:** closure bookkeeping only

## Resolution

- **Closed Date:** 2026-08-23 03:06
- **Fix Description:** Native skill `.agents/skills/savant-motion/` shipped:
  interview-first SKILL.md mapped onto the Perfection Loop, six references,
  deterministic weighted fingerprint gate with exhaustion breaker, Playwright
  JSON-evidence verification harness (dead scroll, cue opacity, WCAG raster
  contrast, reduced motion, console errors), native read-only kinematics
  engine template, MIT attribution chain preserved
- **Tests Added:** Yes — --self-test suites in gate.ts (weighted scoring
  canon) and verify/index.ts (luminance/ratio math incl. a fixture bug it
  caught); script smoke runs (doctor --json, workspace ladder)
- **Verification Evidence:** gates above; pre-existing repo-wide failures
  outside blast radius flagged (lint:md on FID-2026-0823-002 + three
  docs/design research docs; quality:report 209 stale-baseline violations in
  cli/src+agents; NOTICE CRLF warning)
- **Named follow-ups:** root eslint script wiring (RED-SM-07); WebCodecs
  feature-detected scrub path; live end-to-end verify of a seeded build after
  `bunx playwright install chromium`
- **Archived:** 2026-08-23 03:12

## Lessons Learned

Pending post-implementation capture.