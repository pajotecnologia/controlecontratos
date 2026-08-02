require("dotenv").config({ path: require("path").join(__dirname, ".env"), override: true });
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("./db");
const { signToken, hashPassword, verifyPassword, requireAuth } = require("./auth");
const { buildQuery, buildInsert, buildUpdate, buildDelete } = require("./query");
const { sendWhatsApp, sendEmail, sendReceiptWhatsApp, sendReceiptEmail } = require("./notifications");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

const TABLES_ADMIN_WRITE = new Set([
  "clientes", "vendedores", "vendas", "venda_vendedores", "parcelas",
  "company_settings", "evolution_settings", "smtp_settings", "user_roles",
  "modelos", "contratos", "propostas", "proposta_itens",
]);

// ============================================================================
// AUTH
// ============================================================================
app.post("/auth/signup", async (req, res) => {
  const { email, password, full_name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email e senha obrigatórios" });
  try {
    const exists = await db.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (exists.rows.length) return res.status(400).json({ error: "Email já cadastrado" });

    const hash = await hashPassword(password);
    const { rows } = await db.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, hash]
    );
    const user = rows[0];
    await db.query("INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)", [user.id, full_name || ""]);

    // Primeiro usuário do sistema vira admin
    const adminCount = await db.query("SELECT 1 FROM user_roles WHERE role = 'admin' LIMIT 1");
    const role = adminCount.rows.length ? "vendedor" : "admin";
    await db.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [user.id, role]);

    res.json({ token: signToken(user), user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await db.query("SELECT id, email, password_hash FROM users WHERE email = $1", [email]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: "Email ou senha inválidos" });
    }
    res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/auth/me", requireAuth, async (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email }, isAdmin: req.user.isAdmin });
});

app.post("/auth/update-password", requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: "Senha muito curta" });
  try {
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(password), req.user.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Solicitar reset: gera token. Retorna o link (email real depende de SMTP configurado).
app.post("/auth/request-reset", async (req, res) => {
  const { email, redirect_to } = req.body;
  try {
    const { rows } = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (!rows.length) return res.json({ success: true }); // não revela se email existe
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await db.query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [rows[0].id, token, expires]
    );
    const link = `${redirect_to || ""}?token=${token}`;
    try {
      await sendEmail({ test: true, test_email: email, _reset_link: link });
    } catch { /* SMTP pode não estar configurado; link volta na resposta */ }
    res.json({ success: true, reset_link: link });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/auth/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 6) return res.status(400).json({ error: "Dados inválidos" });
  try {
    const { rows } = await db.query(
      "SELECT user_id FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > now()",
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: "Token inválido ou expirado" });
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(password), rows[0].user_id]);
    await db.query("UPDATE password_reset_tokens SET used = true WHERE token = $1", [token]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// DADOS (query genérica) — replica supabase.from(...)
// ============================================================================
app.post("/data/select", requireAuth, async (req, res) => {
  try {
    const { table, select, filters, order, limit } = req.body;
    const { sql, params } = buildQuery({
      table, select, filters, order, limit,
      scope: { isAdmin: req.user.isAdmin, userId: req.user.id },
    });
    const { rows } = await db.query(sql, params);
    res.json({ data: rows.map((r) => r.row) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

function ensureWrite(req, res, table) {
  if (!TABLES_ADMIN_WRITE.has(table)) { res.status(403).json({ error: "Escrita não permitida" }); return false; }
  if (!req.user.isAdmin) { res.status(403).json({ error: "Apenas administradores" }); return false; }
  return true;
}

app.post("/data/insert", requireAuth, async (req, res) => {
  try {
    const { table, values } = req.body;
    if (!ensureWrite(req, res, table)) return;
    const { sql, params } = buildInsert(table, values);
    const { rows } = await db.query(sql, params);
    res.json({ data: rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/data/update", requireAuth, async (req, res) => {
  try {
    const { table, values, filters } = req.body;
    if (!ensureWrite(req, res, table)) return;
    const { sql, params } = buildUpdate(table, values, filters);
    const { rows } = await db.query(sql, params);
    res.json({ data: rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/data/delete", requireAuth, async (req, res) => {
  try {
    const { table, filters } = req.body;
    if (!ensureWrite(req, res, table)) return;
    const { sql, params } = buildDelete(table, filters);
    const { rows } = await db.query(sql, params);
    res.json({ data: rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============================================================================
// RELATÓRIO — extrato financeiro filtrável (somente admin)
// ----------------------------------------------------------------------------
// Modelo de parcelas dedicada: cada linha de parcela traz vencimento, pagamento,
// N.F. e flag pago. O extrato une parcelas x contratos x comissões.
// ============================================================================
app.post("/reports/extrato", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  const { start, end, cliente_id, vendedor_id, status_pagamento } = req.body || {};
  try {
    const params = [];
    const where = [];
    if (start) { params.push(start); where.push(`COALESCE(p.data_vencimento, v.data_venda) >= $${params.length}`); }
    if (end) { params.push(end); where.push(`COALESCE(p.data_vencimento, v.data_venda) <= $${params.length}`); }
    if (cliente_id) { params.push(cliente_id); where.push(`v.cliente_id = $${params.length}`); }
    if (vendedor_id) { params.push(vendedor_id); where.push(`vv.vendedor_id = $${params.length}`); }
    if (status_pagamento === "pago") where.push("p.pago = true");
    if (status_pagamento === "pendente") where.push("(p.id IS NULL OR p.pago = false)");
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await db.query(
      `SELECT v.id AS venda_id, v.cliente, v.valor_servico, v.data_venda,
              v.mes_referencia, v.cliente_pagou, v.data_pagamento_cliente,
              p.id AS parcela_id, p.numero_parcela, p.valor AS parcela_valor,
              p.data_vencimento, p.data_pagamento AS parcela_pagamento, p.pago AS parcela_pago, p.numero_nf,
              vv.id AS vv_id, vv.percentual, vv.valor_comissao, vv.comissao_paga, vv.data_pagamento,
              ve.nome AS vendedor_nome
         FROM vendas v
         LEFT JOIN parcelas p ON p.venda_id = v.id
         LEFT JOIN venda_vendedores vv ON vv.venda_id = v.id
         LEFT JOIN vendedores ve ON ve.id = vv.vendedor_id
         ${whereSql}
         ORDER BY COALESCE(p.data_vencimento, v.data_venda) ASC, v.cliente ASC, p.numero_parcela ASC`,
      params
    );

    // Resumo
    const vendasVistas = new Set();
    let faturado = 0, recebido = 0, comissaoTotal = 0, comissaoPaga = 0;
    for (const r of rows) {
      if (r.venda_id && !vendasVistas.has(r.venda_id)) {
        vendasVistas.add(r.venda_id);
        faturado += Number(r.valor_servico);
        if (r.cliente_pagou) recebido += Number(r.valor_servico);
      }
      if (r.vv_id) {
        comissaoTotal += Number(r.valor_comissao);
        if (r.comissao_paga) comissaoPaga += Number(r.valor_comissao);
      }
    }

    res.json({
      data: rows,
      resumo: {
        faturado, recebido, pendente: faturado - recebido,
        comissao_total: comissaoTotal, comissao_paga: comissaoPaga,
        comissao_pendente: comissaoTotal - comissaoPaga,
        contratos: vendasVistas.size,
      },
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============================================================================
// USUÁRIOS (listagem com email + role) — usado pela tela Usuários
// ============================================================================
app.get("/users", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { rows } = await db.query(
      `SELECT u.id AS user_id, u.email, p.full_name,
              r.id AS role_id, coalesce(r.role::text, 'vendedor') AS role
         FROM profiles p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN user_roles r ON r.user_id = u.id
        ORDER BY p.full_name`
    );
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// UPLOAD (logomarca)
// ============================================================================
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 5 * 1024 * 1024 } });
app.post("/upload", requireAuth, upload.single("file"), (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo" });
  const ext = (req.file.originalname.split(".").pop() || "png").toLowerCase();
  const finalName = `logo-${Date.now()}.${ext}`;
  fs.renameSync(req.file.path, path.join(UPLOAD_DIR, finalName));
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  res.json({ url: `${base}/uploads/${finalName}` });
});

// ============================================================================
// MESSAGE TEMPLATES (CRUD)
// ============================================================================
app.get("/message-templates", requireAuth, async (_req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM message_templates ORDER BY created_at ASC");
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/message-templates", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { nome, evento, corpo, ativo_whatsapp, ativo_email } = req.body;
    const { rows } = await db.query(
      "INSERT INTO message_templates (nome, evento, corpo, ativo_whatsapp, ativo_email) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [nome, evento || "pagamento", corpo || "", !!ativo_whatsapp, !!ativo_email]
    );
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put("/message-templates/:id", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { nome, evento, corpo, ativo_whatsapp, ativo_email } = req.body;
    const { rows } = await db.query(
      "UPDATE message_templates SET nome=$1, evento=$2, corpo=$3, ativo_whatsapp=$4, ativo_email=$5, updated_at=now() WHERE id=$6 RETURNING *",
      [nome, evento || "pagamento", corpo || "", !!ativo_whatsapp, !!ativo_email, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Não encontrado" });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete("/message-templates/:id", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    await db.query("DELETE FROM message_templates WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============================================================================
// NOTIFICAÇÕES
// ============================================================================
app.post("/notify/whatsapp", requireAuth, async (req, res) => {
  try {
    const { venda_vendedor_id, template_type } = req.body;
    res.json(await sendWhatsApp(venda_vendedor_id, template_type));
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post("/notify/email", requireAuth, async (req, res) => {
  try {
    res.json(await sendEmail(req.body));
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post("/notify/receipt", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { parcela_id, channel } = req.body;
    if (!parcela_id) return res.status(400).json({ error: "parcela_id obrigatório" });
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    if (channel === "whatsapp") res.json(await sendReceiptWhatsApp(parcela_id));
    else if (channel === "email") res.json(await sendReceiptEmail(parcela_id, baseUrl));
    else res.status(400).json({ error: "Canal inválido" });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ============================================================================
// CONTRATOS — pré-visualização de modelo preenchido com dados da empresa + cliente
// ============================================================================
app.post("/contratos/preview", requireAuth, async (req, res) => {
  try {
    const { conteudo, cliente_id } = req.body || {};
    if (typeof conteudo !== "string") return res.status(400).json({ error: "conteudo obrigatório" });

    const comp = (await db.query("SELECT name, cnpj, cep, endereco, bairro, cidade, email, telefone, nome_responsavel, cargo_responsavel, cpf_responsavel, logo_url, assinatura_imagem FROM company_settings LIMIT 1")).rows[0] || {};
    let cliente = {};
    if (cliente_id) {
      cliente = (await db.query("SELECT nome, telefone, email, cpf_cnpj, endereco, bairro, cidade, estado, cep, nome_responsavel, cargo_responsavel, cpf_responsavel FROM clientes WHERE id = $1", [cliente_id])).rows[0] || {};
    }
    const c = req.body.contrato || {};
    const empresaEnderecoCompleto = [comp.endereco, comp.bairro, comp.cidade, comp.cep ? `CEP: ${comp.cep}` : ""].filter(Boolean).join(" - ");
    const clienteEnderecoCompleto = [cliente.endereco, cliente.bairro, cliente.cidade, cliente.estado, cliente.cep ? `CEP: ${cliente.cep}` : ""].filter(Boolean).join(" - ");

    // Constrói URL absoluta da logomarca caso venha relativa (/uploads/...)
    let logoUrl = comp.logo_url || "";
    if (logoUrl && logoUrl.startsWith("/")) {
      logoUrl = `${req.protocol}://${req.get("host")}${logoUrl}`;
    }

    const fmtMoeda = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtData = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "");
    const fmtIsoData = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");
    const hoje = new Date();
    const empresaLogo = logoUrl ? `<img src="${logoUrl}" alt="${comp.name || "Logo"}" style="max-height:80px; max-width:200px; object-fit:contain;" />` : "";
    const empresaEndereco = [comp.endereco, comp.bairro, comp.cidade, comp.cep ? `CEP: ${comp.cep}` : ""].filter(Boolean).join(" - ");
    const empresaContato = [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""].filter(Boolean).join(" | ");
    const empresaCabecalho = `<div style="text-align:center; border-bottom:2px solid #333; padding-bottom:10px; margin-bottom:14px;">
${empresaLogo}
<div style="font-size:16px; font-weight:bold; color:#1e293b; margin-top:6px;">${comp.name || ""}</div>
${comp.cnpj ? `<div style="font-size:12px; color:#475569;">CNPJ: ${comp.cnpj}</div>` : ""}
${empresaEndereco ? `<div style="font-size:12px; color:#475569;">${empresaEndereco}</div>` : ""}
${empresaContato ? `<div style="font-size:12px; color:#475569;">${empresaContato}</div>` : ""}
</div>`;

    const variaveis = {
      // Empresa
      empresa_nome: comp.name || "",
      empresa_cnpj: comp.cnpj || "",
      empresa_cep: comp.cep || "",
      empresa_endereco: comp.endereco || "",
      empresa_bairro: comp.bairro || "",
      empresa_cidade: comp.cidade || "",
      empresa_email: comp.email || "",
      empresa_telefone: comp.telefone || "",
      empresa_endereco_completo: empresaEnderecoCompleto,
      empresa_nome_responsavel: comp.nome_responsavel || "",
      empresa_cargo_responsavel: comp.cargo_responsavel || "",
      empresa_cpf_responsavel: comp.cpf_responsavel || "",
      empresa_logo: empresaLogo,
      empresa_cabecalho: empresaCabecalho,
      empresa_assinatura: comp.assinatura_imagem ? `<img src="${comp.assinatura_imagem}" alt="Assinatura" style="max-height:60px;max-width:200px;object-fit:contain;" />` : "",
      // Cliente
      cliente_nome: cliente.nome || "",
      cliente_telefone: cliente.telefone || "",
      cliente_email: cliente.email || "",
      cliente_cpf_cnpj: cliente.cpf_cnpj || "",
      cliente_endereco: cliente.endereco || "",
      cliente_bairro: cliente.bairro || "",
      cliente_cidade: cliente.cidade || "",
      cliente_estado: cliente.estado || "",
      cliente_cep: cliente.cep || "",
      cliente_endereco_completo: clienteEnderecoCompleto,
      cliente_nome_responsavel: cliente.nome_responsavel || "",
      cliente_cpf_responsavel: cliente.cpf_responsavel || "",
      cliente_cargo_responsavel: cliente.cargo_responsavel || "",
      // Contrato
      data_atual: hoje.toLocaleDateString("pt-BR"),
      data_emissao: "",
      data_vencimento: "",
      valor: "",
      taxa_implantacao: "",
      forma_pagamento: req.body.forma_pagamento || "",
      forma_reajuste: req.body.forma_reajuste || "",
      modelo_equipamento: req.body.modelo_equipamento || "",
      prazo_contrato: req.body.prazo_contrato || "",
    };
    if (req.body.valor !== undefined) variaveis.valor = fmtMoeda(req.body.valor);
    if (req.body.taxa_implantacao !== undefined) variaveis.taxa_implantacao = fmtMoeda(req.body.taxa_implantacao);
    if (req.body.data_emissao) variaveis.data_emissao = fmtData(req.body.data_emissao);
    if (req.body.data_vencimento) variaveis.data_vencimento = req.body.data_vencimento;

    const preenchido = conteudo.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      Object.prototype.hasOwnProperty.call(variaveis, k) ? String(variaveis[k] ?? "") : `{{${k}}}`
    );

    res.json({ conteudo: preenchido, variaveis_disponiveis: Object.keys(variaveis) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


// ============================================================================
// ASSINATURA DIGITAL DE CONTRATOS
// ============================================================================

// Gerar token e enviar link por WhatsApp
app.post("/contratos/:id/enviar-assinatura", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { id } = req.params;
    const token = crypto.randomBytes(12).toString("base64url");

    // Busca contrato + cliente + modelo
    const { rows } = await db.query(
      `SELECT c.*, cl.nome AS cliente_nome, cl.telefone AS cliente_telefone,
              m.conteudo AS modelo_conteudo, m.nome AS modelo_nome
         FROM contratos c
         LEFT JOIN clientes cl ON cl.id = c.cliente_id
         LEFT JOIN modelos m ON m.id = c.modelo_id
        WHERE c.id = $1`, [id]
    );
    const contrato = rows[0];
    if (!contrato) return res.status(404).json({ error: "Contrato não encontrado" });

    await db.query(
      "UPDATE contratos SET assinatura_token = $1, assinatura_status = 'enviado', updated_at = now() WHERE id = $2",
      [token, id]
    );

    const { rows: csRows } = await db.query("SELECT public_url FROM company_settings LIMIT 1");
    const base = (() => {
      const dbUrl = (csRows[0]?.public_url || "").trim();
      if (dbUrl) return dbUrl.replace(/\/$/, "");
      const env = (process.env.PUBLIC_URL || "").trim();
      if (env) return env.replace(/\/$/, "");
      return `${req.protocol}://${req.get("host")}`;
    })();
    const link = `${base}/a/${token}`;
    await db.query("UPDATE contratos SET assinatura_link = $1 WHERE id = $2", [link, id]);
    const clienteNome = contrato.cliente_nome || "Cliente";
    const msg = `Olá ${clienteNome}, segue o link para leitura e assinatura do seu contrato:\n\n${link}\n\nAcesse, leia, e assine digitalmente.`;

    // Tentar enviar WhatsApp se Evolution estiver configurado
    let whatsappEnviado = false;
    try {
      const { rows: evRows } = await db.query("SELECT * FROM evolution_settings LIMIT 1");
      const ev = evRows[0];
      if (ev && ev.instance_url && ev.api_key && ev.instance_name) {
        let whatsapp = (contrato.cliente_telefone || "").replace(/\D/g, "");
        if (whatsapp) {
          if (!whatsapp.startsWith("55")) whatsapp = "55" + whatsapp;
          const instanceUrl = ev.instance_url.replace(/\/$/, "");
          await fetch(`${instanceUrl}/message/sendText/${ev.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: ev.api_key },
            body: JSON.stringify({ number: whatsapp, text: msg }),
          });
          whatsappEnviado = true;
        }
      }
    } catch { /* WhatsApp falhou, mas link foi gerado */ }

    res.json({ link, token, whatsapp_enviado: whatsappEnviado });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Endpoint público: info básica da empresa (logo, nome) para a tela de login
app.get("/api/public/company-info", async (_req, res) => {
  try {
    const { rows } = await db.query("SELECT name, logo_url FROM company_settings LIMIT 1");
    res.json(rows[0] || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Página pública de assinatura: retorna dados do contrato sem autenticação
app.get("/api/public/assinar/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { rows } = await db.query(
      `SELECT c.id, c.data_emissao, c.data_vencimento, c.valor, c.taxa_implantacao,
              c.forma_pagamento, c.forma_reajuste, c.modelo_equipamento, c.prazo_contrato,
              c.assinatura_status, c.assinatura_observacao, c.assinatura_imagem,
              c.assinatura_data, c.assinatura_nome,
              cl.id AS cliente_id, cl.nome AS cliente_nome,
              m.conteudo AS modelo_conteudo,
              cs.assinatura_imagem AS empresa_assinatura_imagem,
              cs.nome_responsavel  AS empresa_nome_responsavel,
              cs.cargo_responsavel AS empresa_cargo_responsavel,
              cs.name              AS empresa_nome
         FROM contratos c
         LEFT JOIN clientes cl ON cl.id = c.cliente_id
         LEFT JOIN modelos m ON m.id = c.modelo_id
         LEFT JOIN company_settings cs ON true
        WHERE c.assinatura_token = $1`, [token]
    );
    const contrato = rows[0];
    if (!contrato) return res.status(404).json({ error: "Link inválido ou expirado" });
    res.json({ contrato });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Preview do contrato pela página pública (sem auth)
app.post("/api/public/assinar/:token/preview", async (req, res) => {
  try {
    const { token } = req.params;
    const { rows } = await db.query(
      `SELECT c.*, cl.nome, cl.telefone, cl.email, cl.cpf_cnpj, cl.endereco,
              cl.nome_responsavel AS c_nome_resp, cl.cargo_responsavel AS c_cargo_resp, cl.cpf_responsavel AS c_cpf_resp,
              m.conteudo AS modelo_conteudo
         FROM contratos c
         LEFT JOIN clientes cl ON cl.id = c.cliente_id
         LEFT JOIN modelos m ON m.id = c.modelo_id
        WHERE c.assinatura_token = $1`, [token]
    );
    const c = rows[0];
    if (!c) return res.status(404).json({ error: "Link inválido" });

    // Se tem conteúdo personalizado, retorna direto sem renderizar variáveis
    if (c.conteudo_personalizado) {
      return res.json({ conteudo: c.conteudo_personalizado });
    }

    const comp = (await db.query("SELECT name, cnpj, cep, endereco, bairro, cidade, email, telefone, nome_responsavel, cargo_responsavel, cpf_responsavel, logo_url, assinatura_imagem FROM company_settings LIMIT 1")).rows[0] || {};
    const cliente = { nome: c.nome, telefone: c.telefone, email: c.email, cpf_cnpj: c.cpf_cnpj, endereco: c.endereco, nome_responsavel: c.c_nome_resp, cargo_responsavel: c.c_cargo_resp, cpf_responsavel: c.c_cpf_resp };

    let logoUrl = comp.logo_url || "";
    if (logoUrl && logoUrl.startsWith("/")) logoUrl = `${req.protocol}://${req.get("host")}${logoUrl}`;

    const fmtMoeda = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtData = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "");
    const hoje = new Date();
    const empresaLogo = logoUrl ? `<img src="${logoUrl}" alt="${comp.name || "Logo"}" style="max-height:80px;max-width:200px;object-fit:contain;" />` : "";
    const empresaEnderecoCompleto = [comp.endereco, comp.bairro, comp.cidade, comp.cep ? `CEP: ${comp.cep}` : ""].filter(Boolean).join(" - ");
    const empresaContato = [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""].filter(Boolean).join(" | ");

    const empresaCabecalho = `<div style="text-align:center; border-bottom:2px solid #333; padding-bottom:10px; margin-bottom:14px;">
${empresaLogo}
<div style="font-size:16px; font-weight:bold; color:#1e293b; margin-top:6px;">${comp.name || ""}</div>
${comp.cnpj ? `<div style="font-size:12px; color:#475569;">CNPJ: ${comp.cnpj}</div>` : ""}
${empresaEnderecoCompleto ? `<div style="font-size:12px; color:#475569;">${empresaEnderecoCompleto}</div>` : ""}
${empresaContato ? `<div style="font-size:12px; color:#475569;">${empresaContato}</div>` : ""}
</div>`;

    const variaveis = {
      empresa_nome: comp.name || "", empresa_cnpj: comp.cnpj || "", empresa_cep: comp.cep || "",
      empresa_endereco: comp.endereco || "", empresa_bairro: comp.bairro || "", empresa_cidade: comp.cidade || "",
      empresa_email: comp.email || "", empresa_telefone: comp.telefone || "",
      empresa_endereco_completo: empresaEnderecoCompleto,
      empresa_nome_responsavel: comp.nome_responsavel || "", empresa_cargo_responsavel: comp.cargo_responsavel || "",
      empresa_cpf_responsavel: comp.cpf_responsavel || "", empresa_logo: empresaLogo, empresa_cabecalho: empresaCabecalho,
      empresa_assinatura: comp.assinatura_imagem ? `<img src="${comp.assinatura_imagem}" alt="Assinatura" style="max-height:60px;max-width:200px;object-fit:contain;" />` : "",
      cliente_nome: cliente.nome || "", cliente_telefone: cliente.telefone || "", cliente_email: cliente.email || "",
      cliente_cpf_cnpj: cliente.cpf_cnpj || "", cliente_endereco: cliente.endereco || "",
      cliente_nome_responsavel: cliente.nome_responsavel || "", cliente_cpf_responsavel: cliente.cpf_responsavel || "",
      cliente_cargo_responsavel: cliente.cargo_responsavel || "",
      data_atual: hoje.toLocaleDateString("pt-BR"),
      data_emissao: fmtData(c.data_emissao), data_vencimento: fmtData(c.data_vencimento),
      valor: fmtMoeda(c.valor), taxa_implantacao: fmtMoeda(c.taxa_implantacao),
      forma_pagamento: c.forma_pagamento || "", forma_reajuste: c.forma_reajuste || "",
      modelo_equipamento: c.modelo_equipamento || "", prazo_contrato: c.prazo_contrato || "",
    };

    const preenchido = (c.modelo_conteudo || "").replace(/\{\{(\w+)\}\}/g, (_, k) =>
      Object.prototype.hasOwnProperty.call(variaveis, k) ? String(variaveis[k] ?? "") : `{{${k}}}`
    );
    res.json({ conteudo: preenchido });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Salvar assinatura do cliente (sem autenticação)
app.post("/api/public/assinar/:token/assinar", async (req, res) => {
  try {
    const { token } = req.params;
    const { assinatura_imagem, assinatura_nome, assinatura_observacao } = req.body;
    if (!assinatura_imagem) return res.status(400).json({ error: "Assinatura obrigatória" });
    if (!assinatura_nome || !assinatura_nome.trim()) return res.status(400).json({ error: "Nome do assinante obrigatório" });

    const { rows } = await db.query("SELECT id, assinatura_status FROM contratos WHERE assinatura_token = $1", [token]);
    if (!rows.length) return res.status(404).json({ error: "Link inválido" });
    if (rows[0].assinatura_status === "assinado") return res.status(400).json({ error: "Contrato já assinado" });

    await db.query(
      `UPDATE contratos SET assinatura_status = 'assinado', assinatura_imagem = $1,
       assinatura_nome = $2, assinatura_observacao = $3, assinatura_data = now(), updated_at = now()
       WHERE assinatura_token = $4`,
      [assinatura_imagem, assinatura_nome.trim(), assinatura_observacao || null, token]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Enviar observação/recusa sem assinar
app.post("/api/public/assinar/:token/observacao", async (req, res) => {
  try {
    const { token } = req.params;
    const { assinatura_observacao } = req.body;
    const { rows } = await db.query("SELECT id FROM contratos WHERE assinatura_token = $1", [token]);
    if (!rows.length) return res.status(404).json({ error: "Link inválido" });
    await db.query(
      "UPDATE contratos SET assinatura_observacao = $1, assinatura_status = 'recusado', updated_at = now() WHERE assinatura_token = $2",
      [assinatura_observacao || "", token]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Link resumido de assinatura: redireciona para a tela pública do contrato.
app.get("/a/:token", (req, res) => {
  res.redirect(302, `/assinar/${req.params.token}`);
});

// ============================================================================
// ASSINATURA DIGITAL DE PROPOSTAS
// ============================================================================

app.post("/propostas/:id/enviar-assinatura", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { id } = req.params;
    const token = crypto.randomBytes(12).toString("base64url");
    const { rows } = await db.query(
      `SELECT p.*, cl.nome AS cliente_nome, cl.telefone AS cliente_telefone
         FROM propostas p
         LEFT JOIN clientes cl ON cl.id = p.cliente_id
        WHERE p.id = $1`, [id]
    );
    const proposta = rows[0];
    if (!proposta) return res.status(404).json({ error: "Proposta não encontrada" });
    await db.query(
      "UPDATE propostas SET assinatura_token = $1, assinatura_status = 'enviado', updated_at = now() WHERE id = $2",
      [token, id]
    );
    const { rows: csRows } = await db.query("SELECT public_url FROM company_settings LIMIT 1");
    const base = (() => {
      const dbUrl = (csRows[0]?.public_url || "").trim();
      if (dbUrl) return dbUrl.replace(/\/$/, "");
      const env = (process.env.PUBLIC_URL || "").trim();
      if (env) return env.replace(/\/$/, "");
      return `${req.protocol}://${req.get("host")}`;
    })();
    const link = `${base}/p/${token}`;
    await db.query("UPDATE propostas SET assinatura_link = $1 WHERE id = $2", [link, id]);
    const clienteNome = proposta.cliente_nome || "Cliente";
    const msg = `Olá ${clienteNome}, segue o link para leitura e assinatura da sua proposta:\n\n${link}\n\nAcesse, leia, e assine digitalmente.`;
    let whatsappEnviado = false;
    try {
      const { rows: evRows } = await db.query("SELECT * FROM evolution_settings LIMIT 1");
      const ev = evRows[0];
      if (ev && ev.instance_url && ev.api_key && ev.instance_name) {
        let whatsapp = (proposta.cliente_telefone || "").replace(/\D/g, "");
        if (whatsapp) {
          if (!whatsapp.startsWith("55")) whatsapp = "55" + whatsapp;
          const instanceUrl = ev.instance_url.replace(/\/$/, "");
          await fetch(`${instanceUrl}/message/sendText/${ev.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: ev.api_key },
            body: JSON.stringify({ number: whatsapp, text: msg }),
          });
          whatsappEnviado = true;
        }
      }
    } catch { /* WhatsApp falhou */ }
    res.json({ link, token, whatsapp_enviado: whatsappEnviado });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Link curto para proposta
app.get("/p/:token", (req, res) => {
  res.redirect(302, `/assinar-proposta/${req.params.token}`);
});

// API pública da proposta
app.get("/api/public/assinar-proposta/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { rows } = await db.query(
      `SELECT p.id, p.data_proposta, p.titulo, p.tipo_proposta, p.total, p.desconto,
              p.assinatura_status, p.assinatura_observacao, p.assinatura_imagem,
              p.assinatura_data, p.assinatura_nome,
              cl.id AS cliente_id, cl.nome AS cliente_nome, cl.telefone AS cliente_telefone,
              cl.email AS cliente_email, cl.cpf_cnpj AS cliente_cpf_cnpj, cl.endereco AS cliente_endereco
         FROM propostas p
         LEFT JOIN clientes cl ON cl.id = p.cliente_id
        WHERE p.assinatura_token = $1`, [token]
    );
    const proposta = rows[0];
    if (!proposta) return res.status(404).json({ error: "Link inválido ou expirado" });
    const { rows: itensRows } = await db.query(
      "SELECT * FROM proposta_itens WHERE proposta_id = $1 ORDER BY ordem ASC",
      [proposta.id]
    );
    res.json({ proposta: { ...proposta, proposta_itens: itensRows } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Preview HTML da proposta pública
app.post("/api/public/assinar-proposta/:token/preview", async (req, res) => {
  try {
    const { token } = req.params;
    const { rows } = await db.query(
      `SELECT p.*, cl.nome, cl.telefone, cl.email, cl.cpf_cnpj, cl.endereco
         FROM propostas p
         LEFT JOIN clientes cl ON cl.id = p.cliente_id
        WHERE p.assinatura_token = $1`, [token]
    );
    const p = rows[0];
    if (!p) return res.status(404).json({ error: "Link inválido" });
    const { rows: itens } = await db.query(
      "SELECT * FROM proposta_itens WHERE proposta_id = $1 ORDER BY ordem ASC", [p.id]
    );
    const comp = (await db.query("SELECT name, cnpj, cep, endereco, bairro, cidade, email, telefone, nome_responsavel, logo_url FROM company_settings LIMIT 1")).rows[0] || {};
    let logoUrl = comp.logo_url || "";
    if (logoUrl && logoUrl.startsWith("/")) logoUrl = `${req.protocol}://${req.get("host")}${logoUrl}`;
    const fmtMoeda = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtData = (d) => { if (!d) return "-"; const raw = String(d); const norm = raw.includes("T") ? raw : `${raw}T12:00:00`; const dt = new Date(norm); return isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString("pt-BR"); };
    const empresaLogo = logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:80px;max-width:200px;object-fit:contain;margin-bottom:8px;" />` : "";
    const compEndereco = [comp.endereco, comp.bairro, comp.cidade, comp.cep ? `CEP: ${comp.cep}` : ""].filter(Boolean).join(" - ");
    const compContato = [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""].filter(Boolean).join(" | ");
    const rowsHtml = itens.map((item, idx) => {
      let imgHtml = "";
      if (item.imagem_url) {
        let imgSrc = item.imagem_url;
        if (imgSrc.startsWith("/")) imgSrc = `${req.protocol}://${req.get("host")}${imgSrc}`;
        imgHtml = `<br/><img src="${imgSrc}" alt="Item" style="max-height:100px;max-width:150px;object-fit:contain;margin-top:5px;" />`;
      }
      return `<tr>
        <td style="border:1px solid #cbd5e1;padding:8px;">${idx + 1}. ${item.descricao}${imgHtml}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${item.quantidade}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:right;">R$ ${fmtMoeda(item.valor_unitario)}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:right;">R$ ${fmtMoeda(item.total)}</td>
      </tr>`;
    }).join("");
    const desc = Number(p.desconto || 0);
    const total = Number(p.total || 0);
    const totalItens = itens.reduce((s, i) => s + Number(i.total || 0), 0);
    const descRow = desc > 0 ? `
      <tr><td colspan="3" style="border:1px solid #cbd5e1;padding:8px;text-align:right;">Subtotal:</td><td style="border:1px solid #cbd5e1;padding:8px;text-align:right;">R$ ${fmtMoeda(totalItens)}</td></tr>
      <tr style="color:#dc2626;"><td colspan="3" style="border:1px solid #cbd5e1;padding:8px;text-align:right;">Desconto:</td><td style="border:1px solid #cbd5e1;padding:8px;text-align:right;">- R$ ${fmtMoeda(desc)}</td></tr>` : "";
    const html = `<div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5;max-width:800px;margin:0 auto;">
      <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:14px;">
        ${empresaLogo}
        <div style="font-size:16px;font-weight:bold;margin-top:6px;">${comp.name || ""}</div>
        ${comp.cnpj ? `<div style="font-size:12px;color:#475569;">CNPJ: ${comp.cnpj}</div>` : ""}
        ${compEndereco ? `<div style="font-size:12px;color:#475569;">${compEndereco}</div>` : ""}
        ${compContato ? `<div style="font-size:12px;color:#475569;">${compContato}</div>` : ""}
      </div>
      <div style="text-align:center;margin-bottom:20px;">
        <h1 style="font-size:20px;margin:0 0 5px;">${p.titulo || "PROPOSTA COMERCIAL"}</h1>
        <div style="font-size:12px;color:#64748b;">Data: ${fmtData(p.data_proposta)}${p.tipo_proposta ? ` | Tipo: ${p.tipo_proposta}` : ""}</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:20px;font-size:13px;">
        <div style="font-weight:bold;margin-bottom:6px;">DADOS DO CLIENTE</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
          <div><strong>Cliente:</strong> ${p.nome || "-"}</div>
          <div><strong>CPF/CNPJ:</strong> ${p.cpf_cnpj || "-"}</div>
          <div><strong>Endereço:</strong> ${p.endereco || "-"}</div>
          <div><strong>Telefone:</strong> ${p.telefone || "-"}</div>
          <div><strong>E-mail:</strong> ${p.email || "-"}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Descrição</th>
          <th style="border:1px solid #cbd5e1;padding:8px;text-align:center;width:60px;">Qtd</th>
          <th style="border:1px solid #cbd5e1;padding:8px;text-align:right;width:110px;">Unitário</th>
          <th style="border:1px solid #cbd5e1;padding:8px;text-align:right;width:110px;">Total</th>
        </tr></thead>
        <tbody>
          ${rowsHtml}
          ${descRow}
          <tr style="font-weight:bold;background:#f8fafc;">
            <td colspan="3" style="border:1px solid #cbd5e1;padding:10px;text-align:right;">VALOR TOTAL:</td>
            <td style="border:1px solid #cbd5e1;padding:10px;text-align:right;">R$ ${fmtMoeda(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
    res.json({ conteudo: html });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/public/assinar-proposta/:token/assinar", async (req, res) => {
  try {
    const { token } = req.params;
    const { assinatura_imagem, assinatura_nome, assinatura_observacao } = req.body;
    if (!assinatura_imagem) return res.status(400).json({ error: "Assinatura obrigatória" });
    if (!assinatura_nome || !assinatura_nome.trim()) return res.status(400).json({ error: "Nome do assinante obrigatório" });
    const { rows } = await db.query("SELECT id, assinatura_status FROM propostas WHERE assinatura_token = $1", [token]);
    if (!rows.length) return res.status(404).json({ error: "Link inválido" });
    if (rows[0].assinatura_status === "assinado") return res.status(400).json({ error: "Proposta já assinada" });
    await db.query(
      `UPDATE propostas SET assinatura_status = 'assinado', assinatura_imagem = $1,
       assinatura_nome = $2, assinatura_observacao = $3, assinatura_data = now(), updated_at = now()
       WHERE assinatura_token = $4`,
      [assinatura_imagem, assinatura_nome.trim(), assinatura_observacao || null, token]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/public/assinar-proposta/:token/observacao", async (req, res) => {
  try {
    const { token } = req.params;
    const { assinatura_observacao } = req.body;
    const { rows } = await db.query("SELECT id FROM propostas WHERE assinatura_token = $1", [token]);
    if (!rows.length) return res.status(404).json({ error: "Link inválido" });
    await db.query(
      "UPDATE propostas SET assinatura_observacao = $1, assinatura_status = 'recusado', updated_at = now() WHERE assinatura_token = $2",
      [assinatura_observacao || "", token]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Helper: builds proposal HTML — shared by preview and send endpoints
function buildPropostaHtmlServer(p, itens, comp, baseUrl) {
  let logoUrl = comp.logo_url || "";
  if (logoUrl && logoUrl.startsWith("/")) logoUrl = `${baseUrl}${logoUrl}`;
  const fmtMoeda = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtData = (d) => { if (!d) return "-"; const raw = String(d); const norm = raw.includes("T") ? raw : `${raw}T12:00:00`; const dt = new Date(norm); return isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString("pt-BR"); };
  const empresaLogo = logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:80px;max-width:200px;object-fit:contain;margin-bottom:8px;" />` : "";
  const compEndereco = [comp.endereco, comp.bairro, comp.cidade, comp.cep ? `CEP: ${comp.cep}` : ""].filter(Boolean).join(" - ");
  const compContato = [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""].filter(Boolean).join(" | ");
  const rowsHtml = itens.map((item, idx) => {
    let imgHtml = "";
    if (item.imagem_url) {
      let imgSrc = item.imagem_url;
      if (imgSrc.startsWith("/")) imgSrc = `${baseUrl}${imgSrc}`;
      imgHtml = `<br/><img src="${imgSrc}" alt="Item" style="max-height:100px;max-width:150px;object-fit:contain;margin-top:5px;" />`;
    }
    return `<tr>
      <td style="border:1px solid #cbd5e1;padding:8px;">${idx + 1}. ${item.descricao}${imgHtml}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${item.quantidade}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;text-align:right;">R$ ${fmtMoeda(item.valor_unitario)}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;text-align:right;">R$ ${fmtMoeda(item.total)}</td>
    </tr>`;
  }).join("");
  const desc = Number(p.desconto || 0);
  const total = Number(p.total || 0);
  const totalItens = itens.reduce((s, i) => s + Number(i.total || 0), 0);
  const descRow = desc > 0 ? `
    <tr><td colspan="3" style="border:1px solid #cbd5e1;padding:8px;text-align:right;">Subtotal:</td><td style="border:1px solid #cbd5e1;padding:8px;text-align:right;">R$ ${fmtMoeda(totalItens)}</td></tr>
    <tr style="color:#dc2626;"><td colspan="3" style="border:1px solid #cbd5e1;padding:8px;text-align:right;">Desconto:</td><td style="border:1px solid #cbd5e1;padding:8px;text-align:right;">- R$ ${fmtMoeda(desc)}</td></tr>` : "";
  return `<div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5;max-width:800px;margin:0 auto;">
    <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:14px;">
      ${empresaLogo}
      <div style="font-size:16px;font-weight:bold;margin-top:6px;">${comp.name || ""}</div>
      ${comp.cnpj ? `<div style="font-size:12px;color:#475569;">CNPJ: ${comp.cnpj}</div>` : ""}
      ${compEndereco ? `<div style="font-size:12px;color:#475569;">${compEndereco}</div>` : ""}
      ${compContato ? `<div style="font-size:12px;color:#475569;">${compContato}</div>` : ""}
    </div>
    <div style="text-align:center;margin-bottom:20px;">
      <h1 style="font-size:20px;margin:0 0 5px;">${p.titulo || "PROPOSTA COMERCIAL"}</h1>
      <div style="font-size:12px;color:#64748b;">Data: ${fmtData(p.data_proposta)}${p.tipo_proposta ? ` | Tipo: ${p.tipo_proposta}` : ""}</div>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:20px;font-size:13px;">
      <div style="font-weight:bold;margin-bottom:6px;">DADOS DO CLIENTE</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
        <div><strong>Cliente:</strong> ${p.nome || "-"}</div>
        <div><strong>CPF/CNPJ:</strong> ${p.cpf_cnpj || "-"}</div>
        <div><strong>Endereço:</strong> ${p.endereco || "-"}</div>
        <div><strong>Telefone:</strong> ${p.telefone || "-"}</div>
        <div><strong>E-mail:</strong> ${p.email || "-"}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Descrição</th>
        <th style="border:1px solid #cbd5e1;padding:8px;text-align:center;width:60px;">Qtd</th>
        <th style="border:1px solid #cbd5e1;padding:8px;text-align:right;width:110px;">Unitário</th>
        <th style="border:1px solid #cbd5e1;padding:8px;text-align:right;width:110px;">Total</th>
      </tr></thead>
      <tbody>
        ${rowsHtml}
        ${descRow}
        <tr style="font-weight:bold;background:#f8fafc;">
          <td colspan="3" style="border:1px solid #cbd5e1;padding:10px;text-align:right;">VALOR TOTAL:</td>
          <td style="border:1px solid #cbd5e1;padding:10px;text-align:right;">R$ ${fmtMoeda(total)}</td>
        </tr>
      </tbody>
    </table>
  </div>`;
}

// Send proposal by email
app.post("/propostas/:id/enviar-email", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT p.*, cl.nome, cl.telefone, cl.email, cl.cpf_cnpj, cl.endereco
         FROM propostas p
         LEFT JOIN clientes cl ON cl.id = p.cliente_id
        WHERE p.id = $1`, [id]
    );
    const p = rows[0];
    if (!p) return res.status(404).json({ error: "Proposta não encontrada" });
    if (!p.email) return res.status(400).json({ error: "Cliente sem e-mail cadastrado" });
    const { rows: itens } = await db.query("SELECT * FROM proposta_itens WHERE proposta_id = $1 ORDER BY ordem ASC", [id]);
    const comp = (await db.query("SELECT name, cnpj, cep, endereco, bairro, cidade, email, telefone, nome_responsavel, logo_url FROM company_settings LIMIT 1")).rows[0] || {};
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const { rows: smtpRows } = await db.query("SELECT * FROM smtp_settings LIMIT 1");
    const smtp = smtpRows[0];
    if (!smtp || !smtp.host || !smtp.username || !smtp.password) return res.status(400).json({ error: "SMTP não configurado" });
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtp.host, port: smtp.port, secure: smtp.port === 465,
      auth: { user: smtp.username, pass: smtp.password },
      tls: smtp.use_tls ? undefined : { rejectUnauthorized: false },
    });
    const from = smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email;
    const htmlBody = buildPropostaHtmlServer(p, itens, comp, baseUrl);
    const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#f8fafc;}@page{margin:15mm;}</style></head><body>${htmlBody}</body></html>`;
    await transporter.sendMail({
      from, to: p.email,
      subject: `${p.titulo || "Proposta Comercial"} - ${p.nome || "Cliente"}`,
      html: fullHtml,
      text: `Segue em anexo a proposta comercial: ${p.titulo || "Proposta Comercial"} no valor de R$ ${Number(p.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
    });
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Send proposal by WhatsApp
app.post("/propostas/:id/enviar-whatsapp", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT p.*, cl.nome, cl.telefone, cl.email, cl.cpf_cnpj
         FROM propostas p
         LEFT JOIN clientes cl ON cl.id = p.cliente_id
        WHERE p.id = $1`, [id]
    );
    const p = rows[0];
    if (!p) return res.status(404).json({ error: "Proposta não encontrada" });
    let whatsapp = (p.telefone || "").replace(/\D/g, "");
    if (!whatsapp) return res.status(400).json({ error: "Cliente sem telefone cadastrado" });
    if (!whatsapp.startsWith("55")) whatsapp = "55" + whatsapp;
    const { rows: evRows } = await db.query("SELECT * FROM evolution_settings LIMIT 1");
    const ev = evRows[0];
    if (!ev || !ev.instance_url || !ev.api_key || !ev.instance_name) return res.status(400).json({ error: "Evolution API não configurada" });
    const fmtMoeda = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const itensCount = (await db.query("SELECT COUNT(*) FROM proposta_itens WHERE proposta_id = $1", [id])).rows[0].count;
    const msg = `Olá ${p.nome || "Cliente"}, segue sua proposta comercial:\n\n*${p.titulo || "PROPOSTA COMERCIAL"}*\n${p.tipo_proposta ? `Tipo: ${p.tipo_proposta}\n` : ""}Itens: ${itensCount}\n*Valor Total: R$ ${fmtMoeda(p.total)}*\n\nPara visualizar a proposta completa, entre em contato conosco.`;
    const instanceUrl = ev.instance_url.replace(/\/$/, "");
    await fetch(`${instanceUrl}/message/sendText/${ev.instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ev.api_key },
      body: JSON.stringify({ number: whatsapp, text: msg }),
    });
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============================================================================
// Servir o frontend compilado (SPA)
// ============================================================================
const PUBLIC_DIR = path.join(__dirname, "public");
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get("*", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
