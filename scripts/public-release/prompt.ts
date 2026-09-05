// FID-2026-0905-007 — public-release decomposition: interactive prompt.
//
// The TTY confirmation gate: prints the exact public mutation targets and the
// release plan, then requires the operator to type RELEASE. Verbatim move
// from scripts/public-release.ts.

import { createInterface } from 'readline/promises'

import {
  PUBLIC_REPOSITORY,
  PUBLIC_REPOSITORY_SLUG,
  configuredReleasePackages,
} from './catalog'
import { fail } from './fail'

import type { PackageTarget } from './catalog'

export async function confirm(
  plan: readonly string[],
  version: string,
  resume: boolean,
): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail(
      'Public release requires interactive confirmation; use --preview in CI.',
    )
  }
  console.log('\nExact public mutation targets:')
  console.log(`  repository: ${PUBLIC_REPOSITORY}`)
  console.log(`  branch: origin/main`)
  console.log(`  tag: v${version} (annotated)`)
  console.log(
    `  GitHub release: ${PUBLIC_REPOSITORY_SLUG}/releases/tag/v${version}`,
  )
  console.log(
    `  npm packages: ${configuredReleasePackages()
      .map((target: PackageTarget) => target.name)
      .join(', ')}`,
  )
  console.log(
    `  mode: ${resume ? 'resume completed stages where safe' : 'new release'}`,
  )
  console.log('\nRelease plan:')
  for (const step of plan) console.log(`  - ${step}`)

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  try {
    const answer = await prompt.question(
      `\nPublish exactly these targets for v${version}? Type RELEASE to continue: `,
    )
    if (answer.trim() !== 'RELEASE') fail('Release cancelled.')
  } finally {
    prompt.close()
  }
}
