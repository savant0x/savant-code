import { promises as fs } from 'fs'

import {
  getProjectFileTree,
  type PathInfo,
} from '@savant-code/common/project-file-tree'
import { useEffect, useMemo, useRef, useState } from 'react'

import { getProjectRoot } from '../project-files'
import { logger } from '../utils/logger'
import {
  filterAgentMatches,
  filterFileMatches,
  filterSlashCommands,
} from './suggestion-engine/filters'
import {
  flattenFileTree,
  getFileName,
  type MatchedAgentInfo,
  type MatchedFileInfo,
  type MatchedSlashCommand,
} from './suggestion-engine/matchers'
import {
  parseMentionContext,
  parseSlashContext,
  type TriggerContext,
} from './suggestion-engine/parsers'

// Re-exports preserve the original module's public API (FID-2026-0805-003):
// parser functions are unit-tested directly from this path.
export {
  isInsideStringDelimiters,
  parseAtInLine,
} from './suggestion-engine/parsers'
export type { TriggerContext } from './suggestion-engine/parsers'
export type {
  MatchedAgentInfo,
  MatchedFileInfo,
  MatchedSlashCommand,
} from './suggestion-engine/matchers'

import type { SuggestionItem } from '../components/suggestion-menu'
import type { SlashCommand } from '../data/slash-commands'
import type { AgentMode } from '../utils/constants'
import type { LocalAgentInfo } from '../utils/local-agent-registry'
import type { FileTreeNode } from '@savant-code/common/util/file'

export interface SuggestionEngineResult {
  slashContext: TriggerContext
  mentionContext: TriggerContext
  slashMatches: MatchedSlashCommand[]
  agentMatches: MatchedAgentInfo[]
  fileMatches: MatchedFileInfo[]
  slashSuggestionItems: SuggestionItem[]
  agentSuggestionItems: SuggestionItem[]
  fileSuggestionItems: SuggestionItem[]
}

interface SuggestionEngineOptions {
  inputValue: string
  cursorPosition: number
  slashCommands: SlashCommand[]
  localAgents: LocalAgentInfo[]
  fileTree: FileTreeNode[]
  disableAgentSuggestions?: boolean
  currentAgentMode?: AgentMode
}

export const useSuggestionEngine = ({
  inputValue,
  cursorPosition,
  slashCommands,
  localAgents,
  fileTree,
  disableAgentSuggestions = false,
  currentAgentMode,
}: SuggestionEngineOptions): SuggestionEngineResult => {
  const slashCacheRef = useRef<Map<string, MatchedSlashCommand[]>>(
    new Map<string, SlashCommand[]>(),
  )
  const agentCacheRef = useRef<Map<string, MatchedAgentInfo[]>>(
    new Map<string, MatchedAgentInfo[]>(),
  )
  const fileCacheRef = useRef<Map<string, MatchedFileInfo[]>>(
    new Map<string, MatchedFileInfo[]>(),
  )
  const fileRefreshIdRef = useRef(0)
  const [filePaths, setFilePaths] = useState<PathInfo[]>(() =>
    flattenFileTree(fileTree),
  )

  useEffect(() => {
    slashCacheRef.current.clear()
  }, [slashCommands])

  useEffect(() => {
    agentCacheRef.current.clear()
  }, [localAgents])

  useEffect(() => {
    fileCacheRef.current.clear()
  }, [filePaths])

  useEffect(() => {
    setFilePaths(flattenFileTree(fileTree))
  }, [fileTree])

  // Use the current inputValue (not a deferred value) so the slash menu
  // activates the same frame the user types '/'. Using a deferred value for
  // slash context caused the menu to miss the keystroke and let Up/Down leak
  // into the input as raw escape sequences.
  const slashContext = useMemo(
    () => parseSlashContext(inputValue),
    [inputValue],
  )

  // Note: mentionContext uses inputValue directly (not a deferred value) because
  // the cursor position must match the text being parsed. Using a deferred value
  // with current cursorPosition causes desync during heavy renders, making the
  // @ menu fail to appear intermittently (especially after long conversations).
  const mentionContext = useMemo(
    () => parseMentionContext(inputValue, cursorPosition),
    [inputValue, cursorPosition],
  )

  useEffect(() => {
    if (!mentionContext.active) {
      return
    }

    const requestId = ++fileRefreshIdRef.current
    let cancelled = false

    const refreshFilePaths = async () => {
      try {
        const projectRoot = getProjectRoot()
        const freshTree = await getProjectFileTree({
          projectRoot,
          fs,
        })

        if (cancelled || fileRefreshIdRef.current !== requestId) {
          return
        }

        setFilePaths(flattenFileTree(freshTree))
      } catch (error) {
        logger.debug({ error }, 'Failed to refresh file suggestions from disk')
      }
    }

    void refreshFilePaths()

    return () => {
      cancelled = true
    }
  }, [mentionContext.active])

  const slashMatches = useMemo<MatchedSlashCommand[]>(() => {
    if (!slashContext.active) {
      return []
    }

    const key = slashContext.query.toLowerCase()
    const cached = slashCacheRef.current.get(key)
    if (cached) {
      return cached
    }

    const matched = filterSlashCommands(slashCommands, slashContext.query)
    slashCacheRef.current.set(key, matched)
    return matched
  }, [slashContext, slashCommands])

  const agentMatches = useMemo<MatchedAgentInfo[]>(() => {
    if (!mentionContext.active || disableAgentSuggestions) {
      return []
    }

    const key = mentionContext.query.toLowerCase()
    const cached = agentCacheRef.current.get(key)
    if (cached) {
      return cached
    }

    const computed = filterAgentMatches(localAgents, mentionContext.query)
    agentCacheRef.current.set(key, computed)
    return computed
  }, [mentionContext, localAgents, disableAgentSuggestions])

  const fileMatches = useMemo<MatchedFileInfo[]>(() => {
    if (!mentionContext.active) {
      return []
    }

    const key = mentionContext.query.toLowerCase()
    const cached = fileCacheRef.current.get(key)
    if (cached) {
      return cached
    }

    const computed = filterFileMatches(filePaths, mentionContext.query)
    fileCacheRef.current.set(key, computed)
    return computed
  }, [mentionContext, filePaths])

  const slashSuggestionItems = useMemo<SuggestionItem[]>(() => {
    return slashMatches.map((command) => {
      // Mark the active mode in the suggestion menu. The mode commands are
      // generated from AGENT_MODES (FID-2026-0805-001); the previous regex only
      // matched the retired DEFAULT/MAX/PLAN ids, so the "(current)" marker
      // never fired after the EDIT→HYBRID rename. Compare against the current
      // mode id + aliases instead (no drift when AGENT_MODES changes).
      const isCurrentMode =
        currentAgentMode !== undefined &&
        [command.id, ...(command.aliases ?? [])].includes(
          `mode:${currentAgentMode.toLowerCase()}`,
        )

      return {
        id: command.id,
        label: command.label,
        labelHighlightIndices: command.labelHighlightIndices,
        description: isCurrentMode
          ? `${command.description} (current)`
          : command.description,
        descriptionHighlightIndices: command.descriptionHighlightIndices,
      }
    })
  }, [slashMatches, currentAgentMode])

  const agentSuggestionItems = useMemo<SuggestionItem[]>(() => {
    return agentMatches.map((agent) => ({
      id: agent.id,
      label: agent.id,
      labelHighlightIndices: agent.idHighlightIndices,
      description: '',
      descriptionHighlightIndices: null,
    }))
  }, [agentMatches])

  const fileSuggestionItems = useMemo<SuggestionItem[]>(() => {
    return fileMatches.map((file) => {
      const fileName = getFileName(file.filePath)
      const isRootLevel = !file.filePath.includes('/')
      // Show directories with trailing / in the label
      const displayLabel = file.isDirectory ? `${fileName}/` : fileName
      const displayPath = file.isDirectory ? `${file.filePath}/` : file.filePath

      return {
        id: file.filePath,
        label: displayLabel,
        labelHighlightIndices: file.pathHighlightIndices
          ? file.pathHighlightIndices
              .map((idx) => {
                const fileNameStart = file.filePath.lastIndexOf(fileName)
                return idx >= fileNameStart ? idx - fileNameStart : -1
              })
              .filter((idx) => idx >= 0)
          : null,
        description: isRootLevel ? '.' : displayPath,
        descriptionHighlightIndices: isRootLevel
          ? null
          : file.pathHighlightIndices,
      }
    })
  }, [fileMatches])

  return {
    slashContext,
    mentionContext,
    slashMatches,
    agentMatches,
    fileMatches,
    slashSuggestionItems,
    agentSuggestionItems,
    fileSuggestionItems,
  }
}
