// code-map parse module — integration tests with realistic tree-sitter
// captures for TypeScript and JavaScript.
// Sibling of the Loop 324 decomposition (unit suites live in parse-tokens
// and parse-extraction; multi-file scoring in parse-integration-scoring).

import {
  createMockTreeSitterCaptures,
  createMockTreeSitterParser,
  createMockTreeSitterQuery,
  createMockTree,
} from '@savant-code/common/testing/mocks/tree-sitter'
import { describe, it, expect } from 'bun:test'

import { parseTokens } from '../src/parse'

import type { LanguageConfig } from '../src/languages-common'

describe('parse module - integration tests (realistic parsing)', () => {
  it('should parse TypeScript code with realistic tree-sitter captures', () => {
    const testCode = `
function calculateSum(a: number, b: number): number {
  const result = a + b;
  console.log('Sum calculated:', result);
  return result;
}

class Calculator {
  multiply(x: number, y: number): number {
    return x * y;
  }
  
  divide(x: number, y: number): number {
    if (y === 0) {
      throw new Error('Division by zero');
    }
    return x / y;
  }
}

const calc = new Calculator();
const product = calc.multiply(5, 3);
console.log('Product:', product);
      `.trim()

    // Create a realistic mock of tree-sitter captures based on TypeScript AST
    const realisticCaptures = createMockTreeSitterCaptures([
      // Function identifiers
      { name: 'identifier', text: 'calculateSum' },
      { name: 'identifier', text: 'a' },
      { name: 'identifier', text: 'b' },
      { name: 'identifier', text: 'result' },

      // Class and method identifiers
      { name: 'identifier', text: 'Calculator' },
      { name: 'identifier', text: 'multiply' },
      { name: 'identifier', text: 'x' },
      { name: 'identifier', text: 'y' },
      { name: 'identifier', text: 'divide' },

      // Variable identifiers
      { name: 'identifier', text: 'calc' },
      { name: 'identifier', text: 'product' },

      // Function/method calls
      { name: 'call.identifier', text: 'console' },
      { name: 'call.identifier', text: 'log' },
      { name: 'call.identifier', text: 'Error' },
      { name: 'call.identifier', text: 'Calculator' },
      { name: 'call.identifier', text: 'multiply' },

      // Some other AST nodes that shouldn't be captured
      { name: 'type_identifier', text: 'number' },
      { name: 'string', text: '"Sum calculated:"' },
    ])

    const mockTree = createMockTree()
    const mockQuery = createMockTreeSitterQuery({
      captures: realisticCaptures,
    })
    const mockParser = createMockTreeSitterParser({ tree: mockTree })

    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.ts'],
      wasmFile: 'tree-sitter-typescript.wasm',
      queryText: 'mock query',
      parser: mockParser,
      query: mockQuery,
    }

    const result = parseTokens('test.ts', mockLanguageConfig, () => testCode)

    // Verify basic structure
    expect(result.numLines).toBeGreaterThan(0)
    expect(result.identifiers).toBeDefined()
    expect(result.calls).toBeDefined()

    // Verify specific identifiers are found
    expect(result.identifiers).toContain('calculateSum')
    expect(result.identifiers).toContain('Calculator')
    expect(result.identifiers).toContain('multiply')
    expect(result.identifiers).toContain('divide')
    expect(result.identifiers).toContain('calc')
    expect(result.identifiers).toContain('product')
    expect(result.identifiers).toContain('result')

    // Verify function calls are found
    expect(result.calls).toContain('console')
    expect(result.calls).toContain('log')
    expect(result.calls).toContain('Error')
    expect(result.calls).toContain('Calculator')
    expect(result.calls).toContain('multiply')

    // Verify arrays don't contain undefined or null
    expect(
      result.identifiers.every((id) => typeof id === 'string' && id.length > 0),
    ).toBe(true)
    expect(
      result.calls.every((call) => typeof call === 'string' && call.length > 0),
    ).toBe(true)

    // Verify deduplication works
    const uniqueIdentifiers = new Set(result.identifiers)
    expect(result.identifiers.length).toBe(uniqueIdentifiers.size)

    const uniqueCalls = new Set(result.calls)
    expect(result.calls.length).toBe(uniqueCalls.size)
  })

  it('should parse JavaScript code with realistic captures', () => {
    const testCode = `
function greetUser(name) {
  const greeting = 'Hello, ' + name + '!';
  document.getElementById('output').textContent = greeting;
  return greeting;
}

const users = ['Alice', 'Bob', 'Charlie'];
users.forEach(user => {
  greetUser(user);
});
      `.trim()

    const realisticCaptures = createMockTreeSitterCaptures([
      // Function identifiers
      { name: 'identifier', text: 'greetUser' },
      { name: 'identifier', text: 'name' },
      { name: 'identifier', text: 'greeting' },
      { name: 'identifier', text: 'users' },
      { name: 'identifier', text: 'user' },

      // Function/method calls
      { name: 'call.identifier', text: 'getElementById' },
      { name: 'call.identifier', text: 'forEach' },
      { name: 'call.identifier', text: 'greetUser' },

      // Property access
      { name: 'call.identifier', text: 'document' },
    ])

    const mockTree = createMockTree()
    const mockQuery = createMockTreeSitterQuery({
      captures: realisticCaptures,
    })
    const mockParser = createMockTreeSitterParser({ tree: mockTree })

    const mockLanguageConfig: LanguageConfig = {
      extensions: ['.js'],
      wasmFile: 'tree-sitter-javascript.wasm',
      queryText: 'mock query',
      parser: mockParser,
      query: mockQuery,
    }

    const result = parseTokens('test.js', mockLanguageConfig, () => testCode)

    // Verify identifiers
    expect(result.identifiers).toContain('greetUser')
    expect(result.identifiers).toContain('greeting')
    expect(result.identifiers).toContain('users')
    expect(result.identifiers).toContain('user')

    // Verify function calls
    expect(result.calls).toContain('getElementById')
    expect(result.calls).toContain('forEach')
    expect(result.calls).toContain('greetUser')
    expect(result.calls).toContain('document')
  })
})
