// FID-2026-0901-006 P14 — write_todos checklist parser (CLI parity).
//
// The CLI renders `write_todos` as a "TODOs" card with ✓/○ per item
// (`cli/src/components/tools/write-todos.tsx`). The desktop showed raw JSON.
// Pure parser: (inputJson) => items[] | null — mirrors that extraction, never
// throws, malformed input degrades to null (Law 14).

export interface TodoItem {
  task: string
  completed: boolean
}

export interface TodosPayload {
  items: TodoItem[]
}

function parseArray(inputJson: string | null): unknown[] | null {
  if (inputJson === null) return null
  try {
    const value: unknown = JSON.parse(inputJson)
    if (!Array.isArray(value)) return null
    return value
  } catch {
    return null
  }
}

/** Extract a renderable checklist from a write_todos input. */
export function parseTodosInput(inputJson: string | null): TodosPayload | null {
  const raw = parseArray(inputJson)
  if (raw === null) return null
  const items: TodoItem[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) return null
    const record = entry as { [key: string]: unknown }
    if (
      typeof record.task !== 'string' ||
      typeof record.completed !== 'boolean'
    ) {
      return null
    }
    items.push({ task: record.task, completed: record.completed })
  }
  if (items.length === 0) return null
  return { items }
}

/** One-line collapsed preview: "3/6 todos". */
export function todosPreview(payload: TodosPayload): string {
  const done = payload.items.filter((item) => item.completed).length
  return `${done}/${payload.items.length} todos`
}
