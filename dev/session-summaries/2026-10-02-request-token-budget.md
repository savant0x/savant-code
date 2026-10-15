# Request token-budget enforcement

## Initial State

Read single-agent ECHO v0.1.2 through EOF and the exported review-error.md through
EOF. Existing working-tree audit changes are preserved. Recorded continuation
failed on 112977 input plus 943717 output exceeding 1048576 combined tokens.

## Intent

Task T112 / FID-2026-1002-003: enforce final request budgets at the shared model
boundary, publish route metadata, recover once from a smaller reported limit,
and verify dispatch arguments in offline regressions. No commit authorized.

## Planning Evidence

Production probes confirm the unchanged output allowance and a false result
from the overflow classifier for the exact recorded message. Provider-model
middleware covers generation and streaming after SDK argument conversion.

## Implementation

Implemented the shared final-request guard, route catalog publication, explicit
context forwarding, and one initial-dispatch correction. Smaller serving limits
and caller output ceilings win. Provider option overrides are bounded. Unknown
output caps remain omitted. Exhausted input uses the existing compaction code.
OpenRouter vendor IDs cannot overwrite direct provider limits; endpoint-scoped
observations remain smaller across catalog refresh. Endpoint identity is hashed.

## Verification

The failure's arithmetic now permits 931503 output at 112977 input, with a 4096
reserve inside 1048576 total. Offline wire tests exercise all three SDK entry
points, a different child model, bare-slug routing, and real HTTP 400 correction.
Full SDK: 570 pass / 1 POSIX-only skip; common: 739 pass / 4 symlink skips;
catalog: 99 pass; compaction/recovery: 23 pass. Root typecheck and zero-warning
ESLint, Markdown lint, formatting and quality pass. Ten declared gates passed;
the final project-verifier receipt is attached to the verified active FID.

Two existing SDK test suites leaked AI module mocks into later suites; their
mock registrations now use the shared restoration helper. Windows process-tree
cancellation passed when the suite ran outside the sandbox. The raw imported
review-error.md stays unchanged and uses the existing transcript-lint exemption.

## Boundaries

Tokenization and media costs are estimates; unknown serving caps can still
reject remotely. Outputless unknown requests keep provider defaults. The OAuth
transport deliberately omits unsupported output parameters. No live provider
charge or exact GLM route attribution claimed. G2 prevents commit/FID closure
until operator authorization; the implementation remains reviewable in the tree.
