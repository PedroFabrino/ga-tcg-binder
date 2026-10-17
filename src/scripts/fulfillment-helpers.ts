import {
  FulfillmentReport,
  RawMypFulfillmentOrderInput,
  RawMypOrderItemInput,
} from "@ga/contracts";

/**
 * Formats a clean clipboard-ready text summary of the Fulfillment Report.
 * Groups by Element for the Pick List, followed by Buyer Packs with sub-grouped orders.
 */
export function formatFulfillmentTextReport(report: FulfillmentReport): string {
  const lines: string[] = [];
  lines.push("=== GRAND ARCHIVE TCG - PICK LIST (POR ELEMENTO) ===");
  lines.push(
    `Total: ${report.totalGrandArchiveOrders} pedidos · ${report.totalGrandArchiveCopies} cartas`
  );
  lines.push("");

  for (const [element, entries] of Object.entries(report.pickListByElement)) {
    if (!entries || entries.length === 0) continue;
    lines.push(`[${element.toUpperCase()}] (${entries.reduce((s, e) => s + e.totalQuantity, 0)} cartas):`);
    for (const entry of entries) {
      const foilTag = entry.isFoil ? " [FOIL]" : "";
      const colNum = entry.collectorNumber ? ` #${entry.collectorNumber}` : "";
      const refs = entry.orderReferences
        .map((r) => `#${r.orderId} (x${r.quantity})`)
        .join(", ");
      lines.push(
        `  [ ] ${entry.cardName} [${entry.setPrefix}${colNum} · ${entry.condition}]${foilTag} x${entry.totalQuantity} (Pedidos: ${refs})`
      );
    }
    lines.push("");
  }

  if (report.nonGrandArchiveOrders.length > 0) {
    lines.push("=== PEDIDOS DE OUTROS TCGS ===");
    for (const o of report.nonGrandArchiveOrders) {
      lines.push(
        `  (!) Pedido #${o.orderId} (${o.buyerNick}) - ${o.detectedTcg.toUpperCase()} (${o.itemCount} itens): ${o.orderUrl}`
      );
    }
    lines.push("");
  }

  lines.push("=== BUYER PACKS (POR COMPRADOR E PEDIDO) ===");
  for (const buyer of report.buyerPacks) {
    const multiTag = buyer.totalOrders > 1 ? " [ENVIAR JUNTOS]" : "";
    lines.push(
      `👤 ${buyer.buyerNick} — ${buyer.totalOrders} pedido(s) · Envio: ${buyer.primaryShippingMethod}${multiTag}`
    );
    for (const order of buyer.orders) {
      lines.push(`  Pedido #${order.orderId} (${order.shippingMethod}):`);
      for (const item of order.items) {
        const foilTag = item.isFoil ? " [FOIL]" : "";
        const colNum = item.collectorNumber ? ` #${item.collectorNumber}` : "";
        lines.push(
          `    [ ] ${item.cardName} [${item.setPrefix}${colNum} · ${item.condition}]${foilTag} x${item.quantity}`
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Extracts order items from a DOM document without retaining buyer PII.
 */
export function extractOrderFromDom(
  doc: Document | { querySelector: any; querySelectorAll: any },
  fallbackOrderId: string
): RawMypFulfillmentOrderInput {
  // Order ID
  const titleEl = doc.querySelector("h1, .page-title, .pedido-titulo");
  const titleText = titleEl ? titleEl.textContent || "" : "";
  const idMatch = titleText.match(/#(\d+)/);
  const orderId = idMatch ? idMatch[1] : fallbackOrderId;

  // Order Date
  const bodyText = doc.querySelector("body, .container, .pedido-view")?.textContent || "";
  const dateMatch = bodyText.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  const orderDate = dateMatch ? dateMatch[1] : new Date().toLocaleDateString("pt-BR");

  // Buyer Nick
  let buyerNick = "Comprador";
  const userLink = doc.querySelector('a[href*="/usuario/"]');
  if (userLink && userLink.getAttribute("href")) {
    const href = userLink.getAttribute("href") || "";
    const m = href.match(/\/usuario\/([^/?#]+)/);
    if (m) buyerNick = decodeURIComponent(m[1].trim());
  }

  // Shipping Method
  let shippingMethod = "Padrão";
  if (/frete\s*combinado/i.test(bodyText)) {
    shippingMethod = "Frete combinado com o vendedor";
  } else if (/\bpac\b/i.test(bodyText)) {
    shippingMethod = "PAC";
  } else if (/\bsedex\b/i.test(bodyText)) {
    shippingMethod = "Sedex";
  } else if (/frete\s*fixo/i.test(bodyText)) {
    shippingMethod = "Frete Fixo com rastreio";
  }

  // Items
  const items: RawMypOrderItemInput[] = [];
  const rows = doc.querySelectorAll("table tr, .item-row");

  rows.forEach((tr: any) => {
    const link = tr.querySelector('a[href*="/grandarchive/"], a[href*="/pokemon/"], a[href*="/magic/"], .item-link');
    if (!link) return;

    const href = link.getAttribute("href") || "";
    const rawTitle = (link.textContent || "").trim() || "Unknown Card";

    const subEl = tr.querySelector(".subtitulo, .card-edicao");
    const rawSubtitle = subEl ? (subEl.textContent || "").trim() : undefined;

    let mypCode = "";
    if (href) {
      const parts = href.replace(/^\//, "").split("/");
      mypCode = `${parts[0] || "ga"}_${parts[1] || ""}`.toLowerCase();
    } else {
      mypCode = `item_${rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    }

    const trText = tr.textContent || "";
    const isFoil = /foil/i.test(trText);

    let condition = "NM";
    const condMatch = trText.match(/\b(NM|SP|MP|HP|D)\b/);
    if (condMatch) condition = condMatch[1].toUpperCase();

    let language = "EN";
    const langMatch = trText.match(/\b(EN|PT|JP)\b/);
    if (langMatch) language = langMatch[1].toUpperCase();

    let quantity = 1;
    const cells = tr.querySelectorAll("td");
    for (let c = 0; c < cells.length; c++) {
      const t = (cells[c].textContent || "").trim();
      if (/^\d+$/.test(t)) {
        const val = parseInt(t, 10);
        if (val > 0 && val < 500) {
          quantity = val;
          break;
        }
      }
    }

    let unitPriceBrl = "R$ 0,00";
    const priceMatch = trText.match(/R\$\s*[\d.,]+/i);
    if (priceMatch) unitPriceBrl = priceMatch[0];

    items.push({
      rawTitle,
      rawSubtitle,
      mypCode,
      productUrl: href,
      condition,
      language,
      isFoil,
      quantity,
      unitPriceBrl,
    });
  });

  return {
    orderId,
    orderDate,
    buyerNick,
    shippingMethod,
    status: "Aguard. envio",
    orderUrl: `https://mypcards.com/pedido/${orderId}`,
    items,
  };
}
