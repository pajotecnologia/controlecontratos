# Controle de Comissões

Sistema de gestão de **contratos** (parcelados), vendedores, clientes e comissões, com dois níveis de acesso (Administrador e Vendedor). **100% PostgreSQL próprio — NÃO usa Supabase.** Preparado para rodar localmente e para deploy em VPS.

> Este arquivo é o mapa vivo do projeto. Mantenha-o atualizado a cada mudança de arquitetura para não precisar reanalisar tudo do zero. Detalhes funcionais por tela ficam em `SISTEMA.md`; pendências e bugs conhecidos em `PENDENCIAS.md`.

---

## Arquitetura (visão geral)

Duas partes independentes:

- **Frontend** (`src/`): SPA React 18 + TypeScript + Vite + Tailwind + shadcn/ui. Não fala com banco diretamente — conversa por HTTP com o backend.
- **Backend** (`server/`): API Node.js + Express que conecta direto no PostgreSQL, controla autenticação/autorização (JWT + bcrypt) e também serve o frontend compilado em produção.

Não há Supabase, Row Level Security no banco, nem Edge Functions. A autorização (admin vê tudo; vendedor só o que é dele) é aplicada no backend (`server/query.js`, função `scopeClause`).

```
Navegador ──HTTP──> Express (server/) ──SQL──> PostgreSQL
   (React SPA)         auth JWT + query engine       (seu banco)
```

### O "shim" do client (ponto que mais confunde)

`src/integrations/api/client.ts` expõe um objeto chamado `supabase` com a MESMA interface do antigo supabase-js (`.from().select().eq()...`, `.auth`, `.rpc`), **mas por baixo faz `fetch` para `${VITE_API_URL}/...`**. Isso foi mantido de propósito para as telas não precisarem ser reescritas. O nome `supabase` é só histórico — não há dependência de Supabase no projeto. O client também exporta helpers próprios: `uploadLogo`, `notify`, `resetPasswordWithToken`, `getExtrato`, `getApiUrl`, e os tipos locais `Session`/`User`.

Mapa de chamadas do shim → endpoints do Express:

- `supabase.from(t).select/insert/update/delete` → `POST /data/{select|insert|update|delete}`
- `supabase.auth.signInWithPassword` → `POST /auth/login`
- `supabase.auth.signUp` → `POST /auth/signup`
- `supabase.auth.resetPasswordForEmail` → `POST /auth/request-reset`
- `supabase.auth.updateUser` → `POST /auth/update-password`
- `supabase.rpc("has_role")` → `POST /auth/me` (lê `isAdmin`)
- `uploadLogo` → `POST /upload` | `notify` → `POST /notify/{whatsapp|email}` | `getExtrato` → `POST /reports/extrato`

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/ui, react-router-dom, recharts, date-fns |
| Backend | Node.js, Express, pg, bcryptjs, jsonwebtoken, multer, nodemailer |
| Banco | PostgreSQL 13+ (extensão `pgcrypto`) |
| Notificações | SMTP (nodemailer) e WhatsApp via Evolution API (fetch) |

---

## Estrutura de pastas

```
ControleComissoes/
├── src/                        → frontend React
│   ├── pages/                  → telas (uma por rota)
│   │   ├── Auth.tsx            → login / cadastro / reset
│   │   ├── Dashboard.tsx       → KPIs e gráficos (admin e vendedor)
│   │   ├── Clientes.tsx        → CRUD de clientes (admin)
│   │   ├── Vendedores.tsx      → CRUD de vendedores (admin)
│   │   ├── Contratos.tsx       → contratos + parcelamento + baixa de parcela
│   │   ├── Relatorios.tsx      → extrato financeiro filtrável + export CSV (admin)
│   │   ├── Configuracoes.tsx   → empresa, SMTP, Evolution API, templates (admin)
│   │   ├── Usuarios.tsx        → gestão de papéis (admin)
│   │   └── ResetPassword.tsx   → redefinição via token
│   ├── components/             → AppLayout, AppSidebar, NavLink, ui/ (shadcn)
│   ├── hooks/useAuth.tsx       → contexto de auth (session, user, isAdmin)
│   ├── integrations/api/client.ts → SHIM: interface supabase-like sobre o backend
│   └── lib/masks.ts            → máscaras (moeda, CPF/CNPJ, telefone)
├── server/                     → backend Express + PostgreSQL
│   ├── index.js                → rotas (auth, /data/*, /reports/extrato, /upload, /notify/*) + serve o frontend
│   ├── db.js                   → pool de conexão (pg)
│   ├── auth.js                 → JWT (sign/verify), bcrypt, middleware requireAuth (decora req.user.isAdmin)
│   ├── query.js                → motor de query genérico: whitelist de tabelas, embeds, escopo por vendedor
│   ├── notifications.js        → sendWhatsApp (Evolution API) e sendEmail (SMTP)
│   ├── contratos.js            → utilitários de data (addMonths, mesReferenciaFrom) — auxiliar
│   ├── init-db.js              → aplica schema.sql no banco
│   ├── schema.sql              → schema PostgreSQL puro (fonte da verdade do banco)
│   ├── uploads/                → logomarcas enviadas (disco)
│   ├── public/                 → frontend compilado (criado no deploy: cp -r dist server/public)
│   └── .env.example            → DATABASE_URL, JWT_SECRET, PORT, PUBLIC_URL
├── SISTEMA.md                  → detalhamento funcional por módulo
├── PENDENCIAS.md               → bugs e melhorias conhecidos
└── .env                        → VITE_API_URL (frontend; ex.: http://localhost:3001)
```

---

## Banco de dados (schema em `server/schema.sql`)

Tabelas: `users` (auth própria), `password_reset_tokens`, `profiles`, `user_roles` (enum `app_role`: admin/vendedor), `clientes`, `vendedores`, `vendas` (= contratos), `venda_vendedores` (comissões), `parcelas`, `company_settings`, `evolution_settings`, `smtp_settings`.

Modelo de parcelamento (decisão de arquitetura): **tabela `parcelas` dedicada**, uma linha por parcela. A tabela `vendas` guarda os campos-resumo `qtde_parcelas`, `valor_parcela`, `primeiro_vencimento`. Cada `parcela` tem `numero_parcela`, `valor`, `data_vencimento`, `data_pagamento`, `pago`, `numero_nf`, `observacao`. (Os campos legados de parcelamento embutidos em `vendas` — contrato_id/numero_parcela/total_parcelas/data_vencimento — foram removidos.)

> Nota histórica: a tabela de contratos chama-se `vendas` (e a junção `venda_vendedores`) por compatibilidade — só a camada de UI foi renomeada de "Vendas" para "Contratos".

Autorização (em `server/query.js`, sem RLS): admin acessa tudo; vendedor só enxerga `vendas`/`venda_vendedores`/`parcelas` ligadas a ele e o próprio registro em `vendedores`/`profiles`/`user_roles`. Escrita (`/data/insert|update|delete`) é restrita a admin (`TABLES_ADMIN_WRITE` em `server/index.js`).

Regra de negócio: **o primeiro usuário cadastrado vira admin** automaticamente (em `POST /auth/signup`); os demais entram como vendedor.

---

## Rodar em desenvolvimento (na sua máquina)

Pré-requisitos: Node.js 18+ e PostgreSQL 13+.

### Atalho (Windows)

Três `.bat` na raiz do projeto automatizam a subida:

- `iniciar-backend.bat` — instala deps do `server/`, cria `.env` se faltar, aplica `schema.sql` (`npm run init-db`) e sobe a API em `:3001`.
- `iniciar-frontend.bat` — instala deps da raiz, cria `.env` (`VITE_API_URL=http://localhost:3001`) e sobe o Vite.
- `iniciar-sistema.bat` — abre os dois terminais acima de uma vez (backend primeiro, frontend 5s depois).
- `promover-admin.bat` — promove `pajotecnologia@gmail.com` para administrador no PostgreSQL local. O usuário precisa já ter sido cadastrado pela tela `/auth`.

Dê duplo clique ou rode no `cmd`. Na primeira execução confirme `DATABASE_URL` e `JWT_SECRET` em `server/.env`.

Backend:

```bash
cd server
cp .env.example .env      # ajuste DATABASE_URL e JWT_SECRET
npm install
npm run init-db           # aplica schema.sql no banco (roda 1x)
npm start                 # API na porta 3001
```

Frontend (na raiz, outro terminal):

```bash
# .env da raiz deve ter: VITE_API_URL="http://localhost:3001"
npm install
npm run dev               # Vite (porta padrão do Vite)
```

Primeiro acesso: abra o app → Cadastre-se. O primeiro cadastro vira admin.

---

## Deploy em VPS

1. Compile o frontend: `npm run build` (gera `dist/`).
2. Copie `dist/` para dentro do backend: `cp -r dist server/public` (o Express serve automaticamente se `server/public/` existir).
3. Na VPS: copie a pasta `server/`, rode `npm install --omit=dev`, configure `.env` (DATABASE_URL, JWT_SECRET, PUBLIC_URL), rode `npm run init-db` uma vez e `npm start` (recomendado PM2 + Nginx proxy reverso + HTTPS via certbot).

SMTP e Evolution API são opcionais e configurados pela tela Configurações (ficam no banco, não em variáveis de ambiente). Sem eles, o resto funciona normalmente.

---

## Verificação

Checagem de tipos do frontend:

```bash
npx tsc --noEmit -p tsconfig.json
```

Checagem de sintaxe do backend:

```bash
node --check server/index.js && node --check server/query.js
```

> Observação: `npm run build`/`npm run dev` exigem o binário nativo do Rollup da plataforma. Se trocar de SO (ex.: Windows ↔ Linux), rode `npm install` de novo para baixar o binário correto. O `bun.lock` ainda pode listar pacotes antigos; se usar bun, rode `bun install` para regenerá-lo.

---

## Histórico de mudanças relevantes

- **07/07/2026** — Renomeação "Vendas" → "Contratos" (rota `/contratos`, `Contratos.tsx`); parcelamento automático (qtde de parcelas, valor da parcela auto-calculado, 1º vencimento, geração de lançamentos na tabela `parcelas`); baixa de parcela individual com número da N.F., data e observação; edição de contrato preserva baixas já feitas; correção do reenvio de notificação em edição (só notifica vendedores novos).
- **07/07/2026** — Migração completa para PostgreSQL próprio: removido `@supabase/supabase-js`, pasta `supabase/` (migrations/functions), `install/` legado e `src/integrations/supabase/types.ts`; client movido para `src/integrations/api/client.ts`; tabela `parcelas` portada para `server/schema.sql`, `query.js` e whitelist de escrita; endpoint `/reports/extrato` reescrito sobre a tabela `parcelas`; criada tela `Relatorios.tsx` (extrato filtrável + export CSV).
