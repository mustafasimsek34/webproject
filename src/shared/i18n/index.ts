import { en } from './en';
import { tr } from './tr';

export const catalogs = { en, tr };
export type Locale = keyof typeof catalogs;
export type MessageKey = keyof typeof en;

let currentLocale: Locale = 'en';

export function localeFromContext(context: { locale?: string; localId?: string }): Locale {
	const raw = `${context.locale ?? ''} ${context.localId ?? ''}`.toLowerCase();
	return raw.includes('tr') ? 'tr' : 'en';
}

export function setAppLocale(locale: Locale): void {
	currentLocale = locale;
}

export function t(key: MessageKey, vars?: Record<string, string | number>, locale: Locale = currentLocale): string {
	let value: string = catalogs[locale][key] ?? catalogs.en[key];
	if (vars) {
		for (const [name, replacement] of Object.entries(vars)) {
			value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
		}
	}
	return value;
}
