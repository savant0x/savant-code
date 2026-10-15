export type ForcedChoice = 'A' | 'B'

export type AutoraterRequest = {
  rubric: string
  candidateA: string
  candidateB: string
  timeoutMs: number
}

export type AutoraterResponse = {
  choice: ForcedChoice
  rationale?: string
}

export type AutoraterProcess = (request: AutoraterRequest) => Promise<string>

const DEFAULT_TIMEOUT_MS = 5_000

export function maskAutoraterOrigin(value: string): string {
  return value
    .replace(/savant[-_ ]?code/gi, '[PROJECT]')
    .replace(/fid[-_ ]?\d{4}[-_ ]?\d{4}[-_ ]?\d{3}/gi, '[FID]')
    .replace(/[A-Za-z]:[\\/][^\s)]+/g, '[PATH]')
}

export function parseForcedChoice(value: string): AutoraterResponse {
  const match = value.trim().match(/^\s*([AB])(?:\s*[:\-]\s*(.*))?\s*$/is)
  if (!match) throw new Error('Autorater returned a non-categorical response')
  const choice = match[1]?.toUpperCase()
  if (choice !== 'A' && choice !== 'B') {
    throw new Error('Autorater returned an invalid forced choice')
  }
  const rationale = match[2]?.trim()
  return rationale ? { choice, rationale } : { choice }
}

export async function runBoundedAutorater(
  request: AutoraterRequest,
  process: AutoraterProcess,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<AutoraterResponse> {
  const safeRequest: AutoraterRequest = {
    ...request,
    rubric: maskAutoraterOrigin(request.rubric),
    candidateA: maskAutoraterOrigin(request.candidateA),
    candidateB: maskAutoraterOrigin(request.candidateB),
    timeoutMs,
  }
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`Autorater timeout after ${timeoutMs}ms`)),
      timeoutMs,
    )
  })
  const raw = await Promise.race([process(safeRequest), timeout])
  return parseForcedChoice(raw)
}
