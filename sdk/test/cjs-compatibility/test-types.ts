// Test TypeScript type resolution in CommonJS environment
import {
  SavantCodeClient as ClientClass,
  getCustomToolDefinition,
} from '@savant-code/sdk'

import type {
  SavantCodeClient,
  CustomToolDefinition,
  RunState,
} from '@savant-code/sdk'

// Test 1: Type imports work correctly
const _testClient: SavantCodeClient = {} as any
const _testTool: CustomToolDefinition = {} as any
const _testState: RunState = {} as any

console.log('✅ Type imports successful')

// Test 2: Value imports work correctly in TypeScript
const clientConstructor = ClientClass
const toolDefFunction = getCustomToolDefinition

console.log(
  '✅ Value imports successful:',
  typeof clientConstructor,
  typeof toolDefFunction,
)

// Test 3: Test actual instantiation would work (without requiring API key)
type ClientOptions = ConstructorParameters<typeof ClientClass>[0]

const mockOptions: ClientOptions = {
  apiKey: 'test-key',
}

// This should compile without errors
const _mockClient = new ClientClass(mockOptions)

console.log('✅ Client instantiation types work correctly')

// Test 4: Custom tool definition types (compile-time only)
type MockTool = ReturnType<typeof getCustomToolDefinition>
const _toolTypeTest: MockTool = {} as any

console.log('✅ Custom tool definition types work correctly')

// Test 5: CommonJS import syntax also works in TypeScript
const SDKRequire = require('@savant-code/sdk')
const _ClientFromRequire: typeof ClientClass = SDKRequire.SavantCodeClient

console.log('✅ CommonJS require syntax works in TypeScript')

export {} // Make this a module
