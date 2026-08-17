# Histórico de Soluções Técnicas e Arquitetura do Sistema

## 1. Mapeamento de Relações e Backend de Consultas (`server/query.js`)

### Diagnóstico do Erro "Relação desconhecida: parcelas.contratos"
- **Causa Raiz**: O motor de consultas customizado em Node/Express (`server/query.js`), que traduz as chamadas no formato Supabase / PostgREST para SQL nativo do PostgreSQL, possuía no objeto `RELATIONS` a entrada `parcelas` mapeada apenas para `vendas`.
- Quando requisições legadas ou em cache solicitavam `.select("*, contratos(*)")` na tabela `parcelas`, o backend lançava o erro `Relação desconhecida: parcelas.contratos`.
- **Solução Definitiva**: Mapeados sinônimos e aliases no objeto `RELATIONS` para todas as tabelas (singular e plural), incluindo `vendas`, `venda`, `contratos`, `contrato`, `clientes`, `cliente`, `vendedores`, `vendedor`, etc.

### Tabela de Mapeamento de Relações (`RELATIONS`)
| Tabela Origem | Alias Solicitado | Tabela Destino | Chave Local (`local`) | Chave Estrangeira (`foreign`) | Tipo |
|---|---|---|---|---|---|
| `parcelas` | `vendas` / `venda` / `contratos` / `contrato` | `vendas` | `venda_id` | `id` | 1:1 (`one`) |
| `vendas` | `clientes` / `cliente` | `clientes` | `cliente_id` | `id` | 1:1 (`one`) |
| `vendas` | `parcelas` | `parcelas` | `id` | `venda_id` | 1:N (`many`) |
| `contratos` | `clientes` / `cliente` | `clientes` | `cliente_id` | `id` | 1:1 (`one`) |
| `contratos` | `parcelas` | `parcelas` | `id` | `venda_id` | 1:N (`many`) |
| `venda_vendedores` | `vendedores` / `vendedor` | `vendedores` | `vendedor_id` | `id` | 1:1 (`one`) |
| `propostas` | `proposta_itens` | `proposta_itens` | `id` | `proposta_id` | 1:N (`many`) |
| `despesas` | `parcelas_despesas` | `parcelas_despesas` | `id` | `despesa_id` | 1:N (`many`) |

---

## 2. Catálogo dos 5 Modelos de Proposta Comercial (`modelo_proposta`)

Todos os modelos são leves, sem enfeites excessivos ou pesados, e visualmente 100% distintos entre si:

1. **`classico` — Modelo 1: Corporativo Tradicional**
   - **Cabeçalho**: Banner topo escuro (`background: #0f172a`), logo à esquerda e título comercial à direita em texto branco.
   - **Estilo**: Cartão de informações do cliente com fundo neutro e tabela completa.

2. **`moderno` — Modelo 2: Sem Moldura (Logo no Topo)**
   - **Cabeçalho**: Logomarca centralizada no topo com endereço e dados da empresa emissora logo abaixo.
   - **Estilo**: 100% sem moldura, sem caixas de contorno, divisor sutil de 1px e linhas de itens minimalistas.

3. **`elegante` — Modelo 3: Executivo / Serifado Elegante**
   - **Tipografia**: Georgia serif elegante (`font-family: Georgia, serif`).
   - **Estilo**: Barra fina dourada no topo (`border-top: 4px solid #d97706`), cabeçalho centralizado e totais com destaque em tom âmbar/ouro.

4. **`compacto` — Modelo 4: Fatura / Orçamento Compacto**
   - **Cabeçalho**: Layout em 2 colunas no topo (Empresa à esquerda vs Cliente/Data/Metadata à direita).
   - **Estilo**: Tabela de alta densidade (`padding: 6px 4px`), texto compacto de 12px, subtotal e total direto no rodapé da tabela. Ideal para cotações rápidas de 1 página.

5. **`lateral` — Modelo 5: Sidebar Lateral Moderna**
   - **Cabeçalho & Layout**: Split layout moderno em duas colunas:
     - **Coluna Lateral (Esquerda - 240px, fundo `#f8fafc`)**: Logo, Dados da Empresa Emissora e resumo do documento.
     - **Área Principal (Direita)**: Título, dados do cliente com destaque em barra azul, tabela de itens e badge azul de valor total.

### Arquivos Sincronizados
- `src/pages/Propostas.tsx` (Visualização / PDF local / Impressão).
- `server/index.js` (Rota pública de assinatura de proposta `/api/public/assinar-proposta/:token/preview`).

---

## 3. Gestão de Usuários Administradores e Autenticação

### Auto-Seed no Startup do Servidor (`server/index.js`)
- Na inicialização do servidor (`initTables`), o sistema garante automaticamente a criação/atualização do usuário administrador padrão:
  - **E-mail**: `pajotecnologia@gmail.com`
  - **Senha Padrão**: `123456`
  - **Papel (`user_roles`)**: `admin`
- Script manual auxiliar de criação de admin:
  ```bash
  node server/create-admin.js <email> <senha>
  ```

---

## 4. Procedimento de Build e Deploy VPS

### Limpeza e Recompilação dos Assets
Para evitar arquivos `.js` obsoletos servidos em cache:
1. Deletar diretórios de assets em `dist`, `public/assets`, `server/public/assets` e `pacote_vps/public/assets`.
2. Executar `npm run build`.
3. Copiar os novos arquivos compilados de `dist` para `public`, `server/public` e `pacote_vps`.
4. Atualizar o arquivo `pacote_vps.zip` usando `tar.exe`.

### Comando de Atualização no Servidor VPS (Único Executável)
```bash
rm -rf /tmp/repo_temp && git clone https://github.com/pajotecnologia/controlecontratos.git /tmp/repo_temp && cp -rf /tmp/repo_temp/* /www/wwwroot/contratos.pajotech.com.br/ && cp -rf /tmp/repo_temp/server/* /www/wwwroot/contratos.pajotech.com.br/ && rm -rf /tmp/repo_temp && cd /www/wwwroot/contratos.pajotech.com.br && pm2 restart all
```

---

## 5. Processos de Qualidade e Prevenção de Erros de Build

Para evitar falhas na compilação ou atualizações que não refletem no ambiente local/VPS, foram estabelecidas as seguintes regras rígidas:

1. **Validação Obrigatória do Build**:
   - Sempre executar `npx vite build` e checar o terminal buscando por `✓ built in X.XXs` antes de efetuar cópia de ativos ou commits.
   - Jamais ignorar saídas do tipo `Transform failed` ou `ERROR`.

2. **Isolamento de Ambientes Dev vs Prod**:
   - `index.html` da raiz aponta sempre para `/src/main.tsx` (desenvolvimento local Vite HMR).
   - Artefatos de produção em `dist/` são copiados estritamente para `public/` e `server/public/`.

3. **Arquivos de Diretrizes do Agente**:
   - Configurados os arquivos `.agents/rules/build_and_deploy_rules.md` e `GEMINI.md` para garantir que a IA siga sempre este rigoroso processo em todas as interações.
