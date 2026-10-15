import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { ensureCliTestEnv } from '../../__tests__/test-utils'

const OWNER_FILE = 'savant-free-instance-owner.json'

ensureCliTestEnv()

const { getConfigDir } = await import('../auth')
const {
  isSavantFreeInstanceOwnedByDeadLocalProcess,
  recordSavantFreeInstanceOwner,
} = await import('../savant-free-instance-owner')

describe('savant-free instance owner', () => {
  let originalHome: string | undefined
  let tempHome: string

  const ownerPath = () => path.join(getConfigDir(), OWNER_FILE)

  beforeEach(() => {
    originalHome = process.env.HOME
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-free-owner-'))
    process.env.HOME = tempHome
  })

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }
    fs.rmSync(tempHome, { recursive: true, force: true })
  })

  test('does not classify the current process as dead', () => {
    recordSavantFreeInstanceOwner('inst-current')

    expect(isSavantFreeInstanceOwnedByDeadLocalProcess('inst-current')).toBe(
      false,
    )
  })

  test('classifies a matching owner with a dead pid as dead', () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      ownerPath(),
      JSON.stringify({ instanceId: 'inst-dead', pid: 2_147_483_647 }),
    )

    expect(isSavantFreeInstanceOwnedByDeadLocalProcess('inst-dead')).toBe(true)
  })

  test('ignores a dead pid for a different instance id', () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      ownerPath(),
      JSON.stringify({ instanceId: 'inst-other', pid: 2_147_483_647 }),
    )

    expect(isSavantFreeInstanceOwnedByDeadLocalProcess('inst-current')).toBe(
      false,
    )
  })
})
