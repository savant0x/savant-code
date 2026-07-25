import { StrReplaceComponent } from './str-replace'
import { defineToolComponent } from './types'

import type { ToolBlockOf, ToolRenderConfig } from './types'

// Reuse the extraction and rendering logic from str-replace by delegating

export const WriteFileComponent = defineToolComponent({
  toolName: 'write_file',

  render(toolBlock, theme, options): ToolRenderConfig {
    // Call the str_replace renderer with the same block shape
    // since both tools share identical UI and output structure.
    const strReplaceBlock: ToolBlockOf<'str_replace'> = {
      ...toolBlock,
      toolName: 'str_replace',
    }
    return StrReplaceComponent.render(strReplaceBlock, theme, options)
  },
})
