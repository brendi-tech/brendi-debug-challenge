import { withClient } from "../db";

export interface RestaurantBalance {
  restaurant_id: string;
  name: string;
  balance: number;
  updated_at: string;
}

export async function findBalance(
  restaurantId: string
): Promise<RestaurantBalance | null> {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT b.restaurant_id, r.name, b.balance, b.updated_at
         FROM balances b
         JOIN restaurants r ON r.id = b.restaurant_id
        WHERE b.restaurant_id = $1`,
      [restaurantId]
    );

    if (rows.length === 0) {
      return null;
    }

    return { ...rows[0], balance: Number(rows[0].balance) };
  });
}
