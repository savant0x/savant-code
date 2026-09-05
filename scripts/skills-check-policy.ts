/**
 * skills:check policy data — blocklist patterns, the agent-authored command
 * allowlist, and the required-section order. Pure data, no logic.
 */

/** Shell patterns that always fail validation (any skill, any origin). */
export const BLOCKLIST_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/,
  /\bsudo\b/,
  /\bcurl\b[^\n|]*\|\s*(ba)?sh\b/,
  /\bwget\b[^\n|]*\|\s*(ba)?sh\b/,
  /\bbase64\s+-d\b/,
  /\bchmod\s+\+x\s+\/tmp\b/,
  /\beval\s+/,
  /`\s*\$/,
  /\bssh\s+\S+@/,
]

/**
 * Allowlisted command words for agent-authored skills: known-safe binaries
 * plus Savant tool names. Anything else that looks like a CLI invocation
 * fails validation for agent-authored skills.
 */
export const COMMAND_ALLOWLIST = new Set([
  // Savant tool names
  'read_files',
  'read_subtree',
  'read_url',
  'read_docs',
  'code_search',
  'glob',
  'list_directory',
  'find_files',
  'write_file',
  'str_replace',
  'apply_patch',
  'run_terminal_command',
  'run_readonly_command',
  'web_search',
  'spawn_agents',
  'skill',
  'skill_manage',
  'ask_user',
  'end_turn',
  'set_output',
  'write_todos',
  'transition_phase',
  'think_deeply',
  'sequentialthinking',
  'update_goal',
  'get_goal',
  // Known-safe CLI binaries
  'bun',
  'bunx',
  'node',
  'npm',
  'npx',
  'git',
  'ls',
  'cat',
  'grep',
  'rg',
  'sed',
  'awk',
  'jq',
  'find',
  'sort',
  'head',
  'tail',
  'wc',
  'date',
  'pwd',
  'which',
  'uname',
  'echo',
  'mkdir',
  'cp',
  'mv',
  'rm',
  'touch',
  'curl',
  'wget',
  'python',
  'python3',
  'cargo',
  'rustc',
  'tsc',
  'docker',
  'mkdirp',
])

/** Required sections, in order, for agent-authored skills. */
export const REQUIRED_SECTIONS = [
  'When to Use',
  'Procedure',
  'Pitfalls',
  'Verification',
] as const
