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
      'feat(skills): savant-motion + governance skills',
      '',
      'Native skills authored under the skill system: savant-motion (scroll-',
      'driven landing pages) with its fingerprint-gated engine, the',
      'fid-gates-unfenced-parser-contract + minisign-pubkey-vs-secret-key',
      'lessons (quarantined + trusted copies).',
      '',
      'FIDs: FID-2026-0823-001, FID-2026-0824-012.',
    ].join('\n'),
    paths: ['.agents/skills'],
  },
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
      'docs(design): research + design docs for v0.0.28 tree',
      '',
      'Design research and architecture docs: agents-as-contacts, cyberpunk',
      'holographic WebGL, design-system desktop integration, technical due',
      'diligence, visual workspace, self-improving architecture, context-',
      'compaction, plus the self-improving-harness + v0.0.28 release-notes.',
      '',
      'Docs only; sources for the roadmap programs and release.',
    ].join('\n'),
    paths: [
      'docs/design/Agents-as-Contacts Architecture Research.md',
      'docs/design/Agents-as-Contacts Command Surface - Gemini Deep Research Prompt.md',
      'docs/design/Cyberpunk Holographic WebGL Research.md',
      'docs/design/Design System Desktop Integration - Gemini Deep Research Prompt.md',
      'docs/design/Savant Code Technical Due Diligence.md',
      'docs/design/Savant Self-Improving Architecture Plan.md',
      'docs/design/Savant Visual Workspace Architecture.md',
      'docs/design/context-compaction.md',
      'docs/self-improving-harness.md',
      'docs/release-notes-v0.0.28.md',
      'docs/index.md',
      'docs/features.md',
      'docs/faq.md',
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
      'refactor(database): service domain split (sessions/history/sqlite)',
      '',
      'Manual decomposition of packages/database/src/service.ts: shared SQL',
      'machinery to sqlite.ts, session CRUD to sessions.ts, message-history +',
      'cost tracking to history.ts, re-exported from the original path.',
      '',
      'Quality-ratchet program (FID-2026-0819-005 QR-DS).',
    ].join('\n'),
    paths: [
      'packages/database/src/__tests__/service.test.ts',
      'packages/database/src/index.ts',
      'packages/database/src/service.ts',
      'packages/database/src/sessions.ts',
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
    paths: ['scripts/tree-drain.ts', 'scripts/tree-drain-manifest.ts'],
  },
]
