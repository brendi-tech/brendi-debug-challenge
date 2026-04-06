# Desafio Tecnico — Restaurant Orders API (TypeScript)

## Contexto

Voce acabou de entrar em um time que gerencia uma plataforma de pedidos para restaurantes. A API recebe dados de pedidos (CSV) e gera relatorios de receita, ranking de restaurantes e produtos populares.

O dev anterior saiu da empresa e o codigo esta com **bugs**. Alguns endpoints crasham, outros retornam dados incorretos.

## Requisitos

- **Node.js 18 ou superior**
- npm

## Como rodar

### Instalacao e execucao

```bash
npm install
npm start
```

O servidor sobe em `http://localhost:5050`.

## Sua missao

### Parte 1 — Debug (primeiros 30-40 min)

Temos um script de testes que valida todos os endpoints. Rode-o com o servidor ligado:

```bash
npm test
```

Voce vai ver varios testes falhando. Seu objetivo e **corrigir os bugs no codigo ate que todos os testes passem**.

**Fluxo sugerido:**
1. Rode `npm test` e veja quais testes falham
2. Comece pelo primeiro erro — geralmente indica o bug mais basico
3. Corrija o bug no codigo (reinicie o servidor se necessario)
4. Rode os testes de novo pra ver se mais testes passam
5. Repita ate todos passarem

> Dica: alguns bugs sao independentes, outros tem efeito cascata (corrigir um pode resolver outros automaticamente). Fique atento a isso.

### Parte 2 — Melhoria (ultimos 20-30 min)

Apos todos os testes passarem, melhore o codigo como achar necessario. Exemplos:
- Cobertura de testes (tem endpoint sem teste!)
- Performance e escalabilidade
- Tratamento de erros
- Organizacao / legibilidade
- Qualquer outra melhoria que voce faria ao receber esse codigo no dia-a-dia

## Endpoints disponiveis

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/revenue` | Receita total (exclui cancelados) |
| GET | `/api/revenue/restaurant` | Receita por restaurante |
| GET | `/api/restaurants/top` | Top restaurantes por receita (aceita `?n=`) |
| GET | `/api/products/popular` | Produtos mais vendidos (aceita `?n=`) |
| GET | `/api/restaurants/report` | Relatorio completo por restaurante |
| GET | `/api/summary` | Resumo geral |

## Valores de referencia

Use estes valores para validar se suas correcoes estao corretas:

| Dado | Valor esperado |
|------|----------------|
| Receita total (sem cancelados) | 978,10 |
| Receita Sushi Place | 384,90 |
| Receita Pizza Roma | 277,00 |
| Receita Burger House | 202,20 |
| Receita Taco Loco | 114,00 |
| Top restaurante #1 | Sushi Place |
| Top restaurante #2 | Pizza Roma |
| Top restaurante #3 | Burger House |
| Produto mais vendido | Milkshake (5 unidades) |
| Total de pedidos (sem cancelados) | 12 |
| Total de itens vendidos | 28 |
| Pedidos cancelados | 3 |

## Arquivos do projeto

| Arquivo | O que faz |
|---------|-----------|
| `src/app.ts` | Servidor Express com os endpoints da API |
| `src/data-processor.ts` | Funcoes de processamento de dados |
| `orders.csv` | Dados de pedidos (15 registros, 4 restaurantes) |
| `test_endpoints.ts` | Script de testes — rode para ver o que esta passando ou falhando |
| `package.json` | Dependencias e scripts do projeto |

## Regras

- Voce pode usar Google livremente
- Nao e permitido usar ferramentas de IA (ChatGPT, Copilot, etc.)
- Pense em voz alta — queremos entender seu raciocinio
- **Nao reescreva o projeto do zero** — corrija os bugs no codigo existente
