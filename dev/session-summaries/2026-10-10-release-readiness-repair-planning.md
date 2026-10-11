# Release-readiness repair planning — 2026-10-10

## Intent

Operator: "make a repair fid to fix all issues you found so we're ready for
release". Created `dev/fids/FID-2026-1010-004-release-readiness-repair.md`
and extended T184 in SCOPE. No production code changed in this planning pass.

## Coverage and review

The FID maps all eight audit findings to explicit repairs: release-callout
content, generated protocol bundle, preview line ceiling, stale logo baseline,
telemetry Markdown, FID evidence/receipts, committed catalog expectations, and
intermittent Windows process cancellation. Artifact acceptance additionally
requires installed SDK consumers, native/interactive CLI behavior, frozen
lockfile/root gates, committed-tree proof and explicit external authority.

Inspection confirmed telemetry recurrence: `draftFor` concatenates the proposal
paragraph without line breaks. The plan includes the producer repair and an
existing telemetry-feedback regression suite, rather than a document-only fix.
Windows taskkill timeout/fallback and shell-only liveness are investigation
leads, not a proven diagnosis. The FID remains analyzed, not converged.

## Verification

Final checks after document repairs returned exit 0:

```text
FID gate contract PASS (23 resolved gates; no gates executed)
Checking formatting...
All matched files use Prettier code style!
scope-register PASS (0 issues)
```

The contract check used the production `parseVerificationGates` and
`resolveGate` functions to validate syntax, allowed workspaces and actual paths.
An initial malformed gate-section error was repaired by ending that section
with a level-two heading before authority prose. The final rerun passed.
Prettier and Markdown lint covered the FID and SCOPE. This summary is checked
separately after creation. No production typecheck/test gate is claimed by
these document checks, and no machine verification receipt was fabricated.

## Boundaries

Creating a repair FID is not implementing repairs or declaring release-ready.
Preview implementation approval, measured cancellation design, authorized
commit, native runners/artifact authority, remote pre-audit authority and any
live-service access/budget remain explicit boundaries. Existing Savant-free
and provider rulings remain binding. REA remains untouched. No commit, push,
tag, publish, deploy, or credential access occurred.
