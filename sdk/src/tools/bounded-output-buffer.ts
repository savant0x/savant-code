import { stripColors } from '../../../common/src/util/string'

const TRUNCATION_MARKER = '\n[...TRUNCATED DUE TO LENGTH...]\n'
const MAX_PENDING_COLOR_SEQUENCE_LENGTH = 32
const INCOMPLETE_COLOR_SEQUENCE_REGEX = /\x1B\[[0-9;]*$/

/**
 * Retains a bounded prefix and suffix while continuing to drain a child
 * process's output. This keeps noisy commands from growing the CLI process to
 * multiple gigabytes before the result is truncated.
 */
export class BoundedOutputBuffer {
  private head = ''
  private tail = ''
  private truncated = false
  private pendingColorSequence = ''
  private readonly headLimit: number
  private readonly tailLimit: number

  constructor(private readonly maxLength: number) {
    if (maxLength < TRUNCATION_MARKER.length) {
      throw new Error('Output limit must fit the truncation marker')
    }
    const retainedLength = Math.max(0, maxLength - TRUNCATION_MARKER.length)
    this.headLimit = Math.ceil(retainedLength / 2)
    this.tailLimit = Math.floor(retainedLength / 2)
  }

  append(value: string): void {
    if (!value) return

    let normalized = this.pendingColorSequence + value
    this.pendingColorSequence = ''
    const incompleteColorSequence = normalized.match(
      INCOMPLETE_COLOR_SEQUENCE_REGEX,
    )?.[0]
    if (
      incompleteColorSequence &&
      incompleteColorSequence.length <= MAX_PENDING_COLOR_SEQUENCE_LENGTH
    ) {
      this.pendingColorSequence = incompleteColorSequence
      normalized = normalized.slice(0, -incompleteColorSequence.length)
    }
    normalized = stripColors(normalized)
    if (!normalized) return

    if (!this.truncated) {
      const combined = this.head + normalized
      if (combined.length <= this.maxLength) {
        this.head = combined
        return
      }

      this.truncated = true
      this.head = combined.slice(0, this.headLimit)
      this.tail = this.tailLimit === 0 ? '' : combined.slice(-this.tailLimit)
      return
    }

    this.tail =
      this.tailLimit === 0
        ? ''
        : (this.tail + normalized).slice(-this.tailLimit)
  }

  get retainedLength(): number {
    return this.head.length + this.tail.length
  }

  format(): string {
    if (!this.truncated) {
      return this.head
    }
    return this.head + TRUNCATION_MARKER + this.tail
  }
}
