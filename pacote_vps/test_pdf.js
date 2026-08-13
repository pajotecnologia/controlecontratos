require('dotenv').config();
const db = require('./db');
const { buildPropostaPdf } = require('./pdf');
const fs = require('fs');

async function main() {
  try {
    const { rows: propostas } = await db.query("SELECT * FROM propostas LIMIT 1");
    if (!propostas.length) return console.log("Nenhuma proposta no banco.");
    const p = propostas[0];
    const { rows: itens } = await db.query("SELECT * FROM proposta_itens WHERE proposta_id = $1", [p.id]);
    const { rows: comp } = await db.query("SELECT * FROM company_settings LIMIT 1");
    
    const baseUrl = "http://localhost:3001";
    console.log("Gerando PDF...");
    const pdfBuffer = await buildPropostaPdf(p, itens, comp[0] || {}, baseUrl);
    fs.writeFileSync("teste_proposta.pdf", pdfBuffer);
    console.log("PDF gerado com sucesso, tamanho:", pdfBuffer.length);
  } catch (err) {
    console.error("ERRO:", err);
  } finally {
    process.exit(0);
  }
}
main();
