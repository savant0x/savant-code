// Fixture: ECHO Law 6 `unknown` enforcement — GOOD cases (must PASS)
// Run: npx eslint scripts/eslint-rules/__fixtures__/unknown-good.ts

interface User {
  id: string
  name: string
}

// 1. Real domain type as param — ALLOWED
export function handleUser(user: User): void {
  console.log(user.name)
}

// 2. User-defined type guard with `unknown` INPUT — ALLOWED (the only legal unknown)
export function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).name === 'string'
  )
}

// 3. Using the guard at a trust boundary — ALLOWED
// JSON.parse returns `any`; passing it directly to the guard (whose param is
// `unknown`) is the sanctioned boundary pattern — no `unknown` variable/return,
// no cast. (Inline re-parse is a micro-cost; Law 6 compliance is the priority.)
export function parseUser(raw: string): User | null {
  return isUser(JSON.parse(raw)) ? JSON.parse(raw) : null
}

// 4. Real return type — ALLOWED
export function getConfig(): User {
  return { id: '1', name: 'test' }
}
