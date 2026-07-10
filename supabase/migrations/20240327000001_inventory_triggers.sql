
-- Função para dar baixa no estoque quando um pedido é concluído
CREATE OR REPLACE FUNCTION process_order_inventory_deduction()
RETURNS TRIGGER AS \$\$
DECLARE
    item RECORD;
    recipe_item RECORD;
BEGIN
    -- Só processa se o status mudou para 'completed'
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        
        -- Loop pelos itens do pedido
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
            -- Pega o product_id do item (assumindo que o JSON tem a chave id ou product_id)
            DECLARE
                p_id UUID := (item.value->>'id')::UUID;
                p_qty INTEGER := (item.value->>'quantity')::INTEGER;
            BEGIN
                IF p_id IS NOT NULL THEN
                    -- Busca a ficha técnica do produto
                    FOR recipe_item IN 
                        SELECT ingredient_id, quantity 
                        FROM public.product_recipes 
                        WHERE product_id = p_id 
                    LOOP
                        -- Insere a movimentação de saída
                        INSERT INTO public.stock_movements (
                            user_id, ingredient_id, movement_type, quantity, reason, order_id
                        ) VALUES (
                            NEW.user_id, 
                            recipe_item.ingredient_id, 
                            'sale', 
                            recipe_item.quantity * p_qty, 
                            'Venda de produto: ' || p_id, 
                            NEW.id
                        );

                        -- Atualiza o estoque atual
                        UPDATE public.ingredients
                        SET current_stock = current_stock - (recipe_item.quantity * p_qty),
                            updated_at = NOW()
                        WHERE id = recipe_item.ingredient_id;
                    END LOOP;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Ignora erros de parsing de JSON se o formato for diferente
                CONTINUE;
            END;
        END LOOP;
    END IF;
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o Trigger na tabela orders
DROP TRIGGER IF EXISTS order_inventory_trigger ON public.orders;
CREATE TRIGGER order_inventory_trigger
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION process_order_inventory_deduction();

