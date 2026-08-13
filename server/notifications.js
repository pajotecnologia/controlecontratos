const nodemailer = require("nodemailer");
const db = require("./db");
const { buildReciboPdf } = require("./pdf");

function applyTemplate(template, ctx) {
  return (template || "").replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (k in ctx) return ctx[k] ?? "";
    // legacy aliases
    if (k === "vendedor") return ctx.vendedor_nome || ctx.vendedor || "";
    if (k === "cliente") return ctx.cliente_nome || ctx.cliente || ctx.venda_cliente || "";
    if (k === "valor") return ctx.valor_comissao_fmt || ctx.valor || "";
    return "";
  });
}

function buildCtxFromVV(vv) {
  const clienteNome = vv.cliente_nome || vv.venda_cliente || "";
  return {
    vendedor: vv.vendedor_nome || "",
    vendedor_nome: vv.vendedor_nome || "",
    valor: Number(vv.valor_comissao).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
    valor_comissao_fmt: Number(vv.valor_comissao).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
    percentual: String(vv.percentual),
    cliente: clienteNome,
    cliente_nome: clienteNome,
    valor_servico: Number(vv.valor_servico || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
    mes_referencia: vv.mes_referencia || "",
  };
}

async function sendWhatsAppEvento(numero, evento, ctx, fallbackMsg) {
  const { rows } = await db.query("SELECT * FROM evolution_settings LIMIT 1");
  const ev = rows[0];
  if (!ev || !ev.instance_url || !ev.api_key || !ev.instance_name) {
    throw new Error("Evolution API não configurada");
  }
  let whatsapp = (numero || "").replace(/\D/g, "");
  if (!whatsapp) throw new Error("Número de WhatsApp não informado");
  if (!whatsapp.startsWith("55")) whatsapp = "55" + whatsapp;

  const templates = await getTemplatesForEvent(evento, "whatsapp");
  const body = templates.length > 0 ? templates[0] : fallbackMsg;
  const message = applyTemplate(body, ctx);

  const instanceUrl = ev.instance_url.replace(/\/$/, "");
  const res = await fetch(`${instanceUrl}/message/sendText/${ev.instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ev.api_key },
    body: JSON.stringify({ number: whatsapp, text: message }),
  });
  const result = await res.json();
  return { success: true, result };
}

async function sendEmailEvento(emailTo, evento, ctx, subject, fallbackMsg) {
  const { rows } = await db.query("SELECT * FROM smtp_settings LIMIT 1");
  const smtp = rows[0];
  if (!smtp || !smtp.host || !smtp.username || !smtp.password) throw new Error("SMTP não configurado");
  const transporter = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.port === 465,
    auth: { user: smtp.username, pass: smtp.password },
    tls: smtp.use_tls ? undefined : { rejectUnauthorized: false },
  });
  const from = smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email;
  const templates = await getTemplatesForEvent(evento, "email");
  const body = templates.length > 0 ? templates[0] : fallbackMsg;
  const message = applyTemplate(body, ctx);
  await transporter.sendMail({ from, to: emailTo, subject, text: message, html: message.replace(/\n/g, "<br>") });
  return { success: true };
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
    `SELECT p.id, p.numero_parcela, p.valor, p.data_vencimento, p.data_pagamento, p.pago, p.numero_nf, p.observacao, p.mes_referencia,
            p.asaas_cobranca_id, p.asaas_boleto_url, p.asaas_pix_copy_paste, p.asaas_invoice_url,
            v.cliente AS venda_cliente, v.valor_servico, v.qtde_parcelas,
            c.nome AS cliente_nome, c.cpf_cnpj AS cliente_cpf_cnpj, c.endereco AS cliente_endereco, c.telefone AS cliente_telefone, c.email AS cliente_email
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

  const titulo = p.pago ? "*RECIBO DE PAGAMENTO*" : "*DEMONSTRATIVO DE PARCELA (EM ABERTO)*";
  let msg = `${cabecalho}${titulo}\n\nCliente: ${clienteNome}\nParcela: ${p.numero_parcela}${p.qtde_parcelas ? ` de ${p.qtde_parcelas}` : ""}\nValor: R$ ${valor}\nVencimento: ${vencimento}`;
  if (p.pago) {
    msg += `\nData do Pagamento: ${pagamento}\nStatus: Quitada\n\nPagamento confirmado. Obrigado!`;
  } else {
    msg += `\nStatus: Em Aberto / A Pagar\n\nSegue demonstrativo referente à parcela em aberto.`;
  }
  if (p.mes_referencia) msg += `\nMês de Referência: ${p.mes_referencia}`;
  if (p.numero_nf) msg += `\nN.F.: ${p.numero_nf}`;
  return msg;
}

async function sendReceiptWhatsApp(parcela_id, baseUrl, mensagem) {
  const p = await loadParcelaRecibo(parcela_id);
  if (!p) throw new Error("Parcela não encontrada");

  const { rows: compRows } = await db.query("SELECT * FROM company_settings LIMIT 1");
  const comp = compRows[0] || null;

  const { rows } = await db.query("SELECT * FROM evolution_settings LIMIT 1");
  const settings = rows[0];
  if (!settings || !settings.instance_url || !settings.api_key || !settings.instance_name) {
    throw new Error("Evolution API não configurada. Preencha URL, Nome da Instância e API Key.");
  }

  let whatsapp = (p.cliente_telefone || "").replace(/\D/g, "");
  if (!whatsapp) throw new Error("Cliente sem telefone cadastrado");
  if (!whatsapp.startsWith("55")) whatsapp = "55" + whatsapp;

  const message = (mensagem && mensagem.trim()) ? mensagem.trim() : buildReciboText(p, comp);
  const clienteNome = p.cliente_nome || p.venda_cliente || "";
  const pdfBuffer = await buildReciboPdf(p, comp, baseUrl);
  const instanceUrl = settings.instance_url.replace(/\/$/, "");
  const response = await fetch(`${instanceUrl}/message/sendMedia/${settings.instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: settings.api_key },
    body: JSON.stringify({
      number: whatsapp,
      mediatype: "document",
      mimetype: "application/pdf",
      fileName: `recibo-${clienteNome.replace(/[^\w-]+/g, "_") || "cliente"}.pdf`,
      caption: message,
      media: pdfBuffer.toString("base64"),
    }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  return { success: true, result };
}

function buildReciboHtml(p, comp, logoUrl) {
  const clienteNome = p.cliente_nome || p.venda_cliente || "";
  const valor = Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const vencimento = p.data_vencimento ? new Date(p.data_vencimento + (String(p.data_vencimento).includes("T") ? "" : "T12:00:00")).toLocaleDateString("pt-BR") : "-";
  const pagamento = p.data_pagamento ? new Date(p.data_pagamento + (String(p.data_pagamento).includes("T") ? "" : "T12:00:00")).toLocaleDateString("pt-BR") : "-";
  const dataEmissao = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const endParts = [];
  if (comp && comp.endereco) endParts.push(comp.endereco);
  if (comp && comp.bairro) endParts.push(comp.bairro);
  if (comp && comp.cidade) endParts.push(comp.cidade);
  if (comp && comp.cep) endParts.push(`CEP ${comp.cep}`);
  const enderecoStr = endParts.join(", ");

  const logoTag = logoUrl
    ? `<img src="${logoUrl}" alt="${(comp && comp.name) || "Logo"}" style="max-height:70px; max-width:180px; object-fit:contain; margin-bottom:8px;" />`
    : "";

  const contato = comp ? [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""].filter(Boolean).join(" | ") : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 10px; max-width: 800px; margin: 0 auto;">
      <!-- Cabeçalho idêntico à Proposta Comercial -->
      <div style="text-align: center; border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 20px;">
        ${logoTag}
        <div style="font-size: 18px; font-weight: bold; color: #0f172a;">${(comp && comp.name) || "Sua Empresa"}</div>
        <div style="font-size: 12px; color: #64748b;">
          ${comp && comp.cnpj ? `CNPJ: ${comp.cnpj}` : ""} ${enderecoStr ? ` | ${enderecoStr}` : ""}
        </div>
        ${contato ? `<div style="font-size: 12px; color: #64748b;">${contato}</div>` : ""}
      </div>

      <!-- Título -->
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="font-size: 22px; margin: 0 0 5px 0; font-weight: bold; color: #0f172a;">
          ${p.pago ? "RECIBO DE PAGAMENTO" : "DEMONSTRATIVO DE PARCELA (EM ABERTO)"}
        </h1>
        <div style="font-size: 13px; color: #64748b;">
          Parcela ${p.numero_parcela} de ${p.qtde_parcelas || 1}${p.mes_referencia ? ` — ${p.mes_referencia}` : ""}
        </div>
        <div style="font-size: 12px; color: #64748b;">Emitido em ${dataEmissao}</div>
      </div>

      <!-- Dados do Cliente -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-bottom: 25px; font-size: 13px;">
        <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 8px; color: #0f172a;">DADOS DO CLIENTE</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div><strong>Cliente:</strong> ${clienteNome}</div>
          <div><strong>CPF/CNPJ:</strong> ${p.cliente_cpf_cnpj || "-"}</div>
          <div><strong>Endereço:</strong> ${p.cliente_endereco || "-"}</div>
          <div><strong>Telefone:</strong> ${p.cliente_telefone || "-"}</div>
          <div><strong>E-mail:</strong> ${p.cliente_email || "-"}</div>
          <div><strong>Status da Parcela:</strong> ${p.pago ? "<span style='color:#16a34a;font-weight:bold;'>QUITADA</span>" : "<span style='color:#d97706;font-weight:bold;'>EM ABERTO</span>"}</div>
        </div>
      </div>

      <!-- Tabela de Lançamento -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: bold;">Descrição do Contrato / Lançamento</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold; width: 90px;">Parcela</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold; width: 110px;">Vencimento</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold; width: 120px;">Pagamento</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-weight: bold; width: 120px;">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">
              Contrato: ${p.venda_cliente || "Serviço Prestado"}${p.mes_referencia ? ` (${p.mes_referencia})` : ""}
            </td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${p.numero_parcela}ª / ${p.qtde_parcelas || 1}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${vencimento}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${p.pago ? (pagamento !== "-" ? pagamento : "Quitada") : "Em aberto"}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">R$ ${valor}</td>
          </tr>
          <tr style="font-weight: bold; background-color: #f8fafc;">
            <td colspan="4" style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 14px;">VALOR TOTAL DA PARCELA:</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 14px; color: #0f172a;">R$ ${valor}</td>
          </tr>
        </tbody>
      </table>

      <!-- Observações / Detalhes de Pagamento -->
      ${(p.numero_nf || p.observacao || p.asaas_pix_copy_paste) ? `
      <div style="margin-bottom: 25px; font-size: 13px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px;">
        <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 8px; color: #0f172a;">OBSERVAÇÕES E INFORMAÇÕES DE PAGAMENTO</div>
        ${p.numero_nf ? `<div style="margin-bottom:4px;"><strong>Nota Fiscal Nº:</strong> ${p.numero_nf}</div>` : ""}
        ${p.observacao ? `<div style="white-space: pre-wrap; color: #334155; margin-bottom:4px;"><strong>Observação:</strong> ${p.observacao}</div>` : ""}
        ${p.asaas_pix_copy_paste ? `<div style="margin-top:6px; background:#fff; border:1px dashed #cbd5e1; padding:8px; border-radius:4px;"><strong>Chave PIX Copia e Cola:</strong><br/><code style="font-size:11px; word-break:break-all;">${p.asaas_pix_copy_paste}</code></div>` : ""}
      </div>
      ` : ""}

      <!-- Declaração -->
      <div style="text-align: center; font-size: 13px; color: #475569; margin-bottom: 40px;">
        ${p.pago
          ? `Declaramos para os devidos fins que recebemos de <strong>${clienteNome}</strong> a importância de <strong>R$ ${valor}</strong> referente à quitação da parcela ${p.numero_parcela}${p.mes_referencia ? ` (${p.mes_referencia})` : ""}.`
          : `Demonstrativo de cobrança referente à parcela ${p.numero_parcela}${p.mes_referencia ? ` (${p.mes_referencia})` : ""} no valor de <strong>R$ ${valor}</strong> com vencimento em <strong>${vencimento}</strong>.`
        }
      </div>

      <!-- Assinatura -->
      <div style="display: flex; justify-content: space-around; margin-top: 40px; text-align: center; font-size: 13px;">
        <div style="width: 250px;">
          ${(comp && comp.assinatura_imagem)
            ? `<img src="${comp.assinatura_imagem}" style="max-height:60px;display:block;margin:0 auto 5px;" />`
            : `<div style="border-top: 1px solid #94a3b8; margin-bottom: 5px;"></div>`
          }
          <strong>${(comp && comp.name) || "Assinatura da Empresa"}</strong>
          ${comp && comp.nome_responsavel ? `<div style="font-size: 11px; color: #64748b;">${comp.nome_responsavel}</div>` : ""}
        </div>
        <div style="width: 250px;">
          <div style="border-top: 1px solid #94a3b8; margin-bottom: 5px;"></div>
          <strong>${clienteNome}</strong>
          <div style="font-size: 11px; color: #64748b;">Assinatura do Cliente</div>
        </div>
      </div>
    </div>`;
}

async function sendReceiptEmail(parcela_id, baseUrl, mensagem) {
  const p = await loadParcelaRecibo(parcela_id);
  if (!p) throw new Error("Parcela não encontrada");
  if (!p.cliente_email) throw new Error("Cliente sem email cadastrado");

  const { rows: compRows } = await db.query("SELECT * FROM company_settings LIMIT 1");
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

  const textMessage = (mensagem && mensagem.trim()) ? mensagem.trim() : buildReciboText(p, comp);
  let htmlMessage = buildReciboHtml(p, comp, logoUrl);
  if (mensagem && mensagem.trim()) {
    const escaped = mensagem.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
    htmlMessage = `<div style="font-family:sans-serif; font-size:14px; color:#1e293b; margin-bottom:16px;">${escaped}</div>` + htmlMessage;
  }
  const clienteNome = p.cliente_nome || p.venda_cliente || "";
  const pdfBuffer = await buildReciboPdf(p, comp, baseUrl);
  const subjectText = p.pago ? `Recibo de Pagamento - ${clienteNome}` : `Demonstrativo de Parcela em Aberto - ${clienteNome}`;
  await transporter.sendMail({
    from, to: p.cliente_email,
    subject: subjectText,
    text: textMessage, html: htmlMessage,
    attachments: [{
      filename: `recibo-${clienteNome.replace(/[^\w-]+/g, "_") || "cliente"}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }],
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

async function sendWhatsAppDireto(numero, mensagem) {
  const { rows } = await db.query("SELECT * FROM evolution_settings LIMIT 1");
  const ev = rows[0];
  if (!ev || !ev.instance_url || !ev.api_key || !ev.instance_name) throw new Error("Evolution API não configurada");
  let whatsapp = (numero || "").replace(/\D/g, "");
  if (!whatsapp) throw new Error("Número não informado");
  if (!whatsapp.startsWith("55")) whatsapp = "55" + whatsapp;
  const instanceUrl = ev.instance_url.replace(/\/$/, "");
  const res = await fetch(`${instanceUrl}/message/sendText/${ev.instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ev.api_key },
    body: JSON.stringify({ number: whatsapp, text: mensagem }),
  });
  return res.json();
}

async function sendEmailDireto(emailTo, assunto, mensagem, htmlCustom) {
  const { rows } = await db.query("SELECT * FROM smtp_settings LIMIT 1");
  const smtp = rows[0];
  if (!smtp || !smtp.host || !smtp.username || !smtp.password) throw new Error("SMTP não configurado");
  const transporter = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.port === 465,
    auth: { user: smtp.username, pass: smtp.password },
    tls: smtp.use_tls ? undefined : { rejectUnauthorized: false },
  });
  const from = smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email;
  const html = htmlCustom || mensagem.replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  await transporter.sendMail({ from, to: emailTo, subject: assunto, text: mensagem, html });
  return { success: true };
}

async function sendCobrancaWhatsApp(parcela_id, mensagemCustomizada) {
  const p = await loadParcelaRecibo(parcela_id);
  if (!p) throw new Error("Parcela não encontrada");
  if (!p.asaas_cobranca_id && !p.asaas_boleto_url && !p.asaas_pix_copy_paste) {
    throw new Error("Cobrança ASAAS ainda não gerada para esta parcela");
  }

  const { rows } = await db.query("SELECT * FROM evolution_settings LIMIT 1");
  const settings = rows[0];
  if (!settings || !settings.instance_url || !settings.api_key || !settings.instance_name) {
    throw new Error("Evolution API não configurada");
  }

  let whatsapp = (p.cliente_telefone || "").replace(/\D/g, "");
  if (!whatsapp) throw new Error("Cliente sem telefone cadastrado");
  if (!whatsapp.startsWith("55")) whatsapp = "55" + whatsapp;

  const clienteNome = p.cliente_nome || p.venda_cliente || "Cliente";
  const valorFmt = Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const vencFmt = p.data_vencimento ? new Date(p.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "-";

  let textoPadrao = `Olá ${clienteNome}, segue cobrança da parcela ${p.numero_parcela}${p.mes_referencia ? " (" + p.mes_referencia + ")" : ""}:\n\n` +
    `*Valor:* R$ ${valorFmt}\n` +
    `*Vencimento:* ${vencFmt}\n`;

  if (p.asaas_boleto_url || p.asaas_invoice_url) {
    textoPadrao += `\n*Link do Boleto:* ${p.asaas_boleto_url || p.asaas_invoice_url}\n`;
  }
  if (p.asaas_pix_copy_paste) {
    textoPadrao += `\n*PIX Copia e Cola:*\n${p.asaas_pix_copy_paste}\n`;
  }

  const mensagemFinal = mensagemCustomizada && mensagemCustomizada.trim() ? mensagemCustomizada.trim() : textoPadrao;

  const instanceUrl = settings.instance_url.replace(/\/$/, "");
  const response = await fetch(`${instanceUrl}/message/sendText/${settings.instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: settings.api_key },
    body: JSON.stringify({ number: whatsapp, text: mensagemFinal }),
  });
  const result = await response.json();
  return { success: true, result };
}

async function sendCobrancaEmail(parcela_id, mensagemCustomizada) {
  const p = await loadParcelaRecibo(parcela_id);
  if (!p) throw new Error("Parcela não encontrada");
  if (!p.cliente_email) throw new Error("Cliente sem e-mail cadastrado");
  if (!p.asaas_cobranca_id && !p.asaas_boleto_url && !p.asaas_pix_copy_paste) {
    throw new Error("Cobrança ASAAS ainda não gerada para esta parcela");
  }

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

  const clienteNome = p.cliente_nome || p.venda_cliente || "Cliente";
  const valorFmt = Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const vencFmt = p.data_vencimento ? new Date(p.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "-";
  const linkBoleto = p.asaas_boleto_url || p.asaas_invoice_url;

  let htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">Cobrança de Parcela</h2>
      <p>Olá <strong>${clienteNome}</strong>,</p>
      <p>Segue os detalhes da cobrança para a parcela <strong>${p.numero_parcela}</strong>${p.mes_referencia ? ` (${p.mes_referencia})` : ""}:</p>
      <div style="background: #f8fafc; padding: 12px; border-radius: 6px; margin: 15px 0;">
        <div><strong>Valor:</strong> R$ ${valorFmt}</div>
        <div><strong>Vencimento:</strong> ${vencFmt}</div>
      </div>
  `;

  if (linkBoleto) {
    htmlBody += `
      <p><a href="${linkBoleto}" target="_blank" style="display: inline-block; background: #0284c7; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold;">Visualizar Boleto</a></p>
    `;
  }
  if (p.asaas_pix_copy_paste) {
    htmlBody += `
      <div style="margin-top: 15px;">
        <strong>PIX Copia e Cola:</strong>
        <textarea readonly style="width: 100%; height: 70px; font-family: monospace; font-size: 12px; margin-top: 5px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff;">${p.asaas_pix_copy_paste}</textarea>
      </div>
    `;
  }

  if (mensagemCustomizada && mensagemCustomizada.trim()) {
    const escaped = mensagemCustomizada.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
    htmlBody = `<div style="font-family: sans-serif; font-size: 14px; color: #1e293b; margin-bottom: 16px;">${escaped}</div>` + htmlBody;
  }

  htmlBody += `</div>`;

  const textBody = mensagemCustomizada && mensagemCustomizada.trim()
    ? mensagemCustomizada.trim()
    : `Cobrança de parcela ${p.numero_parcela} - R$ ${valorFmt}. Vencimento: ${vencFmt}.${linkBoleto ? `\nBoleto: ${linkBoleto}` : ""}`;

  await transporter.sendMail({
    from,
    to: p.cliente_email,
    subject: `Cobrança - Parcela ${p.numero_parcela} - ${clienteNome}`,
    text: textBody,
    html: htmlBody,
  });

  return { success: true };
}

async function sendCobrancaSimplesWhatsApp(parcela_id, mensagemCustomizada) {
  const p = await loadParcelaRecibo(parcela_id);
  if (!p) throw new Error("Parcela não encontrada");

  const { rows } = await db.query("SELECT * FROM evolution_settings LIMIT 1");
  const settings = rows[0];
  if (!settings || !settings.instance_url || !settings.api_key || !settings.instance_name)
    throw new Error("Evolution API não configurada");

  let whatsapp = (p.cliente_telefone || "").replace(/\D/g, "");
  if (!whatsapp) throw new Error("Cliente sem telefone cadastrado");
  if (!whatsapp.startsWith("55")) whatsapp = "55" + whatsapp;

  const { rows: compRows } = await db.query("SELECT name, cnpj FROM company_settings LIMIT 1");
  const comp = compRows[0] || null;

  const clienteNome = p.cliente_nome || p.venda_cliente || "Cliente";
  const valorFmt = Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const vencFmt = p.data_vencimento ? new Date(p.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "-";

  const ctx = {
    cliente: clienteNome, cliente_nome: clienteNome,
    parcela: String(p.numero_parcela), numero_parcela: String(p.numero_parcela),
    valor: valorFmt, vencimento: vencFmt,
    mes_referencia: p.mes_referencia || "",
    empresa: (comp && comp.name) || "",
  };

  const textoPadrao = (comp && comp.name ? `*${comp.name}*\n\n` : "") +
    `Olá ${clienteNome}, segue cobrança:\n\n` +
    `*Parcela:* ${p.numero_parcela}${p.mes_referencia ? " (" + p.mes_referencia + ")" : ""}\n` +
    `*Valor:* R$ ${valorFmt}\n` +
    `*Vencimento:* ${vencFmt}`;

  const mensagemFinal = applyTemplate(
    mensagemCustomizada && mensagemCustomizada.trim() ? mensagemCustomizada.trim() : textoPadrao,
    ctx
  );
  const instanceUrl = settings.instance_url.replace(/\/$/, "");
  const response = await fetch(`${instanceUrl}/message/sendText/${settings.instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: settings.api_key },
    body: JSON.stringify({ number: whatsapp, text: mensagemFinal }),
  });
  const result = await response.json();
  return { success: true, result };
}

async function sendCobrancaSimplesEmail(parcela_id, baseUrl, mensagemCustomizada) {
  const p = await loadParcelaRecibo(parcela_id);
  if (!p) throw new Error("Parcela não encontrada");
  if (!p.cliente_email) throw new Error("Cliente sem e-mail cadastrado");

  const { rows: compRows } = await db.query("SELECT name, cnpj, cep, endereco, bairro, cidade, email, telefone, logo_url FROM company_settings LIMIT 1");
  const comp = compRows[0] || null;

  const { rows } = await db.query("SELECT * FROM smtp_settings LIMIT 1");
  const smtp = rows[0];
  if (!smtp || !smtp.host || !smtp.username || !smtp.password) throw new Error("SMTP não configurado");

  const transporter = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.port === 465,
    auth: { user: smtp.username, pass: smtp.password },
    tls: smtp.use_tls ? undefined : { rejectUnauthorized: false },
  });
  const from = smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email;

  const clienteNome = p.cliente_nome || p.venda_cliente || "Cliente";
  const valorFmt = Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const vencFmt = p.data_vencimento ? new Date(p.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "-";

  const textoPadrao = `Olá ${clienteNome},\n\nSegue cobrança:\n\nParcela: ${p.numero_parcela}${p.mes_referencia ? " (" + p.mes_referencia + ")" : ""}\nValor: R$ ${valorFmt}\nVencimento: ${vencFmt}\n\nAtenciosamente,\n${(comp && comp.name) || ""}`;
  const textBody = mensagemCustomizada && mensagemCustomizada.trim() ? mensagemCustomizada.trim() : textoPadrao;

  let logoUrl = comp ? comp.logo_url || "" : "";
  if (logoUrl && logoUrl.startsWith("/")) logoUrl = `${baseUrl || ""}${logoUrl}`;
  const logoTag = logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:60px;max-width:160px;object-fit:contain;margin-bottom:8px;" />` : "";
  const htmlBody = `<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:540px;margin:0 auto;">
    ${comp && comp.name ? `<div style="text-align:center;border-bottom:2px solid #334155;padding-bottom:10px;margin-bottom:18px;">${logoTag}<div style="font-size:16px;font-weight:bold;">${comp.name}</div></div>` : ""}
    <p style="font-size:14px;">Olá <strong>${clienteNome}</strong>,</p>
    <p style="font-size:14px;">Segue sua cobrança:</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:14px 0;">
      <tr><td style="padding:6px 8px;color:#64748b;border:1px solid #e2e8f0;">Parcela</td><td style="padding:6px 8px;font-weight:600;border:1px solid #e2e8f0;">${p.numero_parcela}${p.mes_referencia ? " (" + p.mes_referencia + ")" : ""}</td></tr>
      <tr><td style="padding:6px 8px;color:#64748b;border:1px solid #e2e8f0;">Valor</td><td style="padding:6px 8px;font-weight:600;border:1px solid #e2e8f0;">R$ ${valorFmt}</td></tr>
      <tr><td style="padding:6px 8px;color:#64748b;border:1px solid #e2e8f0;">Vencimento</td><td style="padding:6px 8px;font-weight:600;border:1px solid #e2e8f0;">${vencFmt}</td></tr>
    </table>
    ${mensagemCustomizada && mensagemCustomizada.trim() ? `<p style="font-size:13px;color:#475569;">${mensagemCustomizada.trim().replace(/\n/g, "<br/>")}</p>` : ""}
  </div>`;

  await transporter.sendMail({
    from, to: p.cliente_email,
    subject: `Cobrança - Parcela ${p.numero_parcela} - ${clienteNome}`,
    text: textBody, html: htmlBody,
  });
  return { success: true };
}

module.exports = { sendWhatsApp, sendEmail, sendReceiptWhatsApp, sendReceiptEmail, sendCobrancaWhatsApp, sendCobrancaEmail, sendCobrancaSimplesWhatsApp, sendCobrancaSimplesEmail, sendWhatsAppEvento, sendEmailEvento, buildCtxFromVV, sendWhatsAppDireto, sendEmailDireto, applyTemplate };
