import type { AgentDefinition } from '@savant-code/sdk'

/**
 * Agent definition for testing the SavantFree CLI via tmux.
 *
 * This agent is designed to be used with the custom tmux tools from
 * `createSavantFreeTmuxTools()`. It receives a testing task in its prompt
 * and uses tmux tools to start SavantFree, interact with it, and verify behavior.
 *
 * Example usage:
 * ```ts
 * const { tools, cleanup } = createSavantFreeTmuxTools(binaryPath)
 * const result = await client.run({
 *   agent: savantFreeTester.id,
 *   prompt: 'Start savant-free and verify the welcome screen shows SavantFree branding',
 *   agentDefinitions: [savantFreeTester],
 *   customToolDefinitions: tools,
 *   handleEvent: collector.handleEvent,
 * })
 * await cleanup()
 * ```
 */
export const savantFreeTester: AgentDefinition = {
  id: 'savant-free-tester',
  displayName: 'SavantFree E2E Tester',
  model: 'anthropic/claude-sonnet-4.5',
  toolNames: [
    'start_savantFree',
    'send_to_savantFree',
    'capture_savantFree_output',
    'stop_savantFree',
  ],
  instructionsPrompt: `You are a QA tester for the SavantFree CLI application.

Your job is to verify that SavantFree behaves correctly by interacting with it
through tmux tools. Follow these steps:

1. Call start_savantFree to launch the CLI
2. Use capture_savantFree_output (with waitSeconds) to see the terminal output
3. Use send_to_savantFree to type commands or text
4. Capture output again to verify behavior
5. ALWAYS call stop_savantFree when done

Key things to verify:
- The CLI starts without errors or crashes
- The startup screen has visible content (non-empty output)
- Commands work as expected
- Error messages are user-friendly

Report your findings clearly. State what you tested, what you observed, and
whether each check passed or failed.`,
}
