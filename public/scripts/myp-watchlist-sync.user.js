// ==UserScript==
// @name         Grand Archive TCG - MyP Watchlist Auto-Sync & Fulfillment Bridge
// @namespace    https://github.com/PedroFabrino/ga-tcg-binder
// @version      1.4.0
// @description  Auditable bridge for Grand Archive TCG: syncs deck shortages with your MyPCards.com Quero list, and provides an on-page fulfillment pick list & buyer pack assistant for pending orders on /vendas.
// @author       Grand Archive TCG Collector
// @match        https://mypcards.com/*
// @match        https://www.mypcards.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const HASH_PREFIX = "#ga_watchlist_sync=";
  const APP_URL_PREFIX = "#ga_app_url=";
  const DEFAULT_APP_URL = "https://ga-tcg-binder-7dnicdb0m-fabrinos-projects.vercel.app";
  const rawHash = window.location.hash || "";

  if (rawHash.startsWith(APP_URL_PREFIX)) {
    try {
      const passedUrl = decodeURIComponent(rawHash.slice(APP_URL_PREFIX.length));
      if (passedUrl.startsWith("http")) {
        localStorage.setItem("ga_app_url", passedUrl);
      }
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
    } catch (e) {
      // ignore
    }
  }

  if (rawHash.startsWith(HASH_PREFIX)) {
    initWatchlistSync(rawHash);
    return;
  }

  if (window.location.pathname.includes("/vendas")) {
    initVendasFulfillment();
  }

  // =========================================================================
  // 1. WATCHLIST SYNC BRIDGE
  // =========================================================================

  function initWatchlistSync(hash) {
    let payload;
    try {
      const jsonStr = decodeURIComponent(hash.slice(HASH_PREFIX.length));
      payload = JSON.parse(jsonStr);
    } catch (err) {
      console.error("[GA Watchlist Bridge] Failed to parse sync hash payload:", err);
      alert("Grand Archive TCG Watchlist Sync Error: Malformed payload in URL hash.");
      return;
    }

    const {
      appUrl = "http://localhost:3000",
      userId,
      syncToken,
      pendingAdds = [],
      pendingUpdates = [],
      pendingRemoves = [],
    } = payload;

    if (!pendingAdds.length && !pendingUpdates.length && !pendingRemoves.length) {
      console.log("[GA Watchlist Bridge] No pending watchlist mutations found.");
      return;
    }

    function getCsrfToken() {
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      if (metaTag && metaTag.getAttribute("content")) {
        return metaTag.getAttribute("content");
      }
      const inputTag = document.querySelector('input[name="_csrf"]');
      if (inputTag && inputTag.value) {
        return inputTag.value;
      }
      return null;
    }

    function escapeHtml(str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    const backdrop = document.createElement("div");
    backdrop.id = "ga-sync-modal-backdrop";
    backdrop.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(10, 15, 29, 0.85);
      backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    const container = document.createElement("div");
    container.style.cssText = `
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 16px;
      width: 90%;
      max-width: 600px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      color: #f8fafc;
      overflow: hidden;
    `;

    let itemsHtml = "";
    if (pendingAdds.length) {
      itemsHtml += `
        <div style="margin-bottom: 14px;">
          <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #34d399; font-weight: 600;">+ Adicionar à Lista Quero (${pendingAdds.length})</h4>
          <div style="max-height: 120px; overflow-y: auto; background: #1e293b; border-radius: 8px; padding: 8px; font-size: 12px;">
            ${pendingAdds.map((item) => `
              <div style="padding: 4px 0; border-bottom: 1px solid #334155; display: flex; justify-content: space-between;">
                <span><strong>${escapeHtml(item.cardName)}</strong> (${escapeHtml(item.editionSlug)} #${escapeHtml(item.collectorNumber)})</span>
                <span style="color: #94a3b8;">${Number(item.targetQuantity) || 1}x @ R$ ${(Number(item.targetPriceBrl) || 1).toFixed(2).replace(".", ",")}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    if (pendingUpdates.length) {
      itemsHtml += `
        <div style="margin-bottom: 14px;">
          <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #fbbf24; font-weight: 600;">~ Atualizar Quantidade (${pendingUpdates.length})</h4>
          <div style="max-height: 120px; overflow-y: auto; background: #1e293b; border-radius: 8px; padding: 8px; font-size: 12px;">
            ${pendingUpdates.map((item) => `
              <div style="padding: 4px 0; border-bottom: 1px solid #334155; display: flex; justify-content: space-between;">
                <span><strong>${escapeHtml(item.cardName)}</strong> (${escapeHtml(item.editionSlug)})</span>
                <span style="color: #94a3b8;">Nova Qtd: ${Number(item.targetQuantity) || 1}x</span>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    if (pendingRemoves.length) {
      itemsHtml += `
        <div style="margin-bottom: 14px;">
          <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #f87171; font-weight: 600;">- Remover (Quotas Completas) (${pendingRemoves.length})</h4>
          <div style="max-height: 120px; overflow-y: auto; background: #1e293b; border-radius: 8px; padding: 8px; font-size: 12px;">
            ${pendingRemoves.map((item) => `
              <div style="padding: 4px 0; border-bottom: 1px solid #334155; display: flex; justify-content: space-between;">
                <span><strong>${escapeHtml(item.cardName)}</strong> (${escapeHtml(item.editionSlug)})</span>
                <span style="color: #94a3b8;">Comprada no Binder</span>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="padding: 16px 20px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">🛡️</span>
          <div>
            <h3 style="margin: 0; font-size: 15px; font-weight: 600;">Grand Archive TCG — Sincronização Quero</h3>
            <span style="font-size: 12px; color: #94a3b8;">Sessão autenticada ativa no MyPCards.com</span>
          </div>
        </div>
        <button id="ga-modal-close" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 4px;">&times;</button>
      </div>

      <div style="padding: 20px; overflow-y: auto; flex: 1;">
        <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #cbd5e1;">
          O Grand Archive TCG Binder identificou alterações na sua demanda de cartas (Cartas Necessárias / Faltantes).
          Confirme abaixo para atualizar sua <strong>Lista Quero</strong> no MyP Cards.
        </p>
        ${itemsHtml}
        <div id="ga-sync-progress" style="margin-top: 14px; font-size: 12px; color: #38bdf8; min-height: 18px;"></div>
      </div>

      <div style="padding: 14px 20px; border-top: 1px solid #1e293b; background: #0b1120; display: flex; justify-content: flex-end; gap: 10px;">
        <button id="ga-btn-cancel" style="background: #334155; color: #f8fafc; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer;">Cancelar</button>
        <button id="ga-btn-confirm" style="background: #2563eb; color: #fff; border: none; border-radius: 8px; padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer;">Confirmar e Sincronizar</button>
      </div>
    `;

    backdrop.appendChild(container);
    document.body.appendChild(backdrop);

    const closeBtn = container.querySelector("#ga-modal-close");
    const cancelBtn = container.querySelector("#ga-btn-cancel");
    const confirmBtn = container.querySelector("#ga-btn-confirm");
    const progressEl = container.querySelector("#ga-sync-progress");

    const closeModal = () => {
      backdrop.remove();
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
    };

    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);

    confirmBtn.addEventListener("click", async () => {
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      confirmBtn.style.opacity = "0.5";
      confirmBtn.style.cursor = "not-allowed";

      const csrf = getCsrfToken();
      if (!csrf) {
        progressEl.innerText = "Erro: Token CSRF não encontrado. Certifique-se de estar logado.";
        progressEl.style.color = "#f87171";
        cancelBtn.disabled = false;
        return;
      }

      const confirmedAddIds = [];
      const confirmedUpdateIds = [];
      const confirmedRemoveIds = [];
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      try {
        for (let i = 0; i < pendingAdds.length; i++) {
          const item = pendingAdds[i];
          progressEl.innerText = `Adicionando (${i + 1}/${pendingAdds.length}): ${item.cardName}...`;
          await sleep(250);
          try {
            const resp = await fetch("/usuario/item-adicionar", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                _csrf: csrf,
                itemId: item.mypItemId,
                quantidade: String(Number(item.targetQuantity) || 1),
                preco: String(Number(item.targetPriceBrl) || 1).replace(".", ","),
                tipo: "C",
              }),
            });
            if (resp.ok) confirmedAddIds.push(item.id);
          } catch (e) {
            console.warn("[GA Watchlist Bridge] Item add warning:", e);
          }
        }

        for (let i = 0; i < pendingUpdates.length; i++) {
          const item = pendingUpdates[i];
          progressEl.innerText = `Atualizando (${i + 1}/${pendingUpdates.length}): ${item.cardName}...`;
          await sleep(250);
          try {
            const resp = await fetch("/usuario/item-editar", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                _csrf: csrf,
                id: item.mypUserItemId || item.mypItemId,
                quantidade: String(Number(item.targetQuantity) || 1),
                tipo: "C",
              }),
            });
            if (resp.ok) confirmedUpdateIds.push(item.id);
          } catch (e) {
            console.warn("[GA Watchlist Bridge] Item update warning:", e);
          }
        }

        for (let i = 0; i < pendingRemoves.length; i++) {
          const item = pendingRemoves[i];
          progressEl.innerText = `Removendo (${i + 1}/${pendingRemoves.length}): ${item.cardName}...`;
          await sleep(250);
          try {
            const resp = await fetch("/usuario/item-excluir", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                _csrf: csrf,
                itemId: item.mypItemId,
                tipo: "C",
              }),
            });
            if (resp.ok) confirmedRemoveIds.push(item.id);
          } catch (e) {
            console.warn("[GA Watchlist Bridge] Item remove warning:", e);
          }
        }

        progressEl.innerText = "Registrando confirmações no Grand Archive Binder...";
        await fetch(`${appUrl}/api/watchlist/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Watchlist-Sync-Token": syncToken || "",
          },
          body: JSON.stringify({
            userId,
            syncToken,
            confirmedAddIds,
            confirmedUpdateIds,
            confirmedRemoveIds,
          }),
        });

        progressEl.innerText = "Sincronização concluída com sucesso!";
        progressEl.style.color = "#34d399";
        await sleep(1000);

        backdrop.remove();
        history.replaceState(null, document.title, window.location.pathname + window.location.search);
        alert("Grand Archive TCG Watchlist: Lista Quero sincronizada com sucesso!");
      } catch (err) {
        console.error("[GA Watchlist Bridge] Execution error:", err);
        progressEl.innerText = "Ocorreu um erro durante a sincronização. Verifique o console.";
        progressEl.style.color = "#f87171";
        cancelBtn.disabled = false;
      }
    });
  }

  // =========================================================================
  // 2. FULFILLMENT PICK & PACK ASSISTANT (/vendas)
  // =========================================================================

  function initVendasFulfillment() {
    const tables = Array.from(document.querySelectorAll("table"));
    if (!tables.length) return;

    // Prefer inserting the control bar right above the "Aguard. envio" table (or "Em separação")
    const targetTable =
      tables.find((t) => /aguard\.?\s*envio/i.test(t.textContent || "")) ||
      tables.find((t) => /em\s*separa[çc][ãa]o/i.test(t.textContent || "")) ||
      tables[0];

    // Inject Floating Controls Bar
    const controlBar = document.createElement("div");
    controlBar.id = "ga-fulfillment-control-bar";
    controlBar.style.cssText = `
      position: sticky;
      top: 10px;
      z-index: 10000;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 12px 18px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    `;

    controlBar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 14px;">
        <span style="font-size: 20px;">📦</span>
        <div>
          <strong style="font-size: 14px;">Grand Archive — Separação de Envios</strong>
          <div style="font-size: 11px; color: #94a3b8;" id="ga-vendas-summary">Carregando pedidos...</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <label style="font-size: 12px; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <input type="checkbox" id="ga-toggle-separacao"> Incluir "Em separação"
        </label>
        <button id="ga-btn-separar" style="
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          📦 Separar Envios (<span id="ga-count-badge">0</span>)
        </button>
      </div>
    `;

    targetTable.parentNode.insertBefore(controlBar, targetTable);

    // Inject checkboxes into all eligible rows across ALL tables on the page
    const rows = document.querySelectorAll("table tbody tr, table tr");
    const seenOrderIds = new Set();

    rows.forEach((tr) => {
      if (tr.querySelector("th")) return; // Skip header rows

      const tds = Array.from(tr.querySelectorAll("td"));
      if (tds.length < 3) return;
      const firstTd = tds[0];

      // Find order link from first cell or "Abrir" link
      const links = Array.from(tr.querySelectorAll("a"));
      const firstCellLink = firstTd.querySelector("a");
      const abrirLink = links.find((a) => /abrir/i.test(a.textContent || "")) || firstCellLink;
      const rawOrderHref = abrirLink ? abrirLink.getAttribute("href") || "" : "";

      const hrefOrderMatch = rawOrderHref.match(/(\d{4,})/);
      const firstCellMatch = (firstTd.textContent || "").trim().match(/^#?(\d{4,})\b/);
      const rowHashMatch = (tr.textContent || "").match(/#(\d{4,})/);

      const orderId =
        hrefOrderMatch?.[1] || firstCellMatch?.[1] || rowHashMatch?.[1];

      if (!orderId || seenOrderIds.has(orderId)) return;

      const trText = tr.textContent || "";
      const isAguard = /aguard\.?\s*envio/i.test(trText);
      const isSeparacao = /em\s*separa[çc][ãa]o/i.test(trText);

      if (!isAguard && !isSeparacao) return;

      seenOrderIds.add(orderId);

      // Extract metadata directly from the /vendas row columns:
      // [0: Código, 1: Data, 2: Envio, 3: Frete, 4: Total, 5: Comprador, 6: Status]
      const rowDate = tds[1] ? (tds[1].textContent || "").trim() : "";
      const rowShipping = tds[2] ? (tds[2].textContent || "").trim() : "";
      const buyerCell = tds[5];
      const buyerLink =
        (buyerCell && buyerCell.querySelector("a")) ||
        links.find(
          (a) =>
            a !== firstCellLink &&
            a !== abrirLink &&
            !/^\d+$/.test((a.textContent || "").trim()) &&
            !/abrir|cancel|enviar/i.test((a.textContent || "").trim())
        );
      const rowBuyer = buyerLink
        ? (buyerLink.textContent || "").trim()
        : buyerCell
        ? (buyerCell.textContent || "").trim()
        : "Comprador";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "ga-order-checkbox";
      checkbox.dataset.orderId = orderId;
      checkbox.dataset.orderHref = rawOrderHref || `/pedido/${orderId}`;
      checkbox.dataset.orderDate = rowDate;
      checkbox.dataset.shippingMethod = rowShipping;
      checkbox.dataset.buyerNick = rowBuyer;
      checkbox.dataset.status = isAguard ? "aguard" : "separacao";
      checkbox.style.cssText = "margin-right: 8px; cursor: pointer; transform: scale(1.15);";
      checkbox.checked = isAguard;

      checkbox.addEventListener("change", updateSelectedCount);
      firstTd.insertBefore(checkbox, firstTd.firstChild);
    });

    const toggleSeparacao = controlBar.querySelector("#ga-toggle-separacao");
    const countBadge = controlBar.querySelector("#ga-count-badge");
    const summaryText = controlBar.querySelector("#ga-vendas-summary");
    const btnSeparar = controlBar.querySelector("#ga-btn-separar");

    function updateSelectedCount() {
      const checkedBoxes = document.querySelectorAll(".ga-order-checkbox:checked");
      const count = checkedBoxes.length;
      countBadge.innerText = String(count);
      summaryText.innerText = `${count} pedido(s) selecionado(s) para separação`;
      btnSeparar.style.opacity = count > 0 ? "1" : "0.5";
    }

    toggleSeparacao.addEventListener("change", () => {
      const include = toggleSeparacao.checked;
      const separacaoBoxes = document.querySelectorAll('.ga-order-checkbox[data-status="separacao"]');
      separacaoBoxes.forEach((cb) => {
        cb.checked = include;
      });
      updateSelectedCount();
    });

    updateSelectedCount();

    btnSeparar.addEventListener("click", async () => {
      const checkedBoxes = Array.from(document.querySelectorAll(".ga-order-checkbox:checked"));
      if (!checkedBoxes.length) {
        alert("Selecione ao menos um pedido para separar.");
        return;
      }

      const selectedMeta = checkedBoxes.map((cb) => ({
        orderId: cb.dataset.orderId,
        orderHref: cb.dataset.orderHref,
        orderDate: cb.dataset.orderDate,
        shippingMethod: cb.dataset.shippingMethod,
        buyerNick: cb.dataset.buyerNick,
        status: cb.dataset.status === "separacao" ? "Em separação" : "Aguard. envio",
      }));
      await startFulfillmentBatch(selectedMeta);
    });
  }

  // Helper sleep
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Extract /pedido/<id> while strictly ignoring buyer PII
  async function fetchAndParseOrder(meta) {
    const { orderId, orderHref } = meta;
    // Versioned cache key so empty v1.3.0 caches are bypassed
    const cacheKey = `ga_order_v14_${orderId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          return parsed;
        }
      } catch (e) {
        // invalid cache
      }
    }

    // Polite pacing delay 400-600ms
    await sleep(400 + Math.random() * 200);

    const fetchUrl = orderHref && orderHref.startsWith("http")
      ? orderHref
      : orderHref && orderHref.startsWith("/")
      ? orderHref
      : `/pedido/${orderId}`;

    let resp = await fetch(fetchUrl, { credentials: "same-origin" });
    if (!resp.ok && fetchUrl !== `/pedido/${orderId}`) {
      resp = await fetch(`/pedido/${orderId}`, { credentials: "same-origin" });
    }
    if (!resp.ok) {
      throw new Error(`Falha ao abrir pedido #${orderId} (HTTP ${resp.status})`);
    }

    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const bodyText = doc.body ? doc.body.textContent || "" : "";

    // Extract basic meta (prefer /vendas row meta if available)
    const dateMatch = bodyText.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
    const orderDate = meta.orderDate || (dateMatch ? dateMatch[1] : new Date().toLocaleDateString("pt-BR"));

    let buyerNick = meta.buyerNick || "Comprador";
    if (!buyerNick || buyerNick === "Comprador") {
      const userLink = doc.querySelector('a[href*="/usuario/"]');
      if (userLink && userLink.getAttribute("href")) {
        const m = userLink.getAttribute("href").match(/\/usuario\/([^/?#]+)/);
        if (m) buyerNick = decodeURIComponent(m[1].trim());
      }
    }

    let shippingMethod = meta.shippingMethod || "Padrão";
    if (!shippingMethod || shippingMethod === "Padrão") {
      if (/frete\s*combinado/i.test(bodyText)) shippingMethod = "Frete combinado com o vendedor";
      else if (/\bpac\b/i.test(bodyText)) shippingMethod = "PAC";
      else if (/\bsedex\b/i.test(bodyText)) shippingMethod = "Sedex";
      else if (/frete\s*fixo/i.test(bodyText)) shippingMethod = "Frete Fixo com rastreio";
    }

    // Extract items from order detail page
    const items = [];
    const CandidateRows = Array.from(
      doc.querySelectorAll("table tbody tr, table tr, .card-item, .produto-item, .pedido-item, .list-group-item")
    );

    const IGNORE_HREFS = /\/(vendas|compras|pedido|usuario|login|logout|carrinho|contato|faq|site|ajuda)\b/i;

    CandidateRows.forEach((tr) => {
      if (tr.querySelector("th")) return;
      const trText = (tr.textContent || "").replace(/\s+/g, " ").trim();
      if (!trText) return;

      // Must contain a price (R$) or quantity/condition indicator to be an order item row
      const priceMatch = trText.match(/R\$\s*[\d.,]+/i);
      const condMatch = trText.match(/\b(NM|SP|MP|HP|D|Near Mint|Slightly Played|Moderately Played)\b/i);

      // Find the product link inside the row
      const links = Array.from(tr.querySelectorAll("a[href]"));
      const productLink = links.find((a) => {
        const h = a.getAttribute("href") || "";
        const txt = (a.textContent || "").trim();
        if (!txt || txt.length < 2) return false;
        if (IGNORE_HREFS.test(h)) return false;
        if (/^(abrir|ver|detalhes|cancelar|enviar|rastreio)$/i.test(txt)) return false;
        return (
          /grandarchive|pokemon|magic|yugioh|onepiece|lorcana|riftbound|digimon|fab|produto|card/i.test(h) ||
          Boolean(priceMatch)
        );
      });

      // Fallback: look for card heading or image alt if there is no anchor tag
      const headingEl = tr.querySelector("h3, h4, h5, .card-name, .nome-produto, .produto-nome, strong");
      const imgEl = tr.querySelector("img[alt], img[src]");

      if (!productLink && !(priceMatch && (headingEl || condMatch))) return;

      const href = productLink ? productLink.getAttribute("href") || "" : "";
      const imgSrc = imgEl ? imgEl.getAttribute("src") || "" : "";
      const imgAlt = imgEl ? imgEl.getAttribute("alt") || "" : "";

      let rawTitle = "";
      if (productLink) {
        rawTitle = (productLink.textContent || "").trim();
      } else if (headingEl) {
        rawTitle = (headingEl.textContent || "").trim();
      } else if (imgAlt) {
        rawTitle = imgAlt.split("|")[0].trim();
      }
      if (!rawTitle) return;

      // Clean trailing edition/parenthetical if embedded in title
      const subEl = tr.querySelector(".subtitulo, .card-edicao, small, .text-muted, .edicao");
      const rawSubtitle = subEl ? (subEl.textContent || "").trim() : undefined;

      // Determine TCG & mypCode
      let mypCode = "";
      const combinedSource = `${href} ${imgSrc} ${imgAlt} ${rawTitle} ${rawSubtitle || ""} ${trText}`.toLowerCase();

      // Check for explicit grandarchive_<set>_<num> code in href, imgSrc, or text
      const explicitGaMatch = combinedSource.match(/grandarchive[_/-]([a-z0-9]{2,5})[_/-]([a-z0-9]{1,5})/i);
      const setNumBracketMatch = (rawSubtitle || trText).match(/\b([A-Z0-9]{2,4})\s*[-·#]\s*#?(\d{1,4})\b/);

      if (explicitGaMatch) {
        mypCode = `grandarchive_${explicitGaMatch[1].toLowerCase()}_${explicitGaMatch[2].toLowerCase()}`;
      } else if (
        /pokemon|pokémon/i.test(combinedSource) &&
        !/grand\s*archive|grandarchive/i.test(combinedSource)
      ) {
        mypCode = `pokemon_${rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      } else if (
        /\b(yugioh|yu-gi-oh|magic|lorcana|onepiece|one\s*piece|riftbound|digimon)\b/i.test(combinedSource) &&
        !/grand\s*archive|grandarchive/i.test(combinedSource)
      ) {
        const otherTcg = combinedSource.match(/\b(yugioh|yu-gi-oh|magic|lorcana|onepiece|one\s*piece|riftbound|digimon)\b/i)[1]
          .replace(/[^a-z0-9]/g, "")
          .toLowerCase();
        mypCode = `${otherTcg}_${rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      } else if (setNumBracketMatch) {
        mypCode = `grandarchive_${setNumBracketMatch[1].toLowerCase()}_${setNumBracketMatch[2].toLowerCase()}`;
      } else {
        // Default to Grand Archive so the catalog enrichment repository can match by cardName / setPrefix
        mypCode = `grandarchive_${rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      }

      const isFoil = /\b(foil|curio|csr)\b/i.test(trText);

      let condition = "NM";
      if (condMatch) {
        const c = condMatch[1].toUpperCase();
        condition = c.startsWith("N") ? "NM" : c.startsWith("S") ? "SP" : c.startsWith("M") ? "MP" : c.startsWith("H") ? "HP" : c;
      }

      let language = "EN";
      const langMatch = trText.match(/\b(EN|PT|JP|ING|POR|JAP)\b/i);
      if (langMatch) {
        const l = langMatch[1].toUpperCase();
        language = l === "ING" ? "EN" : l === "POR" ? "PT" : l === "JAP" ? "JP" : l;
      }

      let quantity = 1;
      const qtySpan = tr.querySelector(".quantidade-num, .qtd, .qty");
      if (qtySpan && /^\d+$/.test((qtySpan.textContent || "").trim())) {
        quantity = parseInt((qtySpan.textContent || "").trim(), 10);
      } else {
        const cells = tr.querySelectorAll("td");
        for (let c = 0; c < cells.length; c++) {
          const t = (cells[c].textContent || "").trim().replace(/^x/i, "");
          if (/^\d+$/.test(t)) {
            const val = parseInt(t, 10);
            if (val > 0 && val < 100 && String(val) !== orderId) {
              quantity = val;
              break;
            }
          }
        }
      }

      const unitPriceBrl = priceMatch ? priceMatch[0] : "R$ 0,00";

      items.push({
        rawTitle: rawTitle.replace(/\s*\([^)]*\)/g, "").trim() || rawTitle,
        rawSubtitle: rawSubtitle || rawTitle,
        mypCode,
        productUrl: href.startsWith("http") ? href : href ? `https://mypcards.com${href}` : null,
        condition,
        language,
        isFoil,
        quantity,
        unitPriceBrl,
      });
    });

    const fullOrderUrl =
      fetchUrl.startsWith("http")
        ? fetchUrl
        : `https://mypcards.com${fetchUrl.startsWith("/") ? "" : "/"}${fetchUrl}`;

    const parsedOrder = {
      orderId,
      orderDate,
      buyerNick,
      shippingMethod,
      status: meta.status || "Aguard. envio",
      orderUrl: fullOrderUrl,
      items,
    };

    if (items.length > 0) {
      sessionStorage.setItem(cacheKey, JSON.stringify(parsedOrder));
    }
    return parsedOrder;
  }

  async function startFulfillmentBatch(selectedOrdersMeta) {
    const backdrop = document.createElement("div");
    backdrop.id = "ga-fulfillment-modal-backdrop";
    backdrop.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(10, 15, 29, 0.85);
      backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    const container = document.createElement("div");
    container.style.cssText = `
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 16px;
      width: 92%;
      max-width: 900px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      color: #f8fafc;
      overflow: hidden;
    `;

    container.innerHTML = `
      <div style="padding: 16px 20px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 22px;">📦</span>
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Separação de Envios — Grand Archive TCG</h3>
            <span style="font-size: 12px; color: #94a3b8;" id="ga-modal-status">Preparando leitura...</span>
          </div>
        </div>
        <button id="ga-modal-close" style="background: none; border: none; color: #94a3b8; font-size: 22px; cursor: pointer; padding: 4px;">&times;</button>
      </div>
      <div id="ga-modal-body" style="padding: 24px; overflow-y: auto; flex: 1;">
        <div id="ga-progress-bar-container" style="background: #1e293b; border-radius: 8px; height: 10px; width: 100%; overflow: hidden; margin-bottom: 16px;">
          <div id="ga-progress-bar" style="background: #3b82f6; height: 100%; width: 0%; transition: width 0.2s;"></div>
        </div>
        <p id="ga-progress-label" style="font-size: 13px; color: #cbd5e1; text-align: center;">Iniciando leitura sequencial com pacing educado (400-600ms)...</p>
      </div>
    `;

    backdrop.appendChild(container);
    document.body.appendChild(backdrop);

    const closeBtn = container.querySelector("#ga-modal-close");
    closeBtn.addEventListener("click", () => backdrop.remove());

    const progressBar = container.querySelector("#ga-progress-bar");
    const progressLabel = container.querySelector("#ga-progress-label");

    const orders = [];
    for (let i = 0; i < selectedOrdersMeta.length; i++) {
      const meta = selectedOrdersMeta[i];
      const pct = Math.round(((i + 1) / selectedOrdersMeta.length) * 100);
      progressBar.style.width = `${pct}%`;
      progressLabel.innerText = `Lendo pedido ${i + 1} de ${selectedOrdersMeta.length} (#${meta.orderId} - ${meta.buyerNick})...`;

      try {
        const order = await fetchAndParseOrder(meta);
        orders.push(order);
      } catch (err) {
        console.error(`Erro ao carregar #${meta.orderId}:`, err);
      }
    }

    progressLabel.innerText = "Enriquecendo catálogo e elementos no Grand Archive Binder...";
    const appUrl = localStorage.getItem("ga_app_url") || DEFAULT_APP_URL;

    try {
      const enrichResp = await fetch(`${appUrl}/api/marketplace/fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orders),
      });

      if (!enrichResp.ok) {
        throw new Error(`Enriquecimento falhou com HTTP ${enrichResp.status}`);
      }

      const report = await enrichResp.json();
      renderFulfillmentReportInModal(container, report, appUrl);
    } catch (e) {
      console.error("[GA Fulfillment] Erro:", e);
      progressLabel.innerText = `Erro ao comunicar com o Grand Archive Binder (${appUrl}): ${e.message}. Verifique se o app está rodando.`;
      progressLabel.style.color = "#f87171";
    }
  }

  function renderFulfillmentReportInModal(container, report, appUrl) {
    const modalBody = container.querySelector("#ga-modal-body");
    const modalStatus = container.querySelector("#ga-modal-status");
    modalStatus.innerText = `${report.totalGrandArchiveOrders} pedidos GA · ${report.totalGrandArchiveCopies} cartas`;

    let activeTab = "pick";

    function getFormattedText() {
      const lines = [];
      lines.push("=== GRAND ARCHIVE TCG - PICK LIST (POR ELEMENTO) ===");
      lines.push(`Total: ${report.totalGrandArchiveOrders} pedidos · ${report.totalGrandArchiveCopies} cartas\n`);

      for (const [el, list] of Object.entries(report.pickListByElement)) {
        if (!list || !list.length) continue;
        const totalEl = list.reduce((s, i) => s + i.totalQuantity, 0);
        lines.push(`[${el.toUpperCase()}] (${totalEl} cartas):`);
        for (const item of list) {
          const foil = item.isFoil ? " [FOIL]" : "";
          const num = item.collectorNumber ? ` #${item.collectorNumber}` : "";
          const refs = item.orderReferences.map((r) => `#${r.orderId} (x${r.quantity})`).join(", ");
          lines.push(`  [ ] ${item.cardName} [${item.setPrefix}${num} · ${item.condition}]${foil} x${item.totalQuantity} (Pedidos: ${refs})`);
        }
        lines.push("");
      }

      if (report.nonGrandArchiveOrders && report.nonGrandArchiveOrders.length > 0) {
        lines.push("=== PEDIDOS DE OUTROS TCGS ===");
        for (const o of report.nonGrandArchiveOrders) {
          lines.push(`  (!) Pedido #${o.orderId} (${o.buyerNick}) - ${o.detectedTcg.toUpperCase()} (${o.itemCount} itens): ${o.orderUrl}`);
        }
        lines.push("");
      }

      lines.push("=== BUYER PACKS (POR COMPRADOR E PEDIDO) ===");
      for (const buyer of report.buyerPacks) {
        const multi = buyer.totalOrders > 1 ? " [ENVIAR JUNTOS]" : "";
        lines.push(`👤 ${buyer.buyerNick} — ${buyer.totalOrders} pedido(s) · Envio: ${buyer.primaryShippingMethod}${multi}`);
        for (const order of buyer.orders) {
          lines.push(`  Pedido #${order.orderId} (${order.shippingMethod}):`);
          for (const item of order.items) {
            const foil = item.isFoil ? " [FOIL]" : "";
            const num = item.collectorNumber ? ` #${item.collectorNumber}` : "";
            lines.push(`    [ ] ${item.cardName} [${item.setPrefix}${num} · ${item.condition}]${foil} x${item.quantity}`);
          }
        }
        lines.push("");
      }

      return lines.join("\n").trim();
    }

    function renderContent() {
      let nonGaNotice = "";
      if (report.nonGrandArchiveOrders && report.nonGrandArchiveOrders.length > 0) {
        nonGaNotice = `
          <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <strong style="color: #fbbf24; font-size: 13px;">⚠️ Pedidos de outros TCGs detectados (${report.nonGrandArchiveOrders.length}):</strong>
            <div style="font-size: 12px; margin-top: 6px; color: #fde68a;">
              ${report.nonGrandArchiveOrders.map((o) => `
                <div style="margin-top: 4px;">
                  Pedido <a href="${o.orderUrl}" target="_blank" style="color: #60a5fa; font-weight: 600;">#${o.orderId}</a> (${o.buyerNick}) — ${o.detectedTcg.toUpperCase()} (${o.itemCount} itens)
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }

      let tabContent = "";
      if (activeTab === "pick") {
        let elementCards = "";
        for (const [element, items] of Object.entries(report.pickListByElement)) {
          if (!items || !items.length) continue;
          const totalQty = items.reduce((s, i) => s + i.totalQuantity, 0);

          elementCards += `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #334155; padding-bottom: 6px;">
                <span style="font-weight: 700; font-size: 14px; color: #38bdf8;">${element}</span>
                <span style="font-size: 12px; color: #94a3b8;">${totalQty} carta(s)</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${items.map((entry) => {
                  const checkKey = `ga_pick_${entry.itemKey}`;
                  const isChecked = localStorage.getItem(checkKey) === "1";
                  const foilBadge = entry.isFoil
                    ? `<span style="background: #d97706; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">FOIL</span>`
                    : "";
                  const col = entry.collectorNumber ? ` #${entry.collectorNumber}` : "";

                  return `
                    <label style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; cursor: pointer; padding: 6px; border-radius: 6px; background: rgba(15, 23, 42, 0.4);">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" data-check-key="${checkKey}" class="ga-pick-item-check" ${isChecked ? "checked" : ""} style="cursor: pointer; transform: scale(1.1);">
                        <span style="${isChecked ? "text-decoration: line-through; opacity: 0.6;" : "font-weight: 500;"}">
                          ${entry.cardName} <span style="color: #94a3b8; font-size: 11px;">[${entry.setPrefix}${col} · ${entry.condition}]</span>${foilBadge}
                        </span>
                      </div>
                      <div style="text-align: right;">
                        <strong style="color: #38bdf8; font-size: 14px;">x${entry.totalQuantity}</strong>
                        <div style="font-size: 10px; color: #64748b;">#${entry.orderReferences.map((r) => r.orderId).join(", #")}</div>
                      </div>
                    </label>
                  `;
                }).join("")}
              </div>
            </div>
          `;
        }
        tabContent = elementCards;
      } else {
        let buyerCards = "";
        for (const buyer of report.buyerPacks) {
          const isMulti = buyer.totalOrders > 1;
          const multiBadge = isMulti
            ? `<span style="background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; margin-left: 8px;">🚨 ENVIAR JUNTOS (${buyer.totalOrders} PEDIDOS)</span>`
            : "";

          buyerCards += `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 10px;">
                <div style="display: flex; align-items: center;">
                  <strong style="font-size: 15px; color: #f8fafc;">👤 ${buyer.buyerNick}</strong>
                  ${multiBadge}
                </div>
                <span style="font-size: 12px; background: #334155; padding: 2px 8px; border-radius: 4px; color: #e2e8f0;">
                  Envio: <strong>${buyer.primaryShippingMethod}</strong>
                </span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${buyer.orders.map((sub) => {
                  const orderPhotoKey = `ga_order_photo_${sub.orderId}`;
                  const isOrderDone = localStorage.getItem(orderPhotoKey) === "1";

                  return `
                    <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #475569; border-radius: 8px; padding: 10px;">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <strong style="font-size: 13px; color: #38bdf8;">Pedido #${sub.orderId}</strong>
                          <span style="font-size: 11px; color: #94a3b8;">(${sub.shippingMethod})</span>
                          <a href="${sub.orderUrl}" target="_blank" style="color: #60a5fa; font-size: 11px; text-decoration: underline;">Abrir #${sub.orderId} ↗</a>
                        </div>
                        <label style="font-size: 11px; color: #a7f3d0; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                          <input type="checkbox" data-order-photo-key="${orderPhotoKey}" class="ga-order-photo-check" ${isOrderDone ? "checked" : ""} style="cursor: pointer;">
                          📸 Concluído / Fotografado
                        </label>
                      </div>
                      <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${sub.items.map((i) => {
                          const itemCheckKey = `ga_item_${sub.orderId}_${i.itemKey}`;
                          const isItemChecked = localStorage.getItem(itemCheckKey) === "1";
                          const foil = i.isFoil ? `<span style="background: #d97706; color: #fff; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">FOIL</span>` : "";

                          return `
                            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; cursor: pointer; padding: 4px 6px; border-radius: 4px; background: rgba(30, 41, 59, 0.5);">
                              <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="checkbox" data-item-check-key="${itemCheckKey}" class="ga-sub-item-check" ${isItemChecked ? "checked" : ""} style="cursor: pointer;">
                                <span style="${isItemChecked ? "text-decoration: line-through; opacity: 0.6;" : ""}">
                                  ${i.cardName} <span style="color: #94a3b8; font-size: 10px;">[${i.setPrefix} #${i.collectorNumber || ""} · ${i.condition}]</span>${foil}
                                </span>
                              </div>
                              <span style="color: #38bdf8; font-weight: 600;">x${i.quantity}</span>
                            </label>
                          `;
                        }).join("")}
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          `;
        }
        tabContent = buyerCards;
      }

      modalBody.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid #1e293b; padding-bottom: 12px;">
          <div style="display: flex; gap: 8px;">
            <button id="ga-tab-pick" style="background: ${activeTab === "pick" ? "#2563eb" : "#1e293b"}; color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer;">
              📋 1. Pick List (Por Elemento)
            </button>
            <button id="ga-tab-buyer" style="background: ${activeTab === "buyer" ? "#2563eb" : "#1e293b"}; color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer;">
              📦 2. Buyer Packs (Por Comprador)
            </button>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="ga-btn-copy-text" style="background: #334155; color: #f8fafc; border: none; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">
              📋 Copiar Texto
            </button>
            <button id="ga-btn-open-binder" style="background: #059669; color: #fff; border: none; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer;">
              🔗 Abrir no GA Binder
            </button>
          </div>
        </div>
        ${nonGaNotice}
        <div id="ga-tab-pane">
          ${tabContent}
        </div>
      `;

      // Wire tab switches
      modalBody.querySelector("#ga-tab-pick").addEventListener("click", () => {
        activeTab = "pick";
        renderContent();
      });
      modalBody.querySelector("#ga-tab-buyer").addEventListener("click", () => {
        activeTab = "buyer";
        renderContent();
      });

      // Wire copy text
      modalBody.querySelector("#ga-btn-copy-text").addEventListener("click", () => {
        const text = getFormattedText();
        navigator.clipboard.writeText(text).then(() => {
          alert("Lista de separação copiada para a área de transferência!");
        });
      });

      // Wire open in GA Binder
      modalBody.querySelector("#ga-btn-open-binder").addEventListener("click", () => {
        const encoded = encodeURIComponent(JSON.stringify(report));
        const url = `${appUrl}/collection?tab=myp-store&fulfillment=1#ga_fulfillment=${encoded}`;
        window.open(url, "_blank");
      });

      // Wire persistent checkboxes
      modalBody.querySelectorAll(".ga-pick-item-check").forEach((cb) => {
        cb.addEventListener("change", () => {
          localStorage.setItem(cb.dataset.checkKey, cb.checked ? "1" : "0");
          renderContent();
        });
      });

      modalBody.querySelectorAll(".ga-order-photo-check").forEach((cb) => {
        cb.addEventListener("change", () => {
          localStorage.setItem(cb.dataset.orderPhotoKey, cb.checked ? "1" : "0");
        });
      });

      modalBody.querySelectorAll(".ga-sub-item-check").forEach((cb) => {
        cb.addEventListener("change", () => {
          localStorage.setItem(cb.dataset.itemCheckKey, cb.checked ? "1" : "0");
          renderContent();
        });
      });
    }

    renderContent();
  }
})();
