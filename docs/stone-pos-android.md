# PopSystem Garcom no POS Android Stone

Esta entrega prepara o app Garcom existente para usar a Stone por uma ponte Capacitor chamada `StonePos`.

O PopSystem continua dono da regra de negocio:

- mesa, comanda, saldo e fechamento ficam no PopSystem;
- a Stone processa PIX, debito e credito;
- a mesa so fecha quando o saldo restante fica menor ou igual a zero;
- cada pagamento parcial gera uma transacao propria.

## Plugin nativo esperado

O projeto Android do POS deve registrar um plugin Capacitor com o nome `StonePos` e estes metodos:

- `startPayment({ amountCents, type, installments, reference, metadata })`
- `cancelPayment({ transactionId })`
- `refundPayment({ transactionId, amountCents })`
- `getTransaction({ transactionId })`
- `getStatus()`
- `reprintReceipt({ transactionId })`

Retorno minimo de `startPayment`:

```json
{
  "transactionId": "stone-id",
  "atk": "atk",
  "nsu": "nsu",
  "authorizationCode": "auth",
  "amountCents": 7000,
  "paymentType": "PIX",
  "installments": 1,
  "status": "APPROVED",
  "date": "2026-06-15T12:00:00.000Z",
  "deviceId": "POS-01",
  "terminal": "TERMINAL-01",
  "stoneCode": "123456"
}
```

Sem esse plugin nativo, o app web continua funcionando para dinheiro e informa que a Stone so fica disponivel no POS Android homologado.
