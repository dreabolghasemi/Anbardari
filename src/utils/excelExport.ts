import * as XLSX from 'xlsx';
import { formatShamsiDate } from './persian.js';

export function downloadExcelFile(rows: Record<string, any>[], fileName: string, sheetTitle = 'گزارش'): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!views'] = [{ rightToLeft: true }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

  // Generate binary Excel array
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
