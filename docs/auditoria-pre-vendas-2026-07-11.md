# Auditoria pre-vendas - PopSystem

Data: 11/07/2026

## Veredito

**Nao liberar vendas em escala ainda.** O frontend compila e a producao esta online, mas os testes automatizados efetivos falham, existem funcoes antigas/inseguras publicadas no Supabase, o fluxo fiscal nacional ainda depende de homologacao especializada e falta validar a cobranca real fora do sandbox.

Uma venda piloto controlada so deve acontecer depois dos itens P0 abaixo, com acompanhamento manual e plano fiscal limitado ao que estiver efetivamente homologado.

## Evidencias executadas

- TypeScript (`npx tsc --noEmit`): aprovado.
- Build de producao (`npm run build:prod`): aprovado.
- Dependencias de producao (`npm audit --omit=dev`): 0 vulnerabilidades depois da atualizacao segura.
- Dependencias de desenvolvimento/desktop: 12 vulnerabilidades restantes (11 altas e 1 moderada), exigindo upgrades com quebra de versao de Electron/Vite/electron-builder.
- ESLint: reprovado, 3.295 ocorrencias (3.158 erros e 137 avisos).
- Playwright: 20 casos descobertos; 14 ignorados e 6 reprovados por timeout no carrinho/checkout. Nenhum caso aprovado nesta execucao.
- Supabase migrations: local e remoto sincronizados ate `20260711160000`.
- Supabase DB lint: uma funcao SQL com erro (`create_product_images_policies`) e avisos em `calculate_dv_mod11`.
- Vercel: ultimo deployment de producao em estado `Ready`; `popsystem.com.br/` e `/subscription` retornam HTTP 200.
- Build web: bundle principal de 5,94 MB (1,18 MB gzip) e bundle de graficos de 1,03 MB (214 KB gzip), acima do desejavel.

## P0 - bloqueia inicio das vendas

### 1. Checkout/cardapio sem teste automatizado aprovado

Os seis testes executados falharam nos navegadores Chromium, Firefox e WebKit. O clique em “Ver carrinho” nao abriu o dialogo esperado. E necessario distinguir fixture de teste desatualizada de regressao real e aprovar o fluxo completo: produto -> complementos -> carrinho -> checkout -> PIX -> confirmacao -> pedido.

### 2. Cobertura insuficiente dos fluxos financeiros

Nao existem testes automatizados suficientes para assinatura Asaas por PIX/cartao, webhook, idempotencia, upgrade proporcional, inadimplencia, cancelamento e renovacao. Antes da venda deve ser feito um pagamento real de baixo valor e confirmado que `ASAAS_ENVIRONMENT` e a chave pertencem a producao, nao ao sandbox.

### 3. Funcoes publicadas sem autenticacao ou sem fonte rastreavel

O ambiente remoto contem varias funcoes com `verify_jwt=false`. Algumas sao webhooks/publicas por natureza, mas outras consomem servicos pagos ou administrativos. Pontos imediatos:

- `apply-popmarketing-migration`: esta ativa, sem JWT e nao existe no repositorio atual. Deve ser removida/desativada ate sua origem e autorizacao serem auditadas.
- `generate-product-description` e `agent-chat`: estao publicas sem JWT e podem consumir API de IA por qualquer solicitante. Exigir usuario autenticado e aplicar limite de uso.
- `enhance-product-image`: publica sem JWT; embora atualmente retorne “nao suportado”, deve seguir a mesma politica.
- revisar `send-push`, `whatsapp-notify`, `evolution-proxy`, funcoes do print-agent e demais entradas publicas, documentando o mecanismo de autenticacao proprio.

Webhooks legitimos (`asaas-webhook`, iFood, PIX etc.) devem permanecer acessiveis externamente, mas falhar fechados quando token/assinatura estiver ausente. O segredo do Asaas existe no ambiente; ainda e necessario confirmar no painel do Asaas se o mesmo token esta configurado no webhook.

### 4. Fiscal nao esta homologado para venda nacional

O motor possui base tecnica para A1/NFC-e, mas nao esta validado em todas as UFs e regimes. Nao prometer “fiscal nacional” ate o especialista concluir matriz por UF, schemas/notas tecnicas vigentes, CSC/QR Code, regras tributarias, contingencia, cancelamento, inutilizacao, RTC e testes de homologacao. Ver tambem `docs/fiscal-national-audit-2026-07.md` e `docs/fiscal-specialist-handoff.md`.

O sistema possui tela para cancelar a NFC-e inteira e reimprimir o DANFE em `NFCeManager`. Cancelar apenas um item de uma NFC-e autorizada nao e o fluxo fiscal correto; em geral cancela-se o documento dentro das regras/prazo ou realiza-se a operacao fiscal aplicavel definida pelo contador/especialista.

### 5. Exclusao de produto ainda e inconsistente

A exclusao individual tenta arquivar o produto quando encontra referencia fiscal, mas as exclusoes em massa ainda fazem `DELETE` direto e exibem erro de chave estrangeira. Padronizar tudo como arquivamento/soft delete quando houver historico de pedido, estoque ou NFC-e. O historico fiscal nunca deve ser apagado em cascata.

### 6. Recuperacao de senha sem protecao contra abuso

`auth-recovery-email` e publica, como precisa ser, mas nao ha rate limit/captcha visivel no backend. Um atacante pode gerar custo de e-mail e assediar usuarios. Adicionar limite por IP/e-mail, janela de tempo e observabilidade.

## P1 - concluir antes de ampliar clientes

- Corrigir a funcao SQL `create_product_images_policies` indicada pelo lint e o sombreamento de variavel em `calculate_dv_mod11`.
- Transformar os cinco arquivos SQL sem timestamp em migrations formais ou remove-los do fluxo de deploy: `add_delivery_zone_fields.sql`, `alter_pix_settings_add_columns.sql`, `create_pix_checkouts.sql`, `setup_core_tables.sql`, `setup_pix_settings.sql`.
- Reduzir os 3.295 problemas do lint, priorizando hooks com dependencias incorretas, blocos vazios, escopos de `case` e erros reais; `no-explicit-any` pode ser tratado gradualmente.
- Criar testes para login/cadastro/trial, PDV e caixa, pedidos delivery/iFood, estoque, permissoes por usuario/loja, WhatsApp, assinatura e fiscal.
- Fazer teste de isolamento multi-tenant/RLS: usuario A nao pode ler ou alterar loja, pedidos, financeiro, certificado ou assinatura do usuario B.
- Revisar idempotencia e concorrencia de estoque/pedidos. O codigo atual faz leitura seguida de atualizacao em alguns pontos, vulneravel a duas alteracoes simultaneas.
- Configurar monitoramento de erros e alertas para falha de webhook, cobranca, emissao fiscal e fila de impressao.
- Definir backup, restauracao testada, retencao de XML fiscal e procedimento de incidente.

## P2 - desempenho e manutencao

- Dividir o bundle principal e carregar modulos pesados por rota.
- Corrigir a importacao simultaneamente estatica/dinamica de `PolygonAreasEditor`.
- Atualizar Browserslist e `baseline-browser-mapping`.
- Planejar upgrades de Electron, Vite e electron-builder para eliminar as vulnerabilidades restantes nas ferramentas/desktop.
- Remover integracoes/scripts legados nao utilizados, inclusive referencias antigas de marca e servicos de terceiros carregados globalmente no `index.html`, apos confirmar necessidade.

## Checklist minimo para liberar piloto

1. Todos os E2E criticos aprovados em Chromium e celular.
2. Pagamento Asaas real aprovado, webhook confirmado e renovacao/cancelamento testados.
3. Funcoes publicas administrativas/IA protegidas ou removidas.
4. Exclusao individual e em massa arquivando produtos com historico.
5. Politica fiscal comercial limitada às UFs/cenarios homologados pelo especialista.
6. Teste RLS entre duas contas aprovado.
7. Alertas e procedimento de suporte definidos.
8. Novo build, deploy de preview, smoke test e somente entao promocao para producao.

