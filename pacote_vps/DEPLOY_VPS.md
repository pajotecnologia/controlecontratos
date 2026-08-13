# Guia de Deploy — VPS com aaPanel

## O que enviar para a VPS

Apenas a pasta `server/`. Não enviar `node_modules`.

Conteúdo obrigatório da pasta `server/`:
```
server/
  index.js
  auth.js
  db.js
  query.js
  notifications.js
  contratos.js
  init-db.js
  migrate.js
  migrate.sql
  create-admin.js
  schema.sql
  package.json
  .env.example
  public/         ← gerado pelo rebuild-frontend.bat
  uploads/        ← criado automaticamente
```

---

## Passo 1 — Build local (Windows)

Execute **uma vez** sempre que houver alterações no frontend:

```bat
atualizar-sistema.bat
```

Esse script compila o frontend com `VITE_API_URL` vazio (usando `.env.production`)
e copia para `server/public/`. Com o valor vazio, o navegador usa a mesma
origem do servidor — sem `localhost` fixo.

---

## Passo 2 — Enviar arquivos para a VPS

Via gerenciador de arquivos do aaPanel ou SFTP, envie a pasta `server/` para:

```
/www/wwwroot/controle-comissoes/
```

Não envie `node_modules` — será instalado na VPS.

---

## Passo 3 — Primeira instalação na VPS

Abra o **Terminal** no aaPanel e execute:

```bash
cd /www/wwwroot/controle-comissoes

# 1. Instalar dependências
npm install --omit=dev

# 2. Configurar variáveis de ambiente
cp .env.example .env
nano .env
```

Ajuste o `.env` com os dados reais:

```
DATABASE_URL="postgresql://usuario:senha@localhost:5432/controle_comissoes"
DATABASE_SSL="false"
JWT_SECRET="gere-uma-string-longa-e-aleatoria-aqui"
PORT=3001
PUBLIC_URL="https://seudominio.com"
```

> Gerar um JWT_SECRET seguro:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

```bash
# 3. Criar tabelas (primeira vez apenas)
npm run init-db

# 4. Criar usuário administrador
node create-admin.js seuemail@empresa.com SuaSenha123
```

---

## Passo 4 — Configurar PM2 no aaPanel

No aaPanel vá em **Node.js Projects** → Adicionar:
- Diretório: `/www/wwwroot/controle-comissoes`
- Arquivo de entrada: `index.js`
- Porta: `3001`

Ou pelo terminal:

```bash
pm2 start /www/wwwroot/controle-comissoes/index.js --name controle-comissoes
pm2 save
pm2 startup
```

---

## Passo 5 — Configurar Nginx no aaPanel

No aaPanel crie um site para o domínio. Em **Configuração → Nginx**,
dentro do bloco `server {}`, substitua o conteúdo do `location /` por:

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## Passo 6 — SSL (recomendado)

No aaPanel, no gerenciamento do site:
**SSL → Let's Encrypt → Emitir certificado**

---

## Atualizar o sistema (próximas versões)

### Local (Windows):
```bat
atualizar-sistema.bat
```

### VPS — enviar arquivos atualizados via aaPanel/SFTP e depois:

```bash
cd /www/wwwroot/controle-comissoes
npm install --omit=dev
npm run migrate
pm2 restart controle-comissoes
```

> `npm run migrate` aplica apenas as alterações novas no banco (seguro para rodar repetidamente).

---

## Banco de dados — migração inicial (banco já existente)

Se o banco já existia antes das últimas alterações, rode a migração
para adicionar os novos campos:

```bash
cd /www/wwwroot/controle-comissoes
npm run migrate
```

Ou execute o SQL diretamente no aaPanel em **Banco de Dados → PostgreSQL → phpPgAdmin**:

```sql
-- Copie o conteúdo do arquivo server/migrate.sql e execute aqui
```

---

## Comandos úteis

```bash
pm2 status                          # ver estado do processo
pm2 logs controle-comissoes         # ver logs em tempo real
pm2 restart controle-comissoes      # reiniciar após atualização
pm2 stop controle-comissoes         # parar o processo
```

---

## Checklist de verificação

- [ ] `server/public/` existe e contém o frontend compilado
- [ ] `server/.env` está configurado com DATABASE_URL e JWT_SECRET reais
- [ ] `npm run init-db` ou `npm run migrate` foi executado
- [ ] Usuário admin foi criado com `node create-admin.js`
- [ ] PM2 está rodando (`pm2 status` mostra `online`)
- [ ] Nginx está configurado e apontando para `127.0.0.1:3001`
- [ ] SSL emitido pelo aaPanel (Let's Encrypt)
- [ ] Sistema acessível pelo domínio no navegador
