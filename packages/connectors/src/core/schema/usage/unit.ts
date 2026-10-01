import { z } from 'zod'

/**
 * Unit — counted quantities a run can consume: the PER_UNIT model unit
 * vocabulary, and therefore the implied `usage.counts` KEY of a leaf
 * PER_UNIT doc (design D19 — composite docs key counts by component id
 * instead). CALL is deliberately NOT here: "one flat call" is the
 * PER_CALL model KIND, fully described by the model + the run's success
 * flag — it needs no count, so giving it one was a second spelling of
 * the same fact (design D18).
 *
 * UPPERCASE canonical values (the repo enum rule: uppercase keys AND
 * values for every closed vocabulary); lowercase rendering is a DISPLAY
 * concern (web/CLI label maps). Provider-NATIVE truth only (uniform
 * pricing is the hosted rate card's job). Append-only: extending requires
 * an engine minor bump.
 */
export const Unit = {
  RESULT: 'RESULT',
  TOKEN: 'TOKEN',
  CHARACTER: 'CHARACTER',
  SECOND: 'SECOND',
  MINUTE: 'MINUTE',
  CREDIT: 'CREDIT',
  /** A charged page of results (apify#harvestapi/linkedin-profile-search bills per
   *  search page scraped, independent of profiles found on it). */
  PAGE: 'PAGE',
} as const
export type Unit = (typeof Unit)[keyof typeof Unit]

export const zUnit = z.enum(Object.values(Unit) as [Unit, ...Unit[]])
