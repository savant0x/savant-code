<!-- markdownlint-disable MD013 -->

# FID: No-Signature Policy Scrub — Active Document Attribution

**Filename:** `FID-2026-0809-014-no-signature-policy-scrub.md`
**ID:** FID-2026-0809-014
**Severity:** medium
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Implementation authorization:** Operator granted automation level 3 for this FID on 2026-08-09
> after the Nova planning audit returned PASS for this FID. The three active `Author: Savant`
> lines were removed; the historical exemption set is documented and preserved.

---

## Summary

The active single-agent protocol (`dev/echo-v0.1.2-single-agent.md`) mandates **no signatures, no
author attribution, no agent names** in FIDs, session summaries, CHANGELOG entries, knowledge
files, and other repository artifacts. The audit found **three tracked, recently-committed
documents** (2026-08-08) that still carry `Author: Savant`:

1. `docs/reports/feature-parity-report.md:9` — `> **Author:** Savant`
2. `docs/research/Agent Harness Feature Pairing Research.md:3` — `**Author:** Savant`
3. `docs/research/Harness Engineering for Coding Agents Research.md:3` — `**Author:** Savant`

This FID scrubs the three active documents and documents the deliberate exemption for **16 dated
historical session summaries** (2026-08-03 … 2026-08-07) that predate the active no-signature
policy and are immutable historical evidence.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript monorepo; Bun
- **Tool Versions:** Bun project contract `1.3.14`
- **Commit/State:** `main`; three tracked docs carry signatures; 16 historical summaries retain them
- **Protocol:** Single-agent ECHO adaptation `dev/echo-v0.1.2-single-agent.md` (no-signature policy)
- **Approval state:** Operator automation level 3 granted; Nova implementation sign-off **PASS** (2026-08-09)

## Detailed Description

### Problem

Three active, tracked documents violate the no-signature policy by carrying `Author: Savant`.
Recent session summaries (2026-08-08 onward) are already clean — the violation is confined to these
three research/report documents.

### Evidence

```text
docs/reports/feature-parity-report.md:9:      > **Author:** Savant
docs/research/Agent Harness Feature Pairing Research.md:3:  **Author:** Savant
docs/research/Harness Engineering for Coding Agents Research.md:3: **Author:** Savant
```

- All three are tracked (`git ls-files` confirms).
- All three last committed 2026-08-08 (post-`0.0.21`, same-day as the policy's active protocol doc).
- The protocol document itself (`dev/echo-v0.1.2-single-agent.md:20`) contains only the *rule*
  ("**NEVER** add `Author:`, `Fixed By:`, `Signed by:`...") — not a violation.
- 16 dated session summaries (2026-08-03 … 2026-08-07) carry `Author:`; these predate the active
  policy and are historical evidence. Recent summaries (08-08, 08-09) are clean.
- `dev/scratchpad/freebuff-session.md` contains 131 `Author:` hits — a scratchpad session dump,
  outside the active-artifact scope (scratchpad is ephemeral working area).

### Impact Assessment

- [ ] Critical
- [x] High: active documents contradict the governing protocol's attribution rule
- [ ] Medium
- [ ] Low

### Proposed Solution

1. Remove the `Author: Savant` line from each of the three tracked documents (exact line removal,
   no other content change).
2. Keep the 16 dated historical session summaries **unchanged** — document them in this FID as a
   deliberate pre-policy historical exemption (immutable-history invariant).
3. Leave `dev/scratchpad/freebuff-session.md` untouched (scratchpad is ephemeral; not an active
   artifact).
4. Verify: grep for `Author:` across active tracked docs returns zero hits (excluding the
   documented historical set).

### Steps (executed)

1. Stripped `> **Author:** Savant` from `docs/reports/feature-parity-report.md` (was line 9).
2. Stripped `**Author:** Savant` from `docs/research/Agent Harness Feature Pairing Research.md` (line 3).
3. Stripped `**Author:** Savant` from `docs/research/Harness Engineering for Coding Agents Research.md` (line 3).
4. Re-ran the signature grep: zero active hits remain (only the documented historical exemptions
   and the FID docs' own policy references).
5. Prettier + markdownlint clean on all three edited files.

### Verification (post-implementation)

- [x] `grep -rn 'Author:\|Fixed By:\|Verified By:\|Signed by:'` over tracked active docs → zero
  active hits; only the 16 documented historical session summaries (pre-policy), the scratchpad
  dump, and the FID docs' own policy/scrub-target references remain.
- [x] `bunx prettier --check` clean on all three edited files (confirmed).
- [x] Markdownlint clean (confirmed via repo `lint:md` exit 0).

## Perfection Loop

### Loop 1 — RED

- **RED:** Three active tracked documents violate the no-signature policy; the audit scan also
  surfaced 16 dated historical summaries and a scratchpad dump that must be handled deliberately,
  not blanket-scrubbed.
- **GREEN:** Scrub exactly the three active documents; preserve all historical/scratchpad content;
  record the exemption list in this FID.
- **AUDIT:** Line-exact evidence captured for all three files; `git ls-files` confirms tracked;
  commit dates 2026-08-08; recent (08-08/08-09) summaries confirmed clean, proving the policy is
  already applied to new artifacts. The protocol doc's own hit is the rule text, not a violation.
- **AUDIT ADVERSARIAL CHECK:** Challenged for rewriting history — the FID explicitly preserves the
  16 pre-policy summaries and the scratchpad dump; only the three *active* documents are edited.
- **CHANGE DELTA:** Planning only; no document edited yet.

### Missed Questions

1. **Why not scrub the 16 historical summaries too?** → They predate the active policy and are
   dated historical evidence; the immutable-history invariant forbids mass-rewriting them.
2. **Is the scratchpad dump in scope?** → No; scratchpad is an ephemeral working area, not an
   active artifact.
3. **Does `feature-parity-report.md` need a newline after the strip?** → Yes; strip the full line so
   no blank-line residue breaks markdownlint.
4. **Are there any other active signature patterns?** → `Fixed By`/`Verified By`/`Signed by` scan
   returned no additional active hits.

### Loop 2 — Independent AUDIT verification (2026-08-09)

- **RED:** AUDIT pass re-verified the RED evidence against the live tree to confirm every claim
  before implementation.
- **GREEN:** All claims confirmed exact: the three `Author: Savant` hits at the cited lines
  (`feature-parity-report.md:9`, both research docs `:3`); all three tracked; all last committed
  2026-08-08; recent session summaries (08-08/08-09) verified clean; the protocol doc's single hit
  is the rule text at `dev/echo-v0.1.2-single-agent.md:20`, not a violation.
- **AUDIT:** Independent review found no additional active signature patterns and confirmed the
  historical-exemption scope (16 dated summaries + scratchpad dump) is correctly excluded.
- **CHANGE DELTA:** FID text only; no document edited yet.

### Loop 3 — Implementation record (2026-08-09)

- **GREEN:** Operator granted automation level 3. The three `Author: Savant` lines were removed via
  exact line-deletion (`sed` on the quoted line patterns). No other content changed.
- **AUDIT:** Post-scrub sweep confirms zero active signature hits in `docs/` and `dev/fids/`
  (remaining matches are the FID docs' own policy references). Prettier and markdownlint both
  clean on the edited files.
- **CHANGE DELTA:** Three lines removed across three tracked docs; no behavioral or content
  change beyond attribution removal.

### Code Verification Evidence

- [x] Three active documents with exact line evidence.
- [x] Historical exemption set enumerated (16 dated summaries + scratchpad dump).
- [x] Recent summaries verified clean (policy already applied to new artifacts).
- [x] Operator approval — granted (automation level 3).
- [x] Nova sign-off — planning audit PASS for this FID.
- [x] Implementation — complete; zero active signature hits.

## Resolution

- **Status:** Implemented; active docs signature-clean.
- **Fixed Date:** 2026-08-09
- **Commit/PR:** uncommitted working tree (pending `0.0.23`)
- **Archived:** —

## Lessons Learned

Compliance drift lives at the boundary between "active" and "historical." A policy is only as
enforced as its newest artifacts; auditing the *age* of a violation (pre- vs post-policy) is what
separates a legitimate scrub from history rewriting.
