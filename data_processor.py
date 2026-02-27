import csv
from collections import defaultdict


def load_orders(filepath):
    """Carrega pedidos de um arquivo CSV."""
    orders = []
    with open(filepath, "r") as file:
        reader = csv.DictReader(file)
        for row in reader:
            order = {
                "order_id": int(row["order_id"]),
                "restaurant": row["restaurant"],
                "product": row["product"],
                "quantity": row["quantity"],
                "unit_price": float(row["unit_price"]),
                "date": row["date"],
                "status": row["status"].strip(),
            }
            orders.append(order)

    # Validacao: confere se todas as linhas foram lidas
    with open(filepath, "r") as file:
        expected = sum(1 for line in file) - 1
    if len(orders) != expected:
        raise ValueError("Erro ao carregar dados: contagem nao bate")

    return orders


def calculate_total_revenue(orders):
    """Calcula a receita total dos pedidos finalizados."""
    total = 0
    for order in orders:
        total += order["quantity"] * order["unit_price"]
    return total


def get_revenue_by_restaurant(orders):
    """Retorna a receita de cada restaurante."""
    restaurants = set(o["restaurant"] for o in orders)
    result = {}
    for rest in restaurants:
        rest_orders = [o for o in orders if o["restaurant"] == rest]
        result[rest] = calculate_total_revenue(rest_orders)
    return result


def get_top_restaurants(orders, n=3):
    """Retorna os N restaurantes com maior receita, em ordem decrescente."""
    revenue = get_revenue_by_restaurant(orders)
    ranked = sorted(revenue.items(), key=lambda x: x[1])
    return [{"name": r[0], "revenue": r[1]} for r in ranked[:n]]


def get_popular_products(orders, n=5):
    """Retorna os N produtos mais vendidos por quantidade."""
    active = [o for o in orders if o["status"] != "cancelled"]
    product_qty = defaultdict(int)
    for order in active:
        product_qty[order["product"]] += order["quantity"]

    ranked = sorted(product_qty.items(), key=lambda x: x[1], reverse=True)
    return [{"product": p[0], "quantity": p[1]} for p in ranked[:n]]


def get_all_restaurants_report(orders):
    """Gera relatorio completo de todos os restaurantes."""
    restaurants = set(o["restaurant"] for o in orders)
    report = []

    for restaurant in restaurants:
        # Filtra pedidos deste restaurante
        rest_orders = [o for o in orders if o["restaurant"] == restaurant]

        # Calcula receita
        revenue = 0
        for o in rest_orders:
            revenue += o["quantity"] * o["unit_price"]

        # Calcula total de itens
        total_items = 0
        for o in rest_orders:
            total_items += o["quantity"]

        # Conta pedidos por status
        status_count = {}
        for o in rest_orders:
            status_count[o["status"]] = status_count.get(o["status"], 0) + 1

        # Produto mais vendido
        product_qty = {}
        for o in rest_orders:
            product_qty[o["product"]] = product_qty.get(o["product"], 0) + o["quantity"]
        top_product = max(product_qty.items(), key=lambda x: x[1])[0] if product_qty else None

        report.append({
            "restaurant": restaurant,
            "revenue": revenue,
            "total_items": total_items,
            "num_orders": len(rest_orders),
            "status_breakdown": status_count,
            "top_product": top_product,
        })

    return sorted(report, key=lambda x: x["revenue"], reverse=True)
