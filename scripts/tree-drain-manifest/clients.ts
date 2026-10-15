import type { DrainGroup } from '../tree-drain-manifest.js'

/**
 * Groups 14–17: the client wave — cli skills/tool-rendering, the session-
 * gateway server, chat-UI hardening, and the desktop app. Order here is
 * commit order within this family; the parent manifest concatenates the
 * families in original order.
 */
export const CLIENT_GROUPS: DrainGroup[] = [
  {
    message: [
      'feat(desktop): Tauri desktop app — gateway, floor, deck, updater',
      '',
      'Full desktop workspace: Tauri shell + Rust supervisor/sidecar, session-',
      'gateway client, chat UI + auto-drive dashboard, workspace regions,',
      'holographic command deck + live event driver + robot cast, consent-gated',
      'updater with pinned minisign pubkey, CI workflows, favicon assets.',
      '',
      'FIDs: FID-2026-0820-007 master + children -008/-009/-010/-011/-012/-014,',
      'FID-2026-0824-011, FID-2026-0824-032, FID-2026-0824-033.',
    ].join('\n'),
    paths: [
      'desktop',
      '.github/workflows/desktop-ci.yml',
      '.github/workflows/desktop-release.yml',
      'assets/favicon',
    ],
  },
  {
    message: [
      'feat(cli): provider quota surfaces + health command coverage',
      '',
      'Provider quota module + its suite, and the health-command provider-quota',
      'test.',
      '',
      'FID: FID-2026-0919-016.',
    ].join('\n'),
    paths: [
      'cli/src/utils/provider-quota.ts',
      'cli/src/utils/__tests__/provider-quota.test.ts',
      'cli/src/commands/__tests__/health-provider-quota.test.ts',
    ],
  },
]
