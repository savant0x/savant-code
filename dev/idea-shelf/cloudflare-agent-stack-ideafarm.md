<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Idea-Farm — Cloudflare Agent Stack (computer + cloudflare-os)

**Logged:** 2026-08-15
**Status:** SHELVED — idea-farm only, no implementation planned. Useful for a later roadmap look if Savant-Code needs durable-state / multi-runtime / collaborative surfaces.
**Source repos (cloned to `dev/resources/`):**
- `cloudflare/computer` — 72K LOC TS, MIT. `@cloudflare/computer` agent runtime: SQLite-backed VFS + 3 pluggable runtimes (isolate shell / JS worker / container FUSE).
  - GitHub: https://github.com/cloudflare/computer
  - Blog: https://blog.cloudflare.com/cloudflare-computer/
  - Local clone: `dev/resources/computer/`
- `cloudflare/cloudflare-os` — 23M, Apache-2.0. "AI productivity OS": agent chat UI + sandboxed app-building + Gatekeepers security framework. Yjs for agent/client code-sync.
  - GitHub: https://github.com/cloudflare/cloudflare-os
  - Blog (Agents Week): https://blog.cloudflare.com/agents-week-in-review/
  - Local clone: `dev/resources/cloudflare-os/`
**Reviewed:** `dofs/src/schema/core.ts` (SQLite FS schema), `computer/src/workspace.ts` (exec runtime facade), `cloudflare-os/README.md` + Yjs usage in `workshop-backend`.

---

## What they actually built (beyond the blog/video)

### computer — "give your agent a computer"
- **Filesystem IS SQLite.** `dofs` package: `vfs_nodes` (inode graph), `vfs_dirents` (WITHOUT ROWID, PK `(parent_inode, name)` → direct child_inode leaf read), `vfs_chunks` (inode, idx, hash), `vfs_blob_bytes` (hash → bytes). **Content-addressed blob store** — same bytes = same hash = dedup.
- **`WITHOUT ROWID` hot tables.** `vfs_dirents` + `vfs_chunks` clustered on composite PK, no rowid indirection, covering reads. Mature DB optimization, documented *why*.
- **Incremental schema versioning.** SCHEMA_VERSION=5, each bump documented with reason (v3 added cached `size` col so stat() doesn't SUM chunks; v5 made dirents/chunks WITHOUT ROWID). Migration list in `schema/migrations.ts`.
- **Three runtimes, one source of truth.** `workspace.runtime.exec(source, backendId)` — isolate shell (V8, ms start), JS worker (dynamic worker, ES module eval), container (FUSE-mounts same SQLite state, syncs back via Cap'n Proto RPC). Lazy backend connect.
- **Capability-based disposability.** `rpc` package (Cap'n Proto wire types). Object-capabilities, explicit `dispose()`, leak tracking in harness. Host owns persistence (`SyncRetryScheduler`) because the lib can't own a DO alarm.
- **Benchmark:** DB-backed FS beats container XT4 disk on metadata — del 1000 files 34% faster, walk tree 28% faster, git commit 28% faster. Tradeoff: large sequential IO slower (content-hash per chunk).

### cloudflare-os — "AI productivity OS"
- Agent chat UI preloaded with company context; sandboxed "gadgets" (small apps); **Gatekeepers** = guardrail framework for agents+apps (non-technical users "go nuts" safely).
- **Yjs** (`workshop-backend`) syncs code changes between clients/agents, replays histories. Multi-client collaborative editing of agent work.

---

## Portable patterns worth stealing (idea-level only)

| # | Pattern | From | Maps to Savant-Code | Portable? |
|---|---|---|---|---|
| P1 | **Content-addressed state chunks** (hash→bytes, dedup) | dofs | `packages/knowledge-graph`, session snapshots, FID state — store chunks by hash instead of full copies per step → cheaper long-run state | YES (DB-agnostic concept) |
| P2 | **WITHOUT ROWID covering-index** for deterministic lookups | dofs | call-graph edges, FID state tables, any (parent,child) PK lookup | YES (SQLite-specific, adopt if we use SQLite) |
| P3 | **Capability-based disposable compute** (state permanent, compute ephemeral, explicit dispose + leak-track) | computer | Already ECHO-aligned (loop state survives, agent run ephemeral). Borrow explicit `dispose()`/leak-tracking on execution backends | YES (pattern, not code) |
| P4 | **Incremental schema versioning w/ documented why** | dofs | `protocol.config.yaml` / CHANGELOG discipline — each schema bump explains reason | YES (process) |
| P5 | **Yjs-style collaborative replay** of agent edits | cloudflare-os | If Savant-Code ever gets remote/multi-client surface, replay agent edits deterministically | MAYBE (only if collaborative surface added) |
| P6 | **Gatekeepers-style guardrail framework** (non-technical safe-mode) | cloudflare-os | ECHO Laws already provide this for agents; a user-facing "safe mode" could mirror Gatekeepers | PARTIAL (ECHO covers agent side) |

## Explicitly NOT portable (Cloudflare-locked)
- Durable Objects, Workers, `workerd`, FUSE/Cap'n Proto RPC — the entire `computer` runtime depends on Cloudflare edge infra. Cannot drop `dofs`/`computerd` into a local-first/BYOK TS/Bun monorepo without ripping out the DO layer.
- `cloudflare-os` is a full product (chat UI + gadget runtime + gatekeepers) — far heavier than Savant-Code's scope; only the *patterns* (P5/P6) are relevant.

## Why not pressing
- Savant-Code runs locally (Bun/TS) + OR/BYOK. We solve *governance* (ECHO), not *hosting-scale compute* (Cloudflare's problem). The "state permanent / compute disposable" principle is already ours via ECHO — we don't need their infra to express it.
- P1/P2 (content-addressed state, WITHOUT ROWID) would only pay off if we hit state-storage pressure at scale — not a current pain.
- P5/P6 only matter if we add collaborative/remote surfaces or a user-safe-mode — not on the board.

## Re-activation trigger
When Savant-Code needs: (a) cheaper long-run state storage → revisit P1/P2; (b) multi-client/remote agent surface → revisit P5 (Yjs replay); (c) user-facing safe-mode → revisit P6 (Gatekeepers). Re-read `dev/resources/computer/packages/dofs/src/schema/core.ts` + `computer/src/workspace.ts` at that point.

## License note
Both MIT/Apache-2.0 — vendorable if ever needed, but idea-farm only for now. No code copied.
