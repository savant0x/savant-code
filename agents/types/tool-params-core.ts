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
