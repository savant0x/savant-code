import fs from 'fs'
import path from 'path'

import {
  parseDrivePlanDirective,
  serializeDriveControlDirective,
  serializeDriveLockDirective,
} from '@savant-code/common/util/drive-directives'
import { generateCompactId } from '@savant-code/common/util/string'

import { clearInput } from './command-shared'
import { buildAutoPrompt } from './prompt-builders'
import { useChatStore } from '../state/chat-store'
import { resetUiToIdle } from '../utils/finish-logic'
import { getSystemMessage, getUserMessage } from '../utils/message-history'

import type { CommandResult, RouterParams } from './command-registry'
import type { DriveRecord } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0818-002: Auto Drive entry + one-time approval gate.
 *
 * `/auto-drive "<goal>"` → clarity (interview if underspecified) → pre-build plan
 * presented → Confirm / Revise / Cancel. Confirm is the single Law 2 approval
 * and locks drive mode: the CLI serializes a `<drive-lock>` directive that the
 * runtime parses to record the durable drive and strip the interactive tools
 * for the rest of the run.
 */

const AUTO_USAGE =
  'Usage: /auto-drive "<goal>" [--spec <path>]\n\n' +
  '  /auto-drive "fix the flaky login tests"      — clarify then plan, then confirm\n' +
  '  /auto-drive --spec ./login-spec.md           — skip the interview, use the file as the spec'

function parseAutoArgs(raw: string): { goal: string; specPath?: string } {
  const specMatch = raw.match(/--spec\s+(\S+)/)
  const specPath = specMatch?.[1]
  const goal = raw.replace(/--spec\s+\S+/, '').trim()
  return { goal, ...(specPath ? { specPath } : {}) }
}

function readSpecFile(specPath: string): string | null {
  try {
    const resolved = path.isAbsolute(specPath)
      ? specPath
      : path.resolve(process.cwd(), specPath)
    if (!fs.existsSync(resolved)) return null
    return fs.readFileSync(resolved, 'utf8')
  } catch {
    return null
  }
}

/**
 * Extract the single `<drive-plan .../>` directive the model emits at the end
 * of planning. Returns the raw directive substring, or null if absent.
 */
export function extractDrivePlanDirective(text: string): string | null {
  const match = text.match(/<drive-plan\s+[^>]*\/>/)
  return match ? match[0] : null
}

export type DrivePlanFields = {
  goal: string
  plan: string
  acceptanceCriteria: string[]
  resolutionPolicy?: string
}

/**
 * Parse the confirmation fields out of a `<drive-plan>` directive. Used by the
 * confirmation surface to pre-fill the editable plan; on Confirm the (possibly
 * edited) fields are re-serialized into a `<drive-lock>`.
 */
export function parseDrivePlanForConfirmation(
  directiveText: string,
): DrivePlanFields | null {
  const plan = parseDrivePlanDirective(directiveText)
  if (!plan) return null
  return {
    goal: plan.goal,
    plan: plan.plan,
    acceptanceCriteria: plan.acceptanceCriteria,
    ...(plan.resolutionPolicy
      ? { resolutionPolicy: plan.resolutionPolicy }
      : {}),
  }
}

/**
 * Build the message the CLI sends when the operator Confirms the plan. The
 * `<drive-lock>` directive is what the runtime parses to record the drive and
 * strip the interactive tools; the trailing instructions + plan text are the
 * drive's working context.
 */
export function buildDriveLockMessage(
  fields: DrivePlanFields,
  driveId: string | null,
): string {
  const directive = serializeDriveLockDirective({
    driveId: driveId ?? undefined,
    goal: fields.goal,
    acceptanceCriteria: fields.acceptanceCriteria,
    ...(fields.resolutionPolicy
      ? { resolutionPolicy: fields.resolutionPolicy }
      : {}),
  })
  return (
    `${directive}\n\nDrive mode is now locked. Begin executing the approved ` +
    `plan to completion. Do not ask the operator any questions, do not suggest ` +
    `follow-ups, and do not end your turn until the acceptance criteria are ` +
    `met. Record progress and evidence in FIDs.\n\nApproved plan:\n\n${fields.plan}`
  )
}

/**
 * FID-2026-0818-007: build the message that applies a `<drive-control>` action
 * to the runtime. Shared by the `/auto-drive pause|stop|resume` subcommands and the
 * TUI Esc hook so the two surfaces send the exact same directive.
 */
export function buildDriveControlMessage(
  action: 'pause' | 'resume' | 'stop',
  reason?: string,
): string {
  const directive = serializeDriveControlDirective(action, reason)
  return `${directive}\n\nApply this drive control now and report the resulting drive status.`
}

/**
 * FID-2026-0818-007: `/auto-drive status | resume | pause | stop`. `status` renders
 * the durable drive record (owned by the runtime, mirrored across the SDK
 * boundary); pause/resume/stop send the `<drive-control>` directive.
 */
function handleAutoSubcommand(
  params: RouterParams,
  raw: string,
  subcommand: 'status' | 'resume' | 'pause' | 'stop',
): CommandResult {
  if (subcommand === 'status') {
    const drive = useChatStore.getState().runState?.sessionState?.mainAgentState
      ?.drive as DriveRecord | undefined
    const message = drive
      ? renderDriveStatus(drive)
      : 'No Auto Drive run is active in this session. Use /auto-drive "<goal>" to start one.'
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
  const content =
    subcommand === 'resume'
      ? buildDriveControlMessage('resume')
      : buildDriveControlMessage(subcommand, rest || undefined)

  params.setMessages((prev) => [
    ...prev,
    getUserMessage(`/auto-drive ${subcommand}`),
  ])
  params.saveToHistory(`/auto-drive ${subcommand}`)
  params.sendMessage({
    content,
    agentMode: params.agentMode,
  })
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  setTimeout(() => {
    params.scrollToLatest()
  }, 0)
  return
}

function renderDriveStatus(drive: DriveRecord): string {
  const lines = [
    `🛞 Auto Drive ${drive.driveId} — ${drive.status}`,
    `Goal: ${drive.goal}`,
    `Acceptance criteria: ${drive.acceptanceCriteria.length}`,
    ...(drive.activeFid ? [`Active FID: ${drive.activeFid}`] : []),
    ...(drive.expectPhase ? [`Phase: ${drive.expectPhase}`] : []),
  ]
  if (drive.resolutionPolicy) {
    lines.push(`Resolution policy: ${drive.resolutionPolicy}`)
  }
  return lines.join('\n')
}

/** Build the message sent when the operator chooses Revise. */
export function buildReviseMessage(notes: string): string {
  const trimmed = notes.trim() || 'the plan as a whole'
  return (
    `The operator rejected the pre-build plan with these notes:\n\n${trimmed}\n\n` +
    `Revise the plan accordingly (do not write code), then emit a single updated ` +
    `<drive-plan goal="..." plan="..." acceptanceCriteria="[...]" ` +
    `resolutionPolicy="..."/> directive for re-confirmation.`
  )
}

export async function handleAutoCommand(
  params: RouterParams,
  args: string,
): Promise<CommandResult> {
  const trimmed = args.trim()

  const subcommand = trimmed.split(/\s+/)[0]?.toLowerCase()
  if (
    subcommand === 'status' ||
    subcommand === 'resume' ||
    subcommand === 'pause' ||
    subcommand === 'stop'
  ) {
    return handleAutoSubcommand(params, trimmed, subcommand)
  }

  if (!trimmed) {
    params.setMessages((prev) => [...prev, getSystemMessage(AUTO_USAGE)])
    params.saveToHistory(params.inputValue.trim())
    clearInput(params)
    return
  }

  const { goal, specPath } = parseAutoArgs(trimmed)

  let prompt: string
  if (specPath) {
    const spec = readSpecFile(specPath)
    if (spec === null) {
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(`Could not read spec file: ${specPath}`),
      ])
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      return
    }
    prompt = buildAutoPrompt(
      `${spec}\n\n(The above is a detailed spec supplied via file — skip the interview and go straight to the plan.)`,
    )
  } else {
    prompt = buildAutoPrompt(goal)
  }

  const store = useChatStore.getState()
  // STRICT pin: the whole drive (planning + execution) runs under the STRICT
  // agent so no direct writes / phase skipping / self-verification can occur.
  store.setAgentMode('STRICT')
  store.setDriveState('planning')
  store.setDriveMode(false)
  store.setDrivePlanDraft(null)
  store.setActiveAutoRunId(generateCompactId())

  params.setMessages((prev) => [
    ...prev,
    getUserMessage(`/auto-drive ${trimmed}`),
  ])
  params.saveToHistory(`/auto-drive ${trimmed}`)
  clearInput(params)

  params.sendMessage({ content: prompt, agentMode: 'STRICT' })
  setTimeout(() => {
    params.scrollToLatest()
  }, 0)

  return
}
