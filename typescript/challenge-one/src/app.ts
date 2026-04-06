import express from "express";
import path from "path";
import {
  loadOrders,
  calculateTotalRevenue,
  getRevenueByRestaurant,
  getTopRestaurants,
  getPopularProducts,
  getAllRestaurantsReport,
  Order,
} from "./data-processor";

const app = express();

let cachedOrders: Order[] | null = null;

function getOrders(): Order[] {
  if (!cachedOrders) {
    cachedOrders = loadOrders(path.join(__dirname, "..", "orders.csv"));
  }
  return cachedOrders;
}

// Receita total
app.get("/api/revenue", (_req, res) => {
  const orders = getOrders();
  const total = calculateTotalRevenue(orders);
  res.json({ total_revenue: total });
});

// Receita por restaurante
app.get("/api/revenue/restaurant", (_req, res) => {
  const orders = getOrders();
  const result = getRevenueByRestaurant(orders);
  res.json(result);
});

// Top restaurantes por receita
app.get("/api/restaurants/tpo", (req, res) => {
  const orders = getOrders();
  const n = Number(req.query.n) || 3;
  const result = getTopRestaurants(orders, n);
  res.json({ top_restaurants: result });
});

// Produtos populares
app.get("/api/products/popular", (req, res) => {
  const orders = getOrders();
  const n = Number(req.query.n) || 5;
  const result = getPopularProducts(orders, n);
  res.json({ popular_products: result });
});

// Relatorio completo
app.get("/api/restaurants/report", (_req, res) => {
  const orders = getOrders();
  const result = getAllRestaurantsReport(orders);
  res.json({ report: result });
});

// Resumo geral
app.get("/api/summary", (_req, res) => {
  const orders = getOrders();
  const active = orders.filter((o) => o.status !== "cancelled");

  const totalRevenue = calculateTotalRevenue(orders);
  const totalItems = active.reduce((sum, o) => sum + o.quantity, 0);

  res.json({
    total_orders: active.length,
    cancelled_orders: orders.length - active.length,
    total_revenue: totalRevenue,
    total_items_sold: totalItems,
  });
});

const PORT = 5050;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
