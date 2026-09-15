import { buildExportRows, ExportPage, ExportUser } from '../domain/export';
import { toCsv } from '../domain/csv';
import { buildPdfExport } from '../domain/pdf';
import { ConfirmationRecord, ExportFilters, ExportPageResult, ExportRow, PageConfig, Result } from '../shared/types';
import { Actor, requireManager } from './auth';
import { ForgeGroupMembershipReader, ForgePageReader, ForgeUserReader } from '../storage/confluence';
import { KvsConfigStore, KvsConfirmationStore } from '../storage/kvs';
import { assignedAccountIds } from '../domain/status';

const configStore = new KvsConfigStore();
const confirmationStore = new KvsConfirmationStore();
const pageReader = new ForgePageReader();
const groupReader = new ForgeGroupMembershipReader();
const userReader = new ForgeUserReader();

function sameId(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && String(left) === String(right));
}

async function recordsForPage(pageId: string): Promise<ConfirmationRecord[]> {
  const records: ConfirmationRecord[] = [];
  let confirmationCursor: string | undefined;
  do {
    const batch = await confirmationStore.byPage(pageId, confirmationCursor, 100);
    records.push(...batch.items);
    confirmationCursor = batch.nextCursor;
  } while (confirmationCursor);
  return records;
}

function fallbackConfig(pageId: string, spaceKey: string): PageConfig {
  return { pageId, active: true, spaceKey, assignedUsers: [], assignedGroups: [], dueDate: null, reconfirmOnChange: false, createdBy: '', createdAt: '', updatedBy: '', updatedAt: '' };
}

export async function exportRows(actor: Actor, filters: ExportFilters, cursor: string | undefined, exportedAtUtc: string, appVersion: string): Promise<Result<ExportPageResult>> {
  const access = requireManager(actor); if (!access.ok) return access;
  if (!isFilters(filters)) return { ok: false, code: 'INVALID_REQUEST', message: 'Invalid export filters.' };
  const configs: PageConfig[] = [];
  let nextCursor: string | undefined;
  if (filters.scope === 'page') {
    const pageId = String(filters.pageId ?? '');
    if (!pageId) return { ok: true, data: { rows: [] } };
    const config = await configStore.get(pageId);
    const records = await recordsForPage(pageId);
    if (config) configs.push(config);
    else if (records.length) configs.push(fallbackConfig(pageId, records[0].spaceKey));
    return packExport(configs, filters, exportedAtUtc, appVersion, new Map([[pageId, records]]));
  }
  const pageBatch = await configStore.listActive(cursor, 25);
  nextCursor = pageBatch.nextCursor;
  configs.push(...pageBatch.items.filter((config) => filters.scope === 'site' || sameId(config.spaceKey, filters.spaceKey)));
  return packExport(configs, filters, exportedAtUtc, appVersion, undefined, nextCursor);
}

async function packExport(configs: PageConfig[], filters: ExportFilters, exportedAtUtc: string, appVersion: string, preloaded?: Map<string, ConfirmationRecord[]>, nextCursor?: string): Promise<Result<ExportPageResult>> {
  const pages: ExportPage[] = [];
  const confirmations: ConfirmationRecord[] = [];
  const users: ExportUser[] = [];
  const groupMembers: Record<string, string[]> = {};
  for (const config of configs) {
    const page = await pageReader.read(config.pageId, false);
    if (!page.deleted && !page.canView) continue;
    const records = preloaded?.get(config.pageId) ?? await recordsForPage(config.pageId);
    const members = Object.fromEntries(await Promise.all(config.assignedGroups.map(async (groupId) => [groupId, await groupReader.members(groupId)] as const)));
    Object.assign(groupMembers, members);
    const accountIds = [...assignedAccountIds(config, members), ...records.map((record) => record.accountId)];
    for (const accountId of new Set(accountIds)) {
      const user = await userReader.read(accountId);
      users.push({ accountId, displayName: user.displayName || accountId, canView: true, deleted: user.deleted });
    }
    confirmations.push(...records);
    pages.push({ id: config.pageId, title: page.title ?? '', spaceKey: page.spaceKey || config.spaceKey, currentVersion: page.version, deleted: page.deleted });
  }
  return { ok: true, data: { rows: buildExportRows(pages, configs, confirmations, users, filters, exportedAtUtc, appVersion, groupMembers), ...(nextCursor ? { nextCursor } : {}) } };
}
export function buildCsv(rows: ReturnType<typeof buildExportRows>): string { return toCsv(rows); }
export function buildPdf(actor: Actor, scope: string, exportedAtUtc: string, appVersion: string, rows: ExportRow[]): Result<ReturnType<typeof buildPdfExport>> { const access = requireManager(actor); if (!access.ok) return access; if (!Array.isArray(rows) || rows.some((row) => !isExportRow(row))) return { ok: false, code: 'INVALID_REQUEST', message: 'Invalid export rows.' }; return { ok: true, data: buildPdfExport(scope, exportedAtUtc, appVersion, rows) }; }
function isFilters(value: unknown): value is ExportFilters { return typeof value === 'object' && value !== null && ['page', 'space', 'site'].includes((value as ExportFilters).scope); }
function isExportRow(value: unknown): value is ExportRow { return typeof value === 'object' && value !== null && typeof (value as ExportRow).pageId === 'string' && typeof (value as ExportRow).userAccountId === 'string' && typeof (value as ExportRow).status === 'string'; }
