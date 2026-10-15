import { appendFile, mkdir } from 'fs/promises'
import path, { dirname } from 'path'

import { IS_DEV } from '@savant-code/common/env'

import { getCliEnv } from './env'
import { getCurrentChatDir, getProjectRoot } from '../project-files'

import type {
  RuntimeTraceEvent,
  TraceWriter,
} from '@savant-code/common/types/contracts/trace'
import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

const TRACE_FILENAME = 'trace.jsonl'
const MAX_TRACE_VALUE_LENGTH = 160
const MAX_TRACE_REASON_LENGTH = 160
const MAX_RUNTIME_EVENTS = 2_000

function boundedRuntimeEvent(event: RuntimeTraceEvent): RuntimeTraceEvent {
  return {
    ...event,
    runId: event.runId?.slice(0, MAX_TRACE_VALUE_LENGTH),
    agentId: event.agentId.slice(0, MAX_TRACE_VALUE_LENGTH),
    agentType: event.agentType.slice(0, MAX_TRACE_VALUE_LENGTH),
    reason:
      event.reason === undefined
        ? undefined
        : event.reason.slice(0, MAX_TRACE_REASON_LENGTH),
    toolName: event.toolName?.slice(0, 80),
  }
}

type AgentTraceState = {
  /** Roles of messages already written, in order. Used to detect history
   * rewrites (compaction/expiry) without holding onto message objects. */
  writtenRoles: string[]
  system: string | undefined
}

/**
 * Returns whether trace writing is enabled: always in dev, opt-in via
 * SAVANT_CODE_TRACE=1 in production builds (so users don't pay disk for a second
 * copy of their conversation by default).
 */
export function isTraceEnabled(): boolean {
  if (IS_DEV) return true
  // Same accepted values as SAVANT_CODE_FULL_TELEMETRY (see analytics-sampling)
  const flag = getCliEnv().SAVANT_CODE_TRACE
  return flag === '1' || flag === 'true' || flag === 'yes'
}

function getTraceFilePath(): string | null {
  try {
    return IS_DEV
      ? path.join(getProjectRoot(), 'debug', TRACE_FILENAME)
      : path.join(getCurrentChatDir(), TRACE_FILENAME)
  } catch {
    return null // No project root set yet
  }
}

/**
 * Create a TraceWriter that appends agent message histories to trace.jsonl —
 * one message per line, each written exactly once.
 *
 * In dev the trace goes to <projectRoot>/debug/trace.jsonl (next to
 * cli.jsonl); otherwise to the current chat directory. Returns undefined when
 * tracing is disabled.
 *
 * History rewrites (compaction, message expiry) are detected by comparing the
 * role sequence of the incoming history against what was already written; on
 * mismatch a `history_rewritten` marker line is appended followed by the new
 * history. Content-only edits that preserve the role sequence are not
 * re-traced — acceptable for a debug trace.
 */
export function createTraceWriter(
  resolveTraceFilePath: () => string | null = getTraceFilePath,
): TraceWriter | undefined {
  if (!isTraceEnabled()) {
    return undefined
  }

  const agentStates = new Map<string, AgentTraceState>()
  let ensuredDir: string | undefined
  let runtimeEventCount = 0
  let writeChain: Promise<void> = Promise.resolve()

  // Serialize all trace writes through a single promise chain so they are
  // ordered and non-blocking (the prior appendFileSync blocked the event loop
  // on every step in dev). The file path is resolved synchronously at enqueue
  // time because the current chat directory can change between steps.
  // FID-2026-0815-011 E-02: a lazy producer defers the heavy JSON
  // serialization into the chain, off the step hot path.
  const enqueueWrite = (payload: string | (() => string)): void => {
    const filePath = resolveTraceFilePath()
    if (!filePath) return
    const dir = dirname(filePath)
    writeChain = writeChain
      .then(async () => {
        const text = typeof payload === 'function' ? payload() : payload
        if (ensuredDir !== dir) {
          await mkdir(dir, { recursive: true })
          ensuredDir = dir
        }
        await appendFile(filePath, text, 'utf8')
      })
      .catch(() => {
        // Tracing must never break the run
      })
  }

  return {
    recordEvent: (event) => {
      if (runtimeEventCount >= MAX_RUNTIME_EVENTS) return
      runtimeEventCount++
      enqueueWrite(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          type: 'runtime_event',
          ...boundedRuntimeEvent(event),
        }) + '\n',
      )
    },
    recordStep: ({
      agentId,
      agentType,
      runId,
      userInputId,
      step,
      system,
      messages,
    }) => {
      const state = agentStates.get(agentId) ?? {
        writtenRoles: [],
        system: undefined,
      }
      const base: Record<string, JSONValue> = {
        agentId,
        agentType,
        userInputId,
        step,
      }
      if (runId !== undefined) {
        base.runId = runId
      }
      const timestamp = new Date().toISOString()
      // E-02: collect structured records here and serialize inside the async
      // chain below, so message serialization never blocks the step hot path.
      const records: Array<Record<string, JSONValue>> = []
      const appendLine = (record: Record<string, JSONValue>): void => {
        records.push(record)
      }

      // O(1) rewrite detection on the append path: history is append-only in
      // the loop, so the prefix never changes when messages.length grows. The
      // role scan only runs for the (rare) same-length case — a potential
      // in-place role edit — while truncation (compaction/expiry) is caught by
      // the length comparison alone.
      const rewritten =
        messages.length < state.writtenRoles.length ||
        (messages.length === state.writtenRoles.length &&
          state.writtenRoles.some((role, i) => messages[i]?.role !== role))
      if (rewritten) {
        appendLine({
          ...base,
          type: 'history_rewritten',
          previousMessageCount: state.writtenRoles.length,
          messageCount: messages.length,
        })
        state.writtenRoles = []
      }

      if (system !== undefined && system !== state.system) {
        appendLine({ ...base, type: 'system', system })
        state.system = system
      }

      for (let i = state.writtenRoles.length; i < messages.length; i++) {
        const message = messages[i] as Message
        appendLine({
          ...base,
          type: 'message',
          index: i,
          // Trust-boundary cast: Message is a runtime value that must be
          // JSON-serializable for the trace file, which JSONValue models.
          message: message as unknown as JSONValue,
        })
        // Append the role incrementally instead of a full `messages.map`
        // rebuild on every call.
        state.writtenRoles.push(message.role)
      }

      agentStates.set(agentId, state)

      if (records.length === 0) return
      // `timestamp` is captured here so every line keeps the step's time;
      // `records` holds structured values (message references are never
      // mutated in place by the loop), so deferring the stringify is safe.
      enqueueWrite(
        () =>
          records
            .map((record) => JSON.stringify({ timestamp, ...record }))
            .join('\n') + '\n',
      )
    },
    flush: async () => {
      await writeChain
    },
  }
}
