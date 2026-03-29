# AfCFTA Document Ingestion

## Command

Run the importer from the project root:

```sh
bun run ingest:compliance
```

Optional dry run:

```sh
bun run ingest:compliance --dry-run
```

Optional custom directory:

```sh
bun run ingest:compliance --dir=./pdfs
```

## What It Does

- scans `pdfs/` recursively for `.pdf`, `.docx`, `.txt`, and `.md`
- extracts text from each file
- chunks the text by document headings and chunk size
- creates Voyage embeddings using `COMPLIANCE_AI_EMBEDDING_DIMENSION`
- upserts points into the `COMPLIANCE_AI_QDRANT_COLLECTION`
- caches embeddings locally in `.cache/compliance-ingestion/` so retries can skip Voyage calls

## Required Environment Variables

- `COMPLIANCE_AI_QDRANT_URL`
- `COMPLIANCE_AI_QDRANT_API_KEY`
- `COMPLIANCE_AI_QDRANT_COLLECTION`
- `COMPLIANCE_AI_EMBEDDING_MODEL`
- `COMPLIANCE_AI_EMBEDDING_DIMENSION`
- `VOYAGE_API_KEY`

## Optional Per-Document Metadata

For any file, add a sidecar JSON file with the same full name plus `.json`.

Example:

- document: `pdfs/Annex-2-to-the-AfCFTA-Agreement.pdf`
- metadata: `pdfs/Annex-2-to-the-AfCFTA-Agreement.pdf.json`

The same pattern works for DOCX files:

- document: `pdfs/My-AfCFTA-Notice.docx`
- metadata: `pdfs/My-AfCFTA-Notice.docx.json`

Example JSON:

```json
{
  "title": "Annex 2 to the AfCFTA Agreement",
  "sourceUrl": "https://au-afcfta.org/legal-texts/",
  "country": "continental",
  "jurisdiction": "afcfta",
  "language": "en",
  "documentType": "rules-of-origin"
}
```

## Payload Shape Written To Qdrant

Each point stores:

- `text`
- `document_title`
- `article_or_section`
- `source_url`
- `country`
- `jurisdiction`
- `language`
- `document_type`
- `page_start`

## Notes

- The current importer expects the Qdrant collection vector size to match `COMPLIANCE_AI_EMBEDDING_DIMENSION`.
- Your current setup is using `512`.
- The current assistant is dense retrieval only. Hybrid search and reranking can be added later.
- If an upload fails after embeddings are created, rerunning the importer reuses cached vectors for unchanged chunks.
