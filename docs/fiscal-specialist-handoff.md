# Entrega para especialista fiscal - NFC-e nacional

## Escopo técnico preparado

- Documento: NFC-e modelo 65.
- Regime liberado nesta fase: CRT 1 - Simples Nacional.
- Ambientes: homologação e produção.
- UFs mapeadas: AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE e TO.
- Certificado: A1 PKCS#12 (`.pfx`/`.p12`), validação de validade, chave privada e CNPJ.
- Operações: status, emissão, consulta, cancelamento, download XML e reimpressão do DANFE.
- QR Code: versão 3 para emissão online, conforme NT 2025.001 v1.03.
- Produtos: NCM, CFOP, CSOSN, CST PIS/COFINS, origem, CEST, cBenef e observação fiscal.
- CSOSN inicialmente implementados: 102, 103, 300, 400 e 500.
- Pagamentos: dinheiro, PIX, crédito, débito e pagamento misto.
- Fuso horário fiscal selecionado pela UF.
- Um único motor fiscal atende emissão, consulta, teste e cancelamento.

## Dados necessários além do A1

O A1 identifica e assina, mas não basta sozinho para autorizar uma NFC-e. Para cada empresa também são necessários:

- credenciamento para NFC-e na SEFAZ da UF;
- CNPJ, IE, CRT e endereço fiscal completos;
- código IBGE do município;
- série e próximo número válidos;
- tributação correta dos produtos;
- CSC apenas se a UF/cenário exigir compatibilidade antiga ou contingência v2.

## Validações solicitadas ao especialista

1. Revisar URLs de autorização, retorno, consulta, status, evento e QR Code das 27 UFs.
2. Confirmar se todas as UFs aceitam QR Code v3 online no cenário do contribuinte testado.
3. Revisar `urlChave` do suplemento da NFC-e por UF.
4. Validar XML de cada CSOSN implementado contra os schemas oficiais vigentes.
5. Definir grupos de ICMS para CSOSN 201, 202, 203 e 900.
6. Definir regras de CEST, cBenef, FCP e substituição tributária por UF.
7. Atualizar e validar pacote XSD oficial 010e/010d.
8. Definir campos IBS/CBS/IS e `cClassTrib` conforme NT 2025.002 vigente.
9. Validar `vTotTrib` e estratégia/licença da tabela IBPT.
10. Definir exigências de responsável técnico (`infRespTec`) e CSRT por UF.
11. Implementar e homologar inutilização de numeração.
12. Implementar contingência offline (`tpEmis=9`), QR Code v3 assinado, fila, retransmissão e conciliação.
13. Revisar prazos estaduais de cancelamento e cancelamento por substituição.
14. Validar guarda legal de XML, eventos e protocolos.
15. Executar testes reais com certificados/credenciamentos de empresas piloto.

## Matriz mínima de testes por UF

Para cada UF, testar em homologação:

1. Status do serviço com mTLS.
2. Emissão NFC-e simples CSOSN 102.
3. Emissão com CSOSN 500 e CEST.
4. Dinheiro com troco.
5. PIX.
6. Crédito e débito com dados de integração.
7. Pagamento misto.
8. Consumidor sem documento, com CPF e com CNPJ.
9. Consulta por chave.
10. Cancelamento dentro do prazo.
11. Reimpressão DANFE e leitura do QR Code.
12. Rejeições de NCM, CFOP, CSOSN, total e pagamento.

Uma UF só deve receber status `homologada` depois que todos os cenários aplicáveis forem registrados com XML enviado, XML retornado, `cStat`, protocolo e evidência do DANFE/QR Code.

## Arquivos principais

- `supabase/functions/nfce-operations/index.ts`: regras e orquestração.
- `supabase/functions/nfce-operations/sefaz-client.ts`: comunicação mTLS/SOAP.
- `supabase/functions/nfce-operations/sefaz-endpoints.ts`: endpoints por UF.
- `supabase/functions/nfce-operations/qrcode-generator.ts`: QR Code.
- `supabase/functions/nfce-operations/xml-signer.ts`: assinatura XML.
- `supabase/functions/nfce-operations/certificate-utils.ts`: leitura/validação A1.
- `src/components/fiscal/FiscalSettings.tsx`: cadastro e diagnóstico.
- `src/components/nfce/NFCeManager.tsx`: operação de cupons.
