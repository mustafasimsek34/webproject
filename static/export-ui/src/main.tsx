import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { invoke, view } from '@forge/bridge';
import './styles.css';

type Status = 'confirmed' | 'expired' | 'outstanding' | 'cannot-view';
type ExportRow = { pageTitle: string; pageId: string; spaceKey: string; pageVersionConfirmed: number | ''; userDisplayName: string; userAccountId: string; assignmentType: 'assigned' | 'voluntary'; status: Status; confirmedAtUtc: string; dueDate: string; exportedAtUtc: string; appVersion: string };
type Filters = { scope: 'page' | 'space' | 'site'; pageId?: string; spaceKey?: string; fromUtc?: string; toUtc?: string; status?: Status };
const headers = ['page_title', 'page_id', 'space_key', 'page_version_confirmed', 'user_display_name', 'user_account_id', 'assignment_type', 'status', 'confirmed_at_utc', 'due_date', 'exported_at_utc', 'app_version'];
const copy = {
	en: { exportTitle: 'Export confirmations', scope: 'Scope', page: 'This page', space: 'Space', site: 'Entire site', status: 'Status', all: 'All statuses', from: 'From', to: 'To', format: 'Format', csv: 'CSV', pdf: 'PDF', download: 'Export', preparing: 'Preparing export — fetching records…', error: 'The export could not be prepared.', confirmed: 'Confirmed', expired: 'Expired', outstanding: 'Outstanding', cannotView: 'Cannot view', dateRange: 'Date range (optional)' },
	tr: { exportTitle: 'Onayları dışa aktar', scope: 'Kapsam', page: 'Bu sayfa', space: 'Alan', site: 'Tüm site', status: 'Durum', all: 'Tüm durumlar', from: 'Başlangıç', to: 'Bitiş', format: 'Biçim', csv: 'CSV', pdf: 'PDF', download: 'Dışa aktar', preparing: 'Dışa aktarma hazırlanıyor — kayıtlar getiriliyor…', error: 'Dışa aktarma hazırlanamadı.', confirmed: 'Onaylandı', expired: 'Süresi doldu', outstanding: 'Bekleyen', cannotView: 'Görüntülenemiyor', dateRange: 'Tarih aralığı (isteğe bağlı)' }
} as const;

function quote(value: unknown): string {
	const text = String(value ?? '');
	return /[\t"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function csvText(rows: ExportRow[]): string {
	return [headers, ...rows.map((row) => [row.pageTitle, row.pageId, row.spaceKey, row.pageVersionConfirmed, row.userDisplayName, row.userAccountId, row.assignmentType, row.status, row.confirmedAtUtc, row.dueDate, row.exportedAtUtc, row.appVersion])].map((line) => line.map(quote).join('\t')).join('\r\n') + '\r\n';
}
function utf16Le(text: string): Uint8Array {
	const bytes = new Uint8Array(2 + text.length * 2);
	bytes.set([0xff, 0xfe]);
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		bytes[2 + index * 2] = code & 0xff;
		bytes[3 + index * 2] = code >> 8;
	}
	return bytes;
}
function download(bytes: BlobPart, filename: string, type: string) {
	const url = URL.createObjectURL(new Blob([bytes], { type }));
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
async function collectRows(filters: Filters, exportedAtUtc: string): Promise<ExportRow[]> {
	const rows: ExportRow[] = [];
	let cursor: string | undefined;
	do {
		const result = await invoke('exportRows', { filters, cursor, exportedAtUtc, appVersion: '1.0.0' }) as { ok: boolean; data?: { rows: ExportRow[]; nextCursor?: string }; message?: string };
		if (!result.ok || !result.data) throw new Error(result.message);
		rows.push(...result.data.rows);
		cursor = result.data.nextCursor;
	} while (cursor);
	return rows;
}

function queryValue(params: URLSearchParams, key: string): string {
	return params.get(key) ?? '';
}

function scopeFromHref(href?: string): { scope: Filters['scope']; pageId: string; spaceKey: string } {
	const fallback = { scope: 'site' as const, pageId: '', spaceKey: '' };
	if (!href) return fallback;
	try {
		const url = href.includes('://') ? new URL(href) : new URL(href, 'https://export.local/');
		const params = new URLSearchParams(url.search);
		if (url.hash.includes('=')) {
			const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
			hash.forEach((value, key) => { if (value && !params.get(key)) params.set(key, value); });
		}
		const pageId = queryValue(params, 'pageId');
		const spaceKey = queryValue(params, 'spaceKey');
		if (pageId) return { scope: 'page', pageId, spaceKey };
		if (spaceKey) return { scope: 'space', pageId, spaceKey };
	} catch {
		return fallback;
	}
	return fallback;
}

function App() {
	const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
	const [scope, setScope] = useState<Filters['scope']>('site');
	const [pageId, setPageId] = useState('');
	const [spaceKey, setSpaceKey] = useState('');
	const [status, setStatus] = useState<Status | ''>('');
	const [fromUtc, setFromUtc] = useState('');
	const [toUtc, setToUtc] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const locale = navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
	const text = copy[locale];

	useEffect(() => {
		void view.getContext().then((context) => {
			const extension = context as { locale?: string; extension?: { location?: string; content?: { id?: string }; space?: { key?: string } } };
			const fromHref = scopeFromHref(typeof window !== 'undefined' ? `${window.location.search}${window.location.hash}` : '');
			const fromLocation = scopeFromHref(extension.extension?.location);
			const pageId = fromHref.pageId || fromLocation.pageId || extension.extension?.content?.id || '';
			const spaceKey = fromHref.spaceKey || fromLocation.spaceKey || extension.extension?.space?.key || '';
			setPageId(pageId);
			setSpaceKey(spaceKey);
			setScope(pageId ? 'page' : fromHref.scope === 'space' || fromLocation.scope === 'space' ? 'space' : 'site');
		});
	}, []);

	async function handleDownload() {
		setBusy(true);
		setError('');
		try {
			const filters: Filters = {
				scope,
				...(scope === 'page' ? { pageId: pageId.trim() } : {}),
				...(scope === 'space' ? { spaceKey: spaceKey.trim() } : {}),
				...(status ? { status } : {}),
				...(fromUtc.trim() ? { fromUtc: `${fromUtc.trim()}T00:00:00.000Z` } : {}),
				...(toUtc.trim() ? { toUtc: `${toUtc.trim()}T23:59:59.999Z` } : {})
			};
			if (scope === 'page' && !filters.pageId) throw new Error(locale === 'tr' ? 'Sayfa kapsamı için bir sayfa kimliği gerekir.' : 'A page ID is required for page-scoped export.');
			const exportedAtUtc = new Date().toISOString();
			const rows = await collectRows(filters, exportedAtUtc);
			const stamp = exportedAtUtc.slice(0, 10);
			if (format === 'csv') {
				download(utf16Le(csvText(rows)), `read-confirmations_${scope}_${stamp}.csv`, 'text/csv;charset=utf-16le');
			} else {
				const result = await invoke('buildPdfExport', { scope, exportedAtUtc, appVersion: '1.0.0', rows }) as { ok: boolean; data?: { base64: string }; message?: string };
				if (!result.ok || !result.data) throw new Error(result.message);
				const binary = Uint8Array.from(atob(result.data.base64), (character) => character.charCodeAt(0));
				download(binary, `read-confirmations_${scope}_${stamp}.pdf`, 'application/pdf');
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : text.error);
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="export-page">
			<section className="card">
				<h1>{text.exportTitle}</h1>
				<div className="field">
					<span className="label">{text.format}</span>
					<div className="row">
						<label><input type="radio" name="fmt" checked={format === 'csv'} onChange={() => setFormat('csv')} /> {text.csv}</label>
						<label><input type="radio" name="fmt" checked={format === 'pdf'} onChange={() => setFormat('pdf')} /> {text.pdf}</label>
					</div>
				</div>
				<div className="field">
					<span className="label">{text.scope}</span>
					<select value={scope} onChange={(event) => setScope(event.target.value as Filters['scope'])}>
						<option value="site">{text.site}</option>
						<option value="space">{text.space}</option>
						<option value="page">{text.page}</option>
					</select>
				</div>
				{scope === 'page' ? (
					<div className="field">
						<span className="label">{text.page}</span>
						<input type="text" value={pageId} onChange={(event) => setPageId(event.target.value)} />
					</div>
				) : null}
				{scope === 'space' ? (
					<div className="field">
						<span className="label">{text.space}</span>
						<input type="text" value={spaceKey} onChange={(event) => setSpaceKey(event.target.value)} />
					</div>
				) : null}
				<div className="field">
					<span className="label">{text.status}</span>
					<select value={status} onChange={(event) => setStatus(event.target.value as Status | '')}>
						<option value="">{text.all}</option>
						{(['confirmed', 'expired', 'outstanding', 'cannot-view'] as Status[]).map((value) => (
							<option key={value} value={value}>{text[value === 'cannot-view' ? 'cannotView' : value]}</option>
						))}
					</select>
				</div>
				<div className="field">
					<span className="label">{text.dateRange}</span>
					<div className="dates">
						<input type="date" value={fromUtc} onChange={(event) => setFromUtc(event.target.value)} aria-label={text.from} />
						<input type="date" value={toUtc} onChange={(event) => setToUtc(event.target.value)} aria-label={text.to} />
					</div>
				</div>
				{busy ? <p className="status">{text.preparing}</p> : null}
				{busy ? <div className="progress"><span /></div> : null}
				<button type="button" className="primary" disabled={busy} onClick={() => void handleDownload()}>{busy ? text.preparing : text.download}</button>
				{error ? <p className="error" role="alert">{error}</p> : null}
			</section>
		</main>
	);
}

createRoot(document.getElementById('root')!).render(<App />);
