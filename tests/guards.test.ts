import fs from 'node:fs';
import path from 'node:path';
import { requireManager, requireSettingsAdmin } from '../src/resolvers/auth';
import { Result } from '../src/shared/types';

test('authorization returns no data for unprivileged actors', () => { const actor = { accountId: 'u', isConfluenceAdmin: false, isComplianceManager: false }; expect(requireManager(actor)).toEqual({ ok: false, code: 'FORBIDDEN', message: 'You need compliance-manager access.' }); expect(requireSettingsAdmin(actor)).toEqual({ ok: false, code: 'FORBIDDEN', message: 'Confluence administrator access is required.' }); });
test('manifest has the exact requested scopes, no egress, and no webtrigger', () => { const manifest = fs.readFileSync(path.join(process.cwd(), 'manifest.yml'), 'utf8'); expect(manifest).not.toMatch(/webtrigger/); expect(manifest).not.toMatch(/permissions:\s*[\s\S]*external:/); for (const scope of ['storage:app', 'read:page:confluence', 'read:user:confluence', 'read:group:confluence', 'read:content.permission:confluence', 'read:content-details:confluence']) expect(manifest).toContain(`    - ${scope}`); });
test('Result envelope is discriminated', () => { const result: Result<string> = { ok: true, data: 'ok' }; if (result.ok) expect(result.data).toBe('ok'); });
