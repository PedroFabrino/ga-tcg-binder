export const deckKeys = {
  all: ["decks"] as const,
  lists: () => [...deckKeys.all, "list"] as const,
  list: (userId?: string | null) => [...deckKeys.lists(), { userId: userId ?? null }] as const,
  details: () => [...deckKeys.all, "detail"] as const,
  detail: (id: string) => [...deckKeys.details(), id] as const,
  shortagesPrefix: () => [...deckKeys.all, "shortages"] as const,
  shortages: (userId?: string | null) => [...deckKeys.shortagesPrefix(), { userId: userId ?? null }] as const,
};

export const collectionKeys = {
  all: ["collection"] as const,
  views: () => [...collectionKeys.all, "view"] as const,
  view: (view: string, userId?: string | null) =>
    [...collectionKeys.views(), { view, userId: userId ?? null }] as const,
};

export const catalogKeys = {
  all: ["catalog"] as const,
  lists: () => [...catalogKeys.all, "list"] as const,
  list: (params: Record<string, string | number | boolean | null | undefined>) =>
    [...catalogKeys.lists(), params] as const,
};

export const metaKeys = {
  all: ["meta"] as const,
  lists: () => [...metaKeys.all, "list"] as const,
  list: (userId?: string | null) => [...metaKeys.lists(), { userId: userId ?? null }] as const,
};

export const setsKeys = {
  all: ["sets"] as const,
  dashboardPrefix: () => [...setsKeys.all, "dashboard"] as const,
  dashboard: (target?: string | null, userId?: string | null) =>
    [...setsKeys.dashboardPrefix(), { target: target ?? "all", userId: userId ?? null }] as const,
  lists: () => [...setsKeys.all, "list"] as const,
  list: (userId?: string | null) => [...setsKeys.lists(), { userId: userId ?? null }] as const,
  details: () => [...setsKeys.all, "detail"] as const,
  detail: (groupSlug: string, target?: string | null, userId?: string | null) =>
    [...setsKeys.details(), groupSlug, { target: target ?? "all", userId: userId ?? null }] as const,
};

export const settingsKeys = {
  all: ["settings"] as const,
  current: (userId?: string | null) =>
    [...settingsKeys.all, "current", { userId: userId ?? null }] as const,
  identities: () => [...settingsKeys.all, "identities"] as const,
};

export const marketplaceKeys = {
  all: ["marketplace"] as const,
  fulfillment: (status?: string) => [...marketplaceKeys.all, "fulfillment", status ?? "all"] as const,
  shipping: (withOrders?: boolean) => [...marketplaceKeys.all, "shipping", { withOrders: Boolean(withOrders) }] as const,
};

export const friendsKeys = {
  all: ["friends"] as const,
  list: (userId?: string | null) => [...friendsKeys.all, "list", { userId: userId ?? null }] as const,
};
