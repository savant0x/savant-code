<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Savant UI Overhaul — Operator Closure Checks (manual pass)

**Version:** 1.0.0
**Date:** 2026-08-16
**Status:** Active operator checklist
**Closes:** FID-2026-0816-005 (A), FID-2026-0816-009 (B–D), FID-2026-0816-010
(E–F), FID-2026-0816-011 (G), FID-2026-0816-012 (H); master 002 retires once
A–F close.
**Purpose:** Manual, in-terminal verification of the implemented UI-overhaul
work. This is the operator's own visual pass — run it by hand, record
PASS/FAIL/NEEDS-REVIEW per check, and paste the report table back. Every PASS
closes its FID.

## 1. How to run

1. **Restart the terminal** (fresh session, as instructed).
2. From the repo root, launch the CLI:

   ```bash
   cd cli && bun run dev
   ```

   (Or your normal launch — `cli/src/index.tsx --cwd ..` with the prebuild step.)
3. Work through checks A–H **one at a time**. Each has a trigger + an expected
   observable. Record the result in the table in §3.
4. **Do not** use Alt+Tab for any focus test — it is the Windows OS window
   switcher and never delivers a focus-loss signal. Use **Shift+D** (or click
   another window / the desktop) per the operator preference.
5. Use a **throwaway scratch file** for edit checks
   (`dev/scratchpad/closure-check-scratch.md`) — never a real repo file.
6. After the pass, paste the §3 table back into the session (any format is
   fine — a plain `A PASS / B FAIL ...` line is enough).

## 2. The checks

### A — Blur throttle drops animation to 15 fps (closes FID-005)

**Trigger:** With something animating on screen (spinner, pulse, streaming
text), press **Shift+D** (or click another window / the desktop).

**Expected:**
- [ ] Animation visibly **slows** within ~1 s of focus loss (the budget hook
  drops `targetFps` to 15 when blurred — `use-animation-budget.ts`).
- [ ] Returning focus (click back) **resumes** full-speed animation.
- [ ] No runaway live loop: let the session idle ~30 s — CPU stays quiet, no
  spinning that never stops.

### B — Diff viewer renders as a framed, structured diff (closes FID-009)

**Trigger:** Ask the agent to make a **multi-line edit** to the scratch file
(e.g. "add a 4-line section to `dev/scratchpad/closure-check-scratch.md`").

**Expected:**
- [ ] The diff renders inside a **bordered rounded container** (not bare
  green/red stripes spanning the terminal).
- [ ] **Header strip**: file path (bold) + `+N −M` counters.
- [ ] **Line-number gutter** (old/new) + a **sign column** (`+`/`-`/` `),
  separate from the content text.
- [ ] Hunk headers (`@@ … @@`) render as distinct full-width bars.
- [ ] If no file path is extractable from the diff, the header reads **EDIT**
  (never the bare word "diff").
- [ ] Repeat at ~80 and ~120 columns (resize the window) — layout stays sane.

### C — Phase-transition bar is the branded notification (closes FID-009)

**Trigger:** Watch the agent's own FSM transitions (any `Phase → …` notice),
or trigger one by asking the agent to move through a task.

**Expected:**
- [ ] Every transition renders as a **full-width bordered bar** with a
  **`SAVANT CODE` title row on its own line**, and the phase content on the
  row below.
- [ ] **Filled chip** (fourth pass 2026-08-16): the whole bar is a **solid
  phase-color fill** — RED = red fill with **white** text (black-on-red is
  unreadable), GREEN/AUDIT/ADVERSARIAL/DONE = colored fill with **black**
  text. No dark tint + colored text (that collapsed to "black background +
  white header" in classic conhost).
- [ ] **Idle** phase: mid-tone gray fill with **black** text.
- [ ] **ADVERSARIAL** (if ever visible): violet, not red.
- [ ] **Uniformity check — must look the SAME in Cursor and classic
  PowerShell console** (the whole point of the filled chip): same fill, same
  black/white text in both terminals.
- [ ] No copy button / frame clutter around the notice.

### D — `run_readonly_command` renders as a full command block (closes FID-009)

**Trigger:** Ask the agent to run a read-only command (e.g. "run `ls` or
`git status` in the repo" — the agent uses `run_readonly_command`).

**Expected:**
- [ ] The result renders as the **full terminal-command block** (green `$` +
  command + output), NOT the collapsed generic `[Tool: run_readonly_command]`
  fallback.
- [ ] No copy-button chrome on the notice.

### E — Mode-selector hover stroke is cyan (closes FID-010)

**Trigger:** Hover the mode chip next to the input (`< HYBRID`); open the
expanded mode list (HYBRID / STRICT / ANALYZE / …).

**Expected:**
- [ ] Hovering the collapsed chip turns its **stroke cyan** (`theme.primary`).
- [ ] The highlighted/hovered segment in the expanded list frames in **cyan**.
- [ ] Spot check the other three fixed spots: **Build DEFAULT/MAX/LITE**
  buttons (plan box), **load-previous** button, and the **ChatGPT connect
  banner** — hover stroke cyan, not white.

### F — Trust matrix is reactive and subtle (closes FID-010)

**Trigger:** Ask the agent to write a file (produces a signed receipt); then
let the session settle.

**Expected (round-2 behavior):**
- [ ] The section appears **only while a receipt is still `pending`** — no
  panel when nothing has been signed, and **no panel once everything
  resolves** (it unmounts after completion — it does not persist).
- [ ] It is **collapsed by default** and there is **no icon/dot on the left
  of the "Trust Matrix" title** (title reads `▶ Trust Matrix`, nothing else).
- [ ] Expanded: only **pending** rows render live; terminal receipts collapse
  into `✓ N resolved`; `N closed without verdict` (no_verdict) renders muted
  and never green.

### G — Terminal commands render as the Rich Terminal panel (closes FID-011)

**Trigger:** Ask the agent to run a short terminal command (e.g. "run `git
status --short`"), and also watch the **ghost message** while it runs.

**Expected:**
- [ ] **Ghost (running) state:** the pending command shows a bordered panel
  with an **amber `⏳`** status.
- [ ] **History state:** the finished command renders inside a bordered rounded
  panel with a **traffic-light title bar** (`● ● ●` in red/amber/green).
- [ ] Command row: green `$` + bold command + status badge — **green `✓`** on
  exit 0, **red `✗`** on non-zero exit (test both: ask for a command that
  fails, e.g. "run `exit 1`" or a bad command).
- [ ] **cwd pill** (and timeout pill when present) on the meta row.
- [ ] Output body has a **line-number gutter** (hidden on very narrow widths)
  and preserves leading whitespace.
- [ ] Expand/collapse is a **clean terminal-style toggle** — no underlined web
  link.

### H — Trust matrix label, icon, title (closes FID-012)

**Trigger:** Same session as check F — look at the trust matrix rows.

**Expected:**
- [ ] Section title reads **"Trust Matrix"** (not "Adversarial Trust Matrix"),
  with **no icon on the left of the title**.
- [ ] Live rows read `#N PHASE · signed` — the status is **"signed"**, never
  "awaiting audit".
- [ ] **No tone glyph** (`⚠`/`✓`/`•`) prefix before rows — tone is conveyed by
  color only.
- [ ] The section **disappears once nothing is pending** (does not persist
  after completion).

## 3. Report table

| Check | FID | Result (PASS / FAIL / NEEDS-REVIEW) | Notes |
| --- | --- | --- | --- |
| A — blur → 15fps | 005 | PASS | Operator confirmed (2026-08-16); FID-005 CLOSED |
| B — diff viewer frame | 009 | PASS | Operator confirmed working (2026-08-16) |
| C — transition bar | 009 | PASS | Filled-chip bar identical in Cursor + PowerShell (2026-08-16); FID-009 CLOSED |
| D — readonly command block | 009 | PASS | Operator confirmed (2026-08-16) |
| E — cyan mode strokes | 010 | PASS | Operator confirmed (2026-08-16); FID-010 CLOSED |
| F — trust matrix reactivity | 010 | PASS | Operator confirmed (2026-08-16) |
| G — rich terminal panel | 011 | PASS | Operator confirmed (2026-08-16); FID-011 CLOSED |
| H — trust matrix label/icon | 012 | PASS | Operator confirmed (2026-08-16); FID-012 CLOSED |

> **All checks A–H PASS (2026-08-16).** The full UI-overhaul FID queue is
> closed and archived; `dev/fids/` active queue is empty.

**Outcome rules:**

- **PASS** on a check → that FID closes (evidence recorded in the FID +
  CHANGELOG + archive).
- **FAIL** → report what you saw; the defect goes back through the owning FID
  (no silent deferral).
- **NEEDS-REVIEW** → describe what you could not confirm and why; the gate
  stays open until resolved.
