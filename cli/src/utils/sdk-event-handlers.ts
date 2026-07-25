import { match } from 'ts-pattern';

import { appendTextToRootStream, appendToolToAgentBlock, closeNativeReasoningBlock, closeNativeReasoningInAgent, markAgentComplete, } from './block-operations';
import { shouldHideAgent } from './constants';
import { resetUiToIdle } from './finish-logic';
import { createAgentBlock, extractPlanFromBuffer as _extractPlanFromBuffer, extractSpawnAgentResultContent, findAgentTypeById, insertPlanBlock as _insertPlanBlock, nestBlockUnderParent, transformAskUserBlocks, updateToolBlockWithOutput, } from './message-block-helpers';
import { findMatchingSpawnAgent, resolveSpawnAgentToReal, } from './spawn-agent-matcher';
import { destinationFromChunkEvent, processTextChunk, } from './stream-chunk-processor';
import { useChatStore } from '../state/chat-store';

import type { AgentMode } from './constants';
import type { MessageUpdater } from './message-updater';
import type { StreamController } from '../hooks/stream-state';
import type { StreamStatus } from '../hooks/use-message-queue';
import type { ContentBlock, ToolContentBlock } from '../types/chat';
import type { Logger } from '@savant-code/common/types/contracts/logger';
import type { JSONValue } from '@savant-code/common/types/json';
import type { PrintModeEvent as SDKEvent, PrintModeFinish, PrintModeSubagentFinish, PrintModeSubagentStart, PrintModeToolCall, PrintModeToolResult, } from '@savant-code/common/types/print-mode';
import type { AgentActivity } from '@savant-code/common/types/session-state';
import type { ToolName } from '@savant-code/sdk';
import type { MutableRefObject } from 'react';
export type SetStreamingAgentsFn = (updater: (prev: Set<string>) => Set<string>) => void;
export type SetStreamStatusFn = (status: StreamStatus) => void;
export type StreamChunkEvent = string | {
    type: 'subagent_chunk';
    agentId: string;
    agentType: string;
    chunk: string;
} | {
    type: 'reasoning_chunk';
    agentId: string;
    ancestorRunIds: string[];
    chunk: string;
};
export type StreamingState = {
    streamRefs: StreamController;
    setStreamingAgents: SetStreamingAgentsFn;
    setStreamStatus: SetStreamStatusFn;
};
export type MessageState = {
    aiMessageId: string;
    updater: MessageUpdater;
    hasReceivedContentRef: MutableRefObject<boolean>;
};
export type SubagentState = {
    addActiveSubagent: (id: string) => void;
    removeActiveSubagent: (id: string) => void;
};
export type ModeState = {
    agentMode: AgentMode;
    setHasReceivedPlanResponse: (value: boolean) => void;
};
export type EventHandlerState = {
    streaming: StreamingState;
    message: MessageState;
    subagents: SubagentState;
    mode: ModeState;
    logger: Logger;
    setIsRetrying: (retrying: boolean) => void;
    onTotalCost?: (cost: number) => void;
    onToolCall?: (toolName: string) => void;
    onSubagentStart?: (agentId: string, displayName: string) => void;
    onSubagentFinish?: (agentId: string) => void;
};
type TextDelta = {
    type: 'text' | 'reasoning';
    text: string;
};
function isJSONValueRecord(value: JSONValue): value is Record<string, JSONValue> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const hiddenToolNames = new Set<ToolName | 'spawn_agent_inline'>([
    // spawn_agent_inline nests under the parent agent's branch.
    'spawn_agent_inline',
    // end_turn is a no-op tool that closes the agent's step; its box is noise.
    'end_turn',
    // spawn_agents (multi-agent) is collapsed into parent agent branch.
    'spawn_agents',
    // render_ui widgets render inline as content; the bordered tool-call box
    // adds nothing the widget itself doesn't already convey.
    'render_ui',
]);
const isHiddenToolName = (toolName: string): toolName is ToolName | 'spawn_agent_inline' => hiddenToolNames.has(toolName as ToolName | 'spawn_agent_inline');
const ensureStreaming = (state: EventHandlerState) => {
    if (!state.message.hasReceivedContentRef.current) {
        state.message.hasReceivedContentRef.current = true;
        state.streaming.setStreamStatus('streaming');
        state.setIsRetrying(false);
    }
};
const appendRootChunk = (state: EventHandlerState, delta: TextDelta) => {
    if (!delta.text) {
        return;
    }
    state.message.updater.updateAiMessageBlocks((blocks) => appendTextToRootStream(blocks, delta));
};
// FID-2026-0718-010 (Q13): updateStreamingAgents now respects runCompleted.
// Same logic as before, but checks the run-end flag first.
const updateStreamingAgents = (state: EventHandlerState, op: {
    add?: string;
    remove?: string;
}) => {
    guardedSetStreamingAgents(state, op);
};
const handleSubagentStart = (state: EventHandlerState, event: PrintModeSubagentStart) => {
    if (shouldHideAgent(event.agentType)) {
        return;
    }
    state.subagents.addActiveSubagent(event.agentId);
    // Wire sidebar data: track agent start
    if (state.onSubagentStart) {
        state.onSubagentStart(event.agentId, event.displayName || event.agentType);
    }
    const spawnAgentMatch = findMatchingSpawnAgent(state.streaming.streamRefs.state.spawnAgentsMap, event.agentType || '');
    if (spawnAgentMatch) {
        state.message.updater.updateAiMessageBlocks((blocks) => resolveSpawnAgentToReal({
            blocks,
            match: spawnAgentMatch,
            realAgentId: event.agentId,
            realAgentType: event.agentType,
            parentAgentId: event.parentAgentId,
            params: event.params,
            prompt: event.prompt,
        }));
        updateStreamingAgents(state, {
            remove: spawnAgentMatch.tempId,
            add: event.agentId,
        });
        state.streaming.streamRefs.setters.removeSpawnAgentInfo(spawnAgentMatch.tempId);
        return;
    }
    state.logger.info({
        agentId: event.agentId,
        agentType: event.agentType,
        parentAgentId: event.parentAgentId || 'ROOT',
    }, 'Creating new agent block (no spawn_agents match)');
    state.message.updater.updateAiMessageBlocks((blocks) => {
        // Look up the parent agent's type if there's a parent agent ID
        const parentAgentType = event.parentAgentId
            ? findAgentTypeById(blocks, event.parentAgentId)
            : undefined;
        const newAgentBlock = createAgentBlock({
            agentId: event.agentId,
            agentType: event.agentType || '',
            prompt: event.prompt,
            params: event.params,
            parentAgentType,
        });
        if (event.parentAgentId) {
            const { blocks: nestedBlocks, parentFound } = nestBlockUnderParent(blocks, event.parentAgentId, newAgentBlock);
            if (parentFound) {
                return nestedBlocks;
            }
        }
        return [...blocks, newAgentBlock];
    });
    updateStreamingAgents(state, { add: event.agentId });
};
const handleSubagentFinish = (state: EventHandlerState, event: PrintModeSubagentFinish) => {
    if (shouldHideAgent(event.agentType)) {
        return;
    }
    state.streaming.streamRefs.setters.removeAgentAccumulator(event.agentId);
    state.subagents.removeActiveSubagent(event.agentId);
    // Wire sidebar data: track agent finish
    if (state.onSubagentFinish) {
        state.onSubagentFinish(event.agentId);
    }
    state.message.updater.updateAiMessageBlocks((blocks) => markAgentComplete(blocks, event.agentId));
    updateStreamingAgents(state, { remove: event.agentId });
};
const handleSpawnAgentsToolCall = (state: EventHandlerState, event: PrintModeToolCall) => {
    const rawAgents = event.input?.agents;
    const agents: Record<string, JSONValue>[] = Array.isArray(rawAgents)
        ? rawAgents.filter(isJSONValueRecord)
        : [];
    agents.forEach((agent, index) => {
        const tempAgentId = `${event.toolCallId}-${index}`;
        const agentType = typeof agent.agent_type === 'string' ? agent.agent_type : 'unknown';
        state.streaming.streamRefs.setters.setSpawnAgentInfo(tempAgentId, {
            index,
            agentType,
        });
    });
    state.message.updater.updateAiMessageBlocks((blocks) => {
        // Look up the parent agent's type if there's a parent agent ID
        const parentAgentType = event.agentId
            ? findAgentTypeById(blocks, event.agentId)
            : undefined;
        const newAgentBlocks: ContentBlock[] = agents
            .map((agent, originalIndex) => ({ agent, originalIndex }))
            .filter(({ agent }) => !shouldHideAgent(String(agent.agent_type || '')))
            .map(({ agent, originalIndex }) => createAgentBlock({
            agentId: `${event.toolCallId}-${originalIndex}`,
            agentType: String(agent.agent_type || ''),
            prompt: typeof agent.prompt === 'string' ? agent.prompt : undefined,
            params: isJSONValueRecord(agent.params)
                ? agent.params
                : undefined,
            spawnToolCallId: event.toolCallId,
            spawnIndex: originalIndex,
            parentAgentType,
        }));
        return [...blocks, ...newAgentBlocks];
    });
    agents.forEach((_, index) => {
        updateStreamingAgents(state, { add: `${event.toolCallId}-${index}` });
    });
};
const handleRegularToolCall = (state: EventHandlerState, event: PrintModeToolCall) => {
    const newToolBlock: ToolContentBlock = {
        type: 'tool',
        toolCallId: event.toolCallId,
        toolName: event.toolName as ToolName,
        input: event.input,
        agentId: event.agentId,
        ...(event.includeToolCall !== undefined && {
            includeToolCall: event.includeToolCall,
        }),
    };
    if (event.parentAgentId && event.agentId) {
        state.message.updater.updateAiMessageBlocks((blocks) => appendToolToAgentBlock(blocks, event.agentId as string, newToolBlock));
        return;
    }
    state.message.updater.updateAiMessageBlocks((blocks) => [
        ...blocks,
        newToolBlock,
    ]);
};
const handleToolCall = (state: EventHandlerState, event: PrintModeToolCall) => {
    // Close any open native reasoning blocks when a tool call happens
    // (agent may go directly from thinking to tool calls without emitting text)
    // This must happen BEFORE any early returns (spawn_agents, hidden tools)
    if (event.parentAgentId && event.agentId) {
        // For agent tool calls, close reasoning in that specific agent
        state.message.updater.updateAiMessageBlocks((blocks) => closeNativeReasoningInAgent(blocks, event.agentId as string));
    }
    else if (!event.parentAgentId) {
        // For root tool calls, close reasoning at root level
        state.message.updater.updateAiMessageBlocks(closeNativeReasoningBlock);
    }
    // Wire sidebar data: track tool call
    if (state.onToolCall && !isHiddenToolName(event.toolName)) {
        state.onToolCall(event.toolName);
    }
    if (event.toolName === 'spawn_agents' && event.input?.agents) {
        handleSpawnAgentsToolCall(state, event);
        return;
    }
    if (isHiddenToolName(event.toolName)) {
        return;
    }
    handleRegularToolCall(state, event);
    updateStreamingAgents(state, { add: event.toolCallId });
};
/**
 * Recursively finds and updates agent blocks that match a spawn_agents tool call.
 */
const updateSpawnAgentBlock = (block: ContentBlock, toolCallId: string, results: JSONValue[]): ContentBlock | null => {
    if (block.type !== 'agent') {
        return block;
    }
    const spawnIndex = block.spawnIndex;
    const childBlocks = block.blocks;
    const isSpawnResultTarget = block.spawnToolCallId === toolCallId &&
        spawnIndex !== undefined &&
        childBlocks;
    if (isSpawnResultTarget) {
        const result = results[spawnIndex];
        const resultRecord = isJSONValueRecord(result) ? result : null;
        const resultValue = resultRecord?.value;
        if (resultValue !== undefined) {
            const { content, hasError } = extractSpawnAgentResultContent(resultValue);
            if (hasError) {
                if (childBlocks.length === 0) {
                    return null;
                }
                return {
                    ...block,
                    blocks: content
                        ? [...childBlocks, { type: 'text', content } as ContentBlock]
                        : childBlocks,
                    status: 'complete' as const,
                };
            }
            // Agents like thinker return all output at the end via lastMessage,
            // while agents like basher may have already streamed their text.
            const hasStreamedTextContent = childBlocks.some((b) => b.type === 'text' && b.textType === 'text');
            const finalBlocks = content && !hasStreamedTextContent
                ? [...childBlocks, { type: 'text', content } as ContentBlock]
                : childBlocks;
            if (finalBlocks.length > 0) {
                return {
                    ...block,
                    blocks: finalBlocks,
                    status: 'complete' as const,
                };
            }
        }
    }
    if (!childBlocks?.length) {
        return block;
    }
    return {
        ...block,
        blocks: updateSpawnAgentBlocks(childBlocks, toolCallId, results),
    };
};
const updateSpawnAgentBlocks = (blocks: ContentBlock[], toolCallId: string, results: JSONValue[]): ContentBlock[] => {
    return blocks
        .map((block) => updateSpawnAgentBlock(block, toolCallId, results))
        .filter((block): block is ContentBlock => block !== null);
};
const handleSpawnAgentsResult = (state: EventHandlerState, toolCallId: string, results: JSONValue[]) => {
    // Replace placeholder spawn agent blocks with their final text/status output.
    state.message.updater.updateAiMessageBlocks((blocks) => updateSpawnAgentBlocks(blocks, toolCallId, results));
    results.forEach((_, index: number) => {
        const agentId = `${toolCallId}-${index}`;
        updateStreamingAgents(state, { remove: agentId });
    });
    // FID-2026-0718-010 (F1): flush the parent agent's streaming-state too.
    // The parent's toolCallId/agentId may have been added back into
    // streamingAgents by text chunks during the spawn window. Without this
    // explicit remove, isStreaming stays true on the parent branch and the
    // "working..." shimmer never clears.
    flushParentStreamingAgents(state, toolCallId);
};
/**
 * FID-2026-0718-010 (F1 + Q13): clear the parent toolCallId / agentId and
 * any late chunks from streamingAgents. Also short-circuits if the run is
 * already completed (Q13: late-chunk-after-run-end).
 */
function flushParentStreamingAgents(state: EventHandlerState, toolCallId: string): void {
    if (state.streaming.streamRefs.state.runCompleted) {
        return;
    }
    // Remove the parent's toolCallId from the streaming set (the loop ID).
    state.streaming.setStreamingAgents((prev) => {
        const next = new Set(prev);
        next.delete(toolCallId);
        return next;
    });
}
const handleToolResult = (state: EventHandlerState, event: PrintModeToolResult) => {
    const firstOutput = event.output?.[0];
    const askUserResult: JSONValue | undefined = firstOutput && firstOutput.type === 'json' ? firstOutput.value : undefined;
    state.message.updater.updateAiMessageBlocks((blocks) => transformAskUserBlocks(blocks, {
        toolCallId: event.toolCallId,
        resultValue: askUserResult,
    }));
    const firstOutputValue: JSONValue | undefined = firstOutput && firstOutput.type === 'json' ? firstOutput.value : undefined;
    const isSpawnAgentsResult = Array.isArray(firstOutputValue) &&
        firstOutputValue.some((v) => isJSONValueRecord(v) &&
            (typeof v.agentName === 'string' || typeof v.agentType === 'string'));
    if (isSpawnAgentsResult && Array.isArray(firstOutputValue)) {
        handleSpawnAgentsResult(state, event.toolCallId, firstOutputValue);
        return;
    }
    state.message.updater.updateAiMessageBlocks((blocks) => updateToolBlockWithOutput(blocks, {
        toolCallId: event.toolCallId,
        toolOutput: event.output,
    }));
    // Reflect ECHO FSM phase transitions into the chat store so the sidebar's
    // PhaseIndicator updates in real time. The transition_phase tool returns
    // `{ phase: 'red' | 'green' | 'audit' | ... }`; malformed payloads no-op.
    if (event.toolName === 'transition_phase' &&
        firstOutputValue != null &&
        isJSONValueRecord(firstOutputValue) &&
        typeof firstOutputValue.phase === 'string') {
        useChatStore.getState().setFsmPhase(firstOutputValue.phase);
    }
    updateStreamingAgents(state, { remove: event.toolCallId });
};
const handleFinish = (state: EventHandlerState, event: PrintModeFinish) => {
    if (typeof event.totalCost === 'number' && state.onTotalCost) {
        state.onTotalCost(event.totalCost);
    }
    // FID-2026-0718-010 (F2 backstop, D5): if finish arrives, ensure UI is
    // reset to idle. Some runs don't fire subagent_finish for the parent
    // until after onStreamEnded. Treat `finish` as a strong backstop.
    resetUiToIdle('finish');
};
/**
 * FID-2026-0718-010 (Q13): guard all streaming state mutations against the
 * runCompleted flag. After runCompleted is set, late-arriving chunks
 * (race condition) short-circuit with a warn-log.
 */
function guardedSetStreamingAgents(state: EventHandlerState, op: {
    add?: string;
    remove?: string;
}): void {
    if (state.streaming.streamRefs.state.runCompleted) {
        state.logger.warn({ op: JSON.stringify(op) }, '[sdk-event-handlers] late streaming-agent event after run end');
        return;
    }
    state.streaming.setStreamingAgents((prev) => {
        const next = new Set(prev);
        if (op.remove)
            next.delete(op.remove);
        if (op.add)
            next.add(op.add);
        return next;
    });
}
export const createStreamChunkHandler = (state: EventHandlerState) => (event: StreamChunkEvent) => {
    const destination = destinationFromChunkEvent(event);
    let text: string | undefined;
    if (typeof event === 'string') {
        text = event;
    }
    else {
        text = event.chunk;
    }
    if (!destination) {
        state.logger.warn({ event }, 'Unhandled stream chunk event');
        return;
    }
    if (!text) {
        return;
    }
    ensureStreaming(state);
    if (destination.type === 'root') {
        if (destination.textType === 'text') {
            state.streaming.streamRefs.setters.appendRootStreamBuffer(text);
        }
        state.streaming.streamRefs.setters.setRootStreamSeen(true);
        appendRootChunk(state, { type: destination.textType, text });
        return;
    }
    state.message.updater.updateAiMessageBlocks((blocks) => processTextChunk(blocks, destination, text));
};
export const createEventHandler = (state: EventHandlerState) => (event: SDKEvent) => {
    return (match(event)
        .with({ type: 'subagent_start' }, (e) => handleSubagentStart(state, e))
        .with({ type: 'subagent_finish' }, (e) => handleSubagentFinish(state, e))
        .with({ type: 'tool_call' }, (e) => handleToolCall(state, e))
        .with({ type: 'tool_result' }, (e) => handleToolResult(state, e))
        .with({ type: 'finish' }, (e) => handleFinish(state, e))
        // FID-2026-0718-009: route runtime activity indicator to chat store.
        // The print-mode activity schema is permissive (all fields optional)
        // for forward-compat, but the runtime guarantees construction via
        // setActivity(), which produces a strict AgentActivity discriminated
        // union — so we cast at the boundary.
        .with({ type: 'activity' }, (e) => useChatStore
        .getState()
        .setActivity(e.activity as AgentActivity))
        .otherwise(() => undefined));
};
