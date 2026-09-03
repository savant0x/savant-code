// FID-2026-0901-006 P14 — write_todos checklist card (CLI parity).
//
// Mirrors `cli/src/components/tools/write-todos.tsx`: bold "TODOs" header,
// then one row per item — ✓ (success) for completed, ○ (muted) for open,
// completed task text muted. Pure presentation over TodosPayload.

import { memo } from 'react'

import type { TodosPayload } from '../../lib/todos-parse'
import type { JSX } from 'react'

export const TodosBlock = memo(function TodosBlock({
  payload,
}: {
  payload: TodosPayload
}): JSX.Element {
  return (
    <div className="todos-block">
      <div className="todos-title">TODOs</div>
      <ul className="todos-list">
        {payload.items.map((item, index) => (
          <li
            key={`todo-${index}`}
            className={`todo-item${item.completed ? ' todo-done' : ''}`}
          >
            <span className="todo-mark" aria-hidden="true">
              {item.completed ? '✓' : '○'}
            </span>
            <span className="todo-task">{item.task}</span>
          </li>
        ))}
      </ul>
    </div>
  )
})
