import {
  EXPERIENCE_CLUSTER_GAP_MS,
  classCensusLine,
} from '@savant-code/common/util/experience-classes'

type CensusEntry = Parameters<typeof classCensusLine>[0]

export function printRecurrenceOutput(
  recordCount: number,
  classes: readonly CensusEntry[],
  issues: readonly string[],
): void {
  console.log(
    `recurrence probe: ${recordCount} records, ${classes.length} stable classes, ${issues.length} issues`,
  )
  console.log(
    `Time clusters group rows by class and session with a consecutive gap < ${EXPERIENCE_CLUSTER_GAP_MS}ms; they are not response or failure counts.`,
  )
  for (const entry of classes) console.log(classCensusLine(entry))
  for (const issue of issues) console.error(issue)
}
