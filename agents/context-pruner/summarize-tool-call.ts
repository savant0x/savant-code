/**
 * Tool-call summarizer for the context-pruner handleSteps generator
 * (extracted verbatim from the original in-body implementation).
 * Embedded into the generated self-contained source via .toString() at
 * factory time.
 */
import {
  asAgentSpawnArray,
  asObject,
  asQuestionList,
  asString,
  asStringArray,
  asTodoList,
} from './helpers'

import type { JSONValue } from '../types/util-types'

export function summarizeToolCall(
  toolName: string,
  input: Record<string, JSONValue>,
): string {
  switch (toolName) {
    case 'read_files': {
      const paths = asStringArray(input.paths)
      if (paths && paths.length > 0) {
        return `inspected files: ${paths.join(', ')}`
      }
      return 'inspected files'
    }
    case 'write_file': {
      const path = asString(input.path)
      return path ? `wrote file: ${path}` : 'wrote a file'
    }
    case 'str_replace': {
      const path = asString(input.path)
      return path ? `edited file: ${path}` : 'edited a file'
    }
    case 'propose_write_file': {
      const path = asString(input.path)
      return path ? `proposed writing: ${path}` : 'proposed a file write'
    }
    case 'propose_str_replace': {
      const path = asString(input.path)
      return path ? `proposed editing: ${path}` : 'proposed a file edit'
    }
    case 'read_subtree': {
      const paths = asStringArray(input.paths)
      if (paths && paths.length > 0) {
        return `inspected subtrees: ${paths.join(', ')}`
      }
      return 'inspected a subtree'
    }
    case 'code_search': {
      const pattern = asString(input.pattern)
      const flags = asString(input.flags)
      if (pattern && flags) {
        return `code search for "${pattern}" (${flags})`
      }
      return pattern ? `code search for "${pattern}"` : 'code search'
    }
    case 'glob': {
      const pattern = asString(input.pattern)
      return pattern ? `glob search for ${pattern}` : 'glob search'
    }
    case 'list_directory': {
      const path = asString(input.path)
      return path ? `listed directory: ${path}` : 'listed a directory'
    }
    case 'find_files': {
      const prompt = asString(input.prompt)
      return prompt
        ? `file-finding request: "${prompt}"`
        : 'file-finding request'
    }
    case 'run_terminal_command': {
      const command = asString(input.command)
      if (command) {
        const shortCmd =
          command.length > 50 ? command.slice(0, 50) + '...' : command
        return `ran command: ${shortCmd}`
      }
      return 'ran a terminal command'
    }
    case 'spawn_agents':
    case 'spawn_agent_inline': {
      const agents = asAgentSpawnArray(input.agents)
      const agentType = asString(input.agent_type)
      const prompt = asString(input.prompt)
      const agentParams = asObject(input.params)

      if (agents && agents.length > 0) {
        const agentDetails = agents.map((a) => {
          let detail = a.agent_type
          const extras: string[] = []
          if (a.prompt) {
            const truncatedPrompt =
              a.prompt.length > 1000
                ? a.prompt.slice(0, 1000) + '...'
                : a.prompt
            extras.push(`prompt: "${truncatedPrompt}"`)
          }
          if (a.params && Object.keys(a.params).length > 0) {
            const paramsStr = JSON.stringify(a.params)
            const truncatedParams =
              paramsStr.length > 1000
                ? paramsStr.slice(0, 1000) + '...'
                : paramsStr
            extras.push(`params: ${truncatedParams}`)
          }
          if (extras.length > 0) {
            detail += ` (${extras.join(', ')})`
          }
          return detail
        })
        return `delegated agents:\n${agentDetails.map((d) => `- ${d}`).join('\n')}`
      }
      if (agentType) {
        const extras: string[] = []
        if (prompt) {
          const truncatedPrompt =
            prompt.length > 1000 ? prompt.slice(0, 1000) + '...' : prompt
          extras.push(`prompt: "${truncatedPrompt}"`)
        }
        if (agentParams && Object.keys(agentParams).length > 0) {
          const paramsStr = JSON.stringify(agentParams)
          const truncatedParams =
            paramsStr.length > 1000
              ? paramsStr.slice(0, 1000) + '...'
              : paramsStr
          extras.push(`params: ${truncatedParams}`)
        }
        if (extras.length > 0) {
          return `delegated agent ${agentType} (${extras.join(', ')})`
        }
        return `delegated agent ${agentType}`
      }
      return 'delegated agent work'
    }
    case 'write_todos': {
      const todos = asTodoList(input.todos)
      if (todos) {
        const completed = todos.filter((t) => t.completed).length
        const incomplete = todos.filter((t) => !t.completed)
        if (incomplete.length === 0) {
          return `Todos: ${completed}/${todos.length} complete (all done!)`
        }
        const remainingTasks = incomplete.map((t) => `- ${t.task}`).join('\n')
        return `Todos: ${completed}/${todos.length} complete. Remaining:\n${remainingTasks}`
      }
      return 'Updated todos'
    }
    case 'ask_user': {
      const questions = asQuestionList(input.questions)
      if (questions && questions.length > 0) {
        const questionTexts = questions.map((q) => q.question).join('; ')
        const truncated =
          questionTexts.length > 200
            ? questionTexts.slice(0, 200) + '...'
            : questionTexts
        return `Asked user: ${truncated}`
      }
      return 'Asked user question'
    }
    case 'suggest_followups':
      return 'Suggested followups'
    case 'web_search': {
      const query = asString(input.query)
      return query ? `web search for "${query}"` : 'web search'
    }
    case 'read_url': {
      const url = asString(input.url)
      return url ? `read URL: ${url}` : 'read a URL'
    }
    case 'gravity_index': {
      const query = asString(input.query)
      const action = asString(input.action)
      if (query) {
        return `Gravity Index ${action ?? 'search'} for "${query}"`
      }
      return action ? `Gravity Index ${action}` : 'Gravity Index use'
    }
    case 'read_docs': {
      const libraryTitle = asString(input.libraryTitle)
      const topic = asString(input.topic)
      if (libraryTitle && topic) {
        return `consulted docs: ${libraryTitle} - ${topic}`
      }
      return libraryTitle ? `consulted docs: ${libraryTitle}` : 'consulted docs'
    }
    case 'set_output':
      return 'set structured output'
    case 'set_messages':
      return 'updated message history'
    default:
      return `used tool ${toolName}`
  }
}
