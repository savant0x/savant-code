// FID-2026-0824-005 — trigger store. Secrets are shown ONCE at creation and
// stored hashed; verification re-hashes and compares constant-time (the same
// SHA-256 + timingSafeEqual discipline as the gateway auth). Persistence is a
// JSON file under the CLI config dir (triggers are CONFIG, not durable run
// state — the goal engine owns durable state; YAGNI).

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { safeTokenEqual } from '../auth'
import { isValidCron, nextOccurrence } from './cron'

export function hashTriggerSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

export type StoredTrigger = {
  id: string
  name: string
  /** SHA-256 hex of the secret — the plaintext never touches disk. */
  secretHash: string
  createdAt: string
  lastFiredAt?: string
  /** 5-field cron expression (server-local time); absent = webhook-only. */
  recurrence?: string
  /** Scheduler cursor: the next scheduled occurrence (ISO). Absent = the
   *  scheduler falls back to createdAt as the resume base. */
  nextRunAt?: string
  /** Step 5: enabled/disabled switch (the rail panel's pause control).
   *  Absent on legacy records — treated as enabled. */
  enabled?: boolean
}

/** The creation-time record: the only place the plaintext secret exists. */
export type CreatedTrigger = {
  id: string
  name: string
  secret: string
  createdAt: string
}

type StoreFile = { triggers: StoredTrigger[] }

function generateTriggerId(): string {
  return `trg_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}

function generateTriggerSecret(): string {
  return `svt_${crypto.randomBytes(24).toString('base64url')}`
}

export class TriggerStore {
  private readonly file: string
  private triggers: StoredTrigger[]

  constructor(file: string) {
    this.file = file
    this.triggers = this.load()
  }

  private load(): StoredTrigger[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as StoreFile
      return Array.isArray(parsed.triggers) ? parsed.triggers : []
    } catch {
      return []
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    fs.writeFileSync(
      this.file,
      `${JSON.stringify({ triggers: this.triggers }, null, 2)}\n`,
    )
  }

  create(input: { name: string; recurrence?: string }): CreatedTrigger {
    const name = input.name.trim()
    if (!name) throw new Error('Trigger name is required')
    if (this.triggers.some((t) => t.name === name)) {
      throw new Error(`Trigger name already exists: ${name}`)
    }
    // Validate the schedule BEFORE any mutation — a failed create must
    // never leave a half-record behind (atomic create, step 5).
    let recurrence: string | undefined
    let nextRunAt: string | undefined
    if (input.recurrence !== undefined) {
      if (!isValidCron(input.recurrence)) {
        throw new Error(`Invalid cron expression: ${input.recurrence}`)
      }
      const first = nextOccurrence(input.recurrence, new Date())
      if (!first) {
        throw new Error(
          `Cron expression never fires within the scan bound: ${input.recurrence}`,
        )
      }
      recurrence = input.recurrence
      nextRunAt = first.toISOString()
    }
    const secret = generateTriggerSecret()
    const record: StoredTrigger = {
      id: generateTriggerId(),
      name,
      secretHash: hashTriggerSecret(secret),
      createdAt: new Date().toISOString(),
      enabled: true,
    }
    if (recurrence !== undefined) {
      record.recurrence = recurrence
      record.nextRunAt = nextRunAt
    }
    this.triggers.push(record)
    this.persist()
    return {
      id: record.id,
      name: record.name,
      secret,
      createdAt: record.createdAt,
    }
  }

  list(): readonly StoredTrigger[] {
    return this.triggers
  }

  verify(triggerId: string, secret: string): boolean {
    const trigger = this.triggers.find((t) => t.id === triggerId)
    if (!trigger) return false
    return safeTokenEqual(trigger.secretHash, hashTriggerSecret(secret))
  }

  delete(triggerId: string): boolean {
    const before = this.triggers.length
    this.triggers = this.triggers.filter((t) => t.id !== triggerId)
    const changed = this.triggers.length !== before
    if (changed) this.persist()
    return changed
  }

  rotate(triggerId: string): CreatedTrigger | null {
    const trigger = this.triggers.find((t) => t.id === triggerId)
    if (!trigger) return null
    const secret = generateTriggerSecret()
    trigger.secretHash = hashTriggerSecret(secret)
    this.persist()
    return {
      id: trigger.id,
      name: trigger.name,
      secret,
      createdAt: trigger.createdAt,
    }
  }

  markFired(triggerId: string): void {
    const trigger = this.triggers.find((t) => t.id === triggerId)
    if (!trigger) return
    trigger.lastFiredAt = new Date().toISOString()
    this.persist()
  }

  /**
   * FID-2026-0824-005 step 3 (v1 amendment: recurrence lives on trigger
   * records, not goal metadata — the goal engine is not wired to the
   * trigger path yet). Validates fail-closed at set time and computes the
   * first nextRunAt cursor from the real clock. Pass null to clear (back
   * to webhook-only). Returns false when the trigger id is unknown.
   */
  setRecurrence(triggerId: string, recurrence: string | null): boolean {
    const trigger = this.triggers.find((t) => t.id === triggerId)
    if (!trigger) return false
    if (recurrence === null) {
      delete trigger.recurrence
      delete trigger.nextRunAt
      this.persist()
      return true
    }
    if (!isValidCron(recurrence)) {
      throw new Error(`Invalid cron expression: ${recurrence}`)
    }
    const next = nextOccurrence(recurrence, new Date())
    if (!next) {
      throw new Error(
        `Cron expression never fires within the scan bound: ${recurrence}`,
      )
    }
    trigger.recurrence = recurrence
    trigger.nextRunAt = next.toISOString()
    this.persist()
    return true
  }

  /** Scheduler cursor advance (used by the evaluator, not the operator). */
  setRecurrenceNextRunAt(triggerId: string, nextRunAt: string): void {
    const trigger = this.triggers.find((t) => t.id === triggerId)
    if (!trigger) return
    trigger.nextRunAt = nextRunAt
    this.persist()
  }

  /** Step 5: enable/disable switch (the rail panel's pause control).
   *  Disabled triggers skip scheduled fires entirely; webhook deliveries
   *  are unaffected (they are authenticated by secret, not by schedule).
   *  Returns false when the trigger id is unknown. */
  setEnabled(triggerId: string, enabled: boolean): boolean {
    const trigger = this.triggers.find((t) => t.id === triggerId)
    if (!trigger) return false
    trigger.enabled = enabled
    this.persist()
    return true
  }
}
