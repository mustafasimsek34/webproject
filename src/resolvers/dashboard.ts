import { Result } from '../shared/types';
import { Actor, requireManager } from './auth';
export interface DashboardPage {
	pageId: string;
	title: string;
	spaceKey: string;
	assigned: number;
	confirmed: number;
	percent: number | null;
	deleted?: boolean;
	canView?: boolean;
	overdue?: boolean;
	dueDate?: string ;
}
export function getDashboard(actor: Actor, pages: DashboardPage[]): Result<DashboardPage[]> { const access = requireManager(actor); return access.ok ? { ok: true, data: pages.filter((page) => page.canView !== false) } : access; }
