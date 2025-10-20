
-- Adicionar colunas para controlar onde os produtos aparecem e se vão para o KDS
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS show_in_pdv boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_in_delivery boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS send_to_kds boolean DEFAULT true;

-- Criar tabela para vincular variações a produtos
CREATE TABLE IF NOT EXISTS product_variation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  variation_id uuid REFERENCES product_variations(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(product_id, variation_id)
);

-- Adicionar RLS na tabela de links
ALTER TABLE product_variation_links ENABLE ROW LEVEL SECURITY;

-- Política para que usuários vejam apenas seus próprios links
CREATE POLICY "Users can manage their own product variation links" ON product_variation_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_variation_links.product_id 
      AND products.user_id = auth.uid()
    )
  );

-- Atualizar tabela de pedidos para incluir variações nos itens
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS variations jsonb DEFAULT '[]'::jsonb;

-- Criar função para enviar pedidos automaticamente para o KDS
CREATE OR REPLACE FUNCTION send_order_to_kds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Verificar se o pedido tem produtos que devem ir para o KDS
  IF EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(NEW.items) AS item
    JOIN products p ON p.id = (item->>'product_id')::uuid
    WHERE p.send_to_kds = true AND p.user_id = NEW.user_id
  ) THEN
    -- Inserir no KDS
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
  
  RETURN NEW;
END;
$function$;

-- Criar trigger para enviar pedidos para o KDS automaticamente
DROP TRIGGER IF EXISTS trigger_send_to_kds ON orders;
CREATE TRIGGER trigger_send_to_kds
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION send_order_to_kds();
