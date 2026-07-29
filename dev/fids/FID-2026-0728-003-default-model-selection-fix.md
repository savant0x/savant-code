# FID: Fix Default Model Selection — Prevent Expensive Model Auto-Select

**Severity:** High
**Status:** created
**Created:** 2026-07-28

---

## Problem

When the CLI loads, it auto-selects an expensive model (e.g., Kimi K3) instead of the user's preferred/default model (MiMo-V2.5). This burns through Go subscription credits at 4x the expected rate. The user caught this before any calls went through, but without manual intervention, the CLI would silently drain the subscription.

## Root Cause

The model selection logic on CLI startup is not respecting the user's saved preference or defaulting to the cheapest available model. It may be:
1. Selecting the first model in the provider list (which happens to be Kimi K3)
2. Not reading the persisted `savantCodeModelPreference` from settings.json
3. A stale default in the model selector component

## Investigation Steps

1. **Find the model selection entry point:**
   - Search for where the model is selected on CLI startup
   - Check `cli/src/state/chat-store.ts` or equivalent for default model logic
   - Check if `savantCodeModelPreference` is being read from settings on load

2. **Trace the model selection flow:**
   - What happens when no saved preference exists?
   - What model does the selector default to?
   - Is there a priority order for models in the provider config?

3. **Verify the fix:**
   - After fix: CLI should default to MiMo-V2.5 (or user's saved preference)
   - After fix: Kimi K3 should NOT be auto-selected unless user explicitly picks it
   - After fix: `settings.json` should persist the user's model choice across sessions

## Acceptance Criteria

- [ ] CLI defaults to MiMo-V2.5 on fresh install (no saved preference)
- [ ] CLI restores user's saved preference on subsequent launches
- [ ] Kimi K3 is never auto-selected without explicit user action
- [ ] Model selection persists correctly in settings.json
- [ ] Typecheck passes after fix

## FID Reference

This is a regression/quality issue that should be fixed before v0.0.9 release. It directly impacts user cost and trust.
