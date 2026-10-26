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
});
