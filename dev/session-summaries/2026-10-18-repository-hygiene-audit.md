# Repository hygiene and parity audit — 2026-10-18

Single-agent ECHO, strict mode, autonomy level 3. Start `31008b4f`, main clean.
User requests bloat, stale data and documentation/data alignment with code.
FID-2026-1018-007 owns this audit and its demonstrated repairs.

## Intent before implementation

Inventory disk separately from tracked content without following directory
links; use existing validators for provider/protocol/design-system/version,
acceptance, metadata, skills and hygiene. Inspect orphan consumers and current
documentation links; historical reports remain historical evidence.

Repair the actual version-callout drift without implying a release; the
generator must retain trusted skill version 0.1.0. Untrack and ignore the
regenerable Sigma intermediate while preserving its on-disk copy. Preserve
obsolete scope history in a durable snapshot and keep only active authority
in the register. Correct confirmed README contracts and dead current links.
No bulk reference/dependency deletion, Git pruning or external-home mutation.

Record current measured coverage and limitations, including the fact that
passing generated checks cannot certify every sentence of historical prose.

## Implementation and focused evidence

Version and design-generation checks now pass. Source and docs explain local
SDK agent resolution, real streaming/RunState contracts and role-specific
write tools. Both basic READMEs and SDK basic example typecheck without model
calls. Thirteen malformed Markdown destinations, two dead current links and
the tmux banner are repaired; the historical expired report citation is
labelled unavailable rather than manufactured. Final AST/HTML scan: 146 files,
315 relative links, zero missing/malformed targets. Domain parsing validates
166 JSON-family files and all 74 resources through the production loader.

The 174,027-byte Sigma intermediate is untracked/ignored, still present locally.
Scope history is preserved outside the active register. Large ignored reference
and dependency trees stay. SDK build passes; 11/11 declared gates pass. The
surface-coverage guard initially required adding CLI typecheck for the `.tmp`
scope; added it and restamped normally. No guard bypass.

External home-skill diagnostics: zero repository errors / 22 home warnings;
HOME-SKILLS-001 records the operator boundary. EMBED-001 and unpublished release
authority remain intact. Audit report is under `docs/reports/`.
