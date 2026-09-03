import type { PayrollPreviewRow } from './types';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const hours = (minutes: number) => `${Math.floor(Math.abs(minutes) / 60)}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`;
const maskCpf = (cpf?: string | null) => cpf?.length === 11 ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : '-';

const download = (blob: Blob, filename: string) => {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
};

export async function exportPayrollXlsx(rows: PayrollPreviewRow[], competence: string) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PopSystem';
  const sheet = workbook.addWorksheet('Fechamento da Equipe', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    ['Funcionário', 28], ['CPF', 18], ['Cargo', 20], ['Salário Base', 16], ['Dias Trabalhados', 16],
    ['Faltas', 10], ['Horas Normais', 15], ['Horas Extras', 14], ['Atrasos', 12], ['Comissões', 14],
    ['Bonificações', 14], ['Adiantamentos', 15], ['Outros Descontos', 18], ['Total Proventos', 17],
    ['Total Descontos', 17], ['Saldo Previsto', 17], ['Status', 18],
  ].map(([header, width]) => ({ header, key: String(header), width: Number(width) }));
  rows.forEach((row) => sheet.addRow({
    Funcionário: row.employee.full_name, CPF: row.employee.cpf || '', Cargo: row.employee.job_title || '',
    'Salário Base': row.baseSalary, 'Dias Trabalhados': row.workedDays, Faltas: row.absenceDays,
    'Horas Normais': row.workedMinutes / 60, 'Horas Extras': row.overtimeMinutes / 60,
    Atrasos: row.lateMinutes / 60, Comissões: row.commissions, Bonificações: row.bonuses,
    Adiantamentos: row.advances, 'Outros Descontos': row.otherDeductions,
    'Total Proventos': row.totalEarnings, 'Total Descontos': row.totalDeductions,
    'Saldo Previsto': row.netAmount, Status: row.status,
  }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075E54' } };
  sheet.autoFilter = { from: 'A1', to: 'Q1' };
  ['D', 'J', 'K', 'L', 'M', 'N', 'O', 'P'].forEach((column) => { sheet.getColumn(column).numFmt = 'R$ #,##0.00'; });
  sheet.eachRow((row, index) => { if (index > 1 && index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F8F5' } }; });
  const addDetailSheet = (name: string, headers: string[], data: Array<Array<string|number>>) => {
    const detail = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    detail.addRow(headers);
    data.forEach((values) => detail.addRow(values));
    detail.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detail.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075E54' } };
    detail.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1,detail.rowCount), column: headers.length } };
    detail.columns.forEach((column) => { column.width = 22; });
  };
  addDetailSheet('Faltas e atrasos',['Funcionário','Faltas','Atrasos (h)','Saídas antecipadas (h)'],rows.map((row)=>[row.employee.full_name,row.absenceDays,row.lateMinutes/60,row.earlyLeaveMinutes/60]));
  addDetailSheet('Horas extras',['Funcionário','Horas extras','Valor estimado'],rows.map((row)=>[row.employee.full_name,row.overtimeMinutes/60,row.overtimeAmount]));
  addDetailSheet('Comissões',['Funcionário','Comissões','Bonificações'],rows.map((row)=>[row.employee.full_name,row.commissions,row.bonuses]));
  addDetailSheet('Adiantamentos',['Funcionário','Adiantamentos'],rows.map((row)=>[row.employee.full_name,row.advances]));
  addDetailSheet('Folgas',['Funcionário','Folgas no período'],rows.map((row)=>[row.employee.full_name,row.daysOff]));
  addDetailSheet('Banco de horas',['Funcionário','Saldo (h)'],rows.map((row)=>[row.employee.full_name,row.bankMinutes/60]));
  addDetailSheet('Pagamentos',['Funcionário','Saldo previsto','Status'],rows.map((row)=>[row.employee.full_name,row.netAmount,row.status]));
  const buffer = await workbook.xlsx.writeBuffer();
  download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `fechamento-equipe-${competence}.xlsx`);
}

export async function exportPayrollPdf(rows: PayrollPreviewRow[], competence: string, restaurantName: string, responsible: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setTextColor(7, 94, 84);
  doc.setFontSize(18);
  doc.text('Fechamento de Equipe / Prévia de Pagamento', 14, 18);
  doc.setTextColor(80, 91, 107);
  doc.setFontSize(10);
  doc.text(`${restaurantName}  •  Competência ${competence}`, 14, 25);
  autoTable(doc, {
    startY: 31,
    head: [['Funcionário', 'Cargo', 'CPF', 'Base', 'Trabalhado', 'Extras', 'Faltas', 'Comissões', 'Adiant.', 'Proventos', 'Descontos', 'Saldo']],
    body: rows.map((row) => [row.employee.full_name, row.employee.job_title || '-', maskCpf(row.employee.cpf), money(row.baseSalary), hours(row.workedMinutes), hours(row.overtimeMinutes), String(row.absenceDays), money(row.commissions), money(row.advances), money(row.totalEarnings), money(row.totalDeductions), money(row.netAmount)]),
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [7, 94, 84] },
    alternateRowStyles: { fillColor: [242, 248, 245] },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} por ${responsible} • Documento gerencial, não substitui folha oficial.`, 14, 202);
    doc.text(`Página ${page}/${pages}`, 270, 202);
  }
  doc.save(`fechamento-equipe-${competence}.pdf`);
}

export async function exportTimeSheetPdf(row: PayrollPreviewRow, competence: string, restaurantName: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF();
  doc.setTextColor(7, 94, 84);
  doc.setFontSize(18);
  doc.text('Espelho de Ponto', 14, 18);
  doc.setTextColor(70);
  doc.setFontSize(10);
  doc.text(`${restaurantName} • ${row.employee.full_name} • ${competence}`, 14, 25);
  autoTable(doc, {
    startY: 31,
    head: [['Dia', 'Previsto', 'Trabalhado', 'Intervalo', 'Extra', 'Atraso', 'Banco', 'Ocorrência']],
    body: row.days.map((day) => [day.date.split('-').reverse().join('/'), hours(day.expectedMinutes), hours(day.workedMinutes), hours(day.breakMinutes), hours(day.overtimeMinutes), hours(day.lateMinutes), `${day.bankMinutes < 0 ? '-' : '+'}${hours(day.bankMinutes)}`, day.occurrence || (day.incomplete ? 'Ponto incompleto' : day.isAbsence ? 'Falta' : day.isDayOff ? 'Folga' : 'OK')]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [7, 94, 84] },
  });
  doc.save(`espelho-ponto-${row.employee.full_name.replace(/\s+/g, '-').toLowerCase()}-${competence}.pdf`);
}
