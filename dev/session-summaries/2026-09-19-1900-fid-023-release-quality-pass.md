# Session 2026-09-19 19:00 — 0.0.33 release quality pass (FID-2026-0919-023)

## Session context

Opened as a release-readiness pass on 0.0.33, and expanded by operator
directive into a project-wide quality pass:

1. "we're going to be releasing this soon, ensure the project is properly bumped
   to 0.0.33, also run the release preview check script in package.json.
   Futhermore, need to complete a release ready audit"
2. "review/audit the changelog, ensure no remaining [unreleased] tags"
3. "nah, don't narrow, all of this needs to be done, this is a project wide
   quality pass, update every issue you find w/ automation level 3"
4. "if there is no info about automation level 3, we need to document automation
   levels level 1 = extremely limited, basically need approval for everything,
   level 3 = complete agent automation"

Governing protocol: `dev/echo-v0.1.2-single-agent.md` (single-agent mode;
`ECHO.md` is not the governance for this session, per the boot gate).

## Scope delivered

### 1. Version bump to 0.0.33 (T73-A)

`VERSION`, the synchronized package manifests, `protocol.config.yaml
project.version`, `bun.lock`, and the desktop family (JSON + Cargo.toml/lock
sync). `version:check` PASS. Nothing committed (G2 withheld).

### 2. Automation levels documented — new governance (T73-B, FID-2026-0919-023)

The ladder existed as a bare scalar (`session.autonomy_level: 3`) plus an
`ECHO.md` *note* that named Guided/Supervised/Autonomous without defining them;
the governing single-agent protocol had no section at all (grep for
`automation`/`level 3` across the four governance surfaces returned one
unrelated hit). Now:

- Canonical `## Automation Levels` in `dev/echo-v0.1.2-single-agent.md`: three
  levels with the authority each grants, the session-ceiling-vs-item rule
  (actioned without approval only when item level ≤ session level), the **Law 2
  semantics at Level 3** (presentation is *recorded* in the FID/SCOPE/CHANGELOG
  before the change and work proceeds; the operator keeps the intervention
  right), and **the invariants no level lifts** — G1–G9 commit/push/release,
  credentials, destructive operations, Law 3, Law 11, the project-directory
  boundary.
- `ECHO.md` (harness bootstrap) carries the matching ladder, reconciled with its
  own version-control laws: levels govern how far the agent proceeds before
  asking and never authorize a commit or push on their own.
- `protocol.config.yaml` documents the ladder on `session.autonomy_level`;
  protocol bundle regenerated (copies 15/15, embedded-protocol 7/7).
- `templates/FID-TEMPLATE.md` gained a required `Automation level` field;
  `SCOPE.md` gained the recording convention and every task/item is now tagged.

### 3. Documented-version-surface integrity (T73-C/D/E)

Two rot modes, both invisible to `version:check`:

- The writer replaced an **exact `oldVersion` string** and skipped silently on a
  non-match → a surface advanced only when it sat *exactly one release behind*.
  `ARCHITECTURE.md:279` stated the "current state" was version `0.0.26` through
  **seven** bumps.
- The localized blurb label (`**vX.Y.Z** ——` in `README.zh-CN.md`) was never
  declared as a surface. Its badge bumped; its prose did not.
- The 0.0.33 bump relabelled `**v0.0.32** —` in `README.md`, so the README
  advertised 0.0.32's features as 0.0.33 and the chain lost its v0.0.32 entry.

Fix: one `DOC_VERSION_SURFACES` table drives both the writer and the checker.
The writer converges each declared surface from whatever version it currently
states; `collectDocVersionDrift` reports drifted **or missing** surfaces and is
wired into `collectVersionDrift` (`version:check`) — the desktop-family
precedent, "reported as missing, never skipped". The new check found the stale
`ARCHITECTURE.md` on its **first run**. Both README blurbs carry an accurate
0.0.33 blurb with the v0.0.32 entry restored. 5 pins in
`scripts/version-docs-drift.test.ts` + the existing fixture extended.

### 4. Root `test` gate was RED — cross-suite mock leak (T73-I)

`bun run test`: 1435 pass / **2 fail**, both in `teacher/progression`
(`adaptAttemptReceipt` → `null`), while each suite passed alone. Bisect
(`for f in src/provenance/__tests__/*.test.ts` paired with progression)
isolated the contaminator to `provenance-signing-failure-visibility.test.ts`:
a **process-wide** `mock.module('@savant-code/common/crypto')` whose stub threw
unconditionally, so the teacher keypair derived from the same module in another
file signed nothing.

Measured against every plausible fix: reproduced in **both** argument orders,
survived `afterAll(mock.restore())` **and** a `beforeAll` installation (an
earlier provisional "fix" was reported and then disproved by testing the reverse
order). Final fix: scope the stub by **input** — throw only for this suite's
session ids, delegate to the real signer for every other caller. Proof: 46 pass
/ 0 fail in both orders; the SEC-5 suite alone still induces its failure; root
chain now **exit 0, 0 fail, 12/12 workspaces**.

### 5. Repo-wide `format` gate was RED (T73-J)

`prettier --check .` reported 6 unformatted files, none touched by this pass
(committed unformatted by earlier sessions). Formatted; affected suites, eslint
and `validate:repository` re-run green.

### 6. Changelog audit (T73-F)

No `[Unreleased]` accumulator anywhere; headings unique, reverse-chronological by
the repo's own extractor rule; the v0.0.33 section extracts (297 lines); all 22
referenced FID ids exist on disk; completeness verified tag-aware against git
ground truth (the two FIDs already shipped under the `v0.0.32` tag are correctly
attributed there). Two gaps had been closed earlier in the session:
FID-2026-0918-003's entry (its fix shipped after the tag) and the SEC-2 decline
record.

## Verification

| Gate | Result |
|---|---|
| `typecheck` (12 workspaces) | exit 0 |
| `bun run test` | **exit 0, 0 fail** in all 12 workspaces (was 2 fail) |
| `eslint . --max-warnings 0` | exit 0 |
| `lint:md` | exit 0 |
| `prettier --check .` | PASS (was 6 files) |
| `quality:report` | PASS (1498 baselined files) |
| `validate:repository` | PASS |
| `version:check` | PASS (was FAIL: `ARCHITECTURE.md: 0.0.26`) |
| `release:public:preview` | exit 0 (changelog section `## 0.0.33 — 2026-09-19` extracts) |
| changelog audit | PASS |
| `fid:verify --check` | PASS |

FID-2026-0919-023 receipt: **9/9 gates PASS**, stamped live
(`typecheck common`, `typecheck packages/agent-runtime`, 6 declared suites,
`quality`). Boundaries recorded: the receipt vocabulary cannot express a
multi-workspace chain (`bun run test` / `bun run typecheck`), so those are
evidenced in prose while the affected leaf suites are declared as gates.

## Findings ledger

| # | Finding | Level | Disposition |
|---|---|---|---|
| 1 | Automation levels undocumented (config scalar + `ECHO.md` note only; single-agent protocol had none) | 3 | Fixed + single-sourced across 5 surfaces |
| 2 | `README.md` advertised 0.0.32's content as 0.0.33; v0.0.32 chain entry lost | 3 | Fixed |
| 3 | `README.zh-CN.md` blurb label not bumped (badge was) — no writer pattern | 3 | Fixed + declared surface |
| 4 | `ARCHITECTURE.md` "current state" 7 releases stale, `version:check` green | 3 | Fixed by the new drift check |
| 5 | Writer silently skipped any surface not exactly one release behind | 3 | Root cause fixed (table-driven convergence) |
| 6 | Root `test` gate RED — process-wide `mock.module` leak across suites | 3 | Fixed (input-scoped stub) |
| 7 | Repo-wide `format` gate RED — 6 files committed unformatted | 3 | Fixed |
| 8 | Changelog gaps (0918-003 entry; SEC-2 decline) | 3 | Fixed earlier in session; audit now PASS |

Everything the pass found was fixed in the same pass; nothing was parked.

## Decisions and boundaries

- **Levels assigned honestly, not uniformly.** Every item this pass found is
  tagged `3` (all were mechanically fixable). Items elsewhere in the register
  whose only remaining action is operator input stay `1` (G2 commits; T62
  follow-ups blocked on credits/keys) — tagging those `3` would be incoherent,
  since there is nothing to automate.
- **Nothing committed.** G2 withheld throughout; evidence is file:line + grep +
  live gate output.
- **FID-2026-0919-023 left `verified`** (not closed/archived) — closure follows an
  explicit operator directive in this repo's convention.

## Closure (same session, operator directive)

Operator: "Close and archive FID-2026-0919-023 with its archive index entry,
leaving the commit to me." Closed + archived 2026-09-19:

- `Status: verified` → `closed`; Resolution restructured into the repo's
  closure format (Closed Date / Fix Description / Tests Added / Verification
  Evidence / Archived).
- Moved to `dev/fids/archive/FID-2026-0919-023-release-quality-pass-automation-levels-and-doc-surfaces.md`;
  receipt **re-stamped LIVE at the archived path** (9/9 gates) so the closed
  record stays byte-consistent — fingerprint `sha256:e3c9453a…`.
- Index updated in `dev/fids/archive/README.md` (new closure section) and
  `dev/fids/README.md`; the active queue is empty again.
- CHANGELOG entry carries the closure; SCOPE Task 73 records it.
- Commit SHA pending operator git execution (G2 withheld); evidence is the
  file:line + grep ranges in the record, per the FID Lifecycle rule for
  `closed`.

## Next steps

1. Operator G2 commit authorization for the whole working tree (bump + fixes).
2. Remaining register items at their recorded levels: T61, T63, T67, T68 (all
   level 3, actionable without approval), T62-followups (level 1 for the
   credit-blocked legs).
