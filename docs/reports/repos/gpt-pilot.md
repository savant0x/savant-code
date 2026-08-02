# GPT Pilot — Feature Inventory

> **Repo:** `resources/gpt-pilot` | **Language:** Python
> **Tagline:** The core logic for AI pair programmer

## Overview

GPT Pilot is a Python-based coding agent focused on structured development workflows. It features a step-based development process, test-driven development integration, and a BugHunter debugging loop. It emphasizes structured planning before implementation.

## Feature Inventory

### Structured Development Workflow

- **Step-Based Development** — Breaks projects into ordered steps: architecture, planning, coding, testing, debugging. Each step has clear entry/exit criteria. (`pilot/`)

### Test-Driven Development

- **TDD Integration** — Generates tests before code, runs them, and iterates until passing. Test output feeds back into the coding loop. (`pilot/`)

### BugHunter Debugging Loop

- **Automated Debugging** — When tests fail, BugHunter analyzes error output, proposes fixes, and re-runs tests. Bounded by attempt ceiling. (`pilot/`)

### Project Scaffolding

- **Template System** — Generates project structure from templates with configurable options. (`pilot/`)

### Agent-Computer Interface

- **Curated Tools** — Provides structured file viewers, search commands, and editors rather than raw shell access. (`pilot/`)

### Git Integration

- **Automatic Commits** — Creates commits at logical boundaries with descriptive messages. (`pilot/`)

### Conversation Management

- **Context Window Management** — Manages conversation history within token limits using summarization. (`pilot/`)

### LLM Provider Support

- **Multiple Providers** — OpenAI, Anthropic, and other providers via a unified interface. (`pilot/`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | Step-Based Development Workflow | Structured planning before implementation |
| HIGH | BugHunter Debugging Loop | Automated fix-and-retry for test failures |
| MEDIUM | TDD Integration | Test-first development pattern |
| MEDIUM | Project Scaffolding | Template-based project generation |
| LOW | Curated ACI Tools | Agent-optimized tool surfaces |
