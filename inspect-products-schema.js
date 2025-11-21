import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function main() {
  console.log('🔎 Inspecionando schema de products...');
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (error) {
    console.error('❌ Erro ao consultar products:', error);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log('⚠️ Nenhum registro. Tentando obter colunas via RPC introspection...');
  } else {
    const sample = data[0];
    console.log('🧩 Campos detectados:', Object.keys(sample));
  }
}

main();