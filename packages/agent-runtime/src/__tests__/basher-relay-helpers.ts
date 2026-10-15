// FID-2026-0819-005 Loop 168: relay-probe message-array helpers, extracted
// verbatim from basher-relay-step-context.test.ts (pure — no test state).

export type RoleRecord = Record<string, unknown>

export function isRoleRecord(value: unknown): value is RoleRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'role' in value &&
    typeof (value as RoleRecord).role === 'string'
  )
}

/** Recursively locate the first array whose members all look like messages. */
export function findMessageArray(source: unknown): RoleRecord[] | undefined {
  if (Array.isArray(source)) {
    if (source.length > 0 && source.every((el) => isRoleRecord(el))) {
      return source as RoleRecord[]
    }
    for (const element of source) {
      const found = findMessageArray(element)
      if (found) {
        return found
      }
    }
    return undefined
  }
  if (typeof source === 'object' && source !== null) {
    for (const value of Object.values(source as Record<string, unknown>)) {
      const found = findMessageArray(value)
      if (found) {
        return found
      }
    }
  }
  return undefined
}
