import type { CartItem } from "@shared/types/cartItem.js";

export interface PurchasedItemsDTO {
  id_order: number;
  items: CartItem[];
}


export interface CreatePurchasedItemsDTO{
  id_order: number,
  id_game: number, 
  price: number
}