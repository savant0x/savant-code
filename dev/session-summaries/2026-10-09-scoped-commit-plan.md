# Scoped local commit plan — 2026-10-09

Implementation is complete and verified. Operator authorization 2026-10-09:
"you can commmit it after you properly archive it and update the changelog".
Both records and changelog are finalized before these local commits.
Each group includes only its listed feature paths.
Closure documents are a separate final commit after actual hashes are known.

Executed implementation commits: sidebar `2b6075e7`, telemetry `512659cc`.

## 1. Sidebar

Message: `feat(cli): polish sidebar command console (FID-2026-1008-006)`

- `cli/src/chat/build-chat-layout-props.ts`
- `cli/src/chat/sidebar.tsx`
- `cli/src/chat/types.ts`
- `cli/src/components/right-sidebar-focus.ts`
- `cli/src/components/right-sidebar-header.tsx`
- `cli/src/components/right-sidebar-sections.tsx`
- `cli/src/components/right-sidebar.tsx`
- `cli/src/components/savant-ui/data-display/timeline.tsx`
- `cli/src/components/savant-ui/echo/__tests__/sidebar-collapse.test.tsx`
- `cli/src/components/savant-ui/echo/agent-stack.tsx`
- `cli/src/components/savant-ui/echo/agent-status.tsx`
- `cli/src/components/savant-ui/echo/drive-status-panel.tsx`
- `cli/src/components/savant-ui/echo/fid-card.tsx`
- `cli/src/components/savant-ui/echo/fid-list.tsx`
- `cli/src/components/savant-ui/echo/loop-status-panel.tsx`
- `cli/src/components/savant-ui/echo/perfection-loop.tsx`
- `cli/src/components/savant-ui/echo/token-meter.tsx`
- `cli/src/components/savant-ui/echo/trust-matrix.tsx`
- `cli/src/components/savant-ui/feedback/progress-bar.tsx`
- `cli/src/components/savant-ui/primitives/key-value-row.tsx`
- `cli/src/components/savant-ui/primitives/sidebar-section.tsx`
- `cli/src/components/savant-ui/teacher/learn-overlay.tsx`
- `cli/src/components/sidebar-rail.tsx`
- `cli/src/hooks/use-fold-collapse.ts`
- `cli/src/utils/__tests__/fid-loader.test.ts`
- `cli/src/utils/fid-loader.ts`
- `cli/src/utils/glyphs.ts`
- `cli/src/components/__tests__/right-sidebar-design.test.tsx`
- `cli/src/components/__tests__/right-sidebar-responsive.test.tsx`
- `cli/src/components/__tests__/sidebar-rail-navigation.test.tsx`
- `cli/src/components/right-sidebar-control.tsx`
- `cli/src/components/right-sidebar-display.ts`
- `cli/src/components/right-sidebar-motion.tsx`
- `cli/src/components/right-sidebar-rail-control.tsx`
- `cli/src/components/right-sidebar-summary.tsx`
- `cli/src/components/right-sidebar-supporting.tsx`
- `cli/src/components/right-sidebar-theme.ts`
- `cli/src/hooks/__tests__/sidebar-motion.test.ts`
- `cli/src/utils/__tests__/glyphs.test.ts`
- `dev/fids/archive/FID-2026-1008-006-sidebar-command-console-visual-redesign.md`
- `dev/session-summaries/2026-10-08-sidebar-command-console-design.md`
- `docs/design/sidebar-command-console.md`

## 2. Compliance telemetry

Message: `feat(telemetry): complete local compliance pipeline (FID-2026-1007-012)`

- `.gitignore`
- `cli/src/commands/telemetry.ts`
- `cli/src/data/slash-command-core.ts`
- `cli/src/server/gateway.ts`
- `cli/src/server/gateway/handshake-rpc.ts`
- `cli/src/server/gateway/state.ts`
- `cli/src/server/gateway/types.ts`
- `cli/src/utils/__tests__/custom-catalog.test.ts`
- `common/src/types/session-state-agent-state.ts`
- `common/src/util/__tests__/protocol-config.test.ts`
- `common/src/util/protocol-config-sections.ts`
- `common/src/util/protocol-config-types.ts`
- `common/src/util/protocol-config.ts`
- `desktop/src/App.tsx`
- `desktop/src/lib/gateway-client-requests.ts`
- `desktop/src/lib/gateway-client.ts`
- `desktop/src/lib/gateway-protocol.ts`
- `dev/fids/FID-2026-1007-012-model-compliance-telemetry.md` (archive source deletion)
- `dev/fids/archive/FID-2026-1007-012-model-compliance-telemetry.md`
- `evals/v2/src/runners/savant.ts`
- `evals/v2/tests/eval-runner-model-usage.test.ts`
- `package.json`
- `packages/agent-runtime/src/echo/enforcement.ts`
- `packages/agent-runtime/src/echo/enforcement/escalation.ts`
- `packages/agent-runtime/src/echo/enforcement/turn-end.ts`
- `packages/agent-runtime/src/echo/enforcement/verification-credit.ts`
- `packages/agent-runtime/src/echo/pre-write-gates.ts`
- `packages/agent-runtime/src/echo/types.ts`
- `packages/agent-runtime/src/run-agent-step/loop-context.ts`
- `packages/agent-runtime/src/tools/handlers/tool/__tests__/transition-phase.test.ts`
- `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts`
- `packages/agent-runtime/src/tools/tool-executor/custom.ts`
- `packages/agent-runtime/src/tools/tool-executor/ehel-gate.ts`
- `protocol.config.yaml`
- `scripts/public-release/pre-audit-local.ts`
- `scripts/session-end-review.ts`
- `cli/src/commands/__tests__/telemetry-command.test.ts`
- `cli/src/commands/defs/telemetry.ts`
- `cli/src/server/__tests__/gateway-telemetry.test.ts`
- `cli/src/server/gateway/hello-rpc.ts`
- `cli/src/server/gateway/telemetry-rpc.ts`
- `common/src/types/__tests__/telemetry.test.ts`
- `common/src/types/telemetry.ts`
- `common/src/util/__tests__/telemetry-aggregate.test.ts`
- `common/src/util/telemetry-aggregate.ts`
- `desktop/src/components/chat/ComplianceCharts.tsx`
- `desktop/src/components/chat/CompliancePanel.tsx`
- `desktop/src/components/chat/__tests__/compliance-panel.test.ts`
- `desktop/src/components/chat/compliance-data.ts`
- `desktop/src/components/chat/compliance-panel.css`
- `desktop/src/hooks/use-compliance.ts`
- `desktop/src/lib/__tests__/fixtures/compliance-browser-smoke.mjs`
- `desktop/src/lib/__tests__/fixtures/compliance-browser.tsx`
- `packages/agent-runtime/src/echo/__tests__/compliance-emission.test.ts`
- `packages/agent-runtime/src/hooks/__tests__/compliance-capture.test.ts`
- `packages/agent-runtime/src/hooks/__tests__/compliance-context.test.ts`
- `packages/agent-runtime/src/hooks/compliance-capture.ts`
- `packages/agent-runtime/src/hooks/compliance-context.ts`
- `scripts/__tests__/session-end-telemetry.test.ts`
- `scripts/__tests__/telemetry-feedback.test.ts`
- `scripts/__tests__/telemetry-sentinel.test.ts`
- `scripts/session-end-notices.ts`
- `scripts/telemetry-aggregate.ts`
- `scripts/telemetry-feedback.ts`
- `scripts/telemetry-sentinel.ts`

The eval/transition-phase changes in this group are import/format corrections
required by the zero-warning gate. The provider-order pin follows the already
approved alphabetical behavior; no provider production change is included.

## 3. Closure documentation

Message: `docs(fids): archive verified sidebar and telemetry records`

- Two active FID deletions and their corresponding archive paths.
- Own closure entries in `CHANGELOG.md`, `SCOPE.md`, `dev/fids/README.md` and
  `dev/fids/archive/README.md`; preserve the pre-existing unrelated edits.
- `dev/build-orders/README.md`, telemetry build-order source deletion and
  `dev/build-orders/archive/BO-2026-08-24-model-compliance-telemetry.md`.
- This plan and `dev/session-summaries/2026-10-09-sidebar-and-compliance-completion.md`.
- Two evidence-backed entries in `dev/LEARNINGS.md` for command ownership and
  preserving operator controls during redesign.

Historical scratchpad transcript is preserved in the ignored scratchpad archive.
Approval covers the listed local implementation and closure commits. A subsequent
status/diff check must confirm no unrelated changes were staged. No push or release.
