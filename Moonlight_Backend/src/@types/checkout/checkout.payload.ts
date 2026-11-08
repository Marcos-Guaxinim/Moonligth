import type { CartItem } from "@shared/types/cartItem.js";

export interface CheckoutQueryPayload{
  items: CartItem[];
  total: number;
  user: {
    id_user: number,
    name: string
  }
}
