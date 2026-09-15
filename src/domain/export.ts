import { ConfirmationRecord, ExportFilters, ExportRow, PageConfig } from '../shared/types';
import { computeStatus, assignedAccountIds } from './status';

export interface ExportPage { id: string; title: string; spaceKey: string; currentVersion: number; deleted?: boolean; }
export interface ExportUser { accountId: string; displayName: string; canView: boolean; deleted?: boolean; }

export function buildExportRows(pages: ExportPage[], configs: PageConfig[], confirmations: ConfirmationRecord[], users: ExportUser[], filters: ExportFilters, exportedAtUtc: string, appVersion: string, groupMembers: Record<string, string[]> = {}): ExportRow[] {
  const configByPage = new Map(configs.map((config) => [config.pageId, config]));
  const usersById = new Map(users.map((user) => [user.accountId, user]));
  const recordsByPageUser = new Map<string, ConfirmationRecord[]>();
  for (const record of confirmations) {
    const key = `${record.pageId}:${record.accountId}`;
    recordsByPageUser.set(key, [...(recordsByPageUser.get(key) ?? []), record]);
  }
  const rows: ExportRow[] = [];
  for (const page of pages) {
    if (filters.scope === 'page' && page.id !== filters.pageId) continue;
    if (filters.scope === 'space' && page.spaceKey !== filters.spaceKey) continue;
    const config = configByPage.get(page.id);
    if (!config) continue;
    const assigned = assignedAccountIds(config, groupMembers);
    const accountIds = new Set([
      ...assigned,
      ...confirmations.filter((record) => record.pageId === page.id).map((record) => record.accountId)
    ]);
    for (const accountId of accountIds) {
      const user = usersById.get(accountId) ?? { accountId, displayName: accountId, canView: true };
      const records = recordsByPageUser.get(`${page.id}:${accountId}`) ?? [];
      const latest = records.reduce<ConfirmationRecord | undefined>((best, record) => (!best || record.pageVersion > best.pageVersion ? record : best), undefined);
      const assignmentType = assigned.includes(accountId) ? 'assigned' : 'voluntary';
      const computedStatus = page.deleted ? 'outstanding' : computeStatus({ records, currentVersion: page.currentVersion, reconfirmOnChange: config.reconfirmOnChange, canView: user.canView });
      const status = computedStatus === 'page-deleted' ? 'outstanding' : computedStatus;
      if (filters.status && status !== filters.status) continue;
      if (filters.fromUtc && latest && latest.confirmedAt < filters.fromUtc) continue;
      if (filters.toUtc && latest && latest.confirmedAt > filters.toUtc) continue;
      rows.push({ pageTitle: page.deleted ? `[deleted page ${page.id}]` : page.title, pageId: page.id, spaceKey: page.spaceKey, pageVersionConfirmed: latest?.pageVersion ?? '', userDisplayName: user.deleted ? '[deleted user]' : user.displayName, userAccountId: accountId, assignmentType, status, confirmedAtUtc: latest?.confirmedAt ?? '', dueDate: config.dueDate ?? '', exportedAtUtc, appVersion });
    }
  }
  return rows;
}
