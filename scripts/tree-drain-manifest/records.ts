import type { DrainGroup } from '../tree-drain-manifest.js'

/**
 * Groups 18–24: the records wave — skills, FID archives, dev records, design
 * docs, root docs, the database split, and the tree-drain tooling itself.
 * Order here is commit order within this family; the parent manifest
 * concatenates the families in original order.
 */
export const RECORDS_GROUPS: DrainGroup[] = [
  {
    message: [
      'chore(fids): archive closed FID queue + register roadmap programs',
      '',
      'Archive the closed/waiver FIDs of the 08-21..08-26 drain (eval rebuild,',
      'desktop chain, recorder, deck trio, compaction series, quality ratchet',
      'records) + register the active roadmap programs (-0824-003..-008, -028,',
      '-030) + README manifest reconciliation.',
      '',
      'Governance records only; no product code.',
    ].join('\n'),
    paths: ['dev/fids'],
  },
  {
    message: [
      'chore(dev): session summaries + agenda + build orders + experience traces',
      '',
      'Session summaries 08-21..08-26, learning agenda, build orders (git-',
      'workflow enforcement, model-compliance telemetry), experience raw-',
      'traces ledger, idea-shelf + nova outbox records.',
      '',
      'Governance records only; no product code.',
    ].join('\n'),
    paths: [
      'dev/session-summaries',
      'dev/agenda.md',
      'dev/experiences',
      'dev/idea-shelf',
      'dev/nova/outbox/2026-08-21-fid-2026-0821-001-auto-compact-planning-audit-verdict.md',
      'dev/nova/outbox/2026-08-22-scroll-craft-native-skill-planning-audit.md',
      'dev/build-orders/BO-2026-08-24-model-compliance-telemetry.md',
      'dev/LEARNING-RULES.md',
    ],
  },
  {
    message: [
      'docs(root): changelog + readme + governance docs sync',
      '',
      'CHANGELOG closure entries for the 08-21..08-26 drain, README feature/',
      'install refresh, AGENTS.md/ARCHITECTURE.md/NOTICE sync for the eval-',
      'rebuild + desktop + harness work.',
      '',
      'Docs only.',
    ].join('\n'),
    paths: [
      'CHANGELOG.md',
      'README.md',
      'AGENTS.md',
      'ARCHITECTURE.md',
      'NOTICE',
    ],
  },
  {
    message: [
      'chore(scripts): add tree-drain migration tooling',
      '',
      'Manifest-driven path-scoped committer (G3/G4/G8) used to drain the',
      'v0.0.27 → v0.0.28 backlog into atomic per-FID/area commits.',
      '',
      'BO-2026-08-23-git-workflow-enforcement (mechanical track).',
    ].join('\n'),
    paths: [
      'scripts/tree-drain.ts',
      'scripts/tree-drain-manifest.ts',
      'scripts/tree-drain-manifest',
    ],
  },
  {
    message: [
      'docs(dev): context-window review + T82-I pre-push rewrite build order',
      '',
      'The context-window metadata audit filed in docs/, and the build order',
      'recording the executed 13-commit pre-push rewrite that cleared the',
      'v0.0.33 credential-scan block. The idea-farm competitive audit is',
      'deliberately NOT published (gitignored).',
      '',
      'Scope: SCOPE.md Task 82 → T82-I.',
    ].join('\n'),
    paths: [
      'docs/Model Context Window Review.md',
      'dev/build-orders/BO-2026-09-22-pre-push-rewrite.md',
    ],
  },
]
