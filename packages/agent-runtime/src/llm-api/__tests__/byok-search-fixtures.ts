import { mock } from 'bun:test'

export function respondWith(
  body: unknown,
  status = 200,
): typeof globalThis.fetch {
  return mock(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  ) as unknown as typeof globalThis.fetch
}
