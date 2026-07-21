# Aider — Feature Inventory

> **Repo:** `resources/aider` | **Language:** Python | **License:** Apache-2.0
> **Tagline:** AI pair programming in your terminal | ~6.8M installs, ~60k stars

## Overview

Aider is a mature Python coding agent with ~6.8M installs. Its distinguishing innovation is a **polymorphic edit format system** (13+ strategies) and a **PageRank-based repo map** for codebase indexing. It uses litellm for provider abstraction and has deep git integration.

## Feature Inventory

### Edit Formats (Core Architecture)
- **13+ Polymorphic Coders** — SEARCH/REPLACE blocks, unified diff, whole file, patch, fenced variants, editor variants, architect/editor two-stage, ask, context, help. Each model gets an optimal edit format. (`coders/base_coder.py`, `coders/editblock_coder.py`, `coders/udiff_coder.py`, `coders/wholefile_coder.py`)

### Architect/Editor Pattern
- **Two-Stage Workflow** — Architect LLM analyzes and produces edit instructions; editor LLM implements them. Can use different models. (`coders/architect_coder.py`)

### Repo Map (PageRank + tree-sitter)
- **Graph-Based Codebase Indexing** — tree-sitter extracts definitions/references, PageRank ranks files by relevance. Token-budgeted output. snake_case/kebab/camelCase get 10x weight; private identifiers get 0.1x. (`repomap.py`, `queries/tree-sitter-language-pack/`)

### Multi-Model Architecture
- **Main/Weak/Editor Models** — Three model tiers: main for coding, weak for commit messages/summarization, editor for architect pattern. 100+ model configs in YAML. (`models.py`, `resources/model-settings.yml`)

### Prompt Caching
- **Cache Warming** — Background thread sends periodic pings to keep Anthropic prompt caches alive. Configurable keepalive. (`coders/base_coder.py`, `coders/chat_chunks.py`)

### Chat History Summarization
- **Recursive Compression** — Splits at logical boundaries, summarizes older half, recursively combines. Background thread. (`history.py`)

### File Watcher (IDE Integration)
- **AI Comment Detection** — Regex detects `# ai...` / `// ai...` in any editor, triggers automatic code changes. Gitignore-aware. (`watch.py`, `watch_prompts.py`)

### Linting & Testing
- **Auto-Lint-After-Edit** — Runs configurable lint commands, feeds errors back to LLM for self-correction (up to `max_reflections`). (`linter.py`, `coders/base_coder.py`)

### Reflection Loop
- **Self-Correction** — After each LLM response, checks for issues and retries up to `max_reflections` times. (`coders/base_coder.py`)

### Git Integration
- **Deep Git** — Auto-commit with LLM-generated messages, gitignore management, `.aiderignore`, subtree-only mode, co-author attribution. (`repo.py`)

### Other
- **Voice-to-Code** — Microphone capture + LLM transcription. (`voice.py`)
- **Web Scraping** — Playwright headless Chromium with HTTP fallback. (`scrape.py`)
- **Clipboard Watcher** — Auto-populates input from clipboard for web chat integration. (`copypaste.py`)
- **Benchmark System** — Polyglot Exercism + SWE-bench with Docker isolation. (`benchmark/`)
- **Lazy Import Loading** — Version-aware deferred imports for fast startup. (`llm.py`)
- **Structured Exceptions** — Classified retry logic with exponential backoff. (`exceptions.py`)

## Top Adoptable Ideas for savant-code

| Priority | Feature | Why |
|----------|---------|-----|
| HIGH | Repo Map (PageRank + tree-sitter) | Best-in-class codebase indexing |
| HIGH | Edit Format Strategy Pattern | 13+ polymorphic coders; each model gets optimal format |
| HIGH | Architect/Editor Two-Stage Pattern | Clean planning/execution separation |
| HIGH | Reflection Loop (edit → lint → retry) | Core quality loop |
| MEDIUM | Multi-Model (Main/Weak/Editor) | Cost optimization via model tiering |
| MEDIUM | Prompt Cache Warming | Keeps Anthropic caches alive |
| MEDIUM | Chat History Summarization | Recursive background compression |
| MEDIUM | Model Settings YAML Registry | 100+ model configs in declarative YAML |
| MEDIUM | AI Comment File Watcher | Editor-agnostic trigger mechanism |
| LOW | Benchmark Framework | Polyglot eval methodology |
