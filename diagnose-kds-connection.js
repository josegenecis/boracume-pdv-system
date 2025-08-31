// Script para diagnosticar problemas de conexão do KDS
import { createClient } from '@supabase/supabase-js';

// Configurações locais e remotas
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const REMOTE_URL = 'https://gcfyrcpugmducptktjic.supabase.co';
const REMOTE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZnlyY3B1Z21kdWNwdGt0amljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5MzAwNjUsImV4cCI6MjA2MzUwNjA2NX0.G9l2LEE6DtnSGChmGx5sTCQhC7yVHZJtq6rTTsti2aE';

async function diagnoseKDSConnection() {
  console.log('🔍 Diagnosticando conexão do KDS...\n');

  // Testar conexão local
  console.log('📍 TESTANDO CONEXÃO LOCAL:');
  const localClient = createClient(LOCAL_URL, LOCAL_KEY);
  
  try {
    const { data: localOrders, error: localError } = await localClient
      .from('kitchen_orders')
      .select('*')
      .limit(5);
    
    if (localError) {
      console.log('❌ Erro na conexão local:', localError.message);
    } else {
      console.log(`✅ Conexão local OK - ${localOrders?.length || 0} pedidos encontrados`);
      if (localOrders && localOrders.length > 0) {
        console.log('📋 Pedidos locais:', localOrders.map(o => `${o.order_number} (${o.status})`));
      }
    }
  } catch (err) {
    console.log('❌ Erro na conexão local:', err.message);
  }

  console.log('\n📍 TESTANDO CONEXÃO REMOTA:');
  const remoteClient = createClient(REMOTE_URL, REMOTE_KEY);
  
  try {
    const { data: remoteOrders, error: remoteError } = await remoteClient
      .from('kitchen_orders')
      .select('*')
      .limit(5);
    
    if (remoteError) {
      console.log('❌ Erro na conexão remota:', remoteError.message);
    } else {
      console.log(`✅ Conexão remota OK - ${remoteOrders?.length || 0} pedidos encontrados`);
      if (remoteOrders && remoteOrders.length > 0) {
        console.log('📋 Pedidos remotos:', remoteOrders.map(o => `${o.order_number} (${o.status})`));
      }
    }
  } catch (err) {
    console.log('❌ Erro na conexão remota:', err.message);
  }

  // Verificar produtos com send_to_kds
  console.log('\n🍽️ VERIFICANDO PRODUTOS COM SEND_TO_KDS:');
  
  try {
    const { data: localProducts, error: localProdError } = await localClient
      .from('products')
      .select('id, name, send_to_kds')
      .eq('send_to_kds', true)
      .limit(10);
    
    if (localProdError) {
      console.log('❌ Erro ao buscar produtos locais:', localProdError.message);
    } else {
      console.log(`📦 Produtos locais com send_to_kds=true: ${localProducts?.length || 0}`);
      if (localProducts && localProducts.length > 0) {
        localProducts.forEach(p => console.log(`  - ${p.name} (${p.id})`));
      }
    }
  } catch (err) {
    console.log('❌ Erro ao buscar produtos locais:', err.message);
  }

  try {
    const { data: remoteProducts, error: remoteProdError } = await remoteClient
      .from('products')
      .select('id, name, send_to_kds')
      .eq('send_to_kds', true)
      .limit(10);
    
    if (remoteProdError) {
      console.log('❌ Erro ao buscar produtos remotos:', remoteProdError.message);
    } else {
      console.log(`📦 Produtos remotos com send_to_kds=true: ${remoteProducts?.length || 0}`);
      if (remoteProducts && remoteProducts.length > 0) {
        remoteProducts.forEach(p => console.log(`  - ${p.name} (${p.id})`));
      }
    }
  } catch (err) {
    console.log('❌ Erro ao buscar produtos remotos:', err.message);
  }

  // Verificar pedidos normais
  console.log('\n📋 VERIFICANDO PEDIDOS NORMAIS:');
  
  try {
    const { data: localNormalOrders, error: localOrderError } = await localClient
      .from('orders')
      .select('id, order_number, status, items')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (localOrderError) {
      console.log('❌ Erro ao buscar pedidos locais:', localOrderError.message);
    } else {
      console.log(`📋 Pedidos normais locais: ${localNormalOrders?.length || 0}`);
      if (localNormalOrders && localNormalOrders.length > 0) {
        localNormalOrders.forEach(o => console.log(`  - ${o.order_number} (${o.status})`));
      }
    }
  } catch (err) {
    console.log('❌ Erro ao buscar pedidos locais:', err.message);
  }

  try {
    const { data: remoteNormalOrders, error: remoteOrderError } = await remoteClient
      .from('orders')
      .select('id, order_number, status, items')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (remoteOrderError) {
      console.log('❌ Erro ao buscar pedidos remotos:', remoteOrderError.message);
    } else {
      console.log(`📋 Pedidos normais remotos: ${remoteNormalOrders?.length || 0}`);
      if (remoteNormalOrders && remoteNormalOrders.length > 0) {
        remoteNormalOrders.forEach(o => console.log(`  - ${o.order_number} (${o.status})`));
      }
    }
  } catch (err) {
    console.log('❌ Erro ao buscar pedidos remotos:', err.message);
  }

  // Verificar triggers
  console.log('\n⚙️ VERIFICANDO TRIGGERS:');
  
  try {
    const { data: triggers, error: triggerError } = await localClient
      .rpc('sql', { 
        query: `
          SELECT trigger_name, event_manipulation, event_object_table 
          FROM information_schema.triggers 
          WHERE trigger_name LIKE '%kds%' OR trigger_name LIKE '%send%'
        `
      });
    
    if (triggerError) {
      console.log('❌ Erro ao verificar triggers:', triggerError.message);
    } else {
      console.log(`⚙️ Triggers encontrados: ${triggers?.length || 0}`);
      if (triggers && triggers.length > 0) {
        triggers.forEach(t => console.log(`  - ${t.trigger_name} on ${t.event_object_table} (${t.event_manipulation})`));
      }
    }
  } catch (err) {
    console.log('❌ Erro ao verificar triggers:', err.message);
  }

  console.log('\n🎯 DIAGNÓSTICO CONCLUÍDO!');
  console.log('\n💡 PRÓXIMOS PASSOS:');
  console.log('1. Verificar qual URL está sendo usada na aplicação');
  console.log('2. Confirmar se os produtos têm send_to_kds=true');
  console.log('3. Testar criação de pedido real');
  console.log('4. Verificar se o trigger está funcionando');
}

diagnoseKDSConnection().catch(console.error);