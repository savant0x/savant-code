/**
 * FID-2026-0907-002 (Step 2) — the read-truncation threshold shared by the
 * read tool and the edit tool.
 *
 * Canonical home is `common` because BOTH directions need it: `sdk`'s
 * read-files truncates at this limit, and `agent-runtime`'s str_replace
 * guidance references it. sdk → agent-runtime is the workspace dependency
 * direction (sdk/src/index.ts imports agent-runtime), so agent-runtime
 * cannot import an sdk constant without a cycle; `common` is the kernel
 * both already depend on.
 *
 * read-files truncates file content shown to the model at this many
 * characters (with a FILE_TOO_LARGE notice); process-str-replace cites it
 * verbatim when an edit fails on a file past the limit — a silent
 * divergence between the two would recreate the large-file confusion loop
 * (dev/LEARNINGS.md: large-file-edits-via-apply-patch).
 */
export const READ_FILES_MAX_CHARS = 100_000
