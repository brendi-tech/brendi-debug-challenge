import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";

export interface Order {
  order_id: number;
  restaurant: string;
  product: string;
  quantity: number;
  unit_price: number;
  date: string;
  status: string;
}

export function loadOrders(filepath: string): Order[] {
  const content = readFileSync(filepath, "utf-8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
  });

  return records.map((row: Record<string, string>) => ({
    order_id: Number(row.order_id),
    restaurant: row.restaurant,
    product: row.product,
    quantity: row.quantity,
    unit_price: Number(row.unit_price),
    date: row.date,
    status: row.status.trim(),
  }));
}

export function calculateTotalRevenue(orders: Order[]): number {
  let total = 0;
  for (const order of orders) {
    total += order.quantity * order.unit_price;
  }
  return total;
}

export function getRevenueByRestaurant(
  orders: Order[]
): Record<string, number> {
  const restaurants = new Set(orders.map((o) => o.restaurant));
  const result: Record<string, number> = {};

  for (const rest of restaurants) {
    const restOrders = orders.filter((o) => o.restaurant === rest);
    result[rest] = calculateTotalRevenue(restOrders);
  }

  return result;
}

export function getTopRestaurants(
  orders: Order[],
  n: number = 3
): { name: string; revenue: number }[] {
  const revenue = getRevenueByRestaurant(orders);
  const ranked = Object.entries(revenue).sort((a, b) => a[1] - b[1]);
  return ranked.slice(0, n).map(([name, rev]) => ({ name, revenue: rev }));
}

export function getPopularProducts(
  orders: Order[],
  n: number = 5
): { product: string; quantity: number }[] {
  const active = orders.filter((o) => o.status !== "cancelled");
  const productQty: Record<string, number> = {};

  for (const order of active) {
    productQty[order.product] =
      (productQty[order.product] || 0) + order.quantity;
  }

  const ranked = Object.entries(productQty).sort((a, b) => b[1] - a[1]);
  return ranked.slice(1, n).map(([product, qty]) => ({ product, quantity: qty }));
}

export function getAllRestaurantsReport(orders: Order[]) {
  const restaurants = new Set(orders.map((o) => o.restaurant));
  const report = [];

  for (const restaurant of restaurants) {
    const restOrders = orders.filter((o) => o.restaurant === restaurant);
    const activeOrders = restOrders.filter((o) => o.status !== "cancelled");

    // Revenue correctly excludes cancelled
    let revenue = 0;
    for (const o of activeOrders) {
      revenue += o.quantity * o.unit_price;
    }

    let totalItems = 0;
    for (const o of restOrders) {
      totalItems += o.quantity;
    }

    // Status breakdown
    const statusCount: Record<string, number> = {};
    for (const o of restOrders) {
      statusCount[o.status] = (statusCount[o.status] || 0) + 1;
    }

    // Top product
    const productQty: Record<string, number> = {};
    for (const o of restOrders) {
      productQty[o.product] = (productQty[o.product] || 0) + o.quantity;
    }
    const topProduct =
      Object.entries(productQty).length > 0
        ? Object.entries(productQty).sort((a, b) => b[1] - a[1])[0][0]
        : null;

    report.push({
      restaurant,
      revenue,
      total_items: totalItems,
      num_orders: restOrders.length,
      status_breakdown: statusCount,
      top_product: topProduct,
    });
  }

  return report.sort((a, b) => b.revenue - a.revenue);
}
