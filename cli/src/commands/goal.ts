import { setLoopGoal } from '../hooks/use-loop-scheduler'
import { resetUiToIdle } from '../utils/finish-logic'
import { getSystemMessage, getUserMessage } from '../utils/message-history'

import type { CommandResult, RouterParams } from './command-registry'

/**
 * /goal — Run the agent until a verifiable condition is met.
 *
 * Usage: /goal <condition>
 *
 * The goal condition is injected as a system instruction into the current
 * conversation. The agent evaluates the condition after each AUDIT phase
 * using the SAME model (no separate lighter checker). If satisfied, the
 * loop stops. If not, the agent continues iterating through RED → GREEN → AUDIT.
 *
 * Circuit breakers still apply (max iterations, convergence detection).
 * Goal state is persisted via existing session DB — no new state layer.
 */
export async function handleGoalCommand(
  params: RouterParams,
  args: string,
): Promise<CommandResult> {
  const condition = args.trim()

  if (!condition) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        'Usage: /goal <condition>\n\nExample: /goal all tests pass and lint is clean',
      ),
    ])
    params.saveToHistory(params.inputValue.trim())
    params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
    resetUiToIdle('slash-command')
    return
  }

  // Inject the goal condition as a system instruction into the conversation
  const goalInstruction = [
    `<goal condition="${condition}">`,
    'The agent must keep iterating through the Perfection Loop (RED → GREEN → AUDIT) until the following condition is satisfied:',
    `**${condition}**`,
    '',
    'After each AUDIT phase, evaluate: does the current codebase state satisfy this condition?',
    'If YES: report success and stop the loop.',
    'If NO: continue iterating. Circuit breakers still apply.',
    'The same model evaluates the goal — no separate checker model needed.',
    '</goal>',
  ].join('\n')

  params.setMessages((prev) => [
    ...prev,
    getUserMessage(`/goal ${condition}`),
    getSystemMessage(`🎯 Goal set: "${condition}"\n\nThe agent will now iterate through RED → GREEN → AUDIT until this condition is satisfied. Same model evaluates the goal. Circuit breakers apply.`),
  ])

  params.saveToHistory(`/goal ${condition}`)

  // Persist the goal condition in the scheduler so it survives across loop
  // iterations and is available to any active or future /loop.
  setLoopGoal(condition)

  // Send the goal as a prompt to kick off the loop.
  // The runtime will parse <goal condition="..."> from the message and
  // store it in agentState.goalCondition for evaluation after each task_completed.
  params.sendMessage({
    content: goalInstruction + '\n\nNow begin working toward this goal. Start by analyzing the current state of the codebase.',
    agentMode: params.agentMode,
  })

  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

  setTimeout(() => {
    params.scrollToLatest()
  }, 0)

  return
}


