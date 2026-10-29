/**
 * Root App bilingual translation catalogs (en & pt-BR).
 * Follows ADR 0011 (compile-time parity) and ADR 0012 (file size limit).
 * Game Nomenclature (Main Deck, Material Deck, Sideboard, Foil) remains canonical English.
 */
export declare const rootAppEnCatalog: {
    title: string;
    subtitle: string;
    refresh: string;
    connectionTimeout: string;
    loadDecksError: string;
    serviceUnavailableBanner: string;
    footerNomenclature: string;
    switchToEnglish: string;
    switchToPortuguese: string;
    accountLink: {
        titleConnected: string;
        titleUnlinked: string;
        subtitleConnected: string;
        subtitleUnlinked: string;
        statusConnected: string;
        statusUnlinked: string;
        labelCollector: string;
        labelFriendCode: string;
        newToTitle: string;
        newToDesc: string;
        registerButton: string;
        alreadyHaveAccount: string;
        portalSettingsLink: string;
        placeholderCode: string;
        buttonLink: string;
        buttonGetCode: string;
        errEnterCode: string;
        errInvalidCode: string;
        errExpiredCode: string;
        errLinkFailed: string;
        errRegisterFailed: string;
        errNetworkRpc: string;
    };
    dealAlerts: {
        title: string;
        subtitle: string;
        scopeModeLabel: string;
        allShortagesTitle: string;
        allShortagesDesc: string;
        hardOnlyTitle: string;
        hardOnlyDesc: string;
        deliveringToChannel: string;
        updatingPreferences: string;
    };
    decksDashboard: {
        title: string;
        subtitle: string;
        importDeckButton: string;
        deckCountSingle: string;
        deckCountPlural: string;
        unlinkedEmpty: string;
        loadingDecks: string;
        noDecksEmpty: string;
        championLabel: string;
        noneChampion: string;
        totalCards: string;
        completeBadge: string;
        hardBadge: string;
        sharedBadge: string;
        editDeckAria: string;
        hardShortagesHeading: string;
        sharedShortagesHeading: string;
        completeMessage: string;
        legendShortages: string;
        legendHard: string;
        legendShared: string;
    };
    deckForms: {
        tabUrl: string;
        tabText: string;
        closeImportAria: string;
        urlLabel: string;
        urlPlaceholder: string;
        textLabel: string;
        importButton: string;
        importing: string;
        errImportFailed: string;
        errFailedToImport: string;
        editTitle: string;
        cancelButton: string;
        deckNameLabel: string;
        deckNamePlaceholder: string;
        tabEditText: string;
        tabEditUrl: string;
        saveChangesButton: string;
        savingChanges: string;
        errUpdateFailed: string;
        errFailedToUpdate: string;
    };
    wantlist: {
        title: string;
        subtitle: string;
        wantedCount: string;
        addCardHeading: string;
        searchPlaceholder: string;
        qtyLabel: string;
        preferFoil: string;
        addButton: string;
        adding: string;
        importGapHeading: string;
        importGapDesc: string;
        importGapButton: string;
        importingGap: string;
        currentItemsHeading: string;
        loadingItems: string;
        noItemsEmpty: string;
        foilBadge: string;
        wantedQuantity: string;
        decrementTitle: string;
        removeTitle: string;
        msgAdded: string;
        msgRemoved: string;
        msgDecremented: string;
        msgImportedGap: string;
        errAddFailed: string;
        errRemoveFailed: string;
        errImportGapFailed: string;
        errServiceComms: string;
        errOmnidexParse: string;
    };
    nomenclature: {
        guideTitle: string;
        guideSubtitle: string;
        viewGuide: string;
        terms: {
            shortages: {
                title: string;
                tooltip: string;
                desc: string;
                example: string;
            };
            hardShortages: {
                title: string;
                tooltip: string;
                desc: string;
                example: string;
            };
            sharedShortages: {
                title: string;
                tooltip: string;
                desc: string;
                example: string;
            };
            alertScope: {
                title: string;
                tooltip: string;
                desc: string;
                example: string;
            };
            wantlist: {
                title: string;
                tooltip: string;
                desc: string;
                example: string;
            };
            omnidexFormat: {
                title: string;
                tooltip: string;
                desc: string;
                example: string;
            };
        };
    };
};
export declare const rootAppPtCatalog: typeof rootAppEnCatalog;
