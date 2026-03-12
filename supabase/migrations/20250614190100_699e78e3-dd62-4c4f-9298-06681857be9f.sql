-- Adicionar variações mais completas para teste do açaí
INSERT INTO product_variations (product_id, name, required, max_selections, options, user_id) VALUES
-- Variação obrigatória para tamanho
('bd749beb-2d6c-4bbe-bd67-87d110562505', 'Tamanho', true, 1, '[
  {"name": "300ml", "price": 0},
  {"name": "500ml", "price": 5.00},
  {"name": "700ml", "price": 8.00}
]', '6b09aa11-29d9-4512-a541-54aba86f3bbb'),

-- Variação opcional para complementos
('bd749beb-2d6c-4bbe-bd67-87d110562505', 'Complementos', false, 3, '[
  {"name": "Granola", "price": 2.50},
  {"name": "Leite Condensado", "price": 1.50},
  {"name": "Mel", "price": 1.00},
  {"name": "Castanhas", "price": 3.00},
  {"name": "Frutas Vermelhas", "price": 4.00}
]', '6b09aa11-29d9-4512-a541-54aba86f3bbb'),

-- Variação obrigatória para frutas
('bd749beb-2d6c-4bbe-bd67-87d110562505', 'Frutas Incluídas', true, 2, '[
  {"name": "Banana", "price": 0},
  {"name": "Morango", "price": 2.00},
  {"name": "Kiwi", "price": 2.50},
  {"name": "Manga", "price": 1.50},
  {"name": "Abacaxi", "price": 1.00}
]', '6b09aa11-29d9-4512-a541-54aba86f3bbb');