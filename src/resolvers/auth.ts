import { Result } from '../shared/types';
import { t } from '../shared/i18n';

export interface Actor { accountId: string; isConfluenceAdmin: boolean; isComplianceManager: boolean; }
export function requireManager(actor: Actor): Result<true> { return actor.isConfluenceAdmin || actor.isComplianceManager ? { ok: true, data: true } : { ok: false, code: 'FORBIDDEN', message: t('forbiddenManager') }; }
export function requireSettingsAdmin(actor: Actor): Result<true> { return actor.isConfluenceAdmin ? { ok: true, data: true } : { ok: false, code: 'FORBIDDEN', message: t('forbiddenAdmin') }; }
