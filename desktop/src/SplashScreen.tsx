import type { JSX } from 'react'

interface SplashScreenProps {
  state: string
  detail: string | null
  bootError: string | null
}

type Tone = 'busy' | 'ok' | 'warn' | 'error'

interface StatusCopy {
  label: string
  hint: string
  tone: Tone
}

// Keys mirror supervisor LifecycleState::as_str values exactly, plus the
// renderer-local 'booting' state used before the first gateway-lifecycle
// event arrives. Unknown future states fall back to a neutral busy row.
const STATUS_COPY: Record<string, StatusCopy> = {
  booting: {
    label: 'Starting shell',
    hint: 'Requesting gateway configuration',
    tone: 'busy',
  },
  spawning: {
    label: 'Launching agent runtime',
    hint: 'Sidecar process starting',
    tone: 'busy',
  },
  ready: {
    label: 'Gateway ready',
    hint: 'Connecting to the session gateway',
    tone: 'ok',
  },
  'shutting-down': {
    label: 'Shutting down',
    hint: 'Stopping the agent runtime',
    tone: 'warn',
  },
  dead: {
    label: 'Runtime stopped',
    hint: 'The supervisor gave up or was asked to quit.',
    tone: 'error',
  },
}

function statusFor(state: string, detail: string | null): StatusCopy {
  const base = STATUS_COPY[state] ?? {
    label: state,
    hint: '',
    tone: 'busy' as Tone,
  }
  // A terminal state always carries the supervisor's own reason (crash
  // budget exhausted, clean-exit suppression, binary missing) — surface it.
  if (state === 'dead' && detail !== null) {
    return { ...base, hint: detail }
  }
  return base
}

export function SplashScreen(props: SplashScreenProps): JSX.Element {
  const status = statusFor(props.state, props.detail)

  return (
    <header className="splash">
      <div className="lights" aria-hidden="true">
        <span className="light light-cyan" />
        <span className="light light-green" />
        <span className="light light-amber" />
      </div>
      <h1 className="wordmark">Savant</h1>
      <p className="wordmark-sub">Desktop</p>

      {props.bootError !== null && (
        <section className="card card-error" role="alert">
          <p className="card-title">Shell could not start</p>
          <p className="card-body">{props.bootError}</p>
        </section>
      )}

      <p className={`splash-status tone-${status.tone}`}>
        {status.tone === 'busy' ? (
          <span className="ring" aria-hidden="true" />
        ) : null}
        <span className="status-text">{status.label}</span>
      </p>
      {status.hint === '' ? null : <p className="splash-hint">{status.hint}</p>}
    </header>
  )
}
