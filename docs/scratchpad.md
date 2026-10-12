# Managed scratchpad

Savant-Code treats `dev/scratchpad/` as temporary working storage in each project.
The `active/` and legacy `archive/` folders both expire. Neither is project memory.
Put lasting reports in your project's report/test locations, reusable probes in
scripts, and knowledge in durable documentation before ending a task.

## Automatic housekeeping

- Files expire 24 hours after their last modification.
- When idle storage exceeds 32 MiB or 1,000 files, prune the oldest eligible
  files first. Files modified within the last hour have quota grace.
- Cleanup runs on CLI startup, every five minutes while the CLI is open, and
  before and after native SDK runs. Interactive and headless runs share it.
- A live SDK run protects the entire scratchpad, including child-agent and
  terminal-created files. Temporary storage can exceed the budget while live
  work or recent files remain protected. Cleanup catches up after the run.
- Root `README.md` and `.gitkeep` remain. Empty nested directories are removed.
  Symbolic links and Windows junctions are never followed.

Cross-process leases and a bounded exclusive lock live under
`.savant/scratchpad-lifecycle/`, outside the files being cleaned. Dead process
leases are reclaimed after a crash; the remaining files follow normal retention.
Malformed ownership data blocks deletion and produces a warning. Cleanup
errors cannot terminate a user run. If protection cannot be established, the SDK
logs a warning; do not treat that run as protected. Unmanaged external editors
and older CLI versions have no lease: promote work you need to keep.

Virtual/injected SDK filesystems receive no native housekeeping. This manager
does not run a daemon while Savant is closed. Resume must tolerate expired
temporary files; durable conversation history lives elsewhere.

## Inspect and clean

Use `/scratchpad status` to see the file/byte inventory, live protection,
budget overflow, incomplete scans, skipped links and diagnostics.
Use `/scratchpad clean` to apply the same expiry and quota rules immediately.
It does not force-delete live or recent files.

Defaults are shared product policy, not a repository cleanup script. A sweep
examines at most 10,000 entries. An incomplete scan reports that limitation and
expires inspected files and prunes proven excess; it never claims quota compliance.
Coordinate repeated bounded sweeps when a very large legacy folder needs cleanup.
