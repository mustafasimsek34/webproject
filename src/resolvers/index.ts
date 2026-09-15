import Resolver from '@forge/resolver';
import { computeStatus, assignedAccountIds, completion } from '../domain/status';
import { confirmationKey, makeConfirmation } from '../domain/confirm';
import { ConfirmationRecord, ConfirmRequest, ConfirmResponse, PageConfig, PageDetailItem, PageDetailResponse, PageStatusRequest, PageStatusResponse, Result } from '../shared/types';
import { Actor, requireManager, requireSettingsAdmin } from './auth';
import { actorFromInvocation } from './actor';
import { DashboardPage } from './dashboard';
import { ForgeGroupMembershipReader, ForgePageReader, mapPool, userCanReadPage, userCanUpdatePage } from '../storage/confluence';
import { KvsAuditStore, KvsConfigStore, KvsConfirmationStore, KvsSettingsStore } from '../storage/kvs';
import { exportRows, buildPdf } from './export';
export { exportRows, buildPdf };

export interface ResolverContext { actor: Actor; }
const confirmations = new KvsConfirmationStore();
const configs = new KvsConfigStore();
const settings = new KvsSettingsStore();
const audit = new KvsAuditStore();
const pageReader = new ForgePageReader();
const groupReader = new ForgeGroupMembershipReader();

function isPageRequest(data: unknown): data is PageStatusRequest {
	return typeof data === 'object' && data !== null && typeof (data as PageStatusRequest).pageId === 'string';
}

async function groupMembers(config: PageConfig | undefined): Promise<Record<string, string[]>> {
	if (!config?.assignedGroups.length) return {};
	const entries = await Promise.all(config.assignedGroups.map(async (groupId) => [groupId, await groupReader.members(groupId)] as const));
	return Object.fromEntries(entries);
}

async function canConfigure(actor: Actor, pageId: string): Promise<boolean> {
	if (actor.isConfluenceAdmin || actor.isComplianceManager) return true;
	if (!actor.accountId) return false;
	return userCanUpdatePage(pageId, actor.accountId);
}

async function requireConfigure(actor: Actor, pageId: string): Promise<Result<true>> {
	if (await canConfigure(actor, pageId)) return { ok: true, data: true };
	const access = requireManager(actor);
	return access.ok ? { ok: false, code: 'FORBIDDEN', message: 'You cannot configure this page.' } : access;
}

async function ensureTracked(pageId: string, spaceKey: string, actorId: string): Promise<void> {
	const existing = await configs.get(pageId);
	if (existing) return;
	const now = new Date().toISOString();
	await configs.save({
		pageId,
		active: true,
		spaceKey,
		assignedUsers: [],
		assignedGroups: [],
		dueDate: "",
		reconfirmOnChange: false,
		createdBy: actorId,
		createdAt: now,
		updatedBy: actorId,
		updatedAt: now
	});
}

async function statusFor(context: ResolverContext, input: PageStatusRequest, page: Awaited<ReturnType<ForgePageReader['read']>>, records: ConfirmationRecord[], config: PageConfig | undefined): Promise<PageStatusResponse> {
	const currentVersion = page.version;
	const assigned = config?.active ? assignedAccountIds(config, await groupMembers(config)).includes(context.actor.accountId) : false;
	const status = computeStatus({ records, currentVersion, reconfirmOnChange: config?.active ? config.reconfirmOnChange : false, canView: page.canView, pageDeleted: page.deleted });
	const latest = records.reduce<ConfirmationRecord | undefined>((best, record) => (!best || record.pageVersion > best.pageVersion ? record : best), undefined);
	return {
		pageId: input.pageId,
		status,
		currentVersion,
		confirmedAt: latest?.confirmedAt,
		confirmedVersion: latest?.pageVersion,
		assignmentType: assigned ? 'assigned' : 'voluntary',
		dueDate: config?.dueDate,
		canConfigure: await canConfigure(context.actor, input.pageId),
		pageTitle: page.title
	};
}

export async function getPageStatus(context: ResolverContext, data: unknown): Promise<Result<PageStatusResponse>> {
	if (!isPageRequest(data)) return { ok: false, code: 'INVALID_REQUEST', message: 'Invalid page status request.' };
	if (!context.actor.accountId) return { ok: false, code: 'UNAUTHENTICATED', message: 'An authenticated account is required.' };
	const page = await pageReader.read(data.pageId);
	const config = await configs.get(data.pageId);
	const records = page.canView ? await confirmations.byPageUser(data.pageId, context.actor.accountId) : [];
	return { ok: true, data: await statusFor(context, data, page, records, config) };
}

export async function confirm(context: ResolverContext, data: unknown): Promise<Result<ConfirmResponse>> {
	if (!isPageRequest(data) || typeof (data as ConfirmRequest).clientPageVersion !== 'number') return { ok: false, code: 'INVALID_REQUEST', message: 'Invalid confirmation request.' };
	const input = data as ConfirmRequest;
	if (!context.actor.accountId) return { ok: false, code: 'UNAUTHENTICATED', message: 'An authenticated account is required.' };
	const page = await pageReader.read(input.pageId);
	if (page.deleted) return { ok: false, code: 'PAGE_DELETED', message: 'This page no longer exists.' };
	if (!page.canView) return { ok: false, code: 'FORBIDDEN', message: 'You cannot view this page.' };
	const config = await configs.get(input.pageId);
	const assignmentType = config?.active && assignedAccountIds(config, await groupMembers(config)).includes(context.actor.accountId) ? 'assigned' : 'voluntary';
	const serverPageVersion = page.version;
	if (!page.spaceKey) return { ok: false, code: 'SPACE_UNRESOLVED', message: 'The page space could not be resolved.' };
	const record = makeConfirmation({ pageId: input.pageId, accountId: context.actor.accountId, serverPageVersion, clientPageVersion: input.clientPageVersion, spaceKey: page.spaceKey, confirmedAt: new Date().toISOString(), assignmentType, appVersion: '1.0.0' });
	if ('pageChanged' in record) return { ok: false, code: 'PAGE_CHANGED', message: 'This page was just updated.' };
	const wasCreated = await confirmations.putIfAbsent(confirmationKey(input.pageId, context.actor.accountId, serverPageVersion), record);
	await ensureTracked(input.pageId, page.spaceKey, context.actor.accountId);
	const stored = await confirmations.byPageUser(input.pageId, context.actor.accountId);
	return { ok: true, data: { ...(await statusFor(context, input, page, stored.length ? stored : [record], config)), created: wasCreated } };
}

export async function getConfig(context: ResolverContext, data: unknown): Promise<Result<unknown>> {
	const pageId = typeof data === 'object' && data !== null && typeof (data as { pageId?: unknown }).pageId === 'string' ? (data as { pageId: string }).pageId : undefined;
	if (!pageId) return { ok: false, code: 'INVALID_REQUEST', message: 'Invalid config request.' };
	const access = await requireConfigure(context.actor, pageId);
	if (!access.ok) return access;
	return { ok: true, data: await configs.get(pageId) };
}

export async function saveConfig(context: ResolverContext, data: unknown): Promise<Result<unknown>> {
	if (!isPageConfig(data)) return { ok: false, code: 'INVALID_REQUEST', message: 'Invalid page config.' };
	const access = await requireConfigure(context.actor, data.pageId);
	if (!access.ok) return access;
	const before = await configs.get(data.pageId);
	const now = new Date().toISOString();
	const next: PageConfig = {
		...data,
		active: true,
		dueDate: data.dueDate || null,
		updatedBy: context.actor.accountId,
		updatedAt: now,
		createdBy: before?.createdBy ?? context.actor.accountId,
		createdAt: before?.createdAt ?? now
	};
	await configs.save(next);
	if (JSON.stringify(before) !== JSON.stringify(next)) {
		await audit.append({ pageId: data.pageId, actorId: context.actor.accountId, timestamp: now, before: before ?? null, after: next });
	}
	return { ok: true, data: next };
}

export async function getDashboardResolver(context: ResolverContext, _pages: DashboardPage[] = []): Promise<Result<DashboardPage[]>> {
	const access = requireManager(context.actor);
	if (!access.ok) return access;
	const pages: DashboardPage[] = [];
	let cursor: string | undefined;
	const today = new Date().toISOString().slice(0, 10);
	do {
		const batch = await configs.listActive(cursor, 25);
		for (const config of batch.items) {
			const page = await pageReader.read(config.pageId, false);
			if (!page.deleted && !page.canView) continue;
			const members = await groupMembers(config);
			const assignedIds = assignedAccountIds(config, members);
			const records: ConfirmationRecord[] = [];
			let confirmationCursor: string | undefined;
			do {
				const confirmationBatch = await confirmations.byPage(config.pageId, confirmationCursor, 100);
				records.push(...confirmationBatch.items);
				confirmationCursor = confirmationBatch.nextCursor;
			} while (confirmationCursor);
			const statuses = assignedIds.map((accountId) => ({
				status: computeStatus({
					records: records.filter((record) => record.accountId === accountId),
					currentVersion: page.version,
					reconfirmOnChange: config.reconfirmOnChange,
					canView: true,
					pageDeleted: page.deleted
				}),
				assignmentType: 'assigned' as const
			}));
			const counts = completion(statuses);
			const dueDate = config.dueDate;
			pages.push({
				pageId: config.pageId,
				title: page.title ?? '',
				spaceKey: page.spaceKey || config.spaceKey,
				assigned: assignedIds.length,
				confirmed: counts.confirmed,
				percent: counts.percent,
				deleted: page.deleted,
				canView: page.canView,
				dueDate: dueDate ?? undefined,
				overdue: Boolean(dueDate && dueDate < today && counts.percent !== 1)
			});
		}
		cursor = batch.nextCursor;
	} while (cursor);
	return { ok: true, data: pages };
}

export async function getPageDetail(context: ResolverContext, data: unknown): Promise<Result<PageDetailResponse>> {
	const access = requireManager(context.actor);
	if (!access.ok) return access;
	if (!isPageRequest(data)) return { ok: false, code: 'INVALID_REQUEST', message: 'Invalid page detail request.' };
	const page = await pageReader.read(data.pageId, false);
	const config = await configs.get(data.pageId);
	if (!config) return { ok: true, data: { pageId: data.pageId, title: page.title ?? '', currentVersion: page.version, assigned: 0, confirmed: 0, cannotView: 0, items: [], history: await audit.byPage(data.pageId) } };
	const members = await groupMembers(config);
	const direct = config.assignedUsers.map((accountId) => ({ accountId, assignmentType: 'assigned' as const }));
	const grouped = config.assignedGroups.flatMap((groupId) => (members[groupId] ?? []).map((accountId) => ({ accountId, assignmentType: 'assigned' as const, groupId })));
	const records: ConfirmationRecord[] = [];
	let cursor: string | undefined;
	do {
		const batch = await confirmations.byPage(data.pageId, cursor, 100);
		records.push(...batch.items);
		cursor = batch.nextCursor;
	} while (cursor);
	const assigned = [...new Map([...direct, ...grouped].map((item) => [item.accountId, item])).values()];
	const assignedIds = new Set(assigned.map((item) => item.accountId));
	const voluntary = records
		.filter((record) => record.assignmentType === 'voluntary' && !assignedIds.has(record.accountId))
		.map((record) => ({ accountId: record.accountId, assignmentType: 'voluntary' as const }));
	const people = [...assigned, ...voluntary];
	const items: PageDetailItem[] = await mapPool(people, 10, async (item) => {
		const userRecords = records.filter((record) => record.accountId === item.accountId);
		const latest = userRecords.reduce<ConfirmationRecord | undefined>((best, record) => (!best || record.pageVersion > best.pageVersion ? record : best), undefined);
		const permission = page.deleted ? 'yes' : await userCanReadPage(data.pageId, item.accountId);
		const deletedUser = permission === 'unknown';
		return {
			...item,
			deletedUser,
			status: computeStatus({
				records: userRecords,
				currentVersion: page.version,
				reconfirmOnChange: config.reconfirmOnChange,
				canView: permission === 'yes',
				pageDeleted: page.deleted
			}),
			pageVersion: latest?.pageVersion,
			confirmedAt: latest?.confirmedAt
		};
	});
	const assignedItems = items.filter((item) => item.assignmentType === 'assigned');
	return {
		ok: true,
		data: {
			pageId: data.pageId,
			title: page.title ?? '',
			currentVersion: page.version,
			assigned: assigned.length,
			confirmed: assignedItems.filter((item) => item.status === 'confirmed').length,
			cannotView: assignedItems.filter((item) => item.status === 'cannot-view').length,
			items,
			history: await audit.byPage(data.pageId)
		}
	};
}

export async function getSettings(context: ResolverContext, _data: unknown): Promise<Result<unknown>> {
	const access = requireSettingsAdmin(context.actor);
	return access.ok ? { ok: true, data: await settings.get() } : access;
}

export async function saveSettings(context: ResolverContext, data: unknown): Promise<Result<unknown>> {
	const access = requireSettingsAdmin(context.actor);
	if (!access.ok) return access;
	if (!isSettings(data)) return { ok: false, code: 'INVALID_REQUEST', message: 'Invalid settings.' };
	const before = await settings.get();
	await settings.save(data);
	return { ok: true, data: { ...data, previous: before } };
}

export async function searchPages(context: ResolverContext, input: { title?: string } = {}): Promise<Result<DashboardPage[]>> {
	const access = requireManager(context.actor);
	if (!access.ok) return access;
	const title = typeof input.title === 'string' ? input.title.trim() : '';
	if (!title) return { ok: true, data: [] };
	const pages = await pageReader.search(title);
	return { ok: true, data: pages.filter((page) => page.canView).map((page) => ({ pageId: page.pageId, title: page.title ?? '', spaceKey: page.spaceKey, assigned: 0, confirmed: 0, percent: null })) };
}

export function listPageChildren(context: ResolverContext, pages: DashboardPage[]) {
	const access = requireManager(context.actor);
	return access.ok ? { ok: true as const, data: pages.filter((page) => page.canView !== false) } : access;
}

function isPageConfig(value: unknown): value is PageConfig {
	return typeof value === 'object' && value !== null && typeof (value as PageConfig).pageId === 'string' && Array.isArray((value as PageConfig).assignedUsers) && Array.isArray((value as PageConfig).assignedGroups);
}

function isSettings(value: unknown): value is { complianceManagerUserIds: string[]; complianceManagerGroupIds: string[] } {
	return typeof value === 'object' && value !== null && Array.isArray((value as { complianceManagerUserIds?: unknown }).complianceManagerUserIds) && Array.isArray((value as { complianceManagerGroupIds?: unknown }).complianceManagerGroupIds);
}

function unwrap(payload: unknown): unknown {
	if (payload && typeof payload === 'object' && 'data' in payload) return (payload as { data: unknown }).data;
	return payload;
}

function payloadRecord(payload: unknown): Record<string, unknown> {
	return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
}

async function run<T>(work: () => Promise<T>): Promise<T | Result<never>> {
	try {
		return await work();
	} catch (error) {
		return { ok: false, code: 'INTERNAL', message: error instanceof Error ? error.message : 'Request failed.' };
	}
}

const resolver = new Resolver();
resolver.define('getPageStatus', async ({ payload, context }) => run(async () => getPageStatus({ actor: await actorFromInvocation(context) }, unwrap(payload))));
resolver.define('confirm', async ({ payload, context }) => run(async () => confirm({ actor: await actorFromInvocation(context) }, unwrap(payload))));
resolver.define('getConfig', async ({ payload, context }) => run(async () => getConfig({ actor: await actorFromInvocation(context) }, unwrap(payload))));
resolver.define('saveConfig', async ({ payload, context }) => run(async () => saveConfig({ actor: await actorFromInvocation(context) }, unwrap(payload))));
resolver.define('getDashboard', async ({ payload, context }) => run(async () => getDashboardResolver({ actor: await actorFromInvocation(context) }, (payloadRecord(payload).pages as DashboardPage[] | undefined) ?? [])));
resolver.define('getPageDetail', async ({ payload, context }) => run(async () => getPageDetail({ actor: await actorFromInvocation(context) }, unwrap(payload))));
resolver.define('getSettings', async ({ payload, context }) => run(async () => getSettings({ actor: await actorFromInvocation(context) }, unwrap(payload))));
resolver.define('saveSettings', async ({ payload, context }) => run(async () => saveSettings({ actor: await actorFromInvocation(context) }, unwrap(payload))));
resolver.define('searchPages', async ({ payload, context }) => run(async () => searchPages({ actor: await actorFromInvocation(context) }, payloadRecord(payload) as { title?: string })));
resolver.define('listPageChildren', async ({ payload, context }) => run(async () => listPageChildren({ actor: await actorFromInvocation(context) }, (payloadRecord(payload).pages as DashboardPage[]) ?? [])));
resolver.define('exportRows', async ({ payload, context }) => {
	const input = payloadRecord(payload);
	return run(async () => exportRows(await actorFromInvocation(context), input.filters as never, input.cursor as string | undefined, String(input.exportedAtUtc ?? ''), String(input.appVersion ?? '1.0.0')));
});
resolver.define('buildPdfExport', async ({ payload, context }) => {
	const input = payloadRecord(payload);
	return run(async () => buildPdf(await actorFromInvocation(context), String(input.scope ?? ''), String(input.exportedAtUtc ?? ''), String(input.appVersion ?? '1.0.0'), (input.rows as never) ?? []));
});

export const handler = resolver.getDefinitions();
export const bylineProps = async ({ context }: { context: { accountId?: string; extension?: { content?: { id?: string } } } }) => {
	const pageId = context.extension?.content?.id;
	if (!pageId) return { dynamicProperties: {} };
	const actor = await actorFromInvocation(context);
	const result = await getPageStatus({ actor }, { pageId });
	if (!result.ok || result.data.status === 'cannot-view' || result.data.status === 'page-deleted') return { dynamicProperties: {} };
	if (result.data.assignmentType === 'voluntary' && result.data.status === 'outstanding') return { dynamicProperties: {} };
	const text = result.data.status === 'confirmed' ? 'Confirmed' : result.data.status === 'expired' ? 'Re-confirmation required' : 'Confirmation required';
	return { dynamicProperties: { text } };
};
