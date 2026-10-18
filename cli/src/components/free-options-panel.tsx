import { TextAttributes } from '@opentui/core'
import React, { useMemo } from 'react'

import { CopyableBlock } from './blocks/copyable-block'
import { Button } from './button'
import { CollapseButton } from './collapse-button'
import { TrafficLightPanel } from './traffic-light-panel'
import { useTheme } from '../hooks/use-theme'
import { bootFreshnessLabel } from '../utils/free-options-boot'
import { renderFreeOptionsCopy } from '../utils/free-options-render'
import {
  buildFreeOptionsView,
  freeOptionsPreviewLine,
  freeOptionsSelectionLine,
  previewFreeOptionsView,
} from '../utils/free-options-view'

import type { FreeOptionsContentBlock } from '../types/chat'
import type { ChatTheme } from '../types/theme-system'

/**
 * FID-2026-1017-005 — the boot free-options surface.
 *
 * Collapsed by default for the same reason as the compaction summary: boot
 * must not fill the window. The complete payload stays in the block; the
 * expanded panel and Copy share a bounded coding-focused preview. The broad
 * artifact preserves discovery evidence. The header carries freshness and the resolved
 * artifact path, so the file is reachable without a second command.
 */
export const FreeOptionsPanel = React.memo(function FreeOptionsPanel({
  block,
  onToggleCollapsed,
  nowMs = Date.now(),
}: {
  block: FreeOptionsContentBlock
  onToggleCollapsed?: (id: string) => void
  nowMs?: number
}) {
  const theme = useTheme()
  const view = useMemo(
    () =>
      previewFreeOptionsView(
        buildFreeOptionsView(block.snapshot.report, {
          markdownPath: block.markdownPath,
          generatedAt:
            block.snapshot.report.exportStatus?.generatedAt ??
            block.snapshot.artifact.generatedAt ??
            '',
          freshness: bootFreshnessLabel(block.snapshot),
          audience: 'coding',
          nowMs,
        }),
      ),
    [block.snapshot, block.markdownPath, nowMs],
  )
  const { counts } = view.header
  const isCollapsed = block.isCollapsed ?? true
  const foldLabel = isCollapsed ? ' ▾ expand' : ' ▴ collapse'
  const exported = block.snapshot.report.exportStatus
  const exportLine =
    exported && !exported.ok
      ? `export failed: ${exported.error ?? 'unknown error'} · ${block.markdownPath}`
      : block.snapshot.artifact.ok
        ? `export ok · ${block.markdownPath}`
        : `export ${block.snapshot.artifact.reason ?? 'unverified'} · ${block.markdownPath}`
  const discovery = block.discovery
  const discoveryLine =
    discovery && (discovery.newCount > 0 || discovery.changedCount > 0)
      ? `Discovery: ${discovery.newCount} new / ${discovery.changedCount} changed provider candidate(s)`
      : null

  return (
    <box selectable={false} style={{ width: '100%' }}>
      <TrafficLightPanel>
        {/* No bare string child: OpenTUI rejects text outside a <text> node
            ("Text must be created inside of a text node"). */}
        <CopyableBlock
          getCopyText={() =>
            renderFreeOptionsCopy(view, block.snapshot.refreshError)
          }
        >
          <box style={{ flexDirection: 'column' }}>
            <Button
              style={{ justifyContent: 'flex-start', width: '100%' }}
              onClick={() => onToggleCollapsed?.(block.id)}
            >
              <text attributes={TextAttributes.BOLD} fg={theme.primary}>
                {`Free options — ${view.header.freshness}${foldLabel}`}
              </text>
            </Button>
            <text fg={theme.muted}>
              {`${counts.wiredModels} text candidate(s) on ${counts.wiredProviders} wired · ${counts.notWiredProviders} tier(s) not wired · ${counts.local} local · ${counts.offers} relevant offer(s)${counts.offersEndingSoon > 0 ? ` (${counts.offersEndingSoon} end within 72h)` : ''}`}
            </text>
            <text fg={theme.muted}>{freeOptionsSelectionLine(view)}</text>
            <text fg={theme.muted}>{exportLine}</text>
            {discoveryLine ? (
              <text fg={theme.info}>{discoveryLine}</text>
            ) : null}
            {isCollapsed ? null : (
              <box style={{ flexDirection: 'column', marginTop: 1 }}>
                {block.snapshot.refreshError ? (
                  <text fg={theme.warning}>
                    {`Refresh note: ${block.snapshot.refreshError}`}
                  </text>
                ) : null}

                <SectionTitle
                  theme={theme}
                  label={`Advertised free text candidates — ${counts.wiredModels} on ${counts.wiredProviders} configured provider(s)`}
                />
                {view.wired.length === 0 ? (
                  <text fg={theme.muted}>
                    {
                      '_No configured provider has a model matching the coding selection._'
                    }
                  </text>
                ) : (
                  view.wired.map((lane) => (
                    <box
                      key={`wired-${lane.providerId}`}
                      style={{ flexDirection: 'column' }}
                    >
                      <text fg={theme.foreground}>
                        {`${lane.label} (${lane.providerId}) — ${lane.models.length} shown`}
                      </text>
                      {lane.models.map((model) => (
                        <text
                          key={`wired-${lane.providerId}-${model}`}
                          fg={theme.muted}
                        >
                          {`  • ${model}`}
                        </text>
                      ))}
                    </box>
                  ))
                )}

                <SectionTitle
                  theme={theme}
                  label={`Free tiers you have NOT wired — ${counts.notWiredProviders} provider(s), ${counts.notWiredModels} model(s)`}
                />
                {view.notWired.length === 0 ? (
                  <text fg={theme.muted}>
                    {
                      '_No unconfigured provider has a model matching the coding selection._'
                    }
                  </text>
                ) : (
                  view.notWired.map((lane) => (
                    <box
                      key={`not-wired-${lane.providerId}`}
                      style={{ flexDirection: 'column' }}
                    >
                      <text fg={theme.foreground}>
                        {`${lane.label} — run ${lane.setupCommand}`}
                      </text>
                      {lane.models.map((model) => (
                        <text
                          key={`not-wired-${lane.providerId}-${model}`}
                          fg={theme.muted}
                        >
                          {`  • ${model}`}
                        </text>
                      ))}
                    </box>
                  ))
                )}

                <SectionTitle
                  theme={theme}
                  label={`Local & free — ${counts.local} integration(s)`}
                />
                {view.local.length === 0 ? (
                  <text fg={theme.muted}>
                    {'_No local provider registered._'}
                  </text>
                ) : (
                  view.local.map((lane) => (
                    <text key={`local-${lane.id}`} fg={theme.foreground}>
                      {`${lane.label} (no key) → ${lane.setupCommand}`}
                    </text>
                  ))
                )}

                {view.discoveryOnly.length > 0 ? (
                  <>
                    <SectionTitle
                      theme={theme}
                      label={`Discovery only — ${counts.discoveryOnly} provider(s)`}
                    />
                    {view.discoveryOnly.map((lane) => (
                      <text
                        key={`discovery-${lane.providerId}`}
                        fg={theme.muted}
                      >
                        {`${lane.label}: ${lane.models.length} advertised free model(s)`}
                      </text>
                    ))}
                  </>
                ) : null}

                <SectionTitle
                  theme={theme}
                  label={`Relevant advertised offers — ${counts.offers}${counts.offersEndingSoon > 0 ? `, ${counts.offersEndingSoon} end within 72h` : ''}`}
                />
                {view.offers.length === 0 ? (
                  <text fg={theme.muted}>
                    {'_No advertised offer matches the coding selection._'}
                  </text>
                ) : (
                  view.offers.map((group) => (
                    <box
                      key={`offers-${group.category}`}
                      style={{ flexDirection: 'column', marginTop: 1 }}
                    >
                      <text fg={theme.info} attributes={TextAttributes.BOLD}>
                        {`${group.category} (${group.rows.length})`}
                      </text>
                      {group.rows.map((row) => (
                        <box
                          key={`offer-${row.title}-${row.url}`}
                          style={{ flexDirection: 'column' }}
                        >
                          <text fg={theme.foreground}>
                            {`  • ${row.title} — ${row.deadlineLabel}${
                              row.providerLabels.length > 0
                                ? ` · known: ${row.providerLabels.join(', ')}`
                                : ''
                            }`}
                          </text>
                          <text fg={theme.muted}>{`    ${row.url}`}</text>
                        </box>
                      ))}
                    </box>
                  ))
                )}

                <text fg={theme.muted}>{freeOptionsPreviewLine(view)}</text>
                <text fg={theme.muted}>{view.quotaFootnote}</text>
                <text fg={theme.muted}>
                  {`generatedAt ${view.header.generatedAt || 'not exported'}${view.header.fetchedAt ? ` · fetchedAt ${view.header.fetchedAt}` : ''}`}
                </text>
                {block.snapshot.artifact.generationId ? (
                  <text fg={theme.muted}>
                    {`artifact ${block.snapshot.artifact.generationId}`}
                  </text>
                ) : null}
                <CollapseButton onClick={() => onToggleCollapsed?.(block.id)} />
              </box>
            )}
          </box>
        </CopyableBlock>
      </TrafficLightPanel>
    </box>
  )
})

function SectionTitle({ theme, label }: { theme: ChatTheme; label: string }) {
  return (
    <text
      fg={theme.secondary}
      attributes={TextAttributes.BOLD}
      style={{ marginTop: 1 }}
    >
      {label}
    </text>
  )
}
