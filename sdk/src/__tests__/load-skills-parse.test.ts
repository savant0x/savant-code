import { describe, expect, test } from 'bun:test'

import { parseSkillFileContent } from '../skills/load-skills'

// FID-2026-0819-005 Loop 173: parseSkillFileContent suite split verbatim from
// load-skills.test.ts (the loadSkills suite and its fs harness stay in the
// parent).

describe('parseSkillFileContent', () => {
  test('validates in-memory edits with the same rules as disk discovery', () => {
    const valid = [
      '---',
      'name: deploy',
      'description: Deploy safely',
      '---',
      '',
      '# Deploy',
    ].join('\n')
    expect(
      parseSkillFileContent(valid, {
        directoryName: 'deploy',
        filePath: '/skills/deploy/SKILL.md',
      }),
    ).toMatchObject({
      name: 'deploy',
      description: 'Deploy safely',
      content: valid,
    })
    expect(
      parseSkillFileContent(valid.replace('name: deploy', 'name: release'), {
        directoryName: 'deploy',
        filePath: '/skills/deploy/SKILL.md',
      }),
    ).toBeNull()
  })
})
