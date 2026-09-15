import { ConfirmationRecord, PageConfig, Status } from '../shared/types';

export interface StatusInput {
  records: ConfirmationRecord[];
  currentVersion: number;
  reconfirmOnChange: boolean;
  canView: boolean;
  pageDeleted?: boolean;
}

export function computeStatus(input: StatusInput): Status | 'page-deleted' {
  if (input.pageDeleted) return 'page-deleted';
  if (!input.canView) return 'cannot-view';
  const latest = input.records.reduce<ConfirmationRecord | undefined>(
    (best, record) => (!best || record.pageVersion > best.pageVersion ? record : best),
    undefined
  );
  if (!latest) return 'outstanding';
  return !input.reconfirmOnChange || latest.pageVersion === input.currentVersion ? 'confirmed' : 'expired';
}

export interface Completion { confirmed: number; denominator: number; percent: number | null }
export function completion(statuses: Array<{ status: Status; assignmentType: 'assigned' | 'voluntary' }>): Completion {
  const assigned = statuses.filter((item) => item.assignmentType === 'assigned' && item.status !== 'cannot-view');
  const confirmed = assigned.filter((item) => item.status === 'confirmed').length;
  return { confirmed, denominator: assigned.length, percent: assigned.length ? confirmed / assigned.length : null };
}

export function assignedAccountIds(config: PageConfig, groupMembers: Record<string, string[]>): string[] {
  return [...new Set([...config.assignedUsers, ...config.assignedGroups.flatMap((group) => groupMembers[group] ?? [])])];
}
