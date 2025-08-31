// Script para autenticar o usuário na aplicação React
// Execute este código no console do navegador na página /cozinha

(async function authenticateUser() {
  console.log('🔄 Authenticating user in React app...');
  
  try {
    // Importar o cliente Supabase (assumindo que está disponível globalmente)
    const { createClient } = window.supabase || await import('@supabase/supabase-js');
    
    const supabaseUrl = 'http://localhost:54321';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Sign in the test user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpassword123'
    });
    
    if (error) {
      console.error('❌ Authentication error:', error);
    } else {
      console.log('✅ User authenticated successfully:', data.user.id);
      console.log('🔄 Reloading page to apply authentication...');
      window.location.reload();
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
})();