import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { decks, deckCards, cards } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed, migrateDefaultUserDataToUser } from "@/services/seed";
import { parseOmnidexText } from "@/services/omnidex";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || session?.user?.id || DEFAULT_USER_ID;

    if (userId !== DEFAULT_USER_ID) {
      await migrateDefaultUserDataToUser(userId, db);
    }

    const userDecks = await db
      .select()
      .from(decks)
      .where(eq(decks.userId, userId));

    const result = [];
    for (const d of userDecks) {
      const allCards = await db
        .select({
          zone: deckCards.zone,
          quantity: deckCards.quantity,
        })
        .from(deckCards)
        .where(eq(deckCards.deckId, d.id));

      const mainCount = allCards
        .filter((c) => c.zone === "main")
        .reduce((sum, c) => sum + c.quantity, 0);
      const materialCount = allCards
        .filter((c) => c.zone === "material")
        .reduce((sum, c) => sum + c.quantity, 0);
      const sideCount = allCards
        .filter((c) => c.zone === "side")
        .reduce((sum, c) => sum + c.quantity, 0);

      result.push({
        ...d,
        mainCount,
        materialCount,
        sideCount,
        totalCards: mainCount + materialCount + sideCount,
      });
    }

    return NextResponse.json({ decks: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const body = await req.json();
    const userId = body.userId || session?.user?.id || DEFAULT_USER_ID;
    const name = body.name?.trim();
    const champion = body.champion?.trim() || "";
    const format = body.format || "standard";
    const omnidexText = body.omnidexText;

    if (!name) {
      return NextResponse.json({ error: "Deck name is required" }, { status: 400 });
    }

    const deckId = `deck-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await db.insert(decks).values({
      id: deckId,
      userId,
      name,
      champion,
      format,
    });

    // If Omnidex text provided, parse and insert cards
    if (omnidexText && typeof omnidexText === "string") {
      const parsed = parseOmnidexText(omnidexText);
      const zones: ("material" | "main" | "side")[] = ["material", "main", "side"];
      const cardsToInsert = [];
      let idx = 1;

      for (const zone of zones) {
        for (const item of parsed[zone]) {
          let slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          const matchCard = await db
            .select()
            .from(cards)
            .where(sql`lower(${cards.name}) = lower(${item.name})`)
            .get();

          if (matchCard) {
            slug = matchCard.slug;
          } else {
            await db
              .insert(cards)
              .values({
                slug,
                name: item.name,
                element: "NORM",
                class: "ALL",
                type: "UNKNOWN",
                subtypes: "[]",
              })
              .onConflictDoNothing();
          }

          cardsToInsert.push({
            id: `dc-${deckId}-${idx++}`,
            deckId,
            cardSlug: slug,
            zone,
            quantity: item.quantity,
          });
        }
      }

      if (cardsToInsert.length > 0) {
        await db.insert(deckCards).values(cardsToInsert);
      }
    }

    return NextResponse.json({ id: deckId, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
