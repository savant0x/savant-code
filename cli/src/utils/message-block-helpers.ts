/**
 * Message-block helpers — pure functions over the ContentBlock tree, split
 * into sibling modules for the 400-line bar:
 *   message-block-helpers/plan.ts         — agent-name + PLAN-tag helpers
 *   message-block-helpers/collapse.ts     — autoCollapseBlocks
 *   message-block-helpers/spawn-result.ts — spawn_agents result extraction
 *   message-block-helpers/agent-blocks.ts — agent block tree create/nest/move
 *   message-block-helpers/ask-user.ts     — transformAskUserBlocks
 *   message-block-helpers/tool-output.ts  — updateToolBlockWithOutput
 */

export {
  getAgentBaseName,
  insertPlanBlock,
  extractPlanFromBuffer,
  scrubPlanTags,
  scrubPlanTagsInBlocks,
} from './message-block-helpers/plan'
export { autoCollapseBlocks } from './message-block-helpers/collapse'
export { extractSpawnAgentResultContent } from './message-block-helpers/spawn-result'
export type { SpawnAgentResultContent } from './message-block-helpers/spawn-result'
export {
  appendInterruptionNotice,
  createAgentBlock,
  extractBlockById,
  findAgentTypeById,
  moveSpawnAgentBlock,
  nestBlockUnderParent,
  updateBlocksRecursively,
} from './message-block-helpers/agent-blocks'
export type {
  CreateAgentBlockOptions,
  NestBlockResult,
} from './message-block-helpers/agent-blocks'
export { transformAskUserBlocks } from './message-block-helpers/ask-user'
export type { TransformAskUserOptions } from './message-block-helpers/ask-user'
export { updateToolBlockWithOutput } from './message-block-helpers/tool-output'
export type { UpdateToolBlockOptions } from './message-block-helpers/tool-output'
