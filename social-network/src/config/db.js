/**
 * Pool de conexiones a PostgreSQL.
 * Todas las consultas del proyecto pasan por aqui usando parametros ($1, $2...)
 * para evitar inyeccion SQL.
 */
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

module.exports = {
  pool,
  // Helper para consultas simples
  query: (text, params) => pool.query(text, params),
  // Helper para transacciones
  getClient: () => pool.connect()
};
