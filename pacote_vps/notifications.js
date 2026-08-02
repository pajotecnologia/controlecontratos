const nodemailer = require("nodemailer");
const db = require("./db");

function applyTemplate(template, vv) {
  const clienteNome = vv.cliente_nome || vv.venda_cliente || "";
  return (template || "")
    .replace(/\{\{vendedor\}\}/g, vv.vendedor_nome || "")
    .replace(/\{\{valor\}\}/g, Number(vv.valor_comissao).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))
    .replace(/\{\{percentual\}\}/g, String(vv.percentual))
    .replace(/\{\{cliente\}\}/g, clienteNome)
    .replace(/\{\{valor_servico\}\}/g, Number(vv.valor_servico || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))
    .replace(/\{\{mes_referencia\}\}/g, vv.mes_referencia || "");
}

async function loadVendaVendedor(id) {
  const { rows } = await db.query(
    `SELECT vv.id, vv.percentual, vv.valor_comissao,
            ve.nome AS vendedor_nome, ve.whatsapp AS vendedor_whatsapp, ve.email AS vendedor_email, ve.user_id AS vendedor_user_id,
            v.cliente AS venda_cliente, v.valor_servico, v.mes_referencia,
            c.nome AS cliente_nome
       FROM venda_vendedores vv
       JOIN vendedores ve ON ve.id = vv.vendedor_id
       JOIN vendas v ON v.id = vv.venda_id
       LEFT JOIN clientes c ON c.id = v.cliente_id
      WHERE vv.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Returns active templates for an event filtered by channel.
async function getTemplatesForEvent(evento, channel) {
  const col = channel === "whatsapp" ? "ativo_whatsapp" : "ativo_email";
  const { rows } = await db.query(
    `SELECT corpo FROM message_templates WHERE evento=$1 AND ${col}=true ORDER BY created_at ASC`,
    [evento]
  );
  return rows.map(r => r.corpo);
}

async function sendWhatsApp(venda_vendedor_id, template_type = "pagamento") {
  const vv = await loadVendaVendedor(venda_vendedor_id);
  if (!vv) throw new Error("Comissão não encontrada");

  const { rows } = await db.query("SELECT * FROM evolution_settings LIMIT 1");
  const settings = rows[0];
  if (!settings || !settings.instance_url || !settings.api_key || !settings.instance_name) {
    throw new Error("Evolution API não configurada. Preencha URL, Nome da Instância e API Key.");
  }

  let whatsapp = (vv.vendedor_whatsapp || "").replace(/\D/g, "");
  if (!whatsapp) throw new Error("Vendedor sem WhatsApp cadastrado");
  if (!whatsapp.startsWith("55")) whatsapp = "55" + whatsapp;

  // Try custom templates first, fall back to legacy evolution_settings columns
  const templates = await getTemplatesForEvent(template_type === "nova_venda" ? "nova_venda" : "pagamento", "whatsapp");
  const templateBody = templates.length > 0
    ? templates[0]
    : (template_type === "nova_venda"
        ? (settings.template_nova_venda || "Olá {{vendedor}}, você foi incluído em uma nova venda!")
        : (settings.template_pagamento || settings.message_template || "Comissão confirmada!"));

  const message = applyTemplate(templateBody, vv);
  const instanceUrl = settings.instance_url.replace(/\/$/, "");
  const response = await fetch(`${instanceUrl}/message/sendText/${settings.instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: settings.api_key },
    body: JSON.stringify({ number: whatsapp, text: message }),
  });
  const result = await response.json();
  return { success: true, result };
}

async function loadParcelaRecibo(parcela_id) {
  const { rows } = await db.query(
    `SELECT p.id, p.numero_parcela, p.valor, p.data_vencimento, p.data_pagamento, p.numero_nf, p.mes_referencia,
            v.cliente AS venda_cliente, v.valor_servico,
            c.nome AS cliente_nome, c.telefone AS cliente_telefone, c.email AS cliente_email
       FROM parcelas p
       JOIN vendas v ON v.id = p.venda_id
       LEFT JOIN clientes c ON c.id = v.cliente_id
      WHERE p.id = $1`,
    [parcela_id]
  );
  return rows[0] || null;
}

function buildReciboText(p, comp) {
  const clienteNome = p.cliente_nome || p.venda_cliente || "";
  const valor = Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const vencimento = new Date(p.data_vencimento).toLocaleDateString("pt-BR");
  const pagamento = p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString("pt-BR") : "-";

  let cabecalho = "";
  if (comp && comp.name) {
    cabecalho += `${comp.name}\n`;
    if (comp.cnpj) cabecalho += `CNPJ: ${comp.cnpj}\n`;
    let endParts = [];
    if (comp.endereco) endParts.push(comp.endereco);
    if (comp.bairro) endParts.push(comp.bairro);
    if (comp.cidade) endParts.push(comp.cidade);
    if (comp.cep) endParts.push(`CEP ${comp.cep}`);
    if (endParts.length > 0) cabecalho += `${endParts.join(", ")}\n`;
    const contato = [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""].filter(Boolean).join(" | ");
    if (contato) cabecalho += `${contato}\n`;
    cabecalho += `----------------------------------------\n\n`;
  }

  let msg = `${cabecalho}Recibo de Pagamento\n\nCliente: ${clienteNome}\nParcela: ${p.numero_parcela}\nValor: R$ ${valor}\nVencimento: ${vencimento}\nData do Pagamento: ${pagamento}`;
  if (p.mes_referencia) msg += `\nMês de Referência: ${p.mes_referencia}`;
  if (p.numero_nf) msg += `\nN.F.: ${p.numero_nf}`;
  msg += `\n\nPagamento confirmado. Obrigado!`;
  return msg;
}

async function sendReceiptWhatsApp(parcela_id) {
  const p = await loadParcelaRecibo(parcela_id);
  if (!p) throw new Error("Parcela não encontrada");

  const { rows: compRows } = await db.query("SELECT name, cnpj, cep, endereco, bairro, cidade, email, telefone, logo_url FROM company_settings LIMIT 1");
  const comp = compRows[0] || null;

  const { rows } = await db.query("SELECT * FROM evolution_settings LIMIT 1");
  const settings = rows[0];
  if (!settings || !settings.instance_url || !settings.api_key || !settings.instance_name) {
    throw new Error("Evolution API não configurada. Preencha URL, Nome da Instância e API Key.");
  }

  let whatsapp = (p.cliente_telefone || "").replace(/\D/g, "");
  if (!whatsapp) throw new Error("Cliente sem telefone cadastrado");
  if (!whatsapp.startsWith("55")) whatsapp = "55" + whatsapp;

  const message = buildReciboText(p, comp);
  const instanceUrl = settings.instance_url.replace(/\/$/, "");
  const response = await fetch(`${instanceUrl}/message/sendText/${settings.instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: settings.api_key },
    body: JSON.stringify({ number: whatsapp, text: message }),
  });
  const result = await response.json();
  return { success: true, result };
}

function buildReciboHtml(p, comp, logoUrl) {
  const clienteNome = p.cliente_nome || p.venda_cliente || "";
  const valor = Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const vencimento = new Date(p.data_vencimento).toLocaleDateString("pt-BR");
  const pagamento = p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString("pt-BR") : "-";

  const endParts = [];
  if (comp && comp.endereco) endParts.push(comp.endereco);
  if (comp && comp.bairro) endParts.push(comp.bairro);
  if (comp && comp.cidade) endParts.push(comp.cidade);
  if (comp && comp.cep) endParts.push(`CEP ${comp.cep}`);
  const enderecoStr = endParts.join(", ");

  const logoTag = logoUrl
    ? `<img src="${logoUrl}" alt="${(comp && comp.name) || "Logo"}" style="max-height:70px; max-width:180px; object-fit:contain;" />`
    : "";

  const contato = comp ? [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""].filter(Boolean).join(" | ") : "";

  const cabecalhoHtml = comp && comp.name
    ? `<div style="text-align:center; border-bottom:2px solid #333; padding-bottom:10px; margin-bottom:14px;">
         ${logoTag}
         <div style="font-size:16px; font-weight:bold; color:#1e293b; margin-top:6px;">${comp.name}</div>
         ${comp && comp.cnpj ? `<div style="font-size:12px; color:#475569;">CNPJ: ${comp.cnpj}</div>` : ""}
         ${enderecoStr ? `<div style="font-size:12px; color:#475569;">${enderecoStr}</div>` : ""}
         ${contato ? `<div style="font-size:12px; color:#475569;">${contato}</div>` : ""}
       </div>`
    : "";

  return `
    <div style="font-family: Georgia, serif; color:#1e293b; max-width:560px; margin:0 auto;">
      ${cabecalhoHtml}
      <h2 style="text-align:center; font-size:18px; margin:10px 0;">RECIBO DE PAGAMENTO</h2>
      <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:10px;">
        <tr><td style="padding:4px 0; color:#64748b;">Cliente</td><td style="padding:4px 0; font-weight:600;">${clienteNome}</td></tr>
        <tr><td style="padding:4px 0; color:#64748b;">Parcela</td><td style="padding:4px 0; font-weight:600;">${p.numero_parcela}</td></tr>
        <tr><td style="padding:4px 0; color:#64748b;">Valor</td><td style="padding:4px 0; font-weight:600;">R$ ${valor}</td></tr>
        <tr><td style="padding:4px 0; color:#64748b;">Vencimento</td><td style="padding:4px 0; font-weight:600;">${vencimento}</td></tr>
        <tr><td style="padding:4px 0; color:#64748b;">Data do Pagamento</td><td style="padding:4px 0; font-weight:600;">${pagamento}</td></tr>
        ${p.mes_referencia ? `<tr><td style="padding:4px 0; color:#64748b;">Mês de Referência</td><td style="padding:4px 0; font-weight:600;">${p.mes_referencia}</td></tr>` : ""}
        ${p.numero_nf ? `<tr><td style="padding:4px 0; color:#64748b;">N.F.</td><td style="padding:4px 0; font-weight:600;">${p.numero_nf}</td></tr>` : ""}
      </table>
      <p style="text-align:center; margin-top:18px; font-size:13px; color:#16a34a; font-weight:600;">Pagamento confirmado. Obrigado!</p>
    </div>`;
}

async function sendReceiptEmail(parcela_id, baseUrl) {
  const p = await loadParcelaRecibo(parcela_id);
  if (!p) throw new Error("Parcela não encontrada");
  if (!p.cliente_email) throw new Error("Cliente sem email cadastrado");

  const { rows: compRows } = await db.query("SELECT name, cnpj, cep, endereco, bairro, cidade, email, telefone, logo_url FROM company_settings LIMIT 1");
  const comp = compRows[0] || null;

  const { rows } = await db.query("SELECT * FROM smtp_settings LIMIT 1");
  const smtp = rows[0];
  if (!smtp || !smtp.host || !smtp.username || !smtp.password) {
    throw new Error("SMTP não configurado");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.username, pass: smtp.password },
    tls: smtp.use_tls ? undefined : { rejectUnauthorized: false },
  });
  const from = smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email;

  let logoUrl = comp ? comp.logo_url || "" : "";
  if (logoUrl && logoUrl.startsWith("/")) logoUrl = `${baseUrl || ""}${logoUrl}`;

  const textMessage = buildReciboText(p, comp);
  const htmlMessage = buildReciboHtml(p, comp, logoUrl);
  const clienteNome = p.cliente_nome || p.venda_cliente || "";
  await transporter.sendMail({
    from, to: p.cliente_email,
    subject: `Recibo de Pagamento - ${clienteNome}`,
    text: textMessage, html: htmlMessage,
  });
  return { success: true };
}

async function sendEmail({ venda_vendedor_id, template_type, test, test_email }) {
  const { rows } = await db.query("SELECT * FROM smtp_settings LIMIT 1");
  const smtp = rows[0];
  if (!smtp || !smtp.host || !smtp.username || !smtp.password) {
    throw new Error("SMTP não configurado");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.username, pass: smtp.password },
    tls: smtp.use_tls ? undefined : { rejectUnauthorized: false },
  });
  const from = smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email;

  if (test && test_email) {
    await transporter.sendMail({
      from, to: test_email,
      subject: "Teste SMTP - Configuração OK",
      text: "Este é um email de teste. Sua configuração SMTP está funcionando corretamente!",
    });
    return { success: true };
  }

  const vv = await loadVendaVendedor(venda_vendedor_id);
  if (!vv) throw new Error("Venda vendedor não encontrado");
  const vendedorEmail = vv.vendedor_email;
  if (!vendedorEmail) throw new Error("Vendedor sem email cadastrado");

  const evento = template_type === "nova_venda" ? "nova_venda" : "pagamento";

  // Try custom templates first, fall back to legacy smtp_settings columns
  const templates = await getTemplatesForEvent(evento, "email");
  const templateBody = templates.length > 0
    ? templates[0]
    : (template_type === "nova_venda" ? smtp.template_nova_venda : smtp.template_pagamento);

  const clienteNome = vv.cliente_nome || vv.venda_cliente || "";
  const message = applyTemplate(templateBody, vv);
  const subject = template_type === "nova_venda" ? `Nova Venda - ${clienteNome}` : `Comissão Paga - ${clienteNome}`;

  await transporter.sendMail({
    from, to: vendedorEmail, subject,
    text: message, html: message.replace(/\n/g, "<br>"),
  });
  return { success: true };
}

module.exports = { sendWhatsApp, sendEmail, sendReceiptWhatsApp, sendReceiptEmail };
