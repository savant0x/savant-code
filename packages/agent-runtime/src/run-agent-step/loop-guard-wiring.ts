/**
 * FID-2026-1006-003 WP3: the step loop's guard-rail wiring.
 *
 * FID-2026-1006-002 shipped `determineNextAction` with no caller, so the loop
 * ran unguarded at runtime: nothing could name WHY a turn should stop, and a
 * repeated plan was never handed to the model one task at a time. This module
 * is the missing caller — it carries the per-run guard state across
 * iterations, builds the decision context from what the loop actually knows,
 * and returns the action for the loop to honour.
 *
 * The `role:event` history reuses the tool-call signature the runtime's
 * anti-runaway guards already compute (`buildToolCallSignature` →
 * `agentState.lastToolCallSignature`), so "the same cycle repeating" means the
 * same real tool calls repeating — a step that issued no tool call records the
 * empty signature, which keeps a cycle broken rather than counting it.
 */
import { determineNextAction } from './loop-guard-rails'

import type { LoopAction, LoopEvent, RoleBudget } from './loop-guard-rails'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/** Per-run guard state, carried by the step loop across iterations. */
export type LoopGuardState = {
  /** Run start, on the same clock the caller injects. */
  startedAt: number
  /** The run's iteration budget (its initial `stepsRemaining`). */
  iterationCap: number
  /** The acting role — the agent type for a single-agent run. */
  role: string
  /** `role:event` history, one entry per completed LLM step. */
  history: LoopEvent[]
  /** The last task handed to the model, so a task is injected exactly once. */
  lastInjectedTask?: string
}

export function createLoopGuardState(params: {
  role: string
  iterationCap: number
  startedAt?: number
}): LoopGuardState {
  return {
    startedAt: params.startedAt ?? Date.now(),
    iterationCap: params.iterationCap,
    role: params.role,
    history: [],
  }
}

/**
 * Record one completed step. `signature` is the step's tool-call signature
 * (`''` when the step issued no tool call) — recorded rather than skipped, so
 * a step that did nothing breaks a repeating cycle instead of being invisible
 * to the detector.
 */
export function recordLoopEvent(
  state: LoopGuardState,
  signature: string,
): void {
  state.history.push({ role: state.role, event: signature })
}

type ToolCallPart = { toolName: string; input: unknown }

function toolCallParts(message: Message | undefined): ToolCallPart[] {
  if (!message || !Array.isArray(message.content)) return []
  const parts: ToolCallPart[] = []
  for (const part of message.content) {
    if (part.type !== 'tool-call' || typeof part.toolName !== 'string') continue
    parts.push({ toolName: part.toolName, input: part.input })
  }
  return parts
}

type Todo = { task: string; completed: boolean }

function asTodos(input: unknown): Todo[] {
  if (typeof input !== 'object' || input === null) return []
  const raw = (input as { todos?: unknown }).todos
  if (!Array.isArray(raw)) return []
  const todos: Todo[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as { task?: unknown; completed?: unknown }
    if (typeof record.task !== 'string' || record.task.trim() === '') continue
    todos.push({ task: record.task, completed: record.completed === true })
  }
  return todos
}

function todoLine(todo: Todo): string {
  return `- [${todo.completed ? 'x' : ' '}] ${todo.task}`
}

/**
 * The newest `write_todos` call rendered as a markdown checklist, or undefined
 * when the run has no plan (every bundled test harness does). The guard hands
 * the model the next unchecked task from exactly this text.
 */
export function checklistFromHistory(messages: Message[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const call = toolCallParts(messages[index]).find(
      (part) => part.toolName === 'write_todos',
    )
    if (!call) continue
    const todos = asTodos(call.input)
    return todos.length > 0 ? todos.map(todoLine).join('\n') : undefined
  }
  return undefined
}

/**
 * The orchestration decision for one iteration. Pure apart from the clock the
 * caller injects: the same state, iteration and messages always yield the same
 * action, which is what makes the guard auditable.
 *
 * The role budget is the run's own iteration budget, because no per-role
 * budget is configured anywhere today — a per-role limit invented here would
 * be a policy the operator never declared (recorded as a fork on the FID).
 * `deadlineMs` is omitted for the same reason: this loop has no deadline.
 */
export function evaluateLoopGuard(params: {
  state: LoopGuardState
  iteration: number
  now: number
  messages: Message[]
}): LoopAction {
  const { state, iteration, now, messages } = params
  const roleBudget: RoleBudget = {
    limit: state.iterationCap,
    activations: iteration,
  }
  const checklist = checklistFromHistory(messages)
  return determineNextAction({
    now,
    startedAt: state.startedAt,
    iteration,
    iterationCap: state.iterationCap,
    role: state.role,
    roleBudget,
    history: state.history,
    ...(checklist === undefined ? {} : { checklist }),
  })
}
