require('dotenv').config();
const db = require('./db');

async function main() {
  try {
    await db.query(`ALTER TABLE propostas ADD COLUMN IF NOT EXISTS observacoes text DEFAULT '';`);
    console.log("Column 'observacoes' added successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
