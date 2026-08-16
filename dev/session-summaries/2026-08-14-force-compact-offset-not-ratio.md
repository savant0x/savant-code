<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Session Summary — 2026-08-14 — force-compact trigger re-expressed as a fixed window offset

## Scope

FID-2026-0814-013 (severity: low) — follow-on to FID-2026-0814-012. The force
compaction tier was `maxContextLength × 0.9`, so its headroom below the hard
limit grew linearly with the window (12.8k @ 128k → 40k @ 400k). Re-expressed
as a fixed token offset so the force tier keeps a constant 15k margin
regardless of window size.

## Change

- Renamed the config key `compression.forceCompactRatio` →
  `compression.forceCompactOffset` (default `15_000` tokens) across all five
  layers: `protocol.config.yaml`, `common/src/util/protocol-config.ts`
  (interface/default/parse/assign), the SDK + CLI run-config `compression`
  shapes, and the savant `handleSteps` factory (`agents/savant/savant.ts`).
- Switched the serialized generator trigger from
  `forceDue = contextTokenCount > maxContextLength * forceRatio` to
  `forceDue = contextTokenCount > maxContextLength - forceCompactOffset`
  (subtraction, baked as a literal), including the debug-log field rename.
- `autoCompactRatio` (0.8) stays a ratio — proactive compaction is legitimately
  a fraction of the window; only the hard-limit force tier needs a fixed margin.
- Regenerated both generated bundles (`protocol-bundle.generated.ts` via
  `generate:protocol-bundle`, `bundled-agents.generated.ts` via
  `prebuild:agents`), updated `docs/sdk-overview.md` and the Token-Optimization
  design doc, and updated the `protocol-config` + `context-pruner-phase3` test
  suites to the new unit.

## Verification

- Typecheck ×5 (sdk, common, agent-runtime, cli, agents) — clean.
- Tests: common 610/4skip/0fail · agents 54/0 · agent-runtime 963/0 · sdk
  548/1skip/0fail · cli 3071/18skip/0fail.
- ESLint `--max-warnings 0`, `lint:md`, Prettier, `validate:repository` PASS,
  protocol-bundle drift clean.
- Law 4 absence check: `forceCompactRatio` has 0 live-source matches (only
  archival records and the FID's own RED evidence quote the old name).

## Closure

- FID-2026-0814-013 → `closed`, archived at
  `dev/fids/archive/FID-2026-0814-013-force-compact-offset-not-ratio.md`.
- CHANGELOG entry, `dev/fids/README.md`, and `dev/fids/archive/README.md`
  updated. Active queue is empty.

No commit, push, release, publication, or deployment was performed.
