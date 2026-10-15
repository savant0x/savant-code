/** Extract only an explicit model-routing refusal from a provider error. */
export function explicitModelRejection(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const record = error as Record<string, unknown>
  let body: unknown = record.responseBody ?? record.body ?? record.data
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as unknown
    } catch {
      return undefined
    }
  }
  if (typeof body !== 'object' || body === null) return undefined
  const payload = body as Record<string, unknown>
  const nested = payload.error
  const detail =
    typeof nested === 'object' && nested !== null
      ? (nested as Record<string, unknown>)
      : payload
  const code = detail.code
  return code === 'model_not_found' ||
    code === 'model_unavailable' ||
    code === 'no_endpoints'
    ? code
    : undefined
}
