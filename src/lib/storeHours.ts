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

const formatDayNames: Record<DayKey, string> = {
  monday: 'segunda',
  tuesday: 'terça',
  wednesday: 'quarta',
  thursday: 'quinta',
  friday: 'sexta',
  saturday: 'sábado',
  sunday: 'domingo',
}

const parseMinutes = (value?: string) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
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

export const getStoreOpenInfo = (openingHours: unknown, now = new Date()) => {
  const schedule = parseOpeningHours(openingHours)
  const currentDay = dayKeys[now.getDay()]
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const todaySchedule = schedule[currentDay]

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
      detail: 'Horário indisponível.',
    }
  }

  const isOvernight = closeMinutes <= openMinutes
  const isOpen = isOvernight
    ? currentMinutes >= openMinutes || currentMinutes < closeMinutes
    : currentMinutes >= openMinutes && currentMinutes < closeMinutes

  return {
    isOpen,
    label: isOpen ? 'Aberto' : 'Fechado',
    detail: isOpen
      ? `Atendendo até ${todaySchedule.close}.`
      : `Atendimento hoje das ${todaySchedule.open} às ${todaySchedule.close}.`,
  }
}
