// Aplica migrate.sql no banco existente (seguro para rodar múltiplas vezes)
// Uso: node migrate.js

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const fs = require("fs");
const path = require("path");
const db = require("./db");

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "migrate.sql"), "utf8");
    await db.query(sql);
    console.log("✅ Migração aplicada com sucesso!");
    process.exit(0);
  } catch (e) {
    console.error("❌ Erro ao aplicar migração:", e.message);
    process.exit(1);
  }
})();
