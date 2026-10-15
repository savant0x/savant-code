export interface AddMessageParams {
  role: 'user' | 'assistant'
  content: string
}

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

export interface EndTurnParams {}

export interface SetMessagesParams {
  messages: unknown
}

export interface SetOutputParams {}

export interface SkillParams {
  name: string
  /** FID-2026-0824-012 S0-D: optional references/ sub-path (Level-2 load). */
  path?: string
}

export interface SkillManageParams {
  action:
    | 'create'
    | 'patch'
    | 'edit'
    | 'delete'
    | 'write_file'
    | 'remove_file'
    | 'rollback'
  name: string
  description?: string
  body?: string
  oldString?: string
  newString?: string
  relPath?: string
  content?: string
  seq?: number
  bump?: 'patch' | 'minor' | 'major'
  reason: string
  provenanceRef?: string
}

export interface SpawnAgentInlineParams {
  agent_type: string
  params?: Record<string, unknown>
}

export interface SpawnAgentsParams {
  agents: {
    agent_type: string
    prompt?: string
    params?: Record<string, unknown>
  }[]
}

export interface StrReplaceParams {
  path: string
  replacements: {
    oldString: string
    newString: string
    allowMultiple?: boolean
  }[]
}

export interface SuggestFollowupsParams {
  followups: {
    prompt: string
    label?: string
  }[]
}

export interface TaskCompletedParams {}

export interface ThinkDeeplyParams {
  thought: string
}

export interface TransitionPhaseParams {
  phase:
    | 'idle'
    | 'red'
    | 'green'
    | 'audit'
    | 'adversarial'
    | 'self_correct'
    | 'complete'
  reason: string
}

export interface WriteFileParams {
  path: string
  instructions: string
  content: string
}

export interface WriteTodosParams {
  todos: {
    task: string
    completed: boolean
  }[]
}
