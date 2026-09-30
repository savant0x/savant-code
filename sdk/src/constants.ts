import { IS_DEV, IS_TEST, IS_PROD } from '@savant-code/common/env'

export { IS_DEV, IS_TEST, IS_PROD }

export const SAVANT_CODE_BINARY = 'savant-code'

// FID-2026-0929-005 (gut the backend): getWebsiteUrl() / WEBSITE_URL are
// deleted. Every consumer resolved an origin for a backend that does not
// exist; the surviving consumers either require INFERENCE_BASE_URL directly
// (default-inference) or were deleted with their endpoints.
