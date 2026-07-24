import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import sequelize from '../src/config/database.js';

try {
  if (process.env.ALLOW_SCHEMA_MIGRATION !== 'true') throw new Error('ALLOW_SCHEMA_MIGRATION=true is required');
  await sequelize.query(fs.readFileSync(path.resolve('migrations/001_governed_ecommerce_fulfillment.sql'), 'utf8'));
  await sequelize.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL, role VARCHAR(30) NOT NULL DEFAULT 'user', avatar VARCHAR(255),
    "resetToken" VARCHAR(255), "resetTokenExpiry" TIMESTAMPTZ, "lastLogin" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await sequelize.query(`CREATE TABLE IF NOT EXISTS ecommerce_runtime_ai_results (
    id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), input JSONB NOT NULL,
    result JSONB NOT NULL, model TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const email = String(process.env.PROVISION_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.PROVISION_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '');
  if (!email || password.length < 12) throw new Error('Runtime administrator credentials are required');
  await sequelize.query(
    `INSERT INTO users(email,password,name,role,"createdAt","updatedAt") VALUES($1,$2,$3,'admin',NOW(),NOW())
     ON CONFLICT(email) DO UPDATE SET password=EXCLUDED.password,name=EXCLUDED.name,role='admin',"updatedAt"=NOW()`,
    { bind: [email, await bcrypt.hash(password, 12), 'Runtime Administrator'] },
  );
} finally { await sequelize.close(); }
