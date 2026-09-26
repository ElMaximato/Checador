// Uso (desde apps/backend): node scripts/crearAdmin.js "Nombre" correo contraseña
require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

(async () => {
  const [nombre, email, password] = process.argv.slice(2);
  if (!nombre || !email || !password) {
    console.log('Uso: node scripts/crearAdmin.js "Nombre" correo contraseña');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query("INSERT INTO admins (nombre, email, password_hash, rol) VALUES (?, ?, ?, 'super_admin')", [nombre, email, hash]);
  console.log("Administrador creado:", email);
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
