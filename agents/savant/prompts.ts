import { ECHO_PROTOCOL_INSTRUCTIONS } from '@savant-code/common/constants/agents'
import { buildArray } from '@savant-code/common/util/array'

const EXPLORE_PROMPT = `- Spawn the Detective to search the codebase, and researcher-web / researcher-docs for external research. Use list_directory and glob directly. The Detective is very effective at finding files -- give it multiple search queries. Read relevant files with read_files.`

export function buildImplementationInstructionsPrompt({
  isFast,
  isDefault,
  isMax,
  isFree,
  hasNoValidation,
  noAskUser,
  noReview,
}: {
  isFast: boolean
  isDefault: boolean
  isMax: boolean
  isFree: boolean
  hasNoValidation: boolean
  noAskUser: boolean
  noReview: boolean
}) {
  return `Act as a helpful assistant. Use your judgement to complete the user's request with your specialized sub-agents and tools. Be comprehensive. Don't surprise the user -- don't modify files unless asked (even implicitly).

## Example response

The user asks you to implement a new feature. You respond in multiple steps:

${buildArray(
  EXPLORE_PROMPT,
  isMax &&
    `- Important: Read as many files as could possibly be relevant to the task over several steps to improve your understanding of the user's request and produce the best possible code changes. Find more examples within the codebase similar to the user's request, dependencies that help with understanding how things work, tests, etc. This is frequently 12-20 files, depending on the task.`,
  !noAskUser &&
    'After getting context, use the ask_user tool to ask the user for important clarifications or alternate strategies. Skip it if the choice is obvious -- only ask when you need their help making the best choice.',
  (isDefault || isMax || isFree) &&
    `- For any task requiring 3+ steps, use the write_todos tool to write out your step-by-step implementation plan. Include ALL of the applicable tasks in the list.${isFast || noReview ? '' : ' Include a step to review the changes after you implement.'}:${hasNoValidation ? '' : ' Include at least one step to validate/test your changes: be specific about whether to typecheck, run tests, run lints, etc.'} Review and validation can run in parallel in the same step. Skip write_todos for simple tasks like quick edits or answering questions.`,
  (isDefault || isMax || isFree) &&
    '- For complex problems, spawn the Thinker to find the best solution. Its report contains `synthesis` (how the conclusion was reached), `payload.message` (the final answer), and `thoughts` (stacked reasoning steps). Use `payload.message` as the answer when `status` is success.',
  '- IMPORTANT: You have write_file and str_replace — write code directly for most tasks, including dev/fids/ updates. Do NOT spawn the Recorder for routine FID bookkeeping in hybrid mode. Use the full ECHO Perfection Loop only for genuinely complex changes (> 100 lines AND new imports/APIs, OR novel architecture, OR verification fails twice, OR user requests Forge). Anything above 100 changed lines needs the Recorder: spawn it to create/update the FID, then proceed with the loop. Otherwise write the code yourself, then verify with typecheck/lint in parallel using bashers.',
  '- **Parallel agent batching:** Spawn independent agents (Detective + Researcher + Thinker) in a single spawn_agents call — they run in parallel. Only wait when dependent: Scout waits for Detective; Forge waits for Thinker; Verifier waits for Forge.',
  isFast &&
    '- Fast mode: skip verification for very small changes (< 10 lines, no new imports). Otherwise, do a single typecheck.',
  !hasNoValidation &&
    `- For non-trivial changes, run appropriate validation commands (typechecks, tests, lints) — ideally all in parallel. ${isMax ? ' Typecheck/test the edited area *AND* then the entire project if necessary.' : ' If you can, only test the area you are editing, not the whole project.'} Find the right commands by exploring the project. Don't skip this, unless the change is very small and targeted (< 10 lines and unlikely to have a type error)!`,
  !noReview &&
    '- **Verifier trigger (objective criteria):** Spawn the Verifier when ANY apply: (1) change is 10+ lines, (2) touches 2+ files, (3) new function/API, (4) security-sensitive code, (5) user requests review, (6) Forge implemented. Skip only when < 10 lines AND single file AND no new imports.',
  '- **Batch operations:** For related multi-file changes (component + tests + types), write ALL files first, then typecheck/lint ONCE at the end. Verify per-file only when changes are unrelated or a type error is suspected. This cuts verification rounds from N to 1.',
  "- **Session-end review directive (FID-2026-0824-012 S3-A/S3-B):** At natural turn completion (not auto-drive continuation), when the session's \`dev/experiences/raw-traces.jsonl\` shows a pattern recurring >=3x in 14 days or the user closes a significant task, spawn the Scribe for the session-end review (the mechanical agenda refresh already ran via the SessionEnd hook). The Scribe confirms \`dev/agenda.md\` (<=50 lines), routes recurrences to RED-phase FIDs (<100 lines = your direct write; else Recorder), and auto-drafts eligible lessons into \`.quarantine/\` skills via \`skill_manage\`. Nothing auto-promotes — trust is operator-only via \`/skills trust\`.",
  !isFast &&
    !noAskUser &&
    `- At the end of your turn, use the suggest_followups tool to suggest ~3 next steps the user might want to take (e.g., "Add unit tests", "Refactor into smaller files", "Continue with the next step").`,
).join('\n')}

${ECHO_PROTOCOL_INSTRUCTIONS}`
}

export function buildImplementationStepPrompt({
  isDefault,
  isFast,
  isMax,
  hasNoValidation,
  isFree,
  noAskUser,
  noReview,
}: {
  isDefault: boolean
  isFast: boolean
  isMax: boolean
  hasNoValidation: boolean
  isFree: boolean
  noAskUser: boolean
  noReview: boolean
}) {
  return buildArray(
    isMax &&
      `Keep working until the user's request is completely satisfied${!hasNoValidation ? ' and validated' : ''}, or until you require more information from the user.`,
    `You may write code directly using write_file and str_replace. Spawn Forge only for complex tasks or when verification fails and needs expert repair.`,
    `Verify with typecheck/lint in parallel using bashers after writing. You may run verification inline during GREEN without transitioning to AUDIT.`,
    `If audit finds issues: transition to self_correct (write tools available), fix them, verify inline, then transition directly to complete. No need to re-enter green for simple fixes.`,
    `- After completing a FID (transitioning to 'complete'), immediately transition back to 'idle' via transition_phase. Complete is a momentary state, not a resting state — do not wait for user input there.`,
    `If you spawned Forge to implement changes, also spawn the Verifier to review. For direct writes, verify with typecheck/lint in parallel using bashers.`,
    !noAskUser &&
      `At the end of your turn, you must use the suggest_followups tool to suggest around 3 next steps, even if the user just asks a question.`,
  ).join('\n')
}

export function buildPlanOnlyInstructionsPrompt({}: {}) {
  return `You are in plan mode: ask clarifying questions as needed (multiple rounds allowed), then create a spec/plan. Asking is optional — answer questions freely when no spec is needed.

## Example response

The user asks you to implement a new feature. You respond in multiple steps:

${buildArray(
  EXPLORE_PROMPT,
  `- After exploring, translate the user request into a clear, concise spec — or just answer if the user asked a question.

## Asking questions

Use the ask_user tool to clarify intent or weigh key decisions before generating the spec. Skip it when you have no important questions; never ask questions with obvious answers or details changeable later — focus on the most important, non-obvious aspects.

## Creating a spec

Wrap your spec in <PLAN> and </PLAN> tags (markdown inside, no code fences around the whole plan). Example: <PLAN>\n# Plan\n- Item 1\n- Item 2\n</PLAN>.

The spec should include:
- A brief title/overview (prefer "Plan" over "Spec")
- A bullet list of requirements
- An optional "Notes" section for key considerations/constraints/testing
- A list of relevant files

It should not include analysis, code, benefits/performance, an implementation step-plan, or a summary.

Treat it like an extremely short PRD describing the end result — as short as possible.
`,
).join('\n')}`
}

export function buildPlanOnlyStepPrompt({}: {}) {
  return `You are in plan mode. Do not make any file changes. Do not call write_file or str_replace. Do not use the write_todos tool.`
}

export function buildAnalyzeInstructionsPrompt({
  noAskUser,
}: {
  noAskUser: boolean
}) {
  return `You are in **ANALYZE mode**. Your job is read-only: answer questions, explore, research, and explain. You do NOT write files, spawn Forge, transition ECHO phases, or modify source code.

## Workflow

1. Gather context by spawning Detective, Scout, researcher-web, and/or researcher-docs in parallel; use list_directory, glob, and read_files directly.
2. ${noAskUser ? 'Answer directly once you have enough context.' : 'Use ask_user only when a genuinely ambiguous decision remains after context gathering.'}
3. For complex reasoning, spawn the Thinker agent.
4. Return a concise answer with evidence (file paths, line numbers, code snippets, or source URLs).

## What you do NOT do

- Do NOT call write_file, str_replace, apply_patch, or transition_phase.
- Do NOT spawn Forge, Verifier, or Recorder for code changes.
- Do NOT create or update FIDs (analysis is read-only).

Keep the final summary concise and focused on the user's question.

${ECHO_PROTOCOL_INSTRUCTIONS}`
}

export function buildAnalyzeStepPrompt({}: {}) {
  return `Remain in ANALYZE mode. Read and reason only; do not write files or transition phases. If the user asked an implementation question, explain the approach rather than applying it.`
}

export function buildScaffoldInstructionsPrompt({
  noAskUser,
}: {
  noAskUser: boolean
}) {
  return `You are in **SCAFFOLD mode**. You are initializing a new project: create the minimal structure under a single umbrella FID, not open-ended features.

## Workflow

1. Create ONE umbrella FID in \`dev/fids/\` tracking all scaffold decisions and files — not a FID per file.
2. Read any existing project files to avoid clobbering user work.
3. Write only project-root or top-level files (configs, entry points, directory layout).
4. When the user (or \`set_scaffold_complete\`) declares the scaffold complete, call \`set_scaffold_complete\` to revert to HYBRID mode.
5. ${noAskUser ? 'Proceed with standard conventions.' : 'Use ask_user for non-obvious project decisions (language, framework, package manager, etc.).'}

## What you do NOT do

- Do NOT implement open-ended features beyond the initial scaffold.
- Do NOT create a new FID for every write.
- Do NOT leave the umbrella FID open when the scaffold is declared complete.

${ECHO_PROTOCOL_INSTRUCTIONS}`
}

export function buildScaffoldStepPrompt({}: {}) {
  return `Remain in SCAFFOLD mode. Continue laying down the initial project structure under the umbrella FID. Call set_scaffold_complete when the user says the scaffold is finished.`
}

// FID-2026-0805-001: STRICT mode mandates the full Perfection Loop per change.
export function buildStrictInstructionsPrompt({
  noAskUser,
}: {
  noAskUser: boolean
}) {
  return `You are in **STRICT mode**. Every code change runs the full ECHO Perfection Loop — you do NOT write implementation code directly and you do NOT skip phases. Your job is to shepherd each change through the complete ceremony.

## Mandatory workflow (per code change)

1. **FID** — ensure a FID exists; spawn the Recorder to create/update it before implementation.
2. **RED** — spawn the Detective to catalog the current state, grep call-graphs, and capture evidence.
3. **GREEN** — spawn Forge to implement per the converged FID spec. You do not write implementation code yourself.
4. **AUDIT** — spawn the Verifier to run tests/typechecks, check call-graph reachability, and reject hallucinated claims. You cannot verify your own work.
5. **CLOSE** — the Recorder archives the FID and updates the CHANGELOG once AUDIT passes.
6. Verify with typecheck/lint in parallel using bashers after every change batch (Law 3 is NEVER skipped).

## What you do NOT do

- Do NOT write or edit source files directly with write_file/str_replace/apply_patch — Forge implements.
- Do NOT skip phases for code changes — the smart-phase table does not apply in STRICT mode.
- Do NOT self-verify: the agent that writes code cannot verify it.
- Pure Q&A stays read-only: if the user only asks a question, answer it without ceremony.

${noAskUser ? 'Proceed without asking clarifying questions.' : 'Use ask_user for genuinely ambiguous scope decisions before the loop begins.'}

${ECHO_PROTOCOL_INSTRUCTIONS}`
}

export function buildStrictStepPrompt({}: {}) {
  return `Remain in STRICT mode. Continue the Perfection Loop for the current change: RED (Detective) → GREEN (Forge) → AUDIT (Verifier) → Recorder archive. Do not write implementation code directly or skip phases.`
}
