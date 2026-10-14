import z from 'zod/v4'

import type { ZodType } from 'zod/v4'

export const CLIENT_ENV_PREFIX = 'NEXT_PUBLIC_'

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_CB_ENVIRONMENT: z.enum(['dev', 'test', 'prod']),
  NEXT_PUBLIC_SAVANT_CODE_APP_URL: z.url().min(1),
  NEXT_PUBLIC_SAVANT_FREE_APP_URL: z.url().optional(),
  // Legacy alias (pre-rebrand). Read as a fallback so old env files keep
  // working (FID-2026-0806-013).
  NEXT_PUBLIC_FREEBUFF_APP_URL: z.url().optional(),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.email().min(1),
  NEXT_PUBLIC_POSTHOG_API_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST_URL: z.url().min(1),
  NEXT_PUBLIC_GRAVITY_PIXEL_ID: z.uuid().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: z.url().min(1),
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID: z.string().optional(),
  NEXT_PUBLIC_WEB_PORT: z.coerce.number().min(1000),
  // FID-2026-1013-012 W3-3: the `satisfies` clause proves every key is
  // NEXT_PUBLIC_-prefixed and every value is a Zod schema, so it names
  // `ZodType` instead of `any` (which asserted nothing).
} satisfies Record<`${typeof CLIENT_ENV_PREFIX}${string}`, ZodType>)
export const clientEnvVars = clientEnvSchema.keyof().options
export type ClientEnvVar = (typeof clientEnvVars)[number]
export type ClientInput = {
  [K in (typeof clientEnvVars)[number]]: string | undefined
}
export type ClientEnv = z.infer<typeof clientEnvSchema>

// Bun will inject all these values, so we need to reference them individually (no for-loops)
export const clientProcessEnv: ClientInput = {
  NEXT_PUBLIC_CB_ENVIRONMENT: process.env.NEXT_PUBLIC_CB_ENVIRONMENT,
  NEXT_PUBLIC_SAVANT_CODE_APP_URL: process.env.NEXT_PUBLIC_SAVANT_CODE_APP_URL,
  NEXT_PUBLIC_SAVANT_FREE_APP_URL: process.env.NEXT_PUBLIC_SAVANT_FREE_APP_URL,
  NEXT_PUBLIC_FREEBUFF_APP_URL: process.env.NEXT_PUBLIC_FREEBUFF_APP_URL,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXT_PUBLIC_POSTHOG_API_KEY: process.env.NEXT_PUBLIC_POSTHOG_API_KEY,
  NEXT_PUBLIC_POSTHOG_HOST_URL: process.env.NEXT_PUBLIC_POSTHOG_HOST_URL,
  NEXT_PUBLIC_GRAVITY_PIXEL_ID: process.env.NEXT_PUBLIC_GRAVITY_PIXEL_ID,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL:
    process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL,
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID:
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID,
  NEXT_PUBLIC_WEB_PORT: process.env.NEXT_PUBLIC_WEB_PORT,
}
