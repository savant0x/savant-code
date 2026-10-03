import { randomUUID } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import { mergeProviderNoticeState } from '@savant-code/common/providers/provider-notice-merge'
import {
  emptyProviderNoticeState,
  providerNoticeStoreSchema,
  type ProviderNoticeState,
} from '@savant-code/common/providers/provider-notifications'

import { getConfigDir } from './config-dir'
import { writeFileAtomic } from './write-file-atomic'

const LEASE_MS = 10_000
export class ProviderNoticeStorage {
  private pending: ProviderNoticeState | undefined
  private memory: ProviderNoticeState | undefined
  private profile = ''
  constructor(
    private readonly dir?: string,
    private readonly now = Date.now,
  ) {}
  private get directory(): string {
    return this.dir ?? getConfigDir()
  }
  private get file(): string {
    return join(this.directory, 'provider-notifications.json')
  }
  read(): ProviderNoticeState {
    if (!existsSync(this.file)) return emptyProviderNoticeState()
    const result = providerNoticeStoreSchema.safeParse(
      JSON.parse(readFileSync(this.file, 'utf8')),
    )
    if (!result.success)
      throw new Error(
        'Provider notification store needs recovery; original file retained.',
      )
    return result.data
  }
  presentation(): ProviderNoticeState {
    this.ensureProfile()
    try {
      this.memory = mergeProviderNoticeState(this.read(), this.pending)
    } catch {
      this.memory = this.withDiagnostic(
        this.memory ?? emptyProviderNoticeState(),
      )
    }
    return this.memory ?? emptyProviderNoticeState()
  }
  stage(
    change: (state: ProviderNoticeState) => ProviderNoticeState,
  ): ProviderNoticeState {
    this.ensureProfile()
    try {
      return this.update(change)
    } catch {
      const next = change(this.presentation())
      this.withDiagnostic(next)
      this.pending = next
      this.memory = next
      return next
    }
  }
  private withDiagnostic(next: ProviderNoticeState): ProviderNoticeState {
    if (!next.notices.some((n) => n.id === 'notice-storage-diagnostic'))
      next.notices.push({
        id: 'notice-storage-diagnostic',
        revision: next.revision,
        providerId: 'monitor',
        kind: 'summary',
        severity: 'warning',
        episode: 1,
        createdAt: this.now(),
        selected: true,
        unread: true,
        dismissed: false,
        acceptedBy: [],
        message:
          'Provider notification storage is unavailable. Updates remain pending in this process; original durable data is retained and delivery will retry.',
      })
    return next
  }
  private ensureProfile(): void {
    if (this.profile === this.directory) return
    this.profile = this.directory
    this.pending = undefined
    this.memory = undefined
  }
  /** A lease serializes read/merge/write across CLI and desktop processes. */
  update(
    change: (state: ProviderNoticeState) => ProviderNoticeState,
  ): ProviderNoticeState {
    this.ensureProfile()
    mkdirSync(this.directory, { recursive: true })
    const lock = `${this.file}.lease`
    const token = `${this.now()}:${process.pid}:${randomUUID()}`
    this.acquire(lock, token)
    try {
      const state = change(mergeProviderNoticeState(this.read(), this.pending))
      for (const notice of state.notices)
        if (notice.id === 'notice-storage-diagnostic' && !notice.resolved) {
          notice.resolved = true
          notice.revision = ++state.revision
        }
      if (readFileSync(lock, 'utf8') !== token)
        throw new Error('Provider notification lease lost')
      writeFileAtomic(
        this.file,
        JSON.stringify(providerNoticeStoreSchema.parse(state)),
      )
      this.pending = undefined
      this.memory = state
      return state
    } finally {
      if (existsSync(lock) && readFileSync(lock, 'utf8') === token)
        unlinkSync(lock)
    }
  }
  /** A fresh baseline may recover corruption without destroying the diagnostic bytes. */
  recover(): void {
    const lock = `${this.file}.lease`
    const token = `${this.now()}:${process.pid}:${randomUUID()}`
    this.acquire(lock, token)
    try {
      try {
        this.read()
        return
      } catch {
        /* Valid writers never reach this branch. */
      }
      copyFileSync(this.file, `${this.file}.${randomUUID()}.corrupt`)
      writeFileAtomic(this.file, JSON.stringify(emptyProviderNoticeState()))
    } finally {
      if (existsSync(lock) && readFileSync(lock, 'utf8') === token)
        unlinkSync(lock)
    }
  }
  private acquire(lock: string, token: string): void {
    try {
      writeFileSync(lock, token, { flag: 'wx', mode: 0o600 })
      return
    } catch (error) {
      if (!existsSync(lock)) throw error
      // The timestamp is part of the token, so an old owner cannot release a new lease.
      const current = readFileSync(lock, 'utf8')
      const timestamp = Number(current.split(':')[0])
      if (!Number.isFinite(timestamp) || this.now() - timestamp <= LEASE_MS)
        throw new Error('Provider notification writer busy; retry later')
      const pid = Number(current.split(':')[1])
      try {
        process.kill(pid, 0)
        throw new Error('Provider notification writer remains active')
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !('code' in error) ||
          error.code !== 'ESRCH'
        )
          throw error
      }
      const stale = `${lock}.${randomUUID()}.stale`
      const recovery = `${lock}.${current.split(':')[2]}.recover`
      writeFileSync(recovery, token, { flag: 'wx', mode: 0o600 })
      try {
        if (!existsSync(lock) || readFileSync(lock, 'utf8') !== current)
          throw new Error('Provider notification writer changed; retry later')
        renameSync(lock, stale)
        unlinkSync(stale)
        writeFileSync(lock, token, { flag: 'wx', mode: 0o600 })
      } finally {
        unlinkSync(recovery)
      }
    }
  }
}
