#!/usr/bin/env bash
# Setup savant-code bot authorship for this repo.
#
# FID-2026-0806-004 Task 3: automated/tool commits (Forge, version bumps) get
# their own contributor identity instead of inheriting the operator's.
#
# Idempotent: safe to re-run. Repo-local only — never touches the global git
# config, and only affects THIS repository.
#
# For a one-shot bot identity on a single commit (no config change at all):
#   git -c user.name="savant-code" -c user.email="bot@savant-code.com" commit -m "..."
#
# To switch back to your own identity for personal commits:
#   git config --unset user.name && git config --unset user.email
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

git config user.name "savant-code"
git config user.email "bot@savant-code.com"

echo "✅ Bot authorship configured for this repo"
echo "   Commits will show as: savant-code <bot@savant-code.com>"
echo
echo "One-shot (no config change): git -c user.name='savant-code' -c user.email='bot@savant-code.com' commit -m \"...\""
echo "Revert to your own identity: git config --unset user.name && git config --unset user.email"
