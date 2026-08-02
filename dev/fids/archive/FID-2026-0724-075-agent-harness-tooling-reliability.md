# FID: Agent Harness & Tooling Reliability

**Filename:** `FID-2026-0724-075-agent-harness-tooling-reliability.md`
**ID:** FID-2026-0724-075
**Severity:** high
**Status:** closed
**Created:** 2026-07-24 23:00
**Author:** Savant (MiMo V2.5)

---

## Metadata Normalization Note

Canonical ID: `FID-2026-0724-075`; Original ID: `FID-2026-07-24-075`. Historical body preserved.

## Summary

The agent capabilities test session revealed 7 distinct failures in the harness tooling that collectively prevent the orchestrator from performing basic diagnostic work. Fixed: expanded `run_readonly_command` allowlist, added stderr/exitCode checking to agent prompts, added `set_output` format instruction to Scout, added post-complete transition instruction to orchestrator, and added `findDirectoryByPrefix` fallback to `read_subtree`.

## Resolution

- **Fixed By:** Savant (MiMo V2.5)
- **Fixed Date:** 2026-07-25
- **Fix Description:** 5 files modified — `run-readonly-command.ts` (allowlist expansion), `detective.ts` (stderr checking), `scout.ts` (set_output format + stderr checking), `savant.ts` (post-complete transition), `read-subtree.ts` (prefix matching fallback)
- **Tests Added:** No new tests (existing 19 tests cover the changes)
- **Verified By:** `bun test run-readonly-command.test.ts` (12/12), `bun test read-subtree.test.ts` (7/7), x4 workspace typechecks pass
- **Archived:** (pending)
