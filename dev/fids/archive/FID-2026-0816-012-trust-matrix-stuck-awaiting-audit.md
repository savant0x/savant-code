# FID: Trust Matrix stuck on "awaiting audit" + icon + rename

**Filename:** `FID-2026-0816-012-trust-matrix-stuck-awaiting-audit.md`
**ID:** FID-2026-0816-012
**Severity:** medium
**Status:** closed
**Created:** 2026-08-16 22:34
**Author:** Orchestrator

---

## Summary

The sidebar item titled "Adversarial Trust Matrix" had three defects: (1) every live
row was permanently stuck on the label "awaiting audit" because the provenance receipt
status never transitions from `pending` (events are append-only and most receipts never
receive a formal adversarial verdict), (2) each live row was prefixed with a tone glyph
icon (`⚠`/`✓`/`•`) the operator wanted removed, and (3) the section title read
"Adversarial Trust Matrix" when it should read "Trust Matrix".

## Environment

- **OS:** Windows 11 (win32, Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14, React 19.2.8, OpenTUI 0.5.3
- **Commit/State:** main@HEAD + uncommitted UI-overhaul working changes

---

## Root Cause

1. `cli/src/components/savant-ui/echo/trust-matrix.tsx:107` — `statusLabel('pending')`
   returned `"awaiting audit"`. The `pending` state means "signed, no verdict yet" — the
   honest label is "signed", not "awaiting audit".
2. `cli/src/components/savant-ui/echo/trust-matrix.tsx:255` — `toneGlyph()` rendered a
   glyph before each live row.
3. `cli/src/components/right-sidebar.tsx:375` — `title="Adversarial Trust Matrix"`.

---

## Resolution

- **Closed Date:** 2026-08-16 22:48
- **Fix Description:** Label "awaiting audit"→"signed", tone glyph icon removed,
  title "Adversarial Trust Matrix"→"Trust Matrix"
- **Archived:** 2026-08-16
