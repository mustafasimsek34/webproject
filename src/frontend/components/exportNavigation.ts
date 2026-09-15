import { router, NavigationTarget } from '@forge/bridge';
export async function openExport(scope: { pageId?: string; spaceKey?: string } = {}) {
	const location = await router.getUrl({ target: NavigationTarget.Module, moduleKey: 'acknowledge-export' });
	if (!location) return;
	const url = new URL(location);
	Object.entries(scope).forEach(([key, value]) => value && url.searchParams.set(key, value));
	if (scope.pageId) url.hash = `pageId=${encodeURIComponent(scope.pageId)}`;
	else if (scope.spaceKey) url.hash = `spaceKey=${encodeURIComponent(scope.spaceKey)}`;
	await router.navigate(url.toString());
}
