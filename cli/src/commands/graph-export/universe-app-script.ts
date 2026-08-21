/**
 * The offline Code Universe browser app (Sigma/Graphology renderer, state
 * machine, planet effects, audio, search, tooltips, keyboard nav).
 *
 * Extracted verbatim from template.ts by FID-2026-0809-011 Phase B-1: the
 * region had zero ${} interpolations, zero backticks, and zero escape
 * sequences, so the lift into a static string constant is byte-identical
 * (deterministic-artifact gate preserved). buildGraphExportHtml interpolates
 * this inside the HTML shell.
 *
 * Split into eight cohesive parts (A–H), concatenated here byte-for-byte;
 * the assembled payload is hash-verified identical to the pre-split source
 * (FID-2026-0819-005 Loop 136).
 */
import { UNIVERSE_APP_SCRIPT_A } from './universe-app-script-a'
import { UNIVERSE_APP_SCRIPT_B } from './universe-app-script-b'
import { UNIVERSE_APP_SCRIPT_C } from './universe-app-script-c'
import { UNIVERSE_APP_SCRIPT_D } from './universe-app-script-d'
import { UNIVERSE_APP_SCRIPT_E } from './universe-app-script-e'
import { UNIVERSE_APP_SCRIPT_F } from './universe-app-script-f'
import { UNIVERSE_APP_SCRIPT_G } from './universe-app-script-g'
import { UNIVERSE_APP_SCRIPT_H } from './universe-app-script-h'

export const UNIVERSE_APP_SCRIPT =
  UNIVERSE_APP_SCRIPT_A +
  UNIVERSE_APP_SCRIPT_B +
  UNIVERSE_APP_SCRIPT_C +
  UNIVERSE_APP_SCRIPT_D +
  UNIVERSE_APP_SCRIPT_E +
  UNIVERSE_APP_SCRIPT_F +
  UNIVERSE_APP_SCRIPT_G +
  UNIVERSE_APP_SCRIPT_H
