import { eq } from "drizzle-orm";
import { cards, cardEditions, cardHashes } from "../db/schema";
import type { CardMatchResult } from "../lib/scanner/contracts";
import { hamming, visualSimilarity } from "../lib/scanner/phash";
import { isOcrNoise, parseFooter, type FooterParse } from "../lib/scanner/ocr-parse";
import { compositeConfidence, trigramSimilarity } from "../lib/scanner/scoring";

export interface IdentifyInput {
  phash: string;
  headerText: string;
  footerText: string;
}

const VISUAL_POOL = 20;
const BOOST_RANK = 5;
const RESULT_COUNT = 5;

interface Row {
  editionId: string;
  cardSlug: string;
  cardName: string;
  setPrefix: string;
  collectorNumber: string;
  imageUrl: string;
  phash: string;
}

const sameNumber = (a: string, b: string) => parseInt(a, 10) === parseInt(b, 10);

function footerSignals(row: Row, footer: FooterParse) {
  if (!footer.collectorNumber) return { collectorMatch: false, numScore: null as number | null };
  const numberMatch = sameNumber(footer.collectorNumber, row.collectorNumber);
  const setMatch = !footer.setCode || row.setPrefix.toUpperCase().startsWith(footer.setCode);
  const collectorMatch = numberMatch && setMatch;
  return { collectorMatch, numScore: collectorMatch ? 1 : numberMatch ? 0.8 : 0 };
}

/** Stage 5: hybrid visual + OCR lookup. Returns the top 5 candidates by composite confidence. */
export async function identifyCard(input: IdentifyInput, database: any): Promise<CardMatchResult[]> {
  const rows: Row[] = await database
    .select({
      editionId: cardEditions.id,
      cardSlug: cardEditions.cardSlug,
      cardName: cards.name,
      setPrefix: cardEditions.setPrefix,
      collectorNumber: cardEditions.collectorNumber,
      imageUrl: cardEditions.imageUrl,
      phash: cardHashes.phash,
    })
    .from(cardHashes)
    .innerJoin(cardEditions, eq(cardHashes.editionId, cardEditions.id))
    .innerJoin(cards, eq(cardEditions.cardSlug, cards.slug));

  const ranked = rows
    .map((row) => ({ row, distance: hamming(input.phash, row.phash) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, VISUAL_POOL);

  const ocrOk = !isOcrNoise(input.headerText);
  const footer = parseFooter(input.footerText);

  return ranked
    .map(({ row }, rank) => {
      const sVisual = visualSimilarity(input.phash, row.phash);
      const { collectorMatch, numScore } = footerSignals(row, footer);
      const nameScore = trigramSimilarity(input.headerText, row.cardName);
      const sOcr = ocrOk ? (numScore === null ? nameScore : 0.5 * nameScore + 0.5 * numScore) : null;
      const { confidence, ocrFallback } = compositeConfidence({
        sVisual,
        sOcr,
        ocrOk,
        collectorMatch: collectorMatch && rank < BOOST_RANK,
      });
      return {
        editionId: row.editionId,
        cardSlug: row.cardSlug,
        cardName: row.cardName,
        setPrefix: row.setPrefix,
        collectorNumber: row.collectorNumber,
        imageUrl: row.imageUrl,
        confidence,
        sVisual,
        sOcr,
        signals: { collectorMatch, ocrFallback },
      };
    })
    .filter((c) => c.confidence >= 60)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, RESULT_COUNT);
}
