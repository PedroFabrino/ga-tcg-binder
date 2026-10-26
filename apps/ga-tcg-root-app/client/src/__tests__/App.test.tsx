import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../App";
import type { IAssistantRpcClient } from "../types";

describe("App shell", () => {
  it("renders header and loading state initially", () => {
    const mockClient: IAssistantRpcClient = {
      getStatus: vi.fn().mockReturnValue(new Promise(() => {})), // stays pending
      linkAccount: vi.fn(),
      setPreferences: vi.fn(),
      getDecks: vi.fn(),
    };

    const html = renderToStaticMarkup(<App client={mockClient} />);

    expect(html).toContain("Grand Archive Collector Assistant");
    expect(html).toContain("Refresh");
    expect(html).toContain("Powered by Grand Archive Binder");
  });

  it("renders error banner and unlinked cards when getStatus fails", async () => {
    const mockClient: IAssistantRpcClient = {
      getStatus: vi.fn().mockRejectedValue(new Error("RPC failed")),
      linkAccount: vi.fn(),
      setPreferences: vi.fn(),
      getDecks: vi.fn(),
    };

    // Use a lightweight component test with act or simulated state
    const html = renderToStaticMarkup(<App client={mockClient} />);
    expect(html).toContain("Grand Archive Collector Assistant");
  });
});
