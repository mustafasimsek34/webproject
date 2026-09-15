import api, { route } from '@forge/api';

export interface PageSnapshot {
	pageId: string;
	title?: string;
	version: number;
	spaceKey: string;
	deleted: boolean;
	canView: boolean;
}

export type PermissionResult = 'yes' | 'no' | 'unknown';

type ConfluenceResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

function isAuthError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /authentication required|unauthorized|401/i.test(message);
}

async function requestConfluence(path: ReturnType<typeof route>, asApp = false): Promise<ConfluenceResponse> {
	const client = asApp ? api.asApp() : api.asUser();
	return client.requestConfluence(path);
}

export async function confluenceRequest(path: ReturnType<typeof route>, preferUser = true): Promise<ConfluenceResponse> {
	const attempts = preferUser ? [false, true] : [true, false];
	let last: ConfluenceResponse | undefined;
	for (const asApp of attempts) {
		try {
			const response = await requestConfluence(path, asApp);
			last = response;
			if (response.status === 401 && !asApp) continue;
			return response;
		} catch (error) {
			if (isAuthError(error)) continue;
			throw error;
		}
	}
	return last ?? { ok: false, status: 401, json: async () => ({}) };
}

async function checkPermission(asApp: boolean, pageId: string, accountId: string, operation: 'read' | 'update'): Promise<PermissionResult> {
	try {
		const response = await confluenceRequest(route`/wiki/rest/api/content/${pageId}/permission/check`, !asApp);
		if (response.status === 404) return 'unknown';
		if (!response.ok) return 'no';
		const body = (await response.json()) as { hasPermission?: boolean };
		return body.hasPermission ? 'yes' : 'no';
	} catch {
		return 'unknown';
	}
}

export async function userCanUpdatePage(pageId: string, accountId: string): Promise<boolean> {
	return (await checkPermission(false, pageId, accountId, 'update')) === 'yes';
}

export async function userCanReadPage(pageId: string, accountId: string): Promise<PermissionResult> {
	return checkPermission(true, pageId, accountId, 'read');
}

export async function mapPool<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
	const output: R[] = [];
	for (let index = 0; index < items.length; index += concurrency) {
		output.push(...await Promise.all(items.slice(index, index + concurrency).map(mapper)));
	}
	return output;
}

export async function userHasAdminister(accountId: string): Promise<boolean> {
	if (!accountId) return false;
	const paths = [
		route`/wiki/rest/api/user/current?expand=operations`,
		route`/wiki/rest/api/user?accountId=${accountId}&expand=operations`
	];
	for (const path of paths) {
		try {
			const response = await confluenceRequest(path);
			if (!response.ok) continue;
			const body = (await response.json()) as { operations?: Array<{ operation?: string }> };
			if ((body.operations ?? []).some((operation) => operation.operation === 'administer')) return true;
		} catch {
			continue;
		}
	}
	return false;
}

export interface PageReader {
	read(pageId: string, preferUser?: boolean): Promise<PageSnapshot>;
	search(title: string): Promise<PageSnapshot[]>;
}

export class ForgePageReader implements PageReader {
	async read(pageId: string, preferUser = true): Promise<PageSnapshot> {
		try {
			const response = await confluenceRequest(route`/wiki/api/v2/pages/${pageId}`, preferUser);
			if (response.status === 404) return { pageId, version: 0, spaceKey: '', deleted: true, canView: false };
			if (response.status === 401 || response.status === 403) return { pageId, version: 0, spaceKey: '', deleted: false, canView: false };
			if (!response.ok) return { pageId, version: 0, spaceKey: '', deleted: false, canView: false };
			const page = (await response.json()) as { title?: string; version?: { number?: number }; space?: { key?: string } };
			const version = page.version?.number;
			if (typeof version !== 'number') return { pageId, title: page.title ?? '', version: 1, spaceKey: await this.readSpaceKey(pageId), deleted: false, canView: true };
			const spaceKey = page.space?.key ?? await this.readSpaceKey(pageId);
			return { pageId, title: page.title ?? '', version, spaceKey, deleted: false, canView: true };
		} catch {
			return { pageId, version: 0, spaceKey: '', deleted: false, canView: false };
		}
	}

	private async readSpaceKey(pageId: string): Promise<string> {
		try {
			const response = await confluenceRequest(route`/wiki/rest/api/content/${pageId}?expand=space`);
			if (!response.ok) return `space-${pageId}`;
			const content = (await response.json()) as { space?: { key?: string } };
			return content.space?.key || `space-${pageId}`;
		} catch {
			return `space-${pageId}`;
		}
	}

	async search(title: string): Promise<PageSnapshot[]> {
		try {
			const response = await confluenceRequest(route`/wiki/api/v2/pages?title=${title}&limit=25`);
			if (!response.ok) return [];
			const body = (await response.json()) as { results?: Array<{ id?: string; title?: string; version?: { number?: number }; space?: { key?: string } }> };
			return (body.results ?? []).flatMap((page) => page.id && typeof page.version?.number === 'number' ? [{ pageId: page.id, title: page.title ?? '', version: page.version.number, spaceKey: page.space?.key ?? '', deleted: false, canView: true }] : []);
		} catch {
			return [];
		}
	}
}

export interface GroupMembershipReader {
	members(groupId: string): Promise<string[]>;
}

export interface UserSnapshot {
	accountId: string;
	displayName: string;
	deleted?: boolean;
}

export interface UserReader {
	read(accountId: string): Promise<UserSnapshot>;
}

export class ForgeUserReader implements UserReader {
	async read(accountId: string): Promise<UserSnapshot> {
		try {
			const response = await confluenceRequest(route`/wiki/rest/api/user?accountId=${accountId}`);
			if (response.status === 404) return { accountId, displayName: '[deleted user]', deleted: true };
			if (!response.ok) return { accountId, displayName: accountId };
			const user = (await response.json()) as { displayName?: string; publicName?: string };
			return { accountId, displayName: user.displayName ?? user.publicName ?? accountId };
		} catch {
			return { accountId, displayName: accountId };
		}
	}
}

export class ForgeGroupMembershipReader implements GroupMembershipReader {
	async members(groupId: string): Promise<string[]> {
		if (!groupId) return [];
		try {
			const response = await confluenceRequest(route`/wiki/api/v2/groups/${groupId}/members?limit=100`);
			if (!response.ok) return [];
			const body = (await response.json()) as { results?: Array<{ accountId?: string }> };
			return (body.results ?? []).flatMap((member) => (member.accountId ? [member.accountId] : []));
		} catch {
			return [];
		}
	}
}
