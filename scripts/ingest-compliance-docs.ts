import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import * as mammothImport from "mammoth";
import pdfParse from "pdf-parse";

type Message =
  | {
      type: "warning";
      message: string;
    }
  | {
      type: "error";
      message: string;
      error: unknown;
    };

type MammothApi = {
  extractRawText: (input: { buffer: Buffer }) => Promise<{
    value: string;
    messages: Message[];
  }>;
};

const mammoth = mammothImport as unknown as MammothApi;

type SupportedExtension = ".pdf" | ".txt" | ".md" | ".docx";

interface DocumentMetadata {
  title?: string;
  sourceUrl?: string;
  country?: string;
  jurisdiction?: string;
  language?: string;
  documentType?: string;
}

interface ChunkRecord {
  id: string;
  text: string;
  documentTitle: string;
  locator: string;
  sourcePath: string;
  pageStart?: number;
  sourceUrl?: string;
  country?: string;
  jurisdiction?: string;
  language?: string;
  documentType?: string;
}

interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

interface EmbeddingCacheFile {
  version: 1;
  model: string;
  dimension: number;
  entries: Record<string, number[]>;
}

const SUPPORTED_EXTENSIONS: SupportedExtension[] = [".pdf", ".txt", ".md", ".docx"];
const DEFAULT_INPUT_DIR = path.join(process.cwd(), "pdfs");
const CACHE_DIR = path.join(process.cwd(), ".cache", "compliance-ingestion");
const EMBEDDING_BATCH_SIZE = 32;
const UPSERT_BATCH_SIZE = 64;
const TARGET_CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 250;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const directoryArg = args.find((arg) => arg.startsWith("--dir="));
  const dryRun = args.includes("--dry-run");

  return {
    inputDir: directoryArg
      ? path.resolve(process.cwd(), directoryArg.split("=")[1]!)
      : DEFAULT_INPUT_DIR,
    dryRun,
  };
}

function getEmbeddingModel(): string {
  return process.env.COMPLIANCE_AI_EMBEDDING_MODEL ?? "voyage-4";
}

function createUuidFromSeed(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = "8";
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`;
}

function createChunkId(relativePath: string, heading: string, text: string): string {
  const contentHash = createHash("sha256").update(text.trim()).digest("hex");
  return createUuidFromSeed(`${relativePath}:${heading}:${contentHash}`);
}

function getEmbeddingCachePath(model: string, dimension: number): string {
  const safeModel = model.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(CACHE_DIR, `${safeModel}-${dimension}.json`);
}

async function loadEmbeddingCache(
  model: string,
  dimension: number
): Promise<Record<string, number[]>> {
  const cachePath = getEmbeddingCachePath(model, dimension);

  try {
    const raw = await readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw) as EmbeddingCacheFile;
    if (
      parsed.version !== 1 ||
      parsed.model !== model ||
      parsed.dimension !== dimension
    ) {
      return {};
    }

    return parsed.entries ?? {};
  } catch {
    return {};
  }
}

async function saveEmbeddingCache(
  model: string,
  dimension: number,
  entries: Record<string, number[]>
): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = getEmbeddingCachePath(model, dimension);
  const payload: EmbeddingCacheFile = {
    version: 1,
    model,
    dimension,
    entries,
  };

  await writeFile(cachePath, JSON.stringify(payload), "utf8");
}

async function listSupportedFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listSupportedFiles(fullPath);
      }

      const extension = path.extname(entry.name).toLowerCase() as SupportedExtension;
      return SUPPORTED_EXTENSIONS.includes(extension) ? [fullPath] : [];
    })
  );

  return files.flat().sort();
}

function toTitleCaseFromFilename(filePath: string): string {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadMetadataForFile(filePath: string): Promise<DocumentMetadata> {
  const metadataPath = `${filePath}.json`;

  try {
    const raw = await readFile(metadataPath, "utf8");
    return JSON.parse(raw) as DocumentMetadata;
  } catch {
    return {};
  }
}

async function extractText(filePath: string): Promise<string> {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".pdf") {
    const buffer = await readFile(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (extension === ".docx") {
    const buffer = await readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return readFile(filePath, "utf8");
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isHeadingLine(line: string): boolean {
  return (
    /^ANNEX\s+\d+/i.test(line) ||
    /^PART\s+[IVXLC]+/i.test(line) ||
    /^APPENDIX\s+[IVXLC\d]+/i.test(line) ||
    /^ARTICLE\s+\d+[A-Z\-]*/i.test(line)
  );
}

function buildSections(text: string): Array<{
  heading: string;
  pageStart?: number;
  content: string;
}> {
  const lines = text.split("\n").map((line) => line.trim());
  const sections: Array<{ heading: string; pageStart?: number; content: string }> = [];

  let currentHeading = "Document overview";
  let currentPage: number | undefined;
  let currentLines: string[] = [];

  const pushSection = () => {
    const content = currentLines.join("\n").trim();
    if (!content) {
      return;
    }

    sections.push({
      heading: currentHeading,
      pageStart: currentPage,
      content,
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line) {
      currentLines.push("");
      continue;
    }

    const pageMatch = line.match(/^--\s*(\d+)\s+of\s+\d+\s*--$/i);
    if (pageMatch) {
      currentPage = Number(pageMatch[1]);
      continue;
    }

    if (isHeadingLine(line)) {
      pushSection();

      const nextLine = lines[index + 1]?.trim();
      if (
        nextLine &&
        nextLine.length < 120 &&
        !isHeadingLine(nextLine) &&
        !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(nextLine)
      ) {
        currentHeading = `${line} - ${nextLine}`;
        index += 1;
      } else {
        currentHeading = line;
      }

      currentLines = [currentHeading];
      continue;
    }

    currentLines.push(line);
  }

  pushSection();

  return sections;
}

function splitLargeSection(
  section: { heading: string; pageStart?: number; content: string },
  documentTitle: string,
  metadata: DocumentMetadata,
  filePath: string
): ChunkRecord[] {
  const paragraphs = section.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: ChunkRecord[] = [];
  let current = "";

  const relativePath = path.relative(process.cwd(), filePath);

  const pushChunk = (value: string) => {
    const text = value.trim();
    if (!text) {
      return;
    }

    const id = createChunkId(relativePath, section.heading, text);

    chunks.push({
      id,
      text,
      documentTitle,
      locator: section.heading,
      sourcePath: relativePath,
      pageStart: section.pageStart,
      sourceUrl: metadata.sourceUrl,
      country: metadata.country,
      jurisdiction: metadata.jurisdiction,
      language: metadata.language ?? "en",
      documentType: metadata.documentType ?? "compliance-document",
    });
  };

  const splitOversizedText = (value: string): string[] => {
    const text = value.trim();
    if (!text) {
      return [];
    }

    if (text.length <= TARGET_CHUNK_SIZE) {
      return [text];
    }

    const step = Math.max(1, TARGET_CHUNK_SIZE - CHUNK_OVERLAP);
    const parts: string[] = [];

    for (let start = 0; start < text.length; start += step) {
      const part = text.slice(start, start + TARGET_CHUNK_SIZE).trim();
      if (part) {
        parts.push(part);
      }
      if (start + TARGET_CHUNK_SIZE >= text.length) {
        break;
      }
    }

    return parts;
  };

  const flushOversizedText = (value: string) => {
    const parts = splitOversizedText(value);
    if (parts.length === 0) {
      current = "";
      return;
    }

    parts.slice(0, -1).forEach((part) => pushChunk(part));
    current = parts.at(-1) ?? "";
  };

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= TARGET_CHUNK_SIZE) {
      current = next;
      continue;
    }

    if (current) {
      pushChunk(current);
      const overlap = current.slice(Math.max(0, current.length - CHUNK_OVERLAP)).trim();
      const rebuilt = overlap ? `${overlap}\n\n${paragraph}` : paragraph;
      if (rebuilt.length <= TARGET_CHUNK_SIZE) {
        current = rebuilt;
      } else {
        flushOversizedText(rebuilt);
      }
    } else {
      flushOversizedText(paragraph);
    }
  }

  if (current) {
    pushChunk(current);
  }

  return chunks;
}

async function buildChunksForFile(filePath: string): Promise<ChunkRecord[]> {
  const rawText = await extractText(filePath);
  const metadata = await loadMetadataForFile(filePath);
  const documentTitle = metadata.title ?? toTitleCaseFromFilename(filePath);
  const normalized = normalizeText(rawText);
  const sections = buildSections(normalized);

  return sections.flatMap((section) =>
    splitLargeSection(section, documentTitle, metadata, filePath)
  );
}

async function embedBatch(texts: string[], dimension: number): Promise<number[][]> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireEnv("VOYAGE_API_KEY")}`,
    },
    body: JSON.stringify({
      input: texts,
      model: getEmbeddingModel(),
      input_type: "document",
      output_dimension: dimension,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage embedding failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding: number[] }>;
  };

  return (data.data ?? []).map((item) => item.embedding);
}

async function createPoints(chunks: ChunkRecord[], dimension: number): Promise<QdrantPoint[]> {
  const model = getEmbeddingModel();
  const embeddingCache = await loadEmbeddingCache(model, dimension);
  const points: QdrantPoint[] = [];

  for (let index = 0; index < chunks.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(index, index + EMBEDDING_BATCH_SIZE);
    const vectors: Array<number[] | undefined> = new Array(batch.length);
    const missingChunks: ChunkRecord[] = [];
    const missingIndexes: number[] = [];

    batch.forEach((chunk, batchIndex) => {
      const cached = embeddingCache[chunk.id];
      if (cached) {
        vectors[batchIndex] = cached;
      } else {
        missingChunks.push(chunk);
        missingIndexes.push(batchIndex);
      }
    });

    if (missingChunks.length > 0) {
      const freshVectors = await embedBatch(
        missingChunks.map((chunk) => chunk.text),
        dimension
      );

      if (freshVectors.length !== missingChunks.length) {
        throw new Error(
          `Voyage embedding returned ${freshVectors.length} vector(s) for ${missingChunks.length} chunk(s)`
        );
      }

      missingIndexes.forEach((batchIndex, freshIndex) => {
        const vector = freshVectors[freshIndex];
        const chunk = batch[batchIndex];

        if (!chunk) {
          throw new Error(`Missing chunk for embedding batch index ${batchIndex}`);
        }

        if (!vector) {
          throw new Error(
            `Voyage embedding response omitted a vector for chunk ${chunk.id}`
          );
        }

        if (vector.length !== dimension) {
          throw new Error(
            `Voyage embedding for chunk ${chunk.id} had dimension ${vector.length}; expected ${dimension}`
          );
        }

        vectors[batchIndex] = vector;
        embeddingCache[chunk.id] = vector;
      });

      await saveEmbeddingCache(model, dimension, embeddingCache);
    }

    batch.forEach((chunk, batchIndex) => {
      const vector = vectors[batchIndex];
      if (!vector) {
        throw new Error(`Missing embedding vector for chunk ${chunk.id}`);
      }

      points.push({
        id: chunk.id,
        vector,
        payload: {
          text: chunk.text,
          document_title: chunk.documentTitle,
          article_or_section: chunk.locator,
          source_path: chunk.sourcePath,
          source_url: chunk.sourceUrl,
          country: chunk.country,
          jurisdiction: chunk.jurisdiction,
          language: chunk.language,
          document_type: chunk.documentType,
          page_start: chunk.pageStart,
        },
      });
    });

    console.log(
      `Prepared embedding batch ${Math.floor(index / EMBEDDING_BATCH_SIZE) + 1} (${points.length}/${chunks.length} chunks)`
    );
  }

  return points;
}

async function deletePointsForSources(sourcePaths: string[]): Promise<void> {
  const qdrantUrl = requireEnv("COMPLIANCE_AI_QDRANT_URL").replace(/\/$/, "");
  const qdrantCollection = requireEnv("COMPLIANCE_AI_QDRANT_COLLECTION");
  const qdrantApiKey = requireEnv("COMPLIANCE_AI_QDRANT_API_KEY");

  for (const sourcePath of sourcePaths) {
    const response = await fetch(
      `${qdrantUrl}/collections/${qdrantCollection}/points/delete?wait=true`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": qdrantApiKey,
        },
        body: JSON.stringify({
          filter: {
            must: [{ key: "source_path", match: { value: sourcePath } }],
          },
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Qdrant delete failed for source ${sourcePath}: ${response.status} ${body}`
      );
    }

    console.log(`Removed existing points for ${sourcePath}`);
  }
}

async function upsertPoints(points: QdrantPoint[]): Promise<void> {
  const qdrantUrl = requireEnv("COMPLIANCE_AI_QDRANT_URL").replace(/\/$/, "");
  const qdrantCollection = requireEnv("COMPLIANCE_AI_QDRANT_COLLECTION");
  const qdrantApiKey = requireEnv("COMPLIANCE_AI_QDRANT_API_KEY");
  const sourcePaths = [...new Set(points.map((point) => point.payload.source_path))]
    .filter((sourcePath): sourcePath is string => typeof sourcePath === "string");

  if (sourcePaths.length > 0) {
    await deletePointsForSources(sourcePaths);
  }

  for (let index = 0; index < points.length; index += UPSERT_BATCH_SIZE) {
    const batch = points.slice(index, index + UPSERT_BATCH_SIZE);
    const response = await fetch(
      `${qdrantUrl}/collections/${qdrantCollection}/points?wait=true`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "api-key": qdrantApiKey,
        },
        body: JSON.stringify({ points: batch }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Qdrant upsert failed: ${response.status} ${body}`);
    }

    console.log(
      `Upserted batch ${Math.floor(index / UPSERT_BATCH_SIZE) + 1} (${Math.min(index + batch.length, points.length)}/${points.length} points)`
    );
  }
}

async function main() {
  const { inputDir, dryRun } = parseArgs();
  const dimension = Number(process.env.COMPLIANCE_AI_EMBEDDING_DIMENSION ?? "512");

  const files = await listSupportedFiles(inputDir);
  if (files.length === 0) {
    throw new Error(`No supported documents found in ${inputDir}`);
  }

  console.log(`Found ${files.length} compliance document(s) in ${inputDir}`);

  const allChunks: ChunkRecord[] = [];
  for (const filePath of files) {
    const chunks = await buildChunksForFile(filePath);
    console.log(
      `Prepared ${chunks.length} chunk(s) from ${path.relative(process.cwd(), filePath)}`
    );
    allChunks.push(...chunks);
  }

  if (allChunks.length === 0) {
    throw new Error("No chunks were generated from the input documents.");
  }

  console.log(`Prepared ${allChunks.length} total chunk(s)`);

  if (dryRun) {
    console.log("Dry run complete. No embeddings were created and nothing was uploaded.");
    return;
  }

  const points = await createPoints(allChunks, dimension);
  await upsertPoints(points);

  console.log(
    `Finished ingesting ${files.length} document(s) and ${points.length} point(s) into Qdrant.`
  );
}

main().catch((error) => {
  console.error("Compliance ingestion failed:", error);
  process.exit(1);
});
