import { AssignmentType, ConfirmationRecord } from '../shared/types';

export function confirmationKey(pageId: string, accountId: string, pageVersion: number): string {
  const safe = (value: string) => Array.from(value).map((character) => (character.codePointAt(0) ?? 0).toString(16).padStart(6, '0')).join('');
  return `confirm#${safe(pageId)}#${safe(accountId)}#${pageVersion}`;
}

export interface ConfirmationInput {
  pageId: string;
  accountId: string;
  serverPageVersion: number;
  clientPageVersion: number;
  spaceKey: string;
  confirmedAt: string;
  assignmentType: AssignmentType;
  appVersion: string;
}

export function makeConfirmation(input: ConfirmationInput): ConfirmationRecord | { pageChanged: true } {
  if (input.serverPageVersion !== input.clientPageVersion) return { pageChanged: true };
  return {
    pageId: input.pageId,
    accountId: input.accountId,
    pageVersion: input.serverPageVersion,
    confirmedAt: input.confirmedAt,
    spaceKey: input.spaceKey,
    assignmentType: input.assignmentType,
    appVersion: input.appVersion,
    schemaVersion: 1
  };
}
