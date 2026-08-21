export interface ApplyPatchParams {
  operation: {
    type: 'create_file' | 'update_file' | 'delete_file'
    path: string
    diff?: string
  }
}

export interface CodeSearchParams {
  pattern: string
  flags?: string
  cwd?: string
  maxResults?: number
}

export interface FindFilesParams {
  prompt: string
}

export interface GlobParams {
  pattern: string
  cwd?: string
}

export interface ListDirectoryParams {
  path: string
}

export interface LookupAgentInfoParams {
  agentId: string
}

export interface ProposeStrReplaceParams {
  path: string
  replacements: {
    oldString: string
    newString: string
    allowMultiple?: boolean
  }[]
}

export interface ProposeWriteFileParams {
  path: string
  instructions: string
  content: string
}

export interface QueryBlastRadiusParams {
  filePath: string
  maxDepth?: number
  limit?: number
}

export interface QueryDomainClustersParams {
  limit?: number
}

export interface QueryNodeEdgesParams {
  filePath: string
  limit?: number
}

export interface ReadFilesParams {
  paths: string[]
}

export interface ReadSubtreeParams {
  paths?: string[]
  maxTokens?: number
}

export interface ReadUrlParams {
  url: string
  max_chars?: number
}

export interface RenderUiParams {
  widget: {
    type: 'button'
    text: string
    link: string
    variant?: 'primary' | 'secondary'
  }
}

export interface RunFileChangeHooksParams {
  files: string[]
}

export interface RunTerminalCommandParams {
  command: string
  process_type?: 'SYNC'
  cwd?: string
  timeout_seconds?: number
}
