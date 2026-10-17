import { parseMypHtml, type ParsedMypItem } from "./marketplace";

/**
 * Fetches the user's public Quero / Watchlist from MyP Cards.
 */
export async function fetchPublicQueroList(
  mypUsername: string,
  fetchFn: typeof fetch = fetch
): Promise<ParsedMypItem[]> {
  if (!mypUsername) return [];
  const cleanUser = mypUsername.replace(/^@/, "").trim();
  const url = `https://mypcards.com/${encodeURIComponent(cleanUser)}/grandarchive?ProdutoSearch%5BexibirSomenteCompra%5D=1`;

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
    console.error("Failed to fetch public MyP Quero list:", err);
    return [];
  }
}
