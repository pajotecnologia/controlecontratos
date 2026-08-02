# Controle de Comissões — Deploy na VPS (PostgreSQL próprio)

Este pacote **não usa Supabase**. É um servidor Node.js/Express que conecta
diretamente no **seu PostgreSQL** e também serve o frontend já compilado.

## Estrutura

```
server/
├── index.js            → servidor Express (API + serve o frontend)
├── db.js               → conexão com o PostgreSQL
├── auth.js             → login/JWT (bcrypt)
├── query.js            → motor de consultas (usado pelo frontend)
├── notifications.js    → envio de email (SMTP) e WhatsApp (Evolution API)
├── init-db.js          → aplica o schema no banco
├── schema.sql          → todas as tabelas (PostgreSQL puro, sem Supabase)
├── public/             → frontend compilado (servido pelo Express)
├── uploads/            → logomarcas enviadas (criado automaticamente)
├── package.json
└── .env.example        → modelo das variáveis de ambiente
```

## Pré-requisitos na VPS

- Node.js 18+ (`node -v`)
- PostgreSQL 13+ rodando e acessível
- Um banco criado, ex.: `CREATE DATABASE controle_comissoes;`

## Passo a passo

### 1. Copiar a pasta `server/` para a VPS
Envie toda a pasta `server/` (com `public/` dentro) para a VPS, ex.: `/var/www/comissoes`.

### 2. Instalar dependências
```bash
cd /var/www/comissoes
npm install --omit=dev
```

### 3. Configurar variáveis
```bash
cp .env.example .env
nano .env
```
Preencha:
- `DATABASE_URL` → string de conexão do seu PostgreSQL
- `JWT_SECRET` → gere com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `PUBLIC_URL` → URL pública do sistema (ex.: `https://comissoes.seudominio.com`)

### 4. Criar as tabelas
```bash
npm run init-db
```
Isso roda o `schema.sql` no banco apontado por `DATABASE_URL`. Rode uma vez só.

### 5. Iniciar o servidor
```bash
npm start
```
O sistema fica disponível na porta definida em `PORT` (padrão 3001), servindo
tanto a API quanto o frontend.

### 6. Primeiro acesso
Abra o sistema no navegador → **Cadastre-se**. O **primeiro usuário cadastrado
vira admin automaticamente**. Os próximos entram como vendedor (o admin promove
pela tela "Usuários").

## Produção (recomendado)

**Manter no ar com PM2:**
```bash
npm install -g pm2
pm2 start index.js --name comissoes
pm2 save && pm2 startup
```

**Nginx como proxy reverso + HTTPS** (opcional, recomendado):
```nginx
server {
    listen 80;
    server_name comissoes.seudominio.com;
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    client_max_body_size 5M;   # uploads de logo
}
```
Depois use `certbot --nginx` para o HTTPS.

## Notas importantes

- **Autenticação/autorização são feitas pelo servidor** (não há RLS no banco).
  Vendedores só enxergam as próprias vendas/comissões; admin vê tudo.
- **Uploads de logo** ficam em `uploads/` no disco da VPS. Se usar vários
  servidores, aponte para um storage compartilhado.
- **Email e WhatsApp** são opcionais: configure SMTP e Evolution API pela tela
  "Configurações" do sistema. Sem isso, o resto funciona normalmente.
- **Reset de senha**: o link é gerado pelo servidor. Se o SMTP estiver
  configurado, futuramente pode ser enviado por email; por ora o link de
  redefinição também retorna na resposta da API para uso manual.

## Rodar em modo desenvolvimento (na sua máquina)

Backend:
```bash
cd server
cp .env.example .env   # ajuste DATABASE_URL para seu Postgres local
npm install
npm run init-db
npm start              # porta 3001
```
Frontend (na raiz do projeto, em outro terminal):
```bash
# edite .env da raiz: VITE_API_URL="http://localhost:3001"
npm install
npm run dev            # porta 8080
```
