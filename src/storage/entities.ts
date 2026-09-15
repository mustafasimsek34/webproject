export const ENTITY = { confirmation: 'confirmation', config: 'page-config', settings: 'settings', audit: 'config-audit' } as const;
const safeKeyPart = (value: string) => Array.from(value).map((character) => (character.codePointAt(0) ?? 0).toString(16).padStart(6, '0')).join('');
export const confirmationKey = (pageId: string, accountId: string, version: number) => `confirm#${safeKeyPart(pageId)}#${safeKeyPart(accountId)}#${version}`;
