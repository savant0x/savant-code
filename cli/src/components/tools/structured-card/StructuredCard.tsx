import React from 'react'

import { classifyPayload, unwrapParts } from './classify'
import { ErrorCard } from './ErrorCard'
import { ListCard } from './ListCard'
import { RecordCard } from './RecordCard'
import { SuccessCard } from './SuccessCard'

import type { ChatTheme } from '../../../types/theme-system'

interface StructuredCardProps {
  /**
   * Serialized tool-result parts (`toolBlock.outputRaw` — the same array
   * `formatToolOutput` consumes) or a bare parsed JSON payload.
   */
  parts: unknown
  theme: ChatTheme
}

/**
 * FID-2026-0822-014 dispatcher: unwrap + classify the payload shape and
 * mount the matching card inside the caller's TrafficLightPanel chrome.
 * Empty payloads render nothing (preserves prior empty-output behavior);
 * unknown shapes fail open to the always-valid RecordCard.
 */
export function StructuredCard({
  parts,
  theme,
}: StructuredCardProps): React.ReactNode {
  const value = unwrapParts(parts)
  switch (classifyPayload(value)) {
    case 'empty':
      return null
    case 'error':
      return <ErrorCard value={value ?? null} theme={theme} />
    case 'success':
      return <SuccessCard value={value ?? null} theme={theme} />
    case 'list':
      return <ListCard value={value ?? []} theme={theme} />
    case 'record':
      return <RecordCard value={value ?? null} theme={theme} />
  }
}
