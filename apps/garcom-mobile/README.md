# BoraCumê Garçom

App nativo Android em React Native/Expo para operação de salão com:

- login por e-mail e senha via Supabase Auth
- mapa de mesas mobile-first
- sessão ativa por mesa
- múltiplas contas por sessão
- itens por conta com observação e opções
- envio de pedidos para cozinha via tabela `orders`
- pagamento por conta ou total
- fundação para cache local e realtime

## Rodar localmente

1. copie `.env.example` para `.env`
2. instale dependências com `npm install`
3. rode `npm run android` ou `npm run start`

## Build Android

- APK interno: `eas build --platform android --profile preview`
- AAB Play Store: `eas build --platform android --profile production`

## Banco

O app usa a nova arquitetura de salão baseada em:

- `tables`
- `table_sessions`
- `table_accounts`
- `order_items`
- `order_item_options`
- `payments`

Antes de operar em produção, aplique a migration nova do app do garçom no Supabase.
