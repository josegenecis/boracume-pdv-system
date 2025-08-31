import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gcfyrcpugmducptktjic.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZnlyY3B1Z21kdWNwdGt0amljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5MzAwNjUsImV4cCI6MjA2MzUwNjA2NX0.G9l2LEE6DtnSGChmGx5sTCQhC7yVHZJtq6rTTsti2aE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseKdsIssues() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DO KDS\n');

  // 1. Verificar estrutura da tabela kitchen_orders
  console.log('1. Verificando estrutura da tabela kitchen_orders...');
  try {
    const { data, error } = await supabase
      .from('kitchen_orders')
      .select('*')
      .limit(0);

    if (error) {
      console.log('❌ Erro ao acessar kitchen_orders:', error.message);
    } else {
      console.log('✅ Tabela kitchen_orders acessível');
    }
  } catch (err) {
    console.log('❌ Erro:', err.message);
  }

  // 2. Verificar se os campos foram adicionados
  console.log('\n2. Testando campos específicos...');
  const testFields = {
    customer_name: 'Cliente Teste',
    customer_phone: '85999999999',
    items: [{ test: 'data' }]
  };

  for (const [field, value] of Object.entries(testFields)) {
    try {
      const testData = {
        order_number: `TEST-FIELD-${field}-${Date.now()}`,
        status: 'pending',
        priority: 'normal',
        [field]: value
      };

      const { data, error } = await supabase
        .from('kitchen_orders')
        .insert(testData)
        .select();

      if (error) {
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.log(`❌ Campo "${field}" NÃO existe`);
        } else if (error.message.includes('row-level security')) {
          console.log(`⚠️  Campo "${field}" existe, mas RLS está bloqueando`);
        } else {
          console.log(`❌ Erro no campo "${field}":`, error.message);
        }
      } else {
        console.log(`✅ Campo "${field}" existe e funciona`);
        // Limpar teste
        await supabase.from('kitchen_orders').delete().eq('id', data[0].id);
      }
    } catch (err) {
      console.log(`❌ Erro no teste do campo "${field}":`, err.message);
    }
  }

  // 3. Verificar se a função existe
  console.log('\n3. Verificando função do trigger...');
  try {
    const { data, error } = await supabase.rpc('send_order_to_kds_on_accept');
    
    if (error) {
      if (error.message.includes('Could not find the function')) {
        console.log('❌ Função send_order_to_kds_on_accept NÃO existe');
      } else {
        console.log('⚠️  Função existe mas erro ao chamar:', error.message);
      }
    } else {
      console.log('✅ Função send_order_to_kds_on_accept existe');
    }
  } catch (err) {
    console.log('❌ Erro ao verificar função:', err.message);
  }

  // 4. Verificar políticas RLS
  console.log('\n4. Verificando políticas RLS...');
  try {
    // Tentar inserir com user_id válido
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('user_id')
      .limit(1);

    if (existingOrders && existingOrders.length > 0) {
      const userId = existingOrders[0].user_id;
      
      const testOrder = {
        user_id: userId,
        order_number: `TEST-RLS-${Date.now()}`,
        status: 'pending',
        priority: 'normal'
      };

      const { data, error } = await supabase
        .from('kitchen_orders')
        .insert(testOrder)
        .select();

      if (error) {
        if (error.message.includes('row-level security')) {
          console.log('❌ RLS está bloqueando inserções na kitchen_orders');
          console.log('   Solução: Execute o SQL para ajustar as políticas RLS');
        } else {
          console.log('❌ Erro RLS:', error.message);
        }
      } else {
        console.log('✅ RLS permite inserções com user_id válido');
        // Limpar teste
        await supabase.from('kitchen_orders').delete().eq('id', data[0].id);
      }
    }
  } catch (err) {
    console.log('❌ Erro no teste RLS:', err.message);
  }

  // 5. Gerar SQL de correção
  console.log('\n📋 SQL PARA CORRIGIR OS PROBLEMAS:');
  console.log('═'.repeat(80));
  
  const fixSQL = `
-- 1. Verificar e adicionar campos faltantes (se necessário)
ALTER TABLE public.kitchen_orders 
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS customer_phone text,
ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]';

-- 2. Ajustar políticas RLS para permitir inserções via trigger
DROP POLICY IF EXISTS "Users can insert their own kitchen orders" ON kitchen_orders;
CREATE POLICY "Users can insert their own kitchen orders" ON kitchen_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view their own kitchen orders" ON kitchen_orders;
CREATE POLICY "Users can view their own kitchen orders" ON kitchen_orders
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can update their own kitchen orders" ON kitchen_orders;
CREATE POLICY "Users can update their own kitchen orders" ON kitchen_orders
  FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 3. Criar/recriar a função do trigger
CREATE OR REPLACE FUNCTION send_order_to_kds_on_accept()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o status mudou para 'preparing'
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    -- Verificar se já existe um pedido no KDS para evitar duplicatas
    IF NOT EXISTS (
      SELECT 1 FROM kitchen_orders 
      WHERE order_number = NEW.order_number AND user_id = NEW.user_id
    ) THEN
      -- Verificar se há produtos que devem ir para o KDS
      IF EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(NEW.items) AS item
        JOIN products p ON p.id = (item->>'product_id')::uuid
        WHERE p.send_to_kds = true AND p.user_id = NEW.user_id
      ) THEN
        -- Inserir o pedido no KDS
        INSERT INTO kitchen_orders (
          user_id,
          order_number,
          customer_name,
          customer_phone,
          items,
          priority,
          status
        ) VALUES (
          NEW.user_id,
          NEW.order_number,
          NEW.customer_name,
          NEW.customer_phone,
          NEW.items,
          'normal',
          'pending'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar/recriar o trigger
DROP TRIGGER IF EXISTS trigger_send_to_kds_on_accept ON orders;
CREATE TRIGGER trigger_send_to_kds_on_accept
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION send_order_to_kds_on_accept();

-- 5. Verificar se tudo foi criado
SELECT 'Função criada' as status, routine_name 
FROM information_schema.routines 
WHERE routine_name = 'send_order_to_kds_on_accept';

SELECT 'Trigger criado' as status, trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_send_to_kds_on_accept';

SELECT 'Campos da tabela' as status, column_name 
FROM information_schema.columns 
WHERE table_name = 'kitchen_orders' 
AND column_name IN ('customer_name', 'customer_phone', 'items');
`;

  console.log(fixSQL);
  console.log('═'.repeat(80));

  console.log('\n🎯 INSTRUÇÕES:');
  console.log('1. Copie o SQL acima');
  console.log('2. Cole no painel SQL do Supabase');
  console.log('3. Execute o SQL');
  console.log('4. Teste novamente com: node setup-complete-kds.js');
  console.log('\n💡 O SQL acima corrige RLS + campos + função + trigger de uma vez!');
}

diagnoseKdsIssues();