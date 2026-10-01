/**
 * Bundle-provider seam for the connector handlers (FID-2026-0930-003): the
 * handlers never import the bundle loader directly — they receive a provider
 * function, so tests inject a synthetic bundle and the production wiring
 * supplies `loadLaunchBundle`. (Dependency injection over module mocking;
 * the handler record stays import-light.)
 */
import { loadLaunchBundle } from '@savant-code/connectors/runtime'

import type { Bundle } from '@savant-code/connectors/core'

export type BundleProvider = () => Promise<Bundle>

/** Production provider — the checked-in compiled bundle, cached per process. */
export const launchBundleProvider: BundleProvider = () => loadLaunchBundle()
