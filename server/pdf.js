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
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
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
  doc.moveDown(2);
  const sigY = doc.y;
  const colWidth = usableWidth / 2 - 15;
  const col1 = doc.page.margins.left;
  const col2 = doc.page.margins.left + usableWidth / 2 + 15;

  const empresaAssinaturaBuffer = comp.assinatura_imagem ? await fetchImageBuffer(comp.assinatura_imagem) : null;
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

  if (comp && comp.name) {
    await drawCabecalhoEmpresa(doc, comp, baseUrl);
  }

  doc.font("Helvetica-Bold").fontSize(16).text("Recibo de Pagamento", { align: "center" });
  doc.moveDown(1.5);

  const clienteNome = p.cliente_nome || p.venda_cliente || "";
  const valor = fmtMoeda(p.valor);
  const vencimento = fmtData(p.data_vencimento);
  const pagamento = p.data_pagamento ? fmtData(p.data_pagamento) : "-";

  const boxY = doc.y;
  const rows = [
    ["Cliente:", clienteNome],
    ["Parcela:", String(p.numero_parcela)],
    ["Valor:", `R$ ${valor}`],
    ["Vencimento:", vencimento],
    ["Data do Pagamento:", pagamento],
  ];
  if (p.mes_referencia) rows.push(["Mês de Referência:", p.mes_referencia]);
  if (p.numero_nf) rows.push(["N.F.:", p.numero_nf]);

  doc.font("Helvetica").fontSize(11);
  let y = boxY + 15;
  rows.forEach(([label, value]) => {
    doc.font("Helvetica-Bold").text(label, doc.page.margins.left + 15, y, { continued: true, width: 160 });
    doc.font("Helvetica").text(` ${value}`);
    y = doc.y + 6;
  });
  doc.rect(doc.page.margins.left, boxY, usableWidth, y - boxY + 10)
    .strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.y = y + 25;

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#059669")
    .text("Pagamento confirmado. Obrigado!", { align: "center" });

  return docToBuffer(doc);
}

module.exports = { buildPropostaPdf, buildReciboPdf };
