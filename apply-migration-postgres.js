import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const MIGRATION_FILE = process.env.MIGRATION_FILE || 'supabase/migrations/setup_digital_menu.sql';

const {
  SUPABASE_DB_HOST,
  SUPABASE_DB_NAME,
  SUPABASE_DB_USER,
  SUPABASE_DB_PASSWORD,
  SUPABASE_DB_PORT,
} = process.env;

if (!SUPABASE_DB_HOST || !SUPABASE_DB_USER || !SUPABASE_DB_PASSWORD) {
  console.error('❌ Configure SUPABASE_DB_HOST, SUPABASE_DB_USER e SUPABASE_DB_PASSWORD no .env');
  process.exit(1);
}

const sqlPath = path.resolve(MIGRATION_FILE);
if (!fs.existsSync(sqlPath)) {
  console.error(`❌ Migration não encontrada: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf-8');

const client = new Client({
  host: SUPABASE_DB_HOST,
  database: SUPABASE_DB_NAME || 'postgres',
  user: SUPABASE_DB_USER || 'postgres',
  password: SUPABASE_DB_PASSWORD,
  port: Number(SUPABASE_DB_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('🚀 Aplicando migration via PostgreSQL:', sqlPath);
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration aplicada com sucesso.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('💥 Falha ao aplicar migration:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error('💥 Erro inesperado:', e);
  process.exit(1);
});