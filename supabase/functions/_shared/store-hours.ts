// deno-lint-ignore-file no-explicit-any
export type StoreDayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

type DailySchedule = {
  open?: string
  close?: string
  closed?: boolean
}

const dayKeys: StoreDayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const dayLabels: Record<StoreDayKey, string> = {
  monday: 'segunda-feira',
  tuesday: 'terça-feira',
  wednesday: 'quarta-feira',
  thursday: 'quinta-feira',
  friday: 'sexta-feira',
  saturday: 'sábado',
  sunday: 'domingo',
}
const weekdayKeys: Record<string, StoreDayKey> = {
  sun: 'sunday',
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
}

const parseMinutes = (value?: string) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

const parseSchedule = (openingHours: unknown): Record<string, DailySchedule> => {
  if (!openingHours) return {}
  if (typeof openingHours === 'string') {
    try {
      const parsed = JSON.parse(openingHours)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof openingHours === 'object' ? openingHours as Record<string, DailySchedule> : {}
}

const clockAt = (now: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  const dayKey = weekdayKeys[String(values.weekday || '').toLowerCase()] || dayKeys[now.getDay()]
  return {
    dayKey,
    dayIndex: dayKeys.indexOf(dayKey),
    minutes: Number(values.hour || 0) * 60 + Number(values.minute || 0),
  }
}

export type StoreAvailability = {
  configured: boolean
  isOpen: boolean
  todayClosed: boolean
  currentDay: StoreDayKey
  closesAt?: string
  nextOpening?: {
    day: StoreDayKey
    dayLabel: string
    time: string
    daysAhead: number
  }
}

export function getStoreAvailability(
  openingHours: unknown,
  now = new Date(),
  timeZone = 'America/Fortaleza',
): StoreAvailability {
  const schedule = parseSchedule(openingHours)
  const configured = Object.keys(schedule).length > 0
  const clock = clockAt(now, timeZone)
  const today = schedule[clock.dayKey]
  const yesterdayKey = dayKeys[(clock.dayIndex + 6) % 7]
  const yesterday = schedule[yesterdayKey]
  const todayOpen = parseMinutes(today?.open)
  const todayClose = parseMinutes(today?.close)
  const yesterdayOpen = parseMinutes(yesterday?.open)
  const yesterdayClose = parseMinutes(yesterday?.close)

  const openFromYesterday = Boolean(
    yesterday && !yesterday.closed &&
    yesterdayOpen !== null && yesterdayClose !== null &&
    yesterdayClose <= yesterdayOpen && clock.minutes < yesterdayClose,
  )
  const openFromToday = Boolean(
    today && !today.closed &&
    todayOpen !== null && todayClose !== null &&
    (todayClose <= todayOpen ? clock.minutes >= todayOpen : clock.minutes >= todayOpen && clock.minutes < todayClose),
  )

  if (openFromYesterday || openFromToday) {
    return {
      configured,
      isOpen: true,
      todayClosed: false,
      currentDay: clock.dayKey,
      closesAt: String((openFromToday ? today : yesterday)?.close || ''),
    }
  }

  for (let daysAhead = 0; daysAhead <= 7; daysAhead += 1) {
    const day = dayKeys[(clock.dayIndex + daysAhead) % 7]
    const candidate = schedule[day]
    const candidateOpen = parseMinutes(candidate?.open)
    if (!candidate || candidate.closed || candidateOpen === null) continue
    if (daysAhead === 0 && candidateOpen <= clock.minutes) continue
    return {
      configured,
      isOpen: false,
      todayClosed: !today || today.closed === true,
      currentDay: clock.dayKey,
      nextOpening: {
        day,
        dayLabel: dayLabels[day],
        time: String(candidate.open),
        daysAhead,
      },
    }
  }

  return {
    configured,
    isOpen: false,
    todayClosed: !today || today.closed === true,
    currentDay: clock.dayKey,
  }
}

export function buildClosedStoreReply(params: {
  restaurantName: string
  restaurantId: string
  availability: StoreAvailability
  menuUrl: string
}) {
  const { availability } = params
  const next = availability.nextOpening
  let scheduleMessage = 'Ainda não temos o próximo horário de atendimento cadastrado.'

  if (next?.daysAhead === 0) {
    scheduleMessage = `Hoje abrimos às ${next.time}.`
  } else if (next?.daysAhead === 1) {
    scheduleMessage = `Nosso próximo atendimento será amanhã, às ${next.time}.`
  } else if (next) {
    scheduleMessage = `Nosso próximo atendimento será ${next.dayLabel}, às ${next.time}.`
  }

  const statusMessage = availability.todayClosed
    ? 'Hoje não abriremos.'
    : 'No momento estamos fechados.'

  return [
    `Olá! 👋 ${statusMessage}`,
    scheduleMessage,
    '',
    `Você pode consultar o cardápio enquanto isso: ${params.menuUrl}`,
  ].join('\n')
}
