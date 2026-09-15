import React, { useEffect, useState } from 'react';
import { view } from '@forge/bridge';
import ForgeReconciler, { Button, Lozenge, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, Spinner, Stack, Text } from '@forge/react';
import { PageStatusResponse } from '../shared/types';
import { localeFromContext, setAppLocale, t } from '../shared/i18n';
import { StatusLozenge } from './components/StatusLozenge';
import { useInvoke } from './components/useInvoke';
import { ConfirmBlock } from './components/ConfirmBlock';
import { formatLocalDate } from './components/format';

interface ForgePageContext {
	locale?: string;
	localId?: string;
	extension?: { content?: { id?: string } };
}

export default function Byline() {
	const [status, setStatus] = useState<PageStatusResponse>();
	const [pageId, setPageId] = useState<string>();
	const [dialogOpen, setDialogOpen] = useState(false);
	const request = useInvoke<PageStatusResponse, { data: { pageId: string } }>('getPageStatus');
	const confirmRequest = useInvoke<PageStatusResponse & { created: boolean }, { data: { pageId: string; clientPageVersion: number } }>('confirm');

	useEffect(() => {
		void view.getContext().then((context) => {
			const pageContext = context as ForgePageContext;
			setAppLocale(localeFromContext(pageContext));
			const id = pageContext.extension?.content?.id;
			if (!id) return;
			setPageId(id);
			void request.run({ data: { pageId: id } }).then((result) => {
				if (result?.ok) setStatus(result.data);
			});
		});
	}, [request.run]);

	if (request.loading) return <Spinner size="small" />;
	if (request.error || !status || status.status === 'cannot-view' || status.status === 'page-deleted') return null;
	if (status.assignmentType === 'voluntary' && status.status === 'outstanding') return null;

	const confirm = async () => {
		if (!pageId) return;
		const result = await confirmRequest.run({ data: { pageId, clientPageVersion: status.currentVersion } });
		if (result?.ok) setStatus(result.data);
	};

	const chip = status.status === 'confirmed'
		? <Lozenge appearance="success">{t('bylineConfirmed', { date: formatLocalDate(status.confirmedAt) })}</Lozenge>
		: <StatusLozenge status={status.status} />;

	return (
		<>
			<Button appearance="subtle" onClick={() => setDialogOpen(true)}>{chip}</Button>
			{dialogOpen && (
				<Modal onClose={() => setDialogOpen(false)}>
					<ModalHeader><ModalTitle>{t('bylineDialogTitle')}</ModalTitle></ModalHeader>
					<ModalBody>
						<Stack space="space.100">
							<Text>{status.status === 'confirmed' ? t('confirmedOn', { version: status.confirmedVersion ?? status.currentVersion, datetime: status.confirmedAt ?? '' }) : t('bylineDialogBody')}</Text>
							<ConfirmBlock status={status} loading={confirmRequest.loading} error={Boolean(confirmRequest.error)} onConfirm={confirm} />
						</Stack>
					</ModalBody>
					<ModalFooter><Button onClick={() => setDialogOpen(false)}>{t('close')}</Button></ModalFooter>
				</Modal>
			)}
		</>
	);
}

ForgeReconciler.render(<Byline />);
