// Motor de consultas: replica o subconjunto do PostgREST usado pelo app antigo
// (select com embeds aninhados, eq, in, order, limit, insert, update, delete),
// mas executa tudo contra PostgreSQL local via backend Node/Express.

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function ident(name) {
  if (!IDENT.test(name)) throw new Error(`Identificador inválido: ${name}`);
  return name;
}

const READABLE_TABLES = new Set([
  "profiles", "user_roles", "clientes", "vendedores", "vendas",
  "venda_vendedores", "parcelas", "company_settings", "evolution_settings", "smtp_settings",
  "modelos", "contratos", "propostas", "proposta_itens",
  "fornecedores", "categorias_despesa", "despesas", "parcelas_despesas",
]);

// Mapa de relacionamentos para os embeds. type 'one' = pertence-a, 'many' = tem-muitos.
// Condição gerada: child.<foreign> = parent.<local>
const RELATIONS = {
  vendas: {
    clientes: { table: "clientes", type: "one", local: "cliente_id", foreign: "id" },
    venda_vendedores: { table: "venda_vendedores", type: "many", local: "id", foreign: "venda_id" },
    parcelas: { table: "parcelas", type: "many", local: "id", foreign: "venda_id" },
  },
  venda_vendedores: {
    vendedores: { table: "vendedores", type: "one", local: "vendedor_id", foreign: "id" },
    vendas: { table: "vendas", type: "one", local: "venda_id", foreign: "id" },
  },
  parcelas: {
    vendas: { table: "vendas", type: "one", local: "venda_id", foreign: "id" },
  },
  contratos: {
    clientes: { table: "clientes", type: "one", local: "cliente_id", foreign: "id" },
    company_settings: { table: "company_settings", type: "one", local: "company_id", foreign: "id" },
    modelos: { table: "modelos", type: "one", local: "modelo_id", foreign: "id" },
    vendedores: { table: "vendedores", type: "one", local: "vendedor_id", foreign: "id" },
  },
  propostas: {
    clientes: { table: "clientes", type: "one", local: "cliente_id", foreign: "id" },
    company_settings: { table: "company_settings", type: "one", local: "company_id", foreign: "id" },
    vendedores: { table: "vendedores", type: "one", local: "vendedor_id", foreign: "id" },
    proposta_itens: { table: "proposta_itens", type: "many", local: "id", foreign: "proposta_id" },
  },
  proposta_itens: {
    propostas: { table: "propostas", type: "one", local: "proposta_id", foreign: "id" },
  },
  despesas: {
    fornecedores: { table: "fornecedores", type: "one", local: "fornecedor_id", foreign: "id" },
    categorias_despesa: { table: "categorias_despesa", type: "one", local: "categoria_id", foreign: "id" },
    parcelas_despesas: { table: "parcelas_despesas", type: "many", local: "id", foreign: "despesa_id" },
  },
  parcelas_despesas: {
    despesas: { table: "despesas", type: "one", local: "despesa_id", foreign: "id" },
  },
};

function splitTopLevel(str) {
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of str) {
    if (ch === "(") { depth++; cur += ch; }
    else if (ch === ")") { depth--; cur += ch; }
    else if (ch === "," && depth === 0) { parts.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

function parseSelect(sel) {
  return splitTopLevel(sel).map((part) => {
    const idx = part.indexOf("(");
    if (idx === -1) return { name: part };
    const name = part.slice(0, idx).trim();
    const inner = part.slice(idx + 1, part.lastIndexOf(")"));
    return { name, children: parseSelect(inner) };
  });
}

let aliasCounter = 0;

function buildRowJson(table, nodes, alias) {
  const hasStar = nodes.some((n) => !n.children && n.name === "*");
  const scalarCols = nodes.filter((n) => !n.children && n.name !== "*").map((n) => ident(n.name));
  let base;
  if (hasStar) base = `to_jsonb(${alias})`;
  else if (scalarCols.length) base = `jsonb_build_object(${scalarCols.map((c) => `'${c}', ${alias}.${c}`).join(", ")})`;
  else base = `'{}'::jsonb`;

  const parts = [base];
  for (const emb of nodes.filter((n) => n.children)) {
    const rel = RELATIONS[table] && RELATIONS[table][emb.name];
    if (!rel) throw new Error(`Relação desconhecida: ${table}.${emb.name}`);
    const childAlias = `a${aliasCounter++}`;
    const childJson = buildRowJson(rel.table, emb.children, childAlias);
    const cond = `${childAlias}.${ident(rel.foreign)} = ${alias}.${ident(rel.local)}`;
    if (rel.type === "one") {
      parts.push(`jsonb_build_object('${emb.name}', (SELECT ${childJson} FROM ${rel.table} ${childAlias} WHERE ${cond} LIMIT 1))`);
    } else {
      parts.push(`jsonb_build_object('${emb.name}', coalesce((SELECT jsonb_agg(${childJson}) FROM ${rel.table} ${childAlias} WHERE ${cond}), '[]'::jsonb))`);
    }
  }
  return parts.join(" || ");
}

// Escopo de leitura para não-admin (vendedor): replica as regras de autorização do app.
// Retorna uma condição SQL referenciando `alias`, empurrando o userId em `params`.
function scopeClause(table, alias, userId, params) {
  switch (table) {
    case "vendas":
      params.push(userId);
      return `EXISTS (SELECT 1 FROM venda_vendedores vv JOIN vendedores ve ON ve.id = vv.vendedor_id WHERE vv.venda_id = ${alias}.id AND ve.user_id = $${params.length})`;
    case "venda_vendedores":
      params.push(userId);
      return `EXISTS (SELECT 1 FROM vendedores ve WHERE ve.id = ${alias}.vendedor_id AND ve.user_id = $${params.length})`;
    case "parcelas":
      params.push(userId);
      return `EXISTS (SELECT 1 FROM venda_vendedores vv JOIN vendedores ve ON ve.id = vv.vendedor_id WHERE vv.venda_id = ${alias}.venda_id AND ve.user_id = $${params.length})`;
    case "vendedores":
      params.push(userId);
      return `${alias}.user_id = $${params.length}`;
    case "profiles":
    case "user_roles":
      params.push(userId);
      return `${alias}.user_id = $${params.length}`;
    default:
      return null; // clientes / company_settings: leitura liberada a autenticados
  }
}

function buildQuery({ table, select, filters = [], order, limit, scope }) {
  ident(table);
  if (!READABLE_TABLES.has(table)) throw new Error(`Tabela não permitida: ${table}`);
  aliasCounter = 0;
  const alias = `a${aliasCounter++}`;
  const rowJson = buildRowJson(table, parseSelect(select || "*"), alias);
  const params = [];
  const where = [];
  for (const f of filters) {
    ident(f.column);
    params.push(f.value);
    if (f.op === "in") where.push(`${alias}.${f.column} = ANY($${params.length})`);
    else if (f.op === "neq") where.push(`${alias}.${f.column} != $${params.length}`);
    else where.push(`${alias}.${f.column} = $${params.length}`);
  }
  if (scope && !scope.isAdmin) {
    const clause = scopeClause(table, alias, scope.userId, params);
    if (clause) where.push(clause);
  }
  let sql = `SELECT ${rowJson} AS row FROM ${table} ${alias}`;
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  if (order) sql += ` ORDER BY ${alias}.${ident(order.column)} ${order.ascending === false ? "DESC" : "ASC"}`;
  if (limit) sql += ` LIMIT ${parseInt(limit, 10)}`;
  return { sql, params };
}

function buildInsert(table, values) {
  ident(table);
  if (!READABLE_TABLES.has(table)) throw new Error(`Tabela não permitida: ${table}`);
  const rows = Array.isArray(values) ? values : [values];
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].map(ident);
  const params = [];
  const tuples = rows.map((row) => {
    const ph = cols.map((c) => { params.push(row[c] ?? null); return `$${params.length}`; });
    return `(${ph.join(", ")})`;
  });
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES ${tuples.join(", ")} RETURNING *`;
  return { sql, params };
}

function buildUpdate(table, values, filters = []) {
  ident(table);
  if (!READABLE_TABLES.has(table)) throw new Error(`Tabela não permitida: ${table}`);
  const params = [];
  const sets = Object.keys(values).map((c) => { ident(c); params.push(values[c]); return `${c} = $${params.length}`; });
  const where = filters.map((f) => {
    ident(f.column);
    params.push(f.value);
    if (f.op === "in") return `${f.column} = ANY($${params.length})`;
    if (f.op === "neq") return `${f.column} != $${params.length}`;
    return `${f.column} = $${params.length}`;
  });
  const sql = `UPDATE ${table} SET ${sets.join(", ")}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} RETURNING *`;
  return { sql, params };
}

function buildDelete(table, filters = []) {
  ident(table);
  if (!READABLE_TABLES.has(table)) throw new Error(`Tabela não permitida: ${table}`);
  const params = [];
  const where = filters.map((f) => {
    ident(f.column);
    params.push(f.value);
    if (f.op === "in") return `${f.column} = ANY($${params.length})`;
    if (f.op === "neq") return `${f.column} != $${params.length}`;
    return `${f.column} = $${params.length}`;
  });
  const sql = `DELETE FROM ${table}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} RETURNING *`;
  return { sql, params };
}

module.exports = { buildQuery, buildInsert, buildUpdate, buildDelete, READABLE_TABLES };
