/**
 * Centralized prompt builders for /plan and /review commands.
 * This ensures consistent behavior regardless of entry path.
 *
 * By default /plan and /review run on the user's currently selected model. If
 * the user has connected a ChatGPT account (via /connect), we delegate the
 * deep-thinking step to the standard @thinker agent instead.
 */

import { getChatGptOAuthStatus } from '../utils/chatgpt-oauth'

// Pick the thinker-delegating variant when a ChatGPT account is connected;
// otherwise the user's selected model does the work directly.
function gptOrSelectedModelPrompt(
  gptVariant: string,
  selectedModelVariant: string,
  isChatGptConnected: () => boolean = () => getChatGptOAuthStatus().connected,
): string {
  return isChatGptConnected() ? gptVariant : selectedModelVariant
}

// Base prompt for plan command - always gathers context first.
export function buildPlanBasePrompt(
  isChatGptConnected?: () => boolean,
): string {
  return gptOrSelectedModelPrompt(
    'Gather all the relevant context and then spawn @thinker Think about how to implement the following:',
    'Gather all the relevant context and then think carefully about how to implement the following:',
    isChatGptConnected,
  )
}

// Base prompt for review command - always gathers context first.
export function buildReviewBasePrompt(
  isChatGptConnected?: () => boolean,
): string {
  return gptOrSelectedModelPrompt(
    'Please gather all relevant context and then spawn @thinker to review:',
    'Please gather all relevant context and then carefully review:',
    isChatGptConnected,
  )
}

/**
 * Build a plan prompt from user input.
 * @param input - The user's plan request (e.g., "add OAuth login")
 * @returns The full prompt to send to the agent
 */
export function buildPlanPrompt(
  input: string,
  isChatGptConnected?: () => boolean,
): string {
  const basePrompt = buildPlanBasePrompt(isChatGptConnected)
  const trimmedInput = input.trim()
  if (!trimmedInput) {
    return basePrompt
  }
  return `${basePrompt}\n\n${trimmedInput}`
}

// Base prompt for interview command - asks clarifying questions before acting
export const INTERVIEW_BASE_PROMPT =
  'Interview me to better understand my request and then create a spec file. First, gather any relevant context (read files, do research, etc.). Then, use several rounds of the ask_user tool to ask non-obvious clarifying questions — things you cannot easily infer from the codebase or my initial message. Ask about edge cases, preferences, constraints, and design decisions. All questions should be directed through the ask_user tool -- not written out as text. Keep coming up with new questions that get at unique aspects of the request. Aim for at least **3 rounds** with multiple questions each round. When satisfied, write a [INSERT_REQUEST_SHORT_NAME]-spec.md file with all the information you have gathered about the request. Aim for as much detail as possible. You should NOT make any code changes yet. Stop after creating the spec file. End by using the suggest_followups tool with ways to flesh out the spec file. Here is my request:'

/**
 * Build an interview prompt from user input.
 * @param input - The user's request to be interviewed about
 * @returns The full prompt to send to the agent
 */
export function buildInterviewPrompt(input: string): string {
  const trimmedInput = input.trim()
  if (!trimmedInput) {
    return INTERVIEW_BASE_PROMPT
  }
  return `${INTERVIEW_BASE_PROMPT}\n\n${trimmedInput}`
}

/**
 * FID-2026-0818-002: Auto Drive clarity stage. Reuses the interview ceremony
 * verbatim (context gathering + ≥3 `ask_user` rounds + a spec file) as the
 * fallback for underspecified goals — Law 7/13 (search before create).
 */
export const AUTO_CLARITY_PROMPT =
  'Clarify this Auto Drive goal before planning. If the goal is already a ' +
  'detailed spec, skip to the plan stage immediately. Otherwise gather any ' +
  'relevant context (read files, do research), then use several rounds of the ' +
  'ask_user tool to ask non-obvious clarifying questions — edge cases, ' +
  'constraints, acceptance criteria, and design decisions. Aim for at least ' +
  '3 rounds. Write a [INSERT_REQUEST_SHORT_NAME]-spec.md file with everything ' +
  'you gathered. Do NOT make code changes. When the spec is complete, proceed ' +
  'directly to producing the pre-build plan as instructed. Here is my goal:'

/**
 * FID-2026-0818-002: Auto Drive pre-build plan stage. Converts the spec into
 * the master-FID draft (scope, module breakdown, dependency order, acceptance
 * criteria, resolution policy) and ends by emitting a single `<drive-plan>`
 * directive so the CLI can present the operator Confirmation (Law 2 gate).
 */
export const AUTO_PREBUILD_PLAN_PROMPT =
  'Now produce the pre-build plan for this Auto Drive goal. Convert the ' +
  'gathered spec into a master-FID draft: (1) scope, (2) module breakdown, ' +
  '(3) dependency order, (4) explicit acceptance criteria, and (5) a ' +
  'resolution policy for how the drive resolves genuine impasses without ' +
  'asking the operator. Do NOT write any code and do NOT ask the operator any ' +
  'further questions. End your turn by emitting exactly one directive of the ' +
  'form <drive-plan goal="..." plan="..." acceptanceCriteria="[...]" ' +
  'resolutionPolicy="..."/>, with the full plan text (markdown) escaped into ' +
  'the plan attribute and the acceptance criteria as a JSON array of strings. ' +
  'Nothing may follow the directive.'

/**
 * Build the full Auto Drive prompt from the operator's goal. The model
 * clarifies (if needed) then produces the pre-build plan.
 */
export function buildAutoPrompt(input: string): string {
  const trimmedInput = input.trim()
  const goal = trimmedInput || 'the goal described in the attached context'
  return `${AUTO_CLARITY_PROMPT}\n\n${goal}\n\n${AUTO_PREBUILD_PLAN_PROMPT}`
}

/**
 * Review scope presets for the review screen.
 */
type ReviewScope = 'conversation' | 'uncommitted' | 'branch' | 'custom'

/**
 * Get the default text for a review scope preset.
 */
function getReviewScopeText(scope: ReviewScope): string {
  switch (scope) {
    case 'conversation':
      return 'all changes made in this conversation'
    case 'uncommitted':
      return 'uncommitted changes'
    case 'branch':
      return 'this branch compared to main'
    case 'custom':
      return ''
  }
}

/**
 * Build a review prompt from scope or custom input.
 * @param scope - The selected review scope (conversation, uncommitted, branch, or custom)
 * @param customInput - Optional custom review focus (when scope is 'custom')
 * @returns The full prompt to send to the agent
 */
export function buildReviewPrompt(
  scope: ReviewScope,
  customInput?: string,
  isChatGptConnected?: () => boolean,
): string {
  const basePrompt = buildReviewBasePrompt(isChatGptConnected)
  const scopeText = getReviewScopeText(scope)

  // For custom input, append the user's specific focus
  if (scope === 'custom' && customInput?.trim()) {
    return `${basePrompt} ${customInput.trim()}`
  }

  // For preset scopes, use the scope text
  if (scopeText) {
    return `${basePrompt} ${scopeText}`
  }

  // Fallback for custom with no input
  return basePrompt
}

/**
 * Build a review prompt from direct argument (e.g., /review foo).
 * This is used when the user provides review text directly after the command.
 * @param input - The user's review request
 * @returns The full prompt to send to the agent
 */
export function buildReviewPromptFromArgs(
  input: string,
  isChatGptConnected?: () => boolean,
): string {
  const trimmedInput = input.trim()
  // Use the same format as preset scopes for consistency
  return `${buildReviewBasePrompt(isChatGptConnected)} ${trimmedInput}`
}
