import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import {
  getUndeliveredNotifications,
} from "@/db/repositories/notification-delivery-repository";
import { getMarketStoreById } from "@/db/repositories/marketplace-repository";
import {
  formatMarketNotificationChunks,
  groupMarketNotificationsByStore,
} from "@/services/market-notification-message";

export async function GET(request: Request) {
  const caller = await authenticateRootBot(request);
  if (!caller) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid Root bot install token" },
      { status: 401 }
    );
  }

  const destination = `root:${caller.communityId}`;
  const pending = await getUndeliveredNotifications(destination);

  if (pending.length === 0) {
    return NextResponse.json({ chunks: [] });
  }

  const byStore = groupMarketNotificationsByStore(pending);
  const chunks: Array<{
    storeId: string;
    storeName: string;
    content: string;
    notificationIds: string[];
  }> = [];

  for (const [storeId, notifications] of byStore) {
    const store = await getMarketStoreById(storeId);
    const storeName = store?.name ?? storeId;
    const lastSyncDate = store?.lastFullScanAt ?? null;
    const storeUrl = store?.baseUrl ?? null;

    for (const chunk of formatMarketNotificationChunks(
      notifications,
      storeName,
      lastSyncDate,
      undefined,
      storeUrl
    )) {
      chunks.push({
        storeId,
        storeName,
        content: chunk.content,
        notificationIds: chunk.notificationIds,
      });
    }
  }

  return NextResponse.json({ chunks });
}
