import {
  providerNoticeSchema,
  type ProviderNotice,
} from '@savant-code/common/providers/provider-notifications'
import { create } from 'zustand'

export function mergeProviderNotices(
  previous: ProviderNotice[],
  incoming: ProviderNotice[],
): ProviderNotice[] {
  const map = new Map(previous.map((n) => [n.id, n]))
  for (const row of incoming) {
    const n = providerNoticeSchema.parse(row)
    if (!map.has(n.id) || map.get(n.id)!.revision <= n.revision)
      map.set(n.id, n)
  }
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt)
}
export const useProviderNoticeStore = create<{
  notices: ProviderNotice[]
  error: string
  loading: boolean
  merge: (n: ProviderNotice[]) => void
  hydrate: (snapshot: { revision: number; notices: ProviderNotice[] }) => void
  setLoading: (loading: boolean) => void
  setError: (error: string) => void
}>((set) => ({
  notices: [],
  error: '',
  loading: true,
  merge: (incoming) =>
    set((s) => ({ notices: mergeProviderNotices(s.notices, incoming) })),
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ loading }),
  hydrate: (snapshot) =>
    set((s) => ({
      loading: false,
      notices: mergeProviderNotices(
        s.notices.filter((n) => n.revision > snapshot.revision),
        snapshot.notices,
      ),
    })),
}))
