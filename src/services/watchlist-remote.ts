import { parseMypHtml, type ParsedMypItem } from "./marketplace";

/**
 * Fetches the user's public Quero / Watchlist from MyP Cards with /usuario/load-more pagination.
 */
export async function fetchPublicQueroList(
  mypUsername: string,
  fetchFn: typeof fetch = fetch
): Promise<ParsedMypItem[]> {
  if (!mypUsername) return [];
  const cleanUser = mypUsername.replace(/^@/, "").trim();
  const page1Url = `https://mypcards.com/${encodeURIComponent(cleanUser)}/grandarchive?ProdutoSearch%5BexibirSomenteCompra%5D=1`;

  const parsedItems: ParsedMypItem[] = [];

  try {
    const res = await fetchFn(page1Url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    parsedItems.push(...parseMypHtml(html));

    // Paginate via /usuario/load-more
    let page = 2;
    const maxPages = 20;
    while (page <= maxPages) {
      const moreUrl = `https://mypcards.com/usuario/load-more?nick=${encodeURIComponent(
        cleanUser
      )}&marca=grandarchive&exibirSomenteCompra=1&page=${page}`;
      try {
        const moreRes = await fetchFn(moreUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });
        if (!moreRes.ok) break;
        const moreText = await moreRes.text();
        const json = JSON.parse(moreText);
        if (!json || !json.success || !json.html) break;
        const pageItems = parseMypHtml(json.html);
        if (pageItems.length === 0) break;
        parsedItems.push(...pageItems);
        page++;
      } catch {
        break;
      }
    }

    return parsedItems;
  } catch (err) {
    console.error("Failed to fetch public MyP Quero list:", err);
    return [];
  }
}

/**
 * Discovers unfiltered product catalog items for a card name on MyP Cards.
 * Used when a Standard Playable Printing is currently out of stock (0 copies for sale).
 */
export async function discoverMypProductPrintings(
  cardName: string,
  fetchFn: typeof fetch = fetch
): Promise<ParsedMypItem[]> {
  if (!cardName) return [];
  const url = `https://mypcards.com/grandarchive?ProdutoSearch%5Bnome%5D=${encodeURIComponent(cardName.trim())}`;

  try {
    const res = await fetchFn(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseMypHtml(html);
  } catch (err) {
    console.error(`Failed to discover MyP product printings for ${cardName}:`, err);
    return [];
  }
}
