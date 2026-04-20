# BoraCume Garcom

App Android em React Native/Expo para operacao de salao com:

- login individual do garcom por CPF e senha
- sessao persistida no aparelho com validacao via edge function
- mapa de mesas mobile-first
- sessao ativa por mesa
- multiplas contas por sessao
- itens por conta com observacao e opcoes
- envio de pedidos para cozinha via tabela `orders`
- pagamento por conta ou total
- cache local com atualizacao periodica

## Rodar localmente

1. copie `.env.example` para `.env`
2. instale dependencias com `npm install`
3. garanta que as edge functions `waiter-web` e `waiter-web-auth` estejam publicadas
4. rode `npm run android` ou `npm run start`

## Build Android

- APK interno: `eas build --platform android --profile preview`
- AAB Play Store: `eas build --platform android --profile production`

## Banco

O app usa a arquitetura de salao baseada em:

- `waiters`
- `waiter_web_sessions`
- `tables`
- `table_sessions`
- `table_accounts`
- `order_items`
- `order_item_options`
- `payments`

Antes de operar em producao, aplique as migrations do fluxo do garcom no Supabase.
