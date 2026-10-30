import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdvisorMessageText } from "../AdvisorMessageText";
import { CardHoverProvider } from "@/components/CardHoverPreview";

vi.stubGlobal("React", React);

describe("AdvisorMessageText", () => {
  it("renders card references as CardPreviewTrigger elements while preserving headers and bold text", () => {
    const markdown = [
      "### Strategic Overview",
      "We recommend adding *Angelic Channeling* and **Fractal of Insight** to your list.",
      "* **Floating Memory:** A key mechanic.",
      "- Fast speed: *Spark Link* is an excellent response.",
    ].join("\n");

    const html = renderToStaticMarkup(
      <CardHoverProvider>
        <AdvisorMessageText content={markdown} />
      </CardHoverProvider>
    );

    expect(html).toContain("Strategic Overview");
    expect(html).not.toContain("### Strategic Overview");
    expect(html).toContain("Angelic Channeling");
    expect(html).toContain("Fractal of Insight");
    expect(html).toContain("Spark Link");
    expect(html).toContain("Floating Memory:");
  });

  it("handles complex bullet lists with bold card names, tiers, and inline code", () => {
    const markdown = [
      "### 3. Supporting Kingslayer",
      "* **Shattered Hope (Tier 1):** While it's a Water spell, it is a **Merlin Bonus** card.",
      "- Fast speed `Norm` card with *Spark Link* synergy.",
    ].join("\n");

    const html = renderToStaticMarkup(
      <CardHoverProvider>
        <AdvisorMessageText content={markdown} />
      </CardHoverProvider>
    );

    expect(html).toContain("3. Supporting Kingslayer");
    expect(html).not.toContain("### 3. Supporting Kingslayer");
    expect(html).toContain("Shattered Hope");
    expect(html).toContain("(Tier 1):");
    expect(html).toContain("Merlin Bonus");
    expect(html).toContain("<code");
    expect(html).toContain("Norm");
    expect(html).toContain("Spark Link");
  });
});
