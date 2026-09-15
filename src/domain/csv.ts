import { ExportRow } from '../shared/types';

export const CSV_HEADERS = ['page_title', 'page_id', 'space_key', 'page_version_confirmed', 'user_display_name', 'user_account_id', 'assignment_type', 'status', 'confirmed_at_utc', 'due_date', 'exported_at_utc', 'app_version'];

function quote(value: unknown): string {
  const text = String(value ?? '');
  return /[\t"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: ExportRow[]): string {
  return [CSV_HEADERS, ...rows.map((row) => [row.pageTitle, row.pageId, row.spaceKey, row.pageVersionConfirmed, row.userDisplayName, row.userAccountId, row.assignmentType, row.status, row.confirmedAtUtc, row.dueDate, row.exportedAtUtc, row.appVersion])]
    .map((line) => line.map(quote).join('\t')).join('\r\n') + '\r\n';
}

export function utf16LeBom(text: string): Uint8Array {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff; bytes[1] = 0xfe;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes[2 + index * 2] = code & 0xff;
    bytes[3 + index * 2] = code >> 8;
  }
  return bytes;
}
