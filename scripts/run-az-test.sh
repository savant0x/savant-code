#!/usr/bin/env bash
# =============================================================================
# Savant-Code — Automated A-Z System Test Runner (v11)
# =============================================================================
# Automates all code-level (non-interactive) tests from the A-Z test prompt.
# Interactive-only tests (slash commands, TUI, /dev, agent spawning) are marked
# SKIP with instructions for manual verification.
#
# USAGE:
#   bash scripts/run-az-test.sh              # Run all automatable tests
#   bash scripts/run-az-test.sh --phase 15   # Run only typecheck phase
#   bash scripts/run-az-test.sh --summary    # Print summary only (from last run)
#   bash scripts/run-az-test.sh --help       # Show usage
#
# REQUIREMENTS:
#   - bash 4+
#   - bun (for typechecks)
#   - ripgrep (rg) or grep -r (for pattern checks)
#   - jq (optional, for JSON output)
#
# OUTPUT:
#   dev/scratchpad/az-test-results.json — Machine-readable results
#   dev/scratchpad/az-test-results.md   — Human-readable report
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$REPO_ROOT/dev/scratchpad"
RESULTS_JSON="$RESULTS_DIR/az-test-results.json"
RESULTS_MD="$RESULTS_DIR/az-test-results.md"
FILTER_PHASE=""

# Colors (no-op if not a terminal)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' CYAN='' BOLD='' RESET=''
fi

# ── Counters ──────────────────────────────────────────────────────────────────
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
TOTAL_COUNT=0
RESULTS=()

# ── Helpers ───────────────────────────────────────────────────────────────────
pass() {
  local id="$1" desc="$2"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  PASS_COUNT=$((PASS_COUNT + 1))
  RESULTS+=("{\"id\":\"$id\",\"status\":\"PASS\",\"description\":\"$desc\"}")
  echo -e "  ${GREEN}✅ PASS${RESET}  $id — $desc"
}

fail() {
  local id="$1" desc="$2" detail="${3:-}"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  FAIL_COUNT=$((FAIL_COUNT + 1))
  RESULTS+=("{\"id\":\"$id\",\"status\":\"FAIL\",\"description\":\"$desc\",\"detail\":\"$detail\"}")
  echo -e "  ${RED}❌ FAIL${RESET}  $id — $desc"
  if [ -n "$detail" ]; then
    echo -e "         ${RED}↳ $detail${RESET}"
  fi
}

skip() {
  local id="$1" desc="$2" reason="${3:-interactive-only}"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  SKIP_COUNT=$((SKIP_COUNT + 1))
  RESULTS+=("{\"id\":\"$id\",\"status\":\"SKIP\",\"description\":\"$desc\",\"reason\":\"$reason\"}")
  echo -e "  ${YELLOW}⏭  SKIP${RESET}  $id — $desc ($reason)"
}

header() {
  echo ""
  echo -e "${BOLD}━━━ $1 ━━━${RESET}"
}

# Check if a file contains a pattern (case-insensitive)
grep_q() {
  local pattern="$1" file="$2"
  grep -qiE "$pattern" "$file" 2>/dev/null
}

# Check if a file does NOT contain a pattern
grep_not() {
  local pattern="$1" file="$2"
  ! grep -qiE "$pattern" "$file" 2>/dev/null
}

# Check if rg/grep finds matches in a file or directory (recursive).
# Uses grep -rE for portability (Windows Git Bash compatible).
rg_check() {
  local pattern="$1" path="$2"
  if [ -d "$path" ]; then
    grep -rqE "$pattern" "$path" 2>/dev/null
  else
    grep -qE "$pattern" "$path" 2>/dev/null
  fi
}

# Check if rg/grep does NOT find matches in a file or directory
rg_not() {
  local pattern="$1" path="$2"
  if [ -d "$path" ]; then
    ! grep -rqE "$pattern" "$path" 2>/dev/null
  else
    ! grep -qE "$pattern" "$path" 2>/dev/null
  fi
}

# Count rg/grep matches in a file or directory
rg_count() {
  local pattern="$1" path="$2"
  if [ -d "$path" ]; then
    grep -rcE "$pattern" "$path" 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}' || true
  else
    grep -cE "$pattern" "$path" 2>/dev/null || echo "0"
  fi
}

# Count rg/grep matches in production source only (exclude test files and __tests__ dirs)
rg_count_prod() {
  local pattern="$1" path="$2"
  find "$path" -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.ts' ! -name '*.test.tsx' ! -name '*.spec.ts' ! -name '*.spec.tsx' ! -path '*/__tests__/*' -print0 2>/dev/null | \
    xargs -0 grep -cE "$pattern" 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}' || true
}

# ── Argument Parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase)
      FILTER_PHASE="$2"
      shift 2
      ;;
    --summary)
      if [ -f "$RESULTS_MD" ]; then
        cat "$RESULTS_MD"
      else
        echo "No previous results found. Run the test first."
      fi
      exit 0
      ;;
    --help|-h)
      head -30 "$0" | tail -20
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

run_phase() {
  local phase_num="$1"
  if [ -n "$FILTER_PHASE" ] && [ "$FILTER_PHASE" != "$phase_num" ]; then
    return 1
  fi
  return 0
}

# ── Ensure results directory exists ──────────────────────────────────────────
mkdir -p "$RESULTS_DIR"

echo -e "${BOLD}Savant-Code — Automated A-Z System Test v11${RESET}"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Platform: $(uname -s)"
echo ""

# =============================================================================
# Phase 1: Boot & Identity
# =============================================================================
if run_phase 1; then
  header "Phase 1: Boot & Identity"

  # T1: ECHO Protocol bootstrap
  if [ -f "$REPO_ROOT/ECHO.md" ]; then
    if grep_q "Protocol" "$REPO_ROOT/ECHO.md" && grep_q "Law" "$REPO_ROOT/ECHO.md"; then
      pass "T1" "ECHO.md exists with Protocol and Laws"
    else
      fail "T1" "ECHO.md exists but missing expected content" "Protocol or Law not found"
    fi
  else
    fail "T1" "ECHO.md does not exist"
  fi

  # T2: Open FIDs scan
  if [ -d "$REPO_ROOT/dev/fids" ] && [ -d "$REPO_ROOT/dev/fids/archive" ]; then
    pass "T2" "dev/fids/ and dev/fids/archive/ both exist"
  else
    fail "T2" "FID directories missing" "dev/fids or dev/fids/archive not found"
  fi

  # T3-T5: Interactive-only
  skip "T3" "Phase display in sidebar" "interactive-only"
  skip "T4" "Model metadata awareness" "interactive-only"
  skip "T5" "Direct-provider mode boot" "interactive-only"
fi

# =============================================================================
# Phase 2: Direct Tools (read tools + detective pattern checks)
# =============================================================================
if run_phase 2; then
  header "Phase 2: Direct Tools"

  # T6-T9: Read tools (file existence)
  for tid in T6 T7 T8 T9; do
    case "$tid" in
      T6) f="ECHO.md" ;;
      T7) f="protocol.config.yaml" ;;
      T8) f="package.json" ;;
      T9) f="ARCHITECTURE.md" ;;
    esac
    if [ -f "$REPO_ROOT/$f" ]; then
      pass "$tid" "read_files: $f exists"
    else
      fail "$tid" "read_files: $f missing"
    fi
  done

  # T10: glob cli/src/**/*.ts
  count=$(find "$REPO_ROOT/cli/src" -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    pass "T10" "glob cli/src/**/*.ts — $count files found"
  else
    fail "T10" "glob cli/src/**/*.ts — no files found"
  fi

  # T11-T12: list_directory
  if [ -d "$REPO_ROOT/dev/fids" ]; then
    pass "T11" "list_directory dev/fids — directory exists"
  else
    fail "T11" "list_directory dev/fids — directory missing"
  fi

  agent_dirs=$(find "$REPO_ROOT/agents" -maxdepth 1 -type d 2>/dev/null | wc -l)
  if [ "$agent_dirs" -gt 5 ]; then
    pass "T12" "list_directory agents — $((agent_dirs - 1)) subdirectories"
  else
    fail "T12" "list_directory agents — too few subdirectories ($agent_dirs)"
  fi

  # T13: glob agents/**/*.ts
  agent_ts=$(find "$REPO_ROOT/agents" -name "*.ts" 2>/dev/null | wc -l)
  if [ "$agent_ts" -gt 10 ]; then
    pass "T13" "glob agents/**/*.ts — $agent_ts files"
  else
    fail "T13" "glob agents/**/*.ts — too few files ($agent_ts)"
  fi

  # T14: resolveAndContain in paths.ts
  if rg_check "resolveAndContain" "$REPO_ROOT/common/src/util/paths.ts" 2>/dev/null; then
    pass "T14" "resolveAndContain exported in common/src/util/paths.ts"
  else
    fail "T14" "resolveAndContain NOT found in common/src/util/paths.ts"
  fi

  # T15: fsmPhase in agent-runtime
  if rg_check "fsmPhase" "$REPO_ROOT/packages/agent-runtime/src" 2>/dev/null; then
    pass "T15" "fsmPhase referenced in packages/agent-runtime/src"
  else
    fail "T15" "fsmPhase NOT found in packages/agent-runtime/src"
  fi

  # T15a: run_readonly_command (verify tool definition exists)
  if [ -f "$REPO_ROOT/packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts" ]; then
    pass "T15a" "run_readonly_command handler file exists"
  elif rg_check "run_readonly_command" "$REPO_ROOT/packages/agent-runtime/src/tools/handlers/list.ts" 2>/dev/null; then
    pass "T15a" "run_readonly_command registered in handler list"
  else
    fail "T15a" "run_readonly_command tool handler NOT found"
  fi

  # T16: cwd parameter documented
  if rg_check "cwd" "$REPO_ROOT/common/src/tools/params/tool/run-readonly-command.ts" 2>/dev/null; then
    pass "T16" "cwd parameter in run_readonly_command params"
  else
    fail "T16" "cwd parameter NOT in run_readonly_command params"
  fi

  # T17-T29: Interactive-only (FSM transitions, write tools)
  skip "T17-21" "Write tools in GREEN phase" "interactive-only"
  skip "T22-26" "Valid FSM transitions" "interactive-only"
  skip "T27-29" "Illegal FSM transitions" "interactive-only"
fi

# =============================================================================
# Phase 3: Dev Override
# =============================================================================
if run_phase 3; then
  header "Phase 3: Dev Override"
  skip "T29-32" "Dev mode activation" "interactive-only"
  skip "T33" "Unknown /dev subcommand" "interactive-only"
fi

# =============================================================================
# Phase 4: Slash Commands
# =============================================================================
if run_phase 4; then
  header "Phase 4: Slash Commands"
  skip "T34-43" "Available slash commands" "interactive-only"
  skip "T44" "/model free-text selection" "interactive-only"
  skip "T45" "/verify variants" "interactive-only"
fi

# =============================================================================
# Phase 5: Agent Roster
# =============================================================================
if run_phase 5; then
  header "Phase 5: Agent Roster"

  # Agent roster: name -> file path (parallel arrays for bash 3 compat)
  AGENT_NAMES=("Orchestrator (Savant)" "Detective" "Forge" "Verifier" "Recorder" "Thinker" "Scout" "Researcher (Web)" "Researcher (Docs)" "Scribe")
  AGENT_FILES=("agents/savant/savant.ts" "agents/detective/detective.ts" "agents/forge/forge.ts" "agents/verifier/verifier.ts" "agents/recorder/recorder.ts" "agents/thinker/thinker.ts" "agents/scout/scout.ts" "agents/researcher/researcher-web.ts" "agents/researcher/researcher-docs.ts" "agents/scribe/scribe.ts")

  tid=46
  for i in "${!AGENT_NAMES[@]}"; do
    agent="${AGENT_NAMES[$i]}"
    file="${AGENT_FILES[$i]}"
    if [ -f "$REPO_ROOT/$file" ]; then
      pass "T$tid" "Agent '$agent' exists at $file"
    else
      fail "T$tid" "Agent '$agent' MISSING at $file"
    fi
    tid=$((tid + 1))
  done

  # Verify tool sets
  if rg_check "spawn_agents" "$REPO_ROOT/agents/savant/savant.ts" 2>/dev/null; then
    pass "T56" "Savant has spawn_agents tool"
  else
    fail "T56" "Savant missing spawn_agents tool"
  fi

  if rg_check "code_search" "$REPO_ROOT/agents/detective/detective.ts" 2>/dev/null; then
    pass "T57" "Detective has code_search tool"
  else
    fail "T57" "Detective missing code_search tool"
  fi

  if rg_check "sequentialthinking" "$REPO_ROOT/agents/thinker/thinker.ts" 2>/dev/null; then
    pass "T58" "Thinker has sequentialthinking tool"
  else
    fail "T58" "Thinker missing sequentialthinking tool"
  fi

  # Verify code-reviewer-kimi is fully retired (only in blacklists/comments)
  kimi_in_spawn=$(rg -c "code-reviewer-kimi" "$REPO_ROOT/agents/savant/savant.ts" 2>/dev/null || echo "0")
  if [ "$kimi_in_spawn" = "0" ]; then
    pass "T59" "code-reviewer-kimi NOT in savant.ts spawn logic (retired)"
  else
    fail "T59" "code-reviewer-kimi still referenced in savant.ts" "$kimi_in_spawn matches found"
  fi
fi

# =============================================================================
# Phase 6: Scout File-Finding
# =============================================================================
if run_phase 6; then
  header "Phase 6: Scout File-Finding"
  skip "T47-49" "Scout file-finding" "interactive-only"
fi

# =============================================================================
# Phase 7: MCP Proxy Timeout
# =============================================================================
if run_phase 7; then
  header "Phase 7: MCP Proxy Timeout"
  if rg_check "withTimeout" "$REPO_ROOT/common/src/mcp/client.ts" 2>/dev/null; then
    pass "T50" "withTimeout in common/src/mcp/client.ts"
  else
    fail "T50" "withTimeout NOT in common/src/mcp/client.ts"
  fi
fi

# =============================================================================
# Phase 8: FSM Phase Inheritance
# =============================================================================
if run_phase 8; then
  header "Phase 8: FSM Phase Inheritance"
  if rg_check "fsmPhase" "$REPO_ROOT/packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts" 2>/dev/null; then
    pass "T53" "fsmPhase inherited in spawn-agent-utils.ts"
  else
    fail "T53" "fsmPhase NOT in spawn-agent-utils.ts"
  fi

  if rg_check "createAgentState" "$REPO_ROOT/packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts" 2>/dev/null; then
    pass "T54" "createAgentState in spawn-agent-utils.ts"
  else
    fail "T54" "createAgentState NOT in spawn-agent-utils.ts"
  fi
fi

# =============================================================================
# Phase 9: Perfection Loop
# =============================================================================
if run_phase 9; then
  header "Phase 9: Perfection Loop"
  skip "T56-59" "Perfection Loop circuit breaker" "interactive-only"
fi

# =============================================================================
# Phase 10: FID-013 v3 Path Safety
# =============================================================================
if run_phase 10; then
  header "Phase 10: FID-013 v3 Path Safety"

  if rg_check "resolveAndContain" "$REPO_ROOT/packages/agent-runtime/src/tools/handlers/tool/write-file.ts" 2>/dev/null; then
    pass "T61" "resolveAndContain in write-file.ts"
  else
    fail "T61" "resolveAndContain NOT in write-file.ts"
  fi

  if rg_check "resolveAndContain" "$REPO_ROOT/packages/agent-runtime/src/tools/handlers/tool/str-replace.ts" 2>/dev/null; then
    pass "T62" "resolveAndContain in str-replace.ts"
  else
    fail "T62" "resolveAndContain NOT in str-replace.ts"
  fi

  if rg_check "resolveAndContain" "$REPO_ROOT/packages/agent-runtime/src/tools/handlers/tool/apply-patch.ts" 2>/dev/null; then
    pass "T63" "resolveAndContain in apply-patch.ts"
  else
    fail "T63" "resolveAndContain NOT in apply-patch.ts"
  fi

  if rg_check "resolveAndContain" "$REPO_ROOT/packages/agent-runtime/src/tools/tool-executor.ts" 2>/dev/null; then
    pass "T64" "resolveAndContain in tool-executor.ts"
  else
    fail "T64" "resolveAndContain NOT in tool-executor.ts"
  fi
fi

# =============================================================================
# Phase 11: FID-014 v2 SDK-side Realpath
# =============================================================================
if run_phase 11; then
  header "Phase 11: FID-014 v2 SDK-side Realpath"

  # T65-T66: resolveAndContain in SDK files
  if rg_check "resolveAndContain" "$REPO_ROOT/sdk/src/tools/change-file.ts" 2>/dev/null; then
    pass "T65" "resolveAndContain in change-file.ts"
  else
    fail "T65" "resolveAndContain NOT in change-file.ts"
  fi

  if rg_check "resolveAndContain" "$REPO_ROOT/sdk/src/tools/apply-patch.ts" 2>/dev/null; then
    pass "T66" "resolveAndContain in apply-patch.ts"
  else
    fail "T66" "resolveAndContain NOT in apply-patch.ts"
  fi

  # T67: realpathFn in paths.ts
  if rg_check "realpathFn" "$REPO_ROOT/common/src/util/paths.ts" 2>/dev/null; then
    pass "T67" "realpathFn in common/src/util/paths.ts"
  else
    fail "T67" "realpathFn NOT in common/src/util/paths.ts"
  fi

  # T68-T69: realpathFn in SDK files
  if rg_check "realpathFn" "$REPO_ROOT/sdk/src/tools/change-file.ts" 2>/dev/null; then
    pass "T68" "realpathFn in change-file.ts"
  else
    fail "T68" "realpathFn NOT in change-file.ts"
  fi

  if rg_check "realpathFn" "$REPO_ROOT/sdk/src/tools/apply-patch.ts" 2>/dev/null; then
    pass "T69" "realpathFn in apply-patch.ts"
  else
    fail "T69" "realpathFn NOT in apply-patch.ts"
  fi

fi

# =============================================================================
# Phase 12: Skills System
# =============================================================================
if run_phase 12; then
  header "Phase 12: Skills System"

  skills_dir="$REPO_ROOT/.agents/skills"
  if [ -d "$skills_dir" ]; then
    skill_count=$(find "$skills_dir" -maxdepth 1 -type d | wc -l)
    skill_count=$((skill_count - 1))  # subtract the skills dir itself
    if [ "$skill_count" -ge 7 ]; then
      pass "T73" "Skills system — $skill_count skills present in .agents/skills/"
    else
      fail "T73" "Skills system — only $skill_count skills (expected 7+)"
    fi
  else
    fail "T73" ".agents/skills/ directory missing"
  fi
fi

# =============================================================================
# Phase 14: Knowledge Files
# =============================================================================
if run_phase 14; then
  header "Phase 14: Knowledge Files"

  if [ -f "$REPO_ROOT/dev/LEARNINGS.md" ]; then
    pass "T91" "dev/LEARNINGS.md exists"
  else
    fail "T91" "dev/LEARNINGS.md missing"
  fi

  if rg_check "LEARNINGS" "$REPO_ROOT/agents/scribe/scribe.ts" 2>/dev/null; then
    pass "T92" "LEARNINGS referenced in scribe.ts"
  else
    fail "T92" "LEARNINGS NOT in scribe.ts"
  fi
fi

# =============================================================================
# Phase 15: Typecheck
# =============================================================================
if run_phase 15; then
  header "Phase 15: Typecheck"

  echo -ne "  Running typecheck in sdk... "
  if (cd "$REPO_ROOT/sdk" && bun run typecheck 2>&1) >/dev/null 2>&1; then
    pass "T96" "Typecheck sdk — exit 0"
  else
    fail "T96" "Typecheck sdk — ERRORS"
  fi

  echo -ne "  Running typecheck in common... "
  if (cd "$REPO_ROOT/common" && bun run typecheck 2>&1) >/dev/null 2>&1; then
    pass "T97" "Typecheck common — exit 0"
  else
    fail "T97" "Typecheck common — ERRORS"
  fi

  echo -ne "  Running typecheck in packages/agent-runtime... "
  if (cd "$REPO_ROOT/packages/agent-runtime" && bun run typecheck 2>&1) >/dev/null 2>&1; then
    pass "T98" "Typecheck packages/agent-runtime — exit 0"
  else
    fail "T98" "Typecheck packages/agent-runtime — ERRORS"
  fi

  echo -ne "  Running typecheck in cli... "
  if (cd "$REPO_ROOT/cli" && bun run typecheck 2>&1) >/dev/null 2>&1; then
    pass "T99" "Typecheck cli — exit 0"
  else
    fail "T99" "Typecheck cli — ERRORS"
  fi
fi

# =============================================================================
# Phase 16: Rebrand Readiness
# =============================================================================
if run_phase 16; then
  header "Phase 16: Rebrand Readiness"

  # Check for "Savant" branding in CLI
  savant_count=$(rg_count "Savant|savant" "$REPO_ROOT/cli/src")
  if [ "$savant_count" -gt 50 ]; then
    pass "T101" "Savant branding in cli/src — $savant_count matches"
  else
    fail "T101" "Savant branding in cli/src — only $savant_count matches (expected 50+)"
  fi

  # Check CHANGELOG uses "Savant"
  if grep_q "Savant" "$REPO_ROOT/CHANGELOG.md" 2>/dev/null; then
    pass "T104" "CHANGELOG.md uses Savant branding"
  else
    fail "T104" "CHANGELOG.md does not use Savant branding"
  fi

  # code-reviewer-kimi fully retired
  kimi_agents=$(rg_count "code-reviewer-kimi" "$REPO_ROOT/agents")
  kimi_cli=$(rg_count "code-reviewer-kimi" "$REPO_ROOT/cli/src")
  kimi_ar=$(rg_count "code-reviewer-kimi" "$REPO_ROOT/packages/agent-runtime/src")
  kimi_total=$((kimi_agents + kimi_cli + kimi_ar))
  if [ "$kimi_total" -le 5 ]; then
    pass "T105" "code-reviewer-kimi — $kimi_total references (blacklists/comments only)"
  else
    fail "T105" "code-reviewer-kimi — $kimi_total references (expected ≤5)"
  fi
fi

# =============================================================================
# Phase 17: Verifier Spawn Frequency
# =============================================================================
if run_phase 17; then
  header "Phase 17: Verifier Spawn Frequency"

  if rg_check "verifier" "$REPO_ROOT/agents/savant/savant.ts" 2>/dev/null; then
    pass "T106" "verifier referenced in savant.ts"
  else
    fail "T106" "verifier NOT in savant.ts"
  fi
fi

# =============================================================================
# Phase 18: Provider Integration
# =============================================================================
if run_phase 18; then
  header "Phase 18: Provider Integration"

  if rg_check "fetchGatewayModels|subscribeGatewayCatalog|useGatewayCatalogStore" "$REPO_ROOT/cli/src" 2>/dev/null; then
    pass "T109" "Gateway catalog hooks wired in cli/src"
  else
    fail "T109" "Gateway catalog hooks NOT in cli/src"
  fi
fi

# =============================================================================
# Phase 19: Hybrid Mode
# =============================================================================
if run_phase 19; then
  header "Phase 19: Hybrid Mode"

  if rg_check "primary coder|write.*directly" "$REPO_ROOT/agents/savant/savant.ts" 2>/dev/null; then
    pass "T113" "Hybrid Mode — 'primary coder' in savant.ts"
  else
    fail "T113" "Hybrid Mode — 'primary coder' NOT in savant.ts"
  fi

  if rg_check "Spawn Forge only|> 3 files" "$REPO_ROOT/agents/savant/savant.ts" 2>/dev/null; then
    pass "T115" "Forge spawn threshold documented"
  else
    fail "T115" "Forge spawn threshold NOT documented"
  fi
fi

# =============================================================================
# Phase 20: Verifier Trigger Criteria
# =============================================================================
if run_phase 20; then
  header "Phase 20: Verifier Trigger Criteria"

  if rg_check "Verifier trigger|objective criteria|Skip Verifier" "$REPO_ROOT/agents/savant/savant.ts" 2>/dev/null; then
    pass "T117" "Verifier trigger criteria in savant.ts"
  else
    fail "T117" "Verifier trigger criteria NOT in savant.ts"
  fi

  if rg_check "noReview" "$REPO_ROOT/agents/savant/savant.ts" 2>/dev/null; then
    pass "T119" "noReview flag gating in savant.ts"
  else
    fail "T119" "noReview flag NOT in savant.ts"
  fi
fi

# =============================================================================
# Phase 21: Audit Checklist in Verifier
# =============================================================================
if run_phase 21; then
  header "Phase 21: Audit Checklist in Verifier"

  if rg_check "ECHO Audit Checklist|Audit Checklist" "$REPO_ROOT/agents/verifier/verifier.ts" 2>/dev/null; then
    pass "T122" "ECHO Audit Checklist in verifier.ts"
  else
    fail "T122" "ECHO Audit Checklist NOT in verifier.ts"
  fi

  if rg_check "Law 14|Law 6|Law 5|No magic numbers" "$REPO_ROOT/agents/verifier/verifier.ts" 2>/dev/null; then
    pass "T122b" "Audit Checklist items (Law 14/6/5, no magic numbers)"
  else
    fail "T122b" "Audit Checklist items missing"
  fi
fi

# =============================================================================
# Phase 22: Batch Operations
# =============================================================================
if run_phase 22; then
  header "Phase 22: Batch Operations"

  if rg_check "Batch operations|write ALL files first|run typecheck.*ONCE" "$REPO_ROOT/agents/savant/savant.ts" 2>/dev/null; then
    pass "T124" "Batch operations instruction in savant.ts"
  else
    fail "T124" "Batch operations instruction NOT in savant.ts"
  fi
fi

# =============================================================================
# Phase 23: Smart Phase Transitions
# =============================================================================
if run_phase 23; then
  header "Phase 23: Smart Phase Transitions"

  if rg_check "Smart Phase Transitions|Skip When" "$REPO_ROOT/agents/savant/savant.ts" 2>/dev/null; then
    pass "T126" "Smart Phase Transitions section in savant.ts"
  else
    fail "T126" "Smart Phase Transitions NOT in savant.ts"
  fi

  if rg_check "Law 3 is NEVER skipped" "$REPO_ROOT/agents/savant/savant.ts" 2>/dev/null; then
    pass "T127" "Law 3 never skipped documented"
  else
    fail "T127" "Law 3 never skipped NOT documented"
  fi
fi

# =============================================================================
# Phase 24: Parallel Agent Batching
# =============================================================================
if run_phase 24; then
  header "Phase 24: Parallel Agent Batching"

  if rg_check "Parallel agent batching|Promise.allSettled" "$REPO_ROOT/agents/savant/savant.ts" 2>/dev/null; then
    pass "T131" "Parallel agent batching instruction in savant.ts"
  else
    fail "T131" "Parallel agent batching NOT in savant.ts"
  fi
fi

# =============================================================================
# Phase 25: Double Audit Enforcement
# =============================================================================
if run_phase 25; then
  header "Phase 25: Double Audit Enforcement"

  if rg_check "Double Audit" "$REPO_ROOT/ECHO.md" 2>/dev/null; then
    pass "T134" "Double Audit documented in ECHO.md"
  else
    fail "T134" "Double Audit NOT in ECHO.md"
  fi

  if rg_check "Self-reporting is prohibited" "$REPO_ROOT/ECHO.md" 2>/dev/null; then
    pass "T135" "Self-reporting prohibition in ECHO.md"
  else
    fail "T135" "Self-reporting prohibition NOT in ECHO.md"
  fi
fi

# =============================================================================
# Phase 27: FID-066 Legacy Template Type Cleanup
# =============================================================================
if run_phase 27; then
  header "Phase 27: Legacy Template Type Cleanup (FID-066)"

  # T139: Dead template types removed from both files
  for typefile in "common/src/types/session-state.ts" "agents/types/secret-agent-definition.ts"; do
    full="$REPO_ROOT/$typefile"
    basename_f=$(basename "$typefile")
    dead_types=("base_free" "base_max" "base_lite" "base_experimental" "claude4_gemini_thinking" "superagent" "base_agent_builder" "file_picker" "reviewer" "example_programmatic")
    found_dead=0
    for dt in "${dead_types[@]}"; do
      if rg_check "$dt" "$full" 2>/dev/null; then
        found_dead=$((found_dead + 1))
      fi
    done
    if [ "$found_dead" -eq 0 ]; then
      pass "T139" "No dead template types in $basename_f"
    else
      fail "T139" "$found_dead dead template types still in $basename_f"
    fi
  done

  # T140: baseAgentSubagents updated
  if rg_check "scout|thinker|verifier" "$REPO_ROOT/packages/agent-runtime/src/templates/types.ts" 2>/dev/null; then
    if rg_not "file_picker|reviewer|researcher" "$REPO_ROOT/packages/agent-runtime/src/templates/types.ts" 2>/dev/null; then
      pass "T140" "baseAgentSubagents uses scout/thinker/verifier (no dead IDs)"
    else
      fail "T140" "baseAgentSubagents still references dead IDs"
    fi
  else
    fail "T140" "baseAgentSubagents missing expected agent IDs"
  fi

  # T141: ORCHESTRATOR_IDS replaces startsWith('base')
  if rg_check "ORCHESTRATOR_IDS" "$REPO_ROOT/cli/src/utils/local-agent-registry.ts" 2>/dev/null; then
    if rg_not "startsWith.*base" "$REPO_ROOT/cli/src/utils/local-agent-registry.ts" 2>/dev/null; then
      pass "T141" "ORCHESTRATOR_IDS replaces startsWith('base')"
    else
      fail "T141" "startsWith('base') still present alongside ORCHESTRATOR_IDS"
    fi
  else
    fail "T141" "ORCHESTRATOR_IDS NOT in local-agent-registry.ts"
  fi

  # T142: Dead personas removed
  if rg_not "'base'" "$REPO_ROOT/common/src/constants/agents.ts" 2>/dev/null; then
    if rg_not "agent-builder" "$REPO_ROOT/common/src/constants/agents.ts" 2>/dev/null; then
      pass "T142" "Dead personas (base, agent-builder) removed from AGENT_PERSONAS"
    else
      fail "T142" "agent-builder persona still in AGENT_PERSONAS"
    fi
  else
    fail "T142" "base persona still in AGENT_PERSONAS"
  fi
fi

# =============================================================================
# Phase 28: FID-067 Rename Legacy Aliases
# =============================================================================
if run_phase 28; then
  header "Phase 28: Rename Legacy Aliases (FID-067)"

  # T143: No file_picker in type definitions
  for typefile in "common/src/types/session-state.ts" "agents/types/secret-agent-definition.ts"; do
    full="$REPO_ROOT/$typefile"
    basename_f=$(basename "$typefile")
    if rg_not "file_picker|file-picker" "$full" 2>/dev/null; then
      pass "T143" "No file_picker in $basename_f"
    else
      fail "T143" "file_picker still in $basename_f"
    fi
  done

  # T144: No reviewer in type definitions
  for typefile in "common/src/types/session-state.ts" "agents/types/secret-agent-definition.ts"; do
    full="$REPO_ROOT/$typefile"
    basename_f=$(basename "$typefile")
    if rg_not "reviewer" "$full" 2>/dev/null; then
      pass "T144" "No reviewer in $basename_f"
    else
      fail "T144" "reviewer still in $basename_f"
    fi
  done

  # T145: free-agents.ts preserved correctly
  if rg_check "file-picker-max|file-lister" "$REPO_ROOT/common/src/constants/free-agents.ts" 2>/dev/null; then
    if rg_check "scout" "$REPO_ROOT/common/src/constants/free-agents.ts" 2>/dev/null; then
      pass "T145" "free-agents.ts: file-picker-max/file-lister preserved, scout present"
    else
      fail "T145" "free-agents.ts: scout NOT found"
    fi
  else
    fail "T145" "free-agents.ts: file-picker-max/file-lister NOT found"
  fi

  # T146: spawn-agents.ts description updated
  if rg_check "scout" "$REPO_ROOT/common/src/tools/params/tool/spawn-agents.ts" 2>/dev/null; then
    pass "T146" "spawn-agents.ts description references scout"
  else
    fail "T146" "spawn-agents.ts description does NOT reference scout"
  fi

  # T147: No stale file_picker in production code (test files excluded)
  stale_fp_ar=$(rg_count_prod "file_picker|file-picker" "$REPO_ROOT/packages/agent-runtime/src")
  stale_fp_cli=$(rg_count_prod "file_picker|file-picker" "$REPO_ROOT/cli/src")
  stale_fp=$((stale_fp_ar + stale_fp_cli))
  if [ "$stale_fp" -eq 0 ]; then
    pass "T147" "No stale file_picker in production code"
  else
    fail "T147" "$stale_fp stale file_picker references in production code"
  fi

  # T148: No stale reviewer in production code (test files excluded)
  stale_rev_ar=$(rg_count_prod "reviewer" "$REPO_ROOT/packages/agent-runtime/src")
  stale_rev_cli=$(rg_count_prod "reviewer" "$REPO_ROOT/cli/src")
  stale_rev=$((stale_rev_ar + stale_rev_cli))
  if [ "$stale_rev" -eq 0 ]; then
    pass "T148" "No stale reviewer in production code"
  else
    fail "T148" "$stale_rev stale reviewer references in production code"
  fi
fi

# =============================================================================
# Phase 29: ECHO Law 6 / 13 / 15 Compliance (v0.0.6)
# =============================================================================
if run_phase 29; then
  header "Phase 29: ECHO Compliance (FID-068/069/070/071)"

  # JSONValue domain type exists
  if [ -f "$REPO_ROOT/common/src/types/json.ts" ] && rg_check "export type JSONValue" "$REPO_ROOT/common/src/types/json.ts"; then
    pass "T149" "JSONValue type defined in common/src/types/json.ts"
  else
    fail "T149" "JSONValue type NOT defined in common/src/types/json.ts"
  fi

  # safeParseJSONObject helper exists
  if [ -f "$REPO_ROOT/common/src/util/type-narrowing.ts" ] && rg_check "safeParseJSONObject" "$REPO_ROOT/common/src/util/type-narrowing.ts"; then
    pass "T150" "safeParseJSONObject helper exists"
  else
    fail "T150" "safeParseJSONObject helper missing"
  fi

  # No Record<string, unknown> shortcuts in production source (test files excluded)
  cli_unknown=$(rg_count_prod "Record[[:space:]]*<[[:space:]]*string[[:space:]]*,[[:space:]]*unknown[[:space:]]*>" "$REPO_ROOT/cli/src" || echo "0")
  sdk_unknown=$(rg_count_prod "Record[[:space:]]*<[[:space:]]*string[[:space:]]*,[[:space:]]*unknown[[:space:]]*>" "$REPO_ROOT/sdk/src" || echo "0")
  ar_unknown=$(rg_count_prod "Record[[:space:]]*<[[:space:]]*string[[:space:]]*,[[:space:]]*unknown[[:space:]]*>" "$REPO_ROOT/packages/agent-runtime/src" || echo "0")
  common_unknown=$(rg_count_prod "Record[[:space:]]*<[[:space:]]*string[[:space:]]*,[[:space:]]*unknown[[:space:]]*>" "$REPO_ROOT/common/src" || echo "0")
  total_unknown=$((cli_unknown + sdk_unknown + ar_unknown + common_unknown))
  if [ "$total_unknown" -eq 0 ]; then
    pass "T151" "No Record<string, unknown> shortcuts in production source"
  else
    fail "T151" "$total_unknown Record<string, unknown> shortcuts remaining in production source"
  fi

  # Dead utility files removed
  if [ ! -f "$REPO_ROOT/common/src/util/agent-name-resolver.ts" ] && [ ! -f "$REPO_ROOT/cli/src/utils/agent-id-utils.ts" ] && [ ! -f "$REPO_ROOT/cli/src/utils/time-format.ts" ]; then
    pass "T152" "Dead utility files removed (agent-name-resolver, agent-id-utils, time-format)"
  else
    fail "T152" "One or more dead utility files still present"
  fi

  # Canonical utility exports preserved
  if rg_check "export function getSimpleAgentId" "$REPO_ROOT/common/src/util/agent-id-parsing.ts" 2>/dev/null; then
    pass "T153" "getSimpleAgentId in agent-id-parsing.ts"
  else
    fail "T153" "getSimpleAgentId missing from agent-id-parsing.ts"
  fi

  if rg_check "export (const|function) pluralize" "$REPO_ROOT/common/src/util/string.ts" 2>/dev/null; then
    pass "T154" "pluralize in string.ts"
  else
    fail "T154" "pluralize missing from string.ts"
  fi

  if rg_check "export (const|function) formatTimeUntil" "$REPO_ROOT/common/src/util/dates.ts" 2>/dev/null; then
    pass "T155" "formatTimeUntil in dates.ts"
  else
    fail "T155" "formatTimeUntil missing from dates.ts"
  fi

  # ESLint zero warnings across four core workspaces
  echo -ne "  Running ESLint --max-warnings 0 on four workspaces... "
  if (cd "$REPO_ROOT" && bun x eslint common/src cli/src sdk/src packages/agent-runtime/src --max-warnings 0 2>&1) >/dev/null 2>&1; then
    pass "T156" "ESLint --max-warnings 0 passes (common/cli/sdk/agent-runtime)"
  else
    fail "T156" "ESLint --max-warnings 0 FAILED"
  fi
fi

# =============================================================================
# Phase 30: Cloudflare Workers AI Provider (v0.0.6)
# =============================================================================
if run_phase 30; then
  header "Phase 30: Cloudflare Workers AI Provider (FID-072)"

  if rg_check "cloudflare" "$REPO_ROOT/common/src/constants/model-config.ts" 2>/dev/null; then
    pass "T171" "cloudflare references in model-config.ts"
  else
    fail "T171" "cloudflare NOT in model-config.ts"
  fi

  if rg_check "isCloudflareModel|createCloudflareModel" "$REPO_ROOT/sdk/src/impl/model-provider.ts" 2>/dev/null; then
    pass "T172" "Cloudflare model functions in sdk/src/impl/model-provider.ts"
  else
    fail "T172" "Cloudflare model functions missing"
  fi

  if rg_check "getCloudflareApiTokenFromEnv|getCloudflareAccountIdFromEnv" "$REPO_ROOT/sdk/src/env.ts" 2>/dev/null; then
    pass "T173" "Cloudflare env getters in sdk/src/env.ts"
  else
    fail "T173" "Cloudflare env getters missing"
  fi

  if rg_check "isCloudflareModel" "$REPO_ROOT/sdk/src/index.ts" 2>/dev/null; then
    pass "T174" "isCloudflareModel re-exported from sdk/src/index.ts"
  else
    fail "T174" "isCloudflareModel NOT re-exported"
  fi

  # T175/T176: CLI wiring is intentionally deferred; FID-072 only added SDK/common support.
  skip "T175" "cloudflare in cli/src/utils/openrouter-models.ts" "deferred: no CLI wiring in FID-072"
  skip "T176" "cloudflare in cli/src/components/model-picker.tsx" "deferred: no CLI wiring in FID-072"
fi

# =============================================================================
# Phase 31: Release metadata (v0.0.6)
# =============================================================================
if run_phase 31; then
  header "Phase 31: Release metadata"

  version_from_file=$(cat "$REPO_ROOT/VERSION" 2>/dev/null | tr -d '[:space:]')
  version_from_root=$(grep -m1 '"version"' "$REPO_ROOT/package.json" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
  version_from_cli=$(grep -m1 '"version"' "$REPO_ROOT/cli/package.json" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')

  if [ "$version_from_file" = "0.0.6" ]; then
    pass "T179" "VERSION file is 0.0.6"
  else
    fail "T179" "VERSION file is '$version_from_file' (expected 0.0.6)"
  fi

  if [ "$version_from_root" = "0.0.6" ]; then
    pass "T180" "Root package.json is 0.0.6"
  else
    fail "T180" "Root package.json is '$version_from_root' (expected 0.0.6)"
  fi

  if [ "$version_from_cli" = "0.0.6" ]; then
    pass "T181" "cli/package.json is 0.0.6"
  else
    fail "T181" "cli/package.json is '$version_from_cli' (expected 0.0.6)"
  fi
fi

# =============================================================================
# Summary
# =============================================================================
header "Summary"

echo ""
echo -e "  Total:  ${BOLD}$TOTAL_COUNT${RESET}"
echo -e "  Pass:   ${GREEN}$PASS_COUNT${RESET}"
echo -e "  Fail:   ${RED}$FAIL_COUNT${RESET}"
echo -e "  Skip:   ${YELLOW}$SKIP_COUNT${RESET}"
echo ""

# Build JSON results
JSON_RESULTS="["
for i in "${!RESULTS[@]}"; do
  if [ "$i" -gt 0 ]; then
    JSON_RESULTS+=","
  fi
  JSON_RESULTS+="${RESULTS[$i]}"
done
JSON_RESULTS+="]"

# Write JSON
cat > "$RESULTS_JSON" << ENDJSON
{
  "version": "v11",
  "date": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "platform": "$(uname -s)",
  "summary": {
    "total": $TOTAL_COUNT,
    "pass": $PASS_COUNT,
    "fail": $FAIL_COUNT,
    "skip": $SKIP_COUNT
  },
  "tests": $JSON_RESULTS
}
ENDJSON

# Write Markdown
cat > "$RESULTS_MD" << ENDMD
# Savant-Code — Automated A-Z Test Results v11

**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Platform:** $(uname -s)

## Summary

| Metric | Count |
|--------|-------|
| **Total** | $TOTAL_COUNT |
| **PASS** | $PASS_COUNT |
| **FAIL** | $FAIL_COUNT |
| **SKIP** | $SKIP_COUNT |

## Test Results

| ID | Status | Description |
|----|--------|-------------|
ENDMD

for r in "${RESULTS[@]}"; do
  id=$(echo "$r" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  status=$(echo "$r" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  desc=$(echo "$r" | grep -o '"description":"[^"]*"' | cut -d'"' -f4)
  case "$status" in
    PASS) emoji="✅" ;;
    FAIL) emoji="❌" ;;
    SKIP) emoji="⏭️" ;;
    *) emoji="❓" ;;
  esac
  echo "| $id | $emoji $status | $desc |" >> "$RESULTS_MD"
done

echo "" >> "$RESULTS_MD"
echo "---" >> "$RESULTS_MD"
echo "" >> "$RESULTS_MD"
echo "Results saved to: $RESULTS_JSON" >> "$RESULTS_MD"

echo -e "Results saved to:"
echo -e "  JSON: $RESULTS_JSON"
echo -e "  MD:   $RESULTS_MD"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "${RED}${BOLD}⚠️  $FAIL_COUNT test(s) FAILED. Review results above.${RESET}"
  exit 1
else
  echo -e "${GREEN}${BOLD}✅ All automatable tests passed.${RESET}"
  if [ "$SKIP_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}   $SKIP_COUNT test(s) skipped (interactive-only). Run those manually in the CLI.${RESET}"
  fi
  exit 0
fi
