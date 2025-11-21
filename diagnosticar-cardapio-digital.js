import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase (usa valores do projeto como fallback)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gcfyrcpugmducptktjic.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZnlyY3B1Z21kdWNwdGt0amljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5MzAwNjUsImV4cCI6MjA2MzUwNjA2NX0.G9l2LEE6DtnSGChmGx5sTCQhC7yVHZJtq6rTTsti2aE';

// userId fornecido na URL do cardápio digital
const TARGET_USER_ID = process.env.TARGET_USER_ID || 'd0b09aa11-29d9-4512-a541-5aba4b6f8bbb';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkConnection() {
  console.log('🔌 Testando conexão com Supabase...');
  try {
    const { data, error } = await supabase.from('restaurant_profiles').select('id').limit(1);
    if (error) {
      console.log('❌ Erro ao consultar Supabase:', error.message);
      return { ok: false, error };
    }
    console.log('✅ Conexão OK. Exemplo de acesso à tabela restaurant_profiles.\n');
    return { ok: true };
  } catch (e) {
    console.log('❌ Falha geral de conexão:', e.message);
    return { ok: false, error: e };
  }
}

async function checkProfile(userId) {
  console.log(`🔎 Verificando perfil em restaurant_profiles para user_id='${userId}'...`);
  const { data, error } = await supabase
    .from('restaurant_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.log('❌ Erro ao buscar perfil:', error.message);
    return { ok: false, error };
  }

  if (!data) {
    console.log('⚠️ Nenhum perfil encontrado para este user_id.');
    return { ok: false, reason: 'perfil_ausente' };
  }

  console.log('✅ Perfil encontrado:', {
    id: data.id,
    restaurant_name: data.restaurant_name,
    phone: data.phone,
  });
  return { ok: true, profile: data };
}

async function checkRLS(userId) {
  console.log('🔒 Validando acesso com RLS às tabelas chave...');

  // Tabelas que o menu digital usa
  const tables = [
    { name: 'restaurant_profiles', filter: { user_id: userId } },
    { name: 'products', filter: { user_id: userId, is_available: true } },
    { name: 'product_categories', filter: { user_id: userId } },
    { name: 'delivery_zones', filter: { user_id: userId } },
  ];

  const results = {};
  for (const t of tables) {
    try {
      let query = supabase.from(t.name).select('*');
      for (const [col, value] of Object.entries(t.filter)) {
        query = query.eq(col, value);
      }
      const { data, error } = await query.limit(1);
      if (error) {
        results[t.name] = { ok: false, error: error.message };
      } else {
        results[t.name] = { ok: true, sampleCount: data?.length || 0 };
      }
    } catch (e) {
      results[t.name] = { ok: false, error: e.message };
    }
  }

  Object.entries(results).forEach(([table, res]) => {
    if (res.ok) {
      console.log(`✅ RLS OK em ${table} (amostra: ${res.sampleCount})`);
    } else {
      console.log(`❌ RLS/consulta falhou em ${table}: ${res.error}`);
    }
  });
  console.log('');
  return results;
}

async function checkActiveProducts(userId) {
  console.log('🧪 Buscando produtos ativos vinculados ao restaurante...');
  const { data, error } = await supabase
    .from('products')
    .select(`*, product_variations ( id, name, price_adjustment, is_default )`)
    .eq('user_id', userId)
    .eq('is_available', true)
    .order('name');

  if (error) {
    console.log('❌ Erro ao buscar produtos:', error.message);
    return { ok: false, error };
  }

  const count = data?.length || 0;
  console.log(`✅ Produtos ativos encontrados: ${count}`);
  if (count === 0) {
    console.log('⚠️ Este restaurante não possui produtos ativos.');
  }
  return { ok: true, products: data };
}

function conclude(profileRes, rlsRes, productsRes) {
  console.log('\n📊 Conclusão de diagnóstico:');
  if (!profileRes.ok) {
    if (profileRes.reason === 'perfil_ausente') {
      console.log('- Causa provável: dados — não existe registro em restaurant_profiles para este user_id.');
    } else {
      console.log(`- Causa provável: permissão/consulta — erro ao buscar perfil: ${profileRes.error?.message || profileRes.error}`);
    }
    return 'dados';
  }

  const rlsFailures = Object.entries(rlsRes).filter(([_, v]) => !v.ok);
  if (rlsFailures.length > 0) {
    console.log('- Causa provável: RLS/permissões — existem tabelas sem acesso:', rlsFailures.map(([tbl]) => tbl).join(', '));
    return 'permissao';
  }

  if (!productsRes.ok || (productsRes.products?.length || 0) === 0) {
    console.log('- Causa possível: dados — sem produtos disponíveis para exibir.');
    return 'dados';
  }

  console.log('- Perfil, RLS e produtos OK. Problema tende a ser de código (renderização/estado).');
  return 'codigo';
}

async function run() {
  console.log('🔍 Diagnóstico do Cardápio Digital — BoraCumê');
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('UserId alvo:', TARGET_USER_ID);
  console.log('');

  const conn = await checkConnection();
  if (!conn.ok) {
    console.log('⛔ Interrompendo: sem conexão com Supabase.');
    return;
  }

  const profileRes = await checkProfile(TARGET_USER_ID);
  const rlsRes = await checkRLS(TARGET_USER_ID);
  const productsRes = await checkActiveProducts(TARGET_USER_ID);

  const cause = conclude(profileRes, rlsRes, productsRes);
  console.log(`\n✅ Diagnóstico final: ${cause.toUpperCase()}`);
}

run().catch((e) => {
  console.error('💥 Falha no diagnóstico:', e);
});
