# Guia de Deploy e Atualização — VPS com aaPanel

## Informações do Ambiente (Memória de Configuração Oficial)

| Parâmetro | Valor Oficial |
|---|---|
| **Caminho da Aplicação na VPS** | `/www/wwwroot/contratos.pajotech.com.br` |
| **Porta do Servidor (API Node.js)** | **`3005`** |
| **Banco de Dados PostgreSQL** | **`ctrlcontratos`** |
| **Repositório GitHub Oficial** | `https://github.com/pajotecnologia/controlecontratos.git` |
| **Nginx Reverse Proxy Target** | `http://127.0.0.1:3005` |

---

## ⚡ COMANDO OFICIAL DE ATUALIZAÇÃO DA VPS (100% TESTADO E APROVADO)

Sempre que houver atualizações enviadas ao GitHub, acesse o **Terminal do aaPanel** na VPS e rode **apenas este comando de 1 linha**:

```bash
rm -rf /tmp/repo_temp && git clone https://github.com/pajotecnologia/controlecontratos.git /tmp/repo_temp && cp -rf /tmp/repo_temp/server/* /www/wwwroot/contratos.pajotech.com.br/ && rm -rf /tmp/repo_temp && cd /www/wwwroot/contratos.pajotech.com.br && npm run migrate && pm2 restart all
```

### O que este comando faz automaticamente:
1. Clona temporariamente a versão mais recente do GitHub (`main`).
2. Copia todos os arquivos do backend e os arquivos compilados do frontend (`public/`) para `/www/wwwroot/contratos.pajotech.com.br/`.
3. Limpa a pasta temporária.
4. Aplica as migrações no banco de dados `ctrlcontratos` (`npm run migrate`).
5. Reinicia a aplicação no PM2 (`pm2 restart all`) na porta **3005**.

---

## 🖥️ Procedimento Local (Windows) antes de Atualizar a VPS

Antes de rodar o comando acima na VPS, execute no Windows:

```bat
atualizar-sistema.bat
```
*(Esse script compila o frontend e copia o pacote para `dist`, `public` e `server/public`)*

E depois envie para o GitHub:
```bash
git add .
git commit -m "feat: suas alteracoes aqui"
git push origin main
```

---

## Nginx Proxy no aaPanel (Primeira Configuração)

No aaPanel em **Website → Configuração → Reverse Proxy** (ou Nginx):
```nginx
location / {
    proxy_pass http://127.0.0.1:3005;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
