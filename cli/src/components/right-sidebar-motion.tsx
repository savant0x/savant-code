import { useRenderer } from '@opentui/react'
import React from 'react'

import { useAnimationTimeline } from '../hooks/use-animation-timeline'

/** A finite accent pulse; labels retain full contrast throughout. */
export function SidebarActivityAccent({
  kind,
  disabled,
  children,
}: {
  kind: string
  disabled: boolean
  children: (emphasized: boolean) => React.ReactNode
}) {
  const timeline = useAnimationTimeline({ duration: 200 })
  const renderer = useRenderer()
  const previous = React.useRef(kind)
  const [emphasized, setEmphasized] = React.useState(false)
  React.useEffect(() => {
    const changed = previous.current !== kind
    previous.current = kind
    timeline.pause()
    timeline.items.length = 0
    setEmphasized(false)
    if (!changed || disabled || kind === 'idle') return undefined
    setEmphasized(true)
    timeline.add(
      { t: 0 },
      {
        t: 1,
        duration: 200,
        once: true,
        onComplete: () => setEmphasized(false),
      },
    )
    timeline.restart()
    const stop = () => {
      timeline.pause()
      setEmphasized(false)
    }
    renderer.on('blur', stop)
    return () => {
      renderer.off('blur', stop)
      timeline.pause()
    }
  }, [kind, disabled, timeline, renderer])
  return <>{children(emphasized)}</>
}
