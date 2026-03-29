import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AfcftaAiAssistant } from "@/components/compliance/afcfta-ai-assistant";
import messages from "@/messages/en.json";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AfcftaAiAssistant", () => {
  it("renders the assistant scaffold and sample actions", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AfcftaAiAssistant />
      </NextIntlClientProvider>
    );

    expect(
      screen.getByText("Ask AI about AfCFTA compliance")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ask ai/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Does AfCFTA automatically make this product duty free today?"
      )
    ).toBeInTheDocument();
  });

  it("aborts the in-flight request when unmounted", async () => {
    const user = userEvent.setup();
    let capturedSignal: AbortSignal | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn((_input: string | URL | Request, init?: RequestInit) => {
        capturedSignal = init?.signal as AbortSignal | undefined;
        return new Promise<Response>(() => {
          // Keep the request pending so unmount cleanup can abort it.
        });
      })
    );

    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AfcftaAiAssistant />
      </NextIntlClientProvider>
    );

    await user.type(screen.getByRole("textbox"), "What documentation is needed for AfCFTA exports?");
    await user.click(screen.getByRole("button", { name: /ask ai/i }));

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });
});
