import { PageConfig } from '../shared/types';
export interface ConfigStore { get(pageId: string): Promise<PageConfig | undefined>; save(config: PageConfig): Promise<void>; listActive(cursor?: string, limit?: number): Promise<{ items: PageConfig[]; nextCursor?: string }>; }
export class MemoryConfigStore implements ConfigStore {
  private readonly values = new Map<string, PageConfig>();
  async get(pageId: string) { return this.values.get(pageId); }
  async save(config: PageConfig) { this.values.set(config.pageId, { ...config, assignedUsers: [...config.assignedUsers], assignedGroups: [...config.assignedGroups] }); }
  async listActive(cursor = '', limit = 100) { const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0; const items = [...this.values.values()].filter((value) => value.active).slice(offset, offset + limit); return { items, ...(offset + items.length < this.values.size ? { nextCursor: String(offset + items.length) } : {}) }; }
}
