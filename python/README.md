# Desafio Técnico — Restaurant Orders API

## Contexto

Você acabou de entrar em um time que gerencia uma plataforma de pedidos para restaurantes. A API recebe dados de pedidos (CSV) e gera relatórios de receita, ranking de restaurantes e produtos populares.

O dev anterior saiu da empresa e o código está com **bugs**. Alguns endpoints crasham, outros retornam dados incorretos.

## Requisitos

- **Python 3.9 ou superior** (Flask 3.1.0 requer Python 3.9+)
- pip (gerenciador de pacotes Python)

## Como rodar

### Criação do ambiente virtual

Recomendamos usar um ambiente virtual para isolar as dependências do projeto:

```bash
# Criar o ambiente virtual
python -m venv venv

# Ativar o ambiente virtual
# No macOS/Linux:
source venv/bin/activate

# No Windows (CMD):
venv\Scripts\activate

# No Windows (PowerShell):
# venv\Scripts\Activate.ps1
```

### Instalação e execução

```bash
pip install -r requirements.txt
python app.py
```

O servidor sobe em `http://localhost:5050`.

## Sua missão

### Parte 1 — Debug (primeiros 30-40 min)

Temos um script de testes que valida todos os endpoints. Rode-o com o servidor ligado:

```bash
python test_endpoints.py
```

Você vai ver vários testes falhando. Seu objetivo é **corrigir os bugs no código até que todos os testes passem**.

### Parte 2 — Melhoria (últimos 20-30 min)

Após todos os testes passarem, melhore o código como achar necessário. Exemplos:
- Performance e escalabilidade (tem código que não escalaria com muitos dados!)
- Tratamento de erros
- Organização / legibilidade
- Qualquer outra melhoria que você faria ao receber esse código no dia-a-dia

## Endpoints disponíveis

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/revenue` | Receita total (exclui cancelados) |
| GET | `/api/revenue/restaurant` | Receita por restaurante |
| GET | `/api/restaurants/top` | Top restaurantes por receita (aceita `?n=`) |
| GET | `/api/products/popular` | Produtos mais vendidos (aceita `?n=`) |
| GET | `/api/restaurants/report` | Relatório completo por restaurante |
| GET | `/api/summary` | Resumo geral |

## Valores de referência

Use estes valores para validar se suas correções estão corretas:

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
| `app.py` | Servidor Flask com os endpoints da API |
| `data_processor.py` | Funções de processamento de dados |
| `orders.csv` | Dados de pedidos (15 registros, 4 restaurantes) |
| `test_endpoints.py` | Script de testes — rode para ver o que está passando ou falhando |
| `requirements.txt` | Dependências do projeto |

## Regras

- Você pode usar Google livremente
- Não é permitido usar ferramentas de IA (ChatGPT, Copilot, etc.)
- Pense em voz alta — queremos entender seu raciocínio
- **Não reescreva o projeto do zero** — corrija os bugs no código existente
