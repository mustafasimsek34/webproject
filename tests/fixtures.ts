import { ConfirmationRecord } from '../src/shared/types';
export const record = (version: number): ConfirmationRecord => ({ pageId: 'p', accountId: 'u', pageVersion: version, confirmedAt: '2026-01-01T00:00:00Z', spaceKey: 'S', assignmentType: 'assigned', appVersion: '1', schemaVersion: 1 });
