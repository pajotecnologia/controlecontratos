require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("./db");

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await db.query(sql);
    console.log("Schema aplicado com sucesso.");
    process.exit(0);
  } catch (e) {
    console.error("Erro ao aplicar schema:", e.message);
    process.exit(1);
  }
})();
