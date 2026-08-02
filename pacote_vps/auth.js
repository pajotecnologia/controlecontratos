const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "troque-este-segredo-em-producao";
const JWT_EXPIRES = "30d";

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

async function isAdmin(userId) {
  const { rows } = await db.query(
    "SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin' LIMIT 1",
    [userId]
  );
  return rows.length > 0;
}

// Express middleware: verifica o JWT e popula req.user = { id, email, isAdmin }
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Não autenticado" });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, isAdmin: await isAdmin(payload.sub) };
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida" });
  }
}

module.exports = { signToken, hashPassword, verifyPassword, isAdmin, requireAuth, JWT_SECRET };
