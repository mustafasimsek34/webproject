import React, { useEffect, useState } from 'react';
import { view } from '@forge/bridge';
import ForgeReconciler, { Button, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import { ConfirmResponse, PageStatusResponse } from '../shared/types';
import { localeFromContext, setAppLocale, t } from '../shared/i18n';
import { ConfirmBlock } from './components/ConfirmBlock';
import { ConfigModal } from './components/ConfigModal';
import { useInvoke } from './components/useInvoke';

interface ForgePageContext {
	locale?: string;
	localId?: string;
	extension?: { content?: { id?: string } };
}

export default function Macro() {
	const [pageId, setPageId] = useState<string>();
	const [status, setStatus] = useState<PageStatusResponse>();
	const [pageChanged, setPageChanged] = useState(false);
	const [configOpen, setConfigOpen] = useState(false);
	const [localeReady, setLocaleReady] = useState(false);
	const statusRequest = useInvoke<PageStatusResponse, { data: { pageId: string } }>('getPageStatus');
	const confirmRequest = useInvoke<ConfirmResponse, { data: { pageId: string; clientPageVersion: number } }>('confirm');

	const loadStatus = async (id: string) => {
		setPageChanged(false);
		const result = await statusRequest.run({ data: { pageId: id } });
		if (result?.ok) setStatus(result.data);
	};

	useEffect(() => {
		void view.getContext().then((context) => {
			const pageContext = context as ForgePageContext;
			setAppLocale(localeFromContext(pageContext));
			setLocaleReady(true);
			const id = pageContext.extension?.content?.id;
			if (!id) return;
			setPageId(id);
			void loadStatus(id);
		});
	}, [statusRequest.run]);

	const confirm = async () => {
		if (!pageId) return;
		setPageChanged(false);
		const result = await confirmRequest.run({ data: { pageId, clientPageVersion: status?.currentVersion ?? 1 } });
		if (!result?.ok) {
			setPageChanged(result?.code === 'PAGE_CHANGED');
			return;
		}
		setStatus(result.data);
	};

	if (statusRequest.error && !status) return <SectionMessage appearance="error"><Text>{statusRequest.error}</Text></SectionMessage>;
	if (!localeReady || statusRequest.loading || !status) return <Spinner size="small" />;
	if (status.status === 'cannot-view') return <SectionMessage appearance="warning"><Text>{t('cannotView')}</Text></SectionMessage>;
	if (status.status === 'page-deleted') return <SectionMessage appearance="information"><Text>{t('pageDeleted')}</Text></SectionMessage>;

	return (
		<Stack space="space.150">
			<ConfirmBlock
				status={status}
				loading={confirmRequest.loading}
				error={Boolean(confirmRequest.error) && !pageChanged}
				pageChanged={pageChanged}
				onConfirm={confirm}
				onReload={pageId ? () => void loadStatus(pageId) : undefined}
			/>
			{status.canConfigure && pageId ? (
				<Button appearance="subtle" onClick={() => setConfigOpen(true)}>{t('configureLong')}</Button>
			) : null}
			{pageId ? (
				<ConfigModal
					open={configOpen}
					pageId={pageId}
					onClose={() => setConfigOpen(false)}
					onSaved={() => void loadStatus(pageId)}
				/>
			) : null}
		</Stack>
	);
}

ForgeReconciler.render(<Macro />);
