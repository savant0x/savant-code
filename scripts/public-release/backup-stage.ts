// FID-2026-0905-009 — release pipeline backup stage.
//
// BACKUP_BUNDLE stage: writes the verified incremental bundle
// (`last-backup..main`) to the OneDrive-synced destination via
// runBundleBackup (FID-2026-0905-008) BEFORE the GitHub release and npm
// publishes run — the pipeline owns the last durable copy of the release
// commit, so a backup failure aborts the release (fail-closed). The
// backup core guarantees the `last-backup` marker advances only after
// `git bundle verify` passes; baseline mode is operator-run only and is
// never invoked here. Resume-aware: a completed stage skips the backup
// entirely; a pre-009 receipt (GITHUB_RELEASE complete, BACKUP_BUNDLE
// absent) runs the incremental for real — that commit was pushed with no
// backup, and retro-marking would skip durability where it is missing.

import { runBundleBackup } from '../git-bundle-backup'
import { fail } from './fail'
import { isStageComplete, markStage } from './receipts'

import type { TransactionContext } from './catalog'

export function runBackupBundleStage(ctx: TransactionContext): void {
  if (isStageComplete(ctx.receipt, 'BACKUP_BUNDLE')) return
  let result: ReturnType<typeof runBundleBackup>
  try {
    result = runBundleBackup({ cwd: ctx.root, mode: 'incremental' })
  } catch (error) {
    // The core throws fail-closed on preconditions (no marker, unusable
    // destination); translate into the uniform stage abort so the receipt's
    // failedStage carries the BACKUP_BUNDLE context either way.
    fail(
      `BACKUP_BUNDLE failed (release commit not durably backed up; marker NOT advanced): ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!result.ok) {
    fail(
      `BACKUP_BUNDLE failed (release commit not durably backed up; marker NOT advanced): ${result.message}`,
    )
  }
  markStage(ctx.receipt, 'BACKUP_BUNDLE')
  console.log(`  backup: ${result.message}`)
}
