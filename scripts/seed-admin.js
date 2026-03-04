// Seed admin user - run with: node scripts/seed-admin.js
// Requires: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME env vars
const { Pool } = require('pg')
const bcrypt = require('bcrypt')

async function seed() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'exam_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  })
  const hash = await bcrypt.hash('Admin123!', 10)
  await pool.query(
    "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET password_hash = $2",
    ['admin@exam.local', hash, 'Admin', 'admin']
  )
  console.log('Admin user seeded: admin@exam.local / Admin123!')
  await pool.end()
}
seed().catch(console.error)
