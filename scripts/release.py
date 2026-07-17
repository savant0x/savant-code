#!/usr/bin/env python3
"""
savant-protocol/scripts/release.py

One-command release: tag -> push -> create GitHub release with changelog notes.

USAGE
    python scripts/release.py                    # Release current VERSION
    python scripts/release.py 0.1.3              # Release specific version
    python scripts/release.py --dry-run          # Show what would happen
    python scripts/release.py --update           # Update existing release notes
    python scripts/release.py --skip-tag         # Don't create/push a tag (already exists)
    python scripts/release.py --help             # Show usage

WHAT IT DOES
    1. Validate working tree is clean
    2. Validate VERSION file
    3. Extract release notes for this version from CHANGELOG.md
    4. Create + push git tag (unless --skip-tag)
    5. Create or update GitHub release via the REST API

REQUIREMENTS
    - git on PATH
    - GitHub token accessible via the git credential helper
      (savant-trading and savant-protocol both use the standard Git Credential Manager)
    - No additional packages (stdlib only)
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Force UTF-8 stdout/stderr on Windows so box-drawing chars don't crash
# when run from cmd.exe (default cp1252).
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PROTOCOL_ROOT = Path(__file__).resolve().parent.parent
REPO_SLUG = "fame0528/savant-protocol"
API_BASE = "https://api.github.com"


# ── Color output helpers (ANSI; no-op on legacy Windows cmd) ──────────
def _enable_vt() -> None:
    if sys.platform != "win32":
        return
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        pass


_enable_vt()
C_RESET = "\033[0m"
C_RED = "\033[0;31m"
C_GREEN = "\033[0;32m"
C_YELLOW = "\033[1;33m"
C_CYAN = "\033[0;36m"
C_BOLD = "\033[1m"


def info(msg: str) -> None:
    print(f"{C_CYAN}[INFO]{C_RESET}  {msg}")


def ok(msg: str) -> None:
    print(f"{C_GREEN}[OK]{C_RESET}    {msg}")


def warn(msg: str) -> None:
    print(f"{C_YELLOW}[WARN]{C_RESET}  {msg}")


def fail(msg: str) -> int:
    print(f"{C_RED}[FAIL]{C_RESET}  {msg}")
    return 1


def header(msg: str) -> None:
    print(f"\n{C_BOLD}━━━ {msg} ━━━{C_RESET}")


# ── git helpers ──────────────────────────────────────────────────────
def run(cmd: list, cwd: Path = PROTOCOL_ROOT, check: bool = True) -> subprocess.CompletedProcess:
    """Run a git command; return CompletedProcess."""
    return subprocess.run(cmd, cwd=cwd, check=check, capture_output=True, text=True)


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return run(["git", *args], check=check)


def tag_exists(version: str) -> bool:
    result = git("tag", "-l", f"v{version}", check=False)
    return f"v{version}" in result.stdout.splitlines()


def working_tree_clean() -> bool:
    result = git("status", "--porcelain", check=False)
    return result.stdout.strip() == ""


# ── GitHub credential extraction ────────────────────────────────────
def get_github_token() -> str:
    """Pull a GitHub token from the git credential helper.

    Tries each configured helper. If none return a usable token, exits.
    """
    helper = git("config", "--get", "credential.helper", check=False).stdout.strip()
    if not helper:
        return _prompt_token()

    # The "manager" helper on Windows is git-credential-manager.exe.
    # We just need to send it the input format and parse the output.
    input_data = "protocol=https\nhost=github.com\n"
    try:
        result = subprocess.run(
            ["git", "credential", "fill"],
            input=input_data,
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        return _prompt_token()

    for line in result.stdout.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1].strip()

    return _prompt_token()


def _prompt_token() -> str:
    print(f"{C_YELLOW}Could not extract a GitHub token from the git credential helper.{C_RESET}")
    print("Paste a GitHub Personal Access Token (repo scope for releases):")
    try:
        import getpass

        return getpass.getpass("Token: ").strip()
    except (ImportError, EOFError):
        return input("Token: ").strip()


# ── Release notes extraction ────────────────────────────────────────
def read_version() -> str:
    return PROTOCOL_ROOT.joinpath("VERSION").read_text(encoding="utf-8").strip()


def write_version(new: str) -> None:
    PROTOCOL_ROOT.joinpath("VERSION").write_text(new + "\n", encoding="utf-8")


def extract_release_notes(version: str) -> str:
    """Pull the section of CHANGELOG.md for the given version.

    Looks for headings like '## v0.1.2 — ...' or '## [0.1.2] — ...'.
    Captures everything until the next version heading.
    """
    changelog = PROTOCOL_ROOT.joinpath("CHANGELOG.md").read_text(encoding="utf-8")
    # Match the version section header
    pattern = re.compile(
        rf"^##\s+(?:\[)?v?{re.escape(version)}(?:\]|\s|—|-|$).*?$",
        re.MULTILINE,
    )
    m = pattern.search(changelog)
    if not m:
        return f"Release v{version}"
    start = m.start()
    # Next "## " after the section start
    rest = changelog[start + 1 :]
    next_heading = re.search(r"^##\s+", rest, re.MULTILINE)
    end = start + 1 + (next_heading.start() if next_heading else len(rest))
    notes = changelog[start:end].rstrip()
    # Strip blank lines at end
    return notes


# ── GitHub API ──────────────────────────────────────────────────────
def api_request(method: str, path: str, token: str, body: dict | None = None) -> tuple[int, dict | str]:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "savant-protocol-release-script",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = resp.read().decode("utf-8")
            return resp.status, (json.loads(payload) if payload else {})
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(body_text)
        except json.JSONDecodeError:
            return e.code, body_text
    except urllib.error.URLError as e:
        return 0, f"URLError: {e.reason}"


def release_exists(version: str, token: str) -> bool:
    status, _ = api_request("GET", f"/repos/{REPO_SLUG}/releases/tags/v{version}", token)
    return status == 200


def create_release(version: str, notes: str, token: str) -> tuple[int, dict | str]:
    return api_request(
        "POST",
        f"/repos/{REPO_SLUG}/releases",
        token,
        {
            "tag_name": f"v{version}",
            "target_commitish": "main",
            "name": f"v{version}",
            "body": notes,
            "draft": False,
            "prerelease": False,
        },
    )


def update_release(release_id: int, version: str, notes: str, token: str) -> tuple[int, dict | str]:
    return api_request(
        "PATCH",
        f"/repos/{REPO_SLUG}/releases/{release_id}",
        token,
        {"name": f"v{version}", "body": notes},
    )


def get_release_id(version: str, token: str) -> int | None:
    status, body = api_request("GET", f"/repos/{REPO_SLUG}/releases/tags/v{version}", token)
    if status == 200 and isinstance(body, dict):
        return body.get("id")
    return None


# ── Main ────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("version", nargs="?", help="New version number (e.g. 0.1.3). Defaults to VERSION file.")
    ap.add_argument("--dry-run", action="store_true", help="Show what would happen without executing")
    ap.add_argument("--update", action="store_true", help="Update notes on an existing release (no tag changes)")
    ap.add_argument("--skip-tag", action="store_true", help="Don't create/push a git tag")
    args = ap.parse_args()

    current_version = read_version()
    version = args.version or current_version

    header("Pre-flight Checks")

    if not PROTOCOL_ROOT.joinpath(".git").exists():
        return fail("Not a git repository")
    ok(f"git repo: {PROTOCOL_ROOT}")

    if args.update:
        ok("--update mode: skipping clean-tree check")
    elif not working_tree_clean():
        return fail("Working tree has uncommitted changes. Commit or stash first.")
    else:
        ok("Working tree is clean")

    if not re.match(r"^\d+\.\d+\.\d+$", version):
        return fail(f"Version '{version}' doesn't match semver (X.Y.Z)")

    if not args.update and not args.skip_tag and tag_exists(version):
        return fail(f"Tag v{version} already exists. Use --skip-tag or delete it first.")
    if args.skip_tag and not tag_exists(version):
        return fail(f"--skip-tag passed but tag v{version} does not exist remotely")
    ok(f"Version: {version}")

    if not PROTOCOL_ROOT.joinpath("CHANGELOG.md").exists():
        return fail("CHANGELOG.md missing")

    header("Extract Release Notes")
    notes = extract_release_notes(version)
    if not notes.strip():
        return fail(f"No release notes found in CHANGELOG.md for v{version}")
    preview_lines = notes.splitlines()[:5]
    info(f"Release notes preview ({len(notes.splitlines())} lines total):")
    for line in preview_lines:
        print(f"    {line}")
    if len(notes.splitlines()) > 5:
        info(f"  ... ({len(notes.splitlines()) - 5} more lines)")

    if args.update:
        header("Update Existing Release")
        token = get_github_token()
        rid = get_release_id(version, token)
        if rid is None:
            return fail(f"No existing release found for v{version}")
        if args.dry_run:
            info(f"[DRY RUN] Would update release {rid} for v{version}")
            return 0
        status, body = update_release(rid, version, notes, token)
        if status in (200, 201):
            ok(f"Release updated: https://github.com/{REPO_SLUG}/releases/tag/v{version}")
            return 0
        return fail(f"Update failed: HTTP {status} — {body}")

    if not args.skip_tag:
        header("Create + Push Tag")
        if args.dry_run:
            info(f"[DRY RUN] Would create and push tag v{version}")
        else:
            git("tag", "-a", f"v{version}", "-m", f"Release v{version}")
            ok(f"Created local tag v{version}")
            git("push", "origin", f"v{version}")
            ok(f"Pushed tag v{version} to origin")

    header("Create GitHub Release")
    token = get_github_token()

    if args.dry_run:
        info(f"[DRY RUN] Would create release v{version} on {REPO_SLUG}")
        return 0

    if release_exists(version, token):
        warn(f"Release v{version} already exists. Use --update to refresh notes.")
        return 0

    status, body = create_release(version, notes, token)
    if status in (200, 201):
        if isinstance(body, dict):
            html_url = body.get("html_url", f"https://github.com/{REPO_SLUG}/releases/tag/v{version}")
        else:
            html_url = f"https://github.com/{REPO_SLUG}/releases/tag/v{version}"
        ok(f"Release created: {html_url}")
    else:
        return fail(f"Release creation failed: HTTP {status} — {body}")

    header("Release Complete")
    print()
    print(f"  Version: v{version}")
    print(f"  Tag:     v{version}")
    print(f"  Release: https://github.com/{REPO_SLUG}/releases/tag/v{version}")
    print()
    ok(f"Release v{version} is live.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
