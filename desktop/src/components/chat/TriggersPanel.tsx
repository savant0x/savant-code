// FID-2026-0824-005 step 5 — Triggers rail panel: configuration region +
// calendar receipts. Presentation logic is PURE and exported for tests (the
// FidQueuePanel pattern); the component consumes the GatewayClient methods
// via a narrow prop surface so tests inject fakes (DI, never module mocks).

import { useCallback, useEffect, useState } from 'react'

import type {
  CreatedTriggerInfo,
  TriggerRecord,
} from '../../lib/gateway-protocol'
import type { JSX } from 'react'

/** The panel's view of the gateway client — the five trigger methods. */
export type TriggersApi = {
  triggersList: () => Promise<TriggerRecord[]>
  triggersCreate: (params: {
    name: string
    recurrence?: string
  }) => Promise<CreatedTriggerInfo>
  triggersSetRecurrence: (
    triggerId: string,
    recurrence: string | null,
  ) => Promise<{ updated: boolean }>
  triggersSetEnabled: (
    triggerId: string,
    enabled: boolean,
  ) => Promise<{ updated: boolean }>
  triggersDelete: (triggerId: string) => Promise<{ deleted: boolean }>
}

/** Calendar-receipt line for one trigger: schedule + last/next fire times. */
export function triggerReceiptLine(trigger: TriggerRecord): string {
  if (!trigger.recurrence) return 'webhook-only'
  const next = trigger.nextRunAt ? new Date(trigger.nextRunAt) : null
  const nextText =
    next && !Number.isNaN(next.getTime())
      ? next.toLocaleString()
      : 'unscheduled'
  return `${trigger.recurrence} · next ${nextText}`
}

/** Relative "last fired" text (calendar receipt), or a never-fired note. */
export function lastFiredText(
  lastFiredAt: string | undefined,
  now: Date = new Date(),
): string {
  if (!lastFiredAt) return 'never fired'
  const then = new Date(lastFiredAt)
  if (Number.isNaN(then.getTime())) return 'never fired'
  const deltaMs = now.getTime() - then.getTime()
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** Create-form validation: name required; recurrence either empty (webhook)
 *  or a plausible 5-field cron (light client check — the store is the
 *  authority and fails closed). */
export function validateCreateForm(form: {
  name: string
  recurrence: string
}): string | null {
  if (!form.name.trim()) return 'Name is required'
  const recurrence = form.recurrence.trim()
  if (recurrence && recurrence.split(/\s+/).length !== 5) {
    return 'Recurrence must be a 5-field cron expression'
  }
  return null
}

const REFRESH_INTERVAL_MS = 30_000

export const TriggersPanel = function TriggersPanel({
  api,
  enabled: featureEnabled,
}: {
  api: TriggersApi
  /** Whether the server exposes trigger management (SAVANT_TRIGGERS=1). */
  enabled: boolean
}): JSX.Element {
  const [triggers, setTriggers] = useState<TriggerRecord[]>([])
  const [available, setAvailable] = useState(featureEnabled)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [recurrence, setRecurrence] = useState('')
  const [secretOnce, setSecretOnce] = useState<CreatedTriggerInfo | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const list = await api.triggersList()
      setTriggers(list)
      setAvailable(true)
      setError(null)
    } catch (cause) {
      // Feature off on the server (or transport gone): degrade to a quiet
      // unavailable card, never an error wall.
      setAvailable(false)
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [api])

  useEffect(() => {
    if (!featureEnabled) return
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [featureEnabled, refresh])

  const onCreate = useCallback(async () => {
    const invalid = validateCreateForm({ name, recurrence })
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    try {
      const created = await api.triggersCreate({
        name: name.trim(),
        ...(recurrence.trim() ? { recurrence: recurrence.trim() } : {}),
      })
      // Secret shown exactly once, in the panel, until dismissed.
      setSecretOnce(created)
      setName('')
      setRecurrence('')
      setError(null)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }, [api, name, recurrence, refresh])

  const onToggle = useCallback(
    async (trigger: TriggerRecord) => {
      setBusy(true)
      try {
        await api.triggersSetEnabled(trigger.id, !trigger.enabled)
        await refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        setBusy(false)
      }
    },
    [api, refresh],
  )

  const onDelete = useCallback(
    async (trigger: TriggerRecord) => {
      setBusy(true)
      try {
        await api.triggersDelete(trigger.id)
        await refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        setBusy(false)
      }
    },
    [api, refresh],
  )

  if (!featureEnabled || !available) {
    return (
      <aside className="triggers-panel" aria-label="Triggers unavailable">
        <div className="triggers-head">
          <span className="triggers-title">Triggers</span>
        </div>
        <p className="triggers-empty">
          Webhook + schedule triggers are off on this server (SAVANT_TRIGGERS=1
          enables them).
        </p>
      </aside>
    )
  }

  return (
    <aside className="triggers-panel" aria-label="Triggers">
      <div className="triggers-head">
        <span className="triggers-title">Triggers</span>
        <span className="triggers-count">{triggers.length}</span>
      </div>

      {error !== null && <p className="triggers-error">{error}</p>}

      <ul className="triggers-list">
        {triggers.map((trigger) => (
          <li
            key={trigger.id}
            className={`trigger-row${trigger.enabled ? '' : ' trigger-disabled'}`}
          >
            <div className="trigger-main">
              <span className="trigger-name">{trigger.name}</span>
              <span className="trigger-receipt" title={trigger.nextRunAt ?? ''}>
                {triggerReceiptLine(trigger)}
              </span>
              <span className="trigger-last">
                last fired {lastFiredText(trigger.lastFiredAt)}
              </span>
            </div>
            <div className="trigger-actions">
              <button
                type="button"
                className="trigger-btn"
                disabled={busy}
                onClick={() => void onToggle(trigger)}
              >
                {trigger.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                className="trigger-btn trigger-danger"
                disabled={busy}
                onClick={() => void onDelete(trigger)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {triggers.length === 0 && (
          <li className="triggers-empty">
            No triggers yet — create one below.
          </li>
        )}
      </ul>

      {secretOnce !== null && (
        <div className="trigger-secret-once">
          <p className="trigger-secret-label">
            Secret for <strong>{secretOnce.name}</strong> — shown ONCE:
          </p>
          <code className="trigger-secret-value">{secretOnce.secret}</code>
          <button
            type="button"
            className="trigger-btn"
            onClick={() => setSecretOnce(null)}
          >
            I saved it
          </button>
        </div>
      )}

      <div className="trigger-create">
        <input
          className="trigger-input"
          placeholder="Name (e.g. github-ci)"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className="trigger-input"
          placeholder="Cron (optional, e.g. */5 * * * *)"
          value={recurrence}
          onChange={(event) => setRecurrence(event.target.value)}
        />
        <button
          type="button"
          className="trigger-btn trigger-create-btn"
          disabled={busy}
          onClick={() => void onCreate()}
        >
          Create trigger
        </button>
      </div>
    </aside>
  )
}
