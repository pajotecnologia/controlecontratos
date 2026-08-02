// Cria (ou promove) um usuário administrador no banco.
// Uso: node create-admin.js <email> <senha>
// Exemplo: node create-admin.js admin@empresa.com MinhaS3nha!

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { hashPassword } = require("./auth");
const db = require("./db");

const [,, email, password] = process.argv;

if (!email || !password) {
  console.error("Uso: node create-admin.js <email> <senha>");
  process.exit(1);
}

if (password.length < 6) {
  console.error("Senha muito curta (mínimo 6 caracteres).");
  process.exit(1);
}

(async () => {
  try {
    // Verifica se o usuário já existe
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);

    let userId;

    if (existing.rows.length > 0) {
      // Usuário já existe — apenas atualiza a senha e garante papel admin
      userId = existing.rows[0].id;
      const hash = await hashPassword(password);
      await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, userId]);
      console.log(`Usuário existente encontrado: ${email}`);
      console.log("Senha atualizada.");
    } else {
      // Cria o usuário do zero
      const hash = await hashPassword(password);
      const { rows } = await db.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [email, hash]
      );
      userId = rows[0].id;

      // Cria o perfil
      await db.query(
        "INSERT INTO profiles (user_id, full_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
        [userId, email.split("@")[0]]
      );

      console.log(`Usuário criado: ${email}`);
    }

    // Garante papel admin (insere se não existir)
    await db.query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT (user_id, role) DO NOTHING",
      [userId]
    );

    console.log("Papel 'admin' garantido.");
    console.log("---");
    console.log(`Acesso: ${email} / ${password}`);
    console.log("Pronto! Usuário administrador configurado.");
    process.exit(0);
  } catch (e) {
    console.error("Erro:", e.message);
    process.exit(1);
  }
})();
