import type { CartItem } from "@shared/types/cartItem.js";

export interface PurchasedItemsQueryPayload {
  id_order: number;
  items: CartItem[];
}