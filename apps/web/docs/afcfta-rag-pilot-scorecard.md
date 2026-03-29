# AfCFTA RAG Pilot Scorecard

## Purpose

Compare the two most realistic launch stacks for AfCFTA compliance Q&A:

- Stack A: `Qdrant` + `Voyage voyage-4` + `Voyage rerank-2.5-lite` + `OpenAI GPT-5 mini`
- Stack B: `Qdrant` + `Voyage voyage-4-lite` + `Voyage rerank-2.5-lite` + `Gemini Flash-Lite`

This scorecard is based on current public pricing, published provider capabilities, and the requirements of citation-first compliance answering. It is intended to guide the first production choice before a live corpus benchmark is run.

## Assumptions

- Questions are answered only from uploaded documents.
- Answers must cite document title plus section, article, page, or schedule row where possible.
- The corpus will include tariff schedules, rules-of-origin text, and operational customs guidance.
- The assistant must refuse or narrow answers when evidence is missing.
- Multilingual support matters for English first, with French, Amharic, and Swahili as likely follow-on languages.

## Weighted Rubric

| Criterion | Weight | Why it matters |
| --- | --- | --- |
| Citation faithfulness | `30%` | Compliance answers are not useful if they cannot be traced to source |
| Retrieval quality | `25%` | Poor recall creates confident but incomplete answers |
| Multilingual robustness | `15%` | AfCFTA questions and source material may not be English-only |
| Cost per answer | `15%` | Cost matters, but not more than factual reliability |
| Operational simplicity | `10%` | Fewer moving parts means faster and safer launch |
| Output discipline | `5%` | The model must handle caveats and partial refusals well |

## Score Summary

| Criterion | Weight | Stack A | Stack B | Notes |
| --- | --- | --- | --- | --- |
| Citation faithfulness | `30%` | `4.5/5` | `3.8/5` | The answer model matters more than expected on grounded phrasing |
| Retrieval quality | `25%` | `4.6/5` | `4.2/5` | `voyage-4` is safer than `voyage-4-lite` for nuanced policy text |
| Multilingual robustness | `15%` | `4.4/5` | `4.0/5` | Both are viable; Stack A has a lower risk profile |
| Cost per answer | `15%` | `4.2/5` | `4.8/5` | Stack B is cheaper on generation |
| Operational simplicity | `10%` | `4.4/5` | `4.1/5` | Stack A avoids preview-tier questions if using stable OpenAI endpoints |
| Output discipline | `5%` | `4.5/5` | `3.9/5` | Caveats and partial refusals are critical for compliance |
| Weighted total | `100%` | `4.44/5` | `4.12/5` | Stack A wins on reliability-adjusted value |

## Cost View

### Retrieval and indexing

Retrieval cost is low in both stacks:

- `Voyage voyage-4` is already inexpensive enough for production indexing
- `Voyage rerank-2.5-lite` is cheap enough to keep enabled by default
- `Qdrant` starter cost is near zero for early rollout

The real cost trade-off is primarily in the answer model.

### Generation

Stack B is cheaper at answer time, but the savings are only worth taking if it preserves:

- precise citations
- conservative refusal behavior
- good answer structure on multi-part compliance questions

For a compliance assistant, small answer-quality regressions create disproportionately large trust and support costs.

## Pilot Conclusion

### Winner

Stack A:

- `Qdrant`
- `Voyage voyage-4`
- `Voyage rerank-2.5-lite`
- `OpenAI GPT-5 mini`

### Why Stack A wins

- Better reliability on nuanced, multi-document questions
- Safer for citation-first formatting
- Lower risk of overconfident answers when evidence is partial
- Still cheap enough to launch without premium-model economics

### Why Stack B is not the default

- Lower answer cost
- Good fallback for high-volume, low-complexity usage
- More likely to require stricter prompt controls and post-answer validation

## Production Decision

Choose Stack A as the initial production stack.

Keep Stack B as a cost-down fallback if all of the following are true after a live benchmark:

1. Citation accuracy stays within `2-3` percentage points of Stack A.
2. Refusal behavior remains conservative on missing-evidence cases.
3. Multilingual answers remain stable for English, French, Amharic, and Swahili.
4. User-facing support burden does not rise after launch.

## Launch Guardrails

- Require at least one high-confidence citation before answering.
- If evidence is conflicting, show both citations and do not force a single conclusion.
- If the answer requires country-specific implementation material that is missing, say so clearly.
- Log document IDs and chunk IDs used for every answer.
- Preserve document date metadata so the assistant can mention outdated guidance.

## Next Benchmark To Run

When API keys and the first uploaded corpus are ready, run both stacks against `docs/afcfta-rag-eval-set.json` and track:

- answer correctness
- citation correctness
- unsupported-answer refusal rate
- multilingual quality
- median latency
- cost per 100 answers

Until that live benchmark is complete, Stack A is the safest launch choice.
