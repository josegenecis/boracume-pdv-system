update public.subscription_plans
set checkout_notes = case id
  when 1 then 'R$189,00 por mês. Trimestral e semestral com 5% de desconto; anual com 10% de desconto.'
  when 2 then 'R$289,00 por mês. Trimestral e semestral com 5% de desconto; anual com 10% de desconto.'
  when 3 then 'R$389,00 por mês com uma loja incluída e R$189,00 por loja adicional. Trimestral e semestral com 5% de desconto; anual com 10% de desconto.'
  else checkout_notes
end
where id in (1, 2, 3);
