import {
  serializeGoalControlDirective,
  serializeGoalSetDirective,
} from '@savant-code/common/util/goal-directives'

import { setLoopGoal } from '../hooks/use-loop-scheduler'
import { useChatStore } from '../state/chat-store'
import { resetUiToIdle } from '../utils/finish-logic'
import { getSystemMessage, getUserMessage } from '../utils/message-history'

import type { CommandResult, RouterParams } from './command-registry'
import type { GoalRecord } from '@savant-code/common/types/session-state'

/**
 * /goal — durable, budgeted goal mode (FID-2026-0814-002).
 *
 * Usage:
 *   /goal <objective> [--budget tokens=N turns=N time=MS]
 *   /goal pause [reason]
 *   /goal resume
 *   /goal cancel
 *   /goal status
 *
 * The objective is embedded in a `<goal-set>` directive as DATA (attribute-
 * escaped); the runtime parses it into a durable goal record owned by
 * `agentState`. The runtime continuation driver then re-injects the objective
 * wrapped in `<untrusted_objective>` once per turn and runs continuation turns
 * until the model completes/blocks, a budget is exhausted, or the ECHO circuit
 * breakers stop it. The legacy `<goal condition>` text path and the loop
 * scheduler's goal attachment remain for backward compatibility.
 */
export async function handleGoalCommand(
  params: RouterParams,
  args: string,
): Promise<CommandResult> {
  const trimmed = args.trim()

  if (!trimmed) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        'Usage: /goal <objective> [--budget tokens=N turns=N time=MS]\n' +
          '       /goal pause | resume | cancel | status\n\n' +
          'Examples:\n' +
          '  /goal make all tests pass and lint clean\n' +
          '  /goal refactor the state layer --budget turns=8 time=600000',
      ),
    ])
    params.saveToHistory(params.inputValue.trim())
    params.setInputValue({
      text: '',
      cursorPosition: 0,
      lastEditDueToNav: false,
    })
    resetUiToIdle('slash-command')
    return
  }

  // Subcommands operate on the existing durable goal record.
  const subcommand = trimmed.split(/\s+/)[0]?.toLowerCase()
  if (
    subcommand === 'pause' ||
    subcommand === 'resume' ||
    subcommand === 'cancel' ||
    subcommand === 'status'
  ) {
    return handleGoalSubcommand(params, trimmed, subcommand)
  }

  // Create: parse optional --budget tokens=N turns=N time=MS
  const { objective, budgetTokens, budgetTurns, budgetTimeMs } =
    parseGoalArguments(trimmed)
  const directive = serializeGoalSetDirective({
    objective,
    ...(budgetTokens !== undefined ? { budgetTokens } : {}),
    ...(budgetTurns !== undefined ? { budgetTurns } : {}),
    ...(budgetTimeMs !== undefined ? { budgetTimeMs } : {}),
  })

  const budgetLine =
    budgetTokens !== undefined ||
    budgetTurns !== undefined ||
    budgetTimeMs !== undefined
      ? `\nBudget: ${[
          budgetTokens !== undefined ? `${budgetTokens} tokens` : '',
          budgetTurns !== undefined ? `${budgetTurns} turns` : '',
          budgetTimeMs !== undefined
            ? `${Math.round(budgetTimeMs / 1000)}s wall-clock`
            : '',
        ]
          .filter(Boolean)
          .join(', ')}`
      : ''

  params.setMessages((prev) => [
    ...prev,
    getUserMessage(`/goal ${objective}`),
    getSystemMessage(
      `🎯 Durable goal set: "${objective}"${budgetLine}\n\n` +
        `The agent will run continuation turns until the objective is verified ` +
        `complete (update_goal), a genuine impasse blocks it, the budget is ` +
        `exhausted, or the ECHO circuit breakers stop it. The objective is ` +
        `injected as DATA — it cannot override system rules.`,
    ),
  ])

  params.saveToHistory(`/goal ${trimmed}`)

  // Keep the legacy loop-scheduler attachment for /loop cadence compatibility.
  setLoopGoal(objective)

  params.sendMessage({
    content:
      `${directive}\n\nNow begin working toward this goal. Start by analyzing the current state ` +
      `of the codebase, then drive the work to completion with verification.`,
    agentMode: params.agentMode,
  })

  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  setTimeout(() => {
    params.scrollToLatest()
  }, 0)

  return
}

function handleGoalSubcommand(
  params: RouterParams,
  raw: string,
  subcommand: 'pause' | 'resume' | 'cancel' | 'status',
): CommandResult {
  // status is client-rendered from the latest session snapshot (the runtime
  // owns the record; the store mirrors it across the SDK boundary).
  if (subcommand === 'status') {
    const goal = useChatStore.getState().runState?.sessionState?.mainAgentState
      ?.goal as GoalRecord | undefined
    const message = goal
      ? renderGoalStatus(goal)
      : 'No durable goal is set in this session. Use /goal <objective> to create one.'
    params.setMessages((prev) => [...prev, getSystemMessage(message)])
    params.saveToHistory(params.inputValue.trim())
    params.setInputValue({
      text: '',
      cursorPosition: 0,
      lastEditDueToNav: false,
    })
    resetUiToIdle('slash-command')
    return
  }

  const rest = raw.replace(subcommand, '').trim()
  const directive =
    subcommand === 'pause'
      ? serializeGoalControlDirective('pause', rest || undefined)
      : subcommand === 'resume'
        ? serializeGoalControlDirective('resume')
        : serializeGoalControlDirective('cancel')

  params.setMessages((prev) => [...prev, getUserMessage(`/goal ${subcommand}`)])
  params.saveToHistory(`/goal ${subcommand}`)
  params.sendMessage({
    content: `${directive}\n\nApply this goal control now and report the resulting status.`,
    agentMode: params.agentMode,
  })
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  setTimeout(() => {
    params.scrollToLatest()
  }, 0)
  return
}

function renderGoalStatus(goal: GoalRecord): string {
  const lines = [
    `🎯 Goal ${goal.goalId} — ${goal.status}`,
    `Objective: ${goal.objective}`,
    ...(goal.completionCriterion
      ? [`Criterion: ${goal.completionCriterion}`]
      : []),
    `Turns: ${goal.turnsUsed} | Tokens: ${goal.tokensUsed} | Wall-clock: ${Math.round(goal.wallClockMs / 1000)}s`,
  ]
  if (goal.budgetLimits) {
    const limits: string[] = []
    if (goal.budgetLimits.tokenBudget !== undefined) {
      limits.push(`tokens ${goal.budgetLimits.tokenBudget}`)
    }
    if (goal.budgetLimits.turnBudget !== undefined) {
      limits.push(`turns ${goal.budgetLimits.turnBudget}`)
    }
    if (goal.budgetLimits.wallClockBudgetMs !== undefined) {
      limits.push(
        `time ${Math.round(goal.budgetLimits.wallClockBudgetMs / 1000)}s`,
      )
    }
    if (limits.length > 0) lines.push(`Budget: ${limits.join(', ')}`)
  }
  if (goal.terminalReason) {
    lines.push(`Reason: ${goal.terminalReason}`)
  }
  return lines.join('\n')
}

/**
 * Parse `/goal <objective> [--budget tokens=N turns=N time=MS]`. Everything
 * before `--budget` is the objective; the budget flags may appear in any
 * order after it.
 */
function parseGoalArguments(raw: string): {
  objective: string
  budgetTokens?: number
  budgetTurns?: number
  budgetTimeMs?: number
} {
  const budgetIndex = raw.indexOf('--budget')
  const objective =
    budgetIndex === -1 ? raw.trim() : raw.slice(0, budgetIndex).trim()
  if (budgetIndex === -1 || !objective) {
    return { objective }
  }
  const budgetPart = raw.slice(budgetIndex)
  const num = (flag: string): number | undefined => {
    const match = budgetPart.match(new RegExp(`${flag}=(\\d+)`))
    return match ? Number(match[1]) : undefined
  }
  return {
    objective,
    budgetTokens: num('tokens'),
    budgetTurns: num('turns'),
    budgetTimeMs: num('time'),
  }
}
