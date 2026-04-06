/**
 * Script de teste para validar os endpoints da API.
 * Rode este script com o servidor ligado (npm start) para ver quais endpoints
 * estao funcionando corretamente e quais estao com problemas.
 *
 * Uso:
 *   npm test
 */

import http from "http";

const BASE_URL = "http://localhost:5050";

const GREEN = "\x1b[92m";
const RED = "\x1b[91m";
const YELLOW = "\x1b[93m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function fetch(path: string): Promise<{ data: any; error: string | null }> {
  return new Promise((resolve) => {
    http
      .get(`${BASE_URL}${path}`, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ data: JSON.parse(body), error: null });
          } catch {
            resolve({ data: null, error: `Invalid JSON: ${body}` });
          }
        });
      })
      .on("error", (err) => {
        resolve({ data: null, error: `Servidor inacessivel: ${err.message}` });
      });
  });
}

function check(label: string, actual: any, expected: any): boolean {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ${GREEN}PASS${RESET} ${label}`);
    console.log(`         Esperado: ${JSON.stringify(expected)}`);
    return true;
  } else {
    console.log(`  ${RED}FAIL${RESET} ${label}`);
    console.log(`         Esperado: ${JSON.stringify(expected)}`);
    console.log(`         Recebido: ${JSON.stringify(actual)}`);
    return false;
  }
}

function checkApprox(
  label: string,
  actual: any,
  expected: number,
  tolerance = 0.01
): boolean {
  if (actual !== null && actual !== undefined && Math.abs(actual - expected) < tolerance) {
    console.log(`  ${GREEN}PASS${RESET} ${label}`);
    console.log(`         Esperado: ~${expected}`);
    return true;
  } else {
    console.log(`  ${RED}FAIL${RESET} ${label}`);
    console.log(`         Esperado: ~${expected}`);
    console.log(`         Recebido: ${actual}`);
    return false;
  }
}

interface TestResult {
  passed: number;
  failed: number;
}

async function testEndpoint(
  name: string,
  path: string,
  checksFn: (data: any) => boolean[]
): Promise<TestResult> {
  console.log(`\n${BOLD}--- ${name} ---${RESET}`);
  console.log(`    GET ${path}`);

  const { data, error } = await fetch(path);

  if (error) {
    console.log(`  ${RED}ERRO${RESET} Nao foi possivel acessar o endpoint`);
    console.log(`         ${error}`);
    return { passed: 0, failed: 1 };
  }

  let passed = 0;
  let failed = 0;
  for (const result of checksFn(data)) {
    if (result) passed++;
    else failed++;
  }
  return { passed, failed };
}

async function main() {
  console.log(`${BOLD}Verificando se o servidor esta rodando...${RESET}`);

  const { error } = await fetch("/api/revenue");
  if (error && error.includes("inacessivel")) {
    console.log(
      `\n${RED}ERRO: O servidor nao esta acessivel em ${BASE_URL}${RESET}`
    );
    console.log("Certifique-se de que voce rodou: npm start");
    console.log(`Erro: ${error}`);
    process.exit(1);
  }
  console.log(`${GREEN}Servidor OK!${RESET}`);

  let totalPassed = 0;
  let totalFailed = 0;

  // =============================================
  // TESTE 1: Receita total (deve excluir cancelados)
  // =============================================
  let r = await testEndpoint(
    "Teste 1: Receita Total (excluindo pedidos cancelados)",
    "/api/revenue",
    (data) => [checkApprox("total_revenue", data?.total_revenue, 978.1)]
  );
  totalPassed += r.passed;
  totalFailed += r.failed;

  // =============================================
  // TESTE 2: Receita por restaurante
  // =============================================
  r = await testEndpoint(
    "Teste 2: Receita por Restaurante (excluindo cancelados)",
    "/api/revenue/restaurant",
    (data) => [
      checkApprox("Sushi Place", data?.["Sushi Place"], 384.9),
      checkApprox("Burger House", data?.["Burger House"], 202.2),
    ]
  );
  totalPassed += r.passed;
  totalFailed += r.failed;

  // =============================================
  // TESTE 3: Top restaurantes
  // =============================================
  r = await testEndpoint(
    "Teste 3: Top 3 Restaurantes (maior receita primeiro)",
    "/api/restaurants/top",
    (data) => [
      check(
        "Ordem correta",
        data?.top_restaurants?.map((r: any) => r.name),
        ["Sushi Place", "Pizza Roma", "Burger House"]
      ),
      checkApprox(
        "Receita do #1 (Sushi Place)",
        data?.top_restaurants?.[0]?.revenue,
        384.9
      ),
    ]
  );
  totalPassed += r.passed;
  totalFailed += r.failed;

  // =============================================
  // TESTE 4: Produtos populares
  // =============================================
  r = await testEndpoint(
    "Teste 4: Produtos Mais Populares",
    "/api/products/popular",
    (data) => [
      check(
        "Produto #1 e Milkshake (5 unidades)",
        data?.popular_products?.[0]?.product,
        "Milkshake"
      ),
      check(
        "Quantidade do #1",
        data?.popular_products?.[0]?.quantity,
        5
      ),
    ]
  );
  totalPassed += r.passed;
  totalFailed += r.failed;

  // =============================================
  // TESTE 5: Resumo geral
  // =============================================
  r = await testEndpoint(
    "Teste 5: Resumo Geral",
    "/api/summary",
    (data) => [
      check("total_orders (sem cancelados)", data?.total_orders, 12),
      check("cancelled_orders", data?.cancelled_orders, 3),
      checkApprox("total_revenue", data?.total_revenue, 978.1),
      check("total_items_sold", data?.total_items_sold, 28),
    ]
  );
  totalPassed += r.passed;
  totalFailed += r.failed;

  // =============================================
  // RESULTADO FINAL
  // =============================================
  const total = totalPassed + totalFailed;
  console.log(`\n${"=".repeat(50)}`);
  console.log(`${BOLD}RESULTADO FINAL: ${totalPassed}/${total} testes passando${RESET}`);

  if (totalFailed === 0) {
    console.log(`${GREEN}Todos os testes passaram! Parabens!${RESET}`);
  } else {
    console.log(`${RED}${totalFailed} teste(s) falhando${RESET}`);
    console.log(
      `\n${YELLOW}Dica: corrija os bugs um de cada vez e rode este script novamente.${RESET}`
    );
  }

  console.log(`${"=".repeat(50)}\n`);
}

main();
