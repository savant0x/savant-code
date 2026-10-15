import { childProcessToPromise } from './child-process'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { SavantCodeSpawn } from '@savant-code/common/types/spawn'

/**
 * Retrieves git changes for the project using the provided spawn function
 */
export async function getGitChanges(params: {
  cwd: string
  spawn: SavantCodeSpawn
  logger: Logger
}): Promise<{
  status: string
  diff: string
  diffCached: string
  lastCommitMessages: string
}> {
  const { cwd, spawn, logger } = params

  const status = childProcessToPromise(spawn('git', ['status'], { cwd }))
    .then(({ stdout }) => stdout)
    .catch((error) => {
      logger.debug?.({ error }, 'Failed to get git status')
      return ''
    })

  const diff = childProcessToPromise(spawn('git', ['diff'], { cwd }))
    .then(({ stdout }) => stdout)
    .catch((error) => {
      logger.debug?.({ error }, 'Failed to get git diff')
      return ''
    })

  const diffCached = childProcessToPromise(
    spawn('git', ['diff', '--cached'], { cwd }),
  )
    .then(({ stdout }) => stdout)
    .catch((error) => {
      logger.debug?.({ error }, 'Failed to get git diff --cached')
      return ''
    })

  const lastCommitMessages = childProcessToPromise(
    spawn('git', ['shortlog', 'HEAD~10..HEAD'], { cwd }),
  )
    .then(({ stdout }) =>
      stdout
        .trim()
        .split('\n')
        .slice(1)
        .reverse()
        .map((line) => line.trim())
        .join('\n'),
    )
    .catch((error) => {
      logger.debug?.({ error }, 'Failed to get lastCommitMessages')
      return ''
    })

  return {
    status: await status,
    diff: await diff,
    diffCached: await diffCached,
    lastCommitMessages: await lastCommitMessages,
  }
}
