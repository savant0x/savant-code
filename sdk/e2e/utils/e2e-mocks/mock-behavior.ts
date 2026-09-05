// FID-2026-0819-005 Loop 273: pure mock-behavior helpers for the e2e LLM
// mocks, extracted verbatim from e2e-mocks.ts. No imports beyond types —
// every function here is deterministic text/logic work over the mock
// conversation, consumed by the three mock prompt fns in e2e-mocks.ts.
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

export const MOCK_TOOL_NAMES = [
  'get_weather',
  'execute_sql',
  'fetch_api',
  'apply_patch',
] as const
export type MockToolName = (typeof MOCK_TOOL_NAMES)[number]

export function getMessageText(message: Message): string {
  if (!('content' in message)) {
    return ''
  }
  return message.content
    .map((part) => {
      if (
        part &&
        typeof part === 'object' &&
        'text' in part &&
        typeof part.text === 'string'
      ) {
        return part.text
      }
      return ''
    })
    .join('')
}

export function getLatestUserText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return getMessageText(messages[i])
    }
  }
  return ''
}

export function getAllText(messages: Message[]): string {
  return messages.map(getMessageText).join('\n')
}

export function extractLatestUserMessage(text: string): string | null {
  const matches = [
    ...text.matchAll(/<user_message>([\s\S]*?)<\/user_message>/g),
  ]
  if (matches.length === 0) {
    return null
  }
  return matches[matches.length - 1]?.[1] ?? null
}

export function getPromptText(latestUserText: string, allText: string): string {
  return extractLatestUserMessage(allText) ?? latestUserText
}

export function splitTextIntoChunks(text: string): string[] {
  if (!text) {
    return []
  }

  const targetChunks =
    text.length <= 1 ? 1 : text.length > 120 ? 4 : text.length > 60 ? 3 : 2
  if (targetChunks === 1) {
    return [text]
  }

  const chunkSize = Math.ceil(text.length / targetChunks)
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }
  return chunks
}

function extractQuotedText(text: string): string | null {
  const doubleQuoted = text.match(/"([^"]+)"/)
  if (doubleQuoted?.[1]) {
    return doubleQuoted[1]
  }
  const singleQuoted = text.match(/'([^']+)'/)
  if (singleQuoted?.[1]) {
    return singleQuoted[1]
  }
  return null
}

function extractCity(text: string): string | null {
  const knownCities = [
    'New York',
    'Atlantis',
    'London',
    'Tokyo',
    'Sydney',
    'Paris',
  ]
  for (const city of knownCities) {
    if (text.toLowerCase().includes(city.toLowerCase())) {
      return city
    }
  }
  const match = text.match(/weather in ([A-Za-z\s]+)[?.!]?/i)
  if (match?.[1]) {
    return match[1].trim()
  }
  return null
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/\S+/)
  if (match?.[0]) {
    return match[0].replace(/[)\\].,]+$/, '')
  }
  return null
}

export function buildMockToolCall(params: {
  tools: Record<string, unknown> | undefined
  latestUserText: string
  hasToolResult: boolean
}): { toolName: MockToolName; input: Record<string, unknown> } | null {
  const { tools, latestUserText, hasToolResult } = params
  if (hasToolResult || !tools) {
    return null
  }

  const availableTools = new Set(Object.keys(tools))
  const lowerPrompt = latestUserText.toLowerCase()

  if (availableTools.has('get_weather') && lowerPrompt.includes('weather')) {
    const city = extractCity(latestUserText) ?? 'New York'
    return { toolName: 'get_weather', input: { city } }
  }

  if (
    availableTools.has('execute_sql') &&
    (lowerPrompt.includes('database') || lowerPrompt.includes('sql'))
  ) {
    const query = lowerPrompt.includes('id 1')
      ? 'SELECT * FROM users WHERE id = 1'
      : 'SELECT * FROM users'
    return { toolName: 'execute_sql', input: { query } }
  }

  if (
    availableTools.has('apply_patch') &&
    (lowerPrompt.includes('apply patch') || lowerPrompt.includes('patch file'))
  ) {
    return {
      toolName: 'apply_patch',
      input: {
        operation: {
          type: 'create_file' as const,
          path: 'hello-from-apply-patch.txt',
          diff: '@@\n+hello from apply_patch\n',
        },
      },
    }
  }

  if (
    availableTools.has('fetch_api') &&
    (lowerPrompt.includes('http') || lowerPrompt.includes('fetch'))
  ) {
    const hintedUrl = extractFirstUrl(latestUserText)
    const url =
      hintedUrl && /jsonplaceholder|example/.test(hintedUrl)
        ? hintedUrl
        : 'https://api.example.com/data'
    return { toolName: 'fetch_api', input: { url, method: 'GET' } }
  }

  return null
}

export function buildMockResponseText(params: {
  latestUserText: string
  allText: string
  toolName?: MockToolName
}): string {
  const { latestUserText, allText, toolName } = params
  const normalized = latestUserText.trim()
  const lowerPrompt = normalized.toLowerCase()
  const lowerAll = allText.toLowerCase()

  const quoted = extractQuotedText(normalized)
  if (quoted) {
    return quoted
  }

  if (lowerPrompt.includes('what is my favorite number')) {
    if (lowerAll.includes('favorite number is 42')) {
      return 'Your favorite number is 42.'
    }
  }

  if (lowerPrompt.includes('favorite number is')) {
    return 'Got it.'
  }

  if (lowerPrompt.includes('2 + 2')) {
    return '4'
  }

  if (lowerPrompt.includes('project') && lowerPrompt.includes('file')) {
    return 'Files: src/index.ts, src/calculator.ts, package.json, README.md.'
  }

  if (lowerPrompt.includes('calculator class')) {
    return 'The Calculator class adds numbers and tracks a result.'
  }

  if (lowerPrompt.includes('secret code word')) {
    return 'The secret code word is PINEAPPLE42.'
  }

  if (lowerPrompt.includes('company values')) {
    return 'Innovation and Integrity.'
  }

  if (lowerPrompt.includes('summarize') && lowerAll.includes('todo app')) {
    return 'We are discussing a todo app.'
  }

  if (lowerPrompt.includes('what features') && lowerAll.includes('todo app')) {
    return 'Add due dates, filters, and priorities to the todo app.'
  }

  if (lowerPrompt.includes('weather') || toolName === 'get_weather') {
    return 'The weather is sunny, temperature 72F.'
  }

  if (
    lowerPrompt.includes('database') ||
    lowerPrompt.includes('sql') ||
    toolName === 'execute_sql'
  ) {
    return 'Users include Alice and Bob.'
  }

  if (
    lowerPrompt.includes('apply patch') ||
    lowerPrompt.includes('patch file') ||
    toolName === 'apply_patch'
  ) {
    return 'Applied patch successfully.'
  }

  if (
    lowerPrompt.includes('fetch') ||
    lowerPrompt.includes('http') ||
    toolName === 'fetch_api'
  ) {
    return 'Fetched mock API data.'
  }

  if (lowerPrompt.includes('count to 3')) {
    return '1, 2, 3.'
  }

  if (lowerPrompt.includes('name 3 colors')) {
    return 'Red, Green, Blue.'
  }

  if (lowerPrompt.includes('list 3 fruits')) {
    return 'Apple, Banana, Cherry.'
  }

  if (lowerPrompt.includes('say hello')) {
    return 'Hello!'
  }

  if (!lowerPrompt) {
    return 'Hello!'
  }

  return 'OK.'
}
