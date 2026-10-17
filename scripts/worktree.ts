/** Operator mirror of fid_worktree. Explicit exec injects lane-only environment. */
import { spawnSync } from 'node:child_process'

import { buildFidWorktreeEnvironment } from '@savant-code/agent-runtime/echo/parallel/fid-worktree-environment'
import { isRegisteredFidWorktree } from '@savant-code/agent-runtime/echo/parallel/fid-worktree-jurisdiction'
import { findFidWorktreeRecord } from '@savant-code/agent-runtime/echo/parallel/fid-worktree-record'
import { runFidWorktreeAction } from '@savant-code/agent-runtime/echo/parallel/fid-worktree-service'
import { fidWorktreeInputSchema } from '@savant-code/common/tools/params/tool/fid-worktree'

import { buildChildEnv } from '../sdk/src/env'

export async function runWorktreeCli(
  args: string[],
  repoRoot = process.cwd(),
): Promise<number> {
  const [action, flag, fidId, ...rest] = args
  if (action === 'exec') {
    if (flag !== '--fid' || !fidId || rest[0] !== '--' || !rest[1]) {
      console.error(
        'Usage: bun scripts/worktree.ts exec --fid FID-YYYY-MMDD-NNN -- <executable> [args]',
      )
      return 1
    }
    const record = findFidWorktreeRecord(repoRoot, fidId)
    if (!record || !isRegisteredFidWorktree(repoRoot, record)) {
      console.error('No registered FID worktree; execution refused')
      return 1
    }
    try {
      const result = spawnSync(rest[1], rest.slice(2), {
        cwd: record.path,
        env: buildChildEnv(buildFidWorktreeEnvironment(record)),
        stdio: 'inherit',
        shell: false,
        windowsHide: true,
      })
      return result.status ?? 1
    } catch {
      console.error(
        'Lane command could not start with its isolated environment',
      )
      return 1
    }
  }
  const parsed = fidWorktreeInputSchema.safeParse(
    action === 'list' && args.length === 1
      ? { action }
      : flag === '--fid' &&
          rest.every((item) => item === '--discard-changes') &&
          rest.length <= 1
        ? {
            action,
            fid_id: fidId,
            ...(rest.length ? { discard_changes: true } : {}),
          }
        : null,
  )
  if (!parsed.success) {
    console.error(
      'Usage: bun scripts/worktree.ts <create|merge|dispose> --fid FID-YYYY-MMDD-NNN [--discard-changes], or list',
    )
    return 1
  }
  const result = await runFidWorktreeAction(repoRoot, parsed.data)
  console.log(JSON.stringify(result, null, 2))
  return result.ok ? 0 : 1
}

if (import.meta.main)
  process.exitCode = await runWorktreeCli(process.argv.slice(2))
