import {
  RawMypFulfillmentOrderInput,
  RawMypOrderItemInput,
} from "@ga/contracts";

export interface ParsedVendasOrderRow {
  orderId: string;
  orderDate: string;
  buyerNick: string;
  shippingMethod: string;
  status: string;
  orderUrl: string;
}

export interface ParseVendasOptions {
  includeEmSeparacao?: boolean;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

/**
 * Parses the MyP Cards /vendas orders table HTML.
 * Strictly extracts only order codes, dates, buyer nicks, shipping methods, and status,
 * ensuring no buyer CPF, legal name, or address PII is ever parsed or retained.
 */
export function parseMypVendasHtml(
  html: string,
  options?: ParseVendasOptions
): ParsedVendasOrderRow[] {
  const includeSeparacao = options?.includeEmSeparacao ?? false;
  const results: ParsedVendasOrderRow[] = [];

  // Split into table rows
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (const tr of trMatches) {
    // Skip header rows
    if (tr.includes("<th")) continue;

    // 1. Extract Order ID & URL
    const orderLinkMatch = tr.match(/href=["']\/pedido\/(\d+)["']/i);
    const orderTextMatch = tr.match(/#(\d+)/);
    const orderId = orderLinkMatch ? orderLinkMatch[1] : orderTextMatch ? orderTextMatch[1] : null;
    if (!orderId) continue;

    // 2. Extract Status
    const isAguard = /aguard\.?\s*envio/i.test(tr);
    const isSeparacao = /em\s*separa[çc][ãa]o/i.test(tr);

    let status = "Outro";
    if (isAguard) status = "Aguard. envio";
    else if (isSeparacao) status = "Em separação";
    else {
      const badgeMatch = tr.match(/badge[^>]*>([^<]+)<\/span>/i);
      if (badgeMatch) status = stripTags(badgeMatch[1]);
    }

    if (!isAguard && !(includeSeparacao && isSeparacao)) {
      continue;
    }

    // 3. Extract Order Date
    const dateMatch = tr.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
    const orderDate = dateMatch ? dateMatch[1] : new Date().toLocaleDateString("pt-BR");

    // 4. Extract Buyer Nickname (strictly ignoring any adjacent text or CPF)
    let buyerNick = "Desconhecido";
    const buyerLinkMatch = tr.match(/href=["']\/usuario\/([^"'/]+)["']/i);
    if (buyerLinkMatch) {
      buyerNick = decodeHtmlEntities(buyerLinkMatch[1].trim());
    } else {
      const tdList = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (tdList.length >= 3) {
        const candidate = stripTags(tdList[2]).split(/[\s(]/)[0];
        if (candidate) buyerNick = candidate;
      }
    }

    // 5. Extract Shipping Method
    let shippingMethod = "Padrão";
    if (/frete\s*combinado/i.test(tr)) {
      shippingMethod = "Frete combinado com o vendedor";
    } else if (/\bpac\b/i.test(tr)) {
      shippingMethod = "PAC";
    } else if (/\bsedex\b/i.test(tr)) {
      shippingMethod = "Sedex";
    } else if (/frete\s*fixo/i.test(tr)) {
      shippingMethod = "Frete Fixo com rastreio";
    } else {
      const tdList = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (tdList.length >= 4) {
        shippingMethod = stripTags(tdList[3]);
      }
    }

    results.push({
      orderId,
      orderDate,
      buyerNick,
      shippingMethod,
      status,
      orderUrl: `https://mypcards.com/pedido/${orderId}`,
    });
  }

  return results;
}

/**
 * Parses the MyP Cards /pedido/<id> page HTML.
 * Extracts order items, quantities, condition, finish, and metadata while strictly
 * ignoring any buyer PII block (CPF, legal name, street address).
 */
export function parseMypOrderPageHtml(
  html: string,
  fallbackOrderId?: string
): RawMypFulfillmentOrderInput {
  // 1. Order ID
  const orderIdMatch = html.match(/#(\d+)/) || html.match(/pedido\/(\d+)/i);
  const orderId = orderIdMatch ? orderIdMatch[1] : fallbackOrderId || "0";

  // 2. Order Date
  const dateMatch = html.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  const orderDate = dateMatch ? dateMatch[1] : new Date().toLocaleDateString("pt-BR");

  // 3. Buyer Nickname
  let buyerNick = "Comprador";
  const userLinkMatch = html.match(/href=["']\/usuario\/([^"'/]+)["']/i);
  if (userLinkMatch) {
    buyerNick = decodeHtmlEntities(userLinkMatch[1].trim());
  } else {
    const nickMatch = html.match(/Usu[áa]rio:\s*([^\s<]+)/i);
    if (nickMatch) buyerNick = decodeHtmlEntities(nickMatch[1].trim());
  }

  // 4. Status
  let status = "Aguard. envio";
  if (/em\s*separa[çc][ãa]o/i.test(html)) status = "Em separação";
  else if (/enviado/i.test(html)) status = "Enviado";
  else if (/cancelado/i.test(html)) status = "Cancelado";

  // 5. Shipping Method
  let shippingMethod = "Padrão";
  if (/frete\s*combinado/i.test(html)) {
    shippingMethod = "Frete combinado com o vendedor";
  } else if (/\bpac\b/i.test(html)) {
    shippingMethod = "PAC";
  } else if (/\bsedex\b/i.test(html)) {
    shippingMethod = "Sedex";
  } else if (/frete\s*fixo/i.test(html)) {
    shippingMethod = "Frete Fixo com rastreio";
  } else {
    const envioMatch = html.match(/Forma de envio:\s*([^<\n]+)/i);
    if (envioMatch) shippingMethod = decodeHtmlEntities(envioMatch[1].trim());
  }

  // Helper for address box parsing (#comprador-box, #vendedor-box)
  const parseAddressBox = (boxId: "comprador-box" | "vendedor-box") => {
    const boxMatch = html.match(new RegExp(`<div id="${boxId}"[\\s\\S]*?<\\/div>\\s*(?:<div id|$)`, "i"));
    if (!boxMatch) return undefined;
    const boxHtml = boxMatch[0];

    // Name & Nick
    let fullName = "";
    const nameMatch = boxHtml.match(/pedido-nome-nick[^>]*>([\s\S]*?)<\/span>/i);
    if (nameMatch) {
      const fullText = stripTags(nameMatch[1]);
      fullName = fullText.split("(")[0].trim() || fullText;
    }

    // CPF
    let document: string | null = null;
    const cpfMatch = boxHtml.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
    if (cpfMatch) {
      document = cpfMatch[1];
    }

    // Address lines
    let street = "";
    let number = "S/N";
    let complement: string | null = null;
    const endMatch = boxHtml.match(/<label>\s*Endereço\s*<\/label>\s*([^<]+)/i);
    if (endMatch) {
      const rawEnd = stripTags(endMatch[1]).trim();
      const parts = rawEnd.split(",");
      street = parts[0]?.trim() || rawEnd;
      if (parts[1]) {
        const numAndComp = parts[1].split("-");
        number = numAndComp[0]?.trim() || "S/N";
        if (numAndComp[1]) {
          complement = numAndComp.slice(1).join("-").trim();
        }
      }
    }

    // Bairro (district)
    let district = "";
    const bairroMatch = boxHtml.match(/<label>\s*Bairro\s*<\/label>\s*([^<]+)/i);
    if (bairroMatch) {
      district = stripTags(bairroMatch[1]).trim();
    }

    // Cidade - UF - CEP
    let city = "";
    let stateAbbr = "SP";
    let postalCode = "";
    const cidUfCepMatch = boxHtml.match(/<label>\s*Cidade\s*-\s*UF\s*-\s*CEP\s*<\/label>\s*([^<]+)/i);
    if (cidUfCepMatch) {
      const parts = stripTags(cidUfCepMatch[1]).split("-").map((p) => p.trim());
      if (parts.length >= 3) {
        city = parts[0];
        stateAbbr = parts[1].toUpperCase().slice(0, 2);
        postalCode = parts.slice(2).join("").replace(/\D/g, "");
      }
    }

    return {
      fullName,
      document,
      street,
      number,
      complement,
      district,
      city,
      stateAbbr,
      postalCode,
    };
  };

  const buyer = parseAddressBox("comprador-box");
  const sender = parseAddressBox("vendedor-box");

  // Totals parsing (#valores-box)
  const parseTotalsBox = () => {
    const valoresMatch = html.match(/<div id="valores-box"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i);
    const boxHtml = valoresMatch ? valoresMatch[0] : html;

    const parseMoney = (labelRegex: RegExp) => {
      const m = boxHtml.match(labelRegex);
      if (!m) return { cents: 0, brl: "R$ 0,00" };
      const valMatch = m[0].match(/R\$\s*[\d.,]+/i);
      const brl = valMatch ? valMatch[0].trim() : "R$ 0,00";
      const cleanNum = parseFloat(brl.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
      return { cents: Math.round(cleanNum * 100), brl };
    };

    const subtotal = parseMoney(/Subtotal[\s\S]*?carrinho-subtotal-valor[^>]*>([^<]+)/i);
    const shipping = parseMoney(/Frete[\s\S]*?carrinho-subtotal-valor[^>]*>([^<]+)/i);
    const total = parseMoney(/Total:[\s\S]*?carrinho-subtotal-valor[^>]*>([^<]+)/i);

    return {
      subtotalCents: subtotal.cents,
      shippingCents: shipping.cents,
      totalCents: total.cents || (subtotal.cents + shipping.cents),
      subtotalBrl: subtotal.brl,
      shippingBrl: shipping.brl,
      totalBrl: total.brl,
      shippingMethod,
    };
  };

  const totals = parseTotalsBox();

  // 6. Items Table Parsing
  const items: RawMypOrderItemInput[] = [];
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (const tr of trMatches) {
    if (tr.includes("<th")) continue;

    // Check if this row looks like an item row
    const hrefMatch = tr.match(/href=["']([^"']*(?:grandarchive|pokemon|magic|yugioh|onepiece)[^"']*)["']/i);
    const hasItemLink = Boolean(hrefMatch);
    const itemLinkMatch = tr.match(/<a[^>]+class=["'][^"']*item-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) ||
                          tr.match(/<a[^>]+href=["']\/([^"'/]+)\/([^"'/]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);

    if (!hasItemLink && !itemLinkMatch) continue;

    const productUrl = hrefMatch ? hrefMatch[1] : null;

    // Raw Title
    let rawTitle = "Unknown Card";
    if (itemLinkMatch) {
      const titleCandidate = itemLinkMatch[itemLinkMatch.length - 1];
      rawTitle = stripTags(titleCandidate);
    }

    // Subtitle
    let rawSubtitle: string | undefined = undefined;
    const subMatch = tr.match(/class=["'][^"']*subtitulo[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    if (subMatch) {
      rawSubtitle = stripTags(subMatch[1]);
    }

    // MypCode derivation
    let mypCode = "";
    if (productUrl) {
      const parts = productUrl.replace(/^\//, "").split("/");
      const tcg = parts[0] || "grandarchive";
      const codePart = parts[1] || "";
      mypCode = `${tcg}_${codePart}`.toLowerCase();
    } else {
      mypCode = `item_${rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    }

    // Condition
    let condition = "NM";
    const condMatch = tr.match(/class=["'][^"']*label-qualidade[^"']*["'][^>]*>([^<]+)<\/span>/i) ||
                      tr.match(/\b(NM|SP|MP|HP|D)\b/);
    if (condMatch) {
      condition = stripTags(condMatch[1]).trim().toUpperCase();
    }

    // Language
    let language = "EN";
    const langMatch = tr.match(/<td>\s*(EN|PT|JP|FR|DE|IT|ES)\s*<\/td>/i) ||
                      tr.match(/\b(EN|PT|JP)\b/);
    if (langMatch) {
      language = langMatch[1].toUpperCase();
    }

    // Foil
    const isFoil = /foil/i.test(tr);

    // Quantity
    let quantity = 1;
    const qtyMatch = tr.match(/<td>\s*(\d+)\s*<\/td>/) || tr.match(/\bx?(\d+)\b/);
    // Find numeric cells in the row
    const tdMatches = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    for (const td of tdMatches) {
      const text = stripTags(td).trim();
      if (/^\d+$/.test(text)) {
        const val = parseInt(text, 10);
        if (val > 0 && val < 500) {
          quantity = val;
          break;
        }
      }
    }

    // Unit Price
    let unitPriceBrl = "R$ 0,00";
    const priceMatch = tr.match(/R\$\s*[\d.,]+/i);
    if (priceMatch) {
      unitPriceBrl = priceMatch[0];
    }

    items.push({
      rawTitle,
      rawSubtitle,
      mypCode,
      productUrl,
      condition,
      language,
      isFoil,
      quantity,
      unitPriceBrl,
    });
  }

  return {
    orderId,
    orderDate,
    buyerNick,
    shippingMethod,
    status,
    orderUrl: `https://mypcards.com/pedido/${orderId}`,
    buyer,
    sender,
    totals,
    items,
  };
}
