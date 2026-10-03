# Provider integration — 2026-10-03

The operator resumed FID-2026-1003-001 under single-agent ECHO. Implement
CodeCraft API and xKiro, validate and complete CleanAPIs, retain live catalogs,
and follow the provider runbook. T119 includes registry, shared parsers,
gateway fanout/cache/reset, exception owners, xKiro multi dispatch, setup and
transport tests, generated references, and bounded live acceptance.

The converged design uses exact protocol entries before explicit terminal
prefix rules: xKiro Anthropic IDs use Messages; other xKiro IDs use chat.
Existing exact-map providers still reject unknown IDs. Captured installed-SDK
requests confirm the /v1 root for both protocols. CodeCraft and CleanAPIs
share measured schema normalization and retain independent credentials and
caches. Null limits remain unknown; prices use USD per token.

CodeCraft and xKiro registry entries, independent catalog wrappers, gateway
fanout/extraction/merge/reset, exception owners, shared protocol resolution,
and CodeCraft/CleanAPIs normalization are implemented. Capability, access-tier,
and reasoning-effort metadata reach the existing model-information prompt.
Generated references and hand-maintained provider mentions are updated;
the runbook now describes the current registry partitions and live wiring.

All 22 declared FID gates pass. Full root typecheck across 13 workspaces plus
scripts, zero-warning ESLint, Markdown lint, formatting, quality, and generated
reference checks pass. Common provider tests: 72 pass, zero fail. Related CLI
tests: 170 pass, zero fail, including the native model-picker scroll suite.
Full SDK: 577 pass, one POSIX-only skip, zero fail after an unrestricted rerun
of the full suite. Its initial sandbox run failed only the Windows process-tree
cancellation test. Logs are `dev/scratchpad/active/provider-integration-*.log`.

Authenticated catalogs returned HTTP 200: CodeCraft 33, CleanAPIs 33, xKiro
129. All parsed IDs retain their exact upstream suffix; all xKiro IDs resolve
through the map. CodeCraft/CleanAPIs missing output caps remain unknown.
Raw snapshots, complete lists, and hashes are in the provider-catalogs scratchpad.

Live streaming tool calls passed on CodeCraft and CleanAPIs `gpt-5.6-luna`,
and xKiro `mistralai/ministral-14b` through mapped chat. The same free xKiro
model passed through Messages using an explicit test configuration override;
production still maps that Mistral ID to chat. Mapped Claude Haiku reached
`/v1/messages` but returned HTTP 403: active paid plan or real deposited
balance required. That live inference leg remains blocked on account access.
Named tool choice was initially rejected by the two compatible chat services;
the smoke passed using the app's existing `auto` behavior. No app workaround
or paid account action was introduced.

Live tmux at 100×28 showed 2,046 models and an xKiro filter with 129 matches.
After 20 paced Down presses, the selected Command A Vision row remained
visible. At 60×24, rows stayed one line and the selection remained visible.
Provider menu checks showed configured CodeCraft, CleanAPIs, and xKiro.
No provider/model selection was committed during these terminal checks.

FID-2026-1003-001 records implementation evidence and the successful gate
receipt. T119 remains active for Claude paid access, the unnamed possible
fourth provider, and G2 commit/closure authority. The prior T120 scroll fix
and its verified FID are preserved. No commit, archive, or release was made.

Final repository ledger validation exposed a duplicate FID-2026-1003-002:
the scroll correction and an unrelated gateway replay task. The scroll FID
was renumbered to unused FID-2026-1003-004 with references and receipt updated.
The provider and scroll receipts validate. The final ledger rerun has one
remaining finding in another active task: project-data collision
FID-2026-1003-003 lacks its required Code Verification Evidence heading.
The gateway task's heading was repaired separately while this session ran.
Those records were not modified by this task; the full ledger is not claimed
clean. Final scope-register and scope-disposition checks pass, Markdown lint
exits zero, generated references are current, and changed-path diff checks
report no whitespace errors.

Closure follow-up intent, 2026-10-03: update the unreleased CHANGELOG,
English/Chinese READMEs, relevant workspace references, shared model-catalog
guide, and provider-neutral model-information fallback. Keep version 0.0.35
as the published release, describe the changes as unreleased, and preserve
the actual account-access limits. Rerun gates before the G2 commit request;
do not stamp closed or archive uncommitted implementation.

Implemented closure preparation: CHANGELOG unreleased entries cover provider
integration, metadata, and the model-picker scroll fix, including severity and
actual validation limits. English/Chinese root READMEs, CLI/release/SDK/common/
provider workspace READMEs, docs index/features/SDK reference, and the new
`docs/providers.md` share the routing and metadata contract. The published
version remains 0.0.35. The SDK guide's already-completed registry refactor
is described accurately; live catalog wiring remains explicit.

Both CLI and runtime metadata fallbacks no longer imply an OpenRouter-only
catalog. Existing callers and substitution tests confirm the production path.
All 23 provider FID gates pass at 2026-10-03T06:27:12.737Z. Fresh full root
typecheck, zero-warning ESLint, Markdown lint, changed-source formatting,
generated references, scope completeness, and scope disposition checks pass.
Closure still needs the ECHO G2 local commit hash. No git staging, commit,
push, paid-account action, closure, or archive was performed in this follow-up.
All six scroll FID gates also passed on a fresh run at
2026-10-03T06:30:29.734Z; both receipts validate. The local commit plan is
`2026-10-03-provider-closure-plan.md`, including selective staging for shared
files and preservation of the pending account-access/provider-identity items.
