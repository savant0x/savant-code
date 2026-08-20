import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { CHATGPT_OAUTH_ENABLED } from '@savant-code/common/constants/chatgpt-oauth'

import { runBashCommand } from './bash'
import { handleChatGptAuthCode } from '../../components/chatgpt-connect-banner'
import { getProjectRoot } from '../../project-files'
import { useChatStore } from '../../state/chat-store'
import { useSavantFreeSessionStore } from '../../state/savant-free-session-store'
import { trackEvent } from '../../utils/analytics'
import { showClipboardMessage } from '../../utils/clipboard'
import { IS_SAVANT_FREE } from '../../utils/constants'
import { getSystemMessage, getUserMessage } from '../../utils/message-history'
import {
  capturePendingAttachments,
  hasProcessingFiles,
  hasProcessingImages,
  validateAndAddImage,
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
import {
  buildInterviewPrompt,
  buildPlanPrompt,
  buildReviewPrompt,
} from '../prompt-builders'
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
  // Count @ mentions (simple pattern match - more accurate than nothing)
  const mentionMatches = trimmed.match(/@\S+/g) || []
  trackEvent(AnalyticsEvent.USER_INPUT_COMPLETE, {
    inputLength: trimmed.length,
    mode: agentMode,
    inputMode,
    hasImages: pendingImages.length > 0,
    imageCount: pendingImages.length,
    hasTextAttachments: pendingTextAttachments.length > 0,
    textAttachmentCount: pendingTextAttachments.length,
    isSlashCommand: isSlashCommand(trimmed),
    isBashCommand: trimmed.startsWith('!'),
    hasMentions: mentionMatches.length > 0,
    mentionCount: mentionMatches.length,
  })

  // DAU signal: one un-sampled event per user-submitted prompt. The CLI's
  // distinct id resolves to the canonical savant-code user id (anonymous id is
  // aliased to the real user id on login), matching the web and chat surfaces
  // so combined DAU is a single unique-users query. SavantFree-only: savant-code
  // CLI usage is intentionally excluded.
  if (IS_SAVANT_FREE) {
    const savantFreeSession = useSavantFreeSessionStore.getState().session
    const accessTier: string =
      savantFreeSession &&
      typeof (savantFreeSession as { accessTier?: string }).accessTier ===
        'string'
        ? (savantFreeSession as { accessTier: string }).accessTier
        : 'unknown'

    trackEvent(AnalyticsEvent.MESSAGE_SENT, {
      surface: 'cli',
      accessTier,
      mode: agentMode,
      inputMode,
      inputLength: trimmed.length,
      isSlashCommand: isSlashCommand(trimmed),
      isBashCommand: trimmed.startsWith('!'),
      hasImages: pendingImages.length > 0,
    })
  }

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
    if (!trimmed) return
    saveToHistory(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
    setInputMode('default')
    setInputFocused(true)
    inputRef.current?.focus()

    sendMessage({ content: buildPlanPrompt(trimmed), agentMode })
    setTimeout(() => {
      scrollToLatest()
    }, 0)
    return
  }

  // Handle interview mode input
  if (inputMode === 'interview') {
    if (!trimmed) return
    saveToHistory(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
    setInputMode('default')
    setInputFocused(true)
    inputRef.current?.focus()

    sendMessage({ content: buildInterviewPrompt(trimmed), agentMode })
    setTimeout(() => {
      scrollToLatest()
    }, 0)
    return
  }

  // Handle review mode input
  if (inputMode === 'review') {
    if (!trimmed) return
    saveToHistory(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
    setInputMode('default')
    setInputFocused(true)
    inputRef.current?.focus()

    sendMessage({ content: buildReviewPrompt('custom', trimmed), agentMode })
    setTimeout(() => {
      scrollToLatest()
    }, 0)
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
    const imagePath = trimmed
    const projectRoot = getProjectRoot()

    // Validate and add the image (handles path resolution, format check, and processing)
    const result = await validateAndAddImage(imagePath, projectRoot)
    if (!result.success) {
      setMessages((prev) => [
        ...prev,
        getUserMessage(trimmed),
        getSystemMessage(`❌ ${result.error}`),
      ])
    }

    // Note: No system message added here - the PendingImagesBanner shows attached images
    saveToHistory(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
    setInputMode('default')
    return
  }

  // Handle provider API-key setup without writing the secret to chat history.
  if (inputMode === 'providerSetup') {
    const provider = getActiveProviderSetup()
    const info = getProviderSetupInfo(provider)
    if (!info) {
      setMessages((prev) => [
        ...prev,
        getSystemMessage(
          'Provider setup is unavailable. Use /provider to try again.',
        ),
      ])
    } else if (!trimmed) {
      setMessages((prev) => [
        ...prev,
        getSystemMessage(`${info.label} API key cannot be empty.`),
      ])
    } else {
      try {
        saveProviderApiKey(provider, trimmed)
        setMessages((prev) => [
          ...prev,
          getSystemMessage(
            `${info.label} API key saved locally. You can now use the configured provider model.`,
          ),
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          getSystemMessage(
            `Could not save the ${info.label} API key. Check your local configuration permissions and try again.`,
          ),
        ])
      }
    }

    // Never save or display the secret itself, and always return to normal input.
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
    setInputMode('default')
    setInputFocused(true)
    inputRef.current?.focus()
    return
  }

  // Handle research API-key setup (BYOK) — mirrors provider key handling.
  if (inputMode === 'researchKeySetup') {
    const service = getActiveResearchKeyService()
    const info = getResearchKeyServiceInfo(service)
    if (!info) {
      setMessages((prev) => [
        ...prev,
        getSystemMessage(
          'Research key setup is unavailable. Use /research-keys to try again.',
        ),
      ])
    } else if (!trimmed) {
      setMessages((prev) => [
        ...prev,
        getSystemMessage(`${info.label} API key cannot be empty.`),
      ])
    } else {
      try {
        saveResearchApiKey(service, trimmed)
        setMessages((prev) => [
          ...prev,
          getSystemMessage(
            `${info.label} API key saved locally. Research tools will use it when available.`,
          ),
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          getSystemMessage(
            `Could not save the ${info.label} API key. Check your local configuration permissions and try again.`,
          ),
        ])
      }
    }

    // Never save or display the secret itself, and always return to normal input.
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
    setInputMode('default')
    setInputFocused(true)
    inputRef.current?.focus()
    return
  }

  // Handle connect:chatgpt mode input (authorization code)
  if (inputMode === 'connect:chatgpt') {
    if (!CHATGPT_OAUTH_ENABLED) {
      setInputMode('default')
      return
    }

    const code = trimmed
    if (code) {
      const result = await exchangeChatGptAuthCode(code)
      setMessages((prev) => [
        ...prev,
        getUserMessage(trimmed),
        getSystemMessage(result.message),
      ])
    }

    saveToHistory(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
    setInputMode('default')
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
