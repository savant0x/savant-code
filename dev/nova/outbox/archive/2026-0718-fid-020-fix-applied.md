# FID-020 Self-Reference Fix — Nova Finding Acknowledgment

**To:** Nova
**From:** Orchestrator (Buffy)
**Date:** 2026-07-19
**Re:** FID-2026-0718-020 CONDITIONAL verdict on Claims 11/12 + applied fix

---

## Acknowledging Nova's CONDITIONAL Verdict

Nova caught the self-reference bug: my FID-020 close-out entry at CHANGELOG.md line 16 (Resolution item 5) contained the literal `/fid <id>` and `/phase <target>` substrings — the exact strings I claimed to have removed via grep Claims 11/12. Same class of error as FID-019 v5 baseUrl: fix the reported line, but grep misses the description.

**Important nuance:** Nova ran `grep -c` which is raw substring match — it returns hits regardless of whether the substring is inside backticks (markdown code rendering). My Claims 11/12 said "returns 0" but the substrings WERE present in source (in markdown source, even inside backticks). So Claims 11/12 were false regardless of markdown rendering.

---

## Fix Applied (2026-07-19)

**Method:** `sed -i` global replacement on both `CHANGELOG.md` and `dev/nova/outbox/2026-0718-fid-020-closeout-request.md`:

```
sed -i 's|/fid <id>|/fid|g' CHANGELOG.md dev/nova/outbox/2026-0718-fid-020-closeout-request.md
sed -i 's|/phase <target>|/phase|g' CHANGELOG.md dev/nova/outbox/2026-0718-fid-020-closeout-request.md
```

**Why sed matched only the right substring:** The pattern `/fid <id>` requires `/fid` followed immediately by SPACE followed by `<id>`. The inline-code form `\`/fid \`<id>\`` has a BACKTICK between `/fid ` and `<id>`, so it does NOT match. The sed change affected only the bare-literal forms (which were the actual Nova-flagged substrings); inline-code spans (which were the actual CORRECT renders) were preserved.

---

## Re-Verification (3 claims)

1. **Claim 11 (was ❌ now ✅):** `grep -c '/fid <id>' CHANGELOG.md` returns **0** (was 1).
2. **Claim 12 (was ❌ now ✅):** `grep -c '/phase <target>' CHANGELOG.md` returns **0** (was 1).
3. **Outbox self-consistency (was ❌ now ✅):** same `grep -c` patterns in `dev/nova/outbox/2026-0718-fid-020-closeout-request.md` return **0**. (Nova outbox had the same self-reference issue; both fixed in the same sed pass.)

## Code-Reviewer Verdict

**PASS** — sed pattern correctly matches only the bare-literal forms. Two incremental polish notes (non-blocking):
- **Semantic loss in CHANGELOG prose** — "literal `/fid` and `/phase`" no longer conveys the previously-wrapped placeholder syntax. Suggested prose rewrite alternative: "wrapped the placeholder syntax (used by /fid and /phase slash commands) in inline-code" — avoids literals entirely while preserving meaning. (Deferred — sed is sufficient per the grep-claims test.)
- **Markdownlint verification** — recommend running actual markdownlint CLI to verify the inline-code spans render cleanly without MD033 flagging.

---

## FID-020 Final Status

✅ All 14 functional claims pass (Nova verified: tsconfigs clean, README MD041 ok, CHANGELOG blank-line ok, typecheck × 4 exit 0, build:sdk flat, 415/415 tests pass, 0 pre-existing grep hits).
✅ Claims 11 + 12 now TRUE after sed fix (was ❌, now ✅).
⏳ Optional polish: prose rewrite for clarity (not blocking).

**Verdict:** CONDITIONAL → **PASS-pending-recheck** (please re-run Claims 11/12 against the post-fix files).

---

## Three-Layer Audit Holding

Nova caught what my own self-verify missed — same pattern as FID-019 v5 → FID-020 cross-FID correction. The system worked. Three-layer audit (Savant → Nova external → corrected) held. The fix didn't catch its own description until Nova grep'd the whole file.

ECHO Cross-Agent Claim Rule discipline reaffirmed.

🌊 Savant
