# PENDENCIAS.md — Controle de Comissões

Atualizado em 07/07/2026. Referência rápida de bugs, funcionalidades incompletas e melhorias identificadas no código-fonte.

---

## IMPLEMENTAÇÕES CONCLUÍDAS (07/07/2026)

**Renomeação Venda → Contrato:**
- `src/pages/Contratos.tsx` criado (substitui `Vendas.tsx` na camada de apresentação)
- `src/App.tsx` já importava `./pages/Contratos` e rota `/contratos` — rota e sidebar já apontavam para o novo componente
- `src/components/AppSidebar.tsx` já usava rótulo "Contratos" e rota `/contratos`
- Rótulos de UI ajustados: "Novo Contrato", "Editar Contrato", "Salvar Contrato", "Nenhum contrato encontrado", etc.
- `SISTEMA.md` atualizado refletindo a renomeação
- A tabela no banco permanece `vendas` (e a junction `venda_vendedores`), por compatibilidade — só a camada de UI foi renomeada

**Parcelamento automático:**
- Portado para o backend PostgreSQL próprio: tabela `parcelas` dedicada em `server/schema.sql` (numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao) + colunas-resumo em `vendas` (`qtde_parcelas`, `valor_parcela`, `primeiro_vencimento`). Sem RLS — autorização no backend (`server/query.js`).
- Campos novos no formulário de contrato: Qtde. de Parcelas, Valor da Parcela (auto-calculado), 1º Vencimento
- Preview dos vencimentos mostrado no formulário antes de salvar
- Ao salvar (criar): gera automaticamente na tabela `parcelas` uma linha por parcela, com vencimento mensal a partir do 1º vencimento
- Ao duplicar contrato recorrente: duplica as parcelas em aberto (ignora as já pagas)

**Migração Supabase → PostgreSQL próprio (07/07/2026):**
- Removido `@supabase/supabase-js` do `package.json`/`package-lock.json`; pasta `supabase/` (migrations, Edge Functions, config) e `install/` (snapshot legado) apagadas; `src/integrations/supabase/types.ts` removido.
- Client movido de `src/integrations/supabase/client.ts` para `src/integrations/api/client.ts`; o objeto `supabase` virou shim sobre `fetch` para o backend Express (`/data/*`, `/auth/*`, `/upload`, `/notify/*`, `/reports/extrato`). Tipos `Session`/`User` agora locais.
- Backend (`server/`): `parcelas` adicionada ao `READABLE_TABLES`, à relação `vendas.parcelas` e à whitelist de escrita (`TABLES_ADMIN_WRITE`); endpoint `/contratos` legado (parcelas embutidas em `vendas`) removido; `/reports/extrato` reescrito sobre a tabela `parcelas`.

**Baixa de parcela com N.F.:**
- Coluna "Parcelas (baixa)" na listagem mostra cada parcela com número, vencimento e badge de N.F. se houver
- Click na parcela em aberto abre dialog de baixa com: Número da N.F. (texto), Data do Pagamento (calendário), Observação (textarea)
- Click na parcela já paga abre dialog de desmarcação (reabre a parcela, limpa N.F./data/obs)
- Vendedor vê apenas o status (badge), sem ação

**Correção de bug pré-existente #2 (reenvio de notificação em edição):**
- `Contratos.tsx` em modo edição compara os vendedores anteriores (`previousVvIds`) com os novos e só dispara `sendNotification("nova_venda")` para os vendedores recém-adicionados — não mais reenvia para todos a cada edição

**Validação:**
- TypeScript compila limpo: `npx tsc --noEmit -p tsconfig.json` → EXIT 0
- `npm run build` no ambiente de sandbox falha por um binário nativo do Rollup ausente (`@rollup/rollup-linux-x64-gnu`) e registry npm bloqueado (403) — limitação do ambiente, não do código. Rodar `npm install` no ambiente do usuário resolve.

---

## BUGS / PROBLEMAS CONFIRMADOS

### 1. Email nunca exibido na tela de Usuários
**Arquivo:** `src/pages/Usuarios.tsx`
O `Usuarios.tsx` busca `profiles` + `user_roles` via `/data/select`, que não juntam com `users` (o email mora lá), e o campo de email fica sempre vazio. A tabela exibe "Nome" e "Nível de Acesso" mas não o email.
**Solução:** Há um endpoint `GET /users` (admin) em `server/index.js` que já devolve `email` + `role` num join só — a tela só não o usa. Migrar `Usuarios.tsx` para chamar `/users` (via um helper no `client.ts`) em vez dos dois `/data/select` separados, ou expor `users.email` no query engine.

---

### 2. ~~Editar venda reenvia notificações para TODOS os vendedores~~ ✅ CORRIGIDO
Corrigido em `Contratos.tsx` (edição): notifica apenas vendedores recém-adicionados. O `Vendas.tsx` original mantinha o bug, mas esse arquivo está obsoleto (ver item 18).

---

### 3. Controle de "notificação já enviada" reseta ao recarregar
**Arquivo:** `src/pages/Contratos.tsx` — `sentNotifications` é estado local (memória)
O aviso "mensagem já enviada, deseja reenviar?" só funciona na mesma sessão. Ao recarregar a página, o controle some e todas as notificações parecem não enviadas.
**Solução:** Persistir no banco (ex.: coluna `notificado_em` em `venda_vendedores`) ou ao menos no `localStorage`.

---

### 4. Dashboard do vendedor — gráfico usa apenas as 5 vendas recentes
**Arquivo:** `src/pages/Dashboard.tsx:115-120`
Para o perfil vendedor, o gráfico "Faturamento por Mês" é construído a partir da variável `recentes` (limitada a 5 registros pelo `.limit(5)`), em vez de buscar todas as vendas do vendedor. O gráfico fica incompleto para vendedores com histórico maior.
**Solução:** Fazer query separada para o gráfico, sem `limit`.

---

### 5. Card "Vendas Recentes" no Dashboard mostra contagem de 0 a 5
**Arquivo:** `src/pages/Dashboard.tsx:167`
O KPI exibe `vendasRecentes.length`, que é sempre entre 0 e 5 (limitado pelo `.limit(5)`). O título diz "Vendas Recentes" mas parece um total, gerando confusão. (Ainda rotulado como "Vendas" — atualizar para "Contratos" quando o Dashboard for renomeado.)
**Solução:** Buscar e exibir o total real de contratos, ou renomear o card para deixar claro que são as últimas 5.

---

### 6. Vendedores — nome não é validado no save
**Arquivo:** `src/pages/Vendedores.tsx:35`
O `handleSave` não verifica se `form.nome.trim()` está vazio antes de salvar. Contrasta com `Clientes.tsx:35` que faz essa validação corretamente.
**Solução:** Adicionar `if (!form.nome.trim()) return toast(...)` igual ao Clientes.

---

### 7. saveEvolution não salva templates; saveTemplates pode criar linha duplicada
**Arquivo:** `src/pages/Configuracoes.tsx:156-177` e `206-216`
`saveEvolution` salva apenas URL, nome e API Key — não inclui os templates. Se `evolutionId` for null quando `saveTemplates` for chamado, ele cria uma nova linha no banco com `instance_url: ""` e `api_key: ""`, corrompendo os dados.
**Solução:** Garantir que `saveEvolution` seja chamado antes, ou unificar os saves em um único botão/função.

---

## FUNCIONALIDADES INCOMPLETAS

### 8. Vendedores — sem toggle ativo/inativo pela UI
**Arquivo:** `src/pages/Vendedores.tsx`
O campo `ativo` existe no banco mas a tela de Vendedores não exibe o status nem permite alterá-lo. Só é possível desativar/reativar por SQL direto.
**Solução:** Adicionar coluna "Status" na tabela e botão de toggle.

---

### 9. Vendedores — sem vínculo de user_id pela UI
**Arquivo:** `src/pages/Vendedores.tsx`
O campo `user_id` vincula o cadastro de vendedor a um usuário do sistema (necessário para o login do vendedor funcionar). Não há como fazer esse vínculo pela interface — só por SQL direto.
**Solução:** Adicionar um Select na edição do vendedor para escolher o usuário correspondente.

---

### 10. Sem busca/filtro em nenhuma listagem
**Arquivos:** `src/pages/Clientes.tsx`, `Vendedores.tsx`, `Contratos.tsx`
Todas as listagens carregam todos os registros e não oferecem campo de busca ou filtro. Com volume crescente de dados, a usabilidade cai.
**Sugestão prioritária:** Campo de busca por nome no topo das tabelas (filtro client-side simples).

---

### 11. ~~Vendas — sem filtro por período/mês~~ (parcialmente mitigado)
A coluna "Mês Ref." existe na listagem de Contratos mas ainda não há filtro por mês/ano ou status de parcela/comissão. Diferente de antes, agora existe o indicador visual de `pagas/total` por contrato, mas o filtro explícito ainda não foi implementado.
**Solução:** Adicionar filtros de mês/ano de referência e status (cliente pagou / comissão paga / parcelas pagas).

---

### 12. Sem paginação nas listagens
**Arquivos:** `src/pages/Clientes.tsx`, `Vendedores.tsx`, `Contratos.tsx`
Todas as queries buscam registros sem `limit`/`range`. Com crescimento de dados, pode causar lentidão ou timeout.
**Solução:** Implementar paginação simples ou scroll infinito.

---

### 13. Sem exportação de relatórios
Não há funcionalidade de exportar dados para PDF ou planilha (Excel/CSV). Comum em sistemas de comissão para envio ao financeiro.
**Sugestão:** Exportar a listagem de contratos/comissões filtrada em CSV como primeira entrega.

---

## RISCOS / MELHORIAS

### 14. Notificação automática ao marcar comissão paga vai para ambos canais sem confirmação
**Arquivo:** `src/pages/Contratos.tsx` (`toggleComissaoPaga`)
Envia WhatsApp E email simultaneamente, sem perguntar ao usuário.
**Sugestão:** Consistir com a coluna "Notificar" (que permite escolher o canal) ou adicionar um toast confirmando o envio.

---

### 15. Testes sem cobertura real
**Arquivo:** `src/test/example.test.ts`
Não há testes unitários ou de integração para as funções críticas (cálculo de comissão, máscaras, lógica de geração de parcelas, cálculo bidirecional de comissão).
**Sugestão:** Priorizar testes para `src/lib/masks.ts`, a geração de parcelas (`addMonths` + cálculo de valor por parcela) e a lógica de cálculo bidirecional de comissão.

---

### 16. Ausência de loading states nas listagens
**Arquivos:** `src/pages/Clientes.tsx`, `Vendedores.tsx`
Diferente de `Usuarios.tsx` que tem `loading` state, Clientes e Vendedores não exibem feedback visual enquanto os dados carregam. Em conexões lentas, a tabela aparece vazia por um momento sem indicação de carregamento.

---

### 17. NOVO — Editar contrato regenera parcelas e perde baixas existentes
**Arquivo:** `src/pages/Contratos.tsx` (`handleSave` modo edição)
Ao editar um contrato, o código faz `DELETE` em todas as parcelas existentes e recria a partir do preview (todas como `pago: false`). Se o usuário já tinha dado baixa em algumas parcelas e precisou editar o contrato (ex.: corrigir o cliente), as baixas são perdidas.
**Solução:** Antes de regenerar, comparar parcelas novas com as existentes por `numero_parcela`; preservar `pago`, `data_pagamento`, `numero_nf` e `observacao` das parcelas cujo vencimento/valor não mudaram.

---

### 18. NOVO — `src/pages/Vendas.tsx` obsoleto (código morto)
O arquivo `Vendas.tsx` original ainda existe no diretório `src/pages/` mas não é mais importado por `App.tsx` nem pelo sidebar (`App.tsx` e `AppSidebar.tsx` já apontam para `Contratos`). Mantém bugs antigos (item #2 original) e pode confundir manutenção futura.
**Solução:** Excluir `Vendas.tsx` (não foi possível remover dentro do sandbox — permissão negada; executar `rm src/pages/Vendas.tsx` no ambiente do usuário).

---

### 19. NOVO — Dashboard e Relatórios ainda referenciam "vendas" em rótulos
**Arquivo:** `src/pages/Dashboard.tsx`
O Dashboard usa `from("vendas")` (correto — tabela não foi renomeada) mas os rótulos de UI ainda dizem "Vendas Recentes", "Últimas Vendas", "Nenhuma venda encontrada". Para consistência com a renomeação para "Contratos", esses textos deveriam ser atualizados.
**Solução:** Atualizar rótulos de UI no Dashboard para "Contratos" (mantendo as queries em `from("vendas")`).

---

## RESUMO DE PRIORIDADES

| # | Item | Status | Impacto | Complexidade |
|---|------|--------|---------|--------------|
| 2 | Reenvio de notificação em edição | ✅ Corrigido | Alto | Média |
| 9 | Vínculo user_id do vendedor pela UI | Pendente | Alto | Média |
| 8 | Toggle ativo/inativo do vendedor | Pendente | Alto | Baixa |
| 17 | Regeneração de parcelas perde baixas | Pendente | Alto | Média |
| 18 | Excluir Vendas.tsx obsoleto | Pendente | Médio | Baixa |
| 7 | Bug no saveEvolution/saveTemplates | Pendente | Médio | Baixa |
| 4 | Gráfico dashboard vendedor incompleto | Pendente | Médio | Baixa |
| 11 | Filtro por mês/status em contratos | Parcial | Médio | Média |
| 19 | Rótulos "vendas" no Dashboard | Pendente | Médio | Baixa |
| 1 | Email ausente na tela de Usuários | Pendente | Médio | Média |
| 6 | Validação de nome em Vendedores | Pendente | Baixo | Baixa |
| 10 | Busca nas listagens | Pendente | Baixo | Baixa |
| 13 | Exportação de relatórios | Pendente | Baixo | Alta |
