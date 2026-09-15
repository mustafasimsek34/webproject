import { ConfirmationRecord, PageConfig } from '../shared/types';
import { AuditRecord } from './audit';
import { Settings } from './settings';

export interface ConfirmationEntity {
	pageId: string;
	accountId: string;
	pageVersion: number;
	confirmedAt: string;
	spaceKey: string;
	payload: string;
}

export interface ConfigEntity {
	pageId: string;
	active: boolean;
	spaceKey: string;
	payload: string;
}

export interface SettingsEntity {
	key: string;
	payload: string;
}

export interface AuditEntity {
	pageId: string;
	timestamp: string;
	payload: string;
}

export function parsePayload(raw: unknown): Record<string, unknown> {
	if (typeof raw !== 'string' || !raw) return {};
	try {
		const value = JSON.parse(raw) as unknown;
		return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
	} catch {
		return {};
	}
}

function stringList(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function toConfirmationEntity(value: ConfirmationRecord): ConfirmationEntity {
	return {
		pageId: String(value.pageId),
		accountId: String(value.accountId),
		pageVersion: value.pageVersion,
		confirmedAt: value.confirmedAt,
		spaceKey: value.spaceKey || 'unknown',
		payload: JSON.stringify({
			assignmentType: value.assignmentType,
			appVersion: value.appVersion,
			schemaVersion: value.schemaVersion
		})
	};
}

export function fromConfirmationEntity(row: ConfirmationEntity): ConfirmationRecord {
	const extra = parsePayload(row.payload);
	return {
		pageId: row.pageId,
		accountId: row.accountId,
		pageVersion: row.pageVersion,
		confirmedAt: row.confirmedAt,
		spaceKey: row.spaceKey,
		assignmentType: extra.assignmentType === 'assigned' ? 'assigned' : 'voluntary',
		appVersion: typeof extra.appVersion === 'string' ? extra.appVersion : '1.0.0',
		schemaVersion: 1
	};
}

export function toConfigEntity(config: PageConfig): ConfigEntity {
	return {
		pageId: String(config.pageId),
		active: Boolean(config.active),
		spaceKey: config.spaceKey || 'unknown',
		payload: JSON.stringify({
			assignedUsers: config.assignedUsers,
			assignedGroups: config.assignedGroups,
			dueDate: config.dueDate || '',
			reconfirmOnChange: Boolean(config.reconfirmOnChange),
			createdBy: config.createdBy,
			createdAt: config.createdAt,
			updatedBy: config.updatedBy,
			updatedAt: config.updatedAt
		})
	};
}

export function fromConfigEntity(row: ConfigEntity): PageConfig {
	const extra = parsePayload(row.payload);
	const dueDate = typeof extra.dueDate === 'string' ? extra.dueDate : '';
	return {
		pageId: row.pageId,
		active: Boolean(row.active),
		spaceKey: row.spaceKey,
		assignedUsers: stringList(extra.assignedUsers),
		assignedGroups: stringList(extra.assignedGroups),
		dueDate: dueDate || null,
		reconfirmOnChange: Boolean(extra.reconfirmOnChange),
		createdBy: typeof extra.createdBy === 'string' ? extra.createdBy : '',
		createdAt: typeof extra.createdAt === 'string' ? extra.createdAt : '',
		updatedBy: typeof extra.updatedBy === 'string' ? extra.updatedBy : '',
		updatedAt: typeof extra.updatedAt === 'string' ? extra.updatedAt : ''
	};
}

export function toSettingsEntity(value: Settings): SettingsEntity {
	return {
		key: 'global',
		payload: JSON.stringify({
			complianceManagerUserIds: value.complianceManagerUserIds,
			complianceManagerGroupIds: value.complianceManagerGroupIds
		})
	};
}

export function fromSettingsEntity(row: SettingsEntity | undefined): Settings {
	const extra = parsePayload(row?.payload);
	return {
		complianceManagerUserIds: stringList(extra.complianceManagerUserIds),
		complianceManagerGroupIds: stringList(extra.complianceManagerGroupIds)
	};
}

export function toAuditEntity(record: AuditRecord): AuditEntity {
	return {
		pageId: record.pageId,
		timestamp: record.timestamp,
		payload: JSON.stringify({ actorId: record.actorId, before: record.before, after: record.after })
	};
}

export function fromAuditEntity(row: AuditEntity): AuditRecord {
	const extra = parsePayload(row.payload);
	return {
		pageId: row.pageId,
		timestamp: row.timestamp,
		actorId: typeof extra.actorId === 'string' ? extra.actorId : '',
		before: extra.before,
		after: extra.after
	};
}
