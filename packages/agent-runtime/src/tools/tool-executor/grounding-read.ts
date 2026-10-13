import {
  BOOT_LEARNINGS_MAX_CHARACTERS,
  BOOT_LEARNINGS_PATH,
} from '@savant-code/common/constants/learnings-boot'
import { HIDDEN_FILE_READ_STATUS } from '@savant-code/common/old-constants'

import { normalizeGroundingPath } from '../../echo/grounding'

import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'

/** A response can carry useful partial text without completing session grounding. */
export function completeGroundingReads(params: {
  output: ToolMessage['content']
  hasWindow: boolean
}): Array<{ path: string; characters: number; bytes: number }> {
  if (params.hasWindow) return []
  return params.output.flatMap((part) => {
    if (part.type !== 'json' || !Array.isArray(part.value)) return []
    return part.value.flatMap((entry) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        Array.isArray(entry) ||
        !('path' in entry) ||
        typeof entry.path !== 'string' ||
        !('content' in entry) ||
        typeof entry.content !== 'string' ||
        !entry.content.trim() ||
        ('contentOmittedForLength' in entry &&
          entry.contentOmittedForLength === true) ||
        /\[FILE_TOO_LARGE:|\[.*TRUNCATED.*\]/i.test(entry.content)
      )
        return []
      const content = entry.content
      if (HIDDEN_FILE_READ_STATUS.some((status) => content.startsWith(status)))
        return []
      const normalized = normalizeGroundingPath(entry.path)
      if (
        (normalized === BOOT_LEARNINGS_PATH ||
          normalized.endsWith(`/${BOOT_LEARNINGS_PATH}`)) &&
        content.length > BOOT_LEARNINGS_MAX_CHARACTERS
      )
        return []
      return [
        {
          path: entry.path,
          characters: entry.content.length,
          bytes: Buffer.byteLength(entry.content, 'utf8'),
        },
      ]
    })
  })
}
