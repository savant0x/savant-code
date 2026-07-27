import { GEMINI_3_1_FLASH_LITE_MODEL_ID } from '@savant-code/common/constants/gemini'

import { publisher } from '../constants'
import {
  PLACEHOLDER,
  type SecretAgentDefinition,
} from '../types/secret-agent-definition'

import type { ToolCall } from '../types/agent-definition'
import type { JSONValue } from '../types/util-types'

type FilePickerMode = 'default' | 'max'

export const createFilePicker = (
  mode: FilePickerMode,
): Omit<SecretAgentDefinition, 'id'> => {
  const isMax = mode === 'max'
  const model = isMax
    ? GEMINI_3_1_FLASH_LITE_MODEL_ID
    : 'google/gemini-2.5-flash-lite'

  return {
    displayName: 'Savant the Scout',
    publisher,
    model,
    reasoningOptions: {
      enabled: false,
      effort: 'low',
      exclude: false,
    },
    spawnerPrompt: `Spawn to find relevant files in a codebase related to the prompt. Outputs up to ${isMax ? 20 : 12} file paths with short summaries for each file. Cannot do string searches on the codebase, but does a fuzzy search. Unless you know which directories are relevant, omit the directories parameter. This agent is extremely effective at finding files in the codebase that could be relevant to the prompt.`,
    inputSchema: {
      prompt: {
        type: 'string',
        description:
          'A description of the files you need to find. Be more broad for better results: instead of "Find x file" say "Find x file and related files". This agent is designed to help you find several files that could be relevant to the prompt.',
      },
      params: {
        type: 'object' as const,
        properties: {
          directories: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description:
              'Optional list of paths to directories to look within. If omitted, the entire project tree is used.',
          },
        },
        required: [],
      },
    },
    outputMode: 'last_message',
    includeMessageHistory: false,
    // After FID-2026-0718-007: Scout uses glob + list_directory directly
    // instead of delegating to Detective (code_search agent).
    toolNames: [
      'glob',
      'list_directory',
      'read_files',
      'read_subtree',
      'set_output',
    ],
    // Scout no longer delegates file-finding to any subagent.
    spawnableAgents: [],

    systemPrompt: `You are an expert at finding relevant files in a codebase. ${PLACEHOLDER.FILE_TREE_PROMPT}`,
    instructionsPrompt: [
      'Instructions:',
      'You are an expert file-finding agent. Your goal is to identify the small set of files most relevant to the user\'s prompt and return concise evidence for each.',
      '',
      'Workflow:',
      '1. Use glob and list_directory to find candidate files and directories. Start with keyword globs (e.g. `**/*auth*`) and broaden only if needed.',
      '2. Use read_files or read_subtree to peek at promising files when a short excerpt would help you decide if a file is truly relevant.',
      '3. Rank results by relevance: prefer files whose names, paths, or content directly match the user\'s request; deprioritize tangential matches.',
      '4. Summarize each selected file with: full path, one-sentence reason it matters, and (optionally) the most relevant symbol/section.',
      '',
      'Output format:',
      `- Return at most ${isMax ? 20 : 12} files.`,
      '- Keep the report extremely short; do not reproduce large code excerpts.',
      '- Do not use any further tools or spawn any further agents.',
      '- CRITICAL: Use the set_output tool by calling it as a function with a JSON object argument. Do NOT write XML tags like <set_output> or </set_output>. Call the tool directly.',
      '- Always check exitCode and stderr in tool outputs. If a tool fails, report the failure — do NOT assume success from partial results.',
    ].join('\n'),

    handleSteps: isMax ? handleStepsMax : handleStepsDefault,
  }
}

/**
 * handleSteps for default mode — programmatic glob by keyword + STEP yield.
 * 1. Extract keywords from prompt, glob for each keyword
 * 2. Yield STEP so the LLM can interpret results, explore deeper, filter/rank
 * 3. LLM calls set_output with final results
 */
const handleStepsDefault: SecretAgentDefinition['handleSteps'] = function* ({
  prompt,
  params,
}) {
  function isStringArray(value: JSONValue): value is string[] {
    return (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
    )
  }
  const p = params ?? {}
  const rawDirectories = p.directories
  const directories = isStringArray(rawDirectories) ? rawDirectories : []
  const cwd = directories.length > 0 ? directories[0] : undefined

  // Inlined extractKeywords (must be self-contained for .toString() serialization)
  function _extractKeywords(p: string): string[] {
    const STOP_WORDS = new Set([
      'find',
      'search',
      'look',
      'for',
      'files',
      'file',
      'related',
      'to',
      'the',
      'a',
      'an',
      'in',
      'on',
      'of',
      'and',
      'or',
      'that',
      'which',
      'about',
      'with',
      'show',
      'me',
      'list',
      'get',
      'all',
      'any',
      'where',
      'what',
      'how',
      'please',
      'can',
      'you',
      'i',
      'we',
      'need',
      'want',
    ])
    const raw = p
      .toLowerCase()
      .replace(/[^a-z0-9\s\-_./]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    const seen = new Set<string>()
    const unique = raw.filter((t) =>
      seen.has(t) ? false : (seen.add(t), true),
    )
    if (unique.length === 0) {
      const fallback = p
        .replace(/[^a-z0-9\s\-_./]/gi, ' ')
        .trim()
        .split(/\s+/)[0]
      return fallback ? [fallback.toLowerCase()] : ['*']
    }
    return unique
  }

  // 1. Programmatic glob: extract keywords, search file NAMES (not contents)
  if (prompt) {
    const keywords = _extractKeywords(prompt)
    for (const keyword of keywords) {
      yield {
        toolName: 'glob',
        input: {
          pattern: `**/*${keyword}*`,
          ...(cwd ? { cwd } : {}),
        },
      } satisfies ToolCall
    }
  }

  // 2. Yield STEP — let the LLM interpret results, drive deeper exploration
  //    (LLM can call list_directory, read_files, read_subtree, glob, set_output)
  yield 'STEP'

  // 3. LLM calls set_output with final results
  yield {
    toolName: 'set_output',
    input: {
      message: `Scout found these files for: ${prompt}`,
    },
  } satisfies ToolCall
}

/**
 * handleSteps for max mode — same programmatic glob + deeper LLM exploration.
 * Max mode encourages the LLM to explore directories more deeply during STEP.
 */
const handleStepsMax: SecretAgentDefinition['handleSteps'] = function* ({
  prompt,
  params,
}) {
  function isStringArray(value: JSONValue): value is string[] {
    return (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
    )
  }
  const p = params ?? {}
  const rawDirectories = p.directories
  const directories = isStringArray(rawDirectories) ? rawDirectories : []
  const cwd = directories.length > 0 ? directories[0] : undefined

  // Inlined extractKeywords (must be self-contained for .toString() serialization)
  function _extractKeywords(p: string): string[] {
    const STOP_WORDS = new Set([
      'find',
      'search',
      'look',
      'for',
      'files',
      'file',
      'related',
      'to',
      'the',
      'a',
      'an',
      'in',
      'on',
      'of',
      'and',
      'or',
      'that',
      'which',
      'about',
      'with',
      'show',
      'me',
      'list',
      'get',
      'all',
      'any',
      'where',
      'what',
      'how',
      'please',
      'can',
      'you',
      'i',
      'we',
      'need',
      'want',
    ])
    const raw = p
      .toLowerCase()
      .replace(/[^a-z0-9\s\-_./]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    const seen = new Set<string>()
    const unique = raw.filter((t) =>
      seen.has(t) ? false : (seen.add(t), true),
    )
    if (unique.length === 0) {
      const fallback = p
        .replace(/[^a-z0-9\s\-_./]/gi, ' ')
        .trim()
        .split(/\s+/)[0]
      return fallback ? [fallback.toLowerCase()] : ['*']
    }
    return unique
  }

  // 1. Programmatic glob: extract keywords, search file NAMES
  if (prompt) {
    const keywords = _extractKeywords(prompt)
    for (const keyword of keywords) {
      yield {
        toolName: 'glob',
        input: {
          pattern: `**/*${keyword}*`,
          ...(cwd ? { cwd } : {}),
        },
      } satisfies ToolCall
    }
  }

  // 2. Yield STEP — in max mode, the LLM should explore more deeply:
  //    read key files, explore directory structures, find related modules
  yield 'STEP'

  // 3. LLM calls set_output with final results
  yield {
    toolName: 'set_output',
    input: {
      message: `Scout found these files for: ${prompt}`,
    },
  } satisfies ToolCall
}

const definition: SecretAgentDefinition = {
  id: 'scout',
  ...createFilePicker('default'),
}

export default definition
