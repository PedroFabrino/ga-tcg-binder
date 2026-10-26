import React from "react";
import { describe, expect, it, vi } from "vitest";
import ReactDOMServer from "react-dom/server";
import { WantlistCard } from "../components/WantlistCard";
import type { IAssistantRpcClient } from "../types";

describe("WantlistCard", () => {
  it("renders null when unlinked", () => {
    const mockClient = {} as IAssistantRpcClient;
    const html = ReactDOMServer.renderToStaticMarkup(
      <WantlistCard isLinked={false} client={mockClient} />
    );
    expect(html).toBe("");
  });

  it("renders wishlist UI with autocomplete search and import forms when linked", () => {
    const mockClient = {
      getPersonalWants: vi.fn().mockResolvedValue({
        wants: [
          {
            cardSlug: "fireball",
            cardName: "Fireball",
            desiredQuantity: 2,
            foil: true,
          },
        ],
      }),
    } as unknown as IAssistantRpcClient;

    const html = ReactDOMServer.renderToStaticMarkup(
      <WantlistCard isLinked={true} client={mockClient} />
    );

    expect(html).toContain("Personal Wishlist &amp; Wants");
    expect(html).toContain("Add Card to Wishlist (with Autocomplete)");
    expect(html).toContain("Import Omnidex Shortage Gap");
    expect(html).toContain("Prefer Foil");
  });
});
