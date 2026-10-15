import type { AdvisoryWarning } from './types'

export interface AdvisoryLogEntry {
  timestamp: number
  law: number
  severity: 'info' | 'warning'
  message: string
  file?: string
  line?: number
}

export class AdvisoryLogger {
  private log: AdvisoryLogEntry[] = []

  logWarning(warning: AdvisoryWarning): void {
    this.log.push({
      timestamp: Date.now(),
      law: warning.law,
      severity: warning.severity,
      message: warning.message,
      file: warning.file,
      line: warning.line,
    })
  }

  logBatch(warnings: AdvisoryWarning[]): void {
    for (const w of warnings) {
      this.logWarning(w)
    }
  }

  getLog(): readonly AdvisoryLogEntry[] {
    return this.log
  }

  getWarningsForLaw(law: number): AdvisoryLogEntry[] {
    return this.log.filter((e) => e.law === law)
  }

  hasViolations(): boolean {
    return this.log.length > 0
  }

  clear(): void {
    this.log = []
  }
}
