const NON_CODING_MODEL_PATTERN =
  /(image|video|veo|lyria|tts|embedding|whisper|orpheus|prompt-guard|safeguard|vision|(?:^|[-/])vl(?:[-/]|$)|qvq|asr|ocr|omni|translate|deep-research|computer-use|multi-agent)/i

/**
 * Tier 1 model catalogs are consumed by the coding harness, not by the
 * product's media, retrieval, safety, or research surfaces.
 */
export function isCodingHarnessModel(id: string, name?: string): boolean {
  return !NON_CODING_MODEL_PATTERN.test(`${id} ${name ?? ''}`)
}
