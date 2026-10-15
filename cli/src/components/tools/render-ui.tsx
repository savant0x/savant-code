import { RenderUIButton } from './render-ui-button'
import {
  BadgeWidget,
  CardWidget,
  PerfectionLoopWidget,
  StepperWidget,
  TableWidget,
} from './render-ui-display-widgets'
import {
  isBadgeWidget,
  isCardWidget,
  isPerfectionLoopWidget,
  isRenderUIButtonWidget,
  isStepperWidget,
  isTableWidget,
} from './render-ui-widget-types'
import { defineToolComponent } from './types'

import type { ToolBlock, ToolRenderConfig, ToolRenderOptions } from './types'
import type { ChatTheme } from '../../types/theme-system'

// ---- Tool component factory -----------------------------------------------

type RenderUIToolBlock = ToolBlock & { toolName: 'render_ui' }

export const RenderUIComponent = defineToolComponent<'render_ui'>({
  toolName: 'render_ui',

  render(
    toolBlock: RenderUIToolBlock,
    _theme: ChatTheme,
    _options: ToolRenderOptions,
  ): ToolRenderConfig {
    const widget = toolBlock.input?.widget

    if (!widget || typeof widget !== 'object' || !('type' in widget)) {
      return { content: null }
    }

    if (isRenderUIButtonWidget(widget)) {
      return {
        content: <RenderUIButton widget={widget} />,
        collapsedPreview: `${widget.text} -> ${widget.link}`,
      }
    }

    if (isTableWidget(widget)) {
      return {
        content: <TableWidget widget={widget} />,
        collapsedPreview: `table: ${widget.columns.length} cols, ${widget.rows.length} rows`,
      }
    }

    if (isCardWidget(widget)) {
      return {
        content: <CardWidget widget={widget} />,
        collapsedPreview: `${widget.title}: ${widget.summary.slice(0, 40)}`,
      }
    }

    if (isStepperWidget(widget)) {
      return {
        content: <StepperWidget widget={widget} />,
        collapsedPreview: `stepper: ${widget.steps.length} steps`,
      }
    }

    if (isBadgeWidget(widget)) {
      return {
        content: <BadgeWidget widget={widget} />,
        collapsedPreview: `[${widget.text}]`,
      }
    }

    if (isPerfectionLoopWidget(widget)) {
      return {
        content: <PerfectionLoopWidget widget={widget} />,
        collapsedPreview: `Perfection Loop: ${widget.phase}`,
      }
    }

    return { content: null }
  },
})
