-- Atualiza os valores comerciais públicos. Assinaturas já contratadas mantêm o
-- valor registrado na cobrança vigente; os novos valores valem para novos
-- checkouts, trocas de plano e alterações de quantidade de lojas.
update public.subscription_plans
set
  price = case id
    when 1 then 189.00
    when 2 then 289.00
    when 3 then 389.00
    else price
  end,
  extra_store_price = case
    when id = 3 then 189.00
    else 0.00
  end,
  checkout_note = case id
    when 1 then 'R$189,00 por mês. Trimestral, semestral e anual com 10% de desconto.'
    when 2 then 'R$289,00 por mês. Trimestral, semestral e anual com 10% de desconto.'
    when 3 then 'R$389,00 por mês com uma loja incluída e R$189,00 por loja adicional. Trimestral, semestral e anual com 10% de desconto.'
    else checkout_note
  end
where id in (1, 2, 3);
