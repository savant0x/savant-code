# FID: Legacy → Savant Rebrand Sweep (195+ instances across 34 tracked files)

**Filename:** `FID-2026-0803-014-legacy-to-savant-rebrand-sweep.md`
**ID:** FID-2026-0803-014
**Severity:** medium (branding consistency + contract hygiene — no runtime data loss,
but stale Savant identifiers/contract keys leak into a Savant-only product)
**Status:** closed
**Created:** 2026-08-03
**Author:** Savant

**Summary:**
Repo-wide audit of 195+ `savant` / `Savant` / `SAVANT_FREE` /
legacy-brand case variants across 34 tracked files. Categories: (A) **live
contract code** — the `savant` YAML namespace + `SavantProtocolConfig`
parser in `protocol-config.ts`, the `cli.update_savant_free_failed` telemetry
event in the released savant-free wrapper, and the stale `SAVANT_FREE_MODE=true`
dev-script env var; (B) **kept protocol documents** —
`ECHO-single-agent.md` and `dev/nova/specs/echo-v0.1.2-single-agent.md` remain named
and intact because they are the authoritative Savant ECHO adaptation; (C)
**safe docs/config prose** — current Savant-facing documentation and selected
historical records were updated, while legal attributions, protocol-routing
directives, explicit historical records, and `LEARNINGS.md` were preserved.

---

## RED — Evidence

### Category A — live contract code (4 files, 27 instances plus compatibility normalization)

- **RB-A1 — `common/src/util/protocol-config.ts`:** Replaced the legacy
  `ProtocolConfig` runtime shape with `SavantProtocolConfig` and `.savant`.
  The parser prefers `savant.protocol` and normalizes the documented
  `single_agent.protocol` namespace into it. The sole consumer reads
  `.maxIterations`; no `.savant` runtime field is exposed.
- **RB-A2 — `protocol.config.yaml` and parser tests:** The active
  `savant.protocol` contract and the `single_agent.protocol` compatibility
  alias are both covered by focused tests. This keeps the retained protocol
  docs operational without making Savant the active runtime naming.
- **RB-A3 — release wrapper telemetry:** Renamed the legacy
  `cli.update_*_failed` telemetry event to `cli.update_savant_free_failed` in
  both the released wrapper and wrapper-safety test.
- **RB-A4 — `package.json`:** Renamed the development script environment
  variable to `SAVANT_FREE_MODE`, matching the actual runtime reader and
  binary build injection.

### Category B — savant-named protocol files (kept by operator decision)

| # | File | Decision | Proper usage |
|---|------|----------|--------------|
| RB-B1 | `ECHO-single-agent.md` | Keep filename and protocol content | Protocol marker for the Savant ECHO adaptation |
| RB-B2 | `dev/nova/specs/echo-v0.1.2-single-agent.md` | Keep filename and protocol content | Governing Savant single-agent protocol referenced by `FREEREADME.md` |

These are not stale Savant runtime identifiers. They intentionally document a
separate protocol lineage and remain the canonical references for Savant
sessions. Their names, version tag `0.1.2-single-agent`, and routing references are
therefore excluded from the branding sweep.

### Category C — safe docs/config prose and history (~28 files, 150 instances)

| File | Count | Notes |
|------|-------|-------|
| `savant-free/SPEC.md` | 40 | `SAVANT_FREE_MODE`/`IS_SAVANT_FREE`/`SAVANT_FREE` block letters → `SAVANT_FREE_MODE`/`IS_SAVANT_FREE`/`SAVANT_FREE` |
| `CHANGELOG.md` | 24 | Historical entries — Legacy → Savant (preserving prose structure) |
| `dev/test-prompts/archive/release-az-test-fid-2026-0728-008.md` | 17 | T3.x protocol tests reference renamed spec files |
| `dev/session-summaries/2026-07-31-echo-compliance-remediation.md` | 12 | Legacy brand stripped from filename (renamed); content renamed |
| `dev/session-summaries/2026-07-19-fid-026-debugging-and-rename.md` | 12 | Prose |
| `FREEREADME.md` | 12 | Kept as the Savant session directive; its protocol-routing references remain intentional |
| `dev/session-summaries/2026-07-19-fid-026-phase-b-rebrand.md` | 5 | Prose |
| `dev/fids/archive/FID-2026-0803-001` (3), `...-002` (3), `...-003` (1) | 7 | Archived FID prose (Savant references) |
| `dev/session-summaries/2026-07-17-1000.md` (3), others (1 each ×3) | 6 | Prose |
| `docs/reports/codebuff-discord-feedback.md` (3), `docs/gravity-integration-starter.md` (3) | 6 | Prose |
| `dev/test-prompts/archive/*` (5 more files, 1-3 each) | 8 | Prose |
| `LEARNINGS.md` (2) | 2 | Preserved verbatim per operator instruction; `dev/releases/v0.0.2.md` and safe current-facing docs were updated |
| `savant-free/README.md` | 2 | `SAVANT_FREE_MODE` prose |

### Out of scope (documented)

- `research/` (vendored `servers-main` reference copy, 144 tracked files) and
  `resources/` (untracked scans) — vendored third-party reference material, not
  product code. Savant hits there (if any) are upstream/reference prose.
- `.git/lost-found/` — git garbage, not tracked working tree.
- `bun.lock`, `database.db`, `cli/bin/`, `.env.local` — generated/ignored.

---

## GREEN — Solution

1. **RB-A1/A2 — protocol config rename (lockstep):**
   - `common/src/util/protocol-config.ts`: `SavantProtocolConfig` →
     `SavantProtocolConfig`; active runtime field `savant` → `savant`;
     parser locals were renamed to Savant terminology; `savant.protocol` is
     preferred while `single_agent.protocol` remains an explicit compatibility
     alias normalized into `.savant`.
   - `protocol.config.yaml`: the active contract is `savant:` with
     `'0.1.2-savant'`; the `single_agent.protocol` alias remains explicitly
     documented for Savant-session compatibility and is normalized by the
     parser.
   - `protocol-config.test.ts`: Savant fixture, legacy Savant alias fixture,
     and expectations cover both accepted namespaces. Law 4:
     `readProtocolConfig` consumers remain unchanged (`.maxIterations` only);
     both namespaces normalize into the `.savant` runtime property, so no
     `.savant` runtime field is exposed.

2. **RB-A3 — telemetry event (both sides):** `cli.update_savant_free_failed` →
   `cli.update_savant_free_failed` in BOTH `savant-free/cli/release/index.js`
   and `cli/src/__tests__/release/wrapper-safety.test.ts`. The wrapper-safety
   test asserts the released wrapper's exact config, so both must change in one
   commit.

3. **RB-A4 — dev script env var:** `SAVANT_FREE_MODE=true` →
   `SAVANT_FREE_MODE=true` in `package.json` (`dev:savant-free` script) —
   aligns with the actual code (`build-binary.ts:176` reads `SAVANT_FREE_MODE`).

4. **RB-B — protocol-file names kept:**
   - No `git mv` was performed. `ECHO-single-agent.md` and
     `dev/nova/specs/echo-v0.1.2-single-agent.md` remain the canonical Savant
     protocol references by operator decision.
   - `FREEREADME.md` continues to route Savant sessions to those files and
     `single_agent.protocol`; the parser accepts that namespace as a compatibility
     alias while preferring the active `savant.protocol` contract.

5. **RB-C — safe docs/archives prose sweep:** Case-preserving replacement
   was applied only where the reference was current Savant-facing prose or a
   safe normalization target. Protocol-routing directives, legal attributions,
   explicit historical records, `LEARNINGS.md`, and the kept protocol docs were
   not rewritten. Strategic docs now say Savant-Free where they discuss the
   future free product.

6. **No unintended runtime behavior change:** the active protocol contract,
   legacy Savant alias, development mode variable, and telemetry wrapper are
   synchronized. Legal notices, historical records, protocol routing, and
   `LEARNINGS.md` remain intentionally preserved.

---

## AUDIT — Verification

1. **Static sweep (Method 1):** `git grep` confirms zero deprecated
   `SAVANT_FREE_*` identifiers and zero `.savant` runtime consumers in active
   source (`cli/src`, `common/src`, `sdk/src`, `packages`, `agents`, and
   `savant-free/cli`). The sole active-source `savant` token is the explicit
   compatibility parser/test for the documented `single_agent.protocol` alias.
   Remaining matches are classified as retained protocol docs, legal
   attribution, explicit history, `LEARNINGS.md`, or the legacy state-directory
   ignore rule.
2. **Runtime (Method 2):** Typecheck ×4 (sdk/common/agent-runtime/cli) exit 0;
   `common` test suite pass (protocol-config tests updated); `cli` wrapper-safety
   test pass (telemetry key both sides); `agents` typecheck exit 0; ESLint
   `--max-warnings 0`; `lint:md` exit 0.
3. **Law 4 call-graph:** no file rename was performed by approved scope.
   `SavantProtocolConfig`, `update_savant_free_failed`, and deprecated runtime
   `SAVANT_FREE_MODE` readers are absent from active code; the kept protocol names
   are intentionally present only in their documented protocol/history boundary.
4. **Spec consistency:** the active `savant.protocol` contract and documented
   legacy `single_agent.protocol` alias in `protocol.config.yaml` match
   `common/src/util/protocol-config.ts`; the kept Savant protocol paths remain
   valid in `FREEREADME.md` and the protocol test prompts.

---

## Resolution — IMPLEMENTED (operator-approved scope: full sweep minus .md renames)

Operator approved: "Full sweep minus .md renames." This means code, config,
telemetry, and stale runtime environment identifiers were renamed to Savant;
selected current-facing `.md` content was updated; `.md` filenames were not
renamed; and the Savant protocol documents plus `LEARNINGS.md`, legal notices,
explicit historical records, and legacy compatibility rules were preserved.

Implemented: RB-A1..A4 (protocol parser/config compatibility, telemetry, env
script, and active `IS_SAVANT_FREE` wiring); RB-C safe current-facing docs and
strategic wording; RB-B intentionally kept. Active-source verification found
no deprecated `SAVANT_FREE_*` identifiers or `.savant` runtime consumers. The
remaining name matches are documented protocol, legal, historical, learning,
or compatibility boundaries.

### Closeout evidence

- `common` protocol-config focused test: 3 passed, 0 failed (including the
  legacy `single_agent.protocol` normalization regression test).
- Active source grep: no `SAVANT_FREE_*` or `.savant` runtime identifiers.
- `SAVANT_FREE_MODE` readers and `savant` protocol config are synchronized;
  the Savant protocol alias is covered by a focused parser regression test.
- Strategic docs no longer describe a planned Savant hosting dependency.
- `LEARNINGS.md` restored verbatim per operator instruction.
- No `.md` filenames were renamed; Savant protocol files remain usable.
