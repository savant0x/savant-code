import React from 'react'

import { usePublishContainerController } from './use-publish-container-controller'
import { BORDER_CHARS } from '../utils/ui-constants'
import { ConfirmationStep } from './publish-container/confirmation-step'
import { ErrorStep } from './publish-container/error-step'
import { PublishHeader } from './publish-container/header'
import { EmptyStatePanel, TooSmallPanel } from './publish-container/panels'
import { SelectionStep } from './publish-container/selection-step'
import { SuccessStep } from './publish-container/success-step'

import type { MultilineInputHandle } from './multiline-input'

interface PublishContainerProps {
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  onExitPublish?: () => void
  onPublish: (agentIds: string[]) => Promise<void>
  width: number
}

export const PublishContainer: React.FC<PublishContainerProps> = ({
  inputRef,
  onExitPublish,
  onPublish,
  width,
}) => {
  const {
    theme,
    isTooSmall,
    publishMode,
    selectedAgentIds,
    currentStep,
    isPublishing,
    successResult,
    errorResult,
    includeDependents,
    inputFocused,
    agents,
    filteredAgents,
    selectedAgents,
    agentDefinitions,
    focusedIndex,
    canProceed,
    searchQuery,
    publishAgentIds,
    setSearchQuery,
    toggleAgentSelection,
    setFocusedIndex,
    setIncludeDependents,
    handleSearchKeyIntercept,
    handleCancel,
    handleNext,
    handleBack,
    handlePublish,
  } = usePublishContainerController({ inputRef, onExitPublish, onPublish })

  if (!publishMode) {
    return null
  }

  if (isTooSmall) {
    return <TooSmallPanel onCancel={handleCancel} />
  }

  if (agents.length === 0) {
    return <EmptyStatePanel onCancel={handleCancel} />
  }

  return (
    <box
      border
      borderStyle="single"
      borderColor={theme.info}
      customBorderChars={BORDER_CHARS}
      style={{
        flexDirection: 'column',
        gap: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <PublishHeader
        currentStep={currentStep}
        selectedAgentCount={selectedAgents.length}
        onCancel={handleCancel}
      />

      {currentStep === 'selection' && (
        <SelectionStep
          width={width}
          inputRef={inputRef}
          inputFocused={inputFocused}
          agents={agents}
          filteredAgents={filteredAgents}
          selectedIds={selectedAgentIds}
          selectedAgents={selectedAgents}
          agentDefinitions={agentDefinitions}
          focusedIndex={focusedIndex}
          canProceed={canProceed}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleAgent={toggleAgentSelection}
          onFocusChange={setFocusedIndex}
          onKeyIntercept={handleSearchKeyIntercept}
          onNext={handleNext}
        />
      )}

      {currentStep === 'confirmation' && (
        <ConfirmationStep
          width={width}
          selectedAgents={selectedAgents}
          agents={agents}
          agentDefinitions={agentDefinitions}
          includeDependents={includeDependents}
          isPublishing={isPublishing}
          publishAgentCount={publishAgentIds.length}
          onToggleDependents={() => setIncludeDependents(!includeDependents)}
          onBack={handleBack}
          onPublish={handlePublish}
        />
      )}

      {currentStep === 'success' && successResult && (
        <SuccessStep
          width={width}
          successResult={successResult}
          onDone={handleCancel}
        />
      )}

      {currentStep === 'error' && errorResult && (
        <ErrorStep
          width={width}
          errorResult={errorResult}
          onBack={handleBack}
          onClose={handleCancel}
        />
      )}
    </box>
  )
}
