import { ExportRow } from '../shared/types';

export interface PdfExport { scope: string; exportedAtUtc: string; appVersion: string; rows: ExportRow[]; bytes: Uint8Array; base64: string; }

function winAnsi(text: string): Uint8Array {
  const special: Record<string, number> = { '€': 0x80, 'İ': 0xdd, 'ı': 0xfd, 'Ğ': 0xd0, 'ğ': 0xf0, 'Ş': 0xde, 'ş': 0xfe };
  return Uint8Array.from([...text].map((character) => { const code = special[character] ?? character.charCodeAt(0); return code <= 0xff ? code : 0x3f; }));
}

function pdfLiteral(text: string): Uint8Array {
  const escaped: number[] = [];
  for (const byte of winAnsi(text)) { if (byte === 0x28 || byte === 0x29 || byte === 0x5c) escaped.push(0x5c); escaped.push(byte); }
  return Uint8Array.from([0x28, ...escaped, 0x29]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function ascii(value: string): Uint8Array { return new TextEncoder().encode(value); }
function base64(bytes: Uint8Array): string { let value = ''; for (let index = 0; index < bytes.length; index += 0x8000) value += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(value); }

export function buildPdfExport(scope: string, exportedAtUtc: string, appVersion: string, rows: ExportRow[]): PdfExport {
  const grouped = new Map<string, ExportRow[]>();
  for (const row of rows) {
    const key = `${row.pageId}\t${row.pageTitle}\t${row.spaceKey}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const rowLines: string[] = [];
  for (const [key, people] of grouped) {
    const [, pageTitle, spaceKey] = key.split('\t');
    rowLines.push(`${pageTitle} (${spaceKey})`);
    for (const person of people) {
      const when = person.confirmedAtUtc || 'not confirmed';
      const version = person.pageVersionConfirmed === '' ? '-' : `v${person.pageVersionConfirmed}`;
      rowLines.push(`  ${person.userDisplayName} | ${person.status} | ${version} | ${when} | ${person.assignmentType}`);
    }
    rowLines.push('');
  }
  const lines = [`Read confirmation export | scope: ${scope} | ${rows.length} people`, `Exported at: ${exportedAtUtc} | app: ${appVersion}`, '', ...(rowLines.length ? rowLines : ['No confirmation records matched the selected filters.'])];
  const pageSize = 52;
  const pageLines = Array.from({ length: Math.max(1, Math.ceil(lines.length / pageSize)) }, (_, index) => lines.slice(index * pageSize, (index + 1) * pageSize));
  const pageObjects: Uint8Array[] = [];
  const contentObjects: Uint8Array[] = [];
  for (const linesForPage of pageLines) {
    const content = concat([ascii('BT\n/F1 8 Tf\n40 800 Td\n'), ...linesForPage.flatMap((line, index) => [pdfLiteral(line), ascii(` Tj\n${index < linesForPage.length - 1 ? '0 -14 Td\n' : ''}`)]), ascii('ET\n')]);
    contentObjects.push(concat([ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii('\nendstream')]));
  }
  const pageCount = pageLines.length;
  const firstPageObject = 3;
  const firstContentObject = firstPageObject + pageCount;
  pageObjects.push(ascii(`<< /Type /Pages /Kids [${pageLines.map((_, index) => `${firstPageObject + index} 0 R`).join(' ')}] /Count ${pageCount} >>`));
  for (let index = 0; index < pageCount; index += 1) pageObjects.push(ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${firstContentObject + pageCount} 0 R >> >> /Contents ${firstContentObject + index} 0 R >>`));
  pageObjects.push(...contentObjects);
  pageObjects.push(ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  const objects = [ascii('<< /Type /Catalog /Pages 2 0 R >>'), ...pageObjects];
  const chunks: Uint8Array[] = [ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) { offsets.push(chunks.reduce((total, chunk) => total + chunk.length, 0)); chunks.push(ascii(`${index + 1} 0 obj\n`), objects[index], ascii('\nendobj\n')); }
  const xrefOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  chunks.push(ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`));
  const bytes = concat(chunks);
  return { scope, exportedAtUtc, appVersion, rows: rows.map((row) => ({ ...row })), bytes, base64: base64(bytes) };
}
