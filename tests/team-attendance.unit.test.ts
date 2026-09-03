import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPayrollPreview, calculateAttendance } from '../src/lib/team/attendanceEngine';

const rules = {
  overtimeToleranceMinutes: 10,
  lateToleranceMinutes: 5,
  overtimeHourMultiplier: 1.5,
  deductLateMinutes: true,
  deductUnjustifiedAbsences: true,
};

test('apura jornada, intervalo, atraso e horas extras sem regra legal fixa', () => {
  const result = calculateAttendance({
    employeeId: 'employee-1',
    startDate: '2026-09-01',
    endDate: '2026-09-01',
    schedules: [{
      employee_id: 'employee-1', weekday: 2, first_start: '08:00', first_end: '12:00',
      second_start: '13:00', second_end: '17:00', is_day_off: false, schedule_type: 'fixed',
      effective_from: '2026-01-01', effective_until: null,
    }],
    entries: [
      { id: '1', employee_id: 'employee-1', event_type: 'clock_in', occurred_at: '2026-09-01T08:08:00-03:00', status: 'approved' },
      { id: '2', employee_id: 'employee-1', event_type: 'break_start', occurred_at: '2026-09-01T12:00:00-03:00', status: 'approved' },
      { id: '3', employee_id: 'employee-1', event_type: 'break_end', occurred_at: '2026-09-01T13:00:00-03:00', status: 'approved' },
      { id: '4', employee_id: 'employee-1', event_type: 'clock_out', occurred_at: '2026-09-01T17:30:00-03:00', status: 'approved' },
    ],
    occurrences: [],
    rules,
  });

  assert.equal(result.expectedMinutes, 480);
  assert.equal(result.workedMinutes, 502);
  assert.equal(result.breakMinutes, 60);
  assert.equal(result.lateMinutes, 8);
  assert.equal(result.overtimeMinutes, 22);
  assert.equal(result.incompleteDays, 0);
});

test('folga e ocorrência justificada não viram falta', () => {
  const result = calculateAttendance({
    employeeId: 'employee-1', startDate: '2026-09-02', endDate: '2026-09-02',
    schedules: [{ employee_id: 'employee-1', weekday: 3, first_start: '08:00', first_end: '17:00', second_start: null, second_end: null, is_day_off: false, schedule_type: 'fixed', effective_from: '2026-01-01', effective_until: null }],
    entries: [],
    occurrences: [{ employee_id: 'employee-1', occurrence_type: 'medical_certificate', start_date: '2026-09-02', end_date: '2026-09-02', affects_expected_hours: true, paid: true, status: 'approved' }],
    rules,
  });
  assert.equal(result.expectedMinutes, 0);
  assert.equal(result.absenceDays, 0);
});

test('prévia desconta adiantamento sem criar conta a receber', () => {
  const preview = buildPayrollPreview({
    attendance: { employeeId: '1', expectedMinutes: 480, workedMinutes: 480, breakMinutes: 60, overtimeMinutes: 60, lateMinutes: 0, earlyLeaveMinutes: 0, bankMinutes: 0, absenceDays: 0, workedDays: 1, daysOff: 0, incompleteDays: 0, days: [] },
    salaryBase: 2000, hourlyRate: 10, overtimeMultiplier: 1.5, commissions: 350, advances: 300,
  });
  assert.equal(preview.overtimeAmount, 15);
  assert.equal(preview.netAmount, 2065);
});
