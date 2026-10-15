import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'

import type { RedditRetentionMilestone } from '@savant-code/common/util/reddit-savant-free-retention'

export type RedditFirstPromptSurface = 'cli' | 'web' | 'chat'

/** PostHog/analytics event fired alongside the Reddit CAPI first-prompt conversion. */
export const REDDIT_FIRST_PROMPT_ANALYTICS_EVENTS: Record<
  RedditFirstPromptSurface,
  AnalyticsEvent
> = {
  cli: AnalyticsEvent.SAVANT_FREE_REDDIT_FUNNEL_FIRST_PROMPT_CLI,
  web: AnalyticsEvent.SAVANT_FREE_REDDIT_FUNNEL_FIRST_PROMPT_WEB,
  chat: AnalyticsEvent.SAVANT_FREE_REDDIT_FUNNEL_FIRST_PROMPT_CHAT,
}

export type RedditFirstPromptCapiEventName =
  'FirstPromptCli' | 'FirstPromptWeb' | 'FirstPromptChat'

export type RedditRetentionCapiEventName =
  'Retention1dCli' | 'Retention7dCli' | 'Retention24dCli'

export function redditFirstPromptCapiEventName(
  surface: RedditFirstPromptSurface,
): RedditFirstPromptCapiEventName {
  switch (surface) {
    case 'cli':
      return 'FirstPromptCli'
    case 'web':
      return 'FirstPromptWeb'
    case 'chat':
      return 'FirstPromptChat'
  }
}

export function redditRetentionCapiEventName(
  milestone: RedditRetentionMilestone,
): RedditRetentionCapiEventName {
  return `Retention${milestone}dCli`
}
