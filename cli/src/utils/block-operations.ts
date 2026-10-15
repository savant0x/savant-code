export {
  appendTextToAgentBlock,
  replaceTextInAgentBlock,
} from './block-operations/agent-updates'
export {
  appendToolToAgentBlock,
  closeNativeReasoningInAgent,
  markAgentComplete,
  markRunningAgentsAsCancelled,
} from './block-operations/agent-lifecycle'
export { isNativeReasoningBlock } from './block-operations/primitive-blocks'
export { appendTextToRootStream } from './block-operations/root-stream'
export { closeNativeReasoningBlock } from './block-operations/think-parsing'
