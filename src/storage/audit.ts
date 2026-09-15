export interface AuditRecord { pageId: string; actorId: string; timestamp: string; before: unknown; after: unknown; }
export class AppendOnlyAuditStore {
  private readonly records: AuditRecord[] = [];
  async append(record: AuditRecord) { this.records.push({ ...record }); }
  async byPage(pageId: string) { return this.records.filter((record) => record.pageId === pageId).map((record) => ({ ...record })); }
  size() { return this.records.length; }
}
