"use client";

import { useEffect, useState } from "react";
import {
  fetchWithTimeout,
  getCardDetail,
  loadCardCatalog,
  type CardDetail,
  type CardName,
} from "./card-catalog";
import {
  createIndexedDbDetailCache,
  type CardDetailCache,
} from "./card-detail-cache";
import { browserStorage } from "./table-session";

export type CardCatalogStatus = "loading" | "ready" | "error";

export interface CardCatalogState {
  cards: CardName[];
  status: CardCatalogStatus;
  /** True when the network failed and an older cache is being used. */
  stale: boolean;
}

const cardFetch = fetchWithTimeout();

let browserDetailCache: CardDetailCache | null = null;

function detailCache(): CardDetailCache {
  if (!browserDetailCache) {
    browserDetailCache = createIndexedDbDetailCache();
  }
  return browserDetailCache;
}

/** The shared browser detail cache, for callers outside the card widgets. */
export function getCardDetailCache(): CardDetailCache {
  return detailCache();
}

/** Load `/cards/all` once per Table mount, with the seven-day localStorage cache. */
export function useCardCatalog(): CardCatalogState {
  const [state, setState] = useState<CardCatalogState>({
    cards: [],
    status: "loading",
    stale: false,
  });

  useEffect(() => {
    let cancelled = false;
    loadCardCatalog(cardFetch, browserStorage())
      .then((result) => {
        if (!cancelled) {
          setState({ cards: result.cards, status: "ready", stale: result.stale });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ cards: [], status: "error", stale: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export interface CardDetailState {
  detail: CardDetail | null;
  loading: boolean;
}

const loadedDetails = new Map<string, CardDetail>();
const inFlightDetails = new Map<string, Promise<CardDetail | null>>();

/** On-demand card detail for one slug; the cache is shared by every card widget. */
export function useCardDetail(slug: string | null | undefined): CardDetailState {
  const [state, setState] = useState<CardDetailState>(() => ({
    detail: slug ? loadedDetails.get(slug) ?? null : null,
    loading: !!slug && !loadedDetails.has(slug),
  }));

  useEffect(() => {
    if (!slug) {
      setState({ detail: null, loading: false });
      return;
    }

    const known = loadedDetails.get(slug);
    if (known) {
      setState({ detail: known, loading: false });
      return;
    }

    let cancelled = false;
    setState({ detail: null, loading: true });
    // CardArt and PinCardLabel ask for the same slug in one render; share the
    // one request instead of fetching the card twice.
    let request = inFlightDetails.get(slug);
    if (!request) {
      request = getCardDetail(slug, cardFetch, detailCache()).finally(() => {
        inFlightDetails.delete(slug);
      });
      inFlightDetails.set(slug, request);
    }
    request
      .then((detail) => {
        if (cancelled) return;
        if (detail) loadedDetails.set(slug, detail);
        setState({ detail, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ detail: null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state;
}

/** Test seam: clear the module-level card caches between cases. */
export function resetCardCachesForTest(): void {
  browserDetailCache = null;
  loadedDetails.clear();
  inFlightDetails.clear();
}

/** Find a chosen printing, falling back to the default first printing. */
export function selectPrinting(detail: CardDetail | null, printingSlug?: string) {
  if (!detail || detail.editions.length === 0) return null;
  if (!printingSlug) return detail.editions[0];
  return detail.editions.find((printing) => printing.slug === printingSlug) ?? detail.editions[0];
}

