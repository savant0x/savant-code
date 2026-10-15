// RenderUIComponent — edge cases: unsupported, missing, and malformed
// widget payloads.
// Sibling of the Loop 332 decomposition (shared harness in
// render-ui-test-harness).

import { describe, expect, test } from 'bun:test'

import { chatThemes } from '../../../utils/theme-system'
import { RenderUIComponent } from '../render-ui'
import { createToolBlock, renderOptions } from './render-ui-test-harness'

describe('RenderUIComponent - edge cases', () => {
  test('returns no content for unsupported widget types', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'slider',
          text: 'Volume',
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.content).toBeNull()
  })

  test('returns no content when widget is missing', () => {
    const result = RenderUIComponent.render(
      createToolBlock({}),
      chatThemes.light,
      renderOptions,
    )

    expect(result.content).toBeNull()
  })

  test('returns no content when widget is null', () => {
    const result = RenderUIComponent.render(
      createToolBlock({ widget: null }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.content).toBeNull()
  })

  test('returns no content when widget is not an object', () => {
    const result = RenderUIComponent.render(
      createToolBlock({ widget: 'string' }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.content).toBeNull()
  })

  test('returns no content when widget has no type field', () => {
    const result = RenderUIComponent.render(
      createToolBlock({ widget: { text: 'no type' } }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.content).toBeNull()
  })

  test('returns no content when input is undefined', () => {
    const result = RenderUIComponent.render(
      createToolBlock(undefined),
      chatThemes.light,
      renderOptions,
    )

    expect(result.content).toBeNull()
  })

  test('treats a malformed button (missing link) as unknown widget', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'button',
          text: 'No link',
          // link missing
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    // isRenderUIButtonWidget returns false (link required), and no other
    // widget matches type 'button', so we fall through to null.
    expect(result.content).toBeNull()
  })
})
