import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'

import { runBashCommand } from './bash'
import { trackUserInputAnalytics } from './route-analytics'
import {
  routeChatGptCode,
  routeImageMode,
  sendModePrompt,
} from './route-input-modes'
import { routeKeySetup } from './route-key-setup'
import { handleChatGptAuthCode } from '../../components/chatgpt-connect-banner'
import { useChatStore } from '../../state/chat-store'
import { trackEvent } from '../../utils/analytics'
import { showClipboardMessage } from '../../utils/clipboard'
import { IS_SAVANT_FREE } from '../../utils/constants'
import { getSystemMessage, getUserMessage } from '../../utils/message-history'
import {
  capturePendingAttachments,
  hasProcessingFiles,
  hasProcessingImages,
} from '../../utils/pending-attachments'
import {
  getActiveProviderSetup,
  getActiveResearchKeyService,
  getMissingProviderSetup,
  getProviderSetupGuidance,
  getProviderSetupInfo,
  getResearchKeyServiceInfo,
  saveProviderApiKey,
  saveResearchApiKey,
} from '../../utils/provider-setup'
import {
  findCommand,
  type RouterParams,
  type CommandResult,
} from '../command-registry'
import { handleDesignCreateIntent } from '../design'
import { isSlashCommand, parseCommandInput } from '../router-utils'

export async function routeUserPrompt(
  params: RouterParams,
  exchangeChatGptAuthCode: typeof handleChatGptAuthCode = handleChatGptAuthCode,
): Promise<CommandResult> {
  const {
    agentMode,
    inputRef,
    inputValue,
    isChainInProgressRef,
    isStreaming,
    streamMessageIdRef,
    addToQueue,
    saveToHistory,
    scrollToLatest,
    sendMessage,
    setInputFocused,
    setInputValue,
    setMessages,
  } = params

  const inputMode = useChatStore.getState().inputMode
  const setInputMode = useChatStore.getState().setInputMode
  const pendingAttachments = useChatStore.getState().pendingAttachments
  const pendingImages = pendingAttachments.filter((a) => a.kind === 'image')
  const pendingTextAttachments = pendingAttachments.filter(
    (a) => a.kind === 'text',
  )

  const trimmed = inputValue.trim()
  // Allow empty messages if there are pending attachments (images or text)
  const hasAttachments = pendingAttachments.length > 0
  if (!trimmed && !hasAttachments) return

  // Track user input complete
  trackUserInputAnalytics({
    trimmed,
    agentMode,
    inputMode,
    pendingImagesCount: pendingImages.length,
    pendingTextAttachmentsCount: pendingTextAttachments.length,
  })

  // Handle bash mode commands
  if (inputMode === 'bash') {
    const commandWithBang = '!' + trimmed
    saveToHistory(commandWithBang)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
    setInputMode('default')
    setInputFocused(true)
    inputRef.current?.focus()

    runBashCommand(trimmed)
    return
  }

  // Handle plan mode input
  if (inputMode === 'plan') {
    sendModePrompt(params, setInputMode, 'plan', trimmed)
    return
  }

  // Handle interview mode input
  if (inputMode === 'interview') {
    sendModePrompt(params, setInputMode, 'interview', trimmed)
    return
  }

  // Handle review mode input
  if (inputMode === 'review') {
    sendModePrompt(params, setInputMode, 'review', trimmed)
    return
  }

  // Handle bash commands from queue (starts with '!')
  if (trimmed.startsWith('!') && trimmed.length > 1) {
    const command = trimmed.slice(1)
    saveToHistory(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
    runBashCommand(command)
    return
  }

  // Handle image mode input
  if (inputMode === 'image') {
    await routeImageMode(params, setInputMode, trimmed)
    return
  }

  // Handle provider API-key setup without writing the secret to chat history.
  if (inputMode === 'providerSetup') {
    const provider = getActiveProviderSetup()
    routeKeySetup({
      trimmed,
      setInputValue,
      setInputMode,
      setInputFocused,
      inputRef,
      setMessages,
      getInfo: () => getProviderSetupInfo(provider),
      saveKey: (value) => saveProviderApiKey(provider, value),
      unavailableMessage:
        'Provider setup is unavailable. Use /provider to try again.',
      successMessage: (label) =>
        `${label} API key saved locally. You can now use the configured provider model.`,
    })
    return
  }

  // Handle research API-key setup (BYOK) — mirrors provider key handling.
  if (inputMode === 'researchKeySetup') {
    const service = getActiveResearchKeyService()
    routeKeySetup({
      trimmed,
      setInputValue,
      setInputMode,
      setInputFocused,
      inputRef,
      setMessages,
      getInfo: () => getResearchKeyServiceInfo(service),
      saveKey: (value) => saveResearchApiKey(service, value),
      unavailableMessage:
        'Research key setup is unavailable. Use /research-keys to try again.',
      successMessage: (label) =>
        `${label} API key saved locally. Research tools will use it when available.`,
    })
    return
  }

  // Handle connect:chatgpt mode input (authorization code)
  if (inputMode === 'connect:chatgpt') {
    await routeChatGptCode(
      params,
      setInputMode,
      trimmed,
      exchangeChatGptAuthCode,
    )
    return
  }

  // Supported imperative design intent offers the same confirmed wizard as
  // /design create. Ordinary design discussion remains a normal prompt.
  if (await handleDesignCreateIntent(params)) {
    saveToHistory(trimmed)
    return
  }

  // Handle slash commands or configured slashless exact commands.
  const parsedCommand = parseCommandInput(trimmed)
  if (parsedCommand) {
    const commandDef = findCommand(parsedCommand.command)
    if (commandDef) {
      const argsLength = parsedCommand.args.length
      const analyticsPayload = {
        command: commandDef.name,
        hasArgs: argsLength > 0,
        argsLength,
        agentMode,
        ...(parsedCommand.implicitCommand ? { implicitCommand: true } : {}),
      }

      trackEvent(AnalyticsEvent.SLASH_COMMAND_USED, analyticsPayload)

      // The command handler (via defineCommand/defineCommandWithArgs factories)
      // is responsible for validating and handling args
      return await commandDef.handler(params, parsedCommand.args)
    }
  }

  // Regular message or unknown slash command - send to agent

  // Block sending if attachments are still processing
  if (hasProcessingImages() || hasProcessingFiles()) {
    showClipboardMessage('processing attachments...', {
      durationMs: 2000,
    })
    return
  }

  // FID-007 U1: the provider-guidance gate is non-free builds only. SavantFree
  // reaches inference via its own gateway (never provider keys), `/provider` is
  // not registered there, and free users can be authenticated without a
  // provider — gating prevents ever instructing a free user to run a command
  // that resolves to "Command not found".
  if (!IS_SAVANT_FREE && !isSlashCommand(trimmed)) {
    const missingProvider = getMissingProviderSetup()
    if (missingProvider) {
      setMessages((prev) => [
        ...prev,
        getSystemMessage(getProviderSetupGuidance(missingProvider)),
      ])
      return
    }
  }

  saveToHistory(trimmed)
  setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

  if (
    isStreaming ||
    streamMessageIdRef.current ||
    isChainInProgressRef.current
  ) {
    const pendingAttachmentsForQueue = capturePendingAttachments()
    // Pass a copy of pending attachments to the queue
    addToQueue(trimmed, pendingAttachmentsForQueue)

    setInputFocused(true)
    inputRef.current?.focus()
    return
  }

  // Unknown slash command - show error
  if (isSlashCommand(trimmed)) {
    // Track invalid/unknown command (only log command name, not full input for privacy)
    const attemptedCmd = trimmed.slice(1).split(/\s+/)[0]?.toLowerCase() || ''
    trackEvent(AnalyticsEvent.INVALID_COMMAND, {
      attemptedCommand: attemptedCmd,
      inputLength: trimmed.length,
      agentMode,
    })

    // FID-007 D5: echo the user message (consistent with sibling branches)
    // and drop the redundant JSON.stringify on a plain string.
    setMessages((prev) => [
      ...prev,
      getUserMessage(trimmed),
      getSystemMessage(`Command not found: ${trimmed}`),
    ])
    return
  }

  // FID-2026-0818-002: drive mode locks ordinary input — the run proceeds
  // autonomously after the operator's Confirmation. Slash commands are handled
  // earlier (still reachable); Esc pause/stop lands in child 007.
  if (useChatStore.getState().driveMode) {
    return
  }

  sendMessage({ content: trimmed, agentMode })

  setTimeout(() => {
    scrollToLatest()
  }, 0)

  return
}
