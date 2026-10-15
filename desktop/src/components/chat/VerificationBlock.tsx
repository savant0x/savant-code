import { memo } from 'react'

import type { VerificationEntry } from '../../lib/verification-output'
import type { JSX } from 'react'

const OUTPUT_LIMIT = 6000

function clampOutput(value: string): string {
  return value.length > OUTPUT_LIMIT
    ? `${value.slice(0, OUTPUT_LIMIT)}…`
    : value
}

function statusLabel(exitCode: number | null): string {
  if (exitCode === 0) return 'passed'
  if (exitCode === null) return 'running'
  return `failed · exit ${exitCode}`
}

export const VerificationBlock = memo(function VerificationBlock({
  entries,
}: {
  entries: VerificationEntry[]
}): JSX.Element {
  return (
    <div className="verification-block">
      {entries.map((entry, index) => (
        <section
          className="verification-entry"
          key={`${entry.command}-${index}`}
        >
          <div className="verification-head">
            <span
              className={`verification-status verification-${entry.exitCode === 0 ? 'pass' : entry.exitCode === null ? 'pending' : 'fail'}`}
            >
              {statusLabel(entry.exitCode)}
            </span>
            <code className="verification-command">$ {entry.command}</code>
          </div>
          {entry.stdout !== '' ? (
            <pre className="verification-output">
              {clampOutput(entry.stdout)}
            </pre>
          ) : null}
          {entry.stderr !== '' ? (
            <pre className="verification-output verification-stderr">
              {clampOutput(entry.stderr)}
            </pre>
          ) : null}
        </section>
      ))}
    </div>
  )
})
