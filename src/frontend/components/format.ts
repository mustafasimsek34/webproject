export function formatLocalDateTime(iso?: string): string {
	if (!iso) return '';
	return new Intl.DateTimeFormat(undefined, {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(iso));
}

export function formatLocalDate(iso?: string | null): string {
	if (!iso) return '—';
	return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}
