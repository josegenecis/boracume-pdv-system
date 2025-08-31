import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gcfyrcpugmducptktjic.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZnlyY3B1Z21kdWNwdGt0amljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzkzMDA2NSwiZXhwIjoyMDYzNTA2MDY1fQ.LaXjix_br8GGpv01ZkH2l83GHHVZo9CTdSJqvSpD9LQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function executarSQL(sql, descricao) {
  console.log(`\n🔄 Executando: ${descricao}`);
  console.log('=' .repeat(50));
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Sucesso:', data);
    return data;
  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  }
}

async function configurarKDS() {
  console.log('🚀 INICIANDO CONFIGURAÇÃO DO KDS NO SUPABASE');
  console.log('=' .repeat(60));

  try {
    // Primeiro, vamos verificar se a tabela kitchen_orders existe
    console.log('\n🔍 Verificando estrutura atual...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'kitchen_orders');
    
    if (tablesError) {
      console.log('⚠️  Não foi possível verificar tabelas via REST API');
    } else {
      console.log('📋 Tabelas encontradas:', tables);
    }

    // Tentar criar a tabela kitchen_orders diretamente
    console.log('\n🔧 Criando/verificando tabela kitchen_orders...');
    
    const { error: createError } = await supabase
      .from('kitchen_orders')
      .select('*')
      .limit(1);
    
    if (createError && createError.code === 'PGRST116') {
      console.log('❌ Tabela kitchen_orders não existe. Precisa ser criada manualmente.');
      throw new Error('Tabela kitchen_orders não encontrada');
    }
    
    console.log('✅ Tabela kitchen_orders encontrada!');

    // Verificar se o trigger existe
    console.log('\n🔍 Verificando triggers...');
    
    const { data: triggers, error: triggersError } = await supabase
      .from('information_schema.triggers')
      .select('trigger_name')
      .eq('trigger_name', 'trigger_send_to_kds_on_accept');
    
    if (triggersError) {
      console.log('⚠️  Não foi possível verificar triggers via REST API');
    } else {
      console.log('🎯 Triggers encontrados:', triggers);
    }

    console.log('\n🎉 VERIFICAÇÃO CONCLUÍDA!');
    console.log('=' .repeat(60));
    console.log('\n📝 PRÓXIMOS PASSOS MANUAIS:');
    console.log('1. Acesse o SQL Editor do Supabase: https://supabase.com/dashboard/project/gcfyrcpugmducptktjic/sql');
    console.log('2. Execute os seguintes scripts na ordem:');
    console.log('   📄 fix-kitchen-orders-table.sql');
    console.log('   📄 create-kds-trigger-simple.sql');
    console.log('\n🔥 Após executar os scripts, o KDS estará funcionando!');

  } catch (error) {
    console.error('\n💥 ERRO NA CONFIGURAÇÃO:', error.message);
    console.log('\n📝 SOLUÇÃO MANUAL NECESSÁRIA:');
    console.log('=' .repeat(50));
    console.log('1. 🌐 Acesse: https://supabase.com/dashboard/project/gcfyrcpugmducptktjic/sql');
    console.log('2. 📋 Execute primeiro: fix-kitchen-orders-table.sql');
    console.log('3. 📋 Execute depois: create-kds-trigger-simple.sql');
    console.log('\n✨ Scripts disponíveis no projeto!');
  }
}

// Executar configuração
configurarKDS();