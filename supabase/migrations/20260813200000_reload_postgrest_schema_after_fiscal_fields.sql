-- Garante que o PostgREST reconheca imediatamente os campos fiscais
-- adicionados nas migracoes anteriores. Sem este reload, a API pode manter o
-- schema antigo em memoria e rejeitar a gravacao dos itens de NF-e/NFC-e.
NOTIFY pgrst, 'reload schema';
