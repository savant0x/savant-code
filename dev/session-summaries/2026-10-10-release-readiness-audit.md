# Release-readiness audit — 2026-10-10

## Intent and authorization

Operator: "eh, nevermind. I want you to begin a release-ready audit. I'll look
into rea later." Single-agent ECHO v0.1.2, strict mode, session ceiling 3.
T184 registers the audit. No REA implementation or skill authoring proceeds.

Audit the current working tree at product version 0.0.35 with Bun 1.3.14.
Verify version parity, generated artifacts, governance, lint, formatting,
quality, full typecheck, workspace tests, SDK build, CLI bundle resolution and
package contents. Record actual exit codes and distinguish working-tree proof
from committed-tree, platform-release and live-service acceptance.

## Impact and boundaries

The scope register and this summary are audit records, not production changes.
Tests and existing build tooling may create normal generated outputs; inspect
those entrypoints before execution. Preserve all pre-existing edits. Findings
remain active until repaired under a converged plan or blocked on a named
operator decision. No version bump, commit, tag, push, publish, deploy, profile replacement or
credential access is authorized. The operator selected "Authorize both" for
read-only Git inspection and temporary detached-worktree verification.

The release pre-audit was not executed: even its check path can fetch Git refs.
The authorized clean-checkout verifier was executed and failed compilation.
Afterward, `git worktree list` showed only the original main worktree.
Native platform packaging and remote release state are not established by
local compilation.

## Acceptance criteria

- Every attempted gate has its exact command, exit code and retained output.
- No success claim is inferred from filtered output or an earlier session.
- Failed checks are investigated; no suppression or weakened assertion.
- Build/package claims identify the actual artifact and exercised interface.
- A final verdict identifies remaining blockers and authorization boundaries.

## Evidence

- Toolchain: `bun --version` = 1.3.14; `npm --version` = 10.9.2.
- Current version: root, SDK, CLI and CLI release manifests declare 0.0.35.
- Gate manifest inspected in `scripts/validation-gates.ts` and package hooks.
- Retained logs and exit-code receipts:
  `dev/scratchpad/active/release-readiness-2026-10-10/`.

## Gate results and verdict

**Verdict: NOT RELEASE-READY.** This is an audit result, not a repair claim.
Production code was not changed by the audit. The scope formatting introduced
by this audit was corrected; final checks on SCOPE and this summary passed: Prettier exit 0, Markdown lint
exit 0, and scope-register exit 0 (zero issues).

| Gate | Exit | Evidence |
| --- | --- | --- |
| Full `bun --no-env-file run typecheck` | 0 | `typecheck.log` |
| Provider docs, hygiene, scope, ESLint, Prettier | 0 | Named static logs |
| Version check | 1 | README release-callout body differs from CHANGELOG |
| Protocol bundle check | 1 | Embedded protocol bundle is stale |
| Quality report | 1 | 340-line HUD preview; deleted-logo baseline entry |
| Markdown lint | 1 | Telemetry proposal line is 232 columns |
| Repository validation | 1 | Quality failures plus missing FID evidence |
| Root regression command | 1 | SDK Windows cancellation failure stopped chain |
| Other root-script workspace suites, individually | 0 | `workspace-results.txt` |
| SDK source suite, `bun --no-env-file test src/` | 0 | 605 pass, 1 skip, 0 fail |
| SDK full rerun, `bun --no-env-file test` | 0 | 676 pass, 1 skip, 0 fail |
| SDK build | 0 | `sdk-build.log` |
| SDK Node ESM import and TypeScript token extraction | 0 | `sdk-esm-smoke.log` |
| SDK Node CJS require and expected exports | 0 | `sdk-cjs-smoke.log` |
| CLI Bun bundle | 0 | `cli-bundle.log`; not a native executable smoke |
| SDK and CLI `npm pack --dry-run --json` | 0 | Package manifests inspected |
| Committed-tree `bun --no-env-file run verify:clean` | 1 | `clean-checkout.log` |

### Findings requiring action

1. README version numbers agree at 0.0.35, but the release-callout body does
   not match the corresponding CHANGELOG section. This is content drift.
2. `common/src/constants/protocol-bundle.generated.ts` needs regeneration
   against the current grounding set, then its check and regression gates.
3. `cli/scripts/hud-preview-components.tsx` contains 340 lines, above the
   absolute 300-line ceiling. Its preview work is approval-gated under T182.
4. The quality baseline still exempts missing `cli/src/constants/savant-logo.ts`.
5. `dev/telemetry/proposals/law15-dominance.md:10` exceeds the 120-column limit.
6. `FID-2026-1010-003-sidebar-operator-polish-pass.md` lacks the required
   `### Code Verification Evidence` section. The icon-program FID's live
   quality gate also fails on the same quality findings above.
7. Committed HEAD fails in `common/src/__tests__/model-config.test.ts:44`:
   removed `tokenharbor/th-orchestra` remains in the typed expected catalog.
   The current working tree compiles; that does not establish committed-tree
   readiness. Repairing the release tree requires an authorized commit and
   another clean-checkout run.
8. Windows terminal-tree cancellation failed once at the parent-PID assertion
   in the full SDK run. The same suite passed isolated (7/7), and the full
   SDK rerun passed without source changes. Treat as an intermittent failure,
   not a fixed cause or an unconditional reliable-test claim.

### Artifact verification limits

The first custom SDK probes incorrectly expected `SavantClient`; source exports
`SavantCodeClient`. The corrected probes passed against `sdk/dist/index.mjs`
and `sdk/dist/index.cjs`; ESM also extracted `releaseProbe` from TypeScript
using `sdk/dist/wasm`. The initial probe error was audit error, not a missing
SDK export. CJS tree-sitter execution and consumer declaration compatibility
were not established by these probes.

The initial root-directory package dry run inspected the root package, not the
SDK. A subsequent dry run from `sdk/` passed its build/vendor prepack gates and
reported 23 entries. CLI release dry run reported 81 entries. Dry runs establish
file selection, not clean installation or native launcher behavior.

No native multi-platform binary, interactive TUI smoke, published-package
installation, remote release state, or live-provider acceptance is proven.
REA remains untouched per the operator's instruction. Savant-free disposition
remains operator-owned under T122; it is not included in the root test chain.
The passing source/full SDK reruns do not erase the initial root-chain failure.

## Operator decision

All findings remain registered under T184. Approval is required to expand this
read-only audit into remediation, including the approval-gated preview file.
No commit, push, publish or release is authorized. The audit evidence is saved;
release readiness remains blocked by the findings and acceptance limits above.
