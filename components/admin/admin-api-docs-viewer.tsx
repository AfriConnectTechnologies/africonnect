"use client";

import { useEffect, useRef, useState } from "react";

type SwaggerUiConfig = {
  url: string;
  domNode: Element;
  deepLinking?: boolean;
  displayRequestDuration?: boolean;
  defaultModelsExpandDepth?: number;
  docExpansion?: "list" | "full" | "none";
  presets?: unknown[];
  layout?: string;
};

type SwaggerUiBundle = ((config: SwaggerUiConfig) => void) & {
  presets: {
    apis: unknown;
  };
};

declare global {
  interface Window {
    SwaggerUIBundle?: SwaggerUiBundle;
    SwaggerUIStandalonePreset?: unknown;
  }
}

function ensureStylesheet(href: string) {
  if (document.querySelector(`link[data-admin-docs="${href}"]`)) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-admin-docs", href);
  document.head.appendChild(link);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-admin-docs="${src}"]`);
    if (existing) {
      if ((existing as HTMLScriptElement).dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-admin-docs", src);
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
      once: true,
    });
    document.body.appendChild(script);
  });
}

export function AdminApiDocsViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        ensureStylesheet("https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui.min.css");
        await loadScript("https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-bundle.min.js");
        await loadScript(
          "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.min.js"
        );

        if (cancelled || !containerRef.current) {
          return;
        }

        if (!window.SwaggerUIBundle) {
          throw new Error("Swagger UI bundle is unavailable.");
        }

        window.SwaggerUIBundle({
          url: `/api/admin/docs/openapi?v=${Date.now()}`,
          domNode: containerRef.current,
          deepLinking: true,
          displayRequestDuration: true,
          defaultModelsExpandDepth: -1,
          docExpansion: "list",
          presets: [
            window.SwaggerUIBundle.presets.apis,
            window.SwaggerUIStandalonePreset,
          ],
          layout: "StandaloneLayout",
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load API documentation.");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error} Open the protected YAML directly at <code>/api/admin/docs/openapi</code> if needed.
      </div>
    );
  }

  return (
    <div
      className="min-h-[900px] overflow-hidden rounded-xl border bg-background [&_.topbar]:hidden"
      ref={containerRef}
    />
  );
}
