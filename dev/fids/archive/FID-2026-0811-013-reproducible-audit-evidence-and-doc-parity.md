<!-- markdownlint-disable MD013 -->

# FID: Reproducible Audit Evidence and Documentation Parity

**Filename:** `FID-2026-0811-013-reproducible-audit-evidence-and-doc-parity.md`
**ID:** FID-2026-0811-013
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 02:54 UTC
**YAGNI-Compliance:** Verified for planning scope
**Master FID:** `FID-2026-0811-004`
**Depends On:** `FID-2026-0811-005`, `FID-2026-0811-006`, `FID-2026-0811-007`, `FID-2026-0811-008`, `FID-2026-0811-009`, `FID-2026-0811-010`, `FID-2026-0811-011`, `FID-2026-0811-012`, `FID-2026-0811-014`

> Planning-only. This FID certifies neither the current dirty tree nor a release.

## Summary

The audit ran against a large dirty working tree relative to `HEAD` `98acc25`. That state is useful for finding current
issues but cannot by itself certify a release or prove historical FID claims. Documentation also contains contradictory
workflow descriptions and generated artifacts have independent drift checks. This FID defines a reproducible audit packet:
clean-baseline identity, exact command matrix, captured exit codes, generated hashes, dirty-tree classification, and docs
parity checks. It is the final independent certification child for the master program.

## Evidence

- The audit inventory reported numerous modified, deleted, renamed, and untracked files relative to `HEAD`.
- `ECHO.md` requires exact command output, citations, and `NEEDS-REVIEW` for out-of-reach evidence.
- `CONTRIBUTING.md`, `AGENTS.md`, `protocol.config.yaml`, and FID ledgers describe overlapping but nonidentical gate sets.
- Generated bundle and provider documentation have drift checks, while the agent prebuild timestamp creates a separate
  reproducibility issue handled by child 010.

## Expected behavior

An audit report identifies its baseline SHA, worktree fingerprint, environment/tool versions, exact commands, exit codes,
changed-path classification, generated artifact hashes, and any evidence that is unavailable. A clean release certification
cannot be inferred from a dirty-tree run. Current docs and generated surfaces must agree with runtime behavior.

## Proposed solution

1. Define a read-only audit manifest containing repository SHA/fingerprint, Bun/tool versions, workspace list, and gates.
2. Capture each command's stdout/stderr to redacted, hash-bound transcripts with exit status and duration.
3. Record staged, unstaged, untracked, deleted, renamed, and ignored-path deltas explicitly.
4. Run generated drift, provider reference, FID ledger, protocol-boundary, and docs-parity scans.
5. Add a clean-checkout mode that refuses certification when the baseline is not clean or clearly labels the result as
   working-tree evidence.
6. Ensure audit reports never include credential material, arbitrary environment dumps, or misleading PASS claims.
7. Re-run the complete matrix after children 005–012 and 014 are implemented.

## Verification contract

- Same clean baseline and inputs produce the same manifest identity and stable summary ordering.
- Dirty-tree and clean-tree fixtures are classified correctly.
- Missing transcript, hash mismatch, command timeout, or redaction failure causes `NEEDS-REVIEW`/failure, not PASS.
- Docs-parity scan detects stale role/mode/gate claims and proves current references are reachable.
- Final report includes every child result and no unverified implementation claim.

## Perfection Loop

### Loop 1 — RED

- **RED:** Current audit evidence is necessarily dirty-tree evidence; gate sets and documentation surfaces can drift; some
  generation is nondeterministic.
- **GREEN:** Build a hash-bound, redacted, baseline-aware audit manifest and final parity scan.
- **AUDIT:** Evidence basis and governing requirements are cited above. No release certification is claimed.
- **ADVERSARIAL:** A green command run is not enough if it ran against untracked replacements, stale generated files, or a
  different Bun binary. The manifest must bind all of those inputs.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Independent audit and adversarial correction (2026-08-11)

- **RED:** Review found that the first dependency list did not consume the security, environment, quality, generated, and
  subprocess children, so the final audit could run against incomplete scope.
- **GREEN:** Expanded dependencies to every child result and added explicit dirty-tree/clean-tree classification and
  transcript-integrity requirements.
- **AUDIT:** The current working tree is explicitly classified as dirty evidence relative to `98acc25`; no release PASS is
  claimed. The final implementation audit must include all child IDs `005–012` and `014`.
- **ADVERSARIAL:** Missing or tampered evidence is `NEEDS-REVIEW`/failure. A summary that omits a child cannot certify the
  program.
- **CHANGE DELTA:** FID text only.

### Missed Questions

1. Can a dirty tree ever be useful? → Yes, for working-tree diagnosis, but label it and do not call it release-ready.
2. Must every transcript be retained forever? → Retain redacted, hash-bound evidence according to repository policy; never
   retain secrets.
3. Can docs be checked only by grep? → Grep is useful but insufficient; verify the runtime call graph and generated source.
4. What if a human visual review is required? → Mark `NEEDS-REVIEW` with the exact screen/system and do not convert it to
   PASS.

### Loop 3 — Final implementation evidence (2026-08-11)

- **RED:** The program audit required a reproducible, redacted evidence packet and an explicit dirty-tree boundary before any certification claim.
- **GREEN:** Added `scripts/audit-evidence.ts` and `audit:evidence`, with stable manifest identity, redacted transcript hashes, explicit staged/unstaged/untracked/deleted/renamed/ignored classification, allowlisted commands, and `--clean` fail-closed behavior.
- **AUDIT:** `bun test scripts/audit-evidence.test.ts` → `3 pass / 0 fail`. Working-tree audit succeeded with manifest hash `71e64fc7981bcd852b609c644d2efd6328a699f8ae69e17bfe578dcc7d405224`; delta was staged 2, unstaged 139, untracked 200, deleted 14, renamed 2, ignored 44. `--clean` exited 1 with `NEEDS-REVIEW: clean certification requested for a dirty working tree`. Existing repository/quality/protocol/provider/focused gates all passed.
- **ADVERSARIAL:** The tool reports `WORKING_TREE_EVIDENCE` rather than release certification, omits raw transcript content, hashes redacted output, and refuses a clean claim while any delta exists.
- **CHANGE DELTA:** New audit evidence runner/test and root command.

### Code Verification Evidence

- [x] Deterministic manifest and redacted transcript hashes implemented.
- [x] Dirty-tree classification and clean-certification refusal tested.
- [x] Audit command allowlist and shell:false boundary implemented.
- [x] Working-tree audit executed; clean mode correctly failed closed.

## Resolution

- **Status:** `closed` — implementation and independent final review are complete.
- **Implementation:** Reproducible audit evidence is now generated with an explicit working-tree versus clean-certification boundary.
- **Archive:** Archived with the FID-2026-0811 program closure entry in CHANGELOG.md.

## Lessons Learned

Audit quality depends on provenance. Without a bound baseline, exact command matrix, and redacted evidence, “all green”
can be accurate yet still answer the wrong question.
