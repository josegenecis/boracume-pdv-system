import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_KEY no .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  try {
    const { data: usersList, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
    if (error) throw error;
    const users = usersList?.users || [];
    console.log(`👥 Users (${users.length}):`);
    for (const u of users) {
      console.log(`- ${u.id} | ${u.email} | confirmed=${u.email_confirmed_at ? 'yes' : 'no'}`);
    }
    if (users.length === 0) {
      console.log('ℹ️ Nenhum usuário encontrado. Criando um usuário de teste...');
      const email = `cardapio_${Date.now()}@example.com`;
      const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (createErr) throw createErr;
      console.log('✅ Usuário criado:', created.user.id, email);
    }
  } catch (e) {
    console.error('💥 Erro ao listar/criar usuários:', e);
    process.exit(1);
  }
}

main();