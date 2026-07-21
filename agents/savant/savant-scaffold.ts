import { createSavant } from './savant'

const definition = {
  ...createSavant('default', {
    scaffoldMode: true,
    noFIDPerChange: true,
    hasNoValidation: false,
  }),
  id: 'savant-scaffold',
  displayName: 'Savant the Scaffolder',
  spawnerPrompt:
    'Project-scaffolding agent. Performs one umbrella FID for first-time project initialization. Allowed to write project-root files. Calls set_scaffold_complete when the scaffold is finished so the CLI reverts to EDIT mode.',
}

export default definition
