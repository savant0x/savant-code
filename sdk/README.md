<!-- markdownlint-disable MD041 -->
<img src="../assets/banner.png" alt="@savant-code/sdk — Official TypeScript SDK for the Savant-Code multi-agent
runtime" width="650" />

# @savant-code/sdk

Official TypeScript SDK for the Savant-Code multi-agent runtime.

[![npm](https://img.shields.io/badge/npm-@savant-code/sdk-%23cb3837?style=flat-square&logo=npm)](https://www.npmjs.com/package/@savant-code/sdk)[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-%23000000?style=flat-square&logo=typescript&logoColor=%2300fbff)](https://www.typescriptlang.org/)[![Bun](https://img.shields.io/badge/Bun-tested-%23000000?style=flat-square&logo=bun&logoColor=%2300fbff)](https://bun.sh/)[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../ECHO.md)

## Installation

```bash
npm install @savant-code/sdk
```

## Prerequisites

The SDK client uses the Savant-Code backend contract and requires the API key supplied to `SavantCodeClient`.
Set `SAVANT_CODE_API_KEY` in the environment or pass the key through your application's secret management.
The CLI's interactive `/provider` credentials are a separate local CLI onboarding flow and are not implicitly loaded by
SDK clients.

For direct provider routing, configure the provider-specific environment variables documented by the runtime, including
`OPENCODE_GO_API_KEY`, `TOKENROUTER_API_KEY`, `NVIDIA_API_KEY`, and `COMMAND_CODE_API_KEY`.

## Usage

### Basic Example

```typescript
import { SavantCodeClient } from '@savant-code/sdk'

async function main() {
  const client = new SavantCodeClient({
    // Supply your backend API key through your application's secret manager.
    apiKey: process.env.SAVANT_CODE_API_KEY,
    cwd: process.cwd(),
  })

  // First run
  const runState1 = await client.run({
    // The agent id. Any agent on the store (https://savant-code.com/store)
    agent: 'savant-code/base@latest',
    prompt: 'Create a simple calculator class',
    handleEvent: (event) => {
      // All events that happen during the run: agent start/finish, tool calls/results, text responses, errors.
      console.log('SavantCode Event', JSON.stringify(event))
    },
  })

  // Continue the same session with a follow-up
  const runOrError2 = await client.run({
    agent: 'savant-code/base@latest',
    prompt: 'Add unit tests for the calculator',
    previousRun: runState1, // <-- this is where your next run differs from the previous run
    handleEvent: (event) => {
      console.log('SavantCode Event', JSON.stringify(event))
    },
  })
}

main()
```

### Example 2: Custom Agents and Tools

Here, we create a full agent and custom tools that can be reused between runs.

```typescript
import { z } from 'zod/v4'

import { SavantCodeClient, getCustomToolDefinition } from '@savant-code/sdk'

import type { AgentDefinition } from '@savant-code/sdk'

async function main() {
  const client = new SavantCodeClient({
    // Supply your backend API key through your application's secret manager.
    apiKey: process.env.SAVANT_CODE_API_KEY,
    // Optional directory agent runs from (if applicable).
    cwd: process.cwd(),
  })

  // Define your own custom agents!
  const myCustomAgent: AgentDefinition = {
    id: 'my-custom-agent',
    model: 'google/gemini-3.1-flash-lite',
    displayName: 'Sentiment analyzer',
    toolNames: ['fetch_api_data'], // Defined below!
    instructionsPrompt: `
1. Describe the different sentiments in the given prompt.
2. Score the prompt along the following 5 dimensions:
  happiness, sadness, anger, fear, and surprise.`,
    // ... other AgentDefinition properties
  }

  // And define your own custom tools!
  const myCustomTool = getCustomToolDefinition({
    toolName: 'fetch_api_data',
    description: 'Fetch data from an API endpoint',
    inputSchema: z.object({
      url: z.url(),
      method: z.enum(['GET', 'POST']).default('GET'),
      headers: z.record(z.string(), z.string()).optional(),
    }),
    exampleInputs: [{ url: 'https://api.example.com/data', method: 'GET' }],
    execute: async ({ url, method, headers }) => {
      const response = await fetch(url, { method, headers })
      const data = await response.text()
      return [
        {
          type: 'json' as const,
          value: {
            message: `API Response: ${data.slice(0, 5000)}...`,
          },
        },
      ]
    },
  })

  const { output } = await client.run({
    // Run a custom agent by id. Must match an id in the agentDefinitions field below.
    agent: 'my-custom-agent',
    prompt: "Today I'm feeling very happy!",

    // Provide custom agent and tool definitions:
    agentDefinitions: [myCustomAgent],
    customToolDefinitions: [myCustomTool],

    handleEvent: (event) => {
      // All events that happen during the run: agent start/finish, tool calls/results, text responses, errors.
      console.log('SavantCode Event', JSON.stringify(event))
    },
  })

  if (output.type === 'error') {
    console.error(`The run failed:\n${output.message}`)
  } else {
    console.log('The run succeeded with output:', output)
  }
}

main()
```

## API Reference

### Knowledge Files

Knowledge files provide project context to the agent. The SDK auto-discovers:

- **Project files**: `knowledge.md`, `AGENTS.md`, or `CLAUDE.md` in each directory (priority order)
- **User files**: `~/.knowledge.md`, `~/.AGENTS.md`, or `~/.CLAUDE.md` (case-insensitive)

Override with `knowledgeFiles` (replaces project files) or `userKnowledgeFiles` (merges with home directory files):

```typescript
await client.run({
  agent: 'savant-code/base@latest',
  prompt: 'Help me refactor',
  knowledgeFiles: { 'knowledge.md': '# Guidelines\n- Use TypeScript' },
  userKnowledgeFiles: { '~/.knowledge.md': '# Preferences\n- Be concise' },
})
```

### File Filtering

The `fileFilter` option controls which files the agent can read:

```typescript
const client = new SavantCodeClient({
  apiKey: process.env.SAVANT_CODE_API_KEY,
  fileFilter: (filePath) => {
    if (filePath === '.env') return { status: 'blocked' }
    if (filePath.endsWith('.env.example')) return { status: 'allow-example' }
    return { status: 'allow' }
  },
})
```

**Statuses:** `'blocked'` (returns `[BLOCKED]`), `'allow-example'` (prefixes content with `[TEMPLATE]`), `'allow'`
(normal read).

**Default behavior:** When no `fileFilter` is provided, gitignore checking is applied automatically. When a
`fileFilter` IS provided, the caller owns all filtering.

### Checkpoint & Rewind

The SDK re-exports the persistent checkpoint store used by the CLI's `/rewind` command. One checkpoint per user
turn records the pre-edit content of every file first written that turn (including subagent writes); a turn is
bracketed with `openTurn` → `captureSnapshot` (automatic on writes when `checkpointDir`/`checkpointTurnId` are
passed to `run`) → `closeTurn`.

```typescript
import { listTurns, restoreTurn, forkFrom } from '@savant-code/sdk'

// Show the most recent checkpoints (newest first)
const turns = listTurns(checkpointDir)

// Restore every file the turn touched to its pre-edit content
restoreTurn({ checkpointDir, turnId: turns[0].turnId, projectRoot: process.cwd() })

// Or seed a new session from that turn (files + conversation boundary)
const checkpoint = forkFrom({ checkpointDir, turnId: turns[0].turnId, projectRoot: process.cwd() })
```

Notes:

- Retention is bounded to the most recent 20 turns per checkpoint directory.
- `content: null` entries mean the file was created during the turn — restoring deletes it.
- Every path is re-validated against `projectRoot` at restore; escaped/tampered entries are skipped.
- Turn identity is host-provided (the CLI uses its AI-message id); a `path.basename` guard prevents path-like ids.

### `loadLocalAgents(options)`

Loads agent definitions from `.agents` directories on disk.

```typescript
import { loadLocalAgents, SavantCodeClient } from '@savant-code/sdk'

// Load from default locations (.agents in cwd, parent, or home)
const agents = await loadLocalAgents({ verbose: true })

// Or load from a specific directory
// const agents = await loadLocalAgents({ agentsPath: './my-agents' })

// Or load and validate agents (invalid agents are filtered out)
// const agents = await loadLocalAgents({ validate: true, verbose: true })

// Access source file path for debugging
for (const agent of Object.values(agents)) {
  console.log(`${agent.id} loaded from ${agent._sourceFilePath}`)
}

// Use the loaded agents with client.run()
const client = new SavantCodeClient({ apiKey: process.env.SAVANT_CODE_API_KEY })
const result = await client.run({
  agent: 'my-custom-agent',
  agentDefinitions: Object.values(agents),
  prompt: 'Hello',
})
```

#### Parameters

- **`agentsPath`** (string, optional): Path to a specific agents directory. If omitted, searches in
  `{cwd}/.agents`, `{cwd}/../.agents`, and `{homedir}/.agents`.
- **`verbose`** (boolean, optional): Whether to log errors during loading. Defaults to `false`.
- **`validate`** (boolean, optional): Whether to validate agents after loading. Invalid agents are filtered out.
  Defaults to `false`.

#### Returns

Returns a `Promise<LoadedAgents>` - a `Record<string, LoadedAgentDefinition>` of agent definitions keyed by their ID.

Each `LoadedAgentDefinition` extends `AgentDefinition` with:

- **`_sourceFilePath`** (string): The file path the agent was loaded from

#### Supported File Types

- `.ts`, `.tsx` - TypeScript files (automatically transpiled)
- `.js`, `.mjs`, `.cjs` - JavaScript files

Files ending in `.d.ts` or `.test.ts` are excluded.

### `client.run(options)`

Runs a SavantCode agent with the specified options.

#### Parameters

- **`agent`** (string, required): The agent to run. Use `'base'` for the default agent, or specify a custom agent
  ID if you made your own agent definition (passed with the `agentDefinitions` param).

- **`prompt`** (string, required): The user prompt describing what you want the agent to do.

- **`params`** (object, optional): Additional parameters for the agent. Most agents don't use this, but some custom
  agents can take a JSON object as input in addition to the user prompt string.

- **`handleEvent`** (function, optional): Callback function that receives every event during execution (assistant
  messages, tool calls, etc.). This allows you to stream the agent's progress in real-time. We will likely add a
  token-by-token streaming callback in the future.

- **`previousRun`** (object, optional): JSON state returned from a previous `run()` call. Use this to continue a
  conversation or session with the agent, maintaining context from previous interactions.

- **`projectFiles`** (object, optional): All the files in your project as a plain JavaScript object. Keys should be
  the full path from your current directory to each file, and values should be the string contents of the file.
  Example: `{ "src/index.ts": "console.log('hi')" }`. This helps SavantCode pick good source files for context.
  Note: This parameter was previously named `allFiles` but has been renamed for clarity.

- **`knowledgeFiles`** (object, optional): Knowledge files to inject into every `run()` call. Uses the same schema
  as `projectFiles` - keys are file paths and values are file contents. These files are added directly to the
  agent's context.

- **`agentDefinitions`** (array, optional): Array of custom agent definitions. Each object should satisfy the
  AgentDefinition type.

- **`customToolDefinitions`** (array, optional): Array of custom tool definitions that extend the agent's
  capabilities. Each tool definition includes a name, Zod schema for input validation, and a handler function.
  These tools can be called by the agent during execution.

- **`maxAgentSteps`** (number, optional): Maximum number of steps the agent can take before stopping. Use this as a
  safety measure in case your agent starts going off the rails. A reasonable number is around 20.

#### Returns

Returns a Promise that resolves to either a "success" or a "failure" object.

- The "success" object contains a `RunState` object which can be passed into subsequent runs via the `previousRun`
  parameter to resume the conversation.
- The "failure" object contains an `Error` object with a `name`, `message`, and `stack` properties.

The `RunState` object contains:

- `sessionState`: Internal state to be passed to the next run
- `output`: The agent's output (text, error, or other types)

## License

Apache-2.0 — see [LICENSE](../LICENSE) for full text.

---

<div align="center">

_This SDK ships from the [savant-code/savant-code monorepo](https://github.com/savant0x/savant-code). It runs on
the [ECHO Protocol v0.2.0](ECHO.md) engineering governance system — 15 laws, Perfection Loop FSM, separation of
duties._

**Savant** • 2026
</div>
