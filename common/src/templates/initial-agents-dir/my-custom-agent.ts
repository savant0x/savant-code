/*
 *  EDIT ME to create your own agent!
 *
 *  Run your agent with:
 *  > savant-code
 *  Inside savant-code:
 *  > @my-custom-agent please review my recent changes
 *
 *  Share the definition as a source file; local use needs no hosted store.
 */

import type { AgentDefinition } from './types/agent-definition'

const definition: AgentDefinition = {
  id: 'my-custom-agent',
  displayName: 'My Custom Agent',

  model: 'openrouter/free',
  spawnableAgents: ['savant-code/scout@0.0.1'],

  // Check out .agents/types/tools.ts for more information on the tools you can include.
  toolNames: ['run_terminal_command', 'read_files', 'spawn_agents'],

  spawnerPrompt: 'Spawn when you need to review code changes in the git diff',

  instructionsPrompt: `Review the code changes and suggest improvements.
Execute the following steps:
1. Run git diff
2. Spawn the scout to find all relevant files
3. Read any relevant files
4. Review the changes and suggest improvements`,

  // See also:
  // - types/agent-definition.ts file for more fields you can add
  // - the examples directory for more ideas!
}

export default definition
