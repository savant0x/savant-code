# FID: FreeBuff → Savant Rebrand Sweep (195+ instances across 34 tracked files)

**Filename:** `FID-2026-0803-014-freebuff-to-savant-rebrand-sweep.md`
**ID:** FID-2026-0803-014
**Severity:** medium (branding consistency + contract hygiene — no runtime data loss,
but stale FreeBuff identifiers/contract keys leak into a Savant-only product)
**Status:** complete
**Created:** 2026-08-03
**Author:** Savant

**Summary:**
Repo-wide audit of 195+ `freebuff` / `FreeBuff` / `FREEBUFF` /
`Freebuff` instances across 34 tracked files. Categories: (A) **live
contract code** — the `freebuff` YAML namespace + `FreeBuffProtocolConfig`
parser in `protocol-config.ts`, the `cli.update_freebuff_failed` telemetry
event in the released savant-free wrapper, and the stale `FREEBUFF_MODE=true`
dev-script env var; (B) **kept protocol documents** —
`ECHO-freebuff.md` and `dev/nova/specs/echo-v0.1.2-freebuff.md` remain named
and intact because they are the authoritative FreeBuff ECHO adaptation; (C)
**safe docs/config prose** — current Savant-facing documentation and selected
historical records were updated, while legal attributions, protocol-routing
directives, explicit historical records, and `LEARNINGS.md` were preserved.

---

## RED — Evidence

### Category A — live contract code (4 files, 27 instances plus compatibility normalization)

- **RB-A1 — `common/src/util/protocol-config.ts`:** Replaced the
  `FreeBuffProtocolConfig` and `.freebuff` runtime shape with
  `SavantProtocolConfig` and `.savant`. The parser prefers `savant.protocol`
  and normalizes the documented legacy `freebuff.protocol` alias. The sole
  consumer reads `.maxIterations`; no `.freebuff` runtime field is exposed.
- **RB-A2 — `protocol.config.yaml` and parser tests:** The active
  `savant.protocol` contract and legacy `freebuff.protocol` compatibility alias
  are both covered by focused tests. This keeps the retained protocol docs
  operational without making FreeBuff the active runtime naming.
- **RB-A3 — release wrapper telemetry:** Renamed
  `cli.update_freebuff_failed` to `cli.update_savant_free_failed` in both the
  released wrapper and wrapper-safety test.
- **RB-A4 — `package.json`:** Renamed the development script environment
  variable from `FREEBUFF_MODE` to `SAVANT_FREE_MODE`, matching the actual
  runtime reader and binary build injection.

### Category B — freebuff-named protocol files (kept by operator decision)

| # | File | Decision | Proper usage |
|---|------|----------|--------------|
| RB-B1 | `ECHO-freebuff.md` | Keep filename and protocol content | Protocol marker for the FreeBuff ECHO adaptation |
| RB-B2 | `dev/nova/specs/echo-v0.1.2-freebuff.md` | Keep filename and protocol content | Governing FreeBuff single-agent protocol referenced by `FREEREADME.md` |

These are not stale Savant runtime identifiers. They intentionally document a
separate protocol lineage and remain the canonical references for FreeBuff
sessions. Their names, version tag `0.1.2-freebuff`, and routing references are
therefore excluded from the branding sweep.

### Category C — safe docs/config prose and history (~28 files, 150 instances)

| File | Count | Notes |
|------|-------|-------|
| `savant-free/SPEC.md` | 40 | `FREEBUFF_MODE`/`IS_FREEBUFF`/`FREEBUFF` block letters → `SAVANT_FREE_MODE`/`IS_SAVANT_FREE`/`SAVANT_FREE` |
| `CHANGELOG.md` | 24 | Historical entries — FreeBuff → Savant (preserving prose structure) |
| `dev/test-prompts/archive/release-az-test-fid-2026-0728-008.md` | 17 | T3.x protocol tests reference renamed spec files |
| `dev/session-summaries/2026-07-31-freebuff-echo-compliance-remediation.md` | 12 | Filename itself is dated (`-freebuff-`) — content renamed; filename keeps historical date prefix (documented) |
| `dev/session-summaries/2026-07-19-fid-026-debugging-and-rename.md` | 12 | Prose |
| `FREEREADME.md` | 12 | Kept as the FreeBuff session directive; its protocol-routing references remain intentional |
| `dev/session-summaries/2026-07-19-fid-026-phase-b-rebrand.md` | 5 | Prose |
| `dev/fids/archive/FID-2026-0803-001` (3), `...-002` (3), `...-003` (1) | 7 | Archived FID prose (FreeBuff references) |
| `dev/session-summaries/2026-07-17-1000.md` (3), others (1 each ×3) | 6 | Prose |
| `docs/reports/codebuff-discord-feedback.md` (3), `docs/gravity-integration-starter.md` (3) | 6 | Prose |
| `dev/test-prompts/archive/*` (5 more files, 1-3 each) | 8 | Prose |
| `LEARNINGS.md` (2) | 2 | Preserved verbatim per operator instruction; `dev/releases/v0.0.2.md` and safe current-facing docs were updated |
| `savant-free/README.md` | 2 | `FREEBUFF_MODE` prose |

### Out of scope (documented)

- `research/` (vendored `servers-main` reference copy, 144 tracked files) and
  `resources/` (untracked scans) — vendored third-party reference material, not
  product code. FreeBuff hits there (if any) are upstream/reference prose.
- `.git/lost-found/` — git garbage, not tracked working tree.
- `bun.lock`, `database.db`, `cli/bin/`, `.env.local` — generated/ignored.

---

## GREEN — Solution

1. **RB-A1/A2 — protocol config rename (lockstep):**
   - `common/src/util/protocol-config.ts`: `FreeBuffProtocolConfig` →
     `SavantProtocolConfig`; active runtime field `freebuff` → `savant`;
     parser locals were renamed to Savant terminology; `savant.protocol` is
     preferred while `freebuff.protocol` remains an explicit compatibility
     alias normalized into `.savant`.
   - `protocol.config.yaml`: the active contract is `savant:` with
     `'0.1.2-savant'`; the legacy `freebuff.protocol` alias remains explicitly
     documented for FreeBuff-session compatibility and is normalized by the
     parser.
   - `protocol-config.test.ts`: Savant fixture, legacy FreeBuff alias fixture,
     and expectations cover both accepted namespaces. Law 4:
     `readProtocolConfig` consumers remain unchanged (`.maxIterations` only);
     both namespaces normalize into the `.savant` runtime property, so no
     `.freebuff` runtime field is exposed.

2. **RB-A3 — telemetry event (both sides):** `cli.update_freebuff_failed` →
   `cli.update_savant_free_failed` in BOTH `savant-free/cli/release/index.js`
   and `cli/src/__tests__/release/wrapper-safety.test.ts`. The wrapper-safety
   test asserts the released wrapper's exact config, so both must change in one
   commit.

3. **RB-A4 — dev script env var:** `FREEBUFF_MODE=true` →
   `SAVANT_FREE_MODE=true` in `package.json` (`dev:savant-free` script) —
   aligns with the actual code (`build-binary.ts:176` reads `SAVANT_FREE_MODE`).

4. **RB-B — protocol-file names kept:**
   - No `git mv` was performed. `ECHO-freebuff.md` and
     `dev/nova/specs/echo-v0.1.2-freebuff.md` remain the canonical FreeBuff
     protocol references by operator decision.
   - `FREEREADME.md` continues to route FreeBuff sessions to those files and
     `freebuff.protocol`; the parser accepts that namespace as a compatibility
     alias while preferring the active `savant.protocol` contract.

5. **RB-C — safe docs/archives prose sweep:** Case-preserving replacement
   was applied only where the reference was current Savant-facing prose or a
   safe normalization target. Protocol-routing directives, legal attributions,
   explicit historical records, `LEARNINGS.md`, and the kept protocol docs were
   not rewritten. Strategic docs now say Savant-Free where they discuss the
   future free product.

6. **No unintended runtime behavior change:** the active protocol contract,
   legacy FreeBuff alias, development mode variable, and telemetry wrapper are
   synchronized. Legal notices, historical records, protocol routing, and
   `LEARNINGS.md` remain intentionally preserved.

---

## AUDIT — Verification

1. **Static sweep (Method 1):** `git grep` confirms zero deprecated
   `FREEBUFF_*` identifiers and zero `.freebuff` runtime consumers in active
   source (`cli/src`, `common/src`, `sdk/src`, `packages`, `agents`, and
   `savant-free/cli`). The sole active-source `freebuff` token is the explicit
   compatibility parser/test for the documented `freebuff.protocol` alias.
   Remaining matches are classified as retained protocol docs, legal
   attribution, explicit history, `LEARNINGS.md`, or the legacy `.freebuff/`
   ignore rule.
2. **Runtime (Method 2):** Typecheck ×4 (sdk/common/agent-runtime/cli) exit 0;
   `common` test suite pass (protocol-config tests updated); `cli` wrapper-safety
   test pass (telemetry key both sides); `agents` typecheck exit 0; ESLint
   `--max-warnings 0`; `lint:md` exit 0.
3. **Law 4 call-graph:** no file rename was performed by approved scope.
   `FreeBuffProtocolConfig`, `update_freebuff_failed`, and deprecated runtime
   `FREEBUFF_MODE` readers are absent from active code; the kept protocol names
   are intentionally present only in their documented protocol/history boundary.
4. **Spec consistency:** the active `savant.protocol` contract and documented
   legacy `freebuff.protocol` alias in `protocol.config.yaml` match
   `common/src/util/protocol-config.ts`; the kept FreeBuff protocol paths remain
   valid in `FREEREADME.md` and the protocol test prompts.

---

## Resolution — IMPLEMENTED (operator-approved scope: full sweep minus .md renames)

Operator approved: "Full sweep minus .md renames." This means code, config,
telemetry, and stale runtime environment identifiers were renamed to Savant;
selected current-facing `.md` content was updated; `.md` filenames were not
renamed; and the FreeBuff protocol documents plus `LEARNINGS.md`, legal notices,
explicit historical records, and legacy compatibility rules were preserved.

Implemented: RB-A1..A4 (protocol parser/config compatibility, telemetry, env
script, and active `IS_SAVANT_FREE` wiring); RB-C safe current-facing docs and
strategic wording; RB-B intentionally kept. Active-source verification found
no deprecated `FREEBUFF_*` identifiers or `.freebuff` runtime consumers. The
remaining name matches are documented protocol, legal, historical, learning,
or compatibility boundaries.

### Closeout evidence

- `common` protocol-config focused test: 3 passed, 0 failed (including the
  legacy `freebuff.protocol` normalization regression test).
- Active source grep: no `FREEBUFF_*` or `.freebuff` runtime identifiers.
- `SAVANT_FREE_MODE` readers and `savant` protocol config are synchronized;
  the FreeBuff protocol alias is covered by a focused parser regression test.
- Strategic docs no longer describe a planned FreeBuff hosting dependency.
- `LEARNINGS.md` restored verbatim per operator instruction.
- No `.md` filenames were renamed; FreeBuff protocol files remain usable.
