# Documentation audit — 2026-10-10

## Intent and scope

Audit the repository's `docs/` tree for current guidance that contradicts the
live protocol or implementation, broken local references, and oversized or
duplicated archive material. This work is covered by active scope item T185
(`docs/**`, `dev/session-summaries/**`). Preserve historical records. Do not
delete candidates without an operator ruling.

## Initial findings

- `docs/echo-protocol.md` assigns incorrect meanings to ECHO Laws 7–15.
- `docs/self-improving-harness.md` links to an active-queue FID path, while the
  referenced FID is archived.
- Two design documents describe already-implemented systems as missing or
  planned, without a historical-status notice.
- The archive is 75 Markdown files / about 2.49 MB. A 488 KB Cloudflare
  documentation dump and a 242 KB skills catalog are candidates for operator
  review; two archived AI Playbook documents are byte-identical.

## Planned work

1. Correct the ECHO overview from `ECHO.md`.
2. Repair the self-improving guide's FID link and label superseded design plans
   as historical, pointing readers to current operator documentation.
3. Verify documentation references and markdown quality; report removal
   candidates for an operator decision.

## Final state

Updated the active ECHO overview and corrected current-facing workflow
descriptions in `docs/index.md`, `docs/features.md`, and `docs/agents.md`.
Corrected the self-improving harness FID link; marked two implemented design
blueprints as historical; refreshed the tool catalog and fixed its missing
helper-tool coverage. The FAQ now reflects that Auto Drive and Discord
Presence FIDs `001`–`010` are closed. Fixed two broken links in archived
teacher research and architecture documents.

Validation: provider reference generation check passed; `docs/` top-level
Markdown links resolved. Full-tree link audit found two unresolved links in
the 242 KB archived skills catalog (`CONTRIBUTING.md`, `LICENSE`); they remain
untouched because that file exceeds the safe full-read limit. `bun run lint:md`
passed (exit 0). No tests were run (documentation-only work).

Bloat candidates for operator review, with no deletion performed:

- `docs/archive/research/cloudflare-llms-full.md` — 488 KB vendor-documentation
  snapshot; no in-repository Markdown references found.
- `docs/archive/design/awesome-agent-skills-catalog.md` — 242 KB dated catalog;
  no in-repository Markdown references found and two broken root links.
- `docs/archive/design/AI-Playbook-Integration-Plan.md` and
  `docs/archive/launch/AI Playbook Integration Plan.md` — byte-identical
  38 KB copies; retain one if the operator approves deduplication.

Archive size alone is not treated as bloat: historical audit records and
closed design/build artifacts remain useful evidence. T185 remains active for
its other scope; deletion candidates require the operator's ruling before any
file is removed.
