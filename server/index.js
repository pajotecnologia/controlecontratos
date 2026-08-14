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
const { sendWhatsApp, sendEmail, sendReceiptWhatsApp, sendReceiptEmail, sendCobrancaWhatsApp, sendCobrancaEmail, sendCobrancaSimplesWhatsApp, sendCobrancaSimplesEmail, sendWhatsAppEvento, sendEmailEvento, sendWhatsAppDireto, sendEmailDireto, applyTemplate } = require("./notifications");
const { buildPropostaPdf } = require("./pdf");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

const PUBLIC_UPLOADS_DIR = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
app.use("/uploads", express.static(PUBLIC_UPLOADS_DIR));

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 5 * 1024 * 1024 } });
app.post("/upload", requireAuth, upload.single("file"), (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
    const ext = (req.file.originalname.split(".").pop() || "png").toLowerCase();
    const finalName = `logo-${Date.now()}.${ext}`;
    const destPath = path.join(UPLOAD_DIR, finalName);
    fs.renameSync(req.file.path, destPath);

    try {
      if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
      fs.copyFileSync(destPath, path.join(PUBLIC_UPLOADS_DIR, finalName));
    } catch (e) {
      console.log("[AVISO COPY UPLOADS]", e.message);
    }

    res.json({ url: `/uploads/${finalName}` });
  } catch (err) {
    console.error("[UPLOAD ERRO]", err);
    res.status(500).json({ error: err.message || "Falha ao salvar upload da logomarca" });
  }
});

const TABLES_ADMIN_WRITE = new Set([
  "clientes", "vendedores", "vendas", "venda_vendedores", "parcelas",
  "company_settings", "evolution_settings", "smtp_settings", "user_roles",
  "modelos", "contratos", "propostas", "proposta_itens",
  "fornecedores", "categorias_despesa", "despesas", "parcelas_despesas",
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

app.get("/version", (_req, res) => res.json({ version: "v2.0-reset-link-active", updated_at: "2026-08-03" }));

// Solicitar reset: gera token. Retorna o link (email real depende de SMTP configurado).
app.post("/auth/request-reset", async (req, res) => {
  const { email, redirect_to } = req.body;
  console.log(`[AUTH-RESET] Solicitando reset de senha para: ${email}`);
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
    const assunto = "Redefinição de Senha - PAJO Tecnologia";
    const corpoText = `Olá,\n\nRecebemos uma solicitação para redefinir a senha da sua conta no sistema de Controle de Contratos.\n\nPara cadastrar uma nova senha, acesse o link abaixo:\n${link}\n\nEste link é válido por 1 hora.\n\nSe você não solicitou esta alteração, desconsidere este e-mail.`;
    const corpoHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">Redefinição de Senha</h2>
        <p style="color: #334155; font-size: 15px;">Olá,</p>
        <p style="color: #334155; font-size: 15px;">Recebemos uma solicitação para redefinir a senha da sua conta no sistema de Controle de Contratos.</p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${link}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block;">Redefinir Minha Senha</a>
        </div>
        <p style="color: #64748b; font-size: 13px;">Ou se preferir, copie e cole o link abaixo no seu navegador:<br>
          <a href="${link}" style="color: #2563eb; word-break: break-all;">${link}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Este link é válido por 1 hora. Se você não solicitou esta alteração, pode ignorar este e-mail com segurança.</p>
      </div>
    `;

    try {
      await sendEmailDireto(email, assunto, corpoText, corpoHtml);
    } catch (emailErr) {
      console.error("Erro ao enviar e-mail de redefinição de senha:", emailErr.message);
    }
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
// ASAAS — configurações e cobranças
// ============================================================================
function asaasBaseUrl(ambiente) {
  return ambiente === "production"
    ? "https://www.asaas.com/api/v3"
    : "https://sandbox.asaas.com/api/v3";
}

async function asaasRequest(method, path, apiKey, ambiente, body) {
  const res = await fetch(`${asaasBaseUrl(ambiente)}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "access_token": apiKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.errors?.[0]?.description || json.description || "Erro ASAAS");
  return json;
}

async function getAsaasSettings() {
  const { rows } = await db.query("SELECT * FROM asaas_settings LIMIT 1");
  const s = rows[0];
  if (!s || !s.api_key || !s.ativo) throw new Error("ASAAS não configurado ou inativo");
  return s;
}

// CRUD configurações
app.get("/asaas/settings", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { rows } = await db.query("SELECT * FROM asaas_settings LIMIT 1");
    res.json(rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/asaas/settings", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { api_key, ambiente, ativo, webhook_token } = req.body;
    const { rows: existing } = await db.query("SELECT id FROM asaas_settings LIMIT 1");
    let row;
    if (existing.length) {
      const { rows } = await db.query(
        "UPDATE asaas_settings SET api_key=$1, ambiente=$2, ativo=$3, webhook_token=$4, updated_at=now() WHERE id=$5 RETURNING *",
        [api_key, ambiente || "sandbox", ativo !== false, webhook_token || "", existing[0].id]
      );
      row = rows[0];
    } else {
      const { rows } = await db.query(
        "INSERT INTO asaas_settings (api_key, ambiente, ativo, webhook_token) VALUES ($1,$2,$3,$4) RETURNING *",
        [api_key, ambiente || "sandbox", ativo !== false, webhook_token || ""]
      );
      row = rows[0];
    }
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/asaas/test", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { api_key, ambiente } = req.body;
    if (!api_key) return res.status(400).json({ error: "API Key obrigatória" });
    const data = await asaasRequest("GET", "/myAccount", api_key, ambiente || "sandbox");
    res.json({ success: true, nome: data.name || data.tradingName || "Conta ASAAS" });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
});

// Criar ou recriar cobrança ASAAS para uma parcela
app.post("/asaas/cobranca/:parcelaId", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { parcelaId } = req.params;
    const { billingType } = req.body; // "BOLETO" | "PIX"
    const s = await getAsaasSettings();

    const { rows } = await db.query(
      `SELECT p.*, v.cliente AS venda_cliente, v.valor_servico,
              c.nome AS cliente_nome, c.cpf_cnpj AS cliente_cpf_cnpj,
              c.email AS cliente_email, c.telefone AS cliente_telefone
         FROM parcelas p
         JOIN vendas v ON v.id = p.venda_id
         LEFT JOIN clientes c ON c.id = v.cliente_id
        WHERE p.id = $1`,
      [parcelaId]
    );
    const parcela = rows[0];
    if (!parcela) return res.status(404).json({ error: "Parcela não encontrada" });
    if (parcela.pago) return res.status(400).json({ error: "Parcela já está paga" });
    if (!["BOLETO", "PIX"].includes(billingType)) {
      return res.status(400).json({ error: "Tipo de cobrança inválido" });
    }

    if (parcela.asaas_cobranca_id) {
      try {
        const existingCharge = await asaasRequest("GET", `/payments/${parcela.asaas_cobranca_id}`, s.api_key, s.ambiente);
        if (["PENDING", "OVERDUE", "AUTHORIZED"].includes(existingCharge.status)) {
          await db.query("UPDATE parcelas SET asaas_status=$1 WHERE id=$2", [existingCharge.status, parcelaId]);
          return res.json({
            success: true,
            reused: true,
            cobranca_id: existingCharge.id,
            status: existingCharge.status,
            boleto_url: parcela.asaas_boleto_url || existingCharge.bankSlipUrl || null,
            invoice_url: parcela.asaas_invoice_url || existingCharge.invoiceUrl || null,
            pix_qr_code: parcela.asaas_pix_qr_code || null,
            pix_copy_paste: parcela.asaas_pix_copy_paste || null,
          });
        }
      } catch {
        // Cobrança ausente ou inválida no ASAAS; uma nova será criada abaixo.
      }
    }

    const clienteNome = parcela.cliente_nome || parcela.venda_cliente || "Cliente";
    const cpfCnpj = (parcela.cliente_cpf_cnpj || "").replace(/\D/g, "");

    // Upsert cliente no ASAAS
    let asaasCustomerId;
    if (cpfCnpj) {
      const search = await asaasRequest("GET", `/customers?cpfCnpj=${cpfCnpj}`, s.api_key, s.ambiente);
      if (search.data?.length) {
        asaasCustomerId = search.data[0].id;
      }
    }
    if (!asaasCustomerId) {
      const customer = await asaasRequest("POST", "/customers", s.api_key, s.ambiente, {
        name: clienteNome,
        cpfCnpj: cpfCnpj || undefined,
        email: parcela.cliente_email || undefined,
        phone: parcela.cliente_telefone || undefined,
      });
      asaasCustomerId = customer.id;
    }

    // Criar cobrança
    const charge = await asaasRequest("POST", "/payments", s.api_key, s.ambiente, {
      customer: asaasCustomerId,
      billingType: billingType || "PIX",
      value: Number(parcela.valor),
      dueDate: parcela.data_vencimento,
      description: `Parcela ${parcela.numero_parcela}${parcela.mes_referencia ? " — " + parcela.mes_referencia : ""}`,
    });

    // Buscar QR Code PIX se for PIX
    let pixQrCode = null, pixCopyPaste = null;
    if (billingType === "PIX") {
      try {
        const qr = await asaasRequest("GET", `/payments/${charge.id}/pixQrCode`, s.api_key, s.ambiente);
        pixQrCode = qr.encodedImage || null;
        pixCopyPaste = qr.payload || null;
      } catch { /* QR pode demorar a ficar disponível */ }
    }

    // Salvar no banco
    await db.query(
      `UPDATE parcelas SET
         asaas_cobranca_id=$1, asaas_status=$2, asaas_boleto_url=$3,
         asaas_pix_qr_code=$4, asaas_pix_copy_paste=$5, asaas_invoice_url=$6
       WHERE id=$7`,
      [
        charge.id, charge.status,
        charge.bankSlipUrl || null,
        pixQrCode, pixCopyPaste,
        charge.invoiceUrl || null,
        parcelaId,
      ]
    );

    res.json({
      success: true,
      cobranca_id: charge.id,
      status: charge.status,
      boleto_url: charge.bankSlipUrl || null,
      invoice_url: charge.invoiceUrl || null,
      pix_qr_code: pixQrCode,
      pix_copy_paste: pixCopyPaste,
    });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
});

// Consultar status de cobrança e atualizar parcela
app.get("/asaas/cobranca/:parcelaId", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { parcelaId } = req.params;
    const { rows } = await db.query("SELECT asaas_cobranca_id FROM parcelas WHERE id=$1", [parcelaId]);
    const parcela = rows[0];
    if (!parcela?.asaas_cobranca_id) return res.status(404).json({ error: "Cobrança ASAAS não encontrada" });

    const s = await getAsaasSettings();
    const charge = await asaasRequest("GET", `/payments/${parcela.asaas_cobranca_id}`, s.api_key, s.ambiente);

    // Se RECEIVED ou CONFIRMED, marcar parcela como paga
    if (["RECEIVED", "CONFIRMED"].includes(charge.status)) {
      await db.query(
        "UPDATE parcelas SET pago=true, data_pagamento=now(), asaas_status=$1 WHERE id=$2 AND pago=false",
        [charge.status, parcelaId]
      );
    } else {
      await db.query("UPDATE parcelas SET asaas_status=$1 WHERE id=$2", [charge.status, parcelaId]);
    }

    res.json({ success: true, status: charge.status, pago: ["RECEIVED", "CONFIRMED"].includes(charge.status) });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
});

// Enviar cobrança (boleto/PIX) ao cliente por WhatsApp ou E-mail
app.post("/asaas/cobranca/:parcelaId/enviar", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { parcelaId } = req.params;
    const { channel, mensagem } = req.body || {};
    if (!["whatsapp", "email"].includes(channel)) {
      return res.status(400).json({ error: "Canal inválido. Use whatsapp ou email" });
    }
    if (channel === "whatsapp") {
      res.json(await sendCobrancaWhatsApp(parcelaId, mensagem));
    } else {
      res.json(await sendCobrancaEmail(parcelaId, mensagem));
    }
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Webhook ASAAS (valida pelo webhook_token configurado, quando houver)
app.post("/asaas/webhook", async (req, res) => {
  try {
    const { rows: cfgRows } = await db.query("SELECT webhook_token FROM asaas_settings LIMIT 1");
    const configuredToken = cfgRows[0]?.webhook_token || "";
    if (configuredToken && req.headers["asaas-access-token"] !== configuredToken) {
      return res.status(401).json({ error: "Token de webhook inválido" });
    }

    const { event, payment } = req.body || {};
    if (!payment?.id) return res.json({ received: true });

    if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event)) {
      await db.query(
        "UPDATE parcelas SET pago=true, data_pagamento=now(), asaas_status=$1 WHERE asaas_cobranca_id=$2 AND pago=false",
        [payment.status, payment.id]
      );
    } else if (event === "PAYMENT_UPDATED") {
      await db.query(
        "UPDATE parcelas SET asaas_status=$1 WHERE asaas_cobranca_id=$2",
        [payment.status, payment.id]
      );
    }
    res.json({ received: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    const { parcela_id, channel, mensagem } = req.body;
    if (!parcela_id) return res.status(400).json({ error: "parcela_id obrigatório" });
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    if (channel === "whatsapp") res.json(await sendReceiptWhatsApp(parcela_id, baseUrl, mensagem));
    else if (channel === "email") res.json(await sendReceiptEmail(parcela_id, baseUrl, mensagem));
    else res.status(400).json({ error: "Canal inválido" });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post("/notify/cobranca", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { parcela_id, channel, mensagem } = req.body;
    if (!parcela_id) return res.status(400).json({ error: "parcela_id obrigatório" });
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    if (channel === "whatsapp") res.json(await sendCobrancaSimplesWhatsApp(parcela_id, mensagem));
    else if (channel === "email") res.json(await sendCobrancaSimplesEmail(parcela_id, baseUrl, mensagem));
    else res.status(400).json({ error: "Canal inválido" });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Notificar vendedor vinculado a contrato ou proposta
app.post("/notify/vendedor", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { tipo, id, evento, canal } = req.body;
    if (!tipo || !id || !evento) return res.status(400).json({ error: "tipo, id e evento são obrigatórios" });
    const tabela = tipo === "contrato" ? "contratos" : "propostas";
    const { rows } = await db.query(
      `SELECT t.*, cl.nome AS cliente_nome,
              ve.nome AS vendedor_nome, ve.whatsapp AS vendedor_whatsapp, ve.email AS vendedor_email,
              cs.name AS empresa_nome
         FROM ${tabela} t
         LEFT JOIN clientes cl ON cl.id = t.cliente_id
         LEFT JOIN vendedores ve ON ve.id = t.vendedor_id
         LEFT JOIN company_settings cs ON true
        WHERE t.id = $1`, [id]
    );
    const reg = rows[0];
    if (!reg) return res.status(404).json({ error: `${tipo} não encontrado` });
    if (!reg.vendedor_id) return res.status(400).json({ error: "Nenhum vendedor vinculado a este registro" });

    const fmtMoeda = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const ctx = {
      vendedor: reg.vendedor_nome || "",
      vendedor_nome: reg.vendedor_nome || "",
      cliente: reg.cliente_nome || "",
      cliente_nome: reg.cliente_nome || "",
      empresa: reg.empresa_nome || "",
      empresa_nome: reg.empresa_nome || "",
      titulo: reg.titulo || "",
      tipo_proposta: reg.tipo_proposta || "",
      total: fmtMoeda(reg.total),
      valor: fmtMoeda(reg.valor || reg.total),
      link_assinatura: reg.assinatura_link || "",
    };

    const results = [];
    const canais = canal === "both" ? ["whatsapp", "email"] : [canal || "whatsapp"];
    for (const c of canais) {
      try {
        if (c === "whatsapp") {
          if (!reg.vendedor_whatsapp) { results.push({ canal: "whatsapp", error: "Vendedor sem WhatsApp" }); continue; }
          const fallback = `Olá ${ctx.vendedor_nome}, você tem um novo ${tipo}: cliente ${ctx.cliente}.${ctx.link_assinatura ? "\n\nLink: " + ctx.link_assinatura : ""}`;
          results.push({ canal: "whatsapp", ...(await sendWhatsAppEvento(reg.vendedor_whatsapp, evento, ctx, fallback)) });
        } else {
          if (!reg.vendedor_email) { results.push({ canal: "email", error: "Vendedor sem email" }); continue; }
          const subject = `${tipo === "contrato" ? "Contrato" : "Proposta"} - ${ctx.cliente}`;
          const fallback = `Olá ${ctx.vendedor_nome}, você tem um novo ${tipo}: cliente ${ctx.cliente}.${ctx.link_assinatura ? "\n\nLink: " + ctx.link_assinatura : ""}`;
          results.push({ canal: "email", ...(await sendEmailEvento(reg.vendedor_email, evento, ctx, subject, fallback)) });
        }
      } catch (err) {
        results.push({ canal: c, error: err.message });
      }
    }
    res.json({ success: true, results });
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
    const { rows } = await db.query("SELECT name, logo_url FROM company_settings ORDER BY is_default DESC, created_at ASC LIMIT 1");
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

    let comp = {};
    if (c.company_id) {
      const compRes = await db.query("SELECT * FROM company_settings WHERE id = $1", [c.company_id]);
      comp = compRes.rows[0] || {};
    }
    if (!comp.name) {
      comp = (await db.query("SELECT * FROM company_settings ORDER BY is_default DESC, created_at ASC LIMIT 1")).rows[0] || {};
    }
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
    let comp = {};
    if (p.company_id) {
      const compRes = await db.query("SELECT * FROM company_settings WHERE id = $1", [p.company_id]);
      comp = compRes.rows[0] || {};
    }
    if (!comp.name) {
      const defRes = await db.query("SELECT * FROM company_settings WHERE is_default = true LIMIT 1");
      comp = defRes.rows[0] || (await db.query("SELECT * FROM company_settings ORDER BY created_at ASC LIMIT 1")).rows[0] || {};
    }

    let logoUrl = comp.logo_url || "";
    if (logoUrl && logoUrl.startsWith("/")) logoUrl = `${req.protocol}://${req.get("host")}${logoUrl}`;
    const fmtMoeda = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtData = (d) => { if (!d) return "-"; const raw = String(d); const norm = raw.includes("T") ? raw : `${raw}T12:00:00`; const dt = new Date(norm); return isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString("pt-BR"); };
    const dataEmissaoFormatada = fmtData(p.data_proposta);
    const dataHojeFormatada = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const empresaLogo = logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:80px;max-width:220px;object-fit:contain;" />` : "";
    const compEndereco = [comp.endereco, comp.bairro, comp.cidade, comp.cep ? `CEP: ${comp.cep}` : ""].filter(Boolean).join(" - ");
    const compContato = [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""].filter(Boolean).join(" | ");
    const totalItens = itens.reduce((s, i) => s + Number(i.total || 0), 0);
    const modelo = p.modelo_proposta || "classico";
    let html = "";

    // MODELO 2: MINIMALISTA SEM MOLDURA (Logo/Tipo no topo, Dados da empresa no Rodapé, Sem bordas)
    if (modelo === "moderno") {
      const rowsHtmlModerno = itens.map((item, idx) => {
        let imgHtml = "";
        if (item.imagem_url) {
          let imgSrc = item.imagem_url;
          if (imgSrc.startsWith("/")) imgSrc = `${req.protocol}://${req.get("host")}${imgSrc}`;
          imgHtml = `<br/><img src="${imgSrc}" alt="Item" style="max-height:80px;max-width:130px;object-fit:contain;margin-top:6px;" />`;
        }
        return `<tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:12px 4px;text-align:left;">
            <span style="color:#64748b;margin-right:6px;">${idx + 1}.</span>
            <strong style="color:#0f172a;">${item.descricao}</strong>${imgHtml}
          </td>
          <td style="padding:12px 4px;text-align:center;color:#475569;">${item.quantidade}</td>
          <td style="padding:12px 4px;text-align:right;color:#475569;">R$ ${fmtMoeda(item.valor_unitario)}</td>
          <td style="padding:12px 4px;text-align:right;font-weight:700;color:#0f172a;">R$ ${fmtMoeda(item.total)}</td>
        </tr>`;
      }).join("");

      html = `<div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#1e293b;max-width:800px;margin:0 auto;background:#fff;padding:30px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:35px;">
          <div>
            ${empresaLogo || `<div style="font-size:22px;font-weight:800;color:#0f172a;">${comp.name || "LOGOMARCA"}</div>`}
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#2563eb;font-weight:800;">${p.tipo_proposta || "PROPOSTA COMERCIAL"}</div>
            <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin:4px 0 0 0;">${p.titulo || "PROPOSTA COMERCIAL"}</h1>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">Data: ${dataEmissaoFormatada}</div>
          </div>
        </div>
        <div style="margin-bottom:35px;font-size:13px;">
          <div style="font-weight:800;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Informações do Cliente</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><span style="color:#64748b;">Cliente:</span> <strong>${p.nome || "-"}</strong></div>
            <div><span style="color:#64748b;">CPF/CNPJ:</span> <strong>${p.cpf_cnpj || "-"}</strong></div>
            <div><span style="color:#64748b;">Telefone:</span> <strong>${p.telefone || "-"}</strong></div>
            <div><span style="color:#64748b;">E-mail:</span> <strong>${p.email || "-"}</strong></div>
            <div style="grid-column:span 2;"><span style="color:#64748b;">Endereço:</span> <strong>${p.endereco || "-"}</strong></div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;font-size:13px;">
          <thead><tr style="border-bottom:2px solid #0f172a;color:#0f172a;">
            <th style="padding:10px 4px;text-align:left;font-weight:800;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;">Descrição</th>
            <th style="padding:10px 4px;text-align:center;font-weight:800;text-transform:uppercase;font-size:11px;width:60px;">Qtd</th>
            <th style="padding:10px 4px;text-align:right;font-weight:800;text-transform:uppercase;font-size:11px;width:120px;">Unitário</th>
            <th style="padding:10px 4px;text-align:right;font-weight:800;text-transform:uppercase;font-size:11px;width:120px;">Total</th>
          </tr></thead>
          <tbody>${rowsHtmlModerno}</tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;margin-bottom:35px;text-align:right;">
          <div>
            ${desc > 0 ? `<div style="font-size:12px;color:#dc2626;margin-bottom:4px;">Desconto: - R$ ${fmtMoeda(desc)}</div>` : ""}
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Valor Total</div>
            <div style="font-size:24px;font-weight:900;color:#0f172a;">R$ ${fmtMoeda(total)}</div>
          </div>
        </div>
        ${p.observacoes ? `<div style="margin-bottom:40px;font-size:13px;">
          <div style="font-weight:800;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Observações</div>
          <div style="white-space:pre-wrap;color:#475569;line-height:1.5;">${String(p.observacoes).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>` : ""}
        <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#64748b;line-height:1.6;">
          <div style="font-weight:700;color:#0f172a;font-size:12px;margin-bottom:2px;">${comp.name || "Sua Empresa"}</div>
          <div>${comp.cnpj ? `CNPJ: ${comp.cnpj}` : ""} ${compEndereco ? ` • ${compEndereco}` : ""}</div>
          <div>${compContato}</div>
          <div style="font-style:italic;margin-top:4px;font-size:10px;">Emitido em ${dataEmissaoFormatada}.</div>
        </div>
      </div>`;
    } else if (modelo === "elegante") {
      // MODELO 3: ELEGANTE / EXECUTIVO (Georgia Serif, Linha Fina Ouro)
      const rowsHtmlElegante = itens.map((item, idx) => {
        let imgHtml = "";
        if (item.imagem_url) {
          let imgSrc = item.imagem_url;
          if (imgSrc.startsWith("/")) imgSrc = `${req.protocol}://${req.get("host")}${imgSrc}`;
          imgHtml = `<br/><img src="${imgSrc}" alt="Item" style="max-height:80px;max-width:130px;object-fit:contain;margin-top:6px;border:1px solid #d97706;" />`;
        }
        return `<tr style="border-bottom:1px solid #f3ebd8;">
          <td style="padding:10px 10px;text-align:left;font-family:Georgia,serif;">
            <span style="color:#d97706;font-weight:bold;margin-right:6px;">${idx + 1}.</span>
            <span style="color:#0f172a;font-weight:600;">${item.descricao}</span>${imgHtml}
          </td>
          <td style="padding:10px 10px;text-align:center;color:#374151;font-family:Arial,sans-serif;">${item.quantidade}</td>
          <td style="padding:10px 10px;text-align:right;color:#4b5563;font-family:Arial,sans-serif;">R$ ${fmtMoeda(item.valor_unitario)}</td>
          <td style="padding:10px 10px;text-align:right;font-weight:bold;color:#92400e;font-family:Georgia,serif;">R$ ${fmtMoeda(item.total)}</td>
        </tr>`;
      }).join("");

      html = `<div style="font-family:Georgia,serif;color:#1f2937;max-width:800px;margin:0 auto;background:#fff;padding:40px;border:1px solid #e5e7eb;box-shadow:0 4px 15px rgba(0,0,0,0.03);">
        <div style="height:3px;background:#d97706;margin-bottom:28px;"></div>
        <div style="text-align:center;border-bottom:1px solid #f3ebd8;padding-bottom:20px;margin-bottom:28px;">
          ${empresaLogo ? `<div style="margin-bottom:12px;">${empresaLogo}</div>` : ""}
          <div style="font-size:22px;font-weight:bold;color:#0f172a;letter-spacing:1px;text-transform:uppercase;">${comp.name || "Sua Empresa"}</div>
          <div style="font-size:12px;color:#6b7280;font-family:Arial,sans-serif;margin-top:4px;">${comp.cnpj ? `CNPJ: ${comp.cnpj}` : ""} ${compEndereco ? ` • ${compEndereco}` : ""}</div>
          ${compContato ? `<div style="font-size:12px;color:#6b7280;font-family:Arial,sans-serif;margin-top:2px;">${compContato}</div>` : ""}
        </div>
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#d97706;font-weight:bold;font-family:Arial,sans-serif;">PROPOSTA COMERCIAL</div>
          <h1 style="font-size:22px;font-weight:normal;color:#0f172a;margin:4px 0;font-style:italic;">${p.titulo || "PROPOSTA COMERCIAL"}</h1>
          <div style="font-size:12px;color:#6b7280;font-family:Arial,sans-serif;margin-top:2px;">Emissão: ${dataEmissaoFormatada}</div>
        </div>
        <div style="background-color:#fdfbf7;border:1px solid #f3ebd8;padding:18px;margin-bottom:28px;border-radius:4px;">
          <div style="font-size:11px;font-weight:bold;color:#92400e;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #f3ebd8;padding-bottom:6px;margin-bottom:10px;font-family:Arial,sans-serif;">DADOS DO CLIENTE</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;font-family:Arial,sans-serif;">
            <div><strong style="color:#1e293b;">Cliente:</strong> ${p.nome || "-"}</div>
            <div><strong style="color:#1e293b;">CPF/CNPJ:</strong> ${p.cpf_cnpj || "-"}</div>
            <div><strong style="color:#1e293b;">Telefone:</strong> ${p.telefone || "-"}</div>
            <div><strong style="color:#1e293b;">E-mail:</strong> ${p.email || "-"}</div>
            <div style="grid-column:span 2;"><strong style="color:#1e293b;">Endereço:</strong> ${p.endereco || "-"}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px;">
          <thead><tr style="background-color:#0f172a;color:#fff;font-family:Arial,sans-serif;">
            <th style="padding:10px 12px;text-align:left;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Descrição do Serviço / Produto</th>
            <th style="padding:10px 12px;text-align:center;font-weight:600;font-size:11px;text-transform:uppercase;width:60px;">Qtd</th>
            <th style="padding:10px 12px;text-align:right;font-weight:600;font-size:11px;text-transform:uppercase;width:120px;">Unitário</th>
            <th style="padding:10px 12px;text-align:right;font-weight:600;font-size:11px;text-transform:uppercase;width:120px;">Total</th>
          </tr></thead>
          <tbody>${rowsHtmlElegante}</tbody>
        </table>
        <div style="background:#0f172a;color:#fff;padding:14px 20px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;font-family:Arial,sans-serif;">
          <div>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Valor Total da Proposta</div>
            ${desc > 0 ? `<div style="font-size:12px;color:#f87171;margin-top:2px;">Desconto: - R$ ${fmtMoeda(desc)}</div>` : ""}
          </div>
          <div style="font-size:22px;font-weight:bold;color:#f59e0b;font-family:Georgia,serif;">R$ ${fmtMoeda(total)}</div>
        </div>
        ${p.observacoes ? `<div style="border-left:3px solid #d97706;padding:14px 18px;background:#fdfbf7;margin-bottom:32px;font-size:13px;font-family:Georgia,serif;">
          <div style="font-weight:bold;color:#92400e;margin-bottom:4px;font-size:12px;text-transform:uppercase;">Observações</div>
          <div style="white-space:pre-wrap;color:#4b5563;line-height:1.5;">${String(p.observacoes).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>` : ""}
      </div>`;
    } else {
      // MODELO 1: CLÁSSICO / CORPORATIVO (Default)
      const rowsHtml = itens.map((item, idx) => {
        let imgHtml = "";
        if (item.imagem_url) {
          let imgSrc = item.imagem_url;
          if (imgSrc.startsWith("/")) imgSrc = `${req.protocol}://${req.get("host")}${imgSrc}`;
          imgHtml = `<br/><img src="${imgSrc}" alt="Item" style="max-height:100px;max-width:150px;object-fit:contain;margin-top:5px;border-radius:4px;border:1px solid #e2e8f0;" />`;
        }
        return `<tr>
          <td style="border:1px solid #cbd5e1;padding:10px;text-align:left;"><strong>${idx + 1}.</strong> ${item.descricao}${imgHtml}</td>
          <td style="border:1px solid #cbd5e1;padding:10px;text-align:center;">${item.quantidade}</td>
          <td style="border:1px solid #cbd5e1;padding:10px;text-align:right;">R$ ${fmtMoeda(item.valor_unitario)}</td>
          <td style="border:1px solid #cbd5e1;padding:10px;text-align:right;">R$ ${fmtMoeda(item.total)}</td>
        </tr>`;
      }).join("");

      const descRow = desc > 0 ? `
        <tr style="font-weight:bold;"><td colspan="3" style="border:1px solid #cbd5e1;padding:10px;text-align:right;font-size:13px;">Valor dos Itens:</td><td style="border:1px solid #cbd5e1;padding:10px;text-align:right;font-size:13px;">R$ ${fmtMoeda(totalItens)}</td></tr>
        <tr style="font-weight:bold;color:#dc2626;"><td colspan="3" style="border:1px solid #cbd5e1;padding:10px;text-align:right;font-size:13px;">Desconto:</td><td style="border:1px solid #cbd5e1;padding:10px;text-align:right;font-size:13px;">- R$ ${fmtMoeda(desc)}</td></tr>` : "";

      html = `<div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5;max-width:800px;margin:0 auto;background:#ffffff;border-top:6px solid #0f172a;border-bottom:2px solid #cbd5e1;padding:20px;">
        <div style="text-align:center;border-bottom:2px solid #334155;padding-bottom:16px;margin-bottom:24px;">
          ${empresaLogo}
          <div style="font-size:20px;font-weight:bold;color:#0f172a;margin-top:6px;">${comp.name || "Sua Empresa"}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">
            ${comp.cnpj ? `CNPJ: ${comp.cnpj}` : ""} ${compEndereco ? ` | ${compEndereco}` : ""}
          </div>
          ${compContato ? `<div style="font-size:12px;color:#64748b;">${compContato}</div>` : ""}
        </div>
        <div style="text-align:center;margin-bottom:25px;">
          <h1 style="font-size:22px;margin:0 0 5px 0;font-weight:bold;color:#0f172a;">${p.titulo || "PROPOSTA COMERCIAL"}</h1>
          <div style="font-size:13px;color:#64748b;">Data de Emissão: ${dataEmissaoFormatada}</div>
        </div>
        <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin-bottom:25px;font-size:13px;">
          <div style="font-weight:bold;font-size:13px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px;color:#0f172a;">DADOS DO CLIENTE</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div><strong>Cliente:</strong> ${p.nome || "-"}</div>
            <div><strong>CPF/CNPJ:</strong> ${p.cpf_cnpj || "-"}</div>
            <div><strong>Endereço:</strong> ${p.endereco || "-"}</div>
            <div><strong>Telefone:</strong> ${p.telefone || "-"}</div>
            <div><strong>E-mail:</strong> ${p.email || "-"}</div>
            <div><strong>Tipo de Proposta:</strong> ${p.tipo_proposta || "-"}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;font-size:13px;">
          <thead>
            <tr style="background-color:#334155;color:#ffffff;">
              <th style="border:1px solid #334155;padding:10px;text-align:left;font-weight:bold;">Descrição do Produto / Serviço</th>
              <th style="border:1px solid #334155;padding:10px;text-align:center;font-weight:bold;width:80px;">Qtd</th>
              <th style="border:1px solid #334155;padding:10px;text-align:right;font-weight:bold;width:120px;">Val. Unitário</th>
              <th style="border:1px solid #334155;padding:10px;text-align:right;font-weight:bold;width:120px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${descRow}
            <tr style="font-weight:bold;background-color:#f8fafc;">
              <td colspan="3" style="border:1px solid #cbd5e1;padding:12px;text-align:right;font-size:14px;">VALOR TOTAL DA PROPOSTA:</td>
              <td style="border:1px solid #cbd5e1;padding:12px;text-align:right;font-size:14px;color:#0f172a;">R$ ${fmtMoeda(total)}</td>
            </tr>
          </tbody>
        </table>
        ${p.observacoes ? `<div style="margin-bottom:30px;font-size:13px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;">
          <div style="font-weight:bold;font-size:13px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px;color:#0f172a;">OBSERVAÇÕES</div>
          <div style="white-space:pre-wrap;color:#334155;line-height:1.5;">${String(p.observacoes).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>` : ""}
      </div>`;
    }

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
    <div style="margin-top:40px;display:flex;justify-content:space-around;text-align:center;font-size:13px;">
      <div style="width:250px;">
        ${comp.assinatura_imagem
          ? `<img src="${comp.assinatura_imagem}" style="max-height:60px;display:block;margin:0 auto 5px;" />`
          : `<div style="border-top:1px solid #94a3b8;margin-bottom:5px;"></div>`}
        <strong>${comp.name || "Assinatura da Empresa"}</strong>
        <div style="font-size:11px;color:#64748b;">${comp.nome_responsavel || ""}</div>
      </div>
      <div style="width:250px;">
        <div style="border-top:1px solid #94a3b8;margin-bottom:5px;"></div>
        <strong>${p.nome || "Assinatura do Cliente"}</strong>
      </div>
    </div>
  </div>`;
}

// Send proposal by email
app.post("/propostas/:id/enviar-email", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { id } = req.params;
    const { mensagem } = req.body || {};
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
    const comp = (await db.query("SELECT name, cnpj, cep, endereco, bairro, cidade, email, telefone, nome_responsavel, cargo_responsavel, logo_url, assinatura_imagem FROM company_settings LIMIT 1")).rows[0] || {};
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
    const textMessage = (mensagem && mensagem.trim())
      ? mensagem.trim()
      : `Segue em anexo a proposta comercial: ${p.titulo || "Proposta Comercial"} no valor de R$ ${Number(p.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`;
    const htmlBody = buildPropostaHtmlServer(p, itens, comp, baseUrl);
    const introHtml = `<p style="font-family:Arial,sans-serif;color:#1e293b;white-space:pre-wrap;">${textMessage.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
    const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#f8fafc;}@page{margin:15mm;}</style></head><body>${introHtml}${htmlBody}</body></html>`;
    const pdfBuffer = await buildPropostaPdf(p, itens, comp, baseUrl);
    await transporter.sendMail({
      from, to: p.email,
      subject: `${p.titulo || "Proposta Comercial"} - ${p.nome || "Cliente"}`,
      html: fullHtml,
      text: textMessage,
      attachments: [{
        filename: `proposta-${(p.nome || "cliente").replace(/[^\w-]+/g, "_")}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      }],
    });
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Send proposal by WhatsApp
app.post("/propostas/:id/enviar-whatsapp", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { id } = req.params;
    const { mensagem } = req.body || {};
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
    const { rows: itens } = await db.query("SELECT * FROM proposta_itens WHERE proposta_id = $1 ORDER BY ordem ASC", [id]);
    const comp = (await db.query("SELECT name, cnpj, cep, endereco, bairro, cidade, email, telefone, nome_responsavel, cargo_responsavel, logo_url, assinatura_imagem FROM company_settings LIMIT 1")).rows[0] || {};
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    const msg = (mensagem && mensagem.trim())
      ? mensagem.trim()
      : `Olá ${p.nome || "Cliente"}, segue sua proposta comercial:\n\n*${p.titulo || "PROPOSTA COMERCIAL"}*\n${p.tipo_proposta ? `Tipo: ${p.tipo_proposta}\n` : ""}Itens: ${itens.length}\n*Valor Total: R$ ${fmtMoeda(p.total)}*`;
    const pdfBuffer = await buildPropostaPdf(p, itens, comp, baseUrl);
    const instanceUrl = ev.instance_url.replace(/\/$/, "");
    await fetch(`${instanceUrl}/message/sendMedia/${ev.instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ev.api_key },
      body: JSON.stringify({
        number: whatsapp,
        mediatype: "document",
        mimetype: "application/pdf",
        fileName: `proposta-${(p.nome || "cliente").replace(/[^\w-]+/g, "_")}.pdf`,
        caption: msg,
        media: pdfBuffer.toString("base64"),
      }),
      signal: AbortSignal.timeout(15000)
    });
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============================================================================
// ENVIO DE MENSAGEM AVULSA (template → clientes/vendedores selecionados)
// ============================================================================
app.post("/notify/enviar-mensagem", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { template_id, destinatarios, canal } = req.body;
    if (!template_id || !destinatarios?.length || !canal) {
      return res.status(400).json({ error: "template_id, destinatarios e canal são obrigatórios" });
    }
    const { rows: tmpl } = await db.query("SELECT * FROM message_templates WHERE id=$1", [template_id]);
    if (!tmpl.length) return res.status(404).json({ error: "Template não encontrado" });
    const template = tmpl[0];

    // Busca dados da empresa uma vez
    const { rows: compRows } = await db.query(
      "SELECT name, cnpj, telefone, email, endereco, bairro, cidade, cep, nome_responsavel, cargo_responsavel FROM company_settings LIMIT 1"
    );
    const comp = compRows[0] || {};
    const fmtData = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "";

    const resultados = [];
    for (const dest of destinatarios) {
      let ctx = {
        empresa_nome: comp.name || "",
        empresa_cnpj: comp.cnpj || "",
        empresa_telefone: comp.telefone || "",
        empresa_email: comp.email || "",
        empresa_endereco: comp.endereco || "",
        empresa_cidade: comp.cidade || "",
        empresa_responsavel: comp.nome_responsavel || "",
      };

      // Busca dados completos do destinatário no banco
      if (dest.tipo === "cliente" && dest.id) {
        const { rows } = await db.query(
          "SELECT nome, telefone, email, cpf_cnpj, endereco, bairro, cidade, estado, cep, nome_responsavel, cargo_responsavel FROM clientes WHERE id=$1",
          [dest.id]
        );
        const c = rows[0] || {};
        ctx = {
          ...ctx,
          nome: c.nome || dest.nome || "",
          cliente_nome: c.nome || dest.nome || "",
          cliente: c.nome || dest.nome || "",
          telefone: c.telefone || dest.telefone || "",
          email: c.email || dest.email || "",
          cpf_cnpj: c.cpf_cnpj || "",
          endereco: c.endereco || "",
          cidade: c.cidade || "",
          estado: c.estado || "",
          cep: c.cep || "",
          nome_responsavel: c.nome_responsavel || "",
          cargo_responsavel: c.cargo_responsavel || "",
        };
      } else if (dest.tipo === "vendedor" && dest.id) {
        const { rows } = await db.query(
          "SELECT nome, whatsapp, email, cpf, comissao_padrao FROM vendedores WHERE id=$1",
          [dest.id]
        );
        const v = rows[0] || {};
        ctx = {
          ...ctx,
          nome: v.nome || dest.nome || "",
          vendedor_nome: v.nome || dest.nome || "",
          vendedor: v.nome || dest.nome || "",
          telefone: v.whatsapp || dest.telefone || "",
          email: v.email || dest.email || "",
          cpf: v.cpf || "",
          comissao: v.comissao_padrao ? String(v.comissao_padrao) : "",
        };
      } else {
        ctx = {
          ...ctx,
          nome: dest.nome || "",
          cliente_nome: dest.nome || "",
          vendedor_nome: dest.nome || "",
          telefone: dest.telefone || "",
          email: dest.email || "",
        };
      }

      const mensagem = (template.corpo || "").replace(/\{\{(\w+)\}\}/g, (_, k) => ctx[k] ?? "");

      try {
        if (canal === "whatsapp") {
          if (!ctx.telefone) throw new Error("Sem telefone");
          await sendWhatsAppDireto(ctx.telefone, mensagem);
          resultados.push({ id: dest.id, nome: ctx.nome, ok: true });
        } else if (canal === "email") {
          if (!ctx.email) throw new Error("Sem e-mail");
          await sendEmailDireto(ctx.email, template.nome, mensagem);
          resultados.push({ id: dest.id, nome: ctx.nome, ok: true });
        }
      } catch (e) {
        resultados.push({ id: dest.id, nome: ctx.nome, ok: false, erro: e.message });
      }
    }
    res.json({ resultados });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});



const PORT = process.env.PORT || 3001;

app.post("/notify/agendar", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { data_agendamento, canal, referencia_tipo, payload } = req.body;
    const { rows } = await db.query(
      "INSERT INTO agendamento_mensagens (data_agendamento, canal, referencia_tipo, payload) VALUES ($1, $2, $3, $4) RETURNING *",
      [data_agendamento, canal, referencia_tipo, payload]
    );
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/notify/agendamentos", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    const { rows } = await db.query("SELECT * FROM agendamento_mensagens WHERE status = 'pendente' ORDER BY data_agendamento ASC");
    res.json(rows);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete("/notify/agendamentos/:id", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Apenas administradores" });
  try {
    await db.query("UPDATE agendamento_mensagens SET status = 'cancelado' WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// CRON JOB para processar envios agendados
setInterval(async () => {
  try {
    const { rows } = await db.query("SELECT * FROM agendamento_mensagens WHERE status = 'pendente' AND data_agendamento <= NOW()");
    if (!rows.length) return;
    const adminQuery = await db.query("SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1");
    if (!adminQuery.rows.length) return;
    const token = signToken({ id: adminQuery.rows[0].user_id, email: "cron" });
    
    for (const job of rows) {
      try {
        const url = `http://127.0.0.1:${PORT}${job.payload.path}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(job.payload.body || {}),
          signal: AbortSignal.timeout(30000)
        });
        const json = await res.json().catch(()=>({}));
        if (res.ok) {
          await db.query("UPDATE agendamento_mensagens SET status = 'enviado' WHERE id = $1", [job.id]);
        } else {
          const err = json.error || "Erro desconhecido HTTP " + res.status;
          await db.query("UPDATE agendamento_mensagens SET status = 'erro', log_erro = $1, tentativas = tentativas + 1 WHERE id = $2", [err, job.id]);
        }
      } catch(e) {
        await db.query("UPDATE agendamento_mensagens SET status = 'erro', log_erro = $1, tentativas = tentativas + 1 WHERE id = $2", [e.message, job.id]);
      }
    }
  } catch(e) { console.error("Erro no cron de agendamentos:", e); }
}, 60000);
// ============================================================================
// Servir o frontend compilado (SPA)
// ============================================================================
const PUBLIC_DIR = path.join(__dirname, "public");
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get("*", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
}

// Auto-criar tabelas agendamento_mensagens e password_reset_tokens se nao existirem
async function initTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS agendamento_mensagens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data_agendamento TIMESTAMP WITH TIME ZONE NOT NULL,
        canal VARCHAR(50) NOT NULL,
        referencia_tipo VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'pendente',
        tentativas INT DEFAULT 0,
        log_erro TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.log("[AVISO BD] agendamento_mensagens:", err.message);
  }

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  } catch (err) {
    console.log("[AVISO BD] password_reset_tokens:", err.message);
  }

  try {
    await db.query(`
      ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
      ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS assinatura_imagem TEXT DEFAULT NULL;
      ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS public_url TEXT DEFAULT NULL;
      ALTER TABLE propostas ADD COLUMN IF NOT EXISTS modelo_proposta TEXT DEFAULT 'classico';
    `);
  } catch (err) {
    console.log("[AVISO BD] migrations empresas/propostas:", err.message);
  }
}
initTables();

const server = app.listen(PORT, "0.0.0.0", () => console.log(`API rodando na porta ${PORT}`));

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[ERRO] A porta ${PORT} está ocupada. Exitando para liberação do PM2...`);
    process.exit(1);
  } else {
    console.error("[ERRO SERVER]", err);
  }
});


