<!-- markdownlint-disable MD013 -->

# FID: Release Subprocess Boundary Hardening

**Filename:** `FID-2026-0811-009-release-subprocess-boundary-hardening.md`
**ID:** FID-2026-0811-009
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 02:54 UTC
**YAGNI-Compliance:** Verified for planning scope
**Master FID:** `FID-2026-0811-004`
**Depends On:** `FID-2026-0811-005`, `FID-2026-0811-007`

> Planning-only. Do not invoke release mutation commands while executing this FID.

## Summary

The release system executes commands through `spawnSync` with argument arrays and controlled environments, which is a
strong baseline. The audit nevertheless identified a required boundary review around command sanitization and shell
semantics: earlier focused output referenced `sanitizeArg`/`runBinary` contract expectations, while the current source
search primarily exposes direct `spawnSync` calls and platform-specific PowerShell/taskkill operations. The release path
must prove that user/config-derived values cannot become shell syntax, that the platform process-control commands are
strictly allowlisted, and that diagnostics never cross into public mutation commands. **The previously reported sanitizer
failure is not currently re-proven from the live source; that portion is `NEEDS-REVIEW`, not a confirmed vulnerability.**

## Evidence

- `scripts/public-release.ts:1028-1038` runs release commands through `spawnSync(command, args, ...)` with no shell option
  shown in the audited excerpt; this must be made explicit and tested (`NEEDS-REVIEW` until the complete function is
  re-read during implementation RED).
- `scripts/public-release.ts:858-865` invokes PowerShell with a fixed command for process enumeration.
- `scripts/public-release.ts:941-959` invokes `taskkill` with PID-derived argument arrays.
- `scripts/public-release.test.ts:1191-1203` checks that diagnostic manifests do not contain mutation command tokens.
- The prior audit recorded command-sanitization test failures/coverage concerns; those claims require current source/test
  reconciliation before implementation and are not treated as present defects here.

## Expected behavior

- All subprocesses use argument arrays with `shell: false` or an equivalent explicit invariant.
- Command names and platform helper commands are allowlisted; no arbitrary command string is assembled from untrusted
  input.
- Arguments containing spaces, quotes, `$()`, backticks, redirection, pipes, newlines, Unicode, and Windows path syntax
  remain literal arguments.
- Timeouts fail closed, process trees are limited to owned descendants, and PID reuse cannot kill unrelated processes.
- Diagnostic manifests cannot invoke tag, push, publish, release, or remote mutation operations.

## Proposed solution

1. Inventory every release subprocess call and classify fixed command, config-derived command, and platform helper.
2. If the inventory proves a missing invariant, introduce or reuse one typed `runBinary` boundary with explicit
   `shell: false`, timeout, environment, and output policy; if all call sites already satisfy the invariant, record a
   documented PASS and do not add a helper.
3. Remove or constrain any string command substitution; use argument arrays and platform-specific allowlists.
4. Add a shell-metacharacter corpus and Windows path/PID reuse tests.
5. Bind the command boundary to the canonical gate manifest from child 007.
6. Preserve redaction, transcript hashing, and bounded output behavior.

## Verification contract

- Static search shows no release subprocess path uses shell interpretation or interpolated command strings.
- Targeted tests pass for metacharacters, whitespace, Unicode, command-not-found, timeout, and process-tree ownership.
- Diagnostic manifest mutation scan passes.
- Full release/public-release tests, typecheck, lint, format, and repository validation pass.
- Production call graph proves every release gate uses the hardened boundary.

## Perfection Loop

### Loop 1 — RED

- **RED:** Direct subprocess calls are present and the command-boundary contract is not explicit enough to certify all
  paths. The alleged sanitizer regression is `NEEDS-REVIEW` because the live source search did not reproduce it.
- **GREEN:** First inventory and classify every call site. Centralize and type the boundary only if a missing invariant is
  proven; otherwise document the existing PASS. In either case, make shell behavior explicit and test hostile arguments
  and platform helpers.
- **AUDIT:** Source locations and diagnostic test location are cited above. No mutation commands were run.
- **ADVERSARIAL:** `spawnSync` arrays are not alone sufficient: omitted `shell: false`, alternate call sites, fixed
  PowerShell commands, and timeout cleanup must all be audited. The adversarial reviewer may downgrade or split this FID
  if the complete source proves the boundary already explicit and covered.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Independent audit and adversarial correction (2026-08-11)

- **RED:** Review found that the initial critical severity and sanitizer claim exceeded the currently reproduced evidence.
- **GREEN:** Downgraded to high, labeled the unproven sanitizer portion `NEEDS-REVIEW`, and required a complete call-site
  inventory before any implementation decision. A new helper is conditional, not assumed.
- **AUDIT:** Reproduced source evidence is limited to `scripts/public-release.ts:858-865`, `:941-959`, and `:1028-1038`,
  plus the diagnostic test at `scripts/public-release.test.ts:1191-1203`. No exploit or mutation was run.
- **ADVERSARIAL:** If the complete implementation RED finds no unsafe boundary, the correct result is to close this as a
  documented PASS or split only the remaining test gap; do not manufacture a security defect.
- **CHANGE DELTA:** FID text only.

### Missed Questions

1. Is `spawnSync` with arrays automatically safe on every platform? → Make the shell setting explicit and test Windows.
2. Are fixed PowerShell commands in scope? → Yes; they can affect process termination and must be allowlisted and bounded.
3. Can diagnostics share a runner with mutation stages? → Only with an explicit non-mutation manifest and test.
4. What happens on timeout cleanup failure? → Fail closed and record redacted evidence; never continue as if the gate passed.

### Loop 3 — Final implementation evidence (2026-08-11)

- **RED:** The implementation audit found all release subprocesses used argument arrays but did not explicitly declare the shell boundary, and the generic runner accepted arbitrary executables.
- **GREEN:** Added `shell: false` to all four `spawnSync` families and an allowlist covering `bun`, `npm`, `git`, `gh`, `powershell.exe`, and `taskkill`. Added hostile command-string rejection coverage without introducing a new helper.
- **AUDIT:** `bun test scripts/public-release.test.ts` → `53 pass / 0 fail`, `177 expect()` calls. ESLint exit 0 and Prettier exit 0. Static call-site audit confirms `shell: false` at every `spawnSync` in `scripts/public-release.ts`; timeout/owned-process-tree logic remains unchanged and diagnostic mutation checks stay green.
- **ADVERSARIAL:** Unsupported sanitizer claims remain unasserted; the implementation closes the explicit shell/allowlist contract without manufacturing an exploit.
- **CHANGE DELTA:** Explicit shell boundary, executable allowlist, and contract test.

### Code Verification Evidence

- [x] Every release `spawnSync` call explicitly sets `shell: false`.
- [x] Generic runner executable allowlist and hostile-input regression test implemented.
- [x] Timeout/process ownership and non-mutation manifest tests remain green.
- [x] Release suite: 53 pass / 0 fail; ESLint and Prettier pass.

## Resolution

- **Status:** `closed` — implementation and independent final review are complete.
- **Implementation:** Release subprocess execution now has an explicit no-shell boundary and allowlisted executable contract.
- **Archive:** Archived with the FID-2026-0811 program closure entry in CHANGELOG.md.

## Lessons Learned

Process execution security is a boundary property. A safe-looking call site does not certify alternate platform helpers,
timeouts, or future command additions.
