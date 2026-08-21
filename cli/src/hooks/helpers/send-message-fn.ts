import { handleRunCompletion } from './send-message'
import { type QueueResetDeps } from './send-message-failure'
import { startRunMonitors } from './send-message-monitors'
import { prepareSendRun } from './send-message-prepare'
import { buildSendRunConfig } from './send-message-run-config'
import { createSidebarEventCallbacks } from './send-message-sidebar'
import { finalizeRunStreaming, handleRunCatch } from './send-message-stream'
import { useChatStore } from '../../state/chat-store'
import { loadAgentDefinitions } from '../../utils/local-agent-registry'
import { logger } from '../../utils/logger'
import { createRunOutcomeReporter } from '../run-outcome'

import type { SendMessageFn } from '../../types/contracts/send-message'
import type { CreateSendMessageBodyParams } from '../use-send-message-options'

/**
 * The sendMessage body as a plain function so the hook file stays under the
 * line bar (FID-2026-0805-003). All hook-scoped state is passed in via the
 * params object; behavior is identical to the in-hook callback.
 */
export const createSendMessageBody = (
  params: CreateSendMessageBodyParams,
): SendMessageFn => {
  const {
    inputRef,
    isChainInProgressRef,
    setStreamStatus,
    setCanProcessQueue,
    abortControllerRef,
    isQueuePausedRef,
    isProcessingQueueRef,
    setMessages,
    setFocusedAgentId,
    setInputFocused,
    setStreamingAgents,
    setHasReceivedPlanResponse,
    addSessionCredits,
    setRunState,
    setIsRetrying,
    previousRunStateRef,
    streamRefs,
    heartbeatIntervalRef,
    stalledWatcher,
    updateChainInProgress,
    addActiveSubagent,
    removeActiveSubagent,
    prepareUserMessage,
    agentId,
    onBeforeMessageSend,
    mainAgentTimer,
    scrollToLatest,
    onTimerEvent = () => {},
    resumeQueue,
    requeueMessageAtFront,
    subscriptionData,
  } = params

  return async ({
    content,
    agentMode,
    postUserMessage,
    attachments,
    onRunOutcome,
  }) => {
    const reportRunOutcome = createRunOutcomeReporter(onRunOutcome, (error) => {
      logger.warn({ error }, '[send-message] Run outcome observer failed')
    })
    // CRITICAL: Set chain in progress immediately (synchronously) before any async work.
    // This ensures the router can detect that we're busy and queue subsequent messages.
    // Set the ref directly first to guarantee immediate visibility to other code paths,
    // then call updateChainInProgress to also update React state for re-renders.
    isChainInProgressRef.current = true
    updateChainInProgress(true)
    setCanProcessQueue(false)

    // Shared early-return release bundle for every pre-stream failure path.
    const queueReset: QueueResetDeps = {
      setCanProcessQueue,
      updateChainInProgress,
      isProcessingQueueRef,
      isQueuePausedRef,
    }

    // Pre-stream preparation (SavantFree guard, message prep, validation,
    // focus/FSM reset, client init, streaming context, AI shell, lifecycle
    // open) moved verbatim to send-message-prepare.ts (Loop 132).
    const preparedRun = await prepareSendRun({
      reportRunOutcome,
      requeueMessageAtFront,
      queueReset,
      setHasReceivedPlanResponse,
      mainAgentTimer,
      onTimerEvent,
      agentId,
      setIsRetrying,
      prepareUserMessage,
      setMessages,
      onBeforeMessageSend,
      scrollToLatest,
      setFocusedAgentId,
      setInputFocused,
      inputRef,
      streamRefs,
      abortControllerRef,
      setStreamStatus,
      setCanProcessQueue,
      isQueuePausedRef,
      isProcessingQueueRef,
      updateChainInProgress,
      setStreamingAgents,
      previousRunStateRef,
      setRunState,
      content,
      agentMode,
      postUserMessage,
      attachments,
    })
    if (!preparedRun) {
      return
    }
    const {
      client,
      updater,
      hasReceivedContentRef,
      abortController,
      aiMessageId,
      timerController,
      finalContent,
      messageContent,
      bashContextForPrompt,
      runLifecycle,
      checkpointDir,
    } = preparedRun
    // Note: updateChainInProgress(true) and setCanProcessQueue(false) are already
    // called at the start of sendMessage to ensure they happen synchronously
    // before any async work, so the router can correctly detect busy state.
    let actualCredits: number | undefined

    // Execute SDK run with streaming handlers
    try {
      const agentDefinitions = loadAgentDefinitions()
      const sidebarCallbacks = createSidebarEventCallbacks({
        subscriptionData,
        addSessionCredits,
        onCost: (cost: number) => {
          actualCredits = cost
        },
      })

      const {
        runConfig,
        mainAgentName,
        resolvedContextWindow,
        effectivePrompt,
      } = buildSendRunConfig({
        logger,
        agentMode,
        agentId,
        agentDefinitions,
        bashContextForPrompt,
        finalContent,
        messageContent,
        previousRunState: previousRunStateRef.current,
        signal: abortController.signal,
        checkpointDir,
        checkpointTurnId: aiMessageId,
        devMode: useChatStore.getState().devMode,
        permissionMode: useChatStore.getState().permissionMode,
        streamRefs,
        setStreamingAgents,
        setStreamStatus,
        aiMessageId,
        updater,
        hasReceivedContentRef,
        addActiveSubagent,
        removeActiveSubagent,
        setHasReceivedPlanResponse,
        setIsRetrying,
        sidebarCallbacks,
        onStateSnapshot: (snapshot) => runLifecycle.onStateSnapshot(snapshot),
      })

      startRunMonitors({
        heartbeatIntervalRef,
        getLatestRunStateSnapshot: runLifecycle.getLatestRunStateSnapshot,
        stalledWatcher,
        runConfig,
        effectivePrompt,
        messageContent,
        previousMessageCount:
          previousRunStateRef.current?.sessionState?.mainAgentState
            .messageHistory.length ?? 0,
        agentDefinitionCount: agentDefinitions.length,
        mainAgentName,
        resolvedContextWindow,
      })

      const runState = await client.run(runConfig)
      reportRunOutcome(
        runState.output && runState.output.type !== 'error'
          ? 'success'
          : 'failure',
      )

      // Only adopt and persist the result while this run's chat is still
      // the active one (see createRunLifecycle: after a mid-run chat switch
      // the store's messages belong to the new conversation).
      if (runLifecycle.getRunChatIsCurrent()) {
        await runLifecycle.adoptAndPersist(runState)
      }
      handleRunCompletion({
        runState,
        actualCredits,
        agentMode,
        timerController,
        updater,
        aiMessageId,
        wasAbortedByUser: abortController.signal.aborted,
        hasReceivedContent: hasReceivedContentRef.current,
        setStreamStatus,
        setCanProcessQueue,
        updateChainInProgress,
        setHasReceivedPlanResponse,
        resumeQueue,
        isProcessingQueueRef,
        isQueuePausedRef,
      })
    } catch (error) {
      await handleRunCatch({
        error,
        abortController,
        reportRunOutcome,
        timerController,
        updater,
        setIsRetrying,
        setStreamStatus,
        queueReset,
        hasReceivedContent: hasReceivedContentRef.current,
        getRunChatIsCurrent: runLifecycle.getRunChatIsCurrent,
        persistFailureState: runLifecycle.persistFailureState,
      })
    } finally {
      // Streaming cleanup (run-completed flag, canonical reset, timers,
      // chain-lock safety net, updater dispose) then lifecycle teardown
      // (checkpoint close + provider/aborter release).
      finalizeRunStreaming({
        streamRefs,
        abortController,
        heartbeatIntervalRef,
        stalledWatcher,
        isChainInProgressRef,
        setStreamStatus,
        queueReset,
        updater,
      })
      // FID-2026-0815-005 (F-04): closeTurn is now async — await the
      // checkpoint persistence before the finally block completes.
      await runLifecycle.finalize()
    }
  }
}
