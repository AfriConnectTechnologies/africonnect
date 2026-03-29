import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { hasAdminDocsAccess } from "@/lib/admin-docs";

export const runtime = "nodejs";

const DOCS: Record<
  string,
  {
    relativePath: string;
    contentType: string;
    fileName: string;
  }
> = {
  openapi: {
    relativePath: "docs/openapi/openapi.merged.yaml",
    contentType: "application/yaml; charset=utf-8",
    fileName: "openapi.merged.yaml",
  },
  "audit-package": {
    relativePath: "docs/audit/API_SECURITY_AUDIT_PACKAGE.md",
    contentType: "text/markdown; charset=utf-8",
    fileName: "API_SECURITY_AUDIT_PACKAGE.md",
  },
  "request-response": {
    relativePath: "docs/audit/REQUEST_RESPONSE_FILE.md",
    contentType: "text/markdown; charset=utf-8",
    fileName: "REQUEST_RESPONSE_FILE.md",
  },
  "endpoint-inventory": {
    relativePath: "docs/audit/ENDPOINT_INVENTORY.md",
    contentType: "text/markdown; charset=utf-8",
    fileName: "ENDPOINT_INVENTORY.md",
  },
  "rbac-integrations": {
    relativePath: "docs/audit/RBAC_AND_INTEGRATIONS.md",
    contentType: "text/markdown; charset=utf-8",
    fileName: "RBAC_AND_INTEGRATIONS.md",
  },
};

function privateHeaders(contentType: string, fileName: string): HeadersInit {
  return {
    "Content-Type": contentType,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${fileName}"`,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ doc: string }> }
) {
  const allowed = await hasAdminDocsAccess();
  if (!allowed) {
    return NextResponse.json(
      { error: "Admin access required" },
      {
        status: 403,
        headers: privateHeaders("application/json; charset=utf-8", "error.json"),
      }
    );
  }

  const { doc } = await context.params;
  const target = DOCS[doc];
  if (!target) {
    return NextResponse.json(
      { error: "Document not found" },
      {
        status: 404,
        headers: privateHeaders("application/json; charset=utf-8", "error.json"),
      }
    );
  }

  try {
    const filePath = path.join(process.cwd(), target.relativePath);
    const content = await fs.readFile(filePath, "utf8");
    return new NextResponse(content, {
      headers: privateHeaders(target.contentType, target.fileName),
    });
  } catch {
    return NextResponse.json(
      { error: "Document unavailable" },
      {
        status: 500,
        headers: privateHeaders("application/json; charset=utf-8", "error.json"),
      }
    );
  }
}
