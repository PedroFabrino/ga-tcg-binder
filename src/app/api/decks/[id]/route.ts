import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { decks, deckCards, cards, cardEditions } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { serializeOmnidexText } from "@/services/omnidex";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDefaultUserAndSeed();
    const deck = await db.select().from(decks).where(eq(decks.id, params.id)).get();

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const cardsInDeck = await db
      .select({
        id: deckCards.id,
        cardSlug: deckCards.cardSlug,
        zone: deckCards.zone,
        quantity: deckCards.quantity,
        assignedEditionId: deckCards.assignedEditionId,
        cardName: cards.name,
        element: cards.element,
        class: cards.class,
        type: cards.type,
        costReserve: cards.costReserve,
        costMemory: cards.costMemory,
      })
      .from(deckCards)
      .leftJoin(cards, eq(deckCards.cardSlug, cards.slug))
      .where(eq(deckCards.deckId, params.id));

    const deckSlugs = Array.from(new Set(cardsInDeck.map((c) => c.cardSlug)));
    let deckEditions: { id: string; cardSlug: string; imageUrl: string }[] = [];
    if (deckSlugs.length > 0) {
      deckEditions = await db
        .select({
          id: cardEditions.id,
          cardSlug: cardEditions.cardSlug,
          imageUrl: cardEditions.imageUrl,
        })
        .from(cardEditions)
        .where(inArray(cardEditions.cardSlug, deckSlugs));
    }

    const cardsWithImages = cardsInDeck.map((c) => {
      const ed = c.assignedEditionId
        ? deckEditions.find((e) => e.id === c.assignedEditionId)
        : deckEditions.find((e) => e.cardSlug === c.cardSlug);
      return {
        ...c,
        imageUrl: ed?.imageUrl || null,
      };
    });

    const material = cardsWithImages.filter((c) => c.zone === "material");
    const main = cardsWithImages.filter((c) => c.zone === "main");
    const side = cardsWithImages.filter((c) => c.zone === "side");

    const omnidexText = serializeOmnidexText({
      material: material.map((c) => ({ name: c.cardName || c.cardSlug, quantity: c.quantity })),
      main: main.map((c) => ({ name: c.cardName || c.cardSlug, quantity: c.quantity })),
      side: side.map((c) => ({ name: c.cardName || c.cardSlug, quantity: c.quantity })),
    });

    return NextResponse.json({
      deck,
      cards: {
        material,
        main,
        side,
      },
      omnidexText,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { name, champion, format, cardUpdates } = body;

    const updateData: any = { updatedAt: sql`(strftime('%s', 'now'))` };
    if (name) updateData.name = name;
    if (champion !== undefined) updateData.champion = champion;
    if (format) updateData.format = format;

    await db.update(decks).set(updateData).where(eq(decks.id, params.id));

    // Optional card add/update
    if (cardUpdates && Array.isArray(cardUpdates)) {
      for (const cu of cardUpdates) {
        if (cu.action === "add") {
          const id = `dc-${params.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await db.insert(deckCards).values({
            id,
            deckId: params.id,
            cardSlug: cu.cardSlug,
            zone: cu.zone || "main",
            quantity: cu.quantity || 1,
            assignedEditionId: cu.assignedEditionId,
          });
        } else if (cu.action === "delete" && cu.deckCardId) {
          await db.delete(deckCards).where(eq(deckCards.id, cu.deckCardId));
        } else if (cu.action === "update" && cu.deckCardId) {
          await db
            .update(deckCards)
            .set({
              quantity: cu.quantity,
              assignedEditionId: cu.assignedEditionId !== undefined ? cu.assignedEditionId : undefined,
            })
            .where(eq(deckCards.id, cu.deckCardId));
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.delete(deckCards).where(eq(deckCards.deckId, params.id));
    await db.delete(decks).where(eq(decks.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
