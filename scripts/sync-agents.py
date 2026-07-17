#!/usr/bin/env python3
"""
savant-protocol/scripts/sync-agents.py

Push ECHO Protocol to one or more agent homes.

USAGE
    python sync-agents.py                    # dry-run; shows what would be pushed
    python sync-agents.py --apply            # actually copy files
    python sync-agents.py --target <name>    # only push to one named target
    python sync-agents.py --list             # show available targets
    python sync-agents.py --init             # generate a default sync.yaml

WHAT IT COPIES
    For each target, copies a configured set of files from this
    savant-protocol/ source to the target's destination.

    Targets with mode "copy"  -> source file copied as-is to dest
    Targets with mode "strip" -> source file copied with the trailing
                                "Project: <name>" section removed
                                (used for project-tail-amended ECHO.md)

DEFAULTS (edit sync.yaml to customize)
    - NOVA   (Hermes agent at ~/.hermes/)   -> universal core, no project tail
    - MYA    (OpenClaw agent at ~/.openclaw/) -> universal core, no project tail
    - SAVANT-TRADING (savant-trading repo)   -> full file with project tail kept
"""

import argparse
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

PROTOCOL_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SYNC_FILE = PROTOCOL_ROOT / "scripts" / "sync.yaml"


@dataclass
class Target:
    """One destination the protocol gets pushed to."""

    name: str
    root: Path
    mode: str = "copy"  # "copy" = file as-is, "strip-project-tail" = trim trailing project section
    files: list = field(default_factory=list)

    def resolve_dest(self, rel_path: Path) -> Path:
        return self.root / rel_path


@dataclass
class SyncPlan:
    """The full push plan: one or more targets, each with a list of relative source files."""

    source: Path
    targets: list

    def expand_files(self, rel_paths: list) -> list:
        return [self.source / p for p in rel_paths]


DEFAULT_TARGETS = [
    Target(
        name="NOVA",
        root=Path.home() / "AppData" / "Local" / "hermes",
        mode="copy",
        files=[
            "ECHO.md",
            "STARTER-PROMPT.md",
            "MIGRATION.md",
            "protocol.config.yaml",
            "coding-standards/csharp.md",
            "coding-standards/go.md",
            "coding-standards/java.md",
            "coding-standards/python.md",
            "coding-standards/rust.md",
            "coding-standards/typescript.md",
            "coding-standards/release-workflow.md",
            "coding-standards/x402.md",
            "templates/FID-TEMPLATE.md",
            "templates/SESSION-SUMMARY.md",
        ],
    ),
    Target(
        name="MYA",
        root=Path.home() / ".openclaw",
        mode="copy",
        files=[
            "ECHO.md",
            "STARTER-PROMPT.md",
            "MIGRATION.md",
            "protocol.config.yaml",
            "coding-standards/csharp.md",
            "coding-standards/go.md",
            "coding-standards/java.md",
            "coding-standards/python.md",
            "coding-standards/rust.md",
            "coding-standards/typescript.md",
            "coding-standards/release-workflow.md",
            "coding-standards/x402.md",
            "templates/FID-TEMPLATE.md",
            "templates/SESSION-SUMMARY.md",
        ],
    ),
    Target(
        name="SAVANT-TRADING",
        root=PROTOCOL_ROOT.parent / "savant-trading",
        mode="copy",
        files=[
            "ECHO.md",
            "STARTER-PROMPT.md",
            "MIGRATION.md",
            "coding-standards/csharp.md",
            "coding-standards/go.md",
            "coding-standards/java.md",
            "coding-standards/python.md",
            "coding-standards/rust.md",
            "coding-standards/typescript.md",
            "coding-standards/release-workflow.md",
            "templates/FID-TEMPLATE.md",
            "templates/SESSION-SUMMARY.md",
        ],
    ),
]


def strip_project_tail(content: str) -> str:
    """Remove the trailing '## Project: ...' section from an ECHO.md file.

    The universal core ends with '---' before any project-specific section.
    This finds the LAST '## Project:' line and trims from there.
    """
    marker = "\n## Project:"
    idx = content.rfind(marker)
    if idx == -1:
        return content
    cutoff = content.rfind("\n---\n", 0, idx)
    if cutoff == -1:
        return content
    return content[: cutoff + 5].rstrip() + "\n"


def plan_push(target: Target, source: Path) -> list:
    """Return a list of (src_path, dest_path, action) tuples."""
    actions = []
    for rel in target.files:
        src = source / rel
        if not src.exists():
            actions.append((src, None, "MISSING-SOURCE"))
            continue
        dest = target.resolve_dest(Path(rel))
        if target.mode == "strip-project-tail" and src.name == "ECHO.md":
            actions.append((src, dest, "strip"))
        else:
            actions.append((src, dest, "copy"))
    return actions


def execute_push(actions: list, apply: bool) -> list:
    """Execute the push plan; return list of (action, src, dest, status) results."""
    results = []
    for src, dest, action in actions:
        if action == "MISSING-SOURCE":
            results.append((action, src, None, "skipped"))
            continue
        if not apply:
            results.append((action, src, dest, "dry-run"))
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        if action == "strip":
            content = src.read_text(encoding="utf-8")
            stripped = strip_project_tail(content)
            dest.write_text(stripped, encoding="utf-8")
            results.append((action, src, dest, f"wrote {len(stripped)} bytes (stripped tail)"))
        else:
            shutil.copy2(src, dest)
            results.append((action, src, dest, f"copied {src.stat().st_size} bytes"))
    return results


def load_sync_file(path: Path) -> list:
    """Load custom target list from sync.yaml.

    Format (intentionally simple — no PyYAML dep):
        target:
          - name: NOVA
            root: C:/Users/...
            mode: copy
            files:
              - ECHO.md
              - coding-standards/rust.md
    """
    if not path.exists():
        return DEFAULT_TARGETS
    text = path.read_text(encoding="utf-8")
    targets = []
    current = None
    in_files = False
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped == "target:":
            if current is not None:
                targets.append(current)
            current = {"files": []}
            in_files = False
            continue
        if current is None:
            continue
        if stripped.startswith("- "):
            kv = stripped[2:]
            if ":" in kv and not in_files:
                key, _, val = kv.partition(":")
                current[key.strip()] = val.strip()
                in_files = False
        elif stripped.startswith("files:"):
            in_files = True
        elif in_files and stripped.startswith("- "):
            current["files"].append(stripped[2:].strip())
    if current is not None:
        targets.append(current)
    parsed = []
    for t in targets:
        parsed.append(
            Target(
                name=t.get("name", "?"),
                root=Path(t["root"]),
                mode=t.get("mode", "copy"),
                files=t.get("files", []),
            )
        )
    return parsed


def write_default_sync_file(path: Path) -> None:
    """Generate a default sync.yaml the user can edit."""
    content = """# savant-protocol sync targets
# Edit paths/files, then run: python sync-agents.py --apply

target:
  - name: NOVA
    root: C:/Users/<you>/AppData/Local/hermes
    mode: copy
    files:
      - ECHO.md
      - STARTER-PROMPT.md
      - MIGRATION.md
      - protocol.config.yaml
      - coding-standards/rust.md
      - coding-standards/python.md
      - coding-standards/typescript.md
      - coding-standards/x402.md
      - templates/FID-TEMPLATE.md
      - templates/SESSION-SUMMARY.md

  - name: MYA
    root: C:/Users/<you>/.openclaw
    mode: copy
    files:
      - ECHO.md
      - STARTER-PROMPT.md
      - MIGRATION.md
      - protocol.config.yaml
      - coding-standards/rust.md
      - coding-standards/python.md
      - coding-standards/typescript.md
      - coding-standards/x402.md
      - templates/FID-TEMPLATE.md
      - templates/SESSION-SUMMARY.md
"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="Actually copy files (default: dry-run)")
    ap.add_argument("--target", help="Only push to one named target")
    ap.add_argument("--list", action="store_true", help="List configured targets")
    ap.add_argument("--init", action="store_true", help="Write a default sync.yaml")
    ap.add_argument("--sync-file", default=str(DEFAULT_SYNC_FILE), help="Path to sync.yaml")
    args = ap.parse_args()

    if args.init:
        write_default_sync_file(Path(args.sync_file))
        print(f"Wrote default {args.sync_file}")
        return 0

    targets = load_sync_file(Path(args.sync_file))
    if args.list:
        print(f"Configured targets ({len(targets)}):")
        for t in targets:
            print(f"  {t.name:20s} {t.root}  [{t.mode}]  {len(t.files)} files")
        return 0

    if args.target:
        targets = [t for t in targets if t.name.lower() == args.target.lower()]
        if not targets:
            print(f"No target named '{args.target}'", file=sys.stderr)
            return 1

    apply = args.apply
    print(f"Source: {PROTOCOL_ROOT}")
    print(f"Mode:   {'APPLY' if apply else 'DRY-RUN'}")
    print()

    grand_total = 0
    for target in targets:
        if not target.root.exists():
            print(f"[{target.name}] SKIP — target root does not exist: {target.root}")
            print()
            continue
        print(f"[{target.name}] -> {target.root}")
        actions = plan_push(target, PROTOCOL_ROOT)
        results = execute_push(actions, apply)
        for action, src, dest, status in results:
            if action == "MISSING-SOURCE":
                print(f"  MISSING  {src}")
            elif dest is None:
                continue
            elif action == "copy":
                verb = "WOULD COPY" if not apply else "COPIED   "
                print(f"  {verb} {src.name}  ->  {dest}")
            elif action == "strip":
                verb = "WOULD STRIP" if not apply else "STRIPPED  "
                print(f"  {verb}  {src.name}  ->  {dest}  ({status})")
        grand_total += len(results)
        print()

    print(f"Total: {grand_total} file(s) {'pushed' if apply else 'would push'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
