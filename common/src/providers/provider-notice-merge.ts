import type { ProviderNoticeState } from './provider-notifications'
/** Merge an uncommitted memory snapshot without losing another writer's acknowledgements. */
export function mergeProviderNoticeState(
  disk: ProviderNoticeState,
  memory?: ProviderNoticeState,
): ProviderNoticeState {
  if (!memory) return disk
  const next = structuredClone(disk)
  for (const [source, at] of Object.entries(memory.sourceTimes)) {
    if (at <= (disk.sourceTimes[source] ?? 0)) continue
    next.sourceTimes[source] = at
    for (const [key, value] of Object.entries(memory.facts))
      if (key.startsWith(`${source}:`)) next.facts[key] = value
    for (const [key, value] of Object.entries(memory.episodes))
      if (key.startsWith(`${source}:`)) next.episodes[key] = value
  }
  const notices = new Map(next.notices.map((n) => [n.id, n]))
  for (const notice of memory.notices) {
    const prior = notices.get(notice.id)
    if (
      prior &&
      (prior.selected !== notice.selected || prior.resolved !== notice.resolved)
    ) {
      notices.set(notice.id, prior.revision > notice.revision ? prior : notice)
      continue
    }
    notices.set(
      notice.id,
      prior
        ? {
            ...(prior.revision > notice.revision ? prior : notice),
            acceptedBy: [
              ...new Set([...prior.acceptedBy, ...notice.acceptedBy]),
            ],
            unread: prior.unread && notice.unread,
            dismissed: prior.dismissed || notice.dismissed,
          }
        : notice,
    )
  }
  next.notices = [...notices.values()]
  next.revision = Math.max(disk.revision, memory.revision)
  return next
}
