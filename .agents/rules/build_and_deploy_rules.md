# Regras e Diretrizes de Qualidade, Build e Deploy

## 1. Verificação Obrigatória de Build (Zero Tolerance para Erros de Compilação)
- **Regra**: Todo e qualquer comando de build (`npm run build` / `npx vite build`) DEVE ter seus logs e código de saída verificados ANTES de copiar arquivos para `public`, `server/public` ou `pacote_vps`.
- **Cuidado**: Nunca encadear `npm run build` com cópias de arquivos em PowerShell usando `;` sem tratar erros, pois se o build falhar, o script tentará copiar diretórios inexistentes e fará commit de pacotes quebrados.
- **Workflow Correto**:
  1. Executar `npx vite build` e confirmar compilação com sucesso (`built in X.XXs`).
  2. Somente após sucesso, copiar `dist/*` para `public/` e `server/public/`.
  3. Gerar `pacote_vps.zip` e realizar commit/push.

## 2. Preservação do `index.html` da Raiz para Servidor de Desenvolvimento (Vite HMR)
- **Regra**: O arquivo `index.html` da raiz do repositório DEVE apontar exclusivamente para:
  ```html
  <script type="module" src="/src/main.tsx"></script>
  ```
- **Proibido**: NUNCA sobrescrever o `index.html` da raiz com o `dist/index.html` gerado pelo build (que contém os hashes de produçao estáticos). O `dist/index.html` deve ser copiado APENAS para `public/index.html` e `server/public/index.html`.

## 3. Mapeamento Defensivo de Relações (`server/query.js`)
- **Regra**: Ao adicionar tabelas ou relacionamentos no backend customizado em Express/PostgreSQL (`server/query.js`), sempre incluir sinônimos no singular e no plural (ex: `vendas`, `venda`, `contratos`, `contrato`, `clientes`, `cliente`, `vendedores`, `vendedor`).
- Isso previne erros de `Relação desconhecida` quando componentes chamam apelidos diferentes.

## 4. Registro de Memória e Documentação (`HISTORICO_SOLUCOES.md`)
- **Regra**: Manter o arquivo `HISTORICO_SOLUCOES.md` atualizado com todas as decisões de arquitetura, correções efetuadas, padrões de projeto e comandos de deploy VPS.
