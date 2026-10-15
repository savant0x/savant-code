# Scholarly RAG Acceptance Run — Full Report

**Date:** 2026-10-12
**Question exercised:** *Does retrieval-augmented generation reliably reduce factual
hallinations, and under what conditions does it fail?*
**Pipeline under test:** `researcher-web` → `scholars-search` MCP
(`https://api.sciencemadereadable.com/mcp`), the surface repaired by
FID-2026-1012-001 (wiring) and FID-2026-1012-003 (schema/render recovery).
**Phase at run time:** idle (analysis-only; no production code touched this session).

---

## 1. Objective

Exercise all four scholarly MCP tools with correctly typed arguments to confirm the
repaired tool pipeline dispatches typed arrays and numeric limits without the
validation failures FID-2026-1012-003 targeted, and answer the research question from
records fetched during the run only.

## 2. Tool surface and argument contract

| Tool | Arguments (as dispatched) | Notes |
|---|---|---|
| `scholars-search__search_papers` | `query: string`, `limit: number`, `abstracts: 'none'\|'short'\|'full'` | `abstracts` is an enum, **not** a boolean (the pre-repair prompt said `false`) |
| `scholars-search__get_papers` | `ids: string[]` | real array, never a comma-joined string |
| `scholars-search__find_similar_papers` | `paper: string`, `limit: number`, `abstracts: enum` | single seed id |
| `scholars-search__citation_walk` | `paper: string`, `breadth: number`, `limit: number` | `breadth`/`limit`, not `k` |

## 3. Call log

| # | Tool | Arguments (name: JS type) | Result |
|---|---|---|---|
| 1 | `search_papers` | `query: string`, `limit: number 8`, `abstracts: string "short"` | ✅ 8 papers, OpenAlex ids + abstracts |
| 2 | `get_papers` | `ids: array of 8 strings` (from step 1) | ✅ 8 full records with DOIs |
| 3 | `find_similar_papers` | `paper: string "W4386556635"`, `limit: number 12`, `abstracts: string "short"` | ✅ 12 neighbors |
| 4 | `citation_walk` | `paper: string "W4386556635"`, `breadth: number 10`, `limit: number 20` | ❌ Failed — "This paper has no references inside the snapshot, so there is nothing to compare." **Data-coverage limit, not an argument-type error.** No retry loop; substituted a related seed. |
| 5 | `citation_walk` | `paper: string "W4408145721"`, `breadth: number 10`, `limit: number 20` | ✅ 96 references (80 in index), neighbours + co-cited candidates |
| 6 | `get_papers` | `ids: array of 4 strings` | ✅ 2 full abstracts; 2 metadata/front-matter only (reported as gaps) |
| 7 | `read_url` (MDPI) | `url: string` | ❌ 403 Forbidden — no retry (publisher block) |
| 8 | `read_url` (ar5iv) | `url: string`, `max_chars: number 14000` | ✅ RGB full text |

**All four scholarly tools succeeded** (one required a documented seed substitution).
No rate-limit errors, no 502/503, **no `web_search` fallback was needed**.

### Verbatim tool-result display (step 6, `get_papers`)

> **Evaluating the Retrieval Robustness of Large Language Models**
> 2025-05-28 · preprint · arXiv (Cornell University) · cited 1 times · open access (green)
> Authors: Shuyang Cao; Karthik Radhakrishnan; David Rosenberg; Steven Z. Lu;
> Pengxiang Cheng; Lu Wang; Shiyue Zhang
> Identifiers: W4416047542 · https://doi.org/10.48550/arxiv.2505.21870 ·
> https://openalex.org/W4416047542
>
> Retrieval-augmented generation (RAG) generally enhances large language models' (LLMs)
> ability to solve knowledge-intensive tasks. But RAG may also lead to performance
> degradation due to imperfect retrieval and the model's limited ability to leverage
> retrieved content. In this work, we evaluate the robustness of LLMs in practical RAG
> setups (henceforth retrieval robustness). We focus on three research questions:
> (1) whether RAG is always better than non-RAG; (2) whether more retrieved documents
> always lead to better performance; (3) and whether document orders impact results. To
> facilitate this study, we establish a benchmark of 1500 open-domain questions, each
> with retrieved documents from Wikipedia. We introduce three robustness metrics, each
> corresponds to one research question. Our comprehensive experiments, involving 11 LLMs
> and 3 prompting strategies, reveal that all of these LLMs exhibit surprisingly high
> retrieval robustness; nonetheless, different degrees of imperfect robustness hinders
> them from fully utilizing the benefits of RAG.

## 4. Verified records

| Paper | Year | Verified identifier | Main finding | Evidence limitations |
|---|---|---|---|---|
| Benchmarking LLMs in Retrieval-Augmented Generation (RGB) | 2023 | W4386556635 · doi:10.48550/arxiv.2309.01431 | RAG improves response accuracy, but 6 LLMs still fail negative rejection, multi-document integration, and counterfactual robustness; they "trust and prioritize the retrieved information over their own existing knowledge" even when warned | **Full text fetched**; 6 LLMs, news-derived EN+ZH corpus; lab benchmark, not production RAG |
| Evaluating the Retrieval Robustness of LLMs | 2025 | W4416047542 · doi:10.48550/arxiv.2505.21870 | RAG not always better than non-RAG; more documents do not always help; document order matters; 11 LLMs show "surprisingly high retrieval robustness" but imperfect robustness blocks full RAG benefit | **Abstract only**; 1500 questions, Wikipedia docs, 11 LLMs × 3 prompting strategies |
| Pandora's Box or Aladdin's Lamp (NoiserBench) | 2024 | W4402701389 · doi:10.48550/arxiv.2408.13533 | 7 noise types; noise splits into *beneficial* (can enhance some capabilities) and *harmful* (impairs) — noise is not monotonically detrimental | **Abstract only**; 8 LLMs, reasoning tasks; preprint, low citation count |
| RAGTruth: A Hallucination Corpus for Trustworthy Retrieval-Augmented LLMs | 2023 | W4390528749 · doi:10.48550/arxiv.2401.00396 | RAG is "a main technique for alleviating hallucinations," yet LLMs still present claims unsupported by or contradictory to retrieved content | **Abstract only (short)**; preprint, corpus-construction paper |
| Hallucination Mitigation for Retrieval-Augmented LLMs: A Review | 2025 | W4408145721 · doi:10.3390/math13050856 | Limitations within RAG *components themselves* can cause hallucinations ("confabulations"), not just the generator | **Abstract only (short)**; full text blocked (403); review, no primary experiments |
| When Not to Trust Language Models | 2023 | W4385570777 · doi:10.18653/v1/2023.acl-long.546 | **Record returned metadata only — abstract absent.** No finding reported | **Evidence gap** (not proof of absence); 311 citations, ACL |
| When RAG and LLM Conflict: Who Will AI Listen to? | 2024 | W4395044467 · doi:10.59350/7gfzv-88m36 | **Record returned front matter only.** No finding reported | **Evidence gap**; 0 citations, "other" type |

*Steps 1–2 returned and verified 8 ids with DOIs; those outputs were context-compacted
after being read, so the table rests on verbatim records retained from later calls plus
the full-text fetch.*

## 5. Synthesis

**Support for RAG reducing hallucinations.** The literature consistently frames RAG as
the standard mitigation: RAGTruth calls it "a main technique for alleviating
hallucinations"; RGB's full text confirms retrieval "can generate more accurate and
reliable responses" and improves accuracy in practice; the robustness study finds
"surprisingly high retrieval robustness" overall — models largely exploit well-retrieved
context rather than fabricate freely. The review adds that engineering the retrieval
components is itself a mitigation lever.

**Conditions under which RAG fails or backfires.**

- **Retriever noise.** Relevant-but-uninformative documents confuse the model (RGB full
  text — 2021 Nobel Prize documents contaminating a 2022 answer). NoiserBench shows
  noise is heterogeneous: harmful noise impairs, but some "beneficial noise" can help —
  the effect is non-monotonic.
- **Negative-rejection failure.** When no retrieved document contains the answer, LLMs
  frequently fail to abstain and instead generate incorrect answers (RGB full text).
  RAG does not reliably produce calibrated "I don't know" behaviour.
- **Multi-document integration.** Where an answer requires combining documents, LLMs
  "often fail to provide accurate answer" (RGB full text). Independently, more documents
  are not always better and document order changes results.
- **Authority bias toward retrieved text (the clearest backfire).** Even when the model
  knows the answer and is explicitly warned the context may contain errors, it "tend[s]
  to trust and prioritize the retrieved information over their own existing knowledge"
  (RGB full text). Retrieval can *inject* errors the model would not otherwise make.

**Bottom line.** RAG reliably reduces hallucinations only when retrieval is relevant,
sufficient, and single-hop, and when the answer is actually present in context.
Reliability is gated by retrieval quality and the generator's ability to *resist*
context, not merely by adding retrieval.

### Claims supported by abstracts only (not full text)

1. "RAG is a main technique for alleviating hallucinations"; residual
   unsupported/contradictory claims persist (RAGTruth, W4390528749).
2. RAG not always better than non-RAG; more docs not always better; document order
   matters; "surprisingly high" but imperfect retrieval robustness (W4416047542).
3. Noise bifurcates into beneficial vs. harmful; beneficial noise may enhance
   performance (NoiserBench, W4402701389).
4. Limitations within RAG components cause hallucinations/confabulations
   (Review, W4408145721 — full text 403-blocked).

All claims attributed to RGB (W4386556635) are full-text-supported.

## 6. Pipeline verdict

**The repaired schema path held.** Every numeric limit and every ids array dispatched
cleanly — the exact failure class FID-2026-1012-003 targeted (arguments arriving as
strings and failing validation). All four tools completed. Service-side data gaps
(missing references in a snapshot; two metadata-only records) were surfaced as gaps and
reported as service-level uncertainty, **not** converted into negative findings.

## 7. Problems encountered this session

1. **`dev/LEARNINGS.md` boot-read is structurally impossible.** 133,263 chars against a
   100,000-char read ceiling; an offset read at line 1750 returned *empty*, forcing a
   `tail` to finish grounding. The mandatory 0-EOF directive is unsatisfiable as written.
2. **Subagent context compaction destroyed fetched evidence mid-run.** The researcher's
   step 1–2 results (8 search hits + 8 verified records) were compacted while still
   working, weakening the deliverable from 8 verbatim records to 5.
3. **`read_url` failure surface.** Two failures this run (403 Forbidden on MDPI;
   `Unsupported content type: application/pdf`); `read_url` is the single largest
   failure class in the ledger at 216 lifetime entries.
4. **Subagent output relayed as token-level fragments** — the researcher's final message
   arrived as ~600 separate 1–3 token chunks. Adjacent to the FID-2026-1012-003
   render-recovery work.
5. **`write_todos` deserialization failed once** ("missing field `todos`"), then
   succeeded on an identical retry.

## 8. Not verified / not claimed

- Terminal rendering, interactive appearance, crash recovery, and internal coercion were
  **not** observed or tested — the CLI display layer was not exercised this run.
- No LLM-driven synthesis quality claim is made for the subagent's model selection.
- The two metadata-only records are gaps, not evidence of non-existence.

## 9. Suggested improvements

1. **Add offset-aware/paginated reading for boot files**, or split `dev/LEARNINGS.md` by
   year, so the mandatory 0-EOF read is satisfiable.
2. **Extend the compaction-protected tail to cover fresh research tool results** so
   fetched records survive mid-run compaction (`keepRecentTokens` currently protects the
   recent tail; scholarly records mid-run are outside it).
3. **Add a content-type preflight to `read_url`** so PDFs and 403s fail fast instead of
   committing to a full extraction.

---

*This report is an ephemeral scratchpad artifact; `dev/scratchpad/` is gitignored.
No production code was modified this session.*