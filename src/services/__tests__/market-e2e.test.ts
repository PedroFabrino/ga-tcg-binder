import { describe, expect, it, vi } from "vitest";

import { createTestDb } from "../../db/test-utils";
import * as schema from "../../db/schema";
import { checkMarketStores } from "../market-check";
import { syncLigaStore } from "../ligastore-sync";
import { writeMarketNotifications } from "../market-notifications";
import {
  getPendingNotifications,
  markNotificationsSent,
  getMarketStoreById,
} from "../../db/repositories/marketplace-repository";
import { formatMarketNotificationMessage } from "../market-notification-formatter";

describe("Market Change Detection and Notification Flow (E2E)", () => {
  it("executes the full cycle from detection to outbox notification and formatting", async () => {
    const { db } = await createTestDb();

    // 1. Seed LigaStore with existing lastLatestCardRefId
    await db.update(schema.marketStores).set({ enabled: false });

    await db.insert(schema.marketStores).values({
      id: "brandao",
      platform: "liga_store",
      name: "Brandão Card Game",
      baseUrl: "https://www.brandaocardgame.com.br",
      tcgId: "21",
      enabled: true,
      lastCount: 1,
      lastLatestCardRefId: "old-ref",
      lastNotifiedAt: null,
    });

    // Seed catalog data for resolution
    await db.insert(schema.cards).values([
      {
        slug: "flame-rune-swordsman",
        name: "Flame-Rune Swordsman",
        element: "FIRE",
        class: "WARRIOR",
        type: "ALLY",
      },
    ]);

    await db.insert(schema.cardEditions).values([
      {
        id: "doa-136",
        cardSlug: "flame-rune-swordsman",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "136",
        rarity: 1,
        imageUrl: "https://example.com/card.jpg",
      },
    ]);

    // 2. Mock HTTP responses
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      // Latest-card check (txt_order=12)
      if (url.includes("txt_order=12")) {
        return {
          ok: true,
          text: async () => `
            <div class="card-item">
              <a href="?view=ecom/item&refid=new-ref">Flame-Rune Swordsman (#136)</a>
            </div>
          `,
        };
      }

      // Search page & count check (txt_order=6)
      if (url.includes("txt_order=6") || url.includes("view=ecom/itens")) {
        return {
          ok: true,
          text: async () => `
            <table><tr><td class="textoMaior"> 1-30 de <b>1</b></td></tr></table>
            <div class="card-item">
              <div class="title">
                <a href="https://www.brandaocardgame.com.br/?view=ecom/item&refid=new-ref">
                  Flame-Rune Swordsman (#136)
                </a>
              </div>
              <div class="card-preco">R$ 14,00</div>
            </div>
          `,
        };
      }

      return {
        ok: true,
        text: async () => "",
      };
    });

    // 3. Step 1: Run checkMarketStores -> verify change detected via latest-card
    const checkReport = await checkMarketStores(db, mockFetch as any);
    const storeResult = checkReport.stores.find((s) => s.storeId === "brandao");
    expect(storeResult).toBeDefined();
    expect(storeResult?.changed).toBe(true);
    expect(storeResult?.latestCardChanged).toBe(true);
    expect(storeResult?.latestCardRefId).toBe("new-ref");

    // 4. Step 2: Run syncLigaStore -> syncs cards into marketCards
    const syncStats = await syncLigaStore({
      storeId: "brandao",
      database: db,
      customFetch: mockFetch as any,
    });
    expect(syncStats.totalSynced).toBe(1);
    expect(syncStats.matchedCount).toBe(1);

    // 5. Step 3: Run writeMarketNotifications -> writes new card to outbox
    const notificationsCount = await writeMarketNotifications("brandao", db);
    expect(notificationsCount).toBe(1);

    // 6. Step 4: Verify outbox contains pending notification
    const pendingNotifications = await getPendingNotifications(db);
    expect(pendingNotifications).toHaveLength(1);

    const notification = pendingNotifications[0];
    expect(notification.storeId).toBe("brandao");
    expect(notification.cardName).toBe("Flame-Rune Swordsman");
    expect(notification.setPrefix).toBe("DOA");
    expect(notification.collectorNumber).toBe("136");
    expect(notification.price).toBe("R$ 14,00");
    expect(notification.refId).toBe("new-ref");
    expect(notification.sentAt).toBeNull();

    // 7. Step 5: Format notification message
    const store = await getMarketStoreById("brandao", db);
    const message = formatMarketNotificationMessage(
      pendingNotifications,
      store!.name,
      store?.lastFullScanAt,
      store?.baseUrl
    );
    expect(message).toContain(`**[Brandão Card Game](<${store?.baseUrl}>)** updated their stock!`);
    expect(message).toContain(
      "• [Flame-Rune Swordsman](<https://www.brandaocardgame.com.br/?view=ecom/item&refid=new-ref>) — DOA 136 — R$ 14,00"
    );

    // 8. Step 6: Mark sent and verify outbox is cleared
    await markNotificationsSent([notification.id], "msg-root-test-001", new Date(), db);

    const remainingPending = await getPendingNotifications(db);
    expect(remainingPending).toHaveLength(0);
  });
});
