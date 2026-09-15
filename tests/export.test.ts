import { buildPdfExport } from '../src/domain/pdf';
import { toCsv } from '../src/domain/csv';
import { buildExportRows } from '../src/domain/export';
import { ExportRow } from '../src/shared/types';

const row: ExportRow = { pageTitle: 'Policy', pageId: 'p', spaceKey: 'S', pageVersionConfirmed: 2, userDisplayName: 'User', userAccountId: 'u', assignmentType: 'assigned', status: 'confirmed', confirmedAtUtc: '2026-01-01T00:00:00Z', dueDate: '', exportedAtUtc: '2026-01-01T00:00:00Z', appVersion: '1' };
test('PDF and CSV are built from the same rows and export metadata', () => { const pdf = buildPdfExport('site', row.exportedAtUtc, row.appVersion, [row]); expect(pdf.rows).toEqual([row]); expect(pdf.scope).toBe('site'); expect(toCsv(pdf.rows)).toContain('Policy\tp\tS'); });
test('export includes outstanding group assignees resolved at read time', () => {
  const config = { pageId: 'p', active: true, spaceKey: 'S', assignedUsers: [], assignedGroups: ['g'], dueDate: null, reconfirmOnChange: false, createdBy: 'a', createdAt: '', updatedBy: 'a', updatedAt: '' };
  const rows = buildExportRows(
    [{ id: 'p', title: 'Policy', spaceKey: 'S', currentVersion: 2 }],
    [config],
    [],
    [{ accountId: 'v', displayName: 'Group Member', canView: true }],
    { scope: 'site' },
    row.exportedAtUtc,
    row.appVersion,
    { g: ['v'] }
  );
  expect(rows).toEqual([expect.objectContaining({ userAccountId: 'v', assignmentType: 'assigned', status: 'outstanding', pageVersionConfirmed: '' })]);
});
test('export includes confirmers even without assignees or a user directory match', () => {
  const config = { pageId: 'p', active: true, spaceKey: 'S', assignedUsers: [], assignedGroups: [], dueDate: null, reconfirmOnChange: false, createdBy: 'a', createdAt: '', updatedBy: 'a', updatedAt: '' };
  const rows = buildExportRows(
    [{ id: 'p', title: 'Policy', spaceKey: 'S', currentVersion: 2 }],
    [config],
    [{ pageId: 'p', accountId: 'u1', pageVersion: 2, confirmedAt: row.confirmedAtUtc, spaceKey: 'S', assignmentType: 'assigned', appVersion: '1', schemaVersion: 1 }],
    [],
    { scope: 'page', pageId: 'p' },
    row.exportedAtUtc,
    row.appVersion
  );
  expect(rows).toEqual([expect.objectContaining({ userAccountId: 'u1', userDisplayName: 'u1', status: 'confirmed', assignmentType: 'voluntary' })]);
});
test('export remains complete for 10,000 confirmation records', () => { const confirmations = Array.from({ length: 10000 }, (_, index) => ({ pageId: 'p', accountId: `u-${index}`, pageVersion: 2, confirmedAt: row.confirmedAtUtc, spaceKey: 'S', assignmentType: 'assigned' as const, appVersion: row.appVersion, schemaVersion: 1 as const })); const users = confirmations.map((item) => ({ accountId: item.accountId, displayName: `User ${item.accountId}`, canView: true })); const config = { pageId: 'p', active: true, spaceKey: 'S', assignedUsers: users.map((user) => user.accountId), assignedGroups: [], dueDate: null, reconfirmOnChange: false, createdBy: 'a', createdAt: '', updatedBy: 'a', updatedAt: '' }; expect(buildExportRows([{ id: 'p', title: 'Policy', spaceKey: 'S', currentVersion: 2 }], [config], confirmations, users, { scope: 'site' }, row.exportedAtUtc, row.appVersion)).toHaveLength(10000); });
