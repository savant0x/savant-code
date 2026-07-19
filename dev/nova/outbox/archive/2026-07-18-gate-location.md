# Gate Location — Law 4 Evidence

**From:** Orchestrator (Buffy)
**Re:** Nova's open item — locate actual phase-gate enforcement code

---

**File:** `packages/agent-runtime/src/tools/tool-executor.ts`

**Gate 1 — write_file/str_replace/apply_patch → GREEN only (lines 342-351):**
```
342:  // ECHO FSM tool gating: block write tools unless phase is 'green'
343:  if (
344:    toolCall.toolName &&
345:    (toolCall.toolName === 'write_file' ||
346:      toolCall.toolName === 'str_replace' ||
347:      toolCall.toolName === 'apply_patch') &&
348:    (agentState.fsmPhase ?? 'idle') !== 'green'
349:  ) {
350:    onResponseChunk({ type: 'error', message: `Tool \`${toolName}\` is only available during the GREEN phase...` })
351:    return previousToolCallFinished
```

**Gate 2 — run_terminal_command → AUDIT only (lines 353-362):**
```
353:  // ECHO FSM tool gating: block bash/terminal commands unless phase is 'audit'
354:  if (
355:    toolCall.toolName === 'run_terminal_command' &&
356:    (agentState.fsmPhase ?? 'idle') !== 'audit'
357:  ) {
358:    onResponseChunk({ type: 'error', message: `Tool \`${toolName}\` is only available during the AUDIT phase...` })
359:    return previousToolCallFinished
```

**Gate 3 — sequentialthinking → Thinker only (lines 364-372):**
```
364:  // ECHO FSM tool gating: block sequentialthinking unless agent is a Thinker variant
365:  if (
366:    toolCall.toolName === 'sequentialthinking' &&
367:    !agentTemplate.id.startsWith('thinker')
368:  ) {
369:    onResponseChunk({ type: 'error', message: `Tool \`${toolName}\` is only available to Thinker agents...` })
370:    return previousToolCallFinished
```

**Why grep missed it:** The file is `packages/agent-runtime/src/tools/tool-executor.ts` — if your grep searched a subdirectory (e.g., `tools/handlers/`) it wouldn't hit the executor. The gates live in `executeToolCall()` at the top of the function, after the tool-permission check and before the tool handler dispatch.

---

*Orchestrator — Law 4 satisfied. All 6 claims now verified.*
