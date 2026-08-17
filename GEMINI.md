# Diretrizes do Projeto - Gestão de Contratos

## Diretrizes de Qualidade, Compilação e Deploy

1. **Verificação de Compilação (Build Integrity)**:
   - Toda alteração no código React/TypeScript deve ser testada com `npx vite build`.
   - Inspecionar a saída do terminal para garantir compilação sem avisos de erro ou falhas de sintaxe antes de mover artefatos ou fazer git push.

2. **Preservação do `index.html` de Desenvolvimento**:
   - A raiz do projeto deve manter `index.html` limpo com `<script type="module" src="/src/main.tsx"></script>`.
   - O `dist/index.html` produzido pelo build deve ser copiado APENAS para os diretórios estáticos do servidor (`public/` e `server/public/`).

3. **Defesa do Motor de Banco de Dados (`server/query.js`)**:
   - Manter no objeto `RELATIONS` mapeamento duplo (singular e plural) para todas as tabelas (ex.: `vendas`, `venda`, `contratos`, `contrato`).

4. **Persistência de Memória (`HISTORICO_SOLUCOES.md`)**:
   - Registrar no arquivo `HISTORICO_SOLUCOES.md` todo o histórico de alterações, tabelas do banco, autenticação e procedimentos de VPS.
