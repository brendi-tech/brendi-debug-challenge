from flask import Flask, jsonify, request
from data_processor import (
    load_orders,
    calculate_total_revenue,
    get_revenue_by_restaurant,
    get_top_restaurants,
    get_popular_products,
    get_all_restaurants_report,
)

app = Flask(__name__)

DATA_CACHE = {}


def get_data():
    if not DATA_CACHE:
        DATA_CACHE["orders"] = load_orders("orders.csv")
    return DATA_CACHE["orders"]


@app.route("/api/revenue", methods=["GET"])
def revenue():
    """Retorna a receita total."""
    orders = get_data()
    total = calculate_total_revenue(orders)
    return jsonify({"total_revenue": total})


@app.route("/api/revenue/restaurant", methods=["GET"])
def revenue_by_restaurant():
    """Retorna receita por restaurante."""
    orders = get_data()
    result = get_revenue_by_restaurant(orders)
    return jsonify(result)


@app.route("/api/restaurants/top", methods=["GET"])
def top_restaurants():
    """Retorna os top N restaurantes por receita."""
    orders = get_data()
    n = int(request.args.get("n", 3))
    result = get_top_restaurants(orders, n)
    return jsonify({"top_restaurants": result})


@app.route("/api/products/popular", methods=["GET"])
def popular_products():
    """Retorna os produtos mais vendidos."""
    orders = get_data()
    n = int(request.args.get("n", 5))
    result = get_popular_products(orders, n)
    return jsonify({"popular_products": result})


@app.route("/api/restaurants/report", methods=["GET"])
def restaurants_report():
    """Retorna relatorio completo de todos os restaurantes."""
    orders = get_data()
    result = get_all_restaurants_report(orders)
    return jsonify({"report": result})


@app.route("/api/summary", methods=["GET"])
def summary():
    """Retorna resumo geral dos pedidos."""
    orders = get_data()
    active = [o for o in orders if o["status"] != "cancelled"]

    total_revenue = calculate_total_revenue(orders)
    total_items = sum(o["quantity"] for o in active)

    result = {
        "total_orders": len(active),
        "cancelled_orders": len(orders) - len(active),
        "total_revenue": total_revenue,
        "total_items_sold": total_items,
    }
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5050)
