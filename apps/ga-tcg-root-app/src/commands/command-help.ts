export function handleHelpCommand(): string {
  return (
    `### ⚔️ **Grand Archive Assistant Commands**\n\n` +
    `**Account & Onboarding:**\n` +
    `• \`/register\` — Create a Grand Archive Binder account directly using your Root profile\n` +
    `• \`/link <code>\` — Link an existing account using the 6-character code from Settings\n\n` +
    `**Decks & Constructed Shortages:**\n` +
    `• \`/decks\` — List your active decks and completion percentages\n` +
    `• \`/decks add <url>\` — Import an Omnidex.gg / Silvie.gg deck directly\n` +
    `• \`/shortages [deck]\` — View itemized Hard (🔴) and Shared (🟡) card shortages\n\n` +
    `**Portfolio & Collection:**\n` +
    `• \`/collection\` — View your Binder portfolio dashboard (cards, foils, elements)\n` +
    `• \`/collection <card>\` — Search your personal collection for specific card printings\n\n` +
    `**Wantlist & Deal Alerts:**\n` +
    `• \`/wantlist\` — View aggregate wantlist of deck shortages & personal wants\n` +
    `• \`/wantlist add <card> [qty] [foil]\` — Add card to personal wishlist (with autocomplete suggestions)\n` +
    `• \`/wantlist remove <card> [qty]\` — Remove or decrement card from personal wishlist\n` +
    `• \`/wantlist add-omnidex <url>\` — Import missing deck shortage gap into wishlist\n` +
    `• \`/notify on [all|hard]\` — Enable private deal alert notifications\n` +
    `• \`/notify off\` — Disable deal alert notifications`
  );
}
