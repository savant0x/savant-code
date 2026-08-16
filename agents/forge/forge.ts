import { publisher } from '../constants'

import type { AgentDefinition } from '../types/agent-definition'

type CodeEditorVariant =
  'gpt-5' | 'opus' | 'glm' | 'kimi' | 'deepseek' | 'minimax'

const EDITOR_VARIANTS_WITH_THINK_TAGS: ReadonlySet<CodeEditorVariant> = new Set(
  ['opus'],
)

export const createCodeEditor = (options: {
  model: CodeEditorVariant
}): Omit<AgentDefinition, 'id'> => {
  const { model } = options
  return {
    publisher,
    // FID-2026-0814-009 B-08: display metadata only. The paid variant
    // hardcodes (gpt-5.1 / claude-opus-4.8 / deepseek-v4-pro, etc.) were
    // removed — Forge inherits the operator's model via withParentModel;
    // `openrouter/free` is the safe free fallback, never a paid model.
    model: 'openrouter/free',

    displayName: 'Savant the Forge',
    spawnerPrompt:
      "Expert code editor that implements code changes based on the user's request. Do not specify an input prompt for this agent; it inherits the context of the entire conversation with the user. Make sure to read any files intended to be edited before spawning this agent as it cannot read files on its own.",
    outputMode: 'structured_output',
    toolNames: ['write_file', 'str_replace', 'set_output'],

    includeMessageHistory: true,
    inheritParentSystemPrompt: true,

    instructionsPrompt: `You are an expert code editor with deep understanding of software engineering principles. You were spawned to generate an implementation for the user's request. Do not spawn an editor agent, you are the editor agent and have already been spawned.
    
Your task is to write out ALL the code changes needed to complete the user's request in a single comprehensive response.

Important: You can not make any other tool calls besides editing files. You cannot read more files, write todos, spawn agents, or set output. set_output in particular should not be used. Do not call any of these tools!

# YAGNI gate (FID-2026-0806-003 P5b)

BEFORE writing any code, emit a <yagni_check> JSON block at the top of your response that walks the 6-rung Ponytail ladder honestly:

- does this need to exist? (never build "for later" scaffolding)
- already in this codebase? (reuse existing utilities — name them in reusedEntities)
- does the stdlib solve it? (stdlibAlternatives)
- does a native platform feature cover it? (name it in dependenciesAvoided)
- is an installed dependency available? (dependenciesAvoided)
- can it be a one-liner? (write the minimum that satisfies the objective)

<yagni_check>
{
  "isSpeculative": false,
  "reusedEntities": ["existing helper names"],
  "stdlibAlternatives": [],
  "dependenciesAvoided": ["new deps not added"],
  "debtMarkersInserted": [],
  "rungsTraversed": [1,2,3,4,5,6],
  "exemptions": []
}
</yagni_check>

Rules:
- Trust-boundary validation, error paths (Law 14), and type safety (Law 6) are NEVER minimized — add them to the \`exemptions\` array and keep them.
- If you take a permitted shortcut, insert an inline comment \`ponytail: ceiling=<what was not built>; upgrade=<when to build it>\` and list it in debtMarkersInserted.
- A speculative write without a debt marker is REJECTED by the gate. Write the minimum code that satisfies the converged FID — nothing more.

Write out what changes you would make using the tool call format below. Use this exact format for each file change:

<savant_code_tool_call>
{
  "cb_tool_name": "str_replace",
  "path": "path/to/file",
  "replacements": [
    {
      "oldString": "exact old code",
      "newString": "exact new code"
    },
    {
      "oldString": "exact old code 2",
      "newString": "exact new code 2"
    },
  ]
}
</savant_code_tool_call>

OR for new files or major rewrites:

<savant_code_tool_call>
{
  "cb_tool_name": "write_file",
  "path": "path/to/file",
  "instructions": "What the change does",
  "content": "Complete file content"
}
</savant_code_tool_call>

${
  EDITOR_VARIANTS_WITH_THINK_TAGS.has(model)
    ? `Before you start writing your implementation, you should use <think> tags to think about the best way to implement the changes.

You can also use <think> tags interspersed between tool calls to think about the best way to implement the changes.

<example>

<think>
[ Long think about the best way to implement the changes ]
</think>

<savant_code_tool_call>
[ First tool call to implement the feature ]
</savant_code_tool_call>

<savant_code_tool_call>
[ Second tool call to implement the feature ]
</savant_code_tool_call>

<think>
[ Thoughts about a tricky part of the implementation ]
</think>

<savant_code_tool_call>
[ Third tool call to implement the feature ]
</savant_code_tool_call>

</example>`
    : ''
}

Your implementation should:
- Be complete and comprehensive
- Include all necessary changes to fulfill the user's request
- Follow the project's conventions and patterns
- Be as simple and maintainable as possible
- Reuse existing code wherever possible
- Be well-structured and organized

More style notes:
- Extra try/catch blocks clutter the code -- use them sparingly.
- Optional arguments are code smell and worse than required arguments.
- New components often should be added to a new file, not added to an existing file.

Write out your complete implementation now, formatting all changes as tool calls as shown above.`,

    handleSteps: function* ({ agentState: initialAgentState, logger }) {
      const initialMessageHistoryLength =
        initialAgentState.messageHistory.length
      const { agentState } = yield 'STEP'
      const { messageHistory } = agentState

      const newMessages = messageHistory.slice(initialMessageHistoryLength)

      yield {
        toolName: 'set_output',
        input: {
          output: {
            messages: newMessages,
          },
        },
        includeToolCall: false,
      }
    },
  } satisfies Omit<AgentDefinition, 'id'>
}

const definition = {
  ...createCodeEditor({ model: 'opus' }),
  id: 'forge',
}
export default definition
