import { ConfirmationRecord } from '../shared/types';
import { confirmationKey } from './entities';

export interface AppendOnlyConfirmationStore {
  get(key: string): Promise<ConfirmationRecord | undefined>;
  putIfAbsent(key: string, value: ConfirmationRecord): Promise<boolean>;
  byPage(pageId: string): Promise<ConfirmationRecord[]>;
}

export class MemoryConfirmationStore implements AppendOnlyConfirmationStore {
  private readonly records = new Map<string, ConfirmationRecord>();
  async get(key: string) { return this.records.get(key); }
  async putIfAbsent(key: string, value: ConfirmationRecord) {
    if (this.records.has(key)) return false;
    this.records.set(key, { ...value });
    return true;
  }
  async byPage(pageId: string) { return [...this.records.values()].filter((record) => record.pageId === pageId); }
  async append(value: ConfirmationRecord) { return this.putIfAbsent(confirmationKey(value.pageId, value.accountId, value.pageVersion), value); }
  size() { return this.records.size; }
}
