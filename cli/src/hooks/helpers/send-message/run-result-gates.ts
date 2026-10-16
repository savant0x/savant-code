/** FID-2026-0915-001 (W5): 429 detection on any error shape (throw or output). */
export function isRateLimited(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const status =
    (error as { statusCode?: unknown }).statusCode ??
    (error as { status?: unknown }).status
  return status === 429
}
