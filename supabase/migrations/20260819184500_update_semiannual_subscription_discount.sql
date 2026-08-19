update public.subscription_plans
set checkout_note = case id
  when 1 then 'R$189,00 por mês. Trimestral com 5%, semestral com 7% e anual com 10% de desconto.'
  when 2 then 'R$289,00 por mês. Trimestral com 5%, semestral com 7% e anual com 10% de desconto.'
  when 3 then 'R$389,00 por mês com uma loja incluída e R$189,00 por loja adicional. Trimestral com 5%, semestral com 7% e anual com 10% de desconto.'
  else checkout_note
end
where id in (1, 2, 3);
