import { calculatePlatformFeeCents } from './poppay.ts'

Deno.test('calcula 1% em centavos sem ponto flutuante', () => {
  if (calculatePlatformFeeCents(10_000, 100) !== 100) throw new Error('R$ 100 deve gerar R$ 1 de comissao')
  if (calculatePlatformFeeCents(22_900, 100) !== 229) throw new Error('R$ 229 deve gerar R$ 2,29 de comissao')
})

Deno.test('arredonda a comissao e nunca consome todo o pagamento', () => {
  if (calculatePlatformFeeCents(50, 100) !== 1) throw new Error('A menor comissao representavel deve ser um centavo')
  if (calculatePlatformFeeCents(1, 100) !== 0) throw new Error('Nao deve consumir um pagamento de um centavo')
  if (calculatePlatformFeeCents(10_000, 0) !== 0) throw new Error('Split desligado deve gerar comissao zero')
})
