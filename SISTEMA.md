# Sistema de Gestão de Contratos e Comissões

## Visão Geral

Sistema fullstack para gerenciamento de contratos, vendedores, clientes e comissões com dois níveis de acesso: **Administrador** e **Vendedor**.

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilo | Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express (PostgreSQL próprio, sem Supabase) |
| Autenticação | JWT + bcrypt (tabela `users`, sem serviço externo) |
| Banco de Dados | PostgreSQL 13+ (autorização no backend, sem RLS) |
| Funções Serverless | Nenhuma — notificações via endpoints do próprio servidor |
| Armazenamento | Disco da VPS (`server/uploads/`, servido em `/uploads`) |
| Gráficos | Recharts |

---

## Autenticação e Controle de Acesso

### Fluxo de Autenticação
1. Usuário acessa `/auth` → Login ou Cadastro
2. Cadastro com **auto-confirmação de email** habilitada (acesso imediato)
3. O **primeiro usuário** registrado recebe automaticamente a role `admin` (via trigger `handle_new_user`)
4. Redefinição de senha via `/reset-password` com link enviado por email

### Níveis de Acesso (Roles)

| Funcionalidade | Administrador | Vendedor |
|----------------|:---:|:---:|
| Dashboard completo | ✅ | ❌ |
| Dashboard próprio | ✅ | ✅ |
| Cadastro de Clientes | ✅ | ❌ |
| Cadastro de Vendedores | ✅ | ❌ |
| Gerenciar Contratos (CRUD) | ✅ | ❌ |
| Visualizar próprios contratos | ✅ | ✅ |
| Confirmar pagamento cliente | ✅ | ❌ |
| Dar baixa em parcela (N.F., data, obs.) | ✅ | ❌ |
| Confirmar comissão paga | ✅ | ❌ |
| Configurações (Empresa/SMTP/WhatsApp) | ✅ | ❌ |
| Gerenciar Usuários e Permissões | ✅ | ❌ |

### Tabela `user_roles`
- Enum `app_role`: `admin` | `vendedor`
- Função `has_role()` (SECURITY DEFINER) para verificação segura de roles
- RLS: Admins gerenciam todas as roles; usuários veem apenas a própria

---

## Módulos do Sistema

### 1. Dashboard (`/`)

**Admin:**
- KPIs: Faturamento Total, Comissões Pendentes, Contratos Recentes
- Gráfico de barras: Faturamento por Mês de Referência
- Gráfico de pizza: Status dos Pagamentos (Pagos vs Pendentes)
- Gráfico de barras empilhadas: Comissões por Vendedor (Pago vs Pendente)
- Lista dos últimos 5 contratos

**Vendedor:**
- KPIs: Total de Comissões, Comissões a Receber, Contratos Recentes
- Gráficos filtrados apenas para dados do vendedor logado

---

### 2. Clientes (`/clientes`) — Somente Admin

- **CRUD completo** de clientes
- Campos: Nome (obrigatório), Telefone, Email, CPF/CNPJ, Endereço
- Máscaras automáticas: CPF/CNPJ e Telefone
- Clientes são vinculados aos contratos via `cliente_id`
- RLS: Admins gerenciam; usuários autenticados podem visualizar

---

### 3. Vendedores (`/vendedores`) — Somente Admin

- **CRUD completo** de vendedores
- Campos: Nome (obrigatório), WhatsApp, Email, CPF, Comissão Padrão (%)
- Campo `ativo` para desativar vendedores sem excluí-los
- Campo `user_id` vincula vendedor a um usuário do sistema (para acesso de vendedor)
- Máscaras automáticas: CPF e Telefone
- RLS: Admins gerenciam; vendedores veem apenas o próprio registro

---

### 4. Contratos (`/contratos`)

> Renomeado de "Vendas" para "Contratos" em 07/07/2026. A tabela no banco continua se chamando `vendas` por compatibilidade; apenas a camada de apresentação (rótulos, rota, componente) foi renomeada.

**Admin — Funcionalidades completas:**
- **Criar/Editar/Excluir** contratos
- Seleção de cliente pré-cadastrado
- Valor do serviço com máscara de moeda (R$)
- Data do contrato (calendário)
- Mês/Ano de referência (navegação por setas)
- Flag "Contrato Recorrente"
- **Parcelamento automático:**
  - Campos: Qtde. de Parcelas, Valor da Parcela (calculado automaticamente = valor do serviço / qtde), 1º Vencimento
  - Ao salvar, o sistema gera automaticamente os lançamentos na tabela `parcelas`, uma linha por parcela, com vencimento mensal a partir do 1º vencimento informado
  - Editar o contrato recalcula e regera as parcelas (as baixas anteriores são perdidas — ver pendência #17 no PENDENCIAS.md)
- **Múltiplos vendedores** por contrato com cálculo bidirecional de comissão:
  - Alterar % → recalcula valor em R$
  - Alterar R$ → recalcula %
- Marcar/desmarcar "Cliente Pagou" (nível contrato)
- **Baixa de parcela individual:** dialog com campo **Número da N.F.**, data do pagamento e observação
- Desmarcar baixa de parcela (reabre a parcela)
- Marcar/desmarcar "Comissão Paga" (por vendedor)
- **Duplicar contrato recorrente** para o mês seguinte (duplica também as parcelas em aberto)
- Envio manual de notificações (WhatsApp/Email) por vendedor
- Edição de contrato notifica **apenas os vendedores recém-adicionados**, não os que já estavam no contrato

**Vendedor — Visualização apenas:**
- Vê apenas contratos onde está incluído como vendedor
- Status de pagamento das parcelas (sem ação)

**Notificações automáticas:**
- Ao criar contrato → notifica vendedores incluídos (template "nova_venda")
- Ao editar contrato → notifica somente vendedores novos (template "nova_venda")
- Ao confirmar comissão paga → notifica vendedor (template "pagamento")

---

### 5. Configurações (`/configuracoes`) — Somente Admin

#### Aba Empresa
- Nome da Empresa, CNPJ (com máscara), Logomarca (upload para Storage)
- Logo exibida no sidebar e header

#### Aba Email (SMTP)
- Servidor, Porta, Usuário, Senha, Email Remetente, Nome Remetente
- Toggle TLS/SSL
- Templates de email personalizáveis (Nova Venda e Comissão Paga)
- Botão "Testar Envio" (envia email de teste via Edge Function)

#### Aba Evolution API (WhatsApp)
- URL da Instância, Nome da Instância, API Key
- Botão "Testar Conexão" (verifica status da instância)
- Indicador visual de conexão (🟢/🔴)

#### Aba Mensagens WhatsApp
- Templates personalizáveis com variáveis dinâmicas:
  - `{{vendedor}}`, `{{valor}}`, `{{percentual}}`, `{{cliente}}`, `{{valor_servico}}`, `{{mes_referencia}}`

---

### 6. Usuários e Acessos (`/usuarios`) — Somente Admin

- Lista todos os perfis cadastrados
- Exibe nível de acesso atual (Administrador/Vendedor)
- Permite alterar role via Select (admin/vendedor)
- Descrição visual das permissões de cada role

---

## Edge Functions

### `send-whatsapp`
- Recebe `venda_vendedor_id` e `template_type`
- Busca dados do contrato, vendedor e configurações da Evolution API
- Adiciona prefixo `55` ao número do WhatsApp
- Envia mensagem via Evolution API com template processado

### `send-email`
- Recebe `venda_vendedor_id` e `template_type` (ou `test: true` para teste)
- Busca configurações SMTP do banco
- Envia email ao vendedor com template processado
- Suporta TLS/SSL

---

## Banco de Dados — Tabelas

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfis de usuários (user_id, full_name, whatsapp, cpf) |
| `user_roles` | Roles dos usuários (admin/vendedor) |
| `clientes` | Cadastro de clientes |
| `vendedores` | Cadastro de vendedores |
| `vendas` | Registro de contratos (nome da tabela mantido por compatibilidade; ver seção Contratos) |
| `venda_vendedores` | Vendedores vinculados a contratos (comissões) |
| `parcelas` | Parcelas geradas por contrato (numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao) |
| `company_settings` | Configurações da empresa |
| `smtp_settings` | Configurações SMTP |
| `evolution_settings` | Configurações Evolution API / WhatsApp |

### Campos de parcelamento na tabela `vendas`
- `qtde_parcelas` (integer, default 1)
- `valor_parcela` (numeric, calculado automaticamente)
- `primeiro_vencimento` (date)

### Segurança (RLS)
- Todas as tabelas possuem Row Level Security habilitado
- Admins: acesso total (ALL) via `has_role(auth.uid(), 'admin')`
- Vendedores: SELECT apenas nos próprios registros (inclusive parcelas dos contratos em que participam)
- Tabelas de configuração: somente admins

---

## Rotas da Aplicação

| Rota | Componente | Acesso |
|------|-----------|--------|
| `/auth` | Auth | Público (redireciona se logado) |
| `/reset-password` | ResetPassword | Público |
| `/` | Dashboard | Autenticado |
| `/clientes` | Clientes | Admin |
| `/vendedores` | Vendedores | Admin |
| `/contratos` | Contratos | Autenticado |
| `/relatorios` | Relatorios | Admin |
| `/configuracoes` | Configuracoes | Admin |
| `/usuarios` | Usuarios | Admin |

---

## Utilitários (`src/lib/masks.ts`)

- `maskCPF` — Formata CPF: 000.000.000-00
- `maskCNPJ` — Formata CNPJ: 00.000.000/0000-00
- `maskCPFCNPJ` — Auto-detecta CPF ou CNPJ
- `maskPhone` — Formata telefone: (00) 00000-0000
- `maskCurrency` — Formata moeda: 1.234,56
- `unmaskCurrency` — Remove formatação de moeda → número
- `formatCurrency` — Número → string formatada (sem R$)

---

## Componentes Principais

- **AppLayout** — Layout com sidebar + header
- **AppSidebar** — Menu lateral dinâmico por role
- **NavLink** — Link de navegação com suporte a classe ativa
- **ProtectedRoute** — HOC para rotas protegidas (auth + admin check)

---

## Fluxo de Primeiro Acesso

1. Acesse `/auth` → Clique em "Cadastre-se"
2. Preencha nome, email e senha → Conta criada com acesso imediato
3. O primeiro usuário é automaticamente **Administrador**
4. Configure a empresa em `/configuracoes`
5. Cadastre clientes e vendedores
6. Registre contratos, defina o parcelamento e gerencie comissões

---

*Última atualização: 07/07/2026*
