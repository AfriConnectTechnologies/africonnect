# AfCFTA AI Scaffold

## What Was Added

- Dashboard UI entry point on `app/[locale]/(dashboard)/compliance/page.tsx`
- Client component at `components/compliance/afcfta-ai-assistant.tsx`
- API route at `app/api/compliance/ask/route.ts`
- Provider and Qdrant wiring in `lib/compliance-ai/`

## Expected Qdrant Payload Shape

The current scaffold expects each Qdrant point payload to include:

- `text` or `chunk_text`
- `document_title`
- `article_or_section` or `section_title`
- optional `source_url`
- optional `country`
- optional `jurisdiction`
- optional `language`
- optional `document_type`
- optional `page_start`

## Current Behavior

- If `NEXT_PUBLIC_ENABLE_COMPLIANCE_AI` is `false`, the assistant reports that it is not configured.
- If Qdrant or Voyage env vars are missing, the route returns a safe not-configured response.
- If retrieval works but a generation API key is missing, the UI still shows retrieval-only evidence and citations.
- If generation is configured, the route attempts a full RAG answer with cited chunk IDs.

## Recommended First Setup

1. Enable `NEXT_PUBLIC_ENABLE_COMPLIANCE_AI=true`
2. Point `COMPLIANCE_AI_QDRANT_URL` and `COMPLIANCE_AI_QDRANT_COLLECTION` to your AfCFTA corpus
3. Set `COMPLIANCE_AI_EMBEDDING_DIMENSION` to match the Qdrant collection size
4. Add `VOYAGE_API_KEY`
5. Add `OPENAI_API_KEY`
6. Upload chunked AfCFTA documents with metadata matching the expected payload shape

## Dimension Matching

Your Voyage embedding output dimension must match the Qdrant collection vector size.

Example:

- Qdrant collection size `512` -> `COMPLIANCE_AI_EMBEDDING_DIMENSION=512`
- Qdrant collection size `1024` -> `COMPLIANCE_AI_EMBEDDING_DIMENSION=1024`

## Known Limitations

- Retrieval is currently dense-first; sparse/BM25 fusion is the next logical extension.
- Reranking is scaffolded as a score-preserving step and can be upgraded to a live reranker call next.
- There is no admin ingestion UI yet; the current scaffold assumes documents are loaded into Qdrant separately.
