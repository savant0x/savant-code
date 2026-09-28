import type { JSONValue, Message } from './util-types'

/**
 * Add a new message to the conversation history. To be used for complex requests that can't be solved in a single step, as you may forget what happened!
 */
export interface AddMessageParams {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Apply a file operation (create, update, or delete) using Codex-style apply_patch format.
 */
export interface ApplyPatchParams {
  /** The file operation to perform. */
  operation: {
    /** Operation type: create_file, update_file, or delete_file */
    type: 'create_file' | 'update_file' | 'delete_file'
    /** File path relative to project root */
    path: string
    /** Diff content. Required for create_file and update_file. Lines prefixed with + for creates, unified diff with @@ hunks for updates. */
    diff?: string
  }
}

/**
 * Ask the user multiple choice questions and pause execution until they respond.
 */
export interface AskUserParams {
  /** List of multiple choice questions to ask the user */
  questions: {
    /** The question to ask the user */
    question: string
    /** Short label (max 12 chars) displayed as a chip/tag */
    header?: string
    /** Array of answer options with label and optional description (minimum 2) */
    options: {
      /** The display text for this option */
      label: string
      /** Explanation shown when option is focused */
      description?: string
    }[]
    /** If true, allows selecting multiple options (checkbox). If false, single selection only (radio). */
    multiSelect?: boolean
    /** Validation rules for "Other" text input */
    validation?: {
      /** Maximum length for "Other" text input */
      maxLength?: number
      /** Minimum length for "Other" text input */
      minLength?: number
      /** Regex pattern for "Other" text input */
      pattern?: string
      /** Custom error message when pattern fails */
      patternError?: string
    }
  }[]
}

/**
 * End your turn, regardless of any new tool results that might be coming. This will allow the user to type another prompt.
 */
export interface EndTurnParams {}

/**
 * Set the conversation history to the provided messages.
 */
export interface SetMessagesParams {
  messages: Message[]
}

/**
 * JSON object to set as the agent output. This completely replaces any previous output. If the agent was spawned, this value will be passed back to its parent. If the agent has an outputSchema defined, the output will be validated against it.
 */
export interface SetOutputParams {}

/**
 * Load a skill's full instructions when relevant to the current task. Skills are loaded on-demand - only load them when you need their specific guidance.
 */
export interface SkillParams {
  /** The name of the skill to load */
  name: string
}

/**
 * Spawn an agent inline within a handleSteps generator.
 * This is a programmatic-only tool (not user-facing) that spawns
 * a sub-agent and awaits its completion within the generator.
 */
export interface SpawnAgentInlineParams {
  /** Agent type to spawn */
  agent_type: string
  /** Parameters to pass to the spawned agent */
  params?: Record<string, JSONValue>
}

/**
 * Spawn multiple agents and send a prompt and/or parameters to each of them. These agents will run in parallel. Note that that means they will run independently. If you need to run agents sequentially, use spawn_agents with one agent at a time instead.
 */
export interface SpawnAgentsParams {
  agents: {
    /** Agent to spawn */
    agent_type: string
    /** Prompt to send to the agent */
    prompt?: string
    /** Parameters object for the agent (if any) */
    params?: Record<string, JSONValue>
  }[]
}

/**
 * Replace strings in a file with new strings.
 */
export interface StrReplaceParams {
  /** The path to the file to edit. */
  path: string
  /** Array of replacements to make. */
  replacements: {
    /** The string to replace. This must be an *exact match* of the string you want to replace, including whitespace and punctuation. */
    oldString: string
    /** The string to replace the corresponding oldString with. Can be empty to delete. */
    newString: string
    /** Whether to allow multiple replacements of oldString. */
    allowMultiple?: boolean
  }[]
}

/**
 * Suggest clickable followup prompts to the user.
 */
export interface SuggestFollowupsParams {
  /** List of suggested followup prompts the user can click to send */
  followups: {
    /** The full prompt text to send as a user message when clicked */
    prompt: string
    /** Short display label for the card (defaults to truncated prompt if not provided) */
    label?: string
  }[]
}

/**
 * Signal that the task is complete. Use this tool when:
- The user's request is completely fulfilled
- You need clarification from the user before continuing
- You are stuck or need help from the user to continue

This tool explicitly marks the end of your work on the current task.
 */
export interface TaskCompletedParams {}

/**
 * Deeply consider complex tasks by brainstorming approaches and tradeoffs step-by-step.
 */
export interface ThinkDeeplyParams {
  /** Detailed step-by-step analysis. Initially keep each step concise (max ~5-7 words per step). */
  thought: string
}

/**
 * Create or edit a file with the given content.
 */
export interface WriteFileParams {
  /** Path to the file relative to the **project root** */
  path: string
  /** What the change is intended to do in only one sentence. */
  instructions: string
  /** Edit snippet to apply to the file. */
  content: string
}

/**
 * Write a todo list to track tasks for multi-step implementations. Use this frequently to maintain an updated step-by-step plan.
 */
export interface WriteTodosParams {
  /** List of todos with their completion status. Add ALL of the applicable tasks to the list, so you don't forget to do anything. Try to order the todos the same way you will complete them. Do not mark todos as completed if you have not completed them yet! */
  todos: {
    /** Description of the task */
    task: string
    /** Whether the task is completed */
    completed: boolean
  }[]
}
