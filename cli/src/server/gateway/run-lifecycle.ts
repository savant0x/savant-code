// FID-2026-0905-004 — gateway decomposition: run lifecycle + approvals.
//
// The run domain: user_message, trigger injection, interrupt, the approval
// lifecycle that resolves a halted ask_user, and the AskUserBridge
// subscription. The SDK-client default run path lives in
// default-run-prompt.ts (ceiling contingency). Handlers are verbatim moves
// from gateway.ts.

import { randomUUID } from 'node:crypto'

import { AskUserBridge } from '@savant-code/common/utils/ask-user-bridge'

import { loadMostRecentChatState } from '../../utils/run-state-storage'
import {
  failure,
  GATEWAY_ERROR_CODES,
  notification,
  success,
} from '../json-rpc'
import { ensureFlushTimer, pushEvent } from './state'

import type { GatewayContext } from './state'
import type { AskUserResponse } from '@savant-code/common/tools/params/tool/ask-user'
import type { RunState } from '@savant-code/sdk'

/** Execute a user_message: single-session guard, then run and stream. */
export async function handleUserMessage(
  ctx: GatewayContext,
  send: (data: string) => void,
  id: number | string,
  params: unknown,
): Promise<void> {
  if (ctx.activeRun) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.sessionBusy,
          'Session busy: a run is already in flight',
        ),
      ),
    )
    return
  }

  const record = (params ?? {}) as Record<string, unknown>
  const prompt = typeof record.prompt === 'string' ? record.prompt : ''
  if (!prompt.trim()) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          'user_message requires a non-empty prompt',
        ),
      ),
    )
    return
  }

  // Reconnect recovery (v1 scope): a client-supplied previousRun wins;
  // otherwise a continueId resolves through the existing session-restore
  // machinery; otherwise the in-process last settled RunState is reused.
  let previousRun: RunState | undefined
  if (record.previousRun && typeof record.previousRun === 'object') {
    previousRun = record.previousRun as RunState
  } else if (
    typeof record.continueId === 'string' &&
    record.continueId.trim()
  ) {
    const saved = loadMostRecentChatState(record.continueId.trim())
    previousRun = saved?.runState ?? undefined
  } else if (ctx.lastRunState) {
    previousRun = ctx.lastRunState
  }

  const abortController = new AbortController()
  ctx.activeRun = { abortController }
  send(JSON.stringify(success(id, { accepted: true })))

  try {
    const finalState = await ctx.runPrompt({
      prompt,
      previousRun,
      signal: abortController.signal,
      onEvent: (event) => {
        pushEvent(ctx, event)
        ensureFlushTimer(ctx)
      },
      onTextChunk: (chunk) => {
        // TokenStreamEvent → printModeText (design-doc Table 1 mapping).
        pushEvent(ctx, { type: 'text', text: chunk })
        ensureFlushTimer(ctx)
      },
    })
    ctx.lastRunState = finalState
    send(
      JSON.stringify(
        notification('run_complete', {
          ok: true,
          runId: finalState.traceSessionId ?? randomUUID(),
        }),
      ),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    send(
      JSON.stringify(
        notification('run_complete', { ok: false, error: message }),
      ),
    )
  } finally {
    ctx.activeRun = null
  }
}

/**
 * FID-2026-0824-005 (step 2): trigger injection seam. Drives a synthetic
 * directive through the same run path as user_message — single-session
 * guard included — with no WS request context. Events stream to any
 * connected renderer via the normal pushEvent path; the settled RunState
 * lands in lastRunState so the next user_message continues from it.
 * Used by the trigger receiver's injection bridge; not exposed over RPC.
 */
export async function injectTriggerRun(
  ctx: GatewayContext,
  params: { prompt: string; source: 'trigger' },
): Promise<{ accepted: boolean; reason?: string }> {
  if (ctx.activeRun) {
    return {
      accepted: false,
      reason: 'Session busy: a run is already in flight',
    }
  }
  const prompt = params.prompt.trim()
  if (!prompt) {
    return { accepted: false, reason: 'prompt required' }
  }

  const abortController = new AbortController()
  ctx.activeRun = { abortController }
  // Acknowledge-then-run (mirrors the WS user_message path, which sends
  // its success frame before awaiting runPrompt): acceptance resolves
  // immediately — the CALLER's 202 means "accepted", not "completed" —
  // while the run streams events and settles out-of-band. Mid-run
  // failures are the run's outcome: logged, never thrown to the caller.
  void (async () => {
    try {
      const finalState = await ctx.runPrompt({
        prompt,
        previousRun: ctx.lastRunState ?? undefined,
        signal: abortController.signal,
        onEvent: (event) => {
          pushEvent(ctx, event)
          ensureFlushTimer(ctx)
        },
        onTextChunk: (chunk) => {
          pushEvent(ctx, { type: 'text', text: chunk })
          ensureFlushTimer(ctx)
        },
      })
      ctx.lastRunState = finalState
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ctx.logger?.error?.(`trigger-driven run failed: ${message}`)
    } finally {
      ctx.activeRun = null
    }
  })()
  return { accepted: true }
}

/** Interrupt the in-flight run (interrupt_stream method). */
export function handleInterruptStream(
  ctx: GatewayContext,
  send: (data: string) => void,
  id: number | string,
): void {
  if (!ctx.activeRun) {
    send(
      JSON.stringify(
        failure(id, GATEWAY_ERROR_CODES.invalidRequest, 'No run in flight'),
      ),
    )
    return
  }
  ctx.activeRun.abortController.abort(
    new Error('Interrupted by interrupt_stream'),
  )
  send(JSON.stringify(success(id, { interrupting: true })))
}

/** Resolve a pending approval (approval_response method). */
export function handleApprovalResponse(
  ctx: GatewayContext,
  send: (data: string) => void,
  id: number | string,
  params: unknown,
): void {
  const record = (params ?? {}) as Record<string, unknown>
  const approvalId =
    typeof record.approvalId === 'string' ? record.approvalId : ''
  const pending = approvalId ? ctx.pendingApprovals.get(approvalId) : undefined
  if (!pending) {
    send(
      JSON.stringify(
        failure(id, GATEWAY_ERROR_CODES.invalidRequest, 'Unknown approvalId'),
      ),
    )
    return
  }
  const response = record.response as AskUserResponse | undefined
  // Resolve the halted ask_user through the bridge — recorded in history as
  // the tool result, exactly like a TUI answer.
  AskUserBridge.submit({
    answers: response?.answers ?? [],
    skipped: response?.skipped === true,
  })
  ctx.pendingApprovals.delete(approvalId)
  send(JSON.stringify(success(id, { resolved: true })))
}

/**
 * Bridge the agent runtime's ask_user tool to the WS approval lifecycle.
 * AskUserBridge is single-pending; the gateway is the only subscriber in
 * this process (the TUI never mounts in the sidecar). Each request surfaces
 * as an approval_request event and HALTS the run — the bridge promise does
 * not resolve until approval_response arrives (→ AskUserBridge.submit) or
 * the socket closes / the gateway shuts down (→ deny, fail-closed).
 * Returns the unsubscribe function (called by facade stop).
 */
export function subscribeApprovalBridge(ctx: GatewayContext): () => void {
  return AskUserBridge.subscribe((request) => {
    if (!request) return
    const approvalId = randomUUID()
    ctx.pendingApprovals.set(approvalId, {
      deny: () =>
        AskUserBridge.submit({
          answers: [],
          skipped: true,
        }),
      questions: request.questions,
    })
    pushEvent(ctx, {
      type: 'approval_request',
      approvalId,
      requestType: 'deferral',
      content: request.questions as never,
    })
    ensureFlushTimer(ctx)
  })
}
