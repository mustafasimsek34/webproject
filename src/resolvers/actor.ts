import { Actor } from './auth';
import { ForgeGroupMembershipReader, userHasAdminister } from '../storage/confluence';
import { KvsSettingsStore } from '../storage/kvs';

interface InvocationContext {
	accountId?: unknown;
}

export async function actorFromInvocation(context: InvocationContext): Promise<Actor> {
	const accountId = typeof context.accountId === 'string' ? context.accountId : '';
	if (!accountId) return { accountId: '', isConfluenceAdmin: false, isComplianceManager: false };

	try {
		const settings = await new KvsSettingsStore().get();
		const groupReader = new ForgeGroupMembershipReader();
		const groupMemberships = await Promise.all(settings.complianceManagerGroupIds.map((groupId) => groupReader.members(groupId)));
		const isComplianceManager = settings.complianceManagerUserIds.includes(accountId) || groupMemberships.some((members) => members.includes(accountId));
		const isConfluenceAdmin = await userHasAdminister(accountId);
		return { accountId, isConfluenceAdmin, isComplianceManager };
	} catch {
		return { accountId, isConfluenceAdmin: false, isComplianceManager: false };
	}
}
