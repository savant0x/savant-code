/**
 * Prod origin of the SavantFree web app (marketing site + browser sign-in).
 * The CLI and SavantFree Desktop both send users here for the device-code login
 * flow; sharing the literal keeps their prod defaults from drifting.
 *
 * FID-2026-0806-013: the legacy `savant-free.com` domain is not deployed;
 * the web app lives on savant-code.com. The constant name is preserved to
 * avoid churning consumers.
 */
export const SAVANT_FREE_WEB_URL_PROD = 'https://savant-code.com'
