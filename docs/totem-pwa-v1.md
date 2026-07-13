# Totem PopSystem PWA - versao 1

## Escopo entregue

- Rota publica e isolada por loja: `/totem/:userId`.
- Vinculo persistente do equipamento com a loja.
- Manifesto PWA proprio, inicializacao em `/totem` e modo `fullscreen`.
- Tela inicial com identidade do restaurante e produtos em destaque.
- Cardapio touch-first, busca, categorias, adicionais, observacoes e carrinho.
- Checkout PIX integrado ao fluxo ja existente.
- Cartao e dinheiro tratados como pagamento posterior no caixa/maquininha.
- Indicador online/offline, Wake Lock e controle de tela cheia.
- Carrinho separado por loja e limpeza de sessao apos inatividade.
- Cache apenas do shell, imagens e arquivos estaticos. APIs, pedidos e pagamentos nao sao armazenados pelo service worker.
- Area administrativa em `Configuracoes > Totem` com link, QR Code e instrucoes de instalacao.

## Limites intencionais do PWA

O navegador nao faz integracao direta e confiavel com pinpad/TEF, impressora USB em todos os sistemas, gaveta, leitor dedicado ou reinicio automatico do aplicativo. Nesta versao:

- PIX pode ser confirmado online.
- Cartao e dinheiro geram a senha para pagamento no caixa/maquininha.
- Impressao via navegador depende do suporte e permissao do equipamento.

## Proxima etapa: aplicativo desktop do totem

Quando autorizada, a versao desktop devera adicionar:

1. Inicializacao automatica com o sistema operacional e modo quiosque bloqueado.
2. Impressao silenciosa e monitoramento da impressora.
3. Integracao homologada com TEF/pinpad escolhido comercialmente.
4. Controle de gaveta, leitor e demais perifericos aplicaveis.
5. Atualizacao automatica, logs locais e recuperacao apos queda de energia.
6. Provisionamento seguro do identificador da loja e revogacao remota do equipamento.

## Validacao antes do piloto

Realizar em um equipamento fisico um pedido PIX real de baixo valor, um pedido para pagamento na maquininha, impressao, chegada no KDS/pedidos, cancelamento e recuperacao depois de perda de internet.
