export interface CollectionItem {
  id: string;
  editionId: string;
  cardSlug: string;
  cardName: string;
  element: string;
  class: string;
  type: string;
  setPrefix: string;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
  foil: boolean;
  quantity: number;
  isDedicated: boolean;
  population: number;
  isLowPop: boolean;
  activeDeckUsages: number;
  idleQuantity: number;
}

export interface CollectionActions {
  onQuantity: (item: CollectionItem, delta: number) => void;
  onToggleDedicated: (item: CollectionItem) => void;
}
