import assert from 'node:assert/strict'
import test from 'node:test'
import { buildClosedStoreReply, getStoreAvailability } from '../supabase/functions/_shared/store-hours.ts'

const schedule = {
  monday: { open: '10:00', close: '22:00', closed: false },
  tuesday: { open: '10:00', close: '22:00', closed: false },
  wednesday: { open: '10:00', close: '22:00', closed: false },
  thursday: { open: '10:00', close: '22:00', closed: false },
  friday: { open: '10:00', close: '23:00', closed: false },
  saturday: { open: '10:00', close: '23:00', closed: false },
  sunday: { open: '', close: '', closed: true },
}

test('informa a abertura de hoje antes do expediente', () => {
  const result = getStoreAvailability(schedule, new Date('2026-07-27T12:00:00.000Z'))
  assert.equal(result.isOpen, false)
  assert.equal(result.todayClosed, false)
  assert.deepEqual(result.nextOpening, {
    day: 'monday',
    dayLabel: 'segunda-feira',
    time: '10:00',
    daysAhead: 0,
  })
})

test('reconhece a loja aberta no horário local', () => {
  const result = getStoreAvailability(schedule, new Date('2026-07-27T15:00:00.000Z'))
  assert.equal(result.isOpen, true)
  assert.equal(result.closesAt, '22:00')
})

test('em dia fechado informa a próxima abertura', () => {
  const result = getStoreAvailability(schedule, new Date('2026-07-26T13:00:00.000Z'))
  assert.equal(result.isOpen, false)
  assert.equal(result.todayClosed, true)
  assert.equal(result.nextOpening?.daysAhead, 1)
  const reply = buildClosedStoreReply({
    restaurantName: 'Restaurante Teste',
    restaurantId: 'restaurant-id',
    availability: result,
    menuUrl: 'https://popsystem.com.br/share/menu/teste',
  })
  assert.match(reply, /Hoje não abriremos/)
  assert.match(reply, /amanhã, às 10:00/)
})
