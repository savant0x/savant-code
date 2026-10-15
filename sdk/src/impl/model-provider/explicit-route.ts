import {
  CHATGPT_OAUTH_ENABLED,
  isChatGptOAuthModelAllowed,
} from '@savant-code/common/constants/chatgpt-oauth'
import {
  getModelRouteConfig,
  resolveModelRoute,
} from '@savant-code/common/providers/model-route'

import { createOpenAIOAuthModel, createProviderModel } from './model-factories'
import { isChatGptOAuthRateLimited } from './oauth-rate-limit'
import {
  buildMissingKeyError,
  resolveExtraCredentials,
  resolveProviderKey,
} from './provider-credentials'
import { getValidChatGptOAuthCredentials } from '../../credentials'

import type { ModelRequestParams, ModelResult } from './types'

export async function resolveExplicitModelRoute(
  params: ModelRequestParams,
): Promise<ModelResult> {
  const route = resolveModelRoute(params.model, params.modelRoute)
  if (!route) throw new Error('An explicit serving provider is required.')
  const config = getModelRouteConfig(route)
  if (route.authMode === 'chatgpt-oauth') {
    if (
      !CHATGPT_OAUTH_ENABLED ||
      params.skipChatGptOAuth ||
      !isChatGptOAuthModelAllowed(params.model) ||
      isChatGptOAuthRateLimited()
    ) {
      throw new Error(
        'The selected ChatGPT OAuth route is unavailable. Select an API provider explicitly.',
      )
    }
    const credentials = await getValidChatGptOAuthCredentials()
    if (!credentials)
      throw new Error(
        'ChatGPT OAuth is not connected. Reconnect or select an API provider.',
      )
    return {
      model: createOpenAIOAuthModel(params.model, credentials.accessToken),
      isChatGptOAuth: true,
    }
  }
  const key = config.kind === 'local' ? '' : await resolveProviderKey(config)
  if (key === undefined) throw new Error(buildMissingKeyError(config))
  const id =
    config.idTransform === 'keep' || params.model.startsWith(`${config.id}/`)
      ? params.model
      : `${config.id}/${params.model}`
  return {
    model: createProviderModel(
      config,
      key,
      id,
      resolveExtraCredentials(config),
    ),
    isChatGptOAuth: false,
  }
}
