// Script para testar manualmente a aceitação de pedidos
// Execute no console do navegador na página de pedidos

console.log('🧪 TESTE MANUAL DE ACEITAÇÃO DE PEDIDOS');
console.log('=' .repeat(50));

// Função para simular clique no botão de aceitar
const testAcceptOrder = async () => {
  console.log('\n1. 🔍 Procurando botões de aceitar pedido...');
  
  // Diferentes seletores possíveis para botões de aceitar
  const selectors = [
    'button[data-testid="accept-order"]',
    'button:contains("Aceitar")',
    'button:contains("Accept")',
    'button[class*="accept"]',
    'button[onclick*="accept"]',
    '.accept-button',
    '[data-action="accept"]'
  ];
  
  let acceptButton = null;
  
  for (const selector of selectors) {
    const buttons = document.querySelectorAll(selector);
    if (buttons.length > 0) {
      acceptButton = buttons[0];
      console.log(`✅ Encontrado botão com seletor: ${selector}`);
      break;
    }
  }
  
  if (!acceptButton) {
    // Procurar por texto
    const allButtons = document.querySelectorAll('button');
    for (const button of allButtons) {
      if (button.textContent.toLowerCase().includes('aceitar') || 
          button.textContent.toLowerCase().includes('accept')) {
        acceptButton = button;
        console.log('✅ Encontrado botão por texto:', button.textContent);
        break;
      }
    }
  }
  
  if (!acceptButton) {
    console.log('❌ Nenhum botão de aceitar encontrado');
    console.log('💡 Botões disponíveis na página:');
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach((btn, index) => {
      console.log(`   ${index + 1}. "${btn.textContent.trim()}" - ${btn.className}`);
    });
    return false;
  }
  
  console.log('\n2. 🖱️  Simulando clique no botão...');
  
  try {
    // Interceptar erros antes do clique
    const errors = [];
    const originalError = console.error;
    console.error = function(...args) {
      errors.push(args);
      originalError.apply(console, args);
    };
    
    // Simular clique
    acceptButton.click();
    
    // Aguardar um pouco para ver se há erros
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Restaurar console.error
    console.error = originalError;
    
    if (errors.length > 0) {
      console.log('❌ Erros capturados durante o clique:');
      errors.forEach((error, index) => {
        console.log(`   ${index + 1}.`, ...error);
      });
      return false;
    } else {
      console.log('✅ Clique executado sem erros visíveis');
      return true;
    }
    
  } catch (error) {
    console.log('❌ Erro ao clicar no botão:', error.message);
    return false;
  }
};

// Função para verificar mudanças na página após aceitar
const checkPageChanges = () => {
  console.log('\n3. 👀 Verificando mudanças na página...');
  
  // Verificar se há mensagens de sucesso/erro
  const toasts = document.querySelectorAll('[data-testid="toast"], .toast, [class*="toast"]');
  if (toasts.length > 0) {
    console.log('📢 Mensagens encontradas:');
    toasts.forEach((toast, index) => {
      console.log(`   ${index + 1}. ${toast.textContent.trim()}`);
    });
  } else {
    console.log('📢 Nenhuma mensagem de toast encontrada');
  }
  
  // Verificar se há modais abertos
  const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"]');
  if (modals.length > 0) {
    console.log('🪟 Modais encontrados:');
    modals.forEach((modal, index) => {
      console.log(`   ${index + 1}. ${modal.textContent.substring(0, 100)}...`);
    });
  }
  
  // Verificar se há elementos de loading
  const loadings = document.querySelectorAll('[data-testid="loading"], .loading, [class*="loading"]');
  if (loadings.length > 0) {
    console.log('⏳ Elementos de loading encontrados:', loadings.length);
  }
};

// Função para verificar o estado do Supabase
const checkSupabaseState = async () => {
  console.log('\n4. 🗄️  Verificando estado do Supabase...');
  
  try {
    // Verificar se o cliente Supabase está disponível
    if (typeof window.supabase === 'undefined') {
      console.log('❌ Cliente Supabase não encontrado');
      return false;
    }
    
    // Verificar sessão atual
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
    
    if (sessionError) {
      console.log('❌ Erro ao obter sessão:', sessionError.message);
      return false;
    }
    
    if (!session) {
      console.log('❌ Usuário não está logado');
      return false;
    }
    
    console.log('✅ Usuário logado:', session.user.email);
    
    // Testar consulta simples
    const { data, error } = await window.supabase
      .from('orders')
      .select('id, order_number, status')
      .limit(1);
    
    if (error) {
      console.log('❌ Erro ao consultar pedidos:', error.message);
      return false;
    }
    
    console.log('✅ Conexão com banco OK');
    return true;
    
  } catch (error) {
    console.log('❌ Erro geral no Supabase:', error.message);
    return false;
  }
};

// Função principal de teste
const runOrderAcceptanceTest = async () => {
  console.log('\n🚀 INICIANDO TESTE COMPLETO...');
  console.log('=' .repeat(40));
  
  const results = {
    supabase: await checkSupabaseState(),
    buttonClick: await testAcceptOrder(),
    pageChanges: checkPageChanges()
  };
  
  console.log('\n📊 RESULTADOS DO TESTE:');
  console.log('=' .repeat(25));
  console.log('• Estado do Supabase:', results.supabase ? '✅ OK' : '❌ ERRO');
  console.log('• Clique no botão:', results.buttonClick ? '✅ OK' : '❌ ERRO');
  
  console.log('\n💡 RECOMENDAÇÕES:');
  if (!results.supabase) {
    console.log('1. ❌ Verifique a conexão com o banco de dados');
    console.log('2. ❌ Faça login novamente se necessário');
  }
  if (!results.buttonClick) {
    console.log('3. ❌ Verifique se há pedidos para aceitar');
    console.log('4. ❌ Verifique os logs de erro no console');
  }
  
  return results;
};

// Função para monitorar requisições de rede
const monitorNetworkRequests = () => {
  console.log('\n5. 🌐 Monitorando requisições de rede...');
  
  const originalFetch = window.fetch;
  const requests = [];
  
  window.fetch = function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    console.log('📡 Requisição:', options.method || 'GET', url);
    
    return originalFetch.apply(this, args)
      .then(response => {
        console.log('📡 Resposta:', response.status, url);
        if (!response.ok) {
          console.log('❌ Erro na resposta:', response.statusText);
        }
        return response;
      })
      .catch(error => {
        console.log('❌ Erro na requisição:', error.message, url);
        throw error;
      });
  };
  
  // Restaurar após 30 segundos
  setTimeout(() => {
    window.fetch = originalFetch;
    console.log('🔄 Monitoramento de rede desativado');
  }, 30000);
  
  console.log('✅ Monitoramento de rede ativado por 30 segundos');
};

// Executar teste automaticamente
runOrderAcceptanceTest().then(results => {
  console.log('\n✅ Teste concluído!');
  console.log('🔧 Para monitorar requisições, execute: monitorNetworkRequests()');
}).catch(error => {
  console.error('💥 Erro no teste:', error);
});

// Exportar funções para uso manual
window.orderTest = {
  testAcceptOrder,
  checkPageChanges,
  checkSupabaseState,
  runOrderAcceptanceTest,
  monitorNetworkRequests
};

console.log('\n🔧 COMANDOS DISPONÍVEIS:');
console.log('• orderTest.runOrderAcceptanceTest() - Executar teste completo');
console.log('• orderTest.testAcceptOrder() - Testar clique no botão');
console.log('• orderTest.checkSupabaseState() - Verificar Supabase');
console.log('• orderTest.monitorNetworkRequests() - Monitorar requisições');