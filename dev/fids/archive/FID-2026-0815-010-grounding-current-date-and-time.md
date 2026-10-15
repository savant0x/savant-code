<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Grounding — agent always knows the correct current date and time

**Filename:** `FID-2026-0815-010-grounding-current-date-and-time.md`
**ID:** FID-2026-0815-010
**Severity:** medium
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — extracts the existing date formatter into a shared
utility and enriches its output; no new store, no new authority (Law 13).

**Parent:** none (independent — discovered live while running the npm package)

---

## Summary

The agent system prompt injects a `Current date:` line, but its value is **date-only**
(`"August 15, 2026"`) — no weekday, no time, no timezone. A live session greeted the
operator with "Happy Friday" **on a Saturday** because the model had to derive the
day-of-week from a bare date string, a known LLM failure mode, and got it wrong. The
same gap means the model can never reliably say the time of day either ("good morning"
at 9pm). The fix enriches the injected value to a full, human-readable date **and** time
and centralizes it in a shared utility.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| E-01 | med | The system prompt injects only `Current date: {SAVANT_CODE_CURRENT_DATE}.` with a value produced by a `year/month/day`-only formatter — no weekday, no hour/minute, no timezone. The model must compute the weekday itself and hallucinated "Friday" for a Saturday. | `agents/savant/system-prompt.ts:56` (`Current date: ${PLACEHOLDER.CURRENT_DATE}.`); `packages/agent-runtime/src/templates/strings.ts:53-60` (`CURRENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' })` → `formatCurrentDate` → `"August 15, 2026"`) |
| E-02 | low | The formatter is a module-local singleton inside the template layer (`strings.ts`), not a shared utility — the date-formatting logic lives where it is consumed rather than in `common/src/util/dates.ts` alongside the other date helpers (Law 13). | `packages/agent-runtime/src/templates/strings.ts:50-60` vs `common/src/util/dates.ts` (existing `formatTimeUntil`, `getNextQuotaReset`) |
| E-03 | low | The bundled agents (published artifact) carry the placeholder literally and rely on the runtime substitution value, so the fix is localized to the runtime value — but the prompt label "Current date:" does not reflect the now-richer value. | `cli/src/agents/bundled-agents.generated.ts:867,949,1031,…` (`Current date: {SAVANT_CODE_CURRENT_DATE}.`) |

## GREEN — Proposed fix (converged)

1. **E-01/E-02 (root fix):** add a shared utility `formatCurrentDateTime(date: Date = new Date()): string`
   to `common/src/util/dates.ts` using a module-level `Intl.DateTimeFormat('en-US', …)` with
   `weekday: 'long'`, `year`, `month`, `day`, `hour: 'numeric'`, `minute: '2-digit'`,
   `timeZoneName: 'short'` → e.g. `"Saturday, August 15, 2026 at 2:34 PM EDT"`. The singleton
   is cached for the same reason as before (per-call `Intl.DateTimeFormat` construction is
   expensive — FID-2026-0815-001).
2. **E-01:** the `CURRENT_DATE` placeholder provider in `strings.ts` calls
   `formatCurrentDateTime()` (imported from `@savant-code/common/util/dates`); the local
   `CURRENT_DATE_FORMATTER`/`formatCurrentDate` are removed.
3. **E-03:** change the prompt label to `Current date and time:` in
   `agents/savant/system-prompt.ts:56` and regenerate the bundle
   (`bun run --cwd=cli prebuild:agents`).

**Net:** the agent's context always carries the correct weekday, date, time, and timezone;
no weekday/time derivation from a bare date. The placeholder token
`{SAVANT_CODE_CURRENT_DATE}` is unchanged (only its value and the label change), so no
placeholder-list rename is required.

## Perfection Loop

### Loop 1 — RED

E-01…E-03 cataloged with `file:line` evidence. **Exit: all issues cataloged.**

### Loop 1 — GREEN

Shared-utility extraction + enriched value + label/bundle update documented. **Exit: fixes documented.**

### Loop 1 — AUDIT (planning)

- **Law 4 (grep-verified):** `formatCurrentDate` has exactly two consumers — the
  `CURRENT_DATE` placeholder provider (`strings.ts:141`) and `strings.test.ts` — so
  removing it is safe. `formatCurrentDateTime`'s only production consumer is that
  placeholder provider; the label change is verified by regenerating the bundle and
  grepping for `Current date and time:`.
- **Test flakiness guard:** minute precision means the existing exact-equality test
  (`toBe(\`Today is ${formatCurrentDate(new Date())}.\`)`) could flake across a minute
  boundary; replaced with a structural assertion (placeholder replaced, weekday+date+time
  present) plus a dedicated `common` unit test using a fixed `Date`.
- **Verification plan:** `bun run --cwd=common typecheck`, `bun run --cwd=packages/agent-runtime typecheck`;
  `bun test` in common + agent-runtime (dates + strings suites); bundle regen; ESLint
  `--max-warnings 0`; Prettier.
- **AUDIT passes (planning) → SELF-CORRECT (none) → COMPLETE (implement now).**

### Missed Questions

1. **Should the placeholder token be renamed to `CURRENT_DATETIME`?** No — the token is
   baked into the bundle across all mode/variant prompts; renaming would touch the
   placeholder lists in two packages and force a wider regeneration for zero behavioral
   gain. The value is what matters; the label is corrected in prose instead.
2. **Is minute-level time safe in tests?** A naive exact-equality assertion could flake at
   a minute boundary; the tests use structural assertions and a fixed `Date` instead.
3. **Does the injected time go stale during a long session?** The system prompt is built
   per session build; the value reflects build time, which is correct for the greeting/
   day-of-week use case. A live clock tool is out of scope (no such tool exists) and would
   be a separate FID.

## Resolution

Implemented 2026-08-15.

- **E-01/E-02:** `formatCurrentDateTime(date = new Date())` added to
  `common/src/util/dates.ts` (module-level `Intl.DateTimeFormat('en-US', …)` with
  `weekday: 'long'`, `year`, `month`, `day`, `hour: 'numeric'`, `minute: '2-digit'`,
  `timeZoneName: 'short'`). `strings.ts` imports it and the `CURRENT_DATE` placeholder
  provider calls it; the local `CURRENT_DATE_FORMATTER`/`formatCurrentDate` were removed.
- **E-03:** `agents/savant/system-prompt.ts:56` label changed to `Current date and time:`;
  bundle regenerated via `bun run --cwd=cli prebuild:agents` (13 variants now carry
  `Current date and time:`).

Verification (all exit 0, pasted): common / agent-runtime / cli / agents typecheck;
common util 348 pass / 4 skip / 0 fail (new `dates.test.ts` 2/0); agent-runtime 963/0
(incl. `strings.test.ts` 10/0); ESLint `--max-warnings 0`; Prettier. Law-4 grep:
`formatCurrentDate` 0 references; `formatCurrentDateTime` production consumer =
`packages/agent-runtime/src/templates/strings.ts:129` (the `CURRENT_DATE` placeholder
provider).

### Expansion (same day) — per-step freshness

The session-start system prompt is built once, so its timestamp can drift during a long
session. To make the agent **always** know the current date/time, the per-step
`<system_reminder>` (rebuilt and injected every step in
`getAgentPrompt`, `strings.ts:246-250`) now leads with a fresh
`Current date and time: ${formatCurrentDateTime()}.` line. The step prompt is ephemeral
(appended at step start, expired at step end), so this adds a few tokens per step with
zero prompt-caching impact.

Verification: agent-runtime typecheck exit 0; full suite 964/0 (new step-reminder test);
ESLint `--max-warnings 0`; Prettier.

## Lessons Learned

Inject the weekday and time **directly** — never hand the model a bare date string and
make it derive the day-of-week itself; LLMs reliably miscalculate that ("Happy Friday"
on a Saturday). Grounding fields that the model might quote verbatim should carry the
derived value (weekday, timezone) rather than only the raw inputs. A session-start
value is not enough for "always correct" — refresh the timestamp on the per-step
channel (the `<system_reminder>`), which is already rebuilt every step and is
prompt-cache-neutral.
