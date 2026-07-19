# FID-020 Close-Out — Nova Audit Request

**To:** Nova (external ECHO v0.2.0 audit)
**From:** Orchestrator (Buffy) via dev/nova/outbox
**Date:** 2026-07-19
**Re:** `FID-2026-0718-020-ide-panel-corrections-after-fid-019.md` — IDE Problems Panel corrections after FID-019 v5 incomplete claims
**ECHO Version:** 0.2.0

---

## Context for the Audit

User re-checked their IDE Problems panel after FID-019 v5 close-out. TWO of FID-019 v5's self-verify claims turned out to be **incomplete**:
1. `ignoreDeprecations:"5.0"` was claimed to silence `baseUrl` deprecation — actually it doesn't because `baseUrl` was deprecated IN TS 5.0 (and `"5.0"` covers only deprecations introduced BEFORE 5.0).
2. `line 175 MD033 phantom` claim was based on a wrong line number — actual line 184 has literal `/fid` and `/phase` markdown documentation text that markdownlint flags as MD033.

FID-020 corrects both. Decision: Drop `baseUrl` entirely (TS 5.0+ supports `paths` without `baseUrl` — paths resolve relative to tsconfig.json directory natively). Plus 3 markdown fixes (README MD041 disable + CHANGELOG MD022 blank-line + MD033 inline-code refactor).

---

## 14 Claims for Independent Verification (DO NOT trust summary — run/source-verify)

### Group A — `sdk/tsconfig.json` drops (2 fields)

1. **Claim 1:** `grep -n '"baseUrl"' sdk/tsconfig.json` returns nothing.
2. **Claim 2:** `grep -n '"ignoreDeprecations"' sdk/tsconfig.json` returns nothing.
3. **Claim 3:** `node -e "JSON.parse(require('fs').readFileSync('sdk/tsconfig.json'))"` exits 0 (valid JSON).

### Group B — `agents/tsconfig.json` drops (2 fields)

4. **Claim 4:** `grep -n '"baseUrl"' agents/tsconfig.json` returns nothing.
5. **Claim 5:** `grep -n '"ignoreDeprecations"' agents/tsconfig.json` returns nothing.

### Group C — `cli/tsconfig.json` + `common/tsconfig.json` drops (1 field each, consistency)

6. **Claim 6:** `cli/tsconfig.json` has NO `"baseUrl"` line. JSON valid.
7. **Claim 7:** `common/tsconfig.json` has NO `"baseUrl"` line. JSON valid.

### Group D — `README.md` MD041 disable (1 line added)

8. **Claim 8:** `head -1 README.md` is exactly `<!-- markdownlint-disable MD041 -->`.
9. **Claim 9:** `head -2 README.md` is `<!-- markdownlint-disable MD041 -->` then `<!-- markdownlint-disable MD033 -->` (line 2 unchanged pre-existing).

### Group E — `CHANGELOG.md` MD022 + MD033 fixes (2 edits)

10. **Claim 10:** `awk 'NR>=45 && NR<=46'` of `CHANGELOG.md` shows line 45 = `**Archived:** 2026-07-19`, line 46 = blank/empty (was: `## FID-2026-0718-017 ...` heading), then line 47 = `## FID-2026-0718-017 ...`. Blank line now precedes FID-2026-0718-017 heading.
11. **Claim 11:** `grep -n '`/fid`' CHANGELOG.md` returns NO matches (literal `/fid` is gone), and `grep -nE '/fid `<id>`' CHANGELOG.md` returns a hit (refactored to inline-code).
12. **Claim 12:** `grep -n '`/phase`' CHANGELOG.md` returns NO matches. `grep -nE '/phase `<target>`' CHANGELOG.md` returns a hit (refactored to inline-code).

### Group F — Runtime verification (commands you must run yourself)

13. **Claim 13:** `(cd sdk && bunx tsc --noEmit -p .)` exits 0; same for agents + common + cli.
14. **Claim 14:** `(cd sdk && bun test src/)` passes 415/415 with 0 failures; `bun run build:sdk` produces flat `sdk/dist/index.{cjs,mjs,d.ts}` (no `sdk/dist/sdk/src/` nested dir).

---

## Suggested Verification Commands

```bash
# Group A
grep -n '"baseUrl"' sdk/tsconfig.json  # Claim 1: 0 hits
grep -n '"ignoreDeprecations"' sdk/tsconfig.json  # Claim 2: 0 hits
node -e "JSON.parse(require('fs').readFileSync('sdk/tsconfig.json'))" && echo "JSON-OK"  # Claim 3: OK

# Group B
grep -n '"baseUrl"' agents/tsconfig.json  # Claim 4: 0 hits
grep -n '"ignoreDeprecations"' agents/tsconfig.json  # Claim 5: 0 hits

# Group C
grep -n '"baseUrl"' cli/tsconfig.json common/tsconfig.json  # Claims 6+7: 0 hits

# Group D
head -2 README.md  # Claim 8+9: line 1 MD041 disable, line 2 MD033 disable preserved

# Group E
awk 'NR>=44 && NR<=47 {printf "%d: %s\n", NR, $0}' CHANGELOG.md  # Claim 10
grep -c '/fid' CHANGELOG.md  # Claim 11: 0
grep -c '/phase' CHANGELOG.md  # Claim 12: 0

# Group F
(cd sdk && bunx tsc --noEmit -p .; echo "exit=$?")     # Claim 13: exit 0
(cd agents && bunx tsc --noEmit -p .; echo "exit=$?")  # Claim 13: exit 0
(cd common && bunx tsc --noEmit -p .; echo "exit=$?")  # Claim 13: exit 0
(cd cli && bunx tsc --noEmit -p .; echo "exit=$?")     # Claim 13: exit 0
(cd sdk && bun test src/ 2>&1 | tail -3)   # Claim 14: 415/0 pass
bun run build:sdk 2>&1 | tail -5               # Claim 14: exit 0
ls sdk/dist/sdk/src/ 2>&1 || echo "no nested dir (CONFIRMS bun build flat)"
```

---

## Pass Criteria

PASS = all 14 claims verified from source immediately on your own run. Zero silent claims. Zero fabricated results.

CONDITIONAL = precise list of which claims need follow-up.

FAIL = any fabricated claim or cannot-verify result. List discrepancy explicitly.

---

## ECHO Compliance Note (Cross-FID correction)

FID-020 is a small-scope correction (4 tsconfig drops + 3 markdown fixes). It explicitly supersedes FID-019 v5's incomplete self-verify on:
- baseUrl silence (claim A in my FID-020 RED inventory)
- line 175 MD033 phantom (claim B in my FID-020 RED inventory)

This is the right ECHO posture per Cross-Agent Claim Rule — self-reporting is prohibited. If you agree with the 14 claims, please PASS the FID; if you find drift, please flag with line-level evidence.

🌊 Buffy (Orchestrator)
