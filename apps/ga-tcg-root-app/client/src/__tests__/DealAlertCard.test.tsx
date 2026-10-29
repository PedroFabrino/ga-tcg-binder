import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DealAlertCard } from "../components/DealAlertCard";

describe("DealAlertCard", () => {
  it("renders disabled state when notifications are off", () => {
    const html = renderToStaticMarkup(
      <DealAlertCard
        isLinked={true}
        notificationsEnabled={false}
        dealAlertMode="all"
        alertChannelId=""
        onUpdatePreferences={vi.fn()}
      />
    );

    expect(html).toContain("Market Deal Alerts");
    expect(html).toContain("All Shortages");
    expect(html).toContain("Hard Shortages Only");
    expect(html).not.toContain("#deal-alerts");
  });

  it("renders channel link when notifications are active and channel is present", () => {
    const html = renderToStaticMarkup(
      <DealAlertCard
        isLinked={true}
        notificationsEnabled={true}
        dealAlertMode="hard"
        alertChannelId="chan-123"
        onUpdatePreferences={vi.fn()}
      />
    );

    expect(html).toContain("#deal-alerts");
    expect(html).toContain("root://channel/chan-123");
  });

  it("renders Portuguese translations when locale is pt-BR", () => {
    const html = renderToStaticMarkup(
      <DealAlertCard
        isLinked={true}
        notificationsEnabled={false}
        dealAlertMode="all"
        alertChannelId=""
        onUpdatePreferences={vi.fn()}
        locale="pt-BR"
      />
    );

    expect(html).toContain("Alertas de Ofertas de Mercado");
    expect(html).toContain("Todas as Cartas Necessárias");
    expect(html).toContain("Apenas Compra Necessária");
  });
});
