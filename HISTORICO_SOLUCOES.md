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

## 2. Modelos de Proposta Comercial (`modelo_proposta`)

### Modelo 2: Sem Moldura (Logo no Topo)
- **Estrutura Visual**:
  1. Logomarca centralizada no topo da folha com endereço e dados da empresa emissora.
  2. Divisor horizontal sutil.
  3. Tipo da Proposta e Título Comercial centralizados.
  4. Data de Emissão.
  5. Informações do Cliente (em texto limpo, sem moldura ou caixa de fundo).
  6. Tabela de Itens (apenas com linhas horizontais, sem bordas laterais ou caixas).
  7. Valor Total alinhado à direita em negrito.
  8. Bloco de Observações.
  9. Linhas de Assinatura (Empresa e Cliente).
- **Arquivos Sincronizados**:
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
