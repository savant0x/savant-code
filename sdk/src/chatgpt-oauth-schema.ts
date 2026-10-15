import { z } from 'zod/v4'

export const chatGptOAuthSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  connectedAt: z.number(),
})

/**
 * ChatGPT OAuth credentials stored in the credentials file.
 */
export interface ChatGptOAuthCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp in milliseconds
  connectedAt: number // Unix timestamp in milliseconds
}
