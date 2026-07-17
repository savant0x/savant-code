import { createFilePicker } from '../scout/scout'
import { type SecretAgentDefinition } from '../types/secret-agent-definition'

const definition: SecretAgentDefinition = {
  id: 'file-picker-max',
  ...createFilePicker('max'),
}

export default definition
