import React, { useState } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { Button } from '../button'
import { MultilineInput } from '../multiline-input'

import type { DrivePlanFields } from '../../commands/auto-drive'

export interface DriveModeConfirmationProps {
  plan: DrivePlanFields
  onConfirm: (editedPlan: string) => void
  onRevise: (notes: string) => void
  onCancel: () => void
}

/**
 * FID-2026-0818-002: the single Law 2 approval surface for Auto Drive.
 *
 * The pre-build plan is shown in an inline-editable field. Confirm treats the
 * (possibly edited) field as the approved plan; Revise treats it as revision
 * notes for a re-plan; Cancel abandons the run. No model-owned ask_user is
 * involved — this gate is CLI-owned.
 */
export const DriveModeConfirmation: React.FC<DriveModeConfirmationProps> = ({
  plan,
  onConfirm,
  onRevise,
  onCancel,
}) => {
  const theme = useTheme()
  const [planText, setPlanText] = useState(plan.plan)

  return (
    <box
      title="Auto Drive — approve the pre-build plan"
      titleAlignment="center"
      style={{
        flexDirection: 'column',
        width: '100%',
        borderStyle: 'single',
        borderColor: theme.primary,
        paddingLeft: 1,
        paddingRight: 1,
        gap: 1,
      }}
    >
      <box style={{ flexDirection: 'column', width: '100%' }}>
        <text style={{ fg: theme.muted }}>Goal</text>
        <text wrapMode="word">{plan.goal}</text>
      </box>

      <box
        style={{
          flexDirection: 'column',
          width: '100%',
          borderStyle: 'single',
          borderColor: theme.border,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text style={{ fg: theme.muted }}>
          Plan — edit inline, then Confirm (or edit into notes and Revise)
        </text>
        <MultilineInput
          value={planText}
          cursorPosition={0}
          onChange={(inputValue) => setPlanText(inputValue.text)}
          onSubmit={() => onConfirm(planText)}
          onPaste={(text) => {
            if (text) setPlanText((prev) => prev + text)
          }}
          focused={true}
          maxHeight={8}
          minHeight={3}
          placeholder="Pre-build plan..."
        />
      </box>

      <box style={{ flexDirection: 'row', gap: 2, width: '100%' }}>
        <Button
          onClick={() => onConfirm(planText)}
          style={{
            borderStyle: 'single',
            borderColor: theme.primary,
            paddingLeft: 2,
            paddingRight: 2,
          }}
        >
          <text style={{ fg: theme.primary }}>Confirm</text>
        </Button>
        <Button
          onClick={() => onRevise(planText)}
          style={{
            borderStyle: 'single',
            borderColor: theme.muted,
            paddingLeft: 2,
            paddingRight: 2,
          }}
        >
          <text style={{ fg: theme.muted }}>Revise</text>
        </Button>
        <Button
          onClick={onCancel}
          style={{
            borderStyle: 'single',
            borderColor: theme.muted,
            paddingLeft: 2,
            paddingRight: 2,
          }}
        >
          <text style={{ fg: theme.muted }}>Cancel</text>
        </Button>
      </box>
    </box>
  )
}
