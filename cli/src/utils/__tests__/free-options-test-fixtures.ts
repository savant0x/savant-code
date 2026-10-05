// Shared fixtures for the free-options test family (see free-options.test.ts
// for the family header): the custats catalog snapshot and a deterministic
// wired/not-wired provider context used by every suite.

import type { FreeCatalogEnvelope, FreeOptionsContext } from '../free-options'

export const CATALOG: FreeCatalogEnvelope = {
  fetchedAt: '2026-09-28T01:00:13.744Z',
  totalModels: 4,
  models: [
    {
      id: 'z-ai/glm-5.3-flash',
      providerId: 'openrouter',
      context_length: 1_000_000,
    },
    { id: 'llama-4-scout', providerId: 'groq', context_length: 131_072 },
    { id: 'qwen-3-coder', providerId: 'cerebras', context_length: 262_144 },
    { id: 'gemma-3-it', providerId: 'google', context_length: 1_000_000 },
  ],
  newModelIds: ['qwen-3-coder'],
  archivedModels: [],
}

export const CTX: FreeOptionsContext = {
  nowMs: Date.parse('2026-09-28T12:00:00Z'),
  // User has wired openrouter (stored key) and nvidia (env var), and runs ollama locally.
  wiredEnvVars: new Set(['OPENROUTER_API_KEY', 'NVIDIA_API_KEY']),
  registryByProviderId: {
    openrouter: {
      id: 'openrouter',
      label: 'OpenRouter',
      envVar: 'OPENROUTER_API_KEY',
      setupCommand: '/provider openrouter',
    },
    groq: {
      id: 'groq',
      label: 'Groq',
      envVar: 'GROQ_API_KEY',
      setupCommand: '/provider groq',
    },
    cerebras: {
      id: 'cerebras',
      label: 'Cerebras',
      envVar: 'CEREBRAS_API_KEY',
      setupCommand: '/provider cerebras',
    },
    google: {
      id: 'google',
      label: 'Google AI Studio',
      envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
      setupCommand: '/provider google',
    },
  },
  localProviders: [
    { id: 'ollama', label: 'Ollama', setupCommand: '/provider ollama' },
  ],
}
