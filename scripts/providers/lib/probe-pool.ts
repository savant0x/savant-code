/**
 * FID-2026-0918-001 — bounded-concurrency worker pool for the harvester's
 * probe phases. Zero-dependency (the repo carries no promise-concurrency
 * package; Law 7/13): a fixed set of lanes drains the input array, results
 * come back in input order.
 *
 * Etiquette (per the FID): hosts are distinct vendor endpoints, so running
 * PROBE_CONCURRENCY probes across DIFFERENT hosts does not change per-host
 * request behavior — each host still receives exactly one probe set.
 *
 * Purity: no I/O here; the worker owns all network access (injectable per
 * the repo's DI convention via probeEndpoint's fetchImpl).
 */

/** Production limit — polite overlap of the 10 s probe timeout windows. */
export const PROBE_CONCURRENCY = 6

export async function runWithConcurrency<TIn, TOut>(
  items: readonly TIn[],
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  // Degenerate limits degrade to serial instead of hanging (limit 0 would
  // otherwise starve every lane forever).
  const lanes = Math.max(1, Math.min(limit, items.length))
  const results = new Array<TOut>(items.length)
  let nextIndex = 0

  async function lane(): Promise<void> {
    while (true) {
      const index = nextIndex++
      if (index >= items.length) return
      results[index] = await worker(items[index]!, index)
    }
  }

  const runners: Array<Promise<void>> = []
  for (let i = 0; i < lanes; i++) runners.push(lane())
  await Promise.all(runners)
  return results
}
