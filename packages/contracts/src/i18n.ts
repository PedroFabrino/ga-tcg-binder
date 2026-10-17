/**
 * Shared compile-time typed i18n translation catalog and helpers
 * for Grand Archive TCG Collector & Companion Scanner.
 */

export type SupportedLocale = "en" | "pt-BR";
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["en", "pt-BR"] as const;
export const DEFAULT_LOCALE: SupportedLocale = "en";

export const enCatalog = {
  common: {
    close: "Close",
    cancel: "Cancel",
    confirm: "Confirm",
    save: "Save",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    refresh: "Refresh",
    all: "All",
    copy: "Copy",
    copied: "Copied!",
    demand: "Demand",
    peak: "Peak",
    owned: "Owned",
    missing: "Missing",
    vendor: "Vendor",
    decks: "Decks",
    watchlist: "Watchlist",
    addToBinder: "Add to Binder",
    visitStore: "Visit Store",
    syncSkipped: "Sync Skipped",
    otherMarketplace: "Other / Marketplace",
    allShortages: "All Shortages",
  },
  settings: {
    title: "Collector Settings",
    subtitle: "Manage your credentials, notification thresholds, and collection preferences.",
    friendCodeLabel: "Friend Code",
    networkLabel: "Grand Archive Network",
    manualBridgeDesc: "Manual / Browser Bridge",
    passwordAutoSyncDesc: "Password for auto-sync",
    lowPopThreshold: "Low Population Threshold",
    lowPopHelp: "Cards with circulating population below this number will be flagged as Low Pop.",
    mypUsernameLabel: "MyP Cards Username",
    mypUsernamePlaceholder: "e.g. GrandMasterGA",
    mypUsernameHelp: "Used to cross-reference your personal store and public Quero wantlist.",
    mypAutomationTitle: "Automated Daily Watchlist Sync (Opt-In)",
    mypAutomationDesc: "Automatically synchronize shortages to your MyP wantlist during daily pipeline syncs.",
    mypCredentialsTitle: "MyP Cards Credentials (AES-256-GCM Encrypted)",
    mypCredentialsDesc: "Credentials are encrypted at rest in your SQLite profile. We never log or expose plaintext passwords.",
    mypLoginLabel: "MyP Login / E-mail",
    mypLoginPlaceholder: "user@example.com",
    mypPasswordLabel: "MyP Password",
    mypPasswordPlaceholder: "••••••••",
    savedCredentialsActive: "Saved Credentials Active",
    savedCredentialsDesc: "Your encrypted credentials are active for automated daily watchlist synchronization.",
    clearCredentialsBtn: "Clear Saved Credentials",
    saveSettingsBtn: "Save Preferences",
    clearingBtn: "Clearing...",
    savingBtn: "Saving...",
    savedToast: "Settings saved successfully",
    clearedToast: "Saved credentials removed",
  },
  shortages: {
    title: "Cartas Necessárias (Shortages)",
    subtitle: "Track missing cards across your constructed decks and sync to MyP Cards.",
    hardShortageTab: "Compra Necessária (Hard)",
    sharedShortageTab: "Revezamento entre Decks (Shared)",
    staplesTab: "Staples de Torneio",
    allShortagesTab: "Todas as Faltantes",
    byVendorTab: "Agrupar por Vendedor",
    vendorBundles: "Melhores Vendedores no MyP",
    hardShortageTooltip: "Hard Shortage (Compra Necessária): Peak demand in any single deck (ensure at least 1 deck is playable)",
    sharedShortageTooltip: "Shared Shortage (Revezamento entre Decks): Concurrent demand across all decks",
    staplesTooltip: "Staples Policy: Meta staples recommendations & playset cap",
    searchPlaceholder: "Search cards by name or class...",
    filterElements: "Elements",
    filterRarities: "Rarities",
    emptyStateTitle: "No shortages found",
    emptyStateDesc: "All requested deck cards are fulfilled in your binder!",
    quickAddTitle: "Add {cardName} to Binder",
    quickAddSubtitle: "Satisfy shortage requirements for {cardName}",
    quickAddSuccess: "Added {quantity}x {cardName} to Binder",
    quickAddNoEdition: "No edition available",
    quickAddEditionLabel: "Edition / Print",
    quickAddQuantityLabel: "Quantity to Add",
    quickAddFoilLabel: "Foil Finish",
    filterFlat: "Flat",
    filterByElement: "By Element",
    filterByVendor: "By Vendor",
    filterAll: "All",
    filterAriaSearch: "Filter shortage cards",
    filterAriaClear: "Clear filter",
    vendorOfferTooltip: "Offered on MyP Cards by vendor {vendor}",
    groupTotalCost: "Total ~R$ {total}",
  },
  watchlist: {
    bannerTitle: "MyP Watchlist Ledger",
    bannerWatching: "{count} Watching on MyP",
    bannerPendingAdd: "+{count} to Watch",
    bannerPendingUpdate: "~{count} Qty Updates",
    bannerPendingRemove: "-{count} Fulfilled to Remove",
    syncNowBtn: "Sync Now",
    syncingBtn: "Syncing...",
    syncSuccessToast: "Sync MyP: +{adds} ~{updates} -{removes}",
    browserBridgeBtn: "Browser Script Bridge",
    statusWatching: "Watching on MyP",
    statusPendingAdd: "Pending Add",
    statusPendingUpdate: "Pending Qty Update",
    statusPendingRemove: "Quota Filled · Pending Removal",
    statusIgnored: "Ignored (Deleted on MyP)",
    reEnableWatchBtn: "Re-enable Watch",
    reEnablingBtn: "Re-enabling...",
    policyHardLabel: "Hard Shortage",
    policySharedLabel: "Shared Shortage",
    policyStaplesLabel: "Staples Policy",
  },
  securityModal: {
    title: "Auditable Browser Userscript Bridge",
    subtitle: "Review the client-side userscript code before enabling automated browser synchronization on MyPCards.com.",
    viewGithubSource: "View unminified source on GitHub",
    installationSteps: "Installation & Execution Steps:",
    step1: "1. Install the Tampermonkey or Violentmonkey extension in your browser.",
    step2: "2. Install or paste the script below into your userscript manager.",
    step3: "3. Visit mypcards.com to see the on-screen confirmation banner before applying any changes.",
    consentCheckbox: "I have reviewed the script source code and authorize it to synchronize my wantlist on mypcards.com",
    copyScriptBtn: "Copy Userscript Code",
    copiedToast: "Script copied to clipboard!",
    closeBtn: "Close",
  },
  fulfillment: {
    title: "Order Fulfillment (Separação de Envios)",
    subtitle: "Pick list by Element and photo-verification pack breakdown for MyP Cards orders.",
    tabListings: "Store Listings",
    tabFulfillment: "Order Fulfillment",
    tabPickList: "1. Pick List (By Element)",
    tabBuyerPacks: "2. Buyer Packs (By Buyer)",
    summaryHeader: "{orders} GA Orders · {copies} Total Cards",
    nonGaNoticeTitle: "Non-Grand Archive Orders Detected ({count})",
    nonGaNoticeDesc: "These orders contain items from other games and were excluded from your GA pick list:",
    nonGaNoticeLink: "Open Order #{orderId} on MyP ↗",
    emptyStateTitle: "No active fulfillment batch",
    emptyStateDesc: "Open MyPCards /vendas with the Tampermonkey bridge and click 'Separar Envios' to load pending orders here.",
    openMypVendasBtn: "Open MyP Vendas ↗",
    copyTextBtn: "Copy Text Breakdown",
    copiedToast: "Fulfillment pick & pack breakdown copied to clipboard!",
    clearBatchBtn: "Clear Batch",
    batchClearedToast: "Active fulfillment batch cleared",
    shipCombinedBadge: "SHIP TOGETHER ({count} ORDERS)",
    shippingLabel: "Shipping: {method}",
    orderCompletedLabel: "Order Completed / Photographed",
    orderPhotoDoneToast: "Order #{orderId} marked as completed / photographed",
    elementGroupCount: "{count} card(s)",
    ordersRef: "Orders: {refs}",
    openOrderLink: "Open #{orderId} on MyP ↗",
    totalPrice: "Unit: {price}",
    cardsToPull: "{count} cards to pull",
  },
};

export type TranslationCatalog = typeof enCatalog;

export const ptBRCatalog: TranslationCatalog = {
  common: {
    close: "Fechar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    save: "Salvar",
    loading: "Carregando...",
    error: "Erro",
    success: "Sucesso",
    refresh: "Atualizar",
    all: "Todos",
    copy: "Copiar",
    copied: "Copiado!",
    demand: "Demanda",
    peak: "Pico",
    owned: "Possui",
    missing: "Faltam",
    vendor: "Vendedor",
    decks: "Decks",
    watchlist: "Watchlist",
    addToBinder: "Adicionar ao Fichário",
    visitStore: "Visitar Loja",
    syncSkipped: "Sincronização Ignorada",
    otherMarketplace: "Outros / Marketplace",
    allShortages: "Todas as Faltantes",
  },
  settings: {
    title: "Configurações do Colecionador",
    subtitle: "Gerencie suas credenciais, limites de alerta e preferências da coleção.",
    friendCodeLabel: "Código de Amigo",
    networkLabel: "Rede Grand Archive",
    manualBridgeDesc: "Manual / Script de Navegador",
    passwordAutoSyncDesc: "Senha para sincronização automática",
    lowPopThreshold: "Limite de Baixa Tiragem (Low Pop)",
    lowPopHelp: "Cartas com tiragem circulante abaixo deste valor serão marcadas como Low Pop.",
    mypUsernameLabel: "Usuário no MyP Cards",
    mypUsernamePlaceholder: "ex: GrandMasterGA",
    mypUsernameHelp: "Usado para cruzar sua loja pessoal e lista pública de Quero.",
    mypAutomationTitle: "Sincronização Diária Automática (Opt-In)",
    mypAutomationDesc: "Sincronize automaticamente cartas necessárias para sua lista de Quero do MyP nos pipelines diários.",
    mypCredentialsTitle: "Credenciais MyP Cards (Criptografadas com AES-256-GCM)",
    mypCredentialsDesc: "As credenciais são salvas criptografadas em repouso no seu perfil SQLite. Nunca registramos senhas em texto puro.",
    mypLoginLabel: "Login / E-mail no MyP",
    mypLoginPlaceholder: "usuario@exemplo.com",
    mypPasswordLabel: "Senha no MyP",
    mypPasswordPlaceholder: "••••••••",
    savedCredentialsActive: "Credenciais Salvas Ativas",
    savedCredentialsDesc: "Suas credenciais criptografadas estão ativas para sincronização automática.",
    clearCredentialsBtn: "Limpar Credenciais Salvas",
    saveSettingsBtn: "Salvar Preferências",
    clearingBtn: "Limpando...",
    savingBtn: "Salvando...",
    savedToast: "Configurações salvas com sucesso",
    clearedToast: "Credenciais salvas removidas",
  },
  shortages: {
    title: "Cartas Necessárias (Shortages)",
    subtitle: "Acompanhe cartas faltantes nos seus decks construídos e sincronize com o MyP Cards.",
    hardShortageTab: "Compra Necessária",
    sharedShortageTab: "Revezamento entre Decks",
    staplesTab: "Staples de Torneio",
    allShortagesTab: "Todas as Faltantes",
    byVendorTab: "Agrupar por Vendedor",
    vendorBundles: "Melhores Vendedores no MyP",
    hardShortageTooltip: "Compra Necessária: Pico de demanda em um único deck (garante ao menos 1 deck jogável)",
    sharedShortageTooltip: "Revezamento entre Decks: Demanda concorrente total entre todos os decks",
    staplesTooltip: "Política de Staples: Recomendações do meta e limite de playset",
    searchPlaceholder: "Buscar cartas por nome ou classe...",
    filterElements: "Elementos",
    filterRarities: "Raridades",
    emptyStateTitle: "Nenhuma carta necessária",
    emptyStateDesc: "Todas as cartas dos seus decks estão disponíveis no seu fichário!",
    quickAddTitle: "Adicionar {cardName} ao Fichário",
    quickAddSubtitle: "Suprir cartas necessárias de {cardName}",
    quickAddSuccess: "Adicionado {quantity}x {cardName} ao Fichário",
    quickAddNoEdition: "Nenhuma edição disponível",
    quickAddEditionLabel: "Edição / Impressão",
    quickAddQuantityLabel: "Quantidade para Adicionar",
    quickAddFoilLabel: "Acabamento Foil",
    filterFlat: "Lista",
    filterByElement: "Por Elemento",
    filterByVendor: "Por Vendedor",
    filterAll: "Todos",
    filterAriaSearch: "Filtrar cartas necessárias",
    filterAriaClear: "Limpar filtro",
    vendorOfferTooltip: "Ofertado no MyP Cards pelo vendedor {vendor}",
    groupTotalCost: "Total ~R$ {total}",
  },
  watchlist: {
    bannerTitle: "Painel de Watchlist no MyP",
    bannerWatching: "{count} Acompanhadas no MyP",
    bannerPendingAdd: "+{count} para Adicionar",
    bannerPendingUpdate: "~{count} Atualizações de Qtd",
    bannerPendingRemove: "-{count} Cumpridas para Remover",
    syncNowBtn: "Sincronizar Agora",
    syncingBtn: "Sincronizando...",
    syncSuccessToast: "Sincronização MyP: +{adds} ~{updates} -{removes}",
    browserBridgeBtn: "Script para Navegador",
    statusWatching: "Acompanhada no MyP",
    statusPendingAdd: "Adição Pendente",
    statusPendingUpdate: "Atualização de Qtd Pendente",
    statusPendingRemove: "Cota Preenchida · Remoção Pendente",
    statusIgnored: "Ignorada (Excluída no MyP)",
    reEnableWatchBtn: "Reativar Monitoramento",
    reEnablingBtn: "Reativando...",
    policyHardLabel: "Compra Necessária",
    policySharedLabel: "Revezamento entre Decks",
    policyStaplesLabel: "Staples de Torneio",
  },
  securityModal: {
    title: "Ponte com Script Auditável para Navegador",
    subtitle: "Revise o código-fonte antes de habilitar a sincronização automatizada via navegador no MyPCards.com.",
    viewGithubSource: "Ver código-fonte completo no GitHub",
    installationSteps: "Passos para Instalação e Execução:",
    step1: "1. Instale a extensão Tampermonkey ou Violentmonkey em seu navegador.",
    step2: "2. Instale ou cole o script abaixo no gerenciador de scripts.",
    step3: "3. Acesse mypcards.com para visualizar a barra de confirmação antes de aplicar qualquer alteração.",
    consentCheckbox: "Revisei o código-fonte do script e autorizo a sincronização da minha lista de quero no mypcards.com",
    copyScriptBtn: "Copiar Código do Script",
    copiedToast: "Script copiado para a área de transferência!",
    closeBtn: "Fechar",
  },
  fulfillment: {
    title: "Separação de Envios (Fulfillment)",
    subtitle: "Lista de coleta por Elemento e conferência fotográfica de pacotes do MyP Cards.",
    tabListings: "Anúncios da Loja",
    tabFulfillment: "Separação de Envios",
    tabPickList: "1. Pick List (Por Elemento)",
    tabBuyerPacks: "2. Buyer Packs (Por Comprador)",
    summaryHeader: "{orders} Pedidos GA · {copies} Cartas no Total",
    nonGaNoticeTitle: "Pedidos de Outros TCGs Detectados ({count})",
    nonGaNoticeDesc: "Estes pedidos contêm itens de outros jogos e foram isolados da sua pick list de GA:",
    nonGaNoticeLink: "Abrir Pedido #{orderId} no MyP ↗",
    emptyStateTitle: "Nenhum lote de separação ativo",
    emptyStateDesc: "Acesse o MyPCards /vendas com o script de navegador e clique em 'Separar Envios' para carregar os pedidos aqui.",
    openMypVendasBtn: "Abrir Vendas no MyP ↗",
    copyTextBtn: "Copiar Texto da Lista",
    copiedToast: "Lista de separação copiada para a área de transferência!",
    clearBatchBtn: "Limpar Lote",
    batchClearedToast: "Lote de separação ativo removido",
    shipCombinedBadge: "ENVIAR JUNTOS ({count} PEDIDOS)",
    shippingLabel: "Envio: {method}",
    orderCompletedLabel: "Pedido Concluído / Fotografado",
    orderPhotoDoneToast: "Pedido #{orderId} marcado como concluído / fotografado",
    elementGroupCount: "{count} carta(s)",
    ordersRef: "Pedidos: {refs}",
    openOrderLink: "Abrir #{orderId} no MyP ↗",
    totalPrice: "Unitário: {price}",
    cardsToPull: "{count} cartas para pegar",
  },
};

export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationCatalog>;

export function resolveLocale(input?: string | null): SupportedLocale {
  if (!input) return DEFAULT_LOCALE;
  const clean = input.trim().toLowerCase();
  if (clean.startsWith("pt")) return "pt-BR";
  return "en";
}

export function formatLocaleNumber(value: number, locale: SupportedLocale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US").format(value);
}

export function createTranslator(locale: SupportedLocale = DEFAULT_LOCALE) {
  const catalog = locale === "pt-BR" ? ptBRCatalog : enCatalog;

  return function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    const parts = key.split(".");
    let current: unknown = catalog;

    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return key;
      }
    }

    if (typeof current !== "string") {
      return key;
    }

    if (vars) {
      return current.replace(/\{(\w+)\}/g, (_, k) => {
        return k in vars ? String(vars[k]) : `{${k}}`;
      });
    }

    return current;
  };
}
