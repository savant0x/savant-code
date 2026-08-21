import type { AccordionAnswer } from './components/accordion-question'
import type { AskUserQuestion } from '../../types/store'

/** Everything the render + keyboard layers need, computed from the questions
 *  and the store's focus state. Kept out of the component so the JSX shell
 *  stays under the 400-line bar. */
export interface MultipleChoiceFormState {
  terminalFocused: boolean
  suppressNextHoverFocusRef: React.MutableRefObject<boolean>
  expandedIndex: number | null
  setExpandedIndex: React.Dispatch<React.SetStateAction<number | null>>
  answers: Map<number, AccordionAnswer>
  focusedOptionIndex: number | null
  setFocusedOptionIndex: React.Dispatch<React.SetStateAction<number | null>>
  focusedQuestionIndex: number
  setFocusedQuestionIndex: React.Dispatch<React.SetStateAction<number>>
  submitFocused: boolean
  setSubmitFocused: React.Dispatch<React.SetStateAction<boolean>>
  submitHovered: boolean
  setSubmitHovered: React.Dispatch<React.SetStateAction<boolean>>
  showFocusHighlight: boolean
  setShowFocusHighlight: React.Dispatch<React.SetStateAction<boolean>>
  lastFocusBeforeSubmit: {
    questionIndex: number
    optionIndex: number
  } | null
  isTypingCustom: boolean
  setIsTypingCustom: React.Dispatch<React.SetStateAction<boolean>>
  customCursorPositions: Map<number, number>
  openQuestion: (questionIndex: number, optionIndex: number) => void
  focusSubmit: (from?: { questionIndex: number; optionIndex: number }) => void
  handleSetCustomText: (
    questionIndex: number,
    text: string,
    cursorPosition: number,
  ) => void
  handleCustomSubmit: (questionIndex: number) => void
  handleSelectOption: (
    questionIndex: number,
    optionIndex: number,
    source?: 'keyboard' | 'mouse',
  ) => void
  handleToggleOption: (questionIndex: number, optionIndex: number) => void
  formatAnswer: (
    question: AskUserQuestion,
    answer: AccordionAnswer | undefined,
  ) => { question: string; answer: string }
  handleSubmit: () => void
}
