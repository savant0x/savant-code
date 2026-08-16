/**
 * `/learn` command — FID-2026-0813-018.
 *
 * Live entry point for the Agent-Steering Teacher. The command drives the
 * headless exercise engine with the live Forge agent, the subprocess sandbox,
 * and the equivalence/detection graders; the chat renders bounded lifecycle
 * events. Private known-good answers, hidden tests, and mutation contracts
 * never reach the learner, Forge prompt, or UI.
 */
import { progressLines } from './learn-progress'
import { resultLines } from './learn-result'
import { useChatStore } from '../state/chat-store'
import {
  cancelTeacherExercise,
  exitTeacherExercise,
  getTeacherSessionState,
  readTeacherProgress,
  startTeacherExercise,
  submitTeacherCritique,
} from '../teacher/runtime'
import { getSystemMessage } from '../utils/message-history'

import type { RouterParams } from './command-registry'
import type {
  AttemptEvent,
  CritiqueSubmission,
} from '@savant-code/common/teacher'

const LIFECYCLE = [
  'steering_submitted → forge_running → sandbox_running → equivalence_review',
  '→ detection_review → learner_critique → adjudication → result',
].join('\n')

const EVENT_LABELS: Record<AttemptEvent['type'], string> = {
  steering_submitted: 'steering received',
  forge_running: 'Forge producing a solution…',
  sandbox_running: 'sandbox running hidden tests…',
  equivalence_review: 'equivalence review…',
  detection_review: 'injecting a seeded defect…',
  learner_critique: 'awaiting your critique',
  adjudication: 'adjudicating your critique…',
  result: 'result',
}

function overviewLines(): string[] {
  return [
    '🎓 **Agent-Steering Teacher** — train how to direct and review an AI coding agent.',
    '',
    'The teacher measures behavioral invariants, evidence requests, edge-case',
    'reasoning, and flaw detection — not prompt length or model eloquence.',
    '',
    '**Lifecycle** (live engine):',
    LIFECYCLE,
    '',
    '**Commands**',
    '- `/learn start <steering>` — run an exercise: steering → Forge → sandbox → graders',
    '- `/learn critique "<statement>" [--location <text>] [--witness <text>] [--impact <text>]` — submit your review',
    '- `/learn progress` — show your local, versioned competency record',
    '- `/learn cancel` — abort the active attempt (cleanup, no credit)',
    '- `/learn exit` — leave the teacher and restore your prior chat unchanged',
    '',
    'This surface renders only rubric-safe events. Private known-good answers,',
    'hidden tests, and mutation contracts never reach the learner, Forge, or UI.',
  ]
}

function usageLines(): string[] {
  return [
    'Usage:',
    '  /learn start <steering>',
    '  /learn critique "<statement>" [--location <text>] [--witness <text>] [--impact <text>]',
    '  /learn progress',
    '  /learn cancel',
    '  /learn exit',
  ]
}

/** Parse a critique with optional structured `--location/--witness/--impact`. */
export function parseCritique(raw: string): CritiqueSubmission {
  const submission: CritiqueSubmission = { statement: '' }
  const text = raw
    .trim()
    .replace(
      /--(location|witness|impact)\s+("[^"]*"|'[^']*'|\S+)/g,
      (_full, key: string, value: string) => {
        ;(submission as Record<string, string>)[key] = value.replace(
          /^["']|["']$/g,
          '',
        )
        return ' '
      },
    )
  submission.statement = text.replace(/\s+/g, ' ').trim()
  return submission
}

async function handleStart(
  params: RouterParams,
  steering: string,
): Promise<void> {
  params.setMessages((prev) => [
    ...prev,
    getSystemMessage(`🎓 **Starting exercise.** Steering: "${steering}"`),
  ])

  try {
    const early = await startTeacherExercise(steering, {
      onEvent: (event) => {
        params.setMessages((prev) => [
          ...prev,
          getSystemMessage(`  · ${EVENT_LABELS[event.type]}`),
        ])
        // FID-2026-0813-022: mirror the runtime state into the sidebar store
        // so the live panel tracks each phase.
        useChatStore.getState().setTeacherState(getTeacherSessionState())
      },
    })

    // FID-2026-0813-022: capture the final snapshot — the receipt, persisted,
    // and competency state are set after the last lifecycle event fires.
    useChatStore.getState().setTeacherState(getTeacherSessionState())

    if (early) {
      const state = getTeacherSessionState()
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(
          resultLines(
            early,
            state.receipt,
            state.persisted,
            state.competencyState,
          ).join('\n'),
        ),
      ])
    } else {
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(
          [
            '🔍 **Your turn.** A seeded defect was injected into the solution.',
            '',
            'Describe the flaw you found:',
            '  /learn critique "<statement>" --location <text> --witness <text> --impact <text>',
            '',
            'A passing critique names an acceptable concept and covers the',
            'required evidence (location + witness).',
          ].join('\n'),
        ),
      ])
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'unknown exercise error'
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(`⚠️ Exercise failed: ${message}`),
    ])
  }
}

function handleCritique(params: RouterParams, raw: string): void {
  const submission = parseCritique(raw)
  if (!submission.statement) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(usageLines().join('\n')),
    ])
    return
  }

  try {
    const result = submitTeacherCritique(submission)
    const state = getTeacherSessionState()
    useChatStore.getState().setTeacherState(state)
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        resultLines(
          result,
          state.receipt,
          state.persisted,
          state.competencyState,
        ).join('\n'),
      ),
    ])
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'unknown critique error'
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(`⚠️ Critique failed: ${message}`),
    ])
  }
}

export async function handleLearnCommand(
  params: RouterParams,
  args: string,
): Promise<void> {
  params.saveToHistory(params.inputValue.trim())
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

  const tokens = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = tokens[0] ?? ''
  const rest = tokens.slice(1).join(' ').trim()

  let lines: string[]
  if (subcommand === 'start') {
    if (!rest) {
      lines = [
        '🎓 **Teacher exercise.** Provide a steering constraint:',
        '',
        ...usageLines(),
      ]
    } else {
      await handleStart(params, rest)
      return
    }
  } else if (subcommand === 'critique') {
    handleCritique(params, rest)
    return
  } else if (subcommand === 'progress') {
    lines = progressLines(readTeacherProgress())
  } else if (subcommand === 'cancel') {
    cancelTeacherExercise()
    useChatStore.getState().setTeacherState(getTeacherSessionState())
    lines = [
      '🛑 **Exercise cancelled.**',
      '',
      'The attempt ends as `cancelled` — no credit is awarded, temporary',
      'sandbox workspaces are cleaned up, and your chat is left as it was.',
    ]
  } else if (subcommand === 'exit') {
    exitTeacherExercise()
    useChatStore.getState().clearTeacher()
    lines = [
      '👋 **Leaving the teacher.**',
      '',
      'Ordinary chat resumes unchanged. No repository writes, no progression',
      'records, and no teacher state were modified.',
    ]
  } else {
    lines = overviewLines()
  }

  params.setMessages((prev) => [...prev, getSystemMessage(lines.join('\n'))])
}
