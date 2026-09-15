export type Status = 'confirmed' | 'expired' | 'outstanding' | 'cannot-view' | 'page-deleted';
export type AssignmentType = 'assigned' | 'voluntary';
export type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export interface PageStatusResponse {
  pageId: string;
  status: Status;
  currentVersion: number;
  confirmedAt?: string;
  confirmedVersion?: number;
  assignmentType: AssignmentType;
  pageTitle?: string;
  dueDate?: string | null;
  canConfigure?: boolean;
}

export interface PageStatusRequest {
  pageId: string;
  currentVersion?: number;
  spaceKey?: string;
  config?: PageConfig;
  confirmations?: ConfirmationRecord[];
  canView?: boolean;
  pageDeleted?: boolean;
}

export interface ConfirmRequest extends PageStatusRequest {
  clientPageVersion: number;
}

export interface ConfirmResponse extends PageStatusResponse {
  created: boolean;
}

export interface ConfirmationRecord {
  pageId: string;
  accountId: string;
  pageVersion: number;
  confirmedAt: string;
  spaceKey: string;
  assignmentType: AssignmentType;
  appVersion: string;
  schemaVersion: 1;
}

export interface PageConfig {
  pageId: string;
  active: boolean;
  spaceKey: string;
  assignedUsers: string[];
  assignedGroups: string[];
  dueDate: string | null;
  reconfirmOnChange: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface ExportRow {
  pageTitle: string;
  pageId: string;
  spaceKey: string;
  pageVersionConfirmed: number | '';
  userDisplayName: string;
  userAccountId: string;
  assignmentType: AssignmentType;
  status: Status;
  confirmedAtUtc: string;
  dueDate: string;
  exportedAtUtc: string;
  appVersion: string;
}

export interface ExportFilters {
  scope: 'page' | 'space' | 'site';
  pageId?: string;
  spaceKey?: string;
  fromUtc?: string;
  toUtc?: string;
  status?: Status;
}

export interface ExportPageResult {
  rows: ExportRow[];
  nextCursor?: string;
}

export interface PageDetailItem {
  accountId: string;
  assignmentType: AssignmentType;
  groupId?: string;
  status: Status;
  pageVersion?: number;
  confirmedAt?: string;
  deletedUser?: boolean;
}

export interface PageDetailResponse {
  pageId: string;
  title: string;
  currentVersion: number;
  assigned: number;
  confirmed: number;
  cannotView: number;
  items: PageDetailItem[];
  history: Array<{ actorId: string; timestamp: string; before: unknown; after: unknown }>;
}
