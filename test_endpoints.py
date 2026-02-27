"""
Script de teste para validar os endpoints da API.
Rode este script com o servidor ligado (python app.py) para ver quais endpoints
estao funcionando corretamente e quais estao com problemas.

Uso:
    python test_endpoints.py
"""

import urllib.request
import urllib.error
import json
import sys


BASE_URL = "http://localhost:5050"

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD = "\033[1m"


def fetch(path):
    """Faz GET para o endpoint e retorna o JSON parseado."""
    try:
        url = BASE_URL + path
        req = urllib.request.urlopen(url)
        return json.loads(req.read().decode()), None
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.reason}"
    except urllib.error.URLError as e:
        return None, f"Servidor inacessivel: {e.reason}"
    except Exception as e:
        return None, str(e)


def check(label, actual, expected):
    """Compara valor atual com esperado."""
    if actual == expected:
        print(f"  {GREEN}PASS{RESET} {label}")
        print(f"         Esperado: {expected}")
        return True
    else:
        print(f"  {RED}FAIL{RESET} {label}")
        print(f"         Esperado: {expected}")
        print(f"         Recebido: {actual}")
        return False


def check_approx(label, actual, expected, tolerance=0.01):
    """Compara floats com tolerancia."""
    if actual is not None and abs(actual - expected) < tolerance:
        print(f"  {GREEN}PASS{RESET} {label}")
        print(f"         Esperado: ~{expected}")
        return True
    else:
        print(f"  {RED}FAIL{RESET} {label}")
        print(f"         Esperado: ~{expected}")
        print(f"         Recebido: {actual}")
        return False


def test_endpoint(name, path, checks_fn):
    """Testa um endpoint: faz a request e roda as checagens."""
    print(f"\n{BOLD}--- {name} ---{RESET}")
    print(f"    GET {path}")

    data, error = fetch(path)

    if error:
        print(f"  {RED}ERRO{RESET} Nao foi possivel acessar o endpoint")
        print(f"         {error}")
        return 0, 1

    passed = 0
    failed = 0
    for result in checks_fn(data):
        if result:
            passed += 1
        else:
            failed += 1
    return passed, failed


def main():
    print(f"{BOLD}Verificando se o servidor esta rodando...{RESET}")
    try:
        urllib.request.urlopen(BASE_URL + "/api/revenue")
        print(f"{GREEN}Servidor OK!{RESET}")
    except urllib.error.HTTPError:
        print(f"{GREEN}Servidor OK!{RESET} (endpoints com erro — esperado)")
    except urllib.error.URLError as e:
        print(f"\n{RED}ERRO: O servidor nao esta acessivel em {BASE_URL}{RESET}")
        print("Certifique-se de que voce rodou: python app.py")
        print(f"Erro: {e.reason}")
        sys.exit(1)

    total_passed = 0
    total_failed = 0

    # =============================================
    # TESTE 1: Receita total (deve excluir cancelados)
    # =============================================
    p, f = test_endpoint(
        "Teste 1: Receita Total (excluindo pedidos cancelados)",
        "/api/revenue",
        lambda data: [
            check_approx("total_revenue", data.get("total_revenue"), 978.10),
        ]
    )
    total_passed += p
    total_failed += f

    # =============================================
    # TESTE 2: Receita por restaurante
    # =============================================
    p, f = test_endpoint(
        "Teste 2: Receita por Restaurante (excluindo cancelados)",
        "/api/revenue/restaurant",
        lambda data: [
            check_approx("Sushi Place", data.get("Sushi Place"), 384.90),
            check_approx("Burger House", data.get("Burger House"), 202.20),
        ]
    )
    total_passed += p
    total_failed += f

    # =============================================
    # TESTE 3: Top restaurantes
    # =============================================
    p, f = test_endpoint(
        "Teste 3: Top 3 Restaurantes (maior receita primeiro)",
        "/api/restaurants/top",
        lambda data: [
            check(
                "Ordem correta",
                [r["name"] for r in data.get("top_restaurants", [])],
                ["Sushi Place", "Pizza Roma", "Burger House"],
            ),
            check_approx(
                "Receita do #1 (Sushi Place)",
                data.get("top_restaurants", [{}])[0].get("revenue") if data.get("top_restaurants") else None,
                384.90,
            ),
        ]
    )
    total_passed += p
    total_failed += f

    # =============================================
    # TESTE 4: Produtos populares
    # =============================================
    p, f = test_endpoint(
        "Teste 4: Produtos Mais Populares",
        "/api/products/popular",
        lambda data: [
            check(
                "Produto #1 e Milkshake (5 unidades)",
                data.get("popular_products", [{}])[0].get("product") if data.get("popular_products") else None,
                "Milkshake",
            ),
            check(
                "Quantidade do #1",
                data.get("popular_products", [{}])[0].get("quantity") if data.get("popular_products") else None,
                5,
            ),
        ]
    )
    total_passed += p
    total_failed += f

    # =============================================
    # TESTE 5: Resumo geral
    # =============================================
    p, f = test_endpoint(
        "Teste 5: Resumo Geral",
        "/api/summary",
        lambda data: [
            check("total_orders (sem cancelados)", data.get("total_orders"), 12),
            check("cancelled_orders", data.get("cancelled_orders"), 3),
            check_approx("total_revenue", data.get("total_revenue"), 978.10),
            check("total_items_sold", data.get("total_items_sold"), 28),
        ]
    )
    total_passed += p
    total_failed += f

    # =============================================
    # RESULTADO FINAL
    # =============================================
    total = total_passed + total_failed
    print(f"\n{'='*50}")
    print(f"{BOLD}RESULTADO FINAL: {total_passed}/{total} testes passando{RESET}")

    if total_failed == 0:
        print(f"{GREEN}Todos os testes passaram! Parabens!{RESET}")
    else:
        print(f"{RED}{total_failed} teste(s) falhando{RESET}")
        print(f"\n{YELLOW}Dica: corrija os bugs um de cada vez e rode este script novamente.{RESET}")

    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
