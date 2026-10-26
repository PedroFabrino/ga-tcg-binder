import type { RootBotApi } from "../root-bot-api";

function parseAddArgs(args: string[]): {
  cardName: string;
  quantity?: number;
  foil?: boolean;
} {
  let quantity: number | undefined;
  let foil: boolean | undefined;
  const nameParts: string[] = [];

  for (const part of args) {
    const lower = part.toLowerCase();
    if (lower === "foil") {
      foil = true;
      continue;
    }
    if (lower === "non-foil" || lower === "normal") {
      foil = false;
      continue;
    }
    const matchQty = /^x?(\d+)$/i.exec(part);
    if (matchQty && !quantity) {
      quantity = parseInt(matchQty[1], 10);
      continue;
    }
    nameParts.push(part);
  }

  return {
    cardName: nameParts.join(" ").trim(),
    quantity,
    foil,
  };
}

export async function handleWantlistCommand(
  argString: string,
  userId: string,
  client: RootBotApi
): Promise<string> {
  const parts = argString.split(/\s+/).filter(Boolean);
  const subCommand = parts[0]?.toLowerCase();

  // 1. /wantlist add-omnidex <url>
  if (subCommand === "add-omnidex") {
    const url = parts.slice(1).join(" ").trim();
    if (!url) {
      return (
        "⚠️ **Usage:** `/wantlist add-omnidex <url>`\n" +
        "Provide an Omnidex.gg or Silvie.gg URL to import only missing card shortage gaps into your wishlist."
      );
    }

    const res = await client.addWant(userId, { omnidexUrl: url });
    const stats = res.omnidexStats;
    if (!stats) {
      return "⚠️ No cards were added from the provided Omnidex deck.";
    }

    return (
      `🎉 **Omnidex Shortages Imported to Personal Wants!**\n` +
      `• Added **${stats.addedCardsCount}** unique cards (**${stats.addedCopiesCount}** total copies missing)\n` +
      `• **${stats.skippedCopiesCount}** copies already owned in your idle collection (skipped)`
    );
  }

  // 2. /wantlist add <card> [qty] [foil]
  if (subCommand === "add") {
    const { cardName, quantity, foil } = parseAddArgs(parts.slice(1));
    if (!cardName) {
      return (
        "⚠️ **Usage:** `/wantlist add <card_name> [quantity] [foil]`\n" +
        "Examples:\n" +
        "• `/wantlist add Fireball 2`\n" +
        "• `/wantlist add Flame Wave foil`"
      );
    }

    const res = await client.addWant(userId, {
      card: cardName,
      quantity,
      foil,
    });

    if (res.suggestions && res.suggestions.length > 0) {
      const suggestionsText = res.suggestions
        .slice(0, 5)
        .map((s) => `• **${s.name}** — \`/wantlist add ${s.name}\``)
        .join("\n");
      return (
        `🔍 **Multiple cards matched "${cardName}":**\n` +
        `Pick one of the matching cards:\n` +
        suggestionsText
      );
    }

    if (res.card) {
      const foilText = res.foil ? " (★ Foil)" : "";
      return `✅ Added **${res.card.name}** x${res.desiredQuantity || 1}${foilText} to your personal wishlist!`;
    }

    return `⚠️ Could not add "${cardName}" to your wishlist.`;
  }

  // 3. /wantlist remove <card> [qty]
  if (subCommand === "remove") {
    const restArgs = parts.slice(1);
    const { cardName, quantity } = parseAddArgs(restArgs);

    if (!cardName) {
      const wantsRes = await client.getPersonalWants(userId);
      if (wantsRes.personalWants.length === 0) {
        return "⚠️ Your personal wishlist is currently empty.";
      }

      const rows = wantsRes.personalWants
        .slice(0, 10)
        .map(
          (w) =>
            `• **${w.cardName}** (Wanted: ${w.desiredQuantity}${
              w.foil ? " ★ Foil" : ""
            }) — \`/wantlist remove ${w.cardName}\``
        )
        .join("\n");
      return (
        `📋 **Your Personal Wishlist Cards:**\n` +
        `Specify which card to remove with \`/wantlist remove <card_name>\`:\n` +
        rows
      );
    }

    const res = await client.removeWant(userId, { card: cardName, quantity });

    if (res.suggestions && res.suggestions.length > 0) {
      const suggestionsText = res.suggestions
        .slice(0, 5)
        .map(
          (s) =>
            `• **${s.name}** (Wanted: ${s.quantity}) — \`/wantlist remove ${s.name}\``
        )
        .join("\n");
      return (
        `🔍 **Multiple wishlist cards matched "${cardName}":**\n` +
        suggestionsText
      );
    }

    if (res.removed) {
      return `🗑️ Removed **${res.cardName}** from your personal wishlist.`;
    }

    if (res.success) {
      return `📉 Decremented **${res.cardName}**. Remaining wanted: **${res.remainingQuantity}**.`;
    }

    return `⚠️ **${cardName}** is not in your personal wishlist.`;
  }

  // 4. Default: /wantlist view [deck] or /wantlist [deck]
  const deckFilter = subCommand === "view" ? parts.slice(1).join(" ").trim() : argString.trim();
  const wantlist = await client.getWantlist(userId, deckFilter || undefined);

  if (wantlist.decks.length === 0 && (!wantlist.personalWants || wantlist.personalWants.length === 0)) {
    return (
      "📋 **Wantlist**\n" +
      "Zero shortages detected across your active decks and personal wishlist!\n" +
      "Add wants with `/wantlist add <card>` or import deck gap with `/wantlist add-omnidex <url>`."
    );
  }

  const lines = [
    `### 📋 **${wantlist.collectorName || "Collector"}'s Wantlist**`,
    `Totals: **${wantlist.grandTotalHard}** Hard Shortages (🔴) | **${wantlist.grandTotalShared}** Shared Shortages (🟡)\n`,
  ];

  if (wantlist.decks.length > 0) {
    for (const group of wantlist.decks) {
      lines.push(`**${group.deckName}** (${group.totalShortages} shortages):`);
      for (const h of group.hardShortages) {
        lines.push(`- 🔴 **${h.cardName}** x${h.missingQuantity}`);
      }
      for (const s of group.sharedShortages) {
        lines.push(`- 🟡 **${s.cardName}** x${s.sharedQuantity}`);
      }
      lines.push("");
    }
  }

  if (wantlist.personalWants && wantlist.personalWants.length > 0) {
    lines.push(`**Personal Wishlist (${wantlist.personalWants.length} items):**`);
    for (const w of wantlist.personalWants) {
      const foilText = w.foil ? " ★ Foil" : "";
      lines.push(`- 📌 **${w.cardName}** x${w.desiredQuantity}${foilText}`);
    }
  }

  return lines.join("\n");
}
