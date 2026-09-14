/**
 * Ejecuta el archivo schema.sql contra la base de datos configurada en .env
 * Uso: npm run db:init
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function init() {
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    console.log('Conectando a PostgreSQL y aplicando schema.sql ...');
    await pool.query(sql);
    console.log('✔ Base de datos inicializada correctamente.');
  } catch (err) {
    console.error('✘ Error al inicializar la base de datos:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

init();
