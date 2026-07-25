# Savant-Code — Comprehensive A-Z System Test v12 (Changelog)

**Status:** Current / canonical prompt is [`comprehensive-az-test-final.md`](./comprehensive-az-test-final.md).

**When running the v0.0.6 release test:** Use `comprehensive-az-test-final.md`. This file only records what changed in v12.

## What's new in v12 (2026-07-25)

1. **Test-and-report format.** The prompt now explicitly ends with a consolidated **Phase 32: Test & Report (Final)** that tells the operator to:
   - Run `bash scripts/run-az-test.sh` first (automated baseline).
   - Run interactive tests and record PASS/FAIL/SKIP with evidence.
   - Produce `dev/scratchpad/az-test-v12-results.md` from a concrete report template.
   - Produce `dev/scratchpad/agent-feedback-<YYYYMMDD>.md` from the operator's viewpoint.
   - Report back with a GO / NO-GO / GO WITH CAVEATS verdict.

2. **Removed the duplicate Reporting section** that sat between Phase 28 and Phase 29. All reporting instructions now live in Phase 32.

3. **Updated header metadata.** Title now reads "v12" and lists the automated runner (v11) and all v0.0.6 FIDs (FID-066/067/068/069/070/071/072).

4. **Added critical success criteria checklist** inside the report template, including the v0.0.6-specific items:
   - `Record<string, unknown>` eliminated from production source
   - ESLint `--max-warnings 0` passes on four core workspaces
   - Cloudflare provider wired in SDK/common
   - Version files consistent at 0.0.6

## What's unchanged

- All test phases 1–31 remain identical to v11.
- Output destination remains `dev/scratchpad/`; `dev/nova/` is still reserved for Nova audits.
