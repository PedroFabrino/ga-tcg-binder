export type CollectionView = "ALL" | "STAPLES" | "LOW_POP" | "IDLE" | "MYP_STORE";

export const COLLECTION_VIEWS: CollectionView[] = ["ALL", "STAPLES", "LOW_POP", "IDLE", "MYP_STORE"];

export function isCollectionViewAvailable(view: CollectionView, hasVendorCapability: boolean): boolean {
  return view !== "MYP_STORE" || hasVendorCapability;
}

export function resolveCollectionView(
  search: string,
  hash: string,
  hasVendorCapability: boolean
): CollectionView {
  const params = new URLSearchParams(search);
  const requested = params.get("view");
  const wantsStore =
    params.get("fulfillment") === "1" ||
    hash.startsWith("#ga_fulfillment=") ||
    params.get("tab") === "myp-store" ||
    requested === "MYP_STORE";

  if (wantsStore && hasVendorCapability) return "MYP_STORE";

  const view = COLLECTION_VIEWS.find((candidate) => candidate === requested);
  return view && isCollectionViewAvailable(view, hasVendorCapability) ? view : "ALL";
}
