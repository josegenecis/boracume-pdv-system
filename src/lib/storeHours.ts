type DayKey =
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

const dayKeys: DayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const weekdayToDayKey: Record<string, DayKey> = {
  sun: 'sunday',
  sunday: 'sunday',
  mon: 'monday',
  monday: 'monday',
  tue: 'tuesday',
  tuesday: 'tuesday',
  wed: 'wednesday',
  wednesday: 'wednesday',
  thu: 'thursday',
  thursday: 'thursday',
  fri: 'friday',
  friday: 'friday',
  sat: 'saturday',
  saturday: 'saturday',
}

const formatDayNames: Record<DayKey, string> = {
  monday: 'segunda',
  tuesday: 'terca',
  wednesday: 'quarta',
  thursday: 'quinta',
  friday: 'sexta',
  saturday: 'sabado',
  sunday: 'domingo',
}

export const DEFAULT_STORE_TIME_ZONE = 'America/Sao_Paulo'

const parseMinutes = (value?: string) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

const getClockInTimeZone = (now = new Date(), timeZone = DEFAULT_STORE_TIME_ZONE) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)

    const values = parts.reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value
      return acc
    }, {})

    const dayKey = weekdayToDayKey[String(values.weekday || '').toLowerCase()] || dayKeys[now.getDay()]
    const dayIndex = dayKeys.indexOf(dayKey)
    const hours = Number(values.hour || now.getHours())
    const minutes = Number(values.minute || now.getMinutes())

    return {
      dayKey,
      dayIndex: dayIndex >= 0 ? dayIndex : now.getDay(),
      currentMinutes: hours * 60 + minutes,
    }
  } catch {
    return {
      dayKey: dayKeys[now.getDay()],
      dayIndex: now.getDay(),
      currentMinutes: now.getHours() * 60 + now.getMinutes(),
    }
  }
}

const isOpenFromTodaySchedule = (schedule?: DailySchedule, currentMinutes?: number) => {
  if (!schedule || schedule.closed || typeof currentMinutes !== 'number') return false

  const openMinutes = parseMinutes(schedule.open)
  const closeMinutes = parseMinutes(schedule.close)
  if (openMinutes === null || closeMinutes === null) return true

  if (closeMinutes <= openMinutes) {
    return currentMinutes >= openMinutes
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}

const isOpenFromYesterdaySchedule = (schedule?: DailySchedule, currentMinutes?: number) => {
  if (!schedule || schedule.closed || typeof currentMinutes !== 'number') return false

  const openMinutes = parseMinutes(schedule.open)
  const closeMinutes = parseMinutes(schedule.close)
  if (openMinutes === null || closeMinutes === null) return false

  return closeMinutes <= openMinutes && currentMinutes < closeMinutes
}

export const parseOpeningHours = (openingHours: unknown): Record<string, DailySchedule> => {
  if (!openingHours) return {}
  if (typeof openingHours === 'string') {
    try {
      const parsed = JSON.parse(openingHours)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof openingHours === 'object' ? (openingHours as Record<string, DailySchedule>) : {}
}

export const getStoreOpenInfo = (openingHours: unknown, now = new Date(), timeZone = DEFAULT_STORE_TIME_ZONE) => {
  const schedule = parseOpeningHours(openingHours)
  const { dayKey: currentDay, dayIndex, currentMinutes } = getClockInTimeZone(now, timeZone)
  const todaySchedule = schedule[currentDay]
  const yesterdayDay = dayKeys[(dayIndex + 6) % 7]
  const yesterdaySchedule = schedule[yesterdayDay]

  const openFromToday = isOpenFromTodaySchedule(todaySchedule, currentMinutes)
  const openFromYesterday = isOpenFromYesterdaySchedule(yesterdaySchedule, currentMinutes)

  if (openFromToday || openFromYesterday) {
    const activeSchedule = openFromToday ? todaySchedule : yesterdaySchedule
    return {
      isOpen: true,
      label: 'Aberto',
      detail: activeSchedule?.close
        ? `Atendendo ate ${activeSchedule.close}.`
        : 'Horario indisponivel.',
    }
  }

  if (!todaySchedule || todaySchedule.closed) {
    return {
      isOpen: false,
      label: 'Fechado',
      detail: `Fechado hoje (${formatDayNames[currentDay]}).`,
    }
  }

  const openMinutes = parseMinutes(todaySchedule.open)
  const closeMinutes = parseMinutes(todaySchedule.close)

  if (openMinutes === null || closeMinutes === null) {
    return {
      isOpen: true,
      label: 'Aberto',
      detail: 'Horario indisponivel.',
    }
  }

  return {
    isOpen: false,
    label: 'Fechado',
    detail: `Atendimento hoje das ${todaySchedule.open} as ${todaySchedule.close}.`,
  }
}
