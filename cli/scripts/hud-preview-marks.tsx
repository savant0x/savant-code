import React from 'react'

import { SAVANT_ICON_PNG_DATA_URI } from '../src/constants/savant-icons'
import { useTheme } from '../src/hooks/use-theme'

import type { HudArt } from './hud-preview-components'
import type { SavantIconName } from '../src/constants/savant-icons'

// Move-only seam for the formatted preview's 300-line file ceiling.
export function HudMark({
  name,
  art,
  large = false,
}: {
  name: SavantIconName
  art: HudArt
  large?: boolean
}) {
  const theme = useTheme()
  const [failed, setFailed] = React.useState(false)
  const source = React.useMemo(
    () => Buffer.from(SAVANT_ICON_PNG_DATA_URI[name].split(',')[1], 'base64'),
    [name],
  )
  const width = large ? 8 : 4
  const height = large ? 4 : 2
  if (art === 'text' || failed)
    return (
      <box
        width={width}
        height={height}
        alignItems="center"
        justifyContent="center"
      >
        <text fg={theme.primary}>{name === 'ICON_LogoS' ? '[S]' : '<>'}</text>
      </box>
    )
  return (
    <image
      source={source}
      width={width}
      height={height}
      protocol="blocks"
      fit="fit"
      onError={() => setFailed(true)}
    />
  )
}
