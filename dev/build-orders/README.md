# Build Orders

Proposed work awaiting operator approval. **A build order is not approved
scope and not a FID.** It describes work that has been specified but not
authorized; nothing here is committed to until the operator approves it and a
FID is opened under [`../fids/`](../fids/).

## Layout

| Path | What lives here |
|---|---|
| `*.md` (this directory) | **Live proposals** — specified, unapproved, or partially executed |
| [`archive/`](archive/) | **Terminal records** — delivered, superseded, or resolved. Kept as evidence, never re-opened |

This mirrors [`../idea-shelf/`](../idea-shelf/), where terminal records move to
`archive/` on realization. A terminal record that stays in the live directory is
a defect: it is indistinguishable from live work.

## Lifecycle

1. **Proposed** — lands here with a `Status:` line naming its real state
   (`planning`, `OPEN — N of M`, `PARTIALLY EXECUTED`, `HANDOFF`). No FID, no
   implementation.
2. **Executed** — on operator approval the order's items become FIDs under
   `dev/fids/`. The order's status line is updated to point at those FIDs; the
   order is now a historical plan, not live work.
3. **Archived** — when every item is delivered, the order is superseded by a
   canonical document, or its remaining work is provably a no-op, the record
   moves to `archive/`. This is the closure ceremony: no file here should carry
   a terminal status.

## Conventions

- Every file carries a `Status:` frontmatter line (or `**Status:**` bold line
  in the older format) whose value matches reality. A status contradicted by the
  codebase is a defect — verify against the code, not the header.
- Cross-references to a build order from code, docs, or manifests must point at
  the file's current path. A move is not complete until its referrers are
  repaired in the same pass.
- `scripts/tree-drain.ts` is **fail-closed on unmatched paths** — every changed
  path must belong to exactly one commit group in
  `scripts/tree-drain-manifest/`. Moving a file out of this directory without
  updating its manifest entry breaks the drain tool with `UNCOVERED PATHS`.
- No signatures, no author attribution, no agent names in these documents.

## Register

Approved work lives in [`../../SCOPE.md`](../../SCOPE.md) and
[`../fids/`](../fids/). A build order here that becomes live work is registered
in `SCOPE.md` in the same pass that opens its FID. Nothing in this directory is
itself approved scope.

## Current contents (2026-10-09)

| Order | State |
|---|---|
| [`BO-2026-08-23-git-workflow-enforcement.md`](BO-2026-08-23-git-workflow-enforcement.md) | PARTIALLY EXECUTED — Phase 0 + FIDs 1–3 shipped; FID 4 (G2/G5 preflight audit) and Phase 2 migration open |
| [`BO-2026-09-08-eval-runner-model-override-and-usage-telemetry.md`](BO-2026-09-08-eval-runner-model-override-and-usage-telemetry.md) | OPEN — 0 of 7 items; no `RunnerConfig.model`, no `usage` event |
| [`BO-2026-09-16-atria-friction.md`](BO-2026-09-16-atria-friction.md) | HANDOFF — Atria feature shipped; P1 and P5 friction points still reproducible, no FID |

The remaining seven records were archived 2026-10-07 after their terminal state
was verified against the working tree.

The [model-compliance telemetry order](archive/BO-2026-08-24-model-compliance-telemetry.md)
was completed and archived 2026-10-09: all seven phases are implemented and
verified under `FID-2026-1007-012`.
