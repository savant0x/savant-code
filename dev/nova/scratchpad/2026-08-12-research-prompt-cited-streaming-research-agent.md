# Self-Contained Gemini Deep Research Prompt — Cited Streaming Research Agent for Savant-Code

> Paste this entire prompt into Gemini Deep Research. It is fully self-contained: it carries the Savant-Code context, the source repo to study, and the exact deliverable. Gemini must fetch and read the linked repo + cited sources itself; do not assume prior knowledge.

## Objective

Research and design a **Cited Streaming Web Research capability for Savant-Code's Researcher agent**, inspired by the *pattern* demonstrated in Fireplexity (an open-source Perplexity-style AI search engine), then run that idea through Savant's Perfection Loop framing and produce a grounded, implementation-ready design plus draft FIDs.

## Source repository to study (read recursively, not just README)

`https://github.com/firecrawl/fireplexity`

Study how it implements: query → live web gather → LLM synthesis → streaming response with real-time citations. Note what it does well (UX shape, citation display) and what it lacks (citation verification, governance, persistence, cost structure). The repo is dormant (last commit Aug 2025) — treat it as a *reference implementation of an idea*, not a live product.

## Savant-Code context (read this — it defines the target environment)

Savant-Code is a multi-agent AI coding assistant built on **ECHO Protocol v0.2.0** (15 Laws + Perfection Loop FSM). Key facts:

- **TypeScript monorepo, Bun runtime, React/OpenTUI CLI, Vercel AI SDK provider contracts.** Strict mode.
- **10-agent roster** with separation of duties: Orchestrator, Detective, Forge, Verifier, Adversary, Recorder, Thinker, Scout, Researcher, Scribe. The **Researcher** role does web search + docs lookup today; it does NOT yet produce synthesized, cited, streaming research answers.
- **Adversary agent** — meta-verification: refutes Verifier FAILs, re-audits unevaluated PASSes, verdicts override. This is the natural owner of **citation verification** (does the cited source exist and say what the answer claims?).
- **ECHO governance** — universal grounding gate, EHEL deterministic tool enforcement, Perfection Loop (RED → GREEN → AUDIT → ADVERSARIAL). No code ships without a converged FID.
- **Provider system** — registry-derived; the harness model (currently a Nous direct provider) is the LLM fuel. Adding a second paid LLM API is NOT desired.
- **Knowledge graph** (`packages/knowledge-graph/`) — deterministic codebase knowledge engine. Research output should compound into it, not evaporate after render.
- **Zero-cost infrastructure preference** — prefer free/open backends over paid SaaS (e.g. Firecrawl is paid-per-crawl; a zero-cost gather path is strongly preferred).
- **"We define the market, not follow it"** — adapt the concept, do not adopt the repo.

## Required research angles

1. **The pattern, decoded** — what Fireplexity proves about streamed cited-search UX, and exactly which parts are reusable vs throwaway.
2. **Zero-cost gather** — how Savant-Code can gather live web evidence without Firecrawl: native fetch/scrape, free backend routing, or an installed zero-fee CLI. Identify the concrete path.
3. **Citation integrity** — the core differentiator. Design how the **Adversary** (or Verifier) verifies each cited source: existence, reachability, and factual alignment with the claim. This is what every Perplexity-clone gets wrong.
4. **Harness-model fuel** — the research synthesis runs on the resolved provider model already in the harness. No second API. Specify the integration seam.
5. **Streaming + grounding** — how streamed output coexists with ECHO's mandatory first-answer grounding gate (an ungrounded first response must not render before the gate resolves).
6. **Persistence** — research results feed `LEARNINGS.md` / knowledge graph so they compound across sessions.
7. **Orchestrator-invokable primitive** — not a separate UI; the Researcher is called mid-build by the Orchestrator.

## Deliverable

Return:
1. A **design proposal** mapping the idea onto Savant-Code's roster + ECHO governance, with the zero-cost gather path, citation-verification gate, harness-model fuel, streaming/grounding contract, and knowledge-graph persistence called out explicitly.
2. **3–5 draft FIDs** in Savant-Code FID format (`FID-YYYY-MMDD-NNN-{title}.md` style): one for the Researcher cited-streaming capability, one for the Adversary citation-verification gate, one for zero-cost gather integration, plus any others the research warrants. Each FID must include RED/GREEN/AUDIT/ADVERSARIAL structure, scope, out-of-scope, and an evidence section.
3. An **ECHO-compliance lens** — flag where a naive port would violate ECHO Law (ungrounded first response, unverified citations presented as fact, paid-infra dependency, research that doesn't persist) and map each to a FID-level mitigation.
4. A **honest gap list** — what needs operator/source evidence before implementation (live gather behavior, citation-verify false-positive rate, streaming+gate interaction).

## Constraints

- Self-contained: Gemini needs no external context beyond this prompt + the linked repo.
- Ground every claim in source (Fireplexity files, Savant-Code architecture, ECHO.md). Cite `path:line` where possible.
- Do NOT design a standalone web app. Design an *agent primitive* inside Savant-Code.
- Zero-cost gather is mandatory; name the concrete mechanism.
- Keep the "idea is alive, repo is dead" framing: borrow the pattern, rebuild it governed.
