alter table public.nfce_cupons
  add column if not exists xml_processado text;

comment on column public.nfce_cupons.xml_processado is
  'Documento fiscal autorizado no formato nfeProc: NFe assinada + protocolo de autorizacao protNFe.';
