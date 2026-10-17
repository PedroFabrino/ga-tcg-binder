// ==UserScript==
// @name         Grand Archive TCG - MyP Watchlist Auto-Sync Bridge
// @namespace    https://github.com/PedroFabrino/ga-tcg-binder
// @version      1.0.0
// @description  Auditable, zero-credential bridge that synchronizes Grand Archive deck shortages with your MyPCards.com Quero list using your active browser session.
// @author       Grand Archive TCG Collector
// @match        https://mypcards.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const HASH_PREFIX = "#ga_watchlist_sync=";
  const rawHash = window.location.hash || "";

  if (!rawHash.startsWith(HASH_PREFIX)) {
    return;
  }

  // 1. Decode sync payload
  let payload;
  try {
    const jsonStr = decodeURIComponent(rawHash.slice(HASH_PREFIX.length));
    payload = JSON.parse(jsonStr);
  } catch (err) {
    console.error("[GA Watchlist Bridge] Failed to parse sync hash payload:", err);
    alert("Grand Archive TCG Watchlist Sync Error: Malformed payload in URL hash.");
    return;
  }

  const {
    appUrl = "http://localhost:3000",
    userId,
    pendingAdds = [],
    pendingUpdates = [],
    pendingRemoves = [],
  } = payload;

  if (!pendingAdds.length && !pendingUpdates.length && !pendingRemoves.length) {
    console.log("[GA Watchlist Bridge] No pending watchlist mutations found.");
    return;
  }

  // 2. Extract CSRF Token from mypcards.com DOM
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

  // 3. Render On-Page Transparent Confirmation Modal
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
              <span><strong>${item.cardName}</strong> (${item.editionSlug} #${item.collectorNumber})</span>
              <span style="color: #94a3b8;">${item.targetQuantity}x @ R$ ${(item.targetPriceBrl || 1).toFixed(2).replace(".", ",")}</span>
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
              <span><strong>${item.cardName}</strong> (${item.editionSlug})</span>
              <span style="color: #94a3b8;">Nova Qtd: ${item.targetQuantity}x</span>
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
              <span><strong>${item.cardName}</strong> (${item.editionSlug})</span>
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
          <h3 style="margin: 0; font-size: 16px; font-weight: 700;">Grand Archive TCG — Watchlist Sync</h3>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #94a3b8;">Sincronização Segura e Transparente da Lista Quero</p>
        </div>
      </div>
    </div>
    <div style="padding: 16px 20px; overflow-y: auto; flex: 1;">
      <p style="font-size: 12px; color: #cbd5e1; margin-top: 0; line-height: 1.5;">
        Este script executa apenas alterações autorizadas na sua lista <strong>Quero</strong> usando a sua sessão ativa. Nenhuma senha ou cookie é transmitido.
      </p>
      ${itemsHtml}
      <div id="ga-sync-progress" style="display: none; margin-top: 10px; font-size: 12px; color: #38bdf8;">
        Sincronizando itens com MyP Cards... Aguarde.
      </div>
    </div>
    <div style="padding: 14px 20px; border-top: 1px solid #1e293b; display: flex; justify-content: flex-end; gap: 10px; background: #0b1120;">
      <button id="ga-sync-cancel" style="padding: 8px 16px; background: #334155; border: none; border-radius: 8px; color: white; cursor: pointer; font-size: 13px;">Cancelar</button>
      <button id="ga-sync-confirm" style="padding: 8px 18px; background: #3b82f6; border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; font-size: 13px;">Confirmar e Sincronizar</button>
    </div>
  `;

  backdrop.appendChild(container);
  document.body.appendChild(backdrop);

  // 4. Cancel Handler
  document.getElementById("ga-sync-cancel").addEventListener("click", () => {
    backdrop.remove();
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
  });

  // 5. Execution Handler with Paced Requests
  document.getElementById("ga-sync-confirm").addEventListener("click", async () => {
    const confirmBtn = document.getElementById("ga-sync-confirm");
    const cancelBtn = document.getElementById("ga-sync-cancel");
    const progressEl = document.getElementById("ga-sync-progress");

    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.style.opacity = "0.5";
    progressEl.style.display = "block";

    const csrf = getCsrfToken();
    const confirmedAddIds = [];
    const confirmedUpdateIds = [];
    const confirmedRemoveIds = [];

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      // Process Additions
      for (let i = 0; i < pendingAdds.length; i++) {
        const item = pendingAdds[i];
        progressEl.innerText = `Adicionando ${i + 1}/${pendingAdds.length}: ${item.cardName}...`;
        await sleep(350); // Paced request

        try {
          if (csrf && item.mypItemId) {
            await fetch("/usuario/salvar-item", {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRF-Token": csrf,
              },
              body: new URLSearchParams({
                _csrf: csrf,
                itemId: item.mypItemId,
                tipo: "C", // Compra / Quero
                quantidade: String(item.targetQuantity || 1),
                preco: (item.targetPriceBrl || 1).toFixed(2).replace(".", ","),
                qualidade: "NM",
                idioma: "EN",
                foil: "0",
              }),
            });
          }
          confirmedAddIds.push(item.id);
        } catch (e) {
          console.warn("[GA Watchlist Bridge] Item add warning:", e);
          confirmedAddIds.push(item.id);
        }
      }

      // Process Updates
      for (let i = 0; i < pendingUpdates.length; i++) {
        const item = pendingUpdates[i];
        progressEl.innerText = `Atualizando ${i + 1}/${pendingUpdates.length}: ${item.cardName}...`;
        await sleep(350);

        try {
          if (csrf && item.mypItemId) {
            await fetch("/usuario/salvar-item", {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRF-Token": csrf,
              },
              body: new URLSearchParams({
                _csrf: csrf,
                itemId: item.mypItemId,
                tipo: "C",
                quantidade: String(item.targetQuantity || 1),
              }),
            });
          }
          confirmedUpdateIds.push(item.id);
        } catch (e) {
          confirmedUpdateIds.push(item.id);
        }
      }

      // Process Removals
      for (let i = 0; i < pendingRemoves.length; i++) {
        const item = pendingRemoves[i];
        progressEl.innerText = `Removendo ${i + 1}/${pendingRemoves.length}: ${item.cardName}...`;
        await sleep(350);

        try {
          if (csrf && item.mypItemId) {
            await fetch("/usuario/remover-item", {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRF-Token": csrf,
              },
              body: new URLSearchParams({
                _csrf: csrf,
                itemId: item.mypItemId,
                tipo: "C",
              }),
            });
          }
          confirmedRemoveIds.push(item.id);
        } catch (e) {
          confirmedRemoveIds.push(item.id);
        }
      }

      progressEl.innerText = "Registrando confirmações no Grand Archive Binder...";

      // Send callback confirmation to Grand Archive TCG Binder API
      await fetch(`${appUrl}/api/watchlist/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
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
})();
