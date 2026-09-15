import { MemoryConfirmationStore } from '../src/storage/confirmations';
import { AppendOnlyAuditStore } from '../src/storage/audit';
import { confirmationKey } from '../src/storage/entities';
import { fromConfigEntity, fromConfirmationEntity, toConfigEntity, toConfirmationEntity } from '../src/storage/entity-values';
import { record } from './fixtures';

test('confirmation store is idempotent and append-only', async () => { const store = new MemoryConfirmationStore(); const value = record(1); const key = confirmationKey('p', 'u', 1); expect(await store.putIfAbsent(key, value)).toBe(true); expect(await store.putIfAbsent(key, { ...value, confirmedAt: 'other' })).toBe(false); expect(await store.get(key)).toEqual(value); expect(store.size()).toBe(1); });
test('audit store only appends', async () => { const store = new AppendOnlyAuditStore(); await store.append({ pageId: 'p', actorId: 'a', timestamp: 'now', before: {}, after: {} }); expect(await store.byPage('p')).toHaveLength(1); });
test('tracked config pagination returns all 500 pages without duplicates', async () => { const { MemoryConfigStore } = await import('../src/storage/configs'); const store = new MemoryConfigStore(); for (let index = 0; index < 500; index += 1) await store.save({ pageId: `p-${index}`, active: true, spaceKey: 'S', assignedUsers: [], assignedGroups: [], dueDate: null, reconfirmOnChange: false, createdBy: 'a', createdAt: '', updatedBy: 'a', updatedAt: '' }); let cursor: string | undefined; const pages: string[] = []; do { const result = await store.listActive(cursor, 100); pages.push(...result.items.map((item) => item.pageId)); cursor = result.nextCursor; } while (cursor !== undefined); expect(new Set(pages).size).toBe(500); });
test('entity values omit null dueDate and round-trip confirmation extras', () => {
	const stored = toConfigEntity({ pageId: 'p', active: true, spaceKey: 'S', assignedUsers: ['u'], assignedGroups: [], dueDate: null, reconfirmOnChange: false, createdBy: 'a', createdAt: 't', updatedBy: 'a', updatedAt: 't' });
	expect(JSON.parse(stored.payload).dueDate).toBe('');
	expect(fromConfigEntity(stored).dueDate).toBeNull();
	const confirmation = fromConfirmationEntity(toConfirmationEntity(record(3)));
	expect(confirmation.assignmentType).toBe('assigned');
	expect(confirmation.schemaVersion).toBe(1);
});
