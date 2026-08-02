import re

def replace_line(path, lineno, newtext):
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    idx = lineno - 1
    old = lines[idx]
    if not re.match(r"^```\s*$", old):
        print(f"SKIP {path}:{lineno}: not a bare fence: {old!r}")
        return
    lines[idx] = "```" + newtext + "\n"
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print(f"MD040 {path}:{lineno} -> ```{newtext}")

# MD040: (file, line, language) — all verified from content inspection
fences = [
    ("ARCHITECTURE.md", 40, "text"),
    ("ARCHITECTURE.md", 97, "text"),
    ("cli/src/__tests__/README.md", 211, "text"),
    ("cli/src/__tests__/README.md", 219, "text"),
    ("common/src/templates/initial-agents-dir/skills/README.md", 8, "text"),
    ("common/src/templates/initial-agents-dir/skills/README.md", 62, "typescript"),
    ("CONTRIBUTING.md", 13, "text"),
    ("dev/nova/specs/goal-loop-feature-spec.md", 16, "text"),
    ("dev/nova/specs/goal-loop-feature-spec.md", 26, "text"),
    ("dev/nova/specs/goal-loop-feature-spec.md", 98, "text"),
    ("dev/nova/specs/goal-loop-feature-spec.md", 158, "text"),
    ("dev/nova/specs/goal-loop-feature-spec.md", 172, "text"),
    ("dev/nova/specs/goal-loop-feature-spec.md", 185, "text"),
    ("dev/session-summaries/2026-07-25-1200-context-compaction.md", 100, "text"),
    ("dev/session-summaries/2026-07-28-history-capture-handoff.md", 13, "text"),
    ("dev/session-summaries/2026-07-28-history-capture-handoff.md", 156, "text"),
    ("docs/agents-and-tools.md", 37, "text"),
    ("docs/agents-and-tools.md", 176, "text"),
    ("docs/design/database-architecture.md", 26, "text"),
    ("docs/design/thinker-sequentialthinking-regression-diagnostic.md", 39, "text"),
    ("docs/design/thinker-sequentialthinking-regression-diagnostic.md", 48, "text"),
    ("docs/design/thinker-sequentialthinking-regression-diagnostic.md", 68, "text"),
    ("docs/design/thinker-sequentialthinking-regression-diagnostic.md", 87, "text"),
    ("docs/design/thinker-sequentialthinking-regression-diagnostic.md", 299, "text"),
    ("docs/gravity-integration-starter.md", 170, "text"),
    ("docs/savant-code-modes.md", 34, "text"),
    ("ECHO-freebuff.md", 7, "text"),
    ("ECHO.md", 185, "text"),
    ("evals/benchmark/README.md", 181, "text"),
    ("evals/benchmark/README.md", 377, "text"),
    ("evals/v2/README.md", 14, "text"),
    ("FREEREADME.md", 12, "text"),
    ("LEARNINGS.md", 54, "text"),
    ("LEARNINGS.md", 92, "text"),
    ("LEARNINGS.md", 144, "markdown"),
    ("LEARNINGS.md", 177, "markdown"),
    ("LEARNINGS.md", 191, "markdown"),
    ("README.zh-CN.md", 63, "text"),
    ("README.zh-CN.md", 68, "text"),
    ("savant-free/README.md", 37, "text"),
    ("savant-free/SPEC.md", 156, "text"),
    ("savant-free/SPEC.md", 200, "text"),
    ("scripts/tmux/README.md", 233, "text"),
    ("scripts/tmux/tmux-viewer/README.md", 43, "text"),
    ("sdk/e2e/README.md", 7, "text"),
    ("WINDOWS.md", 105, "text"),
    ("WINDOWS.md", 164, "text"),
]

for path, ln, lang in fences:
    replace_line(path, ln, lang)

# MD001: demote the out-of-sequence "#### **Works cited**" (h2 -> h4 jump) to h3
works_cited = [
    "docs/AI Coding Agents Market Research.md",
    "docs/CLI Agent Inference Backend Research.md",
    "docs/design/OpenTUI Terminal Visualization Guide.md",
    "docs/Launch Plan Review and Optimization.md",
    "docs/OpenTUI Sidebar Bug Fix.md",
    "docs/reports/Savant-Code Benchmark Specification.md",
    "docs/reports/Thinker Agent Architecture Research.md",
    "docs/Savant-Code Business And Backend Research.md",
]
for path in works_cited:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    new = content.replace("#### **Works cited**", "### **Works cited**")
    assert new != content, path
    with open(path, "w", encoding="utf-8") as f:
        f.write(new)
    print(f"MD001 demoted: {path}")

# MD033: wrap the <X> placeholder in backticks (code span, exempt from MD033)
path = "dev/session-summaries/2026-07-14-0230-repo-audit.md"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()
new = content.replace('"Buffy the <X> Orchestrator"', '"Buffy the `<X>` Orchestrator"')
assert new != content, "MD033 fix target not found"
with open(path, "w", encoding="utf-8") as f:
    f.write(new)
print("MD033 fixed: repo-audit")
