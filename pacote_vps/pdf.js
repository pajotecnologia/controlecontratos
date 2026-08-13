const PDFDocument = require("pdfkit");

function fmtMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtData(d) {
  if (!d) return "-";
  const raw = String(d);
  const norm = raw.includes("T") ? raw : `${raw}T12:00:00`;
  const dt = new Date(norm);
  return isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString("pt-BR");
}

async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    if (url.startsWith("data:")) {
      const base64 = url.split(",")[1] || "";
      return Buffer.from(base64, "base64");
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error(`Erro ao carregar imagem ${url}:`, err.message);
    return null;
  }
}

function resolveUrl(url, baseUrl) {
  if (!url) return "";
  if (url.startsWith("/")) return `${baseUrl || ""}${url}`;
  return url;
}

function docToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

async function drawCabecalhoEmpresa(doc, comp, baseUrl) {
  const startY = doc.y;
  let textX = doc.page.margins.left;

  const logoUrl = resolveUrl(comp.logo_url, baseUrl);
  const logoBuffer = await fetchImageBuffer(logoUrl);
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, doc.page.margins.left, startY, { fit: [90, 60] });
      textX = doc.page.margins.left + 100;
    } catch {
      // imagem inválida, ignora
    }
  }

  const textWidth = doc.page.width - doc.page.margins.right - textX;
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#1e293b")
    .text(comp.name || "", textX, startY, { width: textWidth });
  doc.font("Helvetica").fontSize(9).fillColor("#475569");
  if (comp.cnpj) doc.text(`CNPJ: ${comp.cnpj}`, textX, doc.y, { width: textWidth });
  const endereco = [comp.endereco, comp.bairro, comp.cidade, comp.cep ? `CEP: ${comp.cep}` : ""].filter(Boolean).join(" - ");
  if (endereco) doc.text(endereco, textX, doc.y, { width: textWidth });
  const contato = [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""].filter(Boolean).join(" | ");
  if (contato) doc.text(contato, textX, doc.y, { width: textWidth });

  doc.y = Math.max(doc.y, startY + 65);
  doc.moveDown(0.5);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#333333").lineWidth(1.5).stroke();
  doc.moveDown(1);
  doc.fillColor("#1e293b");
}

async function buildPropostaPdf(p, itens, comp, baseUrl) {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  await drawCabecalhoEmpresa(doc, comp, baseUrl);

  doc.font("Helvetica-Bold").fontSize(16)
    .text(p.titulo || "PROPOSTA COMERCIAL", { align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#64748b")
    .text(`Data: ${fmtData(p.data_proposta)}${p.tipo_proposta ? ` | Tipo: ${p.tipo_proposta}` : ""}`, { align: "center" });
  doc.moveDown(1);
  doc.fillColor("#1e293b");

  const boxY = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).text("DADOS DO CLIENTE", doc.page.margins.left + 10, boxY + 8);
  doc.font("Helvetica").fontSize(9);
  const col1X = doc.page.margins.left + 10;
  const col2X = doc.page.margins.left + usableWidth / 2;
  let lineY = boxY + 24;
  doc.text(`Cliente: ${p.nome || "-"}`, col1X, lineY, { width: usableWidth / 2 - 20 });
  doc.text(`CPF/CNPJ: ${p.cpf_cnpj || "-"}`, col2X, lineY, { width: usableWidth / 2 - 20 });
  lineY += 14;
  doc.text(`Endereço: ${p.endereco || "-"}`, col1X, lineY, { width: usableWidth / 2 - 20 });
  doc.text(`Telefone: ${p.telefone || "-"}`, col2X, lineY, { width: usableWidth / 2 - 20 });
  lineY += 14;
  doc.text(`E-mail: ${p.email || "-"}`, col1X, lineY, { width: usableWidth - 20 });
  const boxHeight = lineY + 20 - boxY;
  doc.rect(doc.page.margins.left, boxY, usableWidth, boxHeight)
    .strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.y = boxY + boxHeight + 15;

  const colDesc = usableWidth * 0.5;
  const colQtd = usableWidth * 0.12;
  const colUnit = usableWidth * 0.19;
  const colTotal = usableWidth * 0.19;
  const tableX = doc.page.margins.left;

  const drawRow = (cells, y, height, opts = {}) => {
    const { bold = false, bg = null, align = ["left", "center", "right", "right"] } = opts;
    if (bg) doc.rect(tableX, y, usableWidth, height).fill(bg);
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor("#1e293b");
    let x = tableX;
    const widths = [colDesc, colQtd, colUnit, colTotal];
    cells.forEach((text, i) => {
      doc.text(text, x + 6, y + 6, { width: widths[i] - 12, align: align[i] });
      x += widths[i];
    });
    doc.rect(tableX, y, usableWidth, height).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
  };

  const checkPageBreak = (neededHeight) => {
    if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  };

  checkPageBreak(24);
  drawRow(["Descrição", "Qtd", "Unitário", "Total"], doc.y, 24, { bold: true, bg: "#f1f5f9" });
  doc.y += 24;

  for (const item of itens) {
    const descText = item.descricao || "";
    const imgBuffer = item.imagem_url ? await fetchImageBuffer(resolveUrl(item.imagem_url, baseUrl)) : null;
    const textHeight = doc.font("Helvetica").fontSize(9).heightOfString(descText, { width: colDesc - 12 });
    const rowHeight = Math.max(24, textHeight + 12 + (imgBuffer ? 65 : 0));

    checkPageBreak(rowHeight);
    const y = doc.y;
    drawRow(
      [descText, String(item.quantidade), `R$ ${fmtMoeda(item.valor_unitario)}`, `R$ ${fmtMoeda(item.total)}`],
      y, rowHeight
    );
    if (imgBuffer) {
      try {
        doc.image(imgBuffer, tableX + 6, y + textHeight + 10, { fit: [80, 55] });
      } catch {
        // imagem inválida, ignora
      }
    }
    doc.y = y + rowHeight;
  }

  const desc = Number(p.desconto || 0);
  const totalItens = itens.reduce((s, i) => s + Number(i.total || 0), 0);
  if (desc > 0) {
    checkPageBreak(20 * 2);
    drawRow(["", "", "Subtotal:", `R$ ${fmtMoeda(totalItens)}`], doc.y, 20);
    doc.y += 20;
    drawRow(["", "", "Desconto:", `- R$ ${fmtMoeda(desc)}`], doc.y, 20);
    doc.y += 20;
  }

  checkPageBreak(26);
  drawRow(["", "", "VALOR TOTAL:", `R$ ${fmtMoeda(p.total)}`], doc.y, 26, { bold: true, bg: "#f8fafc" });
  doc.y += 26;

  checkPageBreak(90);

  if (p.observacoes) {
    doc.moveDown(2);
    const needed = doc.font("Helvetica").fontSize(9).heightOfString(p.observacoes, { width: usableWidth - 30 }) + 30;
    checkPageBreak(needed);
    const boxY = doc.y;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e293b").text("OBSERVAÇÕES", doc.page.margins.left + 15, boxY + 10);
    doc.font("Helvetica").fontSize(9).fillColor("#334155").text(p.observacoes, doc.page.margins.left + 15, boxY + 25, { width: usableWidth - 30 });
    const boxHeight = doc.y - boxY + 10;
    doc.rect(doc.page.margins.left, boxY, usableWidth, boxHeight).strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.y = boxY + boxHeight + 10;
  }
  doc.moveDown(2);
  const sigY = doc.y;
  const colWidth = usableWidth / 2 - 15;
  const col1 = doc.page.margins.left;
  const col2 = doc.page.margins.left + usableWidth / 2 + 15;

  const empresaAssinaturaBuffer = comp.assinatura_imagem ? await fetchImageBuffer(resolveUrl(comp.assinatura_imagem, baseUrl)) : null;
  if (empresaAssinaturaBuffer) {
    try {
      doc.image(empresaAssinaturaBuffer, col1 + colWidth / 2 - 40, sigY, { fit: [80, 40] });
    } catch {
      // imagem inválida, ignora
    }
  }
  doc.moveTo(col1, sigY + 45).lineTo(col1 + colWidth, sigY + 45).strokeColor("#94a3b8").lineWidth(1).stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e293b")
    .text(comp.name || "Assinatura da Empresa", col1, sigY + 50, { width: colWidth, align: "center" });
  if (comp.nome_responsavel) {
    doc.font("Helvetica").fontSize(9).fillColor("#64748b")
      .text(comp.nome_responsavel, col1, doc.y, { width: colWidth, align: "center" });
  }

  doc.moveTo(col2, sigY + 45).lineTo(col2 + colWidth, sigY + 45).strokeColor("#94a3b8").lineWidth(1).stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e293b")
    .text(p.nome || "Assinatura do Cliente", col2, sigY + 50, { width: colWidth, align: "center" });

  return docToBuffer(doc);
}

async function buildReciboPdf(p, comp, baseUrl) {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (comp) {
    await drawCabecalhoEmpresa(doc, comp, baseUrl);
  }

  // Título e Emissão
  const titulo = p.pago ? "RECIBO DE PAGAMENTO" : "DEMONSTRATIVO DE PARCELA (EM ABERTO)";
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a")
    .text(titulo, { align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#64748b")
    .text(`Parcela ${p.numero_parcela} de ${p.qtde_parcelas || 1}${p.mes_referencia ? ` | Referência: ${p.mes_referencia}` : ""} | Emitido em: ${fmtData(new Date())}`, { align: "center" });
  doc.moveDown(1);
  doc.fillColor("#1e293b");

  // Box do Cliente
  const boxY = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).text("DADOS DO CLIENTE", doc.page.margins.left + 10, boxY + 8);
  doc.font("Helvetica").fontSize(9);
  const col1X = doc.page.margins.left + 10;
  const col2X = doc.page.margins.left + usableWidth / 2;
  let lineY = boxY + 24;
  const clienteNome = p.cliente_nome || p.venda_cliente || "-";
  doc.text(`Cliente: ${clienteNome}`, col1X, lineY, { width: usableWidth / 2 - 20 });
  doc.text(`CPF/CNPJ: ${p.cliente_cpf_cnpj || "-"}`, col2X, lineY, { width: usableWidth / 2 - 20 });
  lineY += 14;
  doc.text(`Endereço: ${p.cliente_endereco || "-"}`, col1X, lineY, { width: usableWidth / 2 - 20 });
  doc.text(`Telefone: ${p.cliente_telefone || "-"}`, col2X, lineY, { width: usableWidth / 2 - 20 });
  lineY += 14;
  doc.text(`E-mail: ${p.cliente_email || "-"}`, col1X, lineY, { width: usableWidth / 2 - 20 });
  doc.font("Helvetica-Bold").fillColor(p.pago ? "#16a34a" : "#d97706")
    .text(`Status: ${p.pago ? "QUITADA" : "EM ABERTO"}`, col2X, lineY, { width: usableWidth / 2 - 20 });
  doc.fillColor("#1e293b").font("Helvetica");

  const boxHeight = lineY + 20 - boxY;
  doc.rect(doc.page.margins.left, boxY, usableWidth, boxHeight)
    .strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.y = boxY + boxHeight + 15;

  // Tabela da Parcela
  const colDesc = usableWidth * 0.40;
  const colParc = usableWidth * 0.12;
  const colVenc = usableWidth * 0.16;
  const colPag = usableWidth * 0.16;
  const colVal = usableWidth * 0.16;
  const tableX = doc.page.margins.left;

  const drawRow = (cells, y, height, opts = {}) => {
    const { bold = false, bg = null, align = ["left", "center", "center", "center", "right"] } = opts;
    if (bg) doc.rect(tableX, y, usableWidth, height).fill(bg);
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor("#1e293b");
    let x = tableX;
    const widths = [colDesc, colParc, colVenc, colPag, colVal];
    cells.forEach((text, i) => {
      doc.text(text, x + 4, y + 6, { width: widths[i] - 8, align: align[i] });
      x += widths[i];
    });
    doc.rect(tableX, y, usableWidth, height).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
  };

  drawRow(["Descrição do Lançamento", "Parcela", "Vencimento", "Pagamento", "Valor"], doc.y, 24, { bold: true, bg: "#f1f5f9" });
  doc.y += 24;

  const descContrato = `Contrato: ${p.venda_cliente || "Serviço Prestado"}${p.mes_referencia ? ` (${p.mes_referencia})` : ""}`;
  const numParcStr = `${p.numero_parcela}ª / ${p.qtde_parcelas || 1}`;
  const vencStr = fmtData(p.data_vencimento);
  const pagStr = p.pago ? (p.data_pagamento ? fmtData(p.data_pagamento) : "Quitada") : "Em aberto";
  const valStr = `R$ ${fmtMoeda(p.valor)}`;

  drawRow([descContrato, numParcStr, vencStr, pagStr, valStr], doc.y, 24);
  doc.y += 24;

  drawRow(["", "", "", "VALOR TOTAL:", valStr], doc.y, 24, { bold: true, bg: "#f8fafc", align: ["left", "center", "center", "right", "right"] });
  doc.y += 24;

  // Observações se existirem
  if (p.numero_nf || p.observacao || p.asaas_pix_copy_paste) {
    doc.moveDown(1);
    const obsY = doc.y;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e293b").text("OBSERVAÇÕES E INFORMAÇÕES DE PAGAMENTO", doc.page.margins.left + 10, obsY + 8);
    doc.font("Helvetica").fontSize(9);
    let oLine = obsY + 22;
    if (p.numero_nf) {
      doc.text(`Nota Fiscal Nº: ${p.numero_nf}`, doc.page.margins.left + 10, oLine);
      oLine += 14;
    }
    if (p.observacao) {
      doc.text(`Observação: ${p.observacao}`, doc.page.margins.left + 10, oLine, { width: usableWidth - 20 });
      oLine += 14;
    }
    if (p.asaas_pix_copy_paste) {
      doc.text(`PIX Copia e Cola: ${p.asaas_pix_copy_paste}`, doc.page.margins.left + 10, oLine, { width: usableWidth - 20 });
      oLine += 14;
    }
    const obsHeight = oLine + 6 - obsY;
    doc.rect(doc.page.margins.left, obsY, usableWidth, obsHeight).strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.y = obsY + obsHeight + 10;
  }

  doc.moveDown(1.5);
  const declaracao = p.pago
    ? `Declaramos para os devidos fins que recebemos de ${clienteNome} a importância de R$ ${fmtMoeda(p.valor)} referente à quitação da parcela ${p.numero_parcela}${p.mes_referencia ? ` (${p.mes_referencia})` : ""}.`
    : `Demonstrativo de cobrança referente à parcela ${p.numero_parcela}${p.mes_referencia ? ` (${p.mes_referencia})` : ""} no valor de R$ ${fmtMoeda(p.valor)} com vencimento em ${vencStr}.`;
  doc.font("Helvetica").fontSize(9).fillColor("#475569").text(declaracao, { align: "center", width: usableWidth });

  // Assinaturas
  doc.moveDown(3);
  const sigY = doc.y;
  const colWidth = usableWidth / 2 - 15;
  const col1 = doc.page.margins.left;
  const col2 = doc.page.margins.left + usableWidth / 2 + 15;

  const empresaAssinaturaBuffer = comp && comp.assinatura_imagem ? await fetchImageBuffer(resolveUrl(comp.assinatura_imagem, baseUrl)) : null;
  if (empresaAssinaturaBuffer) {
    try {
      doc.image(empresaAssinaturaBuffer, col1 + colWidth / 2 - 40, sigY - 40, { fit: [80, 35] });
    } catch {}
  }

  doc.moveTo(col1, sigY).lineTo(col1 + colWidth, sigY).strokeColor("#94a3b8").lineWidth(1).stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#1e293b")
    .text((comp && comp.name) || "Assinatura da Empresa", col1, sigY + 5, { width: colWidth, align: "center" });
  if (comp && comp.nome_responsavel) {
    doc.font("Helvetica").fontSize(8).fillColor("#64748b")
      .text(comp.nome_responsavel, col1, doc.y, { width: colWidth, align: "center" });
  }

  doc.moveTo(col2, sigY).lineTo(col2 + colWidth, sigY).strokeColor("#94a3b8").lineWidth(1).stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#1e293b")
    .text(clienteNome, col2, sigY + 5, { width: colWidth, align: "center" });
  doc.font("Helvetica").fontSize(8).fillColor("#64748b")
    .text("Assinatura do Cliente", col2, doc.y, { width: colWidth, align: "center" });

  return docToBuffer(doc);
}

module.exports = { buildPropostaPdf, buildReciboPdf };

