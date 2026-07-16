# PopPay — configuração e ativação segura

O PopPay usa o Split de Pagamentos 1:1 do Mercado Pago em paralelo à conexão
Mercado Pago já existente. Nenhuma loja é migrada ou desconectada automaticamente.

## 1. Criar a aplicação no Mercado Pago

Na conta empresarial do PopSystem, crie uma aplicação com:

- solução: **Pagamentos online**;
- produto: **Checkout API** (e Checkout Pro, caso também seja utilizado);
- modelo de integração: **Marketplace**;
- nome sugerido: **PopPay**;
- Redirect URL de produção: `https://popsystem.com.br/poppay/callback`.

A conta do PopSystem e as contas vendedoras precisam cumprir os requisitos de
identificação/KYC exigidos pelo Mercado Pago.

## 2. Secrets do Supabase

Configure somente no Supabase Functions:

```text
POPPAY_CLIENT_ID=<APP_ID da aplicação PopPay>
POPPAY_CLIENT_SECRET=<CLIENT_SECRET da aplicação PopPay>
POPPAY_REDIRECT_URI=https://popsystem.com.br/poppay/callback
POPPAY_SPLIT_ENABLED=false
```

Nunca use credenciais da conta de um restaurante como credenciais da plataforma.

## 3. Ordem de publicação

1. Aplicar `20260715180000_poppay_marketplace.sql`.
2. Publicar `poppay-oauth-start`, `poppay-oauth`, `poppay-settings` e
   `poppay-refund`.
3. Publicar as versões novas de `pix-start-checkout` e `pix-webhook`.
4. Publicar o frontend.
5. Manter `POPPAY_SPLIT_ENABLED=false` e conectar apenas a conta de teste.
6. Depois dos testes, alterar para `true` e ativar o split somente na conta piloto.

## 4. Critérios do teste piloto

- PIX de valor pequeno criado com `application_fee` igual a 1%;
- pedido criado uma única vez após o webhook;
- valor bruto, comissão e `payment_id` registrados em `pix_checkouts`;
- cancelamento sem devolução não chama a API financeira;
- cancelamento com devolução cria uma única linha em `poppay_refunds`;
- reembolso aprovado devolve o valor ao pagador e reverte proporcionalmente o split;
- reembolso em contingência permanece `in_process` até confirmação;
- falha ou token PopPay indisponível não apaga a conexão Mercado Pago legada.

## 5. Desativação de emergência

Defina `POPPAY_SPLIT_ENABLED=false`. Novos checkouts voltam imediatamente para a
conexão Mercado Pago legada. Não exclua a aplicação PopPay nem rotacione as
credenciais durante uma ocorrência, pois isso pode invalidar tokens OAuth.
