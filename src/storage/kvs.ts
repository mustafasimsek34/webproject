import kvs, { ForgeKvsAPIError, Sort } from '@forge/kvs';
import { ConfirmationRecord, PageConfig } from '../shared/types';
import { confirmationKey, ENTITY } from './entities';
import { AuditRecord } from './audit';
import { Settings } from './settings';
import {
	AuditEntity,
	ConfigEntity,
	ConfirmationEntity,
	SettingsEntity,
	fromAuditEntity,
	fromConfigEntity,
	fromConfirmationEntity,
	fromSettingsEntity,
	toAuditEntity,
	toConfigEntity,
	toConfirmationEntity,
	toSettingsEntity
} from './entity-values';

const GLOBAL_SETTINGS_KEY = 'settings#global';

function values<T>(result: { results: Array<{ value: T }>; nextCursor?: string }): T[] {
	return result.results.map((item) => item.value);
}

export class KvsConfirmationStore implements AppendOnlyConfirmationStore {
	private readonly entity = kvs.entity<ConfirmationEntity>(ENTITY.confirmation);

	async get(key: string): Promise<ConfirmationRecord | undefined> {
		const row = await this.entity.get(key);
		return row ? fromConfirmationEntity(row) : undefined;
	}

	async putIfAbsent(key: string, value: ConfirmationRecord): Promise<boolean> {
		try {
			await this.entity.set(key, toConfirmationEntity(value), { keyPolicy: 'FAIL_IF_EXISTS' });
			return true;
		} catch (error) {
			if (isKeyConflict(error)) return false;
			throw error;
		}
	}

	async byPage(pageId: string, cursor?: string, limit = 100): Promise<{ items: ConfirmationRecord[]; nextCursor?: string }> {
		const pageLimit = Math.min(Math.max(limit, 1), 100);
		let query = this.entity.query().index('by-page', { partition: [pageId] }).limit(pageLimit);
		if (cursor) query = query.cursor(cursor);
		const result = await query.getMany();
		return { items: values(result).map(fromConfirmationEntity), ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) };
	}

	async byPageUser(pageId: string, accountId: string): Promise<ConfirmationRecord[]> {
		const result = await this.entity
			.query()
			.index('by-page-user', { partition: [pageId, accountId] })
			.sort(Sort.DESC)
			.getMany();
		return values(result).map(fromConfirmationEntity);
	}

	async append(value: ConfirmationRecord): Promise<boolean> {
		return this.putIfAbsent(confirmationKey(value.pageId, value.accountId, value.pageVersion), value);
	}
}

export interface AppendOnlyConfirmationStore {
	get(key: string): Promise<ConfirmationRecord | undefined>;
	putIfAbsent(key: string, value: ConfirmationRecord): Promise<boolean>;
	byPage(pageId: string, cursor?: string, limit?: number): Promise<{ items: ConfirmationRecord[]; nextCursor?: string }>;
}

export class KvsConfigStore implements ConfigStore {
	private readonly entity = kvs.entity<ConfigEntity>(ENTITY.config);

	async get(pageId: string): Promise<PageConfig | undefined> {
		const row = await this.entity.get(`config#${pageId}`);
		return row ? fromConfigEntity(row) : undefined;
	}

	async save(config: PageConfig): Promise<void> {
		await this.entity.set(`config#${config.pageId}`, toConfigEntity(config));
	}

	async listActive(cursor?: string, limit = 25): Promise<{ items: PageConfig[]; nextCursor?: string }> {
		let query = this.entity
			.query()
			.index('tracked', { partition: [true] })
			.limit(Math.min(Math.max(limit, 1), 100));
		if (cursor) query = query.cursor(cursor);
		const result = await query.getMany();
		return { items: values(result).map(fromConfigEntity), ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) };
	}
}

export interface ConfigStore {
	get(pageId: string): Promise<PageConfig | undefined>;
	save(config: PageConfig): Promise<void>;
	listActive(cursor?: string, limit?: number): Promise<{ items: PageConfig[]; nextCursor?: string }>;
}

export class KvsSettingsStore {
	private readonly entity = kvs.entity<SettingsEntity>(ENTITY.settings);

	async get(): Promise<Settings> {
		return fromSettingsEntity(await this.entity.get(GLOBAL_SETTINGS_KEY));
	}

	async save(value: Settings): Promise<void> {
		await this.entity.set(GLOBAL_SETTINGS_KEY, toSettingsEntity(value));
	}
}

export class KvsAuditStore {
	private readonly entity = kvs.entity<AuditEntity>(ENTITY.audit);

	async append(record: AuditRecord): Promise<void> {
		const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		await this.entity.set(`cfgaudit#${record.pageId}#${record.timestamp}#${nonce}`, toAuditEntity(record), { keyPolicy: 'FAIL_IF_EXISTS' });
	}

	async byPage(pageId: string): Promise<AuditRecord[]> {
		const result = await this.entity.query().index('by-page', { partition: [pageId] }).getMany();
		return values(result).map(fromAuditEntity);
	}
}

function isKeyConflict(error: unknown): boolean {
	if (!(error instanceof ForgeKvsAPIError)) return false;
	return ['ALREADY_EXISTS', 'KEY_ALREADY_EXISTS', 'CONFLICT'].includes(error.code);
}
