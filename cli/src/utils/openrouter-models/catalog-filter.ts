const NON_CODING_MODEL_PATTERN =
  /(image|video|veo|lyria|tts|embedding|whisper|orpheus|prompt-guard|safeguard|vision|(?:^|[-/\s])vl(?:[-/:\s]|$)|qvq|asr|ocr|omni|translate|deep-research|computer-use|multi-agent)/i

/**
 * Tier 1 model catalogs are consumed by the coding harness, not by the
 * product's media, retrieval, safety, or research surfaces.
 */
export function isCodingHarnessModel(id: string, name?: string): boolean {
  return !NON_CODING_MODEL_PATTERN.test(`${id} ${name ?? ''}`)
}

const SPECIALIST_TASK_PATTERN =
  /(image|video|veo|lyria|nano[-_ ]?banana|tts|embed|whisper|orpheus|prompt[-_ ]?guard|llama[-_ ]guard|safeguard|content[-_ ]?safety|safety[-_ ]?guard|nemoguard|reward|rerank|retriev|asr|ocr|transcrib|translate|speech|voice|audio|diffusion|robotics|antigravity|deep-research|computer-use|multi-agent|deplot|nvclip|kosmos|fuyu|neva|vila|nemotron-parse|ising[-_ ]calibration)/i

export type CodingModelEvidence = {
  id: string
  outputModalities?: readonly string[]
  supportedParameters?: readonly string[]
}

/** Metadata resolves multimodal names; an absent fact never proves tool support. */
export function assessCodingModel(model: CodingModelEvidence): {
  reason:
    | 'specialist'
    | 'non-text'
    | 'purpose-unverified'
    | 'tools-unsupported'
    | null
  verified: boolean
} {
  if (SPECIALIST_TASK_PATTERN.test(model.id))
    return { reason: 'specialist', verified: false }
  const outputs = model.outputModalities?.map((value) => value.toLowerCase())
  if (outputs && !outputs.includes('text'))
    return { reason: 'non-text', verified: false }
  // Without metadata, retain the existing conservative vision/omni policy.
  if (!outputs && !isCodingHarnessModel(model.id))
    return { reason: 'purpose-unverified', verified: false }
  const tools = model.supportedParameters?.some((value) =>
    ['tools', 'function_calling', 'function-calling', 'functions'].includes(
      value.toLowerCase(),
    ),
  )
  if (tools === false) return { reason: 'tools-unsupported', verified: false }
  return {
    reason: null,
    verified: outputs?.includes('text') === true && tools === true,
  }
}
