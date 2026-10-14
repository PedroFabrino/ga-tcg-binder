export interface ParsedDeckCard {
  name: string;
  quantity: number;
  collectorCode?: string; // Optional e.g. "DOA 1st 001"
}

export interface ParsedDecklist {
  main: ParsedDeckCard[];
  material: ParsedDeckCard[];
  side: ParsedDeckCard[];
  champion?: string;
}

export function parseOmnidexText(rawText: string): ParsedDecklist {
  const result: ParsedDecklist = {
    main: [],
    material: [],
    side: [],
  };

  let currentZone: "main" | "material" | "side" = "main";
  const lines = rawText.split(/\r?\n/);

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Detect zone headers
    const lower = line.toLowerCase();
    if (lower.startsWith("# material") || lower.startsWith("// material") || lower === "material" || lower === "material deck") {
      currentZone = "material";
      continue;
    }
    if (lower.startsWith("# main") || lower.startsWith("// main") || lower === "main" || lower === "main deck") {
      currentZone = "main";
      continue;
    }
    if (lower.startsWith("# sideboard") || lower.startsWith("# side") || lower.startsWith("// side") || lower === "sideboard" || lower === "side") {
      currentZone = "side";
      continue;
    }

    // Skip general comments
    if (line.startsWith("#") || line.startsWith("//")) {
      continue;
    }

    // Match lines like:
    // "4 Fracturize"
    // "4x Fracturize"
    // "1 Rayne, Sword of Light (DOA 1st 001)"
    // "1x Rayne, Sword of Light [DOA 1st]"
    const match = line.match(/^(\d+)[xX]?\s+(.+)$/);
    if (match) {
      const quantity = parseInt(match[1], 10);
      let cardName = match[2].trim();
      let collectorCode: string | undefined = undefined;

      // Extract collector code if in brackets or parens
      const codeMatch = cardName.match(/[\(\[]([A-Za-z0-9\s\-]+)[\)\]]$/);
      if (codeMatch) {
        collectorCode = codeMatch[1].trim();
        cardName = cardName.replace(/[\(\[][A-Za-z0-9\s\-]+[\)\]]$/, "").trim();
      }

      result[currentZone].push({
        name: cardName,
        quantity,
        collectorCode,
      });

      // If champion is not set and this is in material deck with level or champion type, can infer
      if (!result.champion && currentZone === "material") {
        result.champion = cardName;
      }
    }
  }

  return result;
}

export function serializeOmnidexText(deck: {
  material: { name: string; quantity: number }[];
  main: { name: string; quantity: number }[];
  side: { name: string; quantity: number }[];
}): string {
  const sections: string[] = [];

  if (deck.material.length > 0) {
    sections.push("# Material Deck");
    for (const card of deck.material) {
      sections.push(`${card.quantity} ${card.name}`);
    }
    sections.push("");
  }

  if (deck.main.length > 0) {
    sections.push("# Main Deck");
    for (const card of deck.main) {
      sections.push(`${card.quantity} ${card.name}`);
    }
    sections.push("");
  }

  if (deck.side.length > 0) {
    sections.push("# Sideboard");
    for (const card of deck.side) {
      sections.push(`${card.quantity} ${card.name}`);
    }
  }

  return sections.join("\n").trim();
}
