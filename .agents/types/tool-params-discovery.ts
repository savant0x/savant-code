import type { JSONValue } from './util-types'

/** Add a new message to the conversation history. */
export interface AddMessageParams {
  role: 'user' | 'assistant'
  content: string
}

/** Apply a file operation using Codex-style apply_patch format. */
export interface ApplyPatchParams {
  operation: {
    type: 'create_file' | 'update_file' | 'delete_file'
    path: string
    diff?: string
  }
}

/** Ask the user multiple choice questions. */
export interface AskUserParams {
  questions: {
    question: string
    header?: string
    options: {
      label: string
      description?: string
    }[]
    multiSelect?: boolean
    validation?: {
      maxLength?: number
      minLength?: number
      pattern?: string
      patternError?: string
    }
  }[]
}

/** Search for string patterns in the project's files. */
export interface CodeSearchParams {
  pattern: string
  flags?: string
  cwd?: string
  maxResults?: number
}

/** End the current turn. */
export interface EndTurnParams {}

/** Find files related to a natural-language description. */
export interface FindFilesParams {
  prompt: string
}

/** Search for files matching a glob pattern. */
export interface GlobParams {
  pattern: string
  cwd?: string
}

/** Discover and inspect third-party developer-service integrations. */
export interface GravityIndexParams {
  action:
    | 'search'
    | 'browse'
    | 'list_categories'
    | 'get_service'
    | 'report_integration'
  query?: string
  search_id?: string
  context?: Record<string, JSONValue>
  category?: string
  q?: string
  slug?: string
  integrated_slug?: string
}

/** List files and directories in a path. */
export interface ListDirectoryParams {
  path: string
}

/** Retrieve information about an agent by ID. */
export interface LookupAgentInfoParams {
  agentId: string
}

/** Propose string replacements in a file. */
export interface ProposeStrReplaceParams {
  path: string
  replacements: {
    oldString: string
    newString: string
    allowMultiple?: boolean
  }[]
}

/** Propose creating or editing a file. */
export interface ProposeWriteFileParams {
  path: string
  instructions: string
  content: string
}

/** Fetch documentation for a library or framework. */
export interface ReadDocsParams {
  libraryTitle: string
  topic: string
  max_tokens?: number
}

/** Read multiple files from disk. */
export interface ReadFilesParams {
  paths: string[]
}

/** Read one or more directory subtrees. */
export interface ReadSubtreeParams {
  paths?: string[]
  maxTokens?: number
}

/** Fetch a URL and extract readable text. */
export interface ReadUrlParams {
  url: string
  max_chars?: number
}

/** Render a small interactive button in the CLI. */
export interface RenderUiParams {
  widget: {
    type: 'button'
    text: string
    link: string
    variant?: 'primary' | 'secondary'
  }
}
