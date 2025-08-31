// Script para diagnosticar erro na aceitação de pedidos
// Execute no console do navegador na página de pedidos

console.log('🔍 DIAGNÓSTICO DE ERRO NA ACEITAÇÃO DE PEDIDOS');
console.log('=' .repeat(50));

// 1. Verificar se há pedidos disponíveis
const checkOrders = () => {
  console.log('\n1. 📋 Verificando pedidos disponíveis...');
  
  // Tentar encontrar elementos de pedidos na página
  const orderElements = document.querySelectorAll('[data-testid="order-card"], .order-card, [class*="order"]');
  console.log(`   Encontrados ${orderElements.length} elementos de pedido`);
  
  // Verificar botões de aceitar
  const acceptButtons = document.querySelectorAll('button[data-testid="accept-order"], button:contains("Aceitar"), button:contains("Accept")');
  console.log(`   Encontrados ${acceptButtons.length} botões de aceitar`);
  
  return { orderElements, acceptButtons };
};

// 2. Verificar erros no console
const checkConsoleErrors = () => {
  console.log('\n2. ❌ Verificando erros recentes...');
  
  // Interceptar erros futuros
  const originalError = console.error;
  const errors = [];
  
  console.error = function(...args) {
    errors.push(args);
    originalError.apply(console, args);
  };
  
  return errors;
};

// 3. Testar função de atualização de status
const testStatusUpdate = async () => {
  console.log('\n3. 🧪 Testando função de atualização de status...');
  
  try {
    // Verificar se o Supabase está disponível
    if (typeof window.supabase === 'undefined') {
      console.log('❌ Supabase não está disponível globalmente');
      return false;
    }
    
    // Testar conexão com o banco
    const { data, error } = await window.supabase
      .from('orders')
      .select('id, order_number, status')
      .limit(1);
    
    if (error) {
      console.log('❌ Erro ao conectar com o banco:', error.message);
      return false;
    }
    
    console.log('✅ Conexão com banco OK');
    console.log('📊 Exemplo de pedido:', data[0]);
    return true;
    
  } catch (error) {
    console.log('❌ Erro no teste:', error.message);
    return false;
  }
};

// 4. Verificar autenticação
const checkAuth = () => {
  console.log('\n4. 🔐 Verificando autenticação...');
  
  try {
    // Verificar localStorage
    const authData = localStorage.getItem('supabase.auth.token');
    if (!authData) {
      console.log('❌ Token de autenticação não encontrado');
      return false;
    }
    
    console.log('✅ Token de autenticação encontrado');
    
    // Verificar se há dados do usuário
    const userData = JSON.parse(authData);
    if (userData.user) {
      console.log('✅ Usuário logado:', userData.user.email);
      return true;
    } else {
      console.log('❌ Dados do usuário não encontrados');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Erro ao verificar autenticação:', error.message);
    return false;
  }
};

// 5. Executar diagnóstico completo
const runDiagnostic = async () => {
  console.log('\n🚀 EXECUTANDO DIAGNÓSTICO COMPLETO...');
  console.log('=' .repeat(40));
  
  const results = {
    orders: checkOrders(),
    auth: checkAuth(),
    database: await testStatusUpdate(),
    errors: checkConsoleErrors()
  };
  
  console.log('\n📊 RESULTADOS DO DIAGNÓSTICO:');
  console.log('=' .repeat(30));
  console.log('• Pedidos na página:', results.orders.orderElements.length > 0 ? '✅' : '❌');
  console.log('• Botões de aceitar:', results.orders.acceptButtons.length > 0 ? '✅' : '❌');
  console.log('• Autenticação:', results.auth ? '✅' : '❌');
  console.log('• Conexão com banco:', results.database ? '✅' : '❌');
  
  console.log('\n💡 PRÓXIMOS PASSOS:');
  if (!results.auth) {
    console.log('1. ❌ Faça login novamente');
  }
  if (!results.database) {
    console.log('2. ❌ Verifique a conexão com o banco de dados');
  }
  if (results.orders.orderElements.length === 0) {
    console.log('3. ❌ Não há pedidos para aceitar');
  }
  if (results.orders.acceptButtons.length === 0) {
    console.log('4. ❌ Botões de aceitar não encontrados');
  }
  
  return results;
};

// Executar automaticamente
runDiagnostic().then(results => {
  console.log('\n✅ Diagnóstico concluído!');
  console.log('📋 Para mais detalhes, verifique os logs acima.');
}).catch(error => {
  console.error('💥 Erro no diagnóstico:', error);
});

// Exportar funções para uso manual
window.orderDiagnostic = {
  checkOrders,
  checkAuth,
  testStatusUpdate,
  runDiagnostic
};

console.log('\n🔧 COMANDOS DISPONÍVEIS:');
console.log('• orderDiagnostic.runDiagnostic() - Executar diagnóstico completo');
console.log('• orderDiagnostic.checkOrders() - Verificar pedidos na página');
console.log('• orderDiagnostic.checkAuth() - Verificar autenticação');
console.log('• orderDiagnostic.testStatusUpdate() - Testar conexão com banco');