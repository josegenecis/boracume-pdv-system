import type {
  AttendanceOccurrence,
  AttendanceRules,
  AttendanceSummary,
  TimeEntry,
  WorkSchedule,
} from './types';

const DAY_MS = 86_400_000;

const localDate = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};

const dateKey = (value: Date | string) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const minutesOfDay = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.getHours() * 60 + date.getMinutes();
};

const timeToMinutes = (value: string | null) => {
  if (!value) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const scheduledMinutes = (schedule?: WorkSchedule) => {
  if (!schedule || schedule.is_day_off) return 0;
  const first = Math.max(0, timeToMinutes(schedule.first_end) - timeToMinutes(schedule.first_start));
  const second = schedule.second_start && schedule.second_end
    ? Math.max(0, timeToMinutes(schedule.second_end) - timeToMinutes(schedule.second_start))
    : 0;
  return first + second;
};

const isWithin = (date: string, start: string, end: string | null) => date >= start && (!end || date <= end);

const occurrenceForDate = (occurrences: AttendanceOccurrence[], date: string) =>
  occurrences.find((item) => item.status !== 'rejected' && date >= item.start_date && date <= item.end_date);

const scheduleForDate = (schedules: WorkSchedule[], date: string) => {
  const weekday = localDate(date).getDay();
  return schedules
    .filter((item) => item.weekday === weekday && isWithin(date, item.effective_from, item.effective_until))
    .sort((left, right) => right.effective_from.localeCompare(left.effective_from))[0];
};

const calculateWorkedMinutes = (events: TimeEntry[]) => {
  const sorted = events
    .filter((entry) => entry.status !== 'rejected')
    .slice()
    .sort((left, right) => new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime());
  let workingSince: number | null = null;
  let breakSince: number | null = null;
  let worked = 0;
  let breaks = 0;

  for (const event of sorted) {
    const at = new Date(event.occurred_at).getTime();
    if (event.event_type === 'clock_in') workingSince = at;
    if (event.event_type === 'break_start' && workingSince !== null) {
      worked += Math.max(0, at - workingSince);
      workingSince = null;
      breakSince = at;
    }
    if (event.event_type === 'break_end') {
      if (breakSince !== null) breaks += Math.max(0, at - breakSince);
      breakSince = null;
      workingSince = at;
    }
    if (event.event_type === 'clock_out' && workingSince !== null) {
      worked += Math.max(0, at - workingSince);
      workingSince = null;
    }
  }

  return {
    workedMinutes: Math.round(worked / 60_000),
    breakMinutes: Math.round(breaks / 60_000),
    incomplete: workingSince !== null || breakSince !== null || (sorted.length > 0 && sorted.at(-1)?.event_type !== 'clock_out'),
    firstEntry: sorted.find((item) => item.event_type === 'clock_in'),
    lastExit: sorted.slice().reverse().find((item) => item.event_type === 'clock_out'),
  };
};

export function calculateAttendance(params: {
  employeeId: string;
  startDate: string;
  endDate: string;
  schedules: WorkSchedule[];
  entries: TimeEntry[];
  occurrences: AttendanceOccurrence[];
  rules: AttendanceRules;
}): AttendanceSummary {
  const { employeeId, startDate, endDate, rules } = params;
  const schedules = params.schedules.filter((item) => item.employee_id === employeeId);
  const entries = params.entries.filter((item) => item.employee_id === employeeId);
  const occurrences = params.occurrences.filter((item) => item.employee_id === employeeId);
  const entriesByDate = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = dateKey(entry.occurred_at);
    entriesByDate.set(key, [...(entriesByDate.get(key) || []), entry]);
  }

  const days = [];
  for (let cursor = localDate(startDate); cursor.getTime() <= localDate(endDate).getTime(); cursor = new Date(cursor.getTime() + DAY_MS)) {
    const date = dateKey(cursor);
    const schedule = scheduleForDate(schedules, date);
    const occurrence = occurrenceForDate(occurrences, date);
    const worked = calculateWorkedMinutes(entriesByDate.get(date) || []);
    const occurrenceRemovesExpected = Boolean(
      occurrence?.affects_expected_hours
      && occurrence.occurrence_type !== 'unjustified_absence'
    );
    const expectedMinutes = occurrenceRemovesExpected ? 0 : scheduledMinutes(schedule);
    const overtimeMinutes = worked.workedMinutes > expectedMinutes + rules.overtimeToleranceMinutes
      ? worked.workedMinutes - expectedMinutes
      : 0;
    const firstStart = schedule?.first_start ? timeToMinutes(schedule.first_start) : null;
    const finalEnd = schedule?.second_end || schedule?.first_end;
    const lateRaw = worked.firstEntry && firstStart !== null ? minutesOfDay(worked.firstEntry.occurred_at) - firstStart : 0;
    const earlyRaw = worked.lastExit && finalEnd ? timeToMinutes(finalEnd) - minutesOfDay(worked.lastExit.occurred_at) : 0;
    const isAbsence = expectedMinutes > 0 && worked.workedMinutes === 0 && (
      !occurrence || occurrence.occurrence_type === 'unjustified_absence'
    );

    days.push({
      date,
      expectedMinutes,
      workedMinutes: worked.workedMinutes,
      breakMinutes: worked.breakMinutes,
      overtimeMinutes,
      lateMinutes: lateRaw > rules.lateToleranceMinutes ? lateRaw : 0,
      earlyLeaveMinutes: earlyRaw > rules.lateToleranceMinutes ? earlyRaw : 0,
      bankMinutes: worked.workedMinutes - expectedMinutes,
      occurrence: occurrence?.occurrence_type || null,
      incomplete: worked.incomplete,
      isDayOff: Boolean(schedule?.is_day_off || occurrence?.occurrence_type === 'day_off'),
      isAbsence,
    });
  }

  return days.reduce<AttendanceSummary>((summary, day) => ({
    ...summary,
    expectedMinutes: summary.expectedMinutes + day.expectedMinutes,
    workedMinutes: summary.workedMinutes + day.workedMinutes,
    breakMinutes: summary.breakMinutes + day.breakMinutes,
    overtimeMinutes: summary.overtimeMinutes + day.overtimeMinutes,
    lateMinutes: summary.lateMinutes + day.lateMinutes,
    earlyLeaveMinutes: summary.earlyLeaveMinutes + day.earlyLeaveMinutes,
    bankMinutes: summary.bankMinutes + day.bankMinutes,
    absenceDays: summary.absenceDays + (day.isAbsence ? 1 : 0),
    workedDays: summary.workedDays + (day.workedMinutes > 0 ? 1 : 0),
    daysOff: summary.daysOff + (day.isDayOff ? 1 : 0),
    incompleteDays: summary.incompleteDays + (day.incomplete ? 1 : 0),
    days: [...summary.days, day],
  }), {
    employeeId,
    expectedMinutes: 0,
    workedMinutes: 0,
    breakMinutes: 0,
    overtimeMinutes: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    bankMinutes: 0,
    absenceDays: 0,
    workedDays: 0,
    daysOff: 0,
    incompleteDays: 0,
    days: [],
  });
}

export function buildPayrollPreview(params: {
  attendance: AttendanceSummary;
  salaryBase: number;
  hourlyRate: number;
  overtimeMultiplier: number;
  commissions?: number;
  bonuses?: number;
  advances?: number;
  otherEarnings?: number;
  otherDeductions?: number;
  deductLateMinutes?: boolean;
  deductAbsences?: boolean;
}) {
  const hourlyRate = Math.max(0, params.hourlyRate || (params.salaryBase > 0 ? params.salaryBase / 220 : 0));
  const overtimeAmount = (params.attendance.overtimeMinutes / 60) * hourlyRate * Math.max(0, params.overtimeMultiplier);
  const dailyRate = params.salaryBase > 0 ? params.salaryBase / 30 : 0;
  const absenceDeductions = params.deductAbsences ? params.attendance.absenceDays * dailyRate : 0;
  const lateDeductions = params.deductLateMinutes ? (params.attendance.lateMinutes / 60) * hourlyRate : 0;
  const totalEarnings = params.salaryBase + overtimeAmount + (params.commissions || 0) + (params.bonuses || 0) + (params.otherEarnings || 0);
  const totalDeductions = absenceDeductions + lateDeductions + (params.advances || 0) + (params.otherDeductions || 0);
  return {
    baseSalary: params.salaryBase,
    overtimeAmount,
    commissions: params.commissions || 0,
    bonuses: params.bonuses || 0,
    advances: params.advances || 0,
    absenceDeductions,
    lateDeductions,
    otherEarnings: params.otherEarnings || 0,
    otherDeductions: params.otherDeductions || 0,
    totalEarnings,
    totalDeductions,
    netAmount: Math.max(0, totalEarnings - totalDeductions),
  };
}
