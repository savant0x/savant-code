import { userMessage } from '@savant-code/common/util/messages'
import { withTimeout } from '@savant-code/common/util/promise'

import { configuredResearchProviders } from '../llm-api/research-configuration'
import { withSystemInstructionTags } from '../util/messages'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { ProbeClientCapabilitiesFn } from '@savant-code/common/util/capability-notice'

const PREFLIGHT_TAG = 'CAPABILITY_PREFLIGHT'
const CLIENT_PROBE_TIMEOUT_MS = 2_500
const MAX_NOTICE_CHARS = 400

/** The host owns local executables; an absent callback proves no availability. */
async function clientSearchNotice(
  probe?: ProbeClientCapabilitiesFn,
): Promise<string> {
  try {
    const result = probe
      ? (
          await withTimeout(probe(['code_search']), CLIENT_PROBE_TIMEOUT_MS)
        ).find((entry) => entry.capability === 'code_search')
      : undefined
    if (result)
      return `code_search: ${result.state}. ${result.reason.slice(0, MAX_NOTICE_CHARS)} ${result.action?.slice(0, MAX_NOTICE_CHARS) ?? ''}`.trim()
  } catch {
    // Never expose the raw exception or gate a run on a failed advisory probe.
  }
  return 'code_search: unverified. The client supplied no completed availability check; use its tool result as evidence.'
}

/** Refresh one history notice; tool definitions and system prompt stay stable. */
export async function withCapabilityPreflight(params: {
  messages: Message[]
  tools: readonly string[]
  permissionMode?: 'safe' | 'prompt' | 'unsafe'
  probeClientCapabilities?: ProbeClientCapabilitiesFn
}): Promise<Message[]> {
  const messages = params.messages.filter(
    (message) => !message.tags?.includes(PREFLIGHT_TAG),
  )
  const notices: string[] = []
  if (params.tools.includes('code_search'))
    notices.push(await clientSearchNotice(params.probeClientCapabilities))
  for (const name of ['web_search', 'read_docs']) {
    if (!params.tools.includes(name)) continue
    if (params.permissionMode === 'safe') {
      notices.push(
        `${name}: unavailable. Offline permission mode disables network research; continue from local files.`,
      )
    } else {
      const sources =
        name === 'web_search'
          ? configuredResearchProviders()
          : process.env.CONTEXT7_API_KEY?.trim()
            ? ['CONTEXT7_API_KEY']
            : []
      notices.push(
        `${name}: unverified. Configured providers: ${sources.join(', ') || 'none'}; keyless fallback configured. Network access and results are unverified until a request completes.`,
      )
    }
  }
  if (notices.length)
    messages.push(
      userMessage({
        content: withSystemInstructionTags(
          `Capability preflight (advisory):\n${notices.join('\n')}`,
        ),
        tags: [PREFLIGHT_TAG],
        keepLastTags: [PREFLIGHT_TAG],
      }),
    )
  return messages
}
