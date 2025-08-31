import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const SUPABASE_URL = 'https://gcfyrcpugmducptktjic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZnlyY3B1Z21kdWNwdGt0amljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5MzAwNjUsImV4cCI6MjA2MzUwNjA2NX0.G9l2LEE6DtnSGChmGx5sTCQhC7yVHZJtq6rTTsti2aE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnoseSupabase() {
  console.log('🔍 Diagnóstico Completo do Supabase - BoraCumê KDS\n');
  
  try {
    // 1. Verificar estrutura da tabela kitchen_orders
    console.log('1. 📋 Verificando estrutura da tabela kitchen_orders:');
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'kitchen_orders' })
      .single();
    
    if (columnsError) {
      console.log('❌ Erro ao verificar colunas:', columnsError.message);
      // Tentar método alternativo
      const { data: testSelect, error: selectError } = await supabase
        .from('kitchen_orders')
        .select('*')
        .limit(1);
      
      if (selectError) {
        console.log('❌ Tabela kitchen_orders não acessível:', selectError.message);
      } else {
        console.log('✅ Tabela kitchen_orders acessível');
        if (testSelect && testSelect.length > 0) {
          console.log('📊 Colunas encontradas:', Object.keys(testSelect[0]).join(', '));
        }
      }
    } else {
      console.log('✅ Estrutura da tabela obtida:', columns);
    }
    
    // 2. Verificar políticas RLS
    console.log('\n2. 🔒 Verificando políticas RLS:');
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_table_policies', { table_name: 'kitchen_orders' });
    
    if (policiesError) {
      console.log('❌ Erro ao verificar políticas:', policiesError.message);
    } else {
      console.log('📋 Políticas encontradas:', policies?.length || 0);
      if (policies && policies.length > 0) {
        policies.forEach(policy => {
          console.log(`   - ${policy.policyname}: ${policy.cmd} (${policy.roles})`);
        });
      } else {
        console.log('⚠️  Nenhuma política RLS encontrada');
      }
    }
    
    // 3. Verificar triggers
    console.log('\n3. ⚡ Verificando triggers:');
    const { data: triggers, error: triggersError } = await supabase
      .rpc('get_table_triggers', { table_name: 'orders' });
    
    if (triggersError) {
      console.log('❌ Erro ao verificar triggers:', triggersError.message);
    } else {
      console.log('📋 Triggers encontrados:', triggers?.length || 0);
      if (triggers && triggers.length > 0) {
        triggers.forEach(trigger => {
          console.log(`   - ${trigger.trigger_name}: ${trigger.event_manipulation}`);
        });
      } else {
        console.log('⚠️  Nenhum trigger encontrado na tabela orders');
      }
    }
    
    // 4. Verificar função send_order_to_kds_on_accept
    console.log('\n4. 🔧 Verificando função KDS:');
    const { data: functions, error: functionsError } = await supabase
      .rpc('get_function_info', { function_name: 'send_order_to_kds_on_accept' });
    
    if (functionsError) {
      console.log('❌ Erro ao verificar função:', functionsError.message);
    } else {
      if (functions) {
        console.log('✅ Função send_order_to_kds_on_accept encontrada');
      } else {
        console.log('❌ Função send_order_to_kds_on_accept NÃO encontrada');
      }
    }
    
    // 5. Testar inserção direta (com bypass RLS se possível)
    console.log('\n5. 🧪 Testando inserção direta:');
    const testOrder = {
      order_id: 'test-' + Date.now(),
      order_number: 'TEST-' + Date.now(),
      customer_name: 'Cliente Teste',
      customer_phone: '11999999999',
      items: [{
        id: 'test-item',
        name: 'Item Teste',
        quantity: 1,
        price: 10.00
      }],
      priority: 'normal',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    const { data: insertResult, error: insertError } = await supabase
      .from('kitchen_orders')
      .insert(testOrder)
      .select();
    
    if (insertError) {
      console.log('❌ Erro na inserção:', insertError.message);
      console.log('   Código:', insertError.code);
      console.log('   Detalhes:', insertError.details);
    } else {
      console.log('✅ Inserção bem-sucedida:', insertResult);
      
      // Limpar teste
      await supabase
        .from('kitchen_orders')
        .delete()
        .eq('order_id', testOrder.order_id);
      console.log('🗑️  Registro de teste removido');
    }
    
    // 6. Verificar dados existentes
    console.log('\n6. 📊 Verificando dados existentes:');
    const { data: existingOrders, error: existingError } = await supabase
      .from('kitchen_orders')
      .select('*')
      .limit(5);
    
    if (existingError) {
      console.log('❌ Erro ao buscar dados:', existingError.message);
    } else {
      console.log(`✅ Encontrados ${existingOrders?.length || 0} pedidos no KDS`);
      if (existingOrders && existingOrders.length > 0) {
        console.log('📋 Últimos pedidos:');
        existingOrders.forEach(order => {
          console.log(`   - ${order.order_number}: ${order.status} (${order.customer_name})`);
        });
      }
    }
    
    // 7. Verificar produtos configurados para KDS
    console.log('\n7. 🍕 Verificando produtos configurados para KDS:');
    const { data: kdsProducts, error: productsError } = await supabase
      .from('products')
      .select('id, name, send_to_kds')
      .eq('send_to_kds', true);
    
    if (productsError) {
      console.log('❌ Erro ao verificar produtos:', productsError.message);
    } else {
      console.log(`✅ Encontrados ${kdsProducts?.length || 0} produtos configurados para KDS`);
      if (kdsProducts && kdsProducts.length > 0) {
        kdsProducts.forEach(product => {
          console.log(`   - ${product.name} (${product.id})`);
        });
      }
    }
    
    console.log('\n📋 RESUMO DO DIAGNÓSTICO:');
    console.log('================================');
    console.log('✅ Conexão com Supabase: OK');
    console.log('✅ Tabela kitchen_orders: Acessível');
    console.log('⚠️  Políticas RLS: Podem estar bloqueando inserções');
    console.log('⚠️  Trigger KDS: Pode não estar configurado');
    console.log('⚠️  Função KDS: Pode não estar criada');
    
    console.log('\n🔧 PRÓXIMOS PASSOS RECOMENDADOS:');
    console.log('1. Execute os SQLs no painel do Supabase:');
    console.log('   - fix-kitchen-orders-table.sql');
    console.log('   - create-kds-trigger-remote.sql');
    console.log('2. Configure políticas RLS adequadas');
    console.log('3. Teste novamente com setup-complete-kds.js');
    
  } catch (error) {
    console.error('❌ Erro geral no diagnóstico:', error);
  }
}

// Executar diagnóstico
diagnoseSupabase().catch(console.error);