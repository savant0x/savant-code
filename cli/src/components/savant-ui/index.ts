// Savant-UI Component Library
// Reusable, theme-aware terminal UI components for OpenTUI

// Theme
export { tokens, useTokens } from './theme'

// Primitives
export { Stack } from './primitives/stack'
export { Panel } from './primitives/panel'
export { Separator } from './primitives/separator'
export { Spacer } from './primitives/spacer'

// Layout
export { Header } from './layout/header'
export { Grid } from './layout/grid'

// Data Display
export { Badge } from './data-display/badge'
export { KeyValue } from './data-display/key-value'
export { Timeline } from './data-display/timeline'
export { Sparkline } from './data-display/sparkline'
export { TreeView } from './data-display/tree-view'
export { CodeBlock } from './data-display/code-block'

// Input
export { Select } from './input/select'
export { Toggle } from './input/toggle'

// Feedback
export { ProgressBar } from './feedback/progress-bar'
export { Spinner } from './feedback/spinner'
export { Alert } from './feedback/alert'
export { CostTracker } from './feedback/cost-tracker'

// Navigation
export { Stepper } from './navigation/stepper'

// Animation
export { Typewriter } from './animation/typewriter'
export { Pulse } from './animation/pulse'

// ECHO-Specific
export { PhaseIndicator } from './echo/phase-indicator'
export { AgentStatus } from './echo/agent-status'
export { PerfectionLoop } from './echo/perfection-loop'
export { FidCard } from './echo/fid-card'
export { FidList } from './echo/fid-list'
export { AgentStack } from './echo/agent-stack'
export { TokenMeter } from './echo/token-meter'

// Types
export type { StackProps } from './primitives/stack'
export type { PanelProps } from './primitives/panel'
export type { SeparatorProps } from './primitives/separator'
export type { BadgeProps } from './data-display/badge'
export type { KeyValueProps, KeyValueItem } from './data-display/key-value'
export type { TimelineProps, TimelineEvent } from './data-display/timeline'
export type { SparklineProps } from './data-display/sparkline'
export type { TreeViewProps, TreeViewNode } from './data-display/tree-view'
export type { ProgressBarProps } from './feedback/progress-bar'
export type { SpinnerProps } from './feedback/spinner'
export type { AlertProps } from './feedback/alert'
export type { CostTrackerProps } from './feedback/cost-tracker'
export type { StepperProps, StepperStep } from './navigation/stepper'
export type { TypewriterProps } from './animation/typewriter'
export type { PulseProps } from './animation/pulse'
export type { PhaseIndicatorProps } from './echo/phase-indicator'
export type { FidCardProps } from './echo/fid-card'
export type { FidListProps, FidData } from './echo/fid-list'
export type { AgentStackProps, AgentStackAgent } from './echo/agent-stack'
export type { TokenMeterProps } from './echo/token-meter'
export type { GridProps, Column } from './layout/grid'
export type { HeaderProps } from './layout/header'
export type { SelectProps, SelectOption } from './input/select'
export type { ToggleProps } from './input/toggle'
